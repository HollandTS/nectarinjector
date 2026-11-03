import type { CanvasImage, HandBrushSettings } from '../types';
import { getImageDrawPos } from './geoUtils';
import { applyColoringToImageData, applyDirectColoringToStampCanvas } from './brushColoringHelper';
import { getInvertedBrushImage } from './brushInvertHelper';
import { loadImage } from './textureInjection';
import {
    createResampledBrushCanvas,
    configureCanvasContextForSampling,
} from './brushResizeSampling';

export interface RenderedBrushStamp {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
}

/**
 * Renders a single brush stamp canvas matching the exact settings:
 * Footprint, mainScale, canvasZoom, rotation, mirrorH/mirrorV, invert, resizeSampling, and isometric transform vs untransformed.
 */
export function renderHandBrushStamp(
    brushImg: HTMLImageElement | HTMLCanvasElement,
    settings: HandBrushSettings,
    config: { width: number; height: number },
    overrideRotation?: number,
    skipNormalColoring?: boolean
): RenderedBrushStamp {
    const footprint = Math.max(1, settings.footprint || 1);
    const tileW = config.width * footprint;
    const baseSqSize = Math.max(4, Math.round(tileW / Math.sqrt(2)));

    const borderCut = Math.max(0.01, (settings.canvasZoom || 100) / 100);
    const individualZoom = Math.max(0.01, (settings.mainScale || 100) / 100);
    const rotation = overrideRotation !== undefined ? overrideRotation : (settings.rotation || 0);

    // Source rect for internal zoom/border cut
    const sWidth = borderCut >= 1 ? brushImg.width / borderCut : brushImg.width;
    const sHeight = borderCut >= 1 ? brushImg.height / borderCut : brushImg.height;
    const sx = borderCut >= 1 ? (brushImg.width - sWidth) / 2 : 0;
    const sy = borderCut >= 1 ? (brushImg.height - sHeight) / 2 : 0;

    // For SHP files, strictly respect the SHP file's exact native canvas dimensions (width x height)
    // instead of forcing the sprite into a square `baseSqSize x baseSqSize` box.
    // For non-SHP untransformed images, also preserve their aspect ratio if non-square.
    let drawW: number;
    let drawH: number;
    if (settings.isShpBrush) {
        const shpScale = footprint * (borderCut < 1 ? borderCut : 1);
        drawW = Math.max(1, sWidth * shpScale);
        drawH = Math.max(1, sHeight * shpScale);
    } else if (settings.tilingMode === 'untransformed' && brushImg.width > 0 && brushImg.height > 0 && brushImg.width !== brushImg.height) {
        const maxSide = Math.max(brushImg.width, brushImg.height);
        const baseScale = (borderCut < 1 ? baseSqSize * borderCut : baseSqSize) / maxSide;
        drawW = Math.max(1, brushImg.width * baseScale);
        drawH = Math.max(1, brushImg.height * baseScale);
    } else {
        drawW = borderCut < 1 ? baseSqSize * borderCut : baseSqSize;
        drawH = borderCut < 1 ? baseSqSize * borderCut : baseSqSize;
    }

    // Calculate canvas size large enough to hold the rotated & scaled stamp
    const maxDimension = Math.max(drawW, drawH) * individualZoom * 2.8;
    const canvasSize = Math.max(32, Math.ceil(maxDimension));
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = canvasSize;
    stampCanvas.height = canvasSize;
    const ctx = stampCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        return {
            canvas: stampCanvas,
            width: canvasSize,
            height: canvasSize,
            centerX: canvasSize / 2,
            centerY: canvasSize / 2
        };
    }

    const sampling = settings.resizeSampling ?? (settings.isShpBrush ? 'pixel_art' : 'bicubic');
    configureCanvasContextForSampling(ctx, sampling);

    const midX = canvasSize / 2;
    const midY = canvasSize / 2;

    const effectiveImg = settings.invert && (brushImg instanceof HTMLImageElement || brushImg instanceof HTMLCanvasElement)
        ? getInvertedBrushImage(brushImg, brushImg.width, brushImg.height, settings.brushSrc)
        : brushImg;

    // Pre-resample source region to final scaled dimensions (`drawW * individualZoom` x `drawH * individualZoom`)
    // using the chosen sampling method so downscaled stamps never turn blocky/pixelated unless 'nearest' is selected
    const finalScaledW = Math.max(1, drawW * individualZoom);
    const finalScaledH = Math.max(1, drawH * individualZoom);
    const resampledCanvas = createResampledBrushCanvas(
        effectiveImg,
        sx,
        sy,
        sWidth,
        sHeight,
        finalScaledW,
        finalScaledH,
        sampling
    );

    ctx.save();
    ctx.translate(midX, midY);

    // Untransformed (flat 1:1 image) vs Tiled (isometric 2:1 projection)
    if (settings.tilingMode === 'untransformed') {
        if (rotation !== 0) {
            ctx.rotate((rotation * Math.PI) / 180);
        }
        if (settings.mirrorH) ctx.scale(-1, 1);
        if (settings.mirrorV) ctx.scale(1, -1);
        ctx.drawImage(
            resampledCanvas,
            0,
            0,
            resampledCanvas.width,
            resampledCanvas.height,
            -finalScaledW / 2,
            -finalScaledH / 2,
            finalScaledW,
            finalScaledH
        );
    } else {
        // Flat isometric tile (2:1 diamond)
        const pad = 1.01;
        ctx.scale(pad, pad / 2);
        ctx.rotate((45 * Math.PI) / 180);
        if (rotation !== 0) {
            ctx.rotate((rotation * Math.PI) / 180);
        }
        if (settings.mirrorH) ctx.scale(-1, 1);
        if (settings.mirrorV) ctx.scale(1, -1);
        ctx.drawImage(
            resampledCanvas,
            0,
            0,
            resampledCanvas.width,
            resampledCanvas.height,
            -finalScaledW / 2,
            -finalScaledH / 2,
            finalScaledW,
            finalScaledH
        );
    }
    ctx.restore();

    // Apply Normal mode coloring (Hue, Saturation, Brightness, Transparency) directly to the stamp pixels
    if (settings.mode === 'normal' && !skipNormalColoring) {
        applyDirectColoringToStampCanvas(
            stampCanvas,
            settings.normalHue ?? 0,
            settings.normalSaturation ?? 100,
            settings.normalBrightness ?? 100,
            settings.normalTransparency ?? 0
        );
    }

    return {
        canvas: stampCanvas,
        width: canvasSize,
        height: canvasSize,
        centerX: midX,
        centerY: midY
    };
}

