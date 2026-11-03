import type { CanvasImage, RgbaColor, TileColorSwapItem } from '../types';
import { loadImage } from './textureInjection';

export const createDefaultTileSwap = (
    selectedTileIds: string[] = [],
    colors: RgbaColor[] = [],
    id?: string
): TileColorSwapItem => ({
    id: id || `tile-swap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: selectedTileIds.length > 0 ? `Match (${selectedTileIds.length} tiles)` : 'Tile Match',
    enabled: true,
    strength: 100,
    selectedTileIds,
    colors
});

/**
 * Extracts distinct representative colors from a list of CanvasImage tiles.
 * Skips transparent or nearly transparent pixels.
 */
export const extractPaletteFromTiles = async (
    tiles: CanvasImage[],
    maxColors: number = 256
): Promise<RgbaColor[]> => {
    if (!tiles || tiles.length === 0) return [];

    const colorFrequency = new Map<number, { r: number; g: number; b: number; count: number }>();

    for (const tile of tiles) {
        if (!tile.src) continue;
        try {
            const img = await loadImage(tile.src);
            if (!img) continue;

            const canvas = document.createElement('canvas');
            canvas.width = img.width || tile.width;
            canvas.height = img.height || tile.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) continue;

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imgData.data;

            // Sample every 1-2 pixels to keep extraction fast
            const step = (d.length > 100000) ? 8 : 4;
            for (let i = 0; i < d.length; i += step) {
                const a = d[i + 3];
                if (a < 30) continue; // Skip transparency

                // Quantize slightly (5 bits per channel) to group near-identical colors
                const qr = (d[i] >> 3) << 3;
                const qg = (d[i + 1] >> 3) << 3;
                const qb = (d[i + 2] >> 3) << 3;
                const key = (qr << 16) | (qg << 8) | qb;

                const existing = colorFrequency.get(key);
                if (existing) {
                    existing.count++;
                } else {
                    colorFrequency.set(key, { r: d[i], g: d[i + 1], b: d[i + 2], count: 1 });
                }
            }
        } catch (err) {
            console.warn("Failed extracting palette from tile:", tile.name, err);
        }
    }

    if (colorFrequency.size === 0) return [];

    // Sort by frequency and take top colors
    const sorted = Array.from(colorFrequency.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, maxColors)
        .map(c => ({ r: c.r, g: c.g, b: c.b, a: 1 }));

    return sorted;
};

/**
 * Maps each non-transparent pixel on the canvas to the closest color in the palette.
 * Supports strength blending from 0 to 100%.
 */
export const applyTileColorMatch = (
    canvas: HTMLCanvasElement,
    palette: RgbaColor[],
    strength: number = 100
): void => {
    if (!palette || palette.length === 0 || strength <= 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const { width, height } = canvas;
    if (width === 0 || height === 0) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const s = Math.max(0, Math.min(100, strength)) / 100;

    // Cache color mappings to keep mapping fast across thousands of pixels
    const cache = new Map<number, { r: number; g: number; b: number }>();

    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 15) continue; // Skip transparency

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const key = (r << 16) | (g << 8) | b;
        let matched = cache.get(key);

        if (!matched) {
            let bestDist = Infinity;
            let bestColor = palette[0];
            for (let pIdx = 0; pIdx < palette.length; pIdx++) {
                const pal = palette[pIdx];
                const dr = pal.r - r;
                const dg = pal.g - g;
                const db = pal.b - b;
                const dist = dr * dr + dg * dg + db * db;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestColor = pal;
                    if (dist === 0) break;
                }
            }
            matched = { r: bestColor.r, g: bestColor.g, b: bestColor.b };
            cache.set(key, matched);
        }

        if (s >= 1) {
            data[i] = matched.r;
            data[i + 1] = matched.g;
            data[i + 2] = matched.b;
        } else {
            data[i] = Math.round(r * (1 - s) + matched.r * s);
            data[i + 1] = Math.round(g * (1 - s) + matched.g * s);
            data[i + 2] = Math.round(b * (1 - s) + matched.b * s);
        }
    }

    ctx.putImageData(imgData, 0, 0);
};

export const applyAllTileSwaps = (
    canvas: HTMLCanvasElement,
    swaps: TileColorSwapItem[]
): void => {
    if (!swaps || swaps.length === 0) return;
    for (const swap of swaps) {
        if (swap.enabled !== false && swap.colors && swap.colors.length > 0) {
            applyTileColorMatch(canvas, swap.colors, swap.strength);
        }
    }
};
