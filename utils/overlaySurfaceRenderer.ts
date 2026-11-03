import type { ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { renderOverlayToCanvas, loadImage } from './textureInjection';
import { applyContourInjection } from './imageEffects';
import { applyTiledBrushes } from './tiledBrushRenderer';
import { getLoadedPalette, applyPaletteLimitToCanvas } from './paletteViewerHelper';
import { loadDefaultPalette } from './westwoodPaletteParser';
import { isLinkedGroupId, renderLinkedGroupComposite } from './layerLinkUtils';
import { isThreeDTargetId, renderThreeDObjectCrop } from './threeDInjectionUtils';
import { isAllLayersTargetId, renderAllLayersCompositeCrop } from './allLayersInjectionHelper';

export interface FullOverlaySurface {
    canvas: HTMLCanvasElement;
    originX: number;
    originY: number;
    width: number;
    height: number;
}

const surfaceCache = new Map<string, FullOverlaySurface>();

export const clearSurfaceCache = () => {
    surfaceCache.clear();
};

/**
 * Renders the entire continuous surface of an overlay to a dedicated canvas.
 * This matches the exact visual representation rendered by TiledOverlay / SmartOverlay on the canvas.
 */
export async function getFullOverlaySurface(
    ov: ProjectOverlay,
    gridType: GridType,
    allOverlays: ProjectOverlay[] = [],
    useCache: boolean = true
): Promise<FullOverlaySurface | null> {
    if (!ov.isVisible || !ov.src) return null;

    const f = ov.filters;
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };

    // Calculate bounds based on overlay type
    let originX = 0;
    let originY = 0;
    let targetWidth = 1;
    let targetHeight = 1;

    if (ov.type === 'smart') {
        const footprint = (f.staticScale || 100) / 100;
        const individualZoom = (f.mainScale || 100) / 100;
        originX = Math.round(ov.x);
        originY = Math.round(ov.y);
        targetWidth = Math.max(1, Math.round(ov.width * footprint * individualZoom));
        targetHeight = Math.max(1, Math.round(ov.height * footprint * individualZoom));
    } else {
        const footprint = (f.staticScale || 100) / 100;
        const tileW = config.width * footprint;
        const tileH = config.height * footprint;

        const rx = Math.max(1, Number(ov.repeatX) || 1);
        const ry = Math.max(1, Number(ov.repeatY) || 1);

        const minX = -ry * (tileW / 2);
        const maxX = rx * (tileW / 2);
        const minY = -tileH;
        const maxY = (rx + ry) * (tileH / 2) + tileH * 2.5;

        originX = Math.round(ov.x + minX);
        originY = Math.round(ov.y + minY);
        targetWidth = Math.max(1, Math.ceil((maxX - minX) + tileW * 2) || 1);
        targetHeight = Math.max(1, Math.ceil((maxY - minY) + tileH * 2) || 1);
    }

    let transitionPart = '';
    if (f.transitionOverlayId) {
        if (isAllLayersTargetId(f.transitionOverlayId)) {
            transitionPart = `_all_layers_${f.transitionOverlayId}`;
        } else if (isThreeDTargetId(f.transitionOverlayId)) {
            transitionPart = `_3d_${f.transitionOverlayId}`;
        } else if (isLinkedGroupId(f.transitionOverlayId)) {
            const grpLayers = allOverlays.filter(o => o.linkGroupId === f.transitionOverlayId);
            transitionPart = `_link_${f.transitionOverlayId}_${grpLayers.map(l => `${l.src}_${l.x}_${l.y}_${JSON.stringify(l.filters)}`).join('|')}`;
        } else {
            const transOv = allOverlays.find(o => o.id === f.transitionOverlayId);
            if (transOv) {
                transitionPart = `_${transOv.src}_${JSON.stringify(transOv.filters)}`;
            }
        }
    }

    // Position-independent cache key ensures dragging overlay does not trigger re-rendering
    const cacheKey = `${ov.id}_${ov.src}_${ov.type}_${gridType}_${targetWidth}_${targetHeight}_${ov.repeatX || 1}_${ov.repeatY || 1}_${transitionPart}_${JSON.stringify(f)}_${ov.paletteViewer ? 'pal' : 'norm'}`;
    if (useCache && surfaceCache.has(cacheKey)) {
        const cached = surfaceCache.get(cacheKey)!;
        return {
            canvas: cached.canvas,
            originX,
            originY,
            width: targetWidth,
            height: targetHeight
        };
    }

    try {
        const sources = [ov.src, ...(f.additionalTextures?.map(t => t.src) || [])].filter(Boolean) as string[];
        if (f.transitionOverlayId && !isLinkedGroupId(f.transitionOverlayId) && !isThreeDTargetId(f.transitionOverlayId) && !isAllLayersTargetId(f.transitionOverlayId)) {
            const transOv = allOverlays.find(o => o.id === f.transitionOverlayId);
            if (transOv?.src) sources.push(transOv.src);
        }

        const loadedImages = await Promise.all(sources.map(src => loadImage(src)));
        const mainImg = loadedImages[0];
        if (!mainImg) return null;

        const addImagesMap = new Map<string, HTMLCanvasElement | HTMLImageElement>();
        if (f.additionalTextures && f.additionalTextures.length > 0) {
            for (let addIdx = 0; addIdx < f.additionalTextures.length; addIdx++) {
                const add = f.additionalTextures[addIdx];
                const img = await loadImage(add.src);
                if (img) {
                    const af = add.filters;
                    const hasIndividualFilter = af && (
                        (af.hue !== undefined && af.hue !== 0) ||
                        (af.saturation !== undefined && af.saturation !== 100) ||
                        (af.brightness !== undefined && af.brightness !== 100) ||
                        (af.contrast !== undefined && af.contrast !== 100)
                    );
                    if (hasIndividualFilter) {
                        const filtered = document.createElement('canvas');
                        filtered.width = img.width;
                        filtered.height = img.height;
                        const fCtx = filtered.getContext('2d')!;
                        fCtx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp';
                        if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
                            fCtx.imageSmoothingQuality = 'high';
                        }
                        fCtx.filter = `brightness(${af.brightness ?? 100}%) contrast(${af.contrast ?? 100}%) saturate(${af.saturation ?? 100}%) hue-rotate(${af.hue ?? 0}deg)`;
                        fCtx.drawImage(img, 0, 0);
                        (filtered as any)._cacheId = `add_${addIdx}_${add.src.length}_${add.src.slice(-32)}_h${af.hue ?? 0}_s${af.saturation ?? 100}_b${af.brightness ?? 100}_c${af.contrast ?? 100}`;
                        addImagesMap.set(add.src, filtered);
                    } else {
                        (img as any)._cacheId = `add_${addIdx}_${add.src.length}_${add.src.slice(-32)}`;
                        addImagesMap.set(add.src, img);
                    }
                }
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;

        ctx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp';
        if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
            ctx.imageSmoothingQuality = 'high';
        }

        renderOverlayToCanvas(
            ctx,
            ov,
            mainImg,
            originX,
            originY,
            config,
            targetWidth,
            targetHeight,
            1, // PixelScaleOverride 1:1 match with world space
            addImagesMap
        );

        if (f.transitionOverlayId && f.transitionGroupAId && f.transitionGroupBId) {
            if (isAllLayersTargetId(f.transitionOverlayId)) {
                const allCompCrop = await renderAllLayersCompositeCrop(
                    allOverlays,
                    gridType,
                    originX,
                    originY,
                    targetWidth,
                    targetHeight
                );
                if (allCompCrop) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, allCompCrop, refPixels);
                }
            } else if (isThreeDTargetId(f.transitionOverlayId)) {
                const threeDCrop = await renderThreeDObjectCrop(
                    f.transitionOverlayId,
                    originX,
                    originY,
                    targetWidth,
                    targetHeight
                );
                if (threeDCrop) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, threeDCrop, refPixels);
                }
            } else if (isLinkedGroupId(f.transitionOverlayId)) {
                const comp = await renderLinkedGroupComposite(
                    f.transitionOverlayId,
                    allOverlays,
                    gridType,
                    originX,
                    originY,
                    targetWidth,
                    targetHeight
                );
                if (comp) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, comp.canvas, refPixels);
                }
            } else {
                const transOv = allOverlays.find(o => o.id === f.transitionOverlayId);
                if (transOv?.src) {
                    const transImg = await loadImage(transOv.src);
                    if (transImg) {
                        const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                        applyContourInjection(ctx, f, transImg, refPixels);
                    }
                }
            }
        }

        // Apply Tiled Brushes
        if (f.brushes && f.brushes.length > 0) {
            await applyTiledBrushes(ctx, ov, originX, originY, config, targetWidth, targetHeight, 1);
        }

        // Palette Viewer: limit the layer visibly to the loaded .pal file
        if (ov.paletteViewer || f.paletteViewer) {
            const pal = getLoadedPalette() || await loadDefaultPalette();
            if (pal && pal.length > 0) {
                applyPaletteLimitToCanvas(canvas, pal);
            }
        }

        const surface: FullOverlaySurface = {
            canvas,
            originX,
            originY,
            width: targetWidth,
            height: targetHeight
        };

        if (useCache) {
            if (surfaceCache.size >= 25) {
                const oldestKey = surfaceCache.keys().next().value;
                if (oldestKey) surfaceCache.delete(oldestKey);
            }
            surfaceCache.set(cacheKey, surface);
        }

        return surface;
    } catch (e) {
        console.error("Failed to render full overlay surface", e);
        return null;
    }
}

/**
 * Extracts a tile-sized crop from the full overlay surface.
 * Guarantees exact 1:1 pixel correspondence with what is rendered underneath the tile.
 */
export function getOverlayTileCrop(
    surface: FullOverlaySurface,
    tileDrawX: number,
    tileDrawY: number,
    tileWidth: number,
    tileHeight: number,
    renderMode?: 'pixel' | 'smooth' | 'crisp'
): HTMLCanvasElement {
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileWidth;
    tileCanvas.height = tileHeight;
    const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
    if (!tileCtx) return tileCanvas;

    tileCtx.imageSmoothingEnabled = false;
    tileCtx.drawImage(
        surface.canvas,
        -(tileDrawX - surface.originX),
        -(tileDrawY - surface.originY)
    );

    return tileCanvas;
}