/**
 * Creates a cursor preview canvas of the brush stamp (including SHP sprite colors + shadow outline when SHP is active),
 * so the user always sees the exact brush shape, SHP frame, and shadow under the cursor.
 */
export function renderHandBrushCursor(
    stamp: RenderedBrushStamp,
    shadowStamp?: RenderedBrushStamp | null,
    settings?: HandBrushSettings
): HTMLCanvasElement {
    const cursorCanvas = document.createElement('canvas');
    cursorCanvas.width = stamp.width;
    cursorCanvas.height = stamp.height;
    const ctx = cursorCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return cursorCanvas;

    const sCtx = stamp.canvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) return cursorCanvas;

    // If SHP brush is active in normal mode, show semi-transparent shadow + sprite preview
    if (settings?.isShpBrush && settings.mode === 'normal') {
        if (shadowStamp && (settings.shpShadowEnabled ?? true)) {
            const sOffX = settings.shpShadowOffsetX ?? 0;
            const sOffY = settings.shpShadowOffsetY ?? 0;
            ctx.save();
            ctx.globalAlpha = Math.max(0.2, Math.min(0.85, (settings.shpShadowDarkness ?? 55) / 100));
            ctx.drawImage(shadowStamp.canvas, sOffX, sOffY);
            ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.drawImage(stamp.canvas, 0, 0);
        ctx.restore();

        // Subtle cyan center crosshair dot
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(stamp.centerX - 1, stamp.centerY - 1, 3, 3);
        return cursorCanvas;
    }

    const sData = sCtx.getImageData(0, 0, stamp.width, stamp.height);
    const dData = ctx.createImageData(stamp.width, stamp.height);
    const src = sData.data;
    const dst = dData.data;

    for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        if (a === 0) continue;

        // Luminance of brush pixel
        const lum = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
        const finalAlpha = Math.round((a / 255) * Math.max(0.2, lum) * 200);

        dst[i] = 255;     // Pure white
        dst[i + 1] = 255; // Pure white
        dst[i + 2] = 255; // Pure white
        dst[i + 3] = finalAlpha;
    }

    ctx.putImageData(dData, 0, 0);

    // Draw subtle cyan center crosshair dot
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(stamp.centerX - 1, stamp.centerY - 1, 3, 3);

    return cursorCanvas;
}

