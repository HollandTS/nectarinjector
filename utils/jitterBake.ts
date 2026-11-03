import { OverlayFilters } from '../types';
import { applyPixelNoise } from './imageEffects';

/**
 * Loads an image from a URL or data URL into an HTMLImageElement safely.
 */
const loadImageElement = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error("Failed to load source image: " + e));
        img.src = src;
    });
};

/**
 * Bakes current jitter settings directly into an image source URL,
 * returning the baked image as a dataURL.
 */
export async function bakeJitterToOverlayImage(
    src: string,
    filters: OverlayFilters
): Promise<string> {
    const img = await loadImageElement(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Could not acquire 2D canvas context for jitter baking");
    }

    ctx.drawImage(img, 0, 0);
    applyPixelNoise(ctx, canvas.width, canvas.height, filters);

    return canvas.toDataURL('image/png');
}
