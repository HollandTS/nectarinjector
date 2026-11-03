import type { ProjectOverlay } from '../types';
import { loadImage } from './textureInjection';
import { applyColoringToImageData } from './brushColoringHelper';
import { dilateMask } from './brushHardnessExpander';
import { renderBrushStamps, BrushStampParams } from './brushLoopRenderer';
import { getInvertedBrushImage } from './brushInvertHelper';

export async function applyTiledBrushes(
    targetCtx: CanvasRenderingContext2D,
    ov: ProjectOverlay,
    originX: number,
    originY: number,
    config: { width: number; height: number },
    targetWidth: number,
    targetHeight: number,
    pixelScale: number = 1
): Promise<void> {
    const brushes = ov.filters.brushes;
    if (!brushes || brushes.length === 0) return;

    const f = ov.filters;
    const relScale = ov.type === 'smart' ? 1 : pixelScale;
    const relX = (ov.x - originX) * relScale;
    const relY = (ov.y - originY) * relScale;

    const footprint = (f.staticScale || 100) / 100;
    const tileW = config.width * footprint * pixelScale;
    const tileH = config.height * footprint * pixelScale;
    const repeatX = Math.max(1, Number(ov.repeatX) || 1);
    const repeatY = Math.max(1, Number(ov.repeatY) || 1);
    const baseSqSize = Math.round(tileW / Math.sqrt(2));

    for (const brush of brushes) {
        if (!brush.src) continue;
        const brushImg = await loadImage(brush.src);
        if (!brushImg) continue;

        const footprintFactor = Math.max(
            1,
            Math.round(brush.footprint ?? (brush.mainScale !== undefined && brush.mainScale <= 20 ? brush.mainScale : undefined) ?? brush.repeatSpread ?? 1)
        );
        const brushMainScale = brush.footprint !== undefined
            ? (brush.mainScale ?? 100)
            : ((brush.mainScale && brush.mainScale > 20) ? brush.mainScale : 100);
        const spreadPct = Math.max(0, Math.min(100, brush.spread ?? 100));
        const brushCanvasZoom = brush.canvasZoom ?? brush.scale ?? 100;
        const brushRotation = brush.rotation ?? 0;
        const randScaleAmt = Math.max(0, Math.min(100, brush.randomScale ?? 0)) / 100;
        const rawHardness = brush.hardness ?? 100;
        const baseHardnessFactor = Math.min(1, Math.max(0, rawHardness) / 100);
        const shuffleMode = brush.shuffleMode || 'standard';
        const scramblePositions = f.scramblePositions || 0;
        const effectiveTilingMode = brush.tilingMode ?? (brush.tiled === false ? 'untiled' : 'tiled');
        const isUntransformed = Boolean(brush.untransformed || effectiveTilingMode === 'untransformed');
        const isTiled = brush.tiled !== false && effectiveTilingMode !== 'untiled';
        const effectiveBrushImg = brush.invert
            ? getInvertedBrushImage(brushImg, brushImg.width, brushImg.height, brush.src)
            : brushImg;

        const baseStampParams: Omit<BrushStampParams, 'ctx'> = {
            brushImg: effectiveBrushImg,
            tileType: f.tileType,
            baseSqSize,
            footprint,
            pixelScale,
            footprintFactor,
            brushMainScale,
            brushCanvasZoom,
            brushRotation,
            randScaleAmt,
            shuffleMode,
            spreadPct,
            scramblePositions,
            repeatX,
            repeatY,
            relX,
            relY,
            tileW,
            tileH,
            targetWidth,
            targetHeight,
            tiled: isTiled,
            untransformed: isUntransformed,
            tilingMode: effectiveTilingMode,
            resizeSampling: brush.resizeSampling ?? 'bicubic',
        };

        if (brush.mode === 'transparency') {
            // Transparency Brush: White in brush creates transparency in the tiled layer
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = targetWidth;
            maskCanvas.height = targetHeight;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            if (!maskCtx) continue;

            maskCtx.imageSmoothingEnabled = f.renderMode === 'smooth';
            if (f.renderMode === 'smooth') maskCtx.imageSmoothingQuality = 'high';

            renderBrushStamps({ ...baseStampParams, ctx: maskCtx });

            const maskImgData = maskCtx.getImageData(0, 0, targetWidth, targetHeight);
            let mData = maskImgData.data;

            if (rawHardness > 100) {
                const expandBase = effectiveTilingMode === 'untiled' ? Math.max(repeatX, repeatY) * baseSqSize : baseSqSize;
                const expandRadius = ((rawHardness - 100) / 100) * (expandBase * 0.08 * pixelScale);
                mData = dilateMask(mData, targetWidth, targetHeight, expandRadius);
            }

            const targetImgData = targetCtx.getImageData(0, 0, targetWidth, targetHeight);
            const tData = targetImgData.data;
            const len = tData.length;

            for (let i = 0; i < len; i += 4) {
                const mA = mData[i + 3];
                if (mA === 0) continue;

                const lum = (mData[i] * 0.299 + mData[i + 1] * 0.587 + mData[i + 2] * 0.114) / 255;
                const eraseFactor = lum * (mA / 255) * baseHardnessFactor;
                if (eraseFactor > 0) {
                    const currentAlpha = tData[i + 3];
                    tData[i + 3] = Math.max(0, Math.round(currentAlpha * (1 - eraseFactor)));
                }
            }

            targetCtx.putImageData(targetImgData, 0, 0);
        } else if (brush.mode === 'coloring') {
            // Coloring Brush: Adjusts hue, contrast, brightness, saturation according to mask
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = targetWidth;
            maskCanvas.height = targetHeight;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            if (!maskCtx) continue;

            maskCtx.imageSmoothingEnabled = f.renderMode === 'smooth';
            if (f.renderMode === 'smooth') maskCtx.imageSmoothingQuality = 'high';

            renderBrushStamps({ ...baseStampParams, ctx: maskCtx });

            const maskImgData = maskCtx.getImageData(0, 0, targetWidth, targetHeight);
            let mData = maskImgData.data;

            if (rawHardness > 100) {
                const expandBase = effectiveTilingMode === 'untiled' ? Math.max(repeatX, repeatY) * baseSqSize : baseSqSize;
                const expandRadius = ((rawHardness - 100) / 100) * (expandBase * 0.08 * pixelScale);
                mData = dilateMask(mData, targetWidth, targetHeight, expandRadius);
            }

            const targetImgData = targetCtx.getImageData(0, 0, targetWidth, targetHeight);

            applyColoringToImageData(
                targetImgData.data,
                mData,
                baseHardnessFactor,
                brush.hue ?? 0,
                brush.contrast ?? 100,
                brush.brightness ?? 100,
                brush.saturation ?? 100
            );

            targetCtx.putImageData(targetImgData, 0, 0);
        } else {
            // Normal Brush: stamps colored/grayscale image over the tiled layer isometrically
            targetCtx.save();
            targetCtx.imageSmoothingEnabled = f.renderMode === 'smooth';
            if (f.renderMode === 'smooth') targetCtx.imageSmoothingQuality = 'high';
            targetCtx.globalAlpha = baseHardnessFactor;

            renderBrushStamps({ ...baseStampParams, ctx: targetCtx });

            targetCtx.restore();
        }
    }
}