/**
 * Applies a hand brush stamp at (clickX, clickY) in canvas coordinates.
 * Works on all tiles by default (`onlySelectedTiles === false`), or only on selected tiles when `onlySelectedTiles === true`.
 * Also applies SHP shadow darkening (palette index #1) when an SHP brush has a shadow frame.
 */
export async function applyHandBrushToTiles(
    images: CanvasImage[],
    selectedImageIds: Set<string>,
    clickX: number,
    clickY: number,
    settings: HandBrushSettings,
    brushImg: HTMLImageElement | HTMLCanvasElement,
    config: { width: number; height: number },
    overrideRotation?: number,
    shadowBrushImg?: HTMLImageElement | HTMLCanvasElement | null
): Promise<{ updatedImages: CanvasImage[]; affectedTileIds: string[] }> {
    const onlySelected = !!settings.onlySelectedTiles;
    if (onlySelected && selectedImageIds.size === 0) {
        return { updatedImages: images, affectedTileIds: [] };
    }

    const stamp = renderHandBrushStamp(brushImg, settings, config, overrideRotation);
    const hasShpShadow =
        !!settings.isShpBrush &&
        (settings.shpShadowEnabled ?? true) &&
        !!shadowBrushImg;

    const shadowStamp = hasShpShadow && shadowBrushImg
        ? renderHandBrushStamp(shadowBrushImg, { ...settings, invert: false }, config, overrideRotation, true)
        : null;

    const shadowOffX = settings.shpShadowOffsetX ?? 0;
    const shadowOffY = settings.shpShadowOffsetY ?? 0;

    const stampLeft = clickX - stamp.centerX;
    const stampTop = clickY - stamp.centerY;
    const stampRight = stampLeft + stamp.width;
    const stampBottom = stampTop + stamp.height;

    // Expand AABB to include shadow offset if present
    const envLeft = Math.min(stampLeft, stampLeft + shadowOffX);
    const envTop = Math.min(stampTop, stampTop + shadowOffY);
    const envRight = Math.max(stampRight, stampRight + shadowOffX);
    const envBottom = Math.max(stampBottom, stampBottom + shadowOffY);

    const strengthFactor = Math.min(2, Math.max(0.01, (settings.strength ?? 100) / 100));
    const sCtx = stamp.canvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) return { updatedImages: images, affectedTileIds: [] };

    const { applyShpShadowToTileImageData } = await import('./shpBrushHelper');

    const affectedTileIds: string[] = [];
    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
        const tile = updatedImages[i];
        if (onlySelected && !selectedImageIds.has(tile.id)) continue;

        const drawPos = getImageDrawPos(tile, config.width, config.height);
        const tileLeft = Math.floor(drawPos.x) + tile.offsetX;
        const tileTop = Math.floor(drawPos.y) + tile.offsetY;
        const tileRight = tileLeft + tile.width;
        const tileBottom = tileTop + tile.height;

        // Check AABB bounding box collision between brush stamp (+ shadow) and tile
        if (envRight <= tileLeft || envLeft >= tileRight || envBottom <= tileTop || envTop >= tileBottom) {
            continue;
        }

        affectedTileIds.push(tile.id);

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = tile.width;
        tileCanvas.height = tile.height;
        const tCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
        if (!tCtx) continue;

        const curTileImg = await loadImage(tile.src);
        if (!curTileImg) continue;

        tCtx.imageSmoothingEnabled = false;
        tCtx.drawImage(curTileImg, 0, 0);

        const offsetX = stampLeft - tileLeft;
        const offsetY = stampTop - tileTop;

        // 1. If SHP Shadow is enabled, darken the underlying tile where the shadow frame lands
        // before stamping the sprite on top (so the shadow darkens the ground, not the sprite itself!)
        if (shadowStamp) {
            const tileImgData = tCtx.getImageData(0, 0, tile.width, tile.height);
            applyShpShadowToTileImageData(
                tileImgData,
                shadowStamp,
                offsetX + shadowOffX,
                offsetY + shadowOffY,
                settings
            );
            tCtx.putImageData(tileImgData, 0, 0);
        }

        if (settings.mode === 'normal') {
            // Normal mode: Stamp brush image / SHP sprite onto tile (only over existing opaque tile silhouette)
            const existingTileData = tCtx.getImageData(0, 0, tile.width, tile.height);
            const maskAlpha = new Uint8Array(tile.width * tile.height);
            for (let p = 0; p < maskAlpha.length; p++) {
                maskAlpha[p] = existingTileData.data[p * 4 + 3];
            }

            tCtx.save();
            tCtx.globalAlpha = Math.min(1, strengthFactor);
            tCtx.drawImage(stamp.canvas, offsetX, offsetY);
            tCtx.restore();

            // Preserve the tile's transparent exterior so stamps don't bleed outside the tile silhouette
            const afterData = tCtx.getImageData(0, 0, tile.width, tile.height);
            for (let p = 0; p < maskAlpha.length; p++) {
                if (maskAlpha[p] === 0) {
                    const idx4 = p * 4;
                    afterData.data[idx4] = 0;
                    afterData.data[idx4 + 1] = 0;
                    afterData.data[idx4 + 2] = 0;
                    afterData.data[idx4 + 3] = 0;
                }
            }
            tCtx.putImageData(afterData, 0, 0);
        } else if (settings.mode === 'coloring') {
            // Coloring mode: Adjust hue, contrast, brightness, saturation using brush luminance as weight
            const tileImgData = tCtx.getImageData(0, 0, tile.width, tile.height);
            const maskCropCanvas = document.createElement('canvas');
            maskCropCanvas.width = tile.width;
            maskCropCanvas.height = tile.height;
            const mcCtx = maskCropCanvas.getContext('2d', { willReadFrequently: true });
            if (mcCtx) {
                mcCtx.drawImage(stamp.canvas, offsetX, offsetY);
                const maskCropData = mcCtx.getImageData(0, 0, tile.width, tile.height);
                applyColoringToImageData(
                    tileImgData.data,
                    maskCropData.data,
                    strengthFactor,
                    settings.hue ?? 0,
                    settings.contrast ?? 100,
                    settings.brightness ?? 100,
                    settings.saturation ?? 100
                );
                tCtx.putImageData(tileImgData, 0, 0);
            }
        } else if (settings.mode === 'transparency') {
            // Transparency mode: Carve alpha transparency into tile
            const tileImgData = tCtx.getImageData(0, 0, tile.width, tile.height);
            const maskCropCanvas = document.createElement('canvas');
            maskCropCanvas.width = tile.width;
            maskCropCanvas.height = tile.height;
            const mcCtx = maskCropCanvas.getContext('2d', { willReadFrequently: true });
            if (mcCtx) {
                mcCtx.drawImage(stamp.canvas, offsetX, offsetY);
                const maskCropData = mcCtx.getImageData(0, 0, tile.width, tile.height);
                const tData = tileImgData.data;
                const mData = maskCropData.data;

                for (let px = 0; px < tData.length; px += 4) {
                    const mA = mData[px + 3];
                    if (mA === 0) continue;

                    const curAlpha = tData[px + 3];
                    if (curAlpha === 0) continue;

                    // Luminance of brush pixel
                    const lum = (mData[px] * 0.299 + mData[px + 1] * 0.587 + mData[px + 2] * 0.114) / 255;
                    const carveWeight = Math.min(1, Math.max(0, lum * (mA / 255) * strengthFactor));

                    // Standard RGBA transparency (without replacing with key index #0)
                    tData[px + 3] = Math.max(0, Math.round(curAlpha * (1 - carveWeight)));
                }
                tCtx.putImageData(tileImgData, 0, 0);
            }
        }

        const newSrc = tileCanvas.toDataURL('image/png');
        updatedImages[i] = {
            ...tile,
            src: newSrc,
            originalSrc: newSrc
        };
    }

    return { updatedImages, affectedTileIds };
}

