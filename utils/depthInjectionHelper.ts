import { rgbToHsl, hslToRgb } from './colorUtils';
import type { DepthFilterSettings } from '../types';

export interface DepthPixelParams {
    r: number;
    g: number;
    b: number;
    depthPixels: Uint8ClampedArray;
    pixelIndex: number;
    depthSettings: DepthFilterSettings;
    isMaskMatch: boolean;
    refR: number;
    refG: number;
    refB: number;
}

/**
 * Calculates depth-shaded color while preserving the texture's true intrinsic colors and saturation.
 * Fixes overexposure/brightness blowout where depth lightness was improperly added to texture lightness.
 */
export function calculateDepthInjectedPixel(params: DepthPixelParams): { r: number; g: number; b: number } {
    const { r, g, b, depthPixels, pixelIndex: i, depthSettings, isMaskMatch, refR, refG, refB } = params;

    const da = depthPixels[i + 3];
    if (da === 0) {
        return { r, g, b };
    }

    const dr = depthPixels[i];
    const dg = depthPixels[i + 1];
    const db = depthPixels[i + 2];
    const depthHsl = rgbToHsl(dr, dg, db);

    // Apply Black/White levels to depth source
    let dl = depthHsl.l;
    if (depthSettings.invert) dl = 100 - dl;

    const black = depthSettings.blackLevel;
    const white = depthSettings.whiteLevel;
    if (white !== black) {
        dl = Math.max(0, Math.min(100, ((dl - black) / (white - black)) * 100));
    } else {
        dl = dl >= black ? 100 : 0;
    }

    // Apply Posterize to depth source
    if (depthSettings.posterize > 0) {
        const levels = Math.max(2, Math.round(20 * (1 - depthSettings.posterize / 100)));
        dl = Math.round(dl / (100 / (levels - 1))) * (100 / (levels - 1));
    }

    const mainHsl = rgbToHsl(r, g, b);

    let h = mainHsl.h;
    if (depthSettings.hueShift !== 0) {
        h = (h + depthSettings.hueShift + 360) % 360;
    }

    // Preserve texture's original saturation; only adjust if slider is explicitly moved from 100
    let s = mainHsl.s;
    if (depthSettings.saturationShift !== 100) {
        s = Math.max(0, Math.min(100, s * (depthSettings.saturationShift / 100)));
    }

    // Baseline lightness is the texture's true lightness
    let l = mainHsl.l;

    // Depth source provides shading / highlight delta around neutral midtone (50%).
    // When depth source is 'base' and this pixel was a masked color (e.g. flat white background key),
    // there is no 3D height variation, so depth offset is 0 to preserve true texture colors.
    const isBaseMaskKey = depthSettings.depthOverlayId === 'base' && isMaskMatch;
    if (!isBaseMaskKey) {
        const depthOffset = (dl - 50) * (depthSettings.contrast / 100);
        l = l + depthOffset;
    }

    if (depthSettings.valueShift !== 100) {
        l *= (depthSettings.valueShift / 100);
    }
    if (depthSettings.brightness !== 100) {
        l += (depthSettings.brightness - 100);
    }

    if (!isBaseMaskKey) {
        if (depthHsl.s < 20 && depthSettings.greyAdjustment !== 100) {
            l *= (depthSettings.greyAdjustment / 100);
        }
        if (depthHsl.h > 70 && depthHsl.h < 170 && depthSettings.greenAdjustment !== 100) {
            l *= (depthSettings.greenAdjustment / 100);
        }
        if (depthHsl.h > 10 && depthHsl.h < 50 && depthSettings.brownAdjustment !== 100) {
            l *= (depthSettings.brownAdjustment / 100);
        }

        // Apply Slope Compensation: adjust brightness for depth ranges
        if (depthSettings.slopeCompensation > 0) {
            const comp = depthSettings.slopeCompensation / 100;
            if (dl < 30) {
                l += (30 - dl) * comp * 0.5; // Brighten extreme shadows
            } else if (dl > 70) {
                l -= (dl - 70) * comp * 0.5; // Darken extreme highlights
            }
        }
    }

    // Apply Color Smoothness: blend with original texture lightness
    if (depthSettings.colorSmoothness > 0) {
        const smooth = depthSettings.colorSmoothness / 100;
        l = l * (1 - smooth) + mainHsl.l * smooth;
    }

    l = Math.max(0, Math.min(100, l));
    const finalRgb = hslToRgb(h, s, l);

    // Apply Luminance Influence (only for non-mask reference pixels to prevent white wash)
    if (depthSettings.luminanceInfluence > 0 && !isMaskMatch && depthSettings.depthOverlayId !== 'base') {
        const influence = depthSettings.luminanceInfluence / 100;
        const origLum = (refR * 0.299 + refG * 0.587 + refB * 0.114) / 255;
        const lumShift = (origLum - 0.5) * 80 * influence;
        finalRgb.r = Math.max(0, Math.min(255, finalRgb.r + lumShift));
        finalRgb.g = Math.max(0, Math.min(255, finalRgb.g + lumShift));
        finalRgb.b = Math.max(0, Math.min(255, finalRgb.b + lumShift));
    }

    // Apply Depth Tolerance: if depth source is below tolerance, fade back to original texture
    let depthInfluence = 1.0;
    if (depthSettings.depthTolerance < 100 && dl < depthSettings.depthTolerance) {
        depthInfluence = dl / Math.max(1, depthSettings.depthTolerance);
    }

    const strength = (depthSettings.blendStrength / 100) * (da / 255) * depthInfluence;
    return {
        r: Math.round(r * (1 - strength) + finalRgb.r * strength),
        g: Math.round(g * (1 - strength) + finalRgb.g * strength),
        b: Math.round(b * (1 - strength) + finalRgb.b * strength)
    };
}
