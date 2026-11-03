import type { CanvasImage, ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { getImageDrawPos } from './geoUtils';
import { loadImage } from './textureInjection';
import { getFullOverlaySurface, getOverlayTileCrop } from './overlaySurfaceRenderer';
import { renderThreeDObjectCrop, makeThreeDTargetId, isThreeDTargetId } from './threeDInjectionUtils';
import { isAllLayersTargetId } from './allLayersInjectionHelper';

/**
 * Checks whether any of the given tiles have transparent pixels (alpha < 255)
 * INSIDE the isometric diamond area.
 */
export async function checkTilesHaveTransparency(
    tiles: CanvasImage[]
): Promise<{ hasTransparency: boolean; transparentTileCount: number }> {
    let count = 0;

    for (const tile of tiles) {
        if (!tile.src) continue;
        const img = await loadImage(tile.src);
        if (!img) continue;

        const canvas = document.createElement('canvas');
        canvas.width = tile.width;
        canvas.height = tile.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;

        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, tile.width, tile.height).data;

        const w = tile.width;
        const h = tile.height;
        const midX = (w - 1) / 2;
        const midY = (h - 1) / 2;
        const radX = w / 2;
        const radY = h / 2;

        let tileHasHole = false;
        for (let py = 0; py < h; py++) {
            const dy = Math.abs(py - midY) / radY;
            if (dy > 1.0) continue;
            for (let px = 0; px < w; px++) {
                const dx = Math.abs(px - midX) / radX;
                if (dx + dy <= 1.02) {
                    const idx = (py * w + px) * 4;
                    if (data[idx + 3] < 255) {
                        tileHasHole = true;
                        break;
                    }
                }
            }
            if (tileHasHole) break;
        }

        if (tileHasHole) count++;
    }

    return {
        hasTransparency: count > 0,
        transparentTileCount: count
    };
}

/**
 * Automatically fills up transparent areas in tiles with whatever shows underneath
 * from visible layers placed 'under' (placement === 'back') and any 3D objects in the scene.
 * Uses HTML5 2D canvas clipping to the tile diamond and 'destination-over' compositing
 * to preserve solid tile pixels and seamlessly fill holes with the underlying surfaces and 3D models.
 */
export async function bakeUnderneathToTiles(
    tilesToBake: CanvasImage[],
    allImages: CanvasImage[],
    overlays: ProjectOverlay[],
    gridType: GridType,
    fillRemainingWithBlack: boolean = false
): Promise<{ updatedImages: CanvasImage[]; bakedCount: number }> {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const underOverlays = overlays.filter(
        ov =>
            ov.placement === 'back' &&
            ov.isVisible &&
            ov.src &&
            !isThreeDTargetId(ov.id) &&
            !isThreeDTargetId(ov.src) &&
            !isAllLayersTargetId(ov.id) &&
            !isAllLayersTargetId(ov.src)
    );

    const tileIdSet = new Set(tilesToBake.map(t => t.id));
    const updatedImages = [...allImages];
    let bakedCount = 0;

    // Pre-fetch surfaces for under-layers
    const underSurfaces = [];
    for (const ov of underOverlays) {
        const surface = await getFullOverlaySurface(ov, gridType, overlays);
        if (surface) {
            underSurfaces.push({ ov, surface });
        }
    }

    for (let i = 0; i < updatedImages.length; i++) {
        const tile = updatedImages[i];
        if (!tileIdSet.has(tile.id)) continue;

        const tileImg = await loadImage(tile.src);
        if (!tileImg) continue;

        const w = tile.width;
        const h = tile.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;

        ctx.drawImage(tileImg, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const midX = (w - 1) / 2;
        const midY = (h - 1) / 2;
        const radX = w / 2;
        const radY = h / 2;

        let hasTransparentInDiamond = false;
        for (let py = 0; py < h; py++) {
            const dy = Math.abs(py - midY) / radY;
            if (dy > 1.0) continue;
            for (let px = 0; px < w; px++) {
                const dx = Math.abs(px - midX) / radX;
                if (dx + dy <= 1.02) {
                    const idx = (py * w + px) * 4;
                    if (data[idx + 3] < 255) {
                        hasTransparentInDiamond = true;
                        break;
                    }
                }
            }
            if (hasTransparentInDiamond) break;
        }

        if (!hasTransparentInDiamond) continue;

        const drawPos = getImageDrawPos(tile, config.width, config.height);
        const tileDrawX = Math.round(drawPos.x) + tile.offsetX;
        const tileDrawY = Math.round(drawPos.y) + tile.offsetY;

        // Render any 3D objects at this tile's coordinates
        const threeDCrop = await renderThreeDObjectCrop(
            makeThreeDTargetId('all'),
            tileDrawX,
            tileDrawY,
            w,
            h
        );

        // Composite under-layers and 3D scene strictly inside the tile's isometric diamond
        if (underSurfaces.length > 0 || threeDCrop) {
            const underComposite = document.createElement('canvas');
            underComposite.width = w;
            underComposite.height = h;
            const uCtx = underComposite.getContext('2d', { willReadFrequently: true })!;
            uCtx.imageSmoothingEnabled = false;

            for (const { ov, surface } of underSurfaces) {
                const crop = getOverlayTileCrop(surface, tileDrawX, tileDrawY, w, h, ov.filters.renderMode);
                uCtx.save();
                uCtx.globalAlpha = ov.opacity / 100;
                uCtx.drawImage(crop, 0, 0);
                uCtx.restore();
            }

            if (threeDCrop) {
                uCtx.save();
                uCtx.globalAlpha = 1;
                uCtx.drawImage(threeDCrop, 0, 0);
                uCtx.restore();
            }

            // Clip destination-over to the tile diamond so corners stay transparent
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h / 2);
            ctx.lineTo(w / 2, h);
            ctx.lineTo(0, h / 2);
            ctx.closePath();
            ctx.clip();

            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(underComposite, 0, 0);
            ctx.restore();
        }

        // If remaining transparent pixels inside diamond and fillRemainingWithBlack requested
        if (fillRemainingWithBlack) {
            const checkData = ctx.getImageData(0, 0, w, h);
            const cd = checkData.data;
            for (let py = 0; py < h; py++) {
                const dy = Math.abs(py - midY) / radY;
                if (dy > 1.0) continue;
                for (let px = 0; px < w; px++) {
                    const dx = Math.abs(px - midX) / radX;
                    if (dx + dy <= 1.02) {
                        const idx = (py * w + px) * 4;
                        if (cd[idx + 3] < 255) {
                            cd[idx] = 0;       // black
                            cd[idx + 1] = 0;   // black
                            cd[idx + 2] = 0;   // black
                            cd[idx + 3] = 255; // solid
                        }
                    }
                }
            }
            ctx.putImageData(checkData, 0, 0);
        }

        const newSrc = canvas.toDataURL('image/png');
        updatedImages[i] = {
            ...tile,
            src: newSrc,
            originalSrc: newSrc
        };
        bakedCount++;
    }

    return { updatedImages, bakedCount };
}

