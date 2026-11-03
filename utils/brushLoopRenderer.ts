import type { TiledBrushShuffleMode, TiledBrushTilingMode, BrushResizeSampling } from '../types';
import { drawIsometricBrushStamp } from './brushStampRenderer';

function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export interface BrushStampParams {
    ctx: CanvasRenderingContext2D;
    brushImg: HTMLImageElement | HTMLCanvasElement;
    tileType: string | undefined;
    baseSqSize: number;
    footprint: number;
    pixelScale: number;
    footprintFactor: number;
    brushMainScale: number;
    brushCanvasZoom: number;
    brushRotation: number;
    randScaleAmt: number;
    shuffleMode: TiledBrushShuffleMode;
    spreadPct: number;
    scramblePositions: number;
    repeatX: number;
    repeatY: number;
    relX: number;
    relY: number;
    tileW: number;
    tileH: number;
    targetWidth: number;
    targetHeight: number;
    tiled?: boolean;
    untransformed?: boolean;
    tilingMode?: TiledBrushTilingMode;
    resizeSampling?: BrushResizeSampling;
}

export function renderBrushStamps(params: BrushStampParams) {
    const {
        ctx,
        brushImg,
        tileType,
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
        tiled,
        untransformed,
        tilingMode,
        resizeSampling = 'bicubic',
    } = params;

    const effectiveTilingMode = tilingMode ?? (tiled === false ? 'untiled' : 'tiled');
    const isUntransformed = Boolean(untransformed ?? (effectiveTilingMode === 'untransformed'));
    const isUntiled = tiled === false || effectiveTilingMode === 'untiled';

    // When untiled, apply single brush stamp across the entire tiled area
    if (isUntiled) {
        if (spreadPct <= 0) return;

        const midCol = (repeatX - 1) / 2;
        const midRow = (repeatY - 1) / 2;

        let centerX: number;
        let centerY: number;
        if (tileType === 'slope_se') {
            centerX = relX + (midCol - midRow) * (tileW / 2);
            centerY = relY + (midCol + midRow / 2) * tileH;
        } else if (tileType === 'slope_sw') {
            centerX = relX + (midCol - midRow) * (tileW / 2);
            centerY = relY + (midCol / 2 + midRow) * tileH;
        } else {
            centerX = relX + (midCol - midRow) * (tileW / 2);
            centerY = relY + (midCol + midRow) * (tileH / 2);
        }

        const totalGridW = repeatX * baseSqSize;
        const totalGridH = repeatY * baseSqSize;

        ctx.save();
        ctx.translate(centerX, centerY);
        drawIsometricBrushStamp(
            ctx,
            brushImg,
            tileType,
            totalGridW,
            footprint,
            pixelScale,
            shuffleMode,
            0,
            0,
            scramblePositions,
            brushCanvasZoom,
            brushRotation,
            brushMainScale,
            totalGridH,
            isUntransformed,
            resizeSampling
        );
        ctx.restore();
        return;
    }

    const shouldTileReceiveBrush = (row: number, col: number) => {
        if (spreadPct >= 100) return true;
        if (spreadPct <= 0) return false;
        const tileHash = seededRandom(row * 4391 + col * 9829 + scramblePositions + 137);
        return (tileHash * 100) < spreadPct;
    };

    for (let row = 0; row < repeatY; row += footprintFactor) {
        for (let col = 0; col < repeatX; col += footprintFactor) {
            if (!shouldTileReceiveBrush(row, col)) continue;

            let tx: number;
            let ty: number;
            if (tileType === 'slope_se') {
                tx = relX + (col - row) * (tileW / 2);
                ty = relY + (col + row / 2) * tileH;
            } else if (tileType === 'slope_sw') {
                tx = relX + (col - row) * (tileW / 2);
                ty = relY + (col / 2 + row) * tileH;
            } else {
                tx = relX + (col - row) * (tileW / 2);
                ty = relY + (col + row) * (tileH / 2);
            }

            const seed = seededRandom(row * 7919 + col * 6271 + scramblePositions + 997);
            let randScaleMultiplier = 1;
            if (randScaleAmt > 0) {
                randScaleMultiplier = Math.max(0.05, 1 + (seed * 2 - 1) * randScaleAmt);
            }

            const currentSqSize = baseSqSize * footprintFactor * randScaleMultiplier;

            if (
                tx + currentSqSize * 2 < -200 ||
                tx - currentSqSize * 2 > targetWidth + 200 ||
                ty + currentSqSize * 2 < -200 ||
                ty - currentSqSize * 2 > targetHeight + 200
            ) {
                continue;
            }

            ctx.save();
            ctx.translate(tx, ty);
            drawIsometricBrushStamp(
                ctx,
                brushImg,
                tileType,
                currentSqSize,
                footprint,
                pixelScale,
                shuffleMode,
                row,
                col,
                seed,
                brushCanvasZoom,
                brushRotation,
                brushMainScale,
                undefined,
                isUntransformed,
                resizeSampling
            );
            ctx.restore();
        }
    }
}
