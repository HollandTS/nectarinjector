/**
 * Downsample helper to avoid single-pass downscaling aliasing and grain.
 * When a high-resolution image or texture is scaled down into a small tile or
 * sprite canvas, direct drawImage introduces high-frequency noise and grittiness.
 * Stepping down in successive half-steps (mipmapping) produces smooth, anti-aliased results.
 */

const downsampleCache = new Map<string, HTMLCanvasElement>();

export const clearDownsampleCache = () => {
    downsampleCache.clear();
};

export const getHighQualityDownscaledSource = (
    source: HTMLImageElement | HTMLCanvasElement,
    targetW: number,
    targetH: number
): HTMLCanvasElement | HTMLImageElement => {
    const sw = source.width;
    const sh = source.height;

    // If source is not valid or already within 1.5x of target dimensions, single-pass is sufficient
    if (!sw || !sh || targetW <= 0 || targetH <= 0 || (sw <= targetW * 1.5 && sh <= targetH * 1.5)) {
        return source;
    }

    // Generate cache key based on source and target size
    const srcKey = (source as HTMLImageElement).src || (source as any)._cacheId || '';
    const cacheKey = srcKey ? `${srcKey}_${targetW}_${targetH}` : null;
    if (cacheKey && downsampleCache.has(cacheKey)) {
        return downsampleCache.get(cacheKey)!;
    }

    // Step down in successive half-steps (mipmapping) to avoid aliasing, grittiness, and scintillation
    let curW = sw;
    let curH = sh;
    let curCanvas = document.createElement('canvas');
    curCanvas.width = curW;
    curCanvas.height = curH;
    let curCtx = curCanvas.getContext('2d');
    if (!curCtx) return source;

    curCtx.imageSmoothingEnabled = true;
    curCtx.imageSmoothingQuality = 'high';
    curCtx.drawImage(source, 0, 0, curW, curH);

    while (curW / 2 >= targetW && curH / 2 >= targetH) {
        const nextW = Math.max(targetW, Math.floor(curW / 2));
        const nextH = Math.max(targetH, Math.floor(curH / 2));
        const nextCanvas = document.createElement('canvas');
        nextCanvas.width = nextW;
        nextCanvas.height = nextH;
        const nextCtx = nextCanvas.getContext('2d');
        if (!nextCtx) break;

        nextCtx.imageSmoothingEnabled = true;
        nextCtx.imageSmoothingQuality = 'high';
        nextCtx.drawImage(curCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);

        curCanvas = nextCanvas;
        curW = nextW;
        curH = nextH;
    }

    // Store in cache (cap cache at 60 entries to keep memory bounded)
    if (cacheKey) {
        if (downsampleCache.size > 60) {
            const firstKey = downsampleCache.keys().next().value;
            if (firstKey) downsampleCache.delete(firstKey);
        }
        downsampleCache.set(cacheKey, curCanvas);
    }

    return curCanvas;
};
