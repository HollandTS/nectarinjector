
import type { ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { isoToScreen } from './geoUtils';
import { applyPixelNoise, applyPixelFilters } from './imageEffects';
import { applyAdvancedEffects } from './filterEngine';

const applyShuffle = (ctx: CanvasRenderingContext2D, f: any, row: number, col: number, repeatX: number) => {
    if (f.shuffleMode === 'default') {
        const seed = (row * repeatX + col) * 12345;
        ctx.rotate((Math.floor((seed % 4)) * 90) * Math.PI / 180); 
        ctx.scale((seed % 7) > 3 ? -1 : 1, (seed % 11) > 5 ? -1 : 1);
    } else if (f.shuffleMode === 'mirror_h' && col % 2 === 1) ctx.scale(-1, 1);
    else if (f.shuffleMode === 'mirror_v' && row % 2 === 1) ctx.scale(1, -1);
    else if (f.shuffleMode === 'mirror_both') {
        if (col % 2 === 1) ctx.scale(-1, 1); if (row % 2 === 1) ctx.scale(1, -1);
    }
};

export const renderOverlayToCanvas = async (overlay: ProjectOverlay, gridType: GridType): Promise<HTMLCanvasElement | null> => {
    if (!overlay.src) return null;

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                resolve(null);
                return;
            }

            const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
            const f = overlay.filters;
            const isRa2Tiled = config.width === 60 && overlay.type === 'tiled';
            const ra2ScaleFix = isRa2Tiled ? 1.01015 : 1;
            const footprint = f.staticScale / 100, individualZoom = (f.mainScale / 100) * ra2ScaleFix, borderCut = f.canvasZoom / 100;
            const tileW = config.width * footprint, tileH = config.height * footprint;
            const sqSize = isRa2Tiled ? (tileW / Math.sqrt(2)) : Math.round(tileW / Math.sqrt(2));
            
            const minX = -overlay.repeatY * (tileW/2), maxX = overlay.repeatX * (tileW/2), minY = -tileH, maxY = (overlay.repeatX + overlay.repeatY) * (tileH/2) + tileH * 2.5;
            
            canvas.width = Math.ceil((maxX - minX) + tileW * 2); 
            canvas.height = Math.ceil((maxY - minY) + tileH * 2); 
            ctx.clearRect(0, 0, canvas.width, canvas.height); 
            ctx.imageSmoothingEnabled = f.renderMode === 'smooth' || f.renderMode === 'crisp'; 
            if (f.renderMode === 'smooth' || f.renderMode === 'crisp') {
                ctx.imageSmoothingQuality = 'high';
            } 
            
            const originX = -minX + tileW, originY = -minY + tileH;
            
            for (let row = 0; row < overlay.repeatY; row++) {
                for (let col = 0; col < overlay.repeatX; col++) {
                    let tx, ty;
                    
                    if (f.tileType === 'slope_se') {
                        tx = originX + (col - row) * (tileW / 2);
                        ty = originY + (col + row/2) * (tileH); 
                    } else if (f.tileType === 'slope_sw') {
                        tx = originX + (col - row) * (tileW / 2);
                        ty = originY + (col/2 + row) * (tileH);
                    } else {
                        const pos = isoToScreen(col, row, tileW, tileH);
                        tx = originX + pos.x; 
                        ty = originY + pos.y;
                    }
                    
                    ctx.save();
                    ctx.translate(tx, ty);
                    
                    if (f.tileType === 'flat') {
                        ctx.scale(1.05 * individualZoom, 0.525 * individualZoom); 
                        ctx.rotate(45 * Math.PI / 180); 
                        ctx.beginPath();
                        ctx.rect(-sqSize/2, -sqSize/2, sqSize, sqSize);
                        ctx.clip();
                        const drawSize = sqSize * borderCut;
                        ctx.rotate(f.rotation * Math.PI / 180);
                        applyShuffle(ctx, f, row, col, overlay.repeatX);
                        if (f.flipH) ctx.scale(-1, 1); if (f.flipV) ctx.scale(1, -1);
                        ctx.drawImage(img, -drawSize/2, -drawSize/2, drawSize, drawSize);
                    } else if (f.tileType === 'slope_se') {
                        ctx.translate(4.32 * footprint, -8.50 * footprint);
                        ctx.scale(1.025, 1.000);
                        ctx.rotate(45 * Math.PI / 180);
                        const clipSize = sqSize * 1.5;
                        ctx.beginPath(); ctx.rect(-clipSize/2, -clipSize/2, clipSize, clipSize); ctx.clip();
                        ctx.scale(1.0166 * individualZoom * borderCut, 0.7436 * individualZoom * borderCut);
                        const skewX = -13.6 * Math.PI / 180;
                        ctx.transform(1, 0, Math.tan(skewX), 1, 0, 0);
                        ctx.rotate(f.rotation * Math.PI / 180);
                        applyShuffle(ctx, f, row, col, overlay.repeatX);
                        if (f.flipH) ctx.scale(-1, 1); if (f.flipV) ctx.scale(1, -1);
                        ctx.drawImage(img, -sqSize/2, -sqSize/2, sqSize, sqSize);
                    } else if (f.tileType === 'slope_sw') {
                        ctx.translate(5.21 * footprint, -11.29 * footprint);
                        ctx.scale(1.025, 1.000);
                        ctx.rotate(45 * Math.PI / 180);
                        const clipSize = sqSize * 1.5;
                        ctx.beginPath(); ctx.rect(-clipSize/2, -clipSize/2, clipSize, clipSize); ctx.clip();
                        ctx.scale(0.858 * individualZoom * borderCut, 1.157 * individualZoom * borderCut);
                        const skewX = 0.2 * Math.PI / 180;
                        const skewY = -13.2 * Math.PI / 180;
                        ctx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0);
                        ctx.rotate(f.rotation * Math.PI / 180);
                        applyShuffle(ctx, f, row, col, overlay.repeatX);
                        if (f.flipH) ctx.scale(-1, 1); if (f.flipV) ctx.scale(1, -1);
                        ctx.drawImage(img, -sqSize/2, -sqSize/2, sqSize, sqSize);
                    }
                    ctx.restore();
                }
            }
            
            applyAdvancedEffects(ctx, canvas.width, canvas.height, f);
            applyPixelNoise(ctx, canvas.width, canvas.height, f); 
            applyPixelFilters(canvas, overlay.filters);
            resolve(canvas);
        };
        img.src = overlay.src;
    });
};
