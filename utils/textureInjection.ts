
import type { CanvasImage, ProjectOverlay, RgbaColor, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { isoToScreen, getImageDrawPos } from './geoUtils';
import { colorDistance } from './colorUtils';
import { applyPixelNoise, applyPixelFilters, applyContourInjection } from './imageEffects';
import { applyAdvancedEffects } from './filterEngine';
import { getHighQualityDownscaledSource } from './downsampleHelper';
import { matchMaskGroupWithFeather } from './textureMaskHelper';
import { getFullOverlaySurface, getOverlayTileCrop, clearSurfaceCache } from './overlaySurfaceRenderer';
import { applyTiledBrushes } from './tiledBrushRenderer';
import { calculateDepthInjectedPixel } from './depthInjectionHelper';
import { applyKeyColorToCanvas } from './transparencyKeyHelper';
import { getCachedCrispTexture, clearCrispCache } from './crispResampler';
import { isLinkedGroupId, renderLinkedGroupComposite } from './layerLinkUtils';
import { isThreeDTargetId, renderThreeDObjectCrop, clearThreeDSurfaceCache } from './threeDInjectionUtils';
import { isAllLayersTargetId, renderAllLayersCompositeCrop, clearAllLayersCompositeCache } from './allLayersInjectionHelper';
import { isSceneGroupId, renderSceneGroupCompositeCrop } from './sceneGroupUtils';
import { computeGroupElevationOverhangWeights } from './threeDHeightTransitionHelper';
import { applyTileShuffleTransform } from './tileShuffleHelper';

const imageCache = new Map<string, HTMLImageElement>();
export const clearImageCache = () => {
    imageCache.clear();
    clearSurfaceCache();
    clearCrispCache();
    clearThreeDSurfaceCache();
    clearAllLayersCompositeCache();
};

/**
 * Loads an image and returns a promise, with caching.
 */
export const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!);
    return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        if (src && !src.startsWith('data:')) {
            img.crossOrigin = "Anonymous";
        }
        img.onload = () => {
            imageCache.set(src, img);
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
};

const getCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};
const releaseCanvas = (c: HTMLCanvasElement) => {
    c.width = 0;
    c.height = 0;
};

/**
 * Renders a single overlay onto a target canvas context.
 */
