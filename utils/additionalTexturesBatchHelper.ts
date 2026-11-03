import type { ProjectOverlay, AdditionalTexture } from '../types';
import { splitTextureInFour } from './textureSplitter';
import { getAverageColorRgb, rgbToHsl } from './colorUtils';

/**
 * Splits both the main layer texture (`ov.src`) AND every existing additional matching texture
 * into 4 quadrants each.
 * - The 1st quadrant of the main image becomes the new main layer image, and its other 3 quadrants
 *   are added as additional matching textures.
 * - Each existing additional texture is replaced by its 4 quadrant cuts (preserving its weight,
 *   canvasZoom, and filter adjustments).
 */
export async function splitAllTexturesInFour(
    ov: ProjectOverlay
): Promise<{ newMainSrc: string; newAdditionalTextures: AdditionalTexture[] } | null> {
    if (!ov.src) return null;

    const f = ov.filters;
    const baseCanvasZoom = f.canvasZoom || 100;

    // 1. Split main layer image into 4
    const mainSplit = await splitTextureInFour(ov.src);
    if (!mainSplit) return null;

    const mainAdditionalCuts: AdditionalTexture[] = mainSplit.additionalCuts.map((cutSrc, idx) => ({
        id: `tex-main-${Date.now()}-${idx}`,
        src: cutSrc,
        weight: 50,
        canvasZoom: baseCanvasZoom,
        filters: {}
    }));

    // 2. Split each existing additional texture into 4 cuts
    const existingList = f.additionalTextures || [];
    const splitExistingLists = await Promise.all(
        existingList.map(async (tex, texIdx) => {
            if (!tex.src) return [tex];
            const split = await splitTextureInFour(tex.src);
            if (!split) return [tex];

            const allFourSrcs = [split.primaryCut, ...split.additionalCuts];
            return allFourSrcs.map((cutSrc, qIdx): AdditionalTexture => ({
                ...tex,
                id: `tex-${Date.now()}-${texIdx}-${qIdx}`,
                src: cutSrc,
                weight: tex.weight ?? 50,
                canvasZoom: tex.canvasZoom || baseCanvasZoom,
                filters: tex.filters ? { ...tex.filters } : {}
            }));
        })
    );

    const newAdditionalTextures: AdditionalTexture[] = [
        ...mainAdditionalCuts,
        ...splitExistingLists.flat()
    ];

    return {
        newMainSrc: mainSplit.primaryCut,
        newAdditionalTextures
    };
}

/**
 * Auto-matches the HSL (hue, saturation, brightness) of ALL additional matching textures
 * to match the average color of the main layer image (`ov.src`).
 */
export async function autoMatchAllAdditionalTextures(
    ov: ProjectOverlay
): Promise<AdditionalTexture[] | null> {
    if (!ov.src || !ov.filters.additionalTextures || ov.filters.additionalTextures.length === 0) {
        return null;
    }

    const targetAvg = await getAverageColorRgb(ov.src);
    const targetHsl = rgbToHsl(targetAvg.r, targetAvg.g, targetAvg.b);

    const updated = await Promise.all(
        ov.filters.additionalTextures.map(async (tex) => {
            if (!tex.src) return tex;
            try {
                const texAvg = await getAverageColorRgb(tex.src);
                const texHsl = rgbToHsl(texAvg.r, texAvg.g, texAvg.b);

                const hueDiff = targetHsl.h - texHsl.h;
                const satMult = targetHsl.s / (texHsl.s || 1);
                const briMult = targetHsl.l / (texHsl.l || 1);

                return {
                    ...tex,
                    filters: {
                        ...(tex.filters || {}),
                        hue: Math.round(hueDiff),
                        saturation: Math.round(Math.min(200, Math.max(0, 100 * satMult))),
                        brightness: Math.round(Math.min(200, Math.max(0, 100 * briMult)))
                    }
                };
            } catch {
                return tex;
            }
        })
    );

    return updated;
}

/**
 * Updates the Canvas Zoom (`canvasZoom`) on the main layer filter AND on every
 * additional matching texture simultaneously.
 */
export function applyCanvasZoomToAllTextures(
    ov: ProjectOverlay,
    zoomValue: number
): { canvasZoom: number; additionalTextures: AdditionalTexture[] } {
    const updatedAdditional = (ov.filters.additionalTextures || []).map((tex) => ({
        ...tex,
        canvasZoom: zoomValue
    }));

    return {
        canvasZoom: zoomValue,
        additionalTextures: updatedAdditional
    };
}
