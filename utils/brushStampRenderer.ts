import type { TiledBrushShuffleMode, BrushResizeSampling } from '../types';
import {
    createResampledBrushCanvas,
    configureCanvasContextForSampling,
} from './brushResizeSampling';

function applyBrushShuffle(
    ctx: CanvasRenderingContext2D,
    shuffleMode: TiledBrushShuffleMode,
    row: number,
    col: number,
    seedVal: number
) {
    if (shuffleMode === 'chaos') {
        const seed = Math.abs(Math.floor(seedVal * 100000));
        const rotStep = Math.floor(seed % 4); // 0, 90, 180, 270
        ctx.rotate((rotStep * 90 * Math.PI) / 180);
        const flipH = (seed % 7) > 3 ? -1 : 1;
        const flipV = (seed % 11) > 5 ? -1 : 1;
        ctx.scale(flipH, flipV);
    } else if (shuffleMode === 'mirror_h') {
        if (col % 2 === 1) ctx.scale(-1, 1);
    } else if (shuffleMode === 'mirror_v') {
        if (row % 2 === 1) ctx.scale(1, -1);
    } else if (shuffleMode === 'mirror_both') {
        if (col % 2 === 1) ctx.scale(-1, 1);
        if (row % 2 === 1) ctx.scale(1, -1);
    }
}

/**
 * Draws a single tiled brush stamp adhering to the isometric tile geometry,
 * Canvas Zoom (internal cropping / border cut identical to tiled layer canvasZoom),
 * custom brush rotation, and resize sampling method.
 */
export function drawIsometricBrushStamp(
    ctx: CanvasRenderingContext2D,
    brushImg: HTMLImageElement | HTMLCanvasElement,
    tileType: string | undefined,
    baseSqSize: number,
    footprint: number,
    pixelScale: number,
    shuffleMode: TiledBrushShuffleMode,
    row: number,
    col: number,
    seed: number,
    brushCanvasZoom: number = 100,
    brushRotation: number = 0,
    brushMainScale: number = 100,
    baseSqHeight?: number,
    untransformed: boolean = false,
    resizeSampling: BrushResizeSampling = 'bicubic'
) {
    const pad = 1.01;
    const borderCut = Math.max(0.01, brushCanvasZoom / 100);
    const individualZoom = Math.max(0.01, (brushMainScale ?? 100) / 100);

    // Calculate source rectangle for "Internal Crop" zoom behavior (identical to textureInjection.ts)
    const sWidth = borderCut >= 1 ? brushImg.width / borderCut : brushImg.width;
    const sHeight = borderCut >= 1 ? brushImg.height / borderCut : brushImg.height;
    const sx = borderCut >= 1 ? (brushImg.width - sWidth) / 2 : 0;
    const sy = borderCut >= 1 ? (brushImg.height - sHeight) / 2 : 0;
    const h = baseSqHeight ?? baseSqSize;
    const drawW = borderCut < 1 ? baseSqSize * borderCut : baseSqSize;
    const drawH = borderCut < 1 ? h * borderCut : h;

    configureCanvasContextForSampling(ctx, resizeSampling);

    const finalScaledW = Math.max(1, drawW * individualZoom);
    const finalScaledH = Math.max(1, drawH * individualZoom);
    const resampled = createResampledBrushCanvas(
        brushImg,
        sx,
        sy,
        sWidth,
        sHeight,
        finalScaledW,
        finalScaledH,
        resizeSampling
    );

    if (untransformed) {
        if (brushRotation !== 0) ctx.rotate((brushRotation * Math.PI) / 180);
        applyBrushShuffle(ctx, shuffleMode, row, col, seed);
        ctx.drawImage(
            resampled,
            0,
            0,
            resampled.width,
            resampled.height,
            -finalScaledW / 2,
            -finalScaledH / 2,
            finalScaledW,
            finalScaledH
        );
        return;
    }

    if (tileType === 'slope_se') {
        ctx.translate(4.32 * footprint * pixelScale, -8.50 * footprint * pixelScale);
        ctx.scale(1.01, 1.00);
        ctx.rotate(45 * Math.PI / 180);
        ctx.scale(1.0166, 0.7436);
        const skewX = -13.6 * Math.PI / 180;
        ctx.transform(1, 0, Math.tan(skewX), 1, 0, 0);
        if (brushRotation !== 0) ctx.rotate((brushRotation * Math.PI) / 180);
        applyBrushShuffle(ctx, shuffleMode, row, col, seed);
        ctx.drawImage(
            resampled,
            0,
            0,
            resampled.width,
            resampled.height,
            -finalScaledW / 2,
            -finalScaledH / 2,
            finalScaledW,
            finalScaledH
        );
    } else if (tileType === 'slope_sw') {
        ctx.translate(5.21 * footprint * pixelScale, -11.29 * footprint * pixelScale);
        ctx.scale(1.01, 1.00);
        ctx.rotate(45 * Math.PI / 180);
        ctx.scale(0.858, 1.157);
        const skewX = 0.2 * Math.PI / 180;
        const skewY = -13.2 * Math.PI / 180;
        ctx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0);
        if (brushRotation !== 0) ctx.rotate((brushRotation * Math.PI) / 180);
        applyBrushShuffle(ctx, shuffleMode, row, col, seed);
        ctx.drawImage(
            resampled,
            0,
            0,
            resampled.width,
            resampled.height,
            -finalScaledW / 2,
            -finalScaledH / 2,
            finalScaledW,
            finalScaledH
        );
    } else {
        // Flat isometric tile (2:1 diamond)
        ctx.scale(pad, pad / 2);
        ctx.rotate(45 * Math.PI / 180);
        if (brushRotation !== 0) ctx.rotate((brushRotation * Math.PI) / 180);
        applyBrushShuffle(ctx, shuffleMode, row, col, seed);
        ctx.drawImage(
            resampled,
            0,
            0,
            resampled.width,
            resampled.height,
            -finalScaledW / 2,
            -finalScaledH / 2,
            finalScaledW,
            finalScaledH
        );
    }
}
