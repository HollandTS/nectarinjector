import type { CanvasImage, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { loadImage } from './textureInjection';

/**
 * Renders an isometric tessellation / cliff-line preview using the exact OpenTS 2:1 cell stride
 * (`World_To_Screen` in `OPENTS_CODE/isotype.cpp`: `xx = (i - j) * W/2`, `yy = (i + j) * H/2`).
 * Automatically adds top headroom when tiles contain cliff/extra artwork taller than the base diamond.
 */
export async function renderTessellationPreview(
    canvas: HTMLCanvasElement | null,
    tiles: CanvasImage[],
    gridType: GridType,
    showSeamOverlay: boolean
) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tiles.length === 0) {
        canvas.width = 288;
        canvas.height = 144;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const activeGrid = gridType === 'none' ? 'ts_full' : gridType;
    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
    const cw = config.width;
    const ch = config.height;

    const loadedImgs: HTMLImageElement[] = [];
    let maxExtraTopHeadroom = 0;
    let maxExtraSidePad = 0;

    for (let i = 0; i < Math.min(tiles.length, 9); i++) {
        const img = await loadImage(tiles[i].src);
        if (img) {
            loadedImgs.push(img);
            if (img.height > ch) {
                maxExtraTopHeadroom = Math.max(maxExtraTopHeadroom, img.height - ch);
            }
            if (img.width > cw) {
                maxExtraSidePad = Math.max(maxExtraSidePad, Math.ceil((img.width - cw) / 2));
            }
        }
    }
    if (loadedImgs.length === 0) return;

    const gridN = 3;
    const totalW = gridN * cw + maxExtraSidePad * 2;
    const totalH = gridN * ch + ch + maxExtraTopHeadroom;
    canvas.width = totalW;
    canvas.height = totalH;
    ctx.clearRect(0, 0, totalW, totalH);
    ctx.imageSmoothingEnabled = false;

    const originX = totalW / 2 - cw / 2;
    const originY = ch / 2 + maxExtraTopHeadroom;

    // Draw 3x3 isometric grid back-to-front
    for (let sum = 0; sum <= (gridN - 1) * 2; sum++) {
        for (let i = 0; i < gridN; i++) {
            const j = sum - i;
            if (j < 0 || j >= gridN) continue;

            const screenX = originX + (i - j) * (cw / 2);
            const screenY = originY + (i + j) * (ch / 2);
            const img = loadedImgs[(i * gridN + j) % loadedImgs.length];

            // Draw bottom-aligned to cell diamond
            const drawX = Math.round(screenX - (img.width - cw) / 2);
            const drawY = Math.round(screenY + ch - img.height);
            ctx.drawImage(img, drawX, drawY);

            if (showSeamOverlay) {
                ctx.save();
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(screenX + cw / 2, screenY);
                ctx.lineTo(screenX + cw, screenY + ch / 2);
                ctx.lineTo(screenX + cw / 2, screenY + ch - 1);
                ctx.lineTo(screenX, screenY + ch / 2);
                ctx.closePath();
                ctx.stroke();

                // Also highlight Extra Art bounding box if taller than base diamond
                if (img.height > ch) {
                    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
                    ctx.setLineDash([2, 2]);
                    ctx.strokeRect(drawX + 0.5, drawY + 0.5, img.width - 1, img.height - ch);
                }
                ctx.restore();
            }
        }
    }
}
