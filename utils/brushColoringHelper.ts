import { rgbToHsl, hslToRgb } from './colorUtils';

/**
 * Applies coloring adjustments (hue, contrast, brightness, saturation)
 * to target pixels weighted by the brush mask luminance and hardness.
 */
export function applyColoringToImageData(
    targetData: Uint8ClampedArray,
    maskData: Uint8ClampedArray,
    hardness: number,
    hueShift: number = 0,
    contrastPct: number = 100,
    brightnessPct: number = 100,
    saturationPct: number = 100
): void {
    const len = targetData.length;
    const conFactor = contrastPct / 100;
    const briFactor = brightnessPct / 100;
    const satFactor = saturationPct / 100;

    const hasHue = hueShift !== 0;
    const hasSat = satFactor !== 1;
    const hasBri = briFactor !== 1;
    const hasCon = conFactor !== 1;

    if (!hasHue && !hasSat && !hasBri && !hasCon) return;

    for (let i = 0; i < len; i += 4) {
        const mA = maskData[i + 3];
        if (mA === 0) continue;

        const tA = targetData[i + 3];
        if (tA === 0) continue;

        // Mask strength based on luminance and alpha of brush
        const maskLum = (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
        const weight = maskLum * (mA / 255) * hardness;
        if (weight <= 0) continue;

        const origR = targetData[i];
        const origG = targetData[i + 1];
        const origB = targetData[i + 2];

        // 1. Brightness & Contrast
        let r = origR;
        let g = origG;
        let b = origB;

        if (hasCon) {
            // Contrast around midpoint 128
            r = (r - 128) * conFactor + 128;
            g = (g - 128) * conFactor + 128;
            b = (b - 128) * conFactor + 128;
        }

        if (hasBri) {
            r = r * briFactor;
            g = g * briFactor;
            b = b * briFactor;
        }

        // Clamp before HSL
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        // 2. Hue & Saturation
        if (hasHue || hasSat) {
            let { h, s, l } = rgbToHsl(r, g, b);
            if (hasHue) {
                h = (h + hueShift + 360) % 360;
            }
            if (hasSat) {
                s = Math.min(100, Math.max(0, s * satFactor));
            }
            const converted = hslToRgb(h, s, l);
            r = converted.r;
            g = converted.g;
            b = converted.b;
        }

        // Blend between original pixel and adjusted pixel based on weight
        targetData[i] = Math.round(origR + (r - origR) * weight);
        targetData[i + 1] = Math.round(origG + (g - origG) * weight);
        targetData[i + 2] = Math.round(origB + (b - origB) * weight);
    }
}

/**
 * Directly adjusts the pixels of a rendered brush/SHP stamp canvas in Normal mode:
 * Hue (-180..180), Saturation (0..200%), Brightness (0..200%), and Transparency (0..100%).
 */
export function applyDirectColoringToStampCanvas(
    canvas: HTMLCanvasElement,
    hueShift: number = 0,
    saturationPct: number = 100,
    brightnessPct: number = 100,
    transparencyPct: number = 0
): void {
    const satFactor = saturationPct / 100;
    const briFactor = brightnessPct / 100;
    const alphaKeepFactor = Math.max(0, Math.min(1, 1 - transparencyPct / 100));

    const hasHue = hueShift !== 0;
    const hasSat = satFactor !== 1;
    const hasBri = briFactor !== 1;
    const hasTrans = alphaKeepFactor !== 1;

    if (!hasHue && !hasSat && !hasBri && !hasTrans) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;

        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        if (hasBri) {
            r = Math.min(255, Math.max(0, r * briFactor));
            g = Math.min(255, Math.max(0, g * briFactor));
            b = Math.min(255, Math.max(0, b * briFactor));
        }

        if (hasHue || hasSat) {
            let { h, s, l } = rgbToHsl(r, g, b);
            if (hasHue) {
                h = (h + hueShift + 360) % 360;
            }
            if (hasSat) {
                s = Math.min(100, Math.max(0, s * satFactor));
            }
            const converted = hslToRgb(h, s, l);
            r = converted.r;
            g = converted.g;
            b = converted.b;
        }

        data[i] = Math.round(r);
        data[i + 1] = Math.round(g);
        data[i + 2] = Math.round(b);
        if (hasTrans) {
            data[i + 3] = Math.max(0, Math.min(255, Math.round(a * alphaKeepFactor)));
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

