import type { PaletteColor } from './westwoodPaletteParser';

let currentLoadedPalette: PaletteColor[] | null = null;
let currentLoadedPaletteFileName: string = 'isotem.pal';

export function setLoadedPalette(palette: PaletteColor[] | null, fileName?: string): void {
    currentLoadedPalette = palette;
    if (fileName && fileName.trim()) {
        currentLoadedPaletteFileName = fileName.trim();
    }
}

export function getLoadedPalette(): PaletteColor[] | null {
    return currentLoadedPalette;
}

export function getLoadedPaletteFileName(): string {
    return currentLoadedPaletteFileName;
}

/**
 * Limits a canvas visibly to the loaded .pal file by mapping each non-transparent pixel
 * to the closest color in the palette using Euclidean RGB distance.
 */
export function applyPaletteLimitToCanvas(
    canvas: HTMLCanvasElement,
    palette: PaletteColor[]
): void {
    if (!palette || palette.length === 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const { width, height } = canvas;
    if (width === 0 || height === 0) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Cache computed RGB mappings to avoid redundant distance calculations
    const colorCache = new Map<number, { r: number; g: number; b: number }>();

    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 10) continue; // Skip transparent pixels

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const key = (r << 16) | (g << 8) | b;
        let matched = colorCache.get(key);

        if (!matched) {
            let bestDist = Infinity;
            let bestColor = palette[0];
            for (let pIdx = 0; pIdx < palette.length; pIdx++) {
                const palCol = palette[pIdx];
                const dr = palCol.r - r;
                const dg = palCol.g - g;
                const db = palCol.b - b;
                const dist = dr * dr + dg * dg + db * db;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestColor = palCol;
                    if (dist === 0) break;
                }
            }
            matched = { r: bestColor.r, g: bestColor.g, b: bestColor.b };
            colorCache.set(key, matched);
        }

        data[i] = matched.r;
        data[i + 1] = matched.g;
        data[i + 2] = matched.b;
    }

    ctx.putImageData(imgData, 0, 0);
}