export const renderOverlayToCanvas = (
    lCtx: CanvasRenderingContext2D,
    ov: ProjectOverlay,
    ovImg: HTMLImageElement,
    imageDrawX: number,
    imageDrawY: number,
    config: { width: number, height: number },
    targetWidth: number,
    targetHeight: number,
    pixelScaleOverride?: number,
    additionalImagesMap?: Map<string, HTMLImageElement | HTMLCanvasElement>
) => {
    const f = ov.filters;
    
    // Calculate the scale factor between logical grid and physical tile pixels
    // If targetWidth is 128 and config.width is 48, scale is 2.66
    const pixelScale = pixelScaleOverride ?? (targetWidth / config.width);
    
    // For smart overlays, position and size coordinates are already mapped to physical template pixels,
    // so we do not scale them by pixelScale (which is logical-to-physical ratio)
    const relScale = ov.type === 'smart' ? 1 : pixelScale;
    
    // Relative position of the overlay origin in canvas pixels
    const relX = (ov.x - imageDrawX) * relScale;
    const relY = (ov.y - imageDrawY) * relScale;
    
    const footprint = (f.staticScale ?? 100) / 100;
    // For RA2 tiling images: 100% scale matches what 101% was (compensating 42.426 vs 42 rounded down)
    const isRa2Tiled = config.width === 60 && ov.type === 'tiled';
    const ra2ScaleFix = isRa2Tiled ? 1.01015 : 1;
    const individualZoom = ((f.mainScale ?? 100) / 100) * ra2ScaleFix;
    const borderCut = Math.max(0.01, (f.canvasZoom ?? 100) / 100);
    const tileW = config.width * footprint * pixelScale, tileH = config.height * footprint * pixelScale;
    const sqSize = isRa2Tiled ? (tileW / Math.sqrt(2)) : Math.round(tileW / Math.sqrt(2));
    
    // We need a temporary canvas to apply filters to the combined result, matching CSS behavior
    const tempCanvas = getCanvas(targetWidth, targetHeight);
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
    tempCtx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp';
    if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
        tempCtx.imageSmoothingQuality = 'high';
    }

    if (ov.type === 'smart') {
        const drawW = ov.width * footprint * relScale * individualZoom;
        const drawH = ov.height * footprint * relScale * individualZoom;
        tempCtx.save();
        tempCtx.translate(relX + drawW / 2, relY + drawH / 2);
        tempCtx.rotate(f.rotation * Math.PI / 180);
        if (f.flipH) tempCtx.scale(-1, 1);
        if (f.flipV) tempCtx.scale(1, -1);
        
        let smartImg: HTMLImageElement | HTMLCanvasElement = ovImg;
        if (f.renderMode === 'crisp' && (ovImg.width > drawW * 1.15 || ovImg.height > drawH * 1.15)) {
            smartImg = getCachedCrispTexture(ovImg, ov.src || 'smart', drawW, drawH);
        } else if (f.renderMode === 'smooth' && (ovImg.width > drawW * 1.15 || ovImg.height > drawH * 1.15)) {
            (ovImg as any)._cacheId = ov.src || 'smart';
            smartImg = getHighQualityDownscaledSource(ovImg, drawW, drawH);
        }

        if (borderCut >= 1) {
            const sWidth = smartImg.width / borderCut;
            const sHeight = smartImg.height / borderCut;
            const sx = (smartImg.width - sWidth) / 2;
            const sy = (smartImg.height - sHeight) / 2;
            tempCtx.drawImage(smartImg, sx, sy, sWidth, sHeight, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
            const dW = drawW * borderCut;
            const dH = drawH * borderCut;
            tempCtx.drawImage(smartImg, 0, 0, smartImg.width, smartImg.height, -dW / 2, -dH / 2, dW, dH);
        }
        tempCtx.restore();
    } else {
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        const getRandomZoom = (row: number, col: number) => {
            if (!f.zoomRandomness || f.zoomRandomness === 0) return 1;
            const seed = (row * ov.repeatX + col) * 98765 + (f.scramblePositions || 0);
            const rand = seededRandom(seed);
            const spread = f.zoomRandomness / 100;
            return 1 + (rand - 0.5) * spread;
        };

        const baseTileSource = ovImg;

        // Optimization: Calculate visible range of rows and columns with safety margin
        const marginX = Math.max(tileW * 3, 200);
        const marginY = Math.max(tileH * 4, 200);
        const minU = (-relX - marginX) / (tileW / 2);
        const maxU = (targetWidth - relX + marginX) / (tileW / 2);
        const minV = (-relY - marginY) / (tileH / 2);
        const maxV = (targetHeight - relY + marginY) / (tileH / 2);

        for (let row = 0; row < ov.repeatY; row++) {
            if (ov.repeatX - 1 + row < minV) continue;
            if (0 + row > maxV) continue;

            for (let col = 0; col < ov.repeatX; col++) {
                const u = col - row;
                const v = col + row;
                
                if (u < minU || u > maxU || v < minV || v > maxV) continue;

                let tx, ty;
                if (f.tileType === 'slope_se') {
                    tx = relX + (col - row) * (tileW / 2);
                    ty = relY + (col + row / 2) * (tileH);
                } else if (f.tileType === 'slope_sw') {
                    tx = relX + (col - row) * (tileW / 2);
                    ty = relY + (col / 2 + row) * (tileH);
                } else {
                    tx = relX + u * (tileW / 2);
                    ty = relY + v * (tileH / 2);
                }

                // Generous cutoff for rendering bounds
                if (tx + tileW < -300 || tx - tileW > targetWidth + 300 || ty + tileH * 2 < -300 || ty - tileH * 2 > targetHeight + 300) continue;

                const rZoom = getRandomZoom(row, col);
                let currentBorderCut = borderCut;

                // Multi-image shuffling
                let currentImg: HTMLImageElement | HTMLCanvasElement = baseTileSource;
                let currentSrcKey: string = ov.src || 'main';
                let currentIndividualZoom = individualZoom;

                if (f.additionalTextures && f.additionalTextures.length > 0) {
                    const seed = (row * 1337 + col * 7331 + (f.scramblePositions || 0)) % 1000000;
                    const totalWeight = 100 + f.additionalTextures.reduce((sum, t) => sum + t.weight, 0);
                    let rand = seededRandom(seed * 54321) * 100; // 0 to 100
                    
                    if (rand > 100 * (100 / totalWeight)) {
                        let cumulative = 100 * (100 / totalWeight);
                        for (let addIdx = 0; addIdx < f.additionalTextures.length; addIdx++) {
                            const add = f.additionalTextures[addIdx];
                            cumulative += 100 * (add.weight / totalWeight);
                            if (rand <= cumulative) {
                                const mapped = additionalImagesMap?.get(add.src);
                                if (mapped) {
                                    currentImg = mapped;
                                } else {
                                    const cached = imageCache.get(add.src);
                                    if (cached) {
                                        currentImg = cached;
                                    }
                                }
                                const af = add.filters;
                                const filterSig = af ? `_h${af.hue ?? 0}_s${af.saturation ?? 100}_b${af.brightness ?? 100}_c${af.contrast ?? 100}` : '';
                                currentSrcKey = `add_${addIdx}_${add.src.length}_${add.src.slice(-32)}${filterSig}`;
                                (currentImg as any)._cacheId = currentSrcKey;

                                if (af?.mainScale != null && !isNaN(af.mainScale) && af.mainScale > 0) {
                                    currentIndividualZoom = (af.mainScale / 100) * ra2ScaleFix;
                                }
                                currentBorderCut = Math.max(0.01, (add.canvasZoom != null && !isNaN(add.canvasZoom) && add.canvasZoom > 0 ? add.canvasZoom : (f.canvasZoom ?? 100)) / 100);
                                break;
                            }
                        }
                    }
                }
                const finalBorderCut = currentBorderCut * rZoom;

                tempCtx.save();
                tempCtx.translate(tx, ty);
                tempCtx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp';
                if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
                    tempCtx.imageSmoothingQuality = 'high';
                }

                const drawSqSize = finalBorderCut < 1 ? sqSize * finalBorderCut : sqSize;
                const effectiveDrawSize = Math.max(1, drawSqSize * currentIndividualZoom);

                let tileSource: HTMLImageElement | HTMLCanvasElement = currentImg;
                if (f.renderMode === 'crisp' && (tileSource.width > effectiveDrawSize * 1.15 || tileSource.height > effectiveDrawSize * 1.15)) {
                    tileSource = getCachedCrispTexture(tileSource, currentSrcKey, effectiveDrawSize, effectiveDrawSize);
                } else if (f.renderMode === 'smooth' && (tileSource.width > effectiveDrawSize * 1.15 || tileSource.height > effectiveDrawSize * 1.15)) {
                    (tileSource as any)._cacheId = currentSrcKey;
                    tileSource = getHighQualityDownscaledSource(tileSource, effectiveDrawSize, effectiveDrawSize);
                }

                // Calculate source rectangle for "Internal Crop" zoom behavior
                const sWidth = finalBorderCut >= 1 ? tileSource.width / finalBorderCut : tileSource.width;
                const sHeight = finalBorderCut >= 1 ? tileSource.height / finalBorderCut : tileSource.height;
                const sx = finalBorderCut >= 1 ? (tileSource.width - sWidth) / 2 : 0;
                const sy = finalBorderCut >= 1 ? (tileSource.height - sHeight) / 2 : 0;

                if (f.tileType === 'flat') {
                    // Use exact 2:1 ratio for isometric unless padding is requested
                    const pad = 1.01; // Minimal padding to prevent gaps
                    tempCtx.scale(pad * currentIndividualZoom, (pad / 2) * currentIndividualZoom);
                    tempCtx.rotate(45 * Math.PI / 180);
                    tempCtx.rotate(f.rotation * Math.PI / 180);
                    applyBakeShuffle(tempCtx, f, row, col, ov.repeatX);
                    if (f.flipH) tempCtx.scale(-1, 1); if (f.flipV) tempCtx.scale(1, -1);
                    tempCtx.drawImage(tileSource, sx, sy, sWidth, sHeight, -drawSqSize / 2, -drawSqSize / 2, drawSqSize, drawSqSize);
                } else if (f.tileType === 'slope_se') {
                    tempCtx.translate(4.32 * footprint * pixelScale, -8.50 * footprint * pixelScale);
                    tempCtx.scale(1.01, 1.00); // Refined scaling
                    tempCtx.rotate(45 * Math.PI / 180);
                    tempCtx.scale(1.0166 * currentIndividualZoom, 0.7436 * currentIndividualZoom);
                    const skewX = -13.6 * Math.PI / 180;
                    tempCtx.transform(1, 0, Math.tan(skewX), 1, 0, 0);
                    tempCtx.rotate(f.rotation * Math.PI / 180);
                    applyBakeShuffle(tempCtx, f, row, col, ov.repeatX);
                    if (f.flipH) tempCtx.scale(-1, 1); if (f.flipV) tempCtx.scale(1, -1);
                    tempCtx.drawImage(tileSource, sx, sy, sWidth, sHeight, -drawSqSize / 2, -drawSqSize / 2, drawSqSize, drawSqSize);
                } else if (f.tileType === 'slope_sw') {
                    tempCtx.translate(5.21 * footprint * pixelScale, -11.29 * footprint * pixelScale);
                    tempCtx.scale(1.01, 1.00); // Refined scaling
                    tempCtx.rotate(45 * Math.PI / 180);
                    tempCtx.scale(0.858 * currentIndividualZoom, 1.157 * currentIndividualZoom);
                    const skewX = 0.2 * Math.PI / 180;
                    const skewY = -13.2 * Math.PI / 180;
                    tempCtx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0);
                    tempCtx.rotate(f.rotation * Math.PI / 180);
                    applyBakeShuffle(tempCtx, f, row, col, ov.repeatX);
                    if (f.flipH) tempCtx.scale(-1, 1); if (f.flipV) tempCtx.scale(1, -1);
                    tempCtx.drawImage(tileSource, sx, sy, sWidth, sHeight, -drawSqSize / 2, -drawSqSize / 2, drawSqSize, drawSqSize);
                }
                tempCtx.restore();
            }
        }
    }

    // Apply filters to the temporary canvas (matching CSS behavior)
    lCtx.save();
    lCtx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp';
    if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
        lCtx.imageSmoothingQuality = 'high';
    }
    const hasFilter = f.blur > 0 || f.brightness !== 100 || f.contrast !== 100 || f.saturation !== 100 || f.hue !== 0;
    if (hasFilter) {
        lCtx.filter = `blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg)`;
    } else {
        lCtx.filter = 'none';
    }
    lCtx.drawImage(tempCanvas, 0, 0);
    lCtx.restore();
    lCtx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp';
    if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
        lCtx.imageSmoothingQuality = 'high';
    }
    
    // Apply sharpening, edge-preserving smoothing, and noise to the final output
    applyAdvancedEffects(lCtx, targetWidth, targetHeight, f);
    applyPixelNoise(lCtx, targetWidth, targetHeight, f);
    
    // Apply pixel-level filters: normal color swaps and smart color swaps
    applyPixelFilters(lCtx.canvas, ov.filters);
    
    releaseCanvas(tempCanvas);
};

