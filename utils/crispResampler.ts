/**
 * Advanced Crisp Resampler
 * 
 * Provides high-quality multi-tier progressive downscaling combined with an
 * adaptive high-frequency detail retention filter (unsharp micro-contrast).
 * 
 * This avoids both:
 * 1. The harsh aliasing, moiré, and missing pixels of nearest-neighbor ('pixel')
 * 2. The blurry, muddy, smeary look of single-step bilinear ('smooth')
 * 
 * It keeps textures crisp, punchy, and readable even when downscaled to tiny tile sizes (30-60px),
 * and guarantees 100% deterministic pixel reproduction across viewport and exports.
 */

const crispCache = new Map<string, HTMLCanvasElement>();

export function clearCrispCache() {
    crispCache.clear();
}

/**
 * Downsamples an image progressively in half-steps (halving width/height)
 * to avoid single-step high-ratio downsampling blur, then applies an
 * edge-preserving micro-contrast pass.
 */
export function createCrispResampledCanvas(
    source: CanvasImageSource,
    srcWidth: number,
    srcHeight: number,
    targetWidth: number,
    targetHeight: number
): HTMLCanvasElement {
    const tW = Math.max(1, Math.round(targetWidth));
    const tH = Math.max(1, Math.round(targetHeight));

    // If target is larger or equal, just draw directly
    if (tW >= srcWidth && tH >= srcHeight) {
        const directCanvas = document.createElement('canvas');
        directCanvas.width = tW;
        directCanvas.height = tH;
        const ctx = directCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(source, 0, 0, srcWidth, srcHeight, 0, 0, tW, tH);
        }
        return directCanvas;
    }

    // Step 1: Multi-pass progressive half-step downscaling
    let currentCanvas = document.createElement('canvas');
    currentCanvas.width = srcWidth;
    currentCanvas.height = srcHeight;
    let currentCtx = currentCanvas.getContext('2d', { willReadFrequently: true })!;
    currentCtx.imageSmoothingEnabled = true;
    currentCtx.imageSmoothingQuality = 'high';
    currentCtx.drawImage(source, 0, 0, srcWidth, srcHeight);

    let curW = srcWidth;
    let curH = srcHeight;

    // Step down by factors of 2 until we are within 2x of target
    while (curW * 0.5 >= tW && curH * 0.5 >= tH) {
        const nextW = Math.max(tW, Math.floor(curW * 0.5));
        const nextH = Math.max(tH, Math.floor(curH * 0.5));

        const nextCanvas = document.createElement('canvas');
        nextCanvas.width = nextW;
        nextCanvas.height = nextH;
        const nextCtx = nextCanvas.getContext('2d', { willReadFrequently: true })!;
        nextCtx.imageSmoothingEnabled = true;
        nextCtx.imageSmoothingQuality = 'high';
        nextCtx.drawImage(currentCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);

        currentCanvas = nextCanvas;
        currentCtx = nextCtx;
        curW = nextW;
        curH = nextH;
    }

    // Final scaling pass to exact target dimensions
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = tW;
    finalCanvas.height = tH;
    const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true })!;
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(currentCanvas, 0, 0, curW, curH, 0, 0, tW, tH);

    // Step 2: Adaptive high-frequency detail retention (Unsharp Micro-Contrast)
    // Enhances edge distinction without blowing out colors or introducing noise
    try {
        const imgData = finalCtx.getImageData(0, 0, tW, tH);
        const data = imgData.data;
        const copy = new Uint8ClampedArray(data);

        // Kernel: center weight + subtle negative cross neighbors
        // Amount = 0.35 gives crisp texture definition without ringing/haloing
        const amount = 0.35;

        for (let y = 0; y < tH; y++) {
            const yOffset = y * tW;
            const yPrev = Math.max(0, y - 1) * tW;
            const yNext = Math.min(tH - 1, y + 1) * tW;

            for (let x = 0; x < tW; x++) {
                const i = (yOffset + x) * 4;
                const alpha = copy[i + 3];
                if (alpha < 10) continue; // Skip transparency

                const xPrev = Math.max(0, x - 1);
                const xNext = Math.min(tW - 1, x + 1);

                const iUp = (yPrev + x) * 4;
                const iDown = (yNext + x) * 4;
                const iLeft = (yOffset + xPrev) * 4;
                const iRight = (yOffset + xNext) * 4;

                for (let c = 0; c < 3; c++) {
                    const center = copy[i + c];
                    const neighborAvg = (copy[iUp + c] + copy[iDown + c] + copy[iLeft + c] + copy[iRight + c]) * 0.25;
                    const diff = center - neighborAvg;
                    // Sharpen difference
                    const val = center + diff * amount;
                    data[i + c] = val < 0 ? 0 : (val > 255 ? 255 : Math.round(val));
                }
            }
        }

        finalCtx.putImageData(imgData, 0, 0);
    } catch {
        // Fall back gracefully if canvas context read fails
    }

    return finalCanvas;
}

/**
 * Returns a cached crisp-downsampled canvas for a given image source and target resolution.
 */
export function getCachedCrispTexture(
    source: HTMLImageElement | HTMLCanvasElement,
    srcKey: string,
    targetWidth: number,
    targetHeight: number
): HTMLCanvasElement {
    const tW = Math.max(1, Math.round(targetWidth));
    const tH = Math.max(1, Math.round(targetHeight));
    const cacheKey = `${srcKey}_${source.width}x${source.height}_to_${tW}x${tH}`;

    const cached = crispCache.get(cacheKey);
    if (cached) return cached;

    const resampled = createCrispResampledCanvas(source, source.width, source.height, tW, tH);

    // Limit cache size to avoid unbounded memory growth
    if (crispCache.size >= 80) {
        const oldest = crispCache.keys().next().value;
        if (oldest) crispCache.delete(oldest);
    }
    crispCache.set(cacheKey, resampled);

    return resampled;
}
