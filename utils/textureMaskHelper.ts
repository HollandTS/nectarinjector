import { colorDistance } from './colorUtils';
import type { RgbaColor } from '../types';

export interface MaskMatchResult {
    matchedGroupIdx: number;
    featherWeight: number; // 0 to 1
}

/**
 * Matches a base pixel color against configured mask groups with soft edge feathering.
 * Prevents gritty, pixelated artifacts caused by harsh binary threshold cutoffs.
 */
export const matchMaskGroupWithFeather = (
    baseR: number,
    baseG: number,
    baseB: number,
    groups: Array<{ colors: Array<RgbaColor>, tolVal: number }>,
    globalMode: boolean,
    isSmartOverlay: boolean = false
): MaskMatchResult => {
    // If global mode, or no groups have colors:
    const hasAnyColors = groups.some(g => g.colors && g.colors.length > 0);
    if (globalMode || !hasAnyColors) {
        return { matchedGroupIdx: 0, featherWeight: 1.0 };
    }

    const baseColor = { r: baseR, g: baseG, b: baseB };
    let bestGroupIdx = -1;
    let bestDistanceRatio = Infinity;
    let bestTolVal = 0;
    let bestDist = Infinity;

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
        const group = groups[gIdx];
        if (!group.colors || group.colors.length === 0) continue;

        const effectiveThreshold = Math.max(2, group.tolVal);
        for (let cIdx = 0; cIdx < group.colors.length; cIdx++) {
            const c = group.colors[cIdx];
            const d = colorDistance(c, baseColor);
            if (d <= effectiveThreshold) {
                const ratio = d / Math.max(1, effectiveThreshold);
                if (ratio < bestDistanceRatio) {
                    bestDistanceRatio = ratio;
                    bestGroupIdx = gIdx;
                    bestTolVal = group.tolVal;
                    bestDist = d;
                }
            }
        }
    }

    if (bestGroupIdx === -1) {
        return { matchedGroupIdx: -1, featherWeight: 0 };
    }

    // If tolerance is very low or zero, an exact/near-exact match is always 100% solid
    if (bestTolVal < 4) {
        return { matchedGroupIdx: bestGroupIdx, featherWeight: 1.0 };
    }

    // Soft edge transition over the outer 15% of the tolerance threshold
    const featherBand = Math.min(10, Math.max(2, bestTolVal * 0.15));
    const innerThreshold = bestTolVal - featherBand;

    let featherWeight = 1.0;
    if (bestDist > innerThreshold) {
        const t = Math.max(0, Math.min(1, (bestDist - innerThreshold) / featherBand));
        // Smooth cosine ease: 1.0 at inner threshold down to 0.0 at exact tolerance
        featherWeight = 0.5 + 0.5 * Math.cos(t * Math.PI);
    }

    return {
        matchedGroupIdx: bestGroupIdx,
        featherWeight: Math.max(0, Math.min(1, featherWeight))
    };
};