/**
 * Renders a single overlay fully, including additional textures and filters.
 */
export const renderOverlayFully = async (
    ov: ProjectOverlay,
    imageDrawX: number,
    imageDrawY: number,
    config: { width: number, height: number },
    targetWidth: number,
    targetHeight: number,
    allOverlays: ProjectOverlay[] = [],
    pixelScaleOverride?: number
): Promise<HTMLCanvasElement | null> => {
    if (!ov.isVisible) return null;
    if (isAllLayersTargetId(ov.id) || isAllLayersTargetId(ov.src)) {
        return renderAllLayersCompositeCrop(
            allOverlays,
            'ts_full',
            imageDrawX,
            imageDrawY,
            targetWidth,
            targetHeight
        );
    }
    if (isSceneGroupId(ov.id) || isSceneGroupId(ov.src)) {
        const sgId = isSceneGroupId(ov.id) ? ov.id : ov.src!;
        return renderSceneGroupCompositeCrop(
            sgId,
            allOverlays,
            'ts_full',
            imageDrawX,
            imageDrawY,
            targetWidth,
            targetHeight
        );
    }
    if (isThreeDTargetId(ov.id) || isThreeDTargetId(ov.src)) {
        const target3dId = isThreeDTargetId(ov.id) ? ov.id : ov.src!;
        return renderThreeDObjectCrop(
            target3dId,
            imageDrawX,
            imageDrawY,
            targetWidth,
            targetHeight
        );
    }
    const canvas = getCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    ctx.imageSmoothingEnabled = ov.filters.renderMode === 'smooth' || ov.filters.renderMode === 'crisp';
    if (ov.filters.renderMode === 'smooth' || ov.filters.renderMode === 'crisp') {
        ctx.imageSmoothingQuality = 'high';
    }

    try {
        const f = ov.filters;
        // Pre-load all textures
        const sources = [ov.src, ...(f.additionalTextures?.map(t => t.src) || [])].filter(Boolean) as string[];
        if (f.transitionOverlayId) {
            const transOv = allOverlays.find(o => o.id === f.transitionOverlayId);
            if (transOv?.src) sources.push(transOv.src);
        }
        await Promise.all(sources.map(src => loadImage(src)));

        // Pre-filter additional textures if they have individual filters
        const addImagesMap = new Map<string, HTMLCanvasElement | HTMLImageElement>();
        if (f.additionalTextures) {
            for (let addIdx = 0; addIdx < f.additionalTextures.length; addIdx++) {
                const add = f.additionalTextures[addIdx];
                const img = imageCache.get(add.src);
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

        const mainImg = imageCache.get(ov.src || '');
        if (mainImg) {
            renderOverlayToCanvas(ctx, ov, mainImg, imageDrawX, imageDrawY, config, targetWidth, targetHeight, pixelScaleOverride, addImagesMap);
        }

        // 4. Contour Injection (Transition)
        if (f.transitionOverlayId && f.transitionGroupAId && f.transitionGroupBId) {
            if (isAllLayersTargetId(f.transitionOverlayId)) {
                const allCompCrop = await renderAllLayersCompositeCrop(
                    allOverlays,
                    'ts_full',
                    imageDrawX,
                    imageDrawY,
                    targetWidth,
                    targetHeight
                );
                if (allCompCrop && mainImg) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, allCompCrop, refPixels);
                }
            } else if (isSceneGroupId(f.transitionOverlayId)) {
                const sgCompCrop = await renderSceneGroupCompositeCrop(
                    f.transitionOverlayId,
                    allOverlays,
                    'ts_full',
                    imageDrawX,
                    imageDrawY,
                    targetWidth,
                    targetHeight
                );
                if (sgCompCrop && mainImg) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, sgCompCrop, refPixels);
                }
            } else if (isThreeDTargetId(f.transitionOverlayId)) {
                const threeDCrop = await renderThreeDObjectCrop(
                    f.transitionOverlayId,
                    imageDrawX,
                    imageDrawY,
                    targetWidth,
                    targetHeight
                );
                if (threeDCrop && mainImg) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, threeDCrop, refPixels);
                }
            } else if (isLinkedGroupId(f.transitionOverlayId)) {
                const comp = await renderLinkedGroupComposite(
                    f.transitionOverlayId,
                    allOverlays,
                    'ts_full',
                    imageDrawX,
                    imageDrawY,
                    targetWidth,
                    targetHeight
                );
                if (comp && mainImg) {
                    const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                    applyContourInjection(ctx, f, comp.canvas, refPixels);
                }
            } else {
                const transOv = allOverlays.find(o => o.id === f.transitionOverlayId);
                if (transOv) {
                    const transImg = imageCache.get(transOv.src || '');
                    if (transImg && mainImg) {
                        // Use the current context pixels as reference for the transition
                        const refPixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                        applyContourInjection(ctx, f, transImg, refPixels);
                    }
                }
            }
        }

        // 5. Tiled Brushes
        if (f.brushes && f.brushes.length > 0) {
            await applyTiledBrushes(ctx, ov, imageDrawX, imageDrawY, config, targetWidth, targetHeight, pixelScaleOverride || 1);
        }

        return canvas;
    } catch (e) {
        console.error("Render overlay fully failed", e);
        releaseCanvas(canvas);
        return null;
    }
};

