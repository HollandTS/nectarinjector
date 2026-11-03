import { loadImage } from './textureInjection';

export interface SplitResult {
    primaryCut: string;
    additionalCuts: string[];
}

/**
 * Cuts an image source into 4 equal quadrants (2x2 grid):
 * Cut 1: Top-Left (becomes new layer primary image)
 * Cut 2: Top-Right
 * Cut 3: Bottom-Left
 * Cut 4: Bottom-Right
 */
export async function splitTextureInFour(src: string): Promise<SplitResult | null> {
    if (!src) return null;
    const img = await loadImage(src);
    if (!img || img.width < 2 || img.height < 2) return null;

    const w = Math.floor(img.width / 2);
    const h = Math.floor(img.height / 2);

    const coords = [
        { sx: 0, sy: 0 },
        { sx: w, sy: 0 },
        { sx: 0, sy: h },
        { sx: w, sy: h }
    ];

    const cuts: string[] = [];
    for (const { sx, sy } of coords) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
        cuts.push(c.toDataURL('image/png'));
    }

    if (cuts.length < 4) return null;

    return {
        primaryCut: cuts[0],
        additionalCuts: [cuts[1], cuts[2], cuts[3]]
    };
}
