import type { BrushResizeSampling } from '../types';

export const BRUSH_RESIZE_SAMPLING_OPTIONS: Array<{
    value: BrushResizeSampling;
    label: string;
    description: string;
}> = [
    {
        value: 'nearest',
        label: 'Nearest Neighbor (Pixelated)',
        description: 'Hard pixel edges with zero anti-aliasing',
    },
    {
        value: 'pixel_art',
        label: 'Crisp Pixel-Art (Clean Downscale)',
        description: 'Smooth area-averaged downscale with crisp alpha threshold (no blurry halo)',
    },
    {
        value: 'bilinear',
        label: 'Bilinear (Smooth)',
        description: 'Smooth linear interpolation when scaling down or rotating',
    },
    {
        value: 'bicubic',
        label: 'Bicubic (High Quality)',
        description: 'High-quality multi-step cubic interpolation for smooth shrinking',
    },
    {
        value: 'lanczos',
        label: 'Lanczos / Sharp Smooth',
        description: 'Multi-step downsampling + subtle unsharp mask so shrunk details stay sharp, not blocky',
    },
];

/**
 * Configures a 2D canvas context's smoothing properties according to the chosen BrushResizeSampling.
 */
export function configureCanvasContextForSampling(
    ctx: CanvasRenderingContext2D,
    sampling: BrushResizeSampling = 'bicubic'
): void {
    if (sampling === 'nearest') {
        ctx.imageSmoothingEnabled = false;
    } else if (sampling === 'bilinear') {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
    } else {
        // bicubic, lanczos, pixel_art use high-quality progressive sampling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }
}

/**
 * Pre-scales a source region `(sx, sy, sWidth, sHeight)` of `sourceImg` to `(targetW, targetH)`
 * using progressive half-step downsampling when shrinking by >50%, preventing blocky/pixelated aliasing.
 */
export function createResampledBrushCanvas(
    sourceImg: HTMLImageElement | HTMLCanvasElement,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    targetW: number,
    targetH: number,
    sampling: BrushResizeSampling = 'bicubic'
): HTMLCanvasElement {
    const finalW = Math.max(1, Math.round(targetW));
    const finalH = Math.max(1, Math.round(targetH));

    // Step 1: Extract cropped source region
    let curW = Math.max(1, Math.round(sWidth));
    let curH = Math.max(1, Math.round(sHeight));
    let curCanvas = document.createElement('canvas');
    curCanvas.width = curW;
    curCanvas.height = curH;
    const initCtx = curCanvas.getContext('2d', { willReadFrequently: true });
    if (!initCtx) return curCanvas;

    initCtx.imageSmoothingEnabled = sampling !== 'nearest';
    initCtx.drawImage(sourceImg, sx, sy, sWidth, sHeight, 0, 0, curW, curH);

    if (sampling === 'nearest') {
        const out = document.createElement('canvas');
        out.width = finalW;
        out.height = finalH;
        const oCtx = out.getContext('2d', { willReadFrequently: true });
        if (oCtx) {
            oCtx.imageSmoothingEnabled = false;
            oCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, finalW, finalH);
        }
        return out;
    }

    // Step 2: Progressive 0.5x multi-step downsampling for bicubic / lanczos / pixel_art
    // Browser drawImage produces severe aliasing when scaling down below 50% in a single step.
    if (sampling === 'bicubic' || sampling === 'lanczos' || sampling === 'pixel_art') {
        while (curW * 0.5 > finalW * 1.15 && curH * 0.5 > finalH * 1.15) {
            const nextW = Math.max(finalW, Math.round(curW * 0.5));
            const nextH = Math.max(finalH, Math.round(curH * 0.5));
            const stepCanvas = document.createElement('canvas');
            stepCanvas.width = nextW;
            stepCanvas.height = nextH;
            const sCtx = stepCanvas.getContext('2d');
            if (!sCtx) break;
            sCtx.imageSmoothingEnabled = true;
            sCtx.imageSmoothingQuality = 'high';
            sCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
            curCanvas = stepCanvas;
            curW = nextW;
            curH = nextH;
        }
    }

    // Step 3: Final scale to targetW x targetH
    const outCanvas = document.createElement('canvas');
    outCanvas.width = finalW;
    outCanvas.height = finalH;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) return outCanvas;

    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = sampling === 'bilinear' ? 'medium' : 'high';
    outCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, finalW, finalH);

    // Step 4: Post-processing for Lanczos (detail-preserving unsharp) or Crisp Pixel-Art (clean alpha edge)
    if (sampling === 'lanczos' && finalW >= 3 && finalH >= 3) {
        applySubtleUnsharpToCanvas(outCtx, finalW, finalH, 0.35);
    } else if (sampling === 'pixel_art') {
        applyCleanPixelArtAlphaAndSharpen(outCtx, finalW, finalH);
    }

    return outCanvas;
}

/**
 * Applies a subtle 3x3 unsharp mask to restore micro-contrast lost during downscaling
 * without introducing jagged nearest-neighbor staircasing.
 */
function applySubtleUnsharpToCanvas(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    amount: number
): void {
    const imgData = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (src[idx + 3] < 16) continue;

            const top = ((y - 1) * w + x) * 4;
            const bot = ((y + 1) * w + x) * 4;
            const lft = (y * w + (x - 1)) * 4;
            const rgt = (y * w + (x + 1)) * 4;

            for (let c = 0; c < 3; c++) {
                const blur = (src[top + c] + src[bot + c] + src[lft + c] + src[rgt + c]) * 0.25;
                const val = src[idx + c] + (src[idx + c] - blur) * amount;
                dst[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

/**
 * Keeps interior colors smoothly averaged when downscaled while snapping semi-transparent
 * border fringes to crisp pixel-art edges so sprites don't get muddy halos on tiles.
 */
function applyCleanPixelArtAlphaAndSharpen(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
): void {
    if (w >= 3 && h >= 3) {
        applySubtleUnsharpToCanvas(ctx, w, h, 0.28);
    }
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a < 96) {
            d[i + 3] = 0;
        } else {
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);
}