/**
 * Bakes a set of overlays onto a single tile image with high performance.
 */
function boxBlur(data: Uint8ClampedArray, width: number, height: number, radius: number) {
    const result = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const idx = (ny * width + nx) * 4;
                        r += data[idx];
                        g += data[idx+1];
                        b += data[idx+2];
                        a += data[idx+3];
                        count++;
                    }
                }
            }
            const idx = (y * width + x) * 4;
            result[idx] = r / count;
            result[idx+1] = g / count;
            result[idx+2] = b / count;
            result[idx+3] = a / count;
        }
    }
    return result;
}

export const bakeOverlaysToTile = async (
    image: CanvasImage,
    localOverlays: ProjectOverlay[],
    gridType: GridType,
    localTransparencyColor: RgbaColor | null,
    localTolerance: number,
    allOverlays: ProjectOverlay[] = [],
    cache: Map<string, HTMLCanvasElement> = new Map(), // Optional cache for batch operations
    sceneSnapshot?: HTMLCanvasElement | null,
    sceneOffset?: { x: number, y: number }
): Promise<string> => {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const drawPos = getImageDrawPos(image, config.width, config.height);
    const imageDrawX = Math.round(drawPos.x) + image.offsetX;
    const imageDrawY = Math.round(drawPos.y) + image.offsetY;

    let canvas: HTMLCanvasElement | null = null;
    let refCanvas: HTMLCanvasElement | null = null;
    let tempCanvases: HTMLCanvasElement[] = [];

    const getCachedTileOverlayCanvas = async (ov: ProjectOverlay) => {
        if (isAllLayersTargetId(ov.id) || isAllLayersTargetId(ov.src)) {
            return renderAllLayersCompositeCrop(
                allOverlays,
                gridType,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
        }
        if (isSceneGroupId(ov.id) || isSceneGroupId(ov.src)) {
            const sgId = isSceneGroupId(ov.id) ? ov.id : ov.src!;
            return renderSceneGroupCompositeCrop(
                sgId,
                allOverlays,
                gridType,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
        }
        if (isThreeDTargetId(ov.id) || isThreeDTargetId(ov.src)) {
            const target3dId = isThreeDTargetId(ov.id) ? ov.id : ov.src!;
            return renderThreeDObjectCrop(
                target3dId,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
        }
        const surface = await getFullOverlaySurface(ov, gridType, allOverlays);
        if (!surface) return null;
        return getOverlayTileCrop(surface, imageDrawX, imageDrawY, image.width, image.height, ov.filters.renderMode);
    };

    const getCachedTileByLayerOrGroupId = async (targetId: string): Promise<HTMLCanvasElement | null> => {
        if (isAllLayersTargetId(targetId)) {
            return renderAllLayersCompositeCrop(
                allOverlays,
                gridType,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
        }
        if (isSceneGroupId(targetId)) {
            return renderSceneGroupCompositeCrop(
                targetId,
                allOverlays,
                gridType,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
        }
        if (isThreeDTargetId(targetId)) {
            return renderThreeDObjectCrop(
                targetId,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
        }
        if (isLinkedGroupId(targetId)) {
            const comp = await renderLinkedGroupComposite(
                targetId,
                allOverlays,
                gridType,
                imageDrawX,
                imageDrawY,
                image.width,
                image.height
            );
            return comp ? comp.canvas : null;
        }
        const foundOv = allOverlays.find(o => o.id === targetId);
        if (!foundOv) return null;
        return getCachedTileOverlayCanvas({ ...foundOv, isVisible: true });
    };

    try {
        // 1. Pre-load base images
        const currentVisualImg = await loadImage(image.src);
        if (!currentVisualImg) return image.src;

        const originalRefImg = (image.originalSrc ? await loadImage(image.originalSrc) : null) || currentVisualImg;

        // 2. Setup canvases
        canvas = getCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        
        // Draw starting point (Cumulative base) without subpixel blurring
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(currentVisualImg, 0, 0);

        // Get mask reference data from CURRENT visual source
        refCanvas = getCanvas(image.width, image.height);
        const refCtx = refCanvas.getContext('2d', { willReadFrequently: true })!;
        refCtx.imageSmoothingEnabled = false;
        refCtx.drawImage(currentVisualImg, 0, 0);

        // Apply transparency key for PNG tiles
        if (localTransparencyColor && !image.tmpBuffer) {
            applyKeyColorToCanvas(ctx, localTransparencyColor, localTolerance);
            applyKeyColorToCanvas(refCtx, localTransparencyColor, localTolerance);
        }

        const refPixels = refCtx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Prepare main pixel buffer
        const mainCtxData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const mainPixels = mainCtxData.data;

        // HIGH FIDELITY SCENE BAKING
        if (sceneSnapshot && sceneOffset) {
            const ssCtx = sceneSnapshot.getContext('2d', { willReadFrequently: true })!;
            const ssData = ssCtx.getImageData(imageDrawX + sceneOffset.x, imageDrawY + sceneOffset.y, image.width, image.height);
            const ssPixels = ssData.data;

            for (let i = 0; i < mainPixels.length; i += 4) {
                const r = refPixels[i], g = refPixels[i + 1], b = refPixels[i + 2];
                const color = { r, g, b };

                // 1. Strict transparency protection: Skip transparent pixels on isotiles or standard color-keyed tiles
                if (mainPixels[i + 3] === 0 || refPixels[i + 3] === 0) continue;

                // 2. We bake the 3D scene pixels directly onto the remaining solid tile body where model is drawn
                const sa = ssPixels[i + 3] / 255;
                if (sa > 0) {
                    mainPixels[i] = mainPixels[i] * (1 - sa) + ssPixels[i] * sa;
                    mainPixels[i + 1] = mainPixels[i + 1] * (1 - sa) + ssPixels[i + 1] * sa;
                    mainPixels[i + 2] = mainPixels[i + 2] * (1 - sa) + ssPixels[i + 2] * sa;
                    // Do not lower destination alpha; keep the underlying tile's original solid opacity
                }
            }
        } else {
            // 3. Process each overlay sequentially
            for (let idx = 0; idx < localOverlays.length; idx++) {
                const rawOv = localOverlays[idx];
                const ov = { ...rawOv, isVisible: true };

                const f = ov.filters;
                const globalAlpha = ov.opacity / 100;

                // 0. Pre-render main overlay texture directly sampled from full surface
                const mainOvCanvas = await getCachedTileOverlayCanvas(ov);
                const mainOvPixels = mainOvCanvas ? mainOvCanvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data : null;
                
                // 1. Pre-render all group textures
                const groupPixelsList: (Uint8ClampedArray | null)[] = [];
                for (let i = 0; i < f.maskGroups.length; i++) {
                    const gOvId = f.maskOverlayIds[i];
                    if (gOvId) {
                        const gCanvas = await getCachedTileByLayerOrGroupId(gOvId);
                        if (gCanvas) {
                            groupPixelsList.push(gCanvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data);
                            continue;
                        }
                    }
                    groupPixelsList.push(mainOvPixels);
                }

                // 2. Pre-render transition texture
                let transitionSource: CanvasImageSource | null = null;
                if (f.transitionOverlayId) {
                    const tCanvas = await getCachedTileByLayerOrGroupId(f.transitionOverlayId);
                    if (tCanvas) transitionSource = tCanvas;
                }

                // 2.5 Pre-render depth texture
                let depthPixels: Uint8ClampedArray | null = null;
                if (f.depthSettings?.enabled) {
                    if (f.depthSettings.depthOverlayId === 'base') {
                        const dCanvas = getCanvas(image.width, image.height);
                        const dCtx = dCanvas.getContext('2d', { willReadFrequently: true })!;
                        dCtx.drawImage(originalRefImg, 0, 0);
                        depthPixels = dCtx.getImageData(0, 0, canvas.width, canvas.height).data;
                        releaseCanvas(dCanvas);
                    } else if (f.depthSettings.depthOverlayId) {
                        const dCanvas = await getCachedTileByLayerOrGroupId(f.depthSettings.depthOverlayId);
                        if (dCanvas) {
                            depthPixels = dCanvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
                        }
                    }

                    // Apply Smart Smoothing (Blur) to depth if enabled
                    if (depthPixels && f.depthSettings.smartSmoothing > 0) {
                        const radius = Math.max(1, Math.round(f.depthSettings.smartSmoothing / 20));
                        depthPixels = boxBlur(depthPixels, canvas.width, canvas.height, radius);
                    }

                    // Apply Edge Enhancement to depth
                    if (depthPixels && f.depthSettings.edgeEnhancement > 0) {
                        const enhance = f.depthSettings.edgeEnhancement / 100;
                        for (let i = 0; i < depthPixels.length; i += 4) {
                            const lum = (depthPixels[i] * 0.299 + depthPixels[i+1] * 0.587 + depthPixels[i+2] * 0.114);
                            const enhanced = ((lum - 128) * (1 + enhance)) + 128;
                            const clamped = Math.max(0, Math.min(255, enhanced));
                            depthPixels[i] = depthPixels[i+1] = depthPixels[i+2] = clamped;
                        }
                    }
                }

                // 3. Process pixels
                const groupsWithColors = f.maskGroups.map(g => ({
                    ...g,
                    tolVal: (g.tolerance / 100) * 442
                }));

                // 3.1 Pre-compute 3D Height Overhang maps for groups targeting a 3D object with Height > 0
                const isMainOverlay3D =
                    isThreeDTargetId(ov.id) ||
                    isThreeDTargetId(ov.src) ||
                    isAllLayersTargetId(ov.id) ||
                    isAllLayersTargetId(ov.src) ||
                    isSceneGroupId(ov.id) ||
                    isSceneGroupId(ov.src);
                const groupOverhangWeights: (Float32Array | null)[] = f.maskGroups.map((g, gIdx) => {
                    const gOvId = (f.maskOverlayIds || [])[gIdx];
                    const isGroup3D = gOvId
                        ? (isThreeDTargetId(gOvId) || isAllLayersTargetId(gOvId) || isSceneGroupId(gOvId))
                        : isMainOverlay3D;
                    const gPixels = groupPixelsList[gIdx] || mainOvPixels;
                    if (isGroup3D && (g.threeDElevation ?? 0) > 0 && gPixels) {
                        return computeGroupElevationOverhangWeights(
                            refPixels,
                            gPixels,
                            canvas!.width,
                            canvas!.height,
                            g
                        );
                    }
                    return null;
                });

                for (let i = 0; i < mainPixels.length; i += 4) {
                    const baseA = refPixels[i+3];
                    if (baseA === 0) continue;
                    
                    const baseR = refPixels[i], baseG = refPixels[i+1], baseB = refPixels[i+2];
                    const pIdx = i >> 2;

                    const matchResult = matchMaskGroupWithFeather(
                        baseR, baseG, baseB,
                        groupsWithColors,
                        f.globalMode,
                        ov.type === 'smart'
                    );
                    let matchedGroupIdx = matchResult.matchedGroupIdx;
                    let effectiveFeatherWeight = matchResult.featherWeight;

                    // Check if any 3D group's elevated height overhangs onto this pixel
                    // (Allows 3D displaced grass/terrain on a color group to naturally rise & spill over the border!)
                    let overhangGroupIdx = -1;
                    let maxOverhangWeight = 0;
                    for (let gIdx = 0; gIdx < groupOverhangWeights.length; gIdx++) {
                        const weights = groupOverhangWeights[gIdx];
                        if (weights) {
                            const w = weights[pIdx];
                            if (w > maxOverhangWeight) {
                                maxOverhangWeight = w;
                                overhangGroupIdx = gIdx;
                            }
                        }
                    }

                    if (overhangGroupIdx !== -1 && (matchedGroupIdx === -1 || matchedGroupIdx !== overhangGroupIdx)) {
                        // If pixel is outside the 3D group (e.g. on adjacent black border or neighboring group),
                        // or if the 3D overhang is stronger, let the elevated 3D texture spill over!
                        if (matchedGroupIdx === -1 || maxOverhangWeight > 0.01) {
                            // First apply normal underlying group if matched so the 3D overhang blends ON TOP of the neighboring color/group
                            if (matchedGroupIdx !== -1 && matchedGroupIdx !== overhangGroupIdx) {
                                const underPixels = groupPixelsList[matchedGroupIdx] || mainOvPixels;
                                if (underPixels) {
                                    let ur = underPixels[i], ug = underPixels[i + 1], ub = underPixels[i + 2];
                                    const underAlpha = (underPixels[i + 3] / 255) * globalAlpha * effectiveFeatherWeight;
                                    if (underAlpha > 0) {
                                        mainPixels[i] = mainPixels[i] * (1 - underAlpha) + ur * underAlpha;
                                        mainPixels[i + 1] = mainPixels[i + 1] * (1 - underAlpha) + ug * underAlpha;
                                        mainPixels[i + 2] = mainPixels[i + 2] * (1 - underAlpha) + ub * underAlpha;
                                    }
                                }
                            }
                            matchedGroupIdx = overhangGroupIdx;
                            effectiveFeatherWeight = maxOverhangWeight;
                        }
                    }

                    // Depth injection can apply even if no group matched, IF depth is enabled
                    const depthEnabled = depthPixels && f.depthSettings.enabled;
                    
                    if (matchedGroupIdx !== -1 || depthEnabled) {
                        // If we have a matched group, use its texture. Otherwise use main texture for depth-only injection
                        const srcPixels = (matchedGroupIdx !== -1 && groupPixelsList[matchedGroupIdx]) ? groupPixelsList[matchedGroupIdx] : mainOvPixels;
                        
                        if (srcPixels) {
                            let r = srcPixels[i], g = srcPixels[i+1], b = srcPixels[i+2];
                        
                            // Check if this group excludes depth
                            const isExcluded = matchedGroupIdx !== -1 && groupsWithColors[matchedGroupIdx]?.isExcludedFromDepth;

                            if (depthEnabled && !isExcluded) {
                                const injected = calculateDepthInjectedPixel({
                                    r,
                                    g,
                                    b,
                                    depthPixels: depthPixels!,
                                    pixelIndex: i,
                                    depthSettings: f.depthSettings,
                                    isMaskMatch: matchedGroupIdx !== -1,
                                    refR: refPixels[i],
                                    refG: refPixels[i + 1],
                                    refB: refPixels[i + 2]
                                });
                                r = injected.r;
                                g = injected.g;
                                b = injected.b;
                            }

                            const hasExplicitGroupTarget =
                                matchedGroupIdx !== -1 &&
                                Boolean((f.maskOverlayIds || [])[matchedGroupIdx]);
                            const isCompositeOr3DHost =
                                isAllLayersTargetId(ov.id) ||
                                isAllLayersTargetId(ov.src) ||
                                isSceneGroupId(ov.id) ||
                                isSceneGroupId(ov.src) ||
                                isThreeDTargetId(ov.id) ||
                                isThreeDTargetId(ov.src);
                            const effectiveGroupAlpha =
                                hasExplicitGroupTarget || isCompositeOr3DHost ? 1.0 : globalAlpha;

                            const overlayAlpha = (srcPixels[i + 3] / 255) * effectiveGroupAlpha * effectiveFeatherWeight;
                            if (overlayAlpha > 0) {
                                mainPixels[i] = mainPixels[i] * (1 - overlayAlpha) + r * overlayAlpha;
                                mainPixels[i + 1] = mainPixels[i + 1] * (1 - overlayAlpha) + g * overlayAlpha;
                                mainPixels[i + 2] = mainPixels[i + 2] * (1 - overlayAlpha) + b * overlayAlpha;
                            }
                        }
                    }
                }

            // 4. Contour Injection (Transition)
                ctx.putImageData(mainCtxData, 0, 0);
                if (f.transitionOverlayId && transitionSource) {
                    applyContourInjection(ctx, f, transitionSource, refPixels);
                }
                
                // 4.5 Global Injection Strength (Blend with original if needed)
                if (typeof f.injectionStrength === 'number' && f.injectionStrength < 100) {
                    const strength = f.injectionStrength / 100;
                    const finalData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const finalPixels = finalData.data;
                    
                    // Get original pixels
                    const origCanvas = getCanvas(image.width, image.height);
                    const origCtx = origCanvas.getContext('2d')!;
                    origCtx.drawImage(originalRefImg, 0, 0);
                    const origPixels = origCtx.getImageData(0, 0, canvas.width, canvas.height).data;
                    releaseCanvas(origCanvas);
                    
                    for (let i = 0; i < finalPixels.length; i += 4) {
                        if (finalPixels[i+3] === 0 && origPixels[i+3] === 0) continue;
                        finalPixels[i] = origPixels[i] * (1 - strength) + finalPixels[i] * strength;
                        finalPixels[i+1] = origPixels[i+1] * (1 - strength) + finalPixels[i+1] * strength;
                        finalPixels[i+2] = origPixels[i+2] * (1 - strength) + finalPixels[i+2] * strength;
                        finalPixels[i+3] = origPixels[i+3] * (1 - strength) + finalPixels[i+3] * strength;
                    }
                    ctx.putImageData(finalData, 0, 0);
                }

                const updatedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < mainPixels.length; i++) mainPixels[i] = updatedData.data[i];
            }
        }

        // Final transparency pass: ensure original background transparent pixels stay transparent
        if (refPixels) {
            for (let i = 0; i < mainPixels.length; i += 4) {
                if (refPixels[i + 3] === 0) {
                    mainPixels[i + 3] = 0;
                }
            }
        }

        ctx.putImageData(mainCtxData, 0, 0);
        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error("Bake failed for tile", image.id, err);
        return image.src;
    } finally {
        if (canvas) releaseCanvas(canvas);
        if (refCanvas) releaseCanvas(refCanvas);
        // We don't release cached canvases here, they are managed by the caller if batching
        if (!cache) tempCanvases.forEach(releaseCanvas); 
    }
};

const applyBakeShuffle = (ctx: CanvasRenderingContext2D, f: any, row: number, col: number, _repeatX: number) => {
    applyTileShuffleTransform(ctx, f, row, col);
};

