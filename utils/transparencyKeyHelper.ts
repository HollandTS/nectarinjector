import type { RgbaColor } from '../types';

/**
 * Checks if a pixel matches the transparency key color.
 * When tolerance is 1 (the default), only the exact picked color matches.
 * When tolerance > 1, colors within the Euclidean distance match.
 */
export const isKeyColorMatch = (
    r: number,
    g: number,
    b: number,
    keyColor: RgbaColor,
    tolerance: number = 1
): boolean => {
    if (r === keyColor.r && g === keyColor.g && b === keyColor.b) {
        return true;
    }
    if (tolerance > 1) {
        const dist = Math.hypot(r - keyColor.r, g - keyColor.g, b - keyColor.b);
        return dist <= tolerance;
    }
    return false;
};

/**
 * Applies key color transparency directly to a 2D canvas context.
 * Sets alpha to 0 for matching pixels.
 */
export const applyKeyColorToCanvas = (
    ctx: CanvasRenderingContext2D,
    keyColor: RgbaColor | null,
    tolerance: number = 1
): void => {
    if (!keyColor) return;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    let modified = false;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        if (isKeyColorMatch(data[i], data[i + 1], data[i + 2], keyColor, tolerance)) {
            data[i + 3] = 0;
            modified = true;
        }
    }

    if (modified) {
        ctx.putImageData(imageData, 0, 0);
    }
};

/**
 * Processes an image and produces a canvas with key color transparency applied.
 */
export const processKeyColorTransparency = (
    img: HTMLImageElement,
    keyColor: RgbaColor | null,
    tolerance: number = 1
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    if (keyColor) {
        applyKeyColorToCanvas(ctx, keyColor, tolerance);
    }

    return canvas;
};
