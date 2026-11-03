import type { ColorHeightRule } from '../types';

/**
 * Extracts up to `maxColors` dominant/distinct colors from an image or canvas
 * so the user can quickly click a palette swatch to make that color higher or lower.
 */
export function extractDominantColorsFromImage(
    img: HTMLImageElement | HTMLCanvasElement,
    maxColors: number = 8
): { r: number; g: number; b: number; hex: string }[] {
    const sampleSize = 64;
    const c = document.createElement('canvas');
    c.width = sampleSize;
    c.height = sampleSize;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

    // Quantize into 16x16x16 bins
    const bins = new Map<string, { rSum: number; gSum: number; bSum: number; count: number }>();

    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 32) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const qr = r >> 4;
        const qg = g >> 4;
        const qb = b >> 4;
        const key = `${qr}_${qg}_${qb}`;
        const existing = bins.get(key);
        if (existing) {
            existing.rSum += r;
            existing.gSum += g;
            existing.bSum += b;
            existing.count++;
        } else {
            bins.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
        }
    }

    const sorted = Array.from(bins.values())
        .sort((a, b) => b.count - a.count)
        .map((bin) => {
            const r = Math.round(bin.rSum / bin.count);
            const g = Math.round(bin.gSum / bin.count);
            const b = Math.round(bin.bSum / bin.count);
            return { r, g, b, count: bin.count };
        });

    const chosen: { r: number; g: number; b: number; hex: string }[] = [];
    const minDistSq = 38 * 38;

    for (const cand of sorted) {
        if (chosen.length >= maxColors) break;
        const tooClose = chosen.some((c) => {
            const dr = c.r - cand.r;
            const dg = c.g - cand.g;
            const db = c.b - cand.b;
            return dr * dr + dg * dg + db * db < minDistSq;
        });
        if (!tooClose) {
            chosen.push({
                r: cand.r,
                g: cand.g,
                b: cand.b,
                hex: rgbToHex(cand.r, cand.g, cand.b),
            });
        }
    }

    return chosen;
}

export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '').trim();
    if (clean.length === 6) {
        const num = parseInt(clean, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255,
        };
    }
    return { r: 76, g: 175, b: 80 };
}

/**
 * Deterministic fast hash for per-pixel organic grass/foliage blade height variation.
 */
function bladeHash(x: number, y: number): number {
    let n = x * 374761393 + y * 668265263 + 918273;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

/**
 * Evaluates all enabled ColorHeightRules at pixel (x, y) with RGB in [0, 255].
 * Returns a signed height offset in [-1.5, +1.5] to add to the base heightmap value,
 * plus an optional override weight if the user wants color rules to dominate.
 */
export function evaluateColorHeightBoostAtPixel(
    r255: number,
    g255: number,
    b255: number,
    x: number,
    y: number,
    rules?: ColorHeightRule[]
): number {
    if (!rules || rules.length === 0) return 0;

    let totalDelta = 0;

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule.enabled) continue;

        const dr = r255 - rule.targetColor.r;
        const dg = g255 - rule.targetColor.g;
        const db = b255 - rule.targetColor.b;

        // Euclidean RGB distance normalized to [0, 100] (max RGB dist is ~441.67)
        const distPct = (Math.sqrt(dr * dr + dg * dg + db * db) / 441.673) * 100;
        const tol = Math.max(1, rule.tolerance ?? 28);
        const soft = Math.max(0, rule.softness ?? 15);
        const outerLimit = tol + soft;

        if (distPct >= outerLimit) continue;

        let matchWeight = 1.0;
        if (distPct > tol && soft > 0) {
            const t = (distPct - tol) / soft;
            // Smoothstep falloff
            matchWeight = 1.0 - t * t * (3 - 2 * t);
        }

        // Height offset normalized from [-100, +100] -> [-1.0, +1.0]
        let ruleEffect = (rule.heightOffset / 100) * matchWeight;

        // Optional Grass / Blade Spikes Noise inside the matched color region
        if (rule.bladeNoise && rule.bladeNoise > 0) {
            const noiseAmt = (rule.bladeNoise / 100) * matchWeight;
            // Combine pixel-level blade tips with 2px clump tips
            const fineBlade = bladeHash(x, y);
            const clumpBlade = bladeHash(x >> 1, y >> 1);
            const spike = Math.pow(fineBlade * 0.65 + clumpBlade * 0.35, 1.5); // 0..1 spiky distribution
            if (rule.heightOffset >= 0) {
                ruleEffect += spike * noiseAmt * 0.65;
            } else {
                ruleEffect -= spike * noiseAmt * 0.65;
            }
        }

        totalDelta += ruleEffect;
    }

    return totalDelta;
}
