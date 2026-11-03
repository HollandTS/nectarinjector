import type { ColorHeightRule } from '../types';
import { evaluateColorHeightBoostAtPixel } from './colorHeightSculptHelper';

export interface PbrGeneratorSettings {
    // Normal Map Settings
    normalEnabled: boolean;
    normalStrength: number;      // 0.2 to 20, default 4.0 (Sobel slope scale)
    normalBlur: number;          // 0 to 8, default 0.5 (pre-blur radius)
    normalDetailBoost: number;   // 0 to 100, default 35 (high-frequency micro-bump)
    normalInvertX: boolean;      // Flip R channel
    normalInvertY: boolean;      // Flip G channel (DirectX vs OpenGL)

    // Roughness Map Settings
    roughnessEnabled: boolean;
    roughnessBase: number;       // -100 to 100, default 10 (brightness offset)
    roughnessContrast: number;   // 0 to 300, default 130
    roughnessBlur: number;       // 0 to 8, default 0
    roughnessEdgeWear: number;   // 0 to 100, default 20 (cavity/edge roughness boost)
    roughnessInvert: boolean;    // default true (darker crevices = rougher / brighter in map)

    // Metallic Map Settings
    metallicEnabled: boolean;
    metallicBase: number;        // -100 to 100, default -40
    metallicContrast: number;    // 0 to 300, default 160
    metallicThreshold: number;   // 0 to 100, default 55 (luminance cutoff for metal highlights)
    metallicBlur: number;        // 0 to 8, default 0
    metallicInvert: boolean;     // default false

    // Displacement / Height Map Settings
    displacementEnabled: boolean;
    displacementContrast: number;   // 0 to 300, default 120
    displacementBrightness: number; // -100 to 100, default 0
    displacementBlur: number;       // 0 to 12, default 1.5
    displacementInvert: boolean;    // default false
}

export const DEFAULT_PBR_GENERATOR_SETTINGS: PbrGeneratorSettings = {
    normalEnabled: true,
    normalStrength: 4.0,
    normalBlur: 0.5,
    normalDetailBoost: 35,
    normalInvertX: false,
    normalInvertY: false,

    roughnessEnabled: true,
    roughnessBase: 10,
    roughnessContrast: 130,
    roughnessBlur: 0,
    roughnessEdgeWear: 20,
    roughnessInvert: true,

    metallicEnabled: true,
    metallicBase: -40,
    metallicContrast: 160,
    metallicThreshold: 55,
    metallicBlur: 0,
    metallicInvert: false,

    displacementEnabled: true,
    displacementContrast: 120,
    displacementBrightness: 0,
    displacementBlur: 1.5,
    displacementInvert: false,
};

function loadSourceImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function getLuminanceBuffer(
    img: HTMLImageElement,
    w: number,
    h: number,
    blurPx: number = 0,
    colorRules?: ColorHeightRule[],
    colorBaseMix: number = 100
): { lum: Float32Array; alpha: Float32Array } {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    if (blurPx > 0) {
        const pad = Math.min(Math.max(8, Math.ceil(blurPx * 3)), Math.floor(Math.min(w, h) / 2));
        const padded = document.createElement('canvas');
        padded.width = w + pad * 2;
        padded.height = h + pad * 2;
        const pCtx = padded.getContext('2d')!;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                pCtx.drawImage(img, pad + dx * w, pad + dy * h, w, h);
            }
        }
        const blurred = document.createElement('canvas');
        blurred.width = w + pad * 2;
        blurred.height = h + pad * 2;
        const bCtx = blurred.getContext('2d')!;
        bCtx.filter = `blur(${blurPx}px)`;
        bCtx.drawImage(padded, 0, 0);
        bCtx.filter = 'none';
        ctx.drawImage(blurred, pad, pad, w, h, 0, 0, w, h);
    } else {
        ctx.drawImage(img, 0, 0, w, h);
    }

    const data = ctx.getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    const alpha = new Float32Array(w * h);

    const activeRules = (colorRules || []).filter((r) => r.enabled);
    const baseMix = Math.max(0, Math.min(100, colorBaseMix)) / 100;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r255 = data[i];
        const g255 = data[i + 1];
        const b255 = data[i + 2];
        const r = r255 / 255;
        const g = g255 / 255;
        const b = b255 / 255;
        const a = data[i + 3] / 255;
        let l = 0.299 * r + 0.587 * g + 0.114 * b;

        if (activeRules.length > 0) {
            if (baseMix < 1) {
                l = 0.5 * (1 - baseMix) + l * baseMix;
            }
            const px = p % w;
            const py = (p / w) | 0;
            const colorDelta = evaluateColorHeightBoostAtPixel(r255, g255, b255, px, py, activeRules);
            l = Math.max(0, Math.min(1, l + colorDelta));
        }

        lum[p] = l;
        alpha[p] = a;
    }

    return { lum, alpha };
}

/**
 * Generates a tangent-space Normal Map (RGB) using a multi-scale Sobel operator
 * (combining smoothed macro-slopes + sharp micro-detail slopes) with toroidal border wrapping.
 */
export function generateNormalMapCanvas(
    img: HTMLImageElement,
    w: number,
    h: number,
    settings: PbrGeneratorSettings,
    colorRules?: ColorHeightRule[],
    colorBaseMix: number = 100
): string {
    const { lum: baseLum, alpha } = getLuminanceBuffer(img, w, h, settings.normalBlur, colorRules, colorBaseMix);
    const { lum: fineLum } =
        settings.normalDetailBoost > 0 && settings.normalBlur > 0
            ? getLuminanceBuffer(img, w, h, 0, colorRules, colorBaseMix)
            : { lum: baseLum };

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const strength = Math.max(0.1, settings.normalStrength);
    const detailMix = (settings.normalDetailBoost ?? 0) / 100;
    const signX = settings.normalInvertX ? -1 : 1;
    const signY = settings.normalInvertY ? 1 : -1; // Standard OpenGL tangent space: +Y is up

    // Toroidal modulo wrap so Sobel normals across opposite tile edges match seamlessly
    const sampleH = (buf: Float32Array, x: number, y: number): number => {
        const cx = ((x % w) + w) % w;
        const cy = ((y % h) + h) % h;
        return buf[cy * w + cx];
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const idx = p * 4;

            if (alpha[p] < 0.01) {
                dst[idx] = 128;
                dst[idx + 1] = 128;
                dst[idx + 2] = 255;
                dst[idx + 3] = 255;
                continue;
            }

            // 3x3 Sobel X and Y on base luminance
            const tl = sampleH(baseLum, x - 1, y - 1);
            const tc = sampleH(baseLum, x, y - 1);
            const tr = sampleH(baseLum, x + 1, y - 1);
            const ml = sampleH(baseLum, x - 1, y);
            const mr = sampleH(baseLum, x + 1, y);
            const bl = sampleH(baseLum, x - 1, y + 1);
            const bc = sampleH(baseLum, x, y + 1);
            const br = sampleH(baseLum, x + 1, y + 1);

            let dX = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
            let dY = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

            if (detailMix > 0 && fineLum !== baseLum) {
                const ftl = sampleH(fineLum, x - 1, y - 1);
                const ftc = sampleH(fineLum, x, y - 1);
                const ftr = sampleH(fineLum, x + 1, y - 1);
                const fml = sampleH(fineLum, x - 1, y);
                const fmr = sampleH(fineLum, x + 1, y);
                const fbl = sampleH(fineLum, x - 1, y + 1);
                const fbc = sampleH(fineLum, x, y + 1);
                const fbr = sampleH(fineLum, x + 1, y + 1);

                const fdX = (ftr + 2 * fmr + fbr) - (ftl + 2 * fml + fbl);
                const fdY = (fbl + 2 * fbc + fbr) - (ftl + 2 * ftc + ftr);

                dX = dX * (1 - detailMix * 0.5) + fdX * detailMix;
                dY = dY * (1 - detailMix * 0.5) + fdY * detailMix;
            }

            let nx = -dX * strength * signX;
            let ny = -dY * strength * signY;
            let nz = 1.0;

            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= len;
            ny /= len;
            nz /= len;

            dst[idx] = Math.max(0, Math.min(255, Math.round((nx * 0.5 + 0.5) * 255)));
            dst[idx + 1] = Math.max(0, Math.min(255, Math.round((ny * 0.5 + 0.5) * 255)));
            dst[idx + 2] = Math.max(128, Math.min(255, Math.round((nz * 0.5 + 0.5) * 255)));
            dst[idx + 3] = 255;
        }
    }

    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL('image/png');
}

/**
 * Generates a Roughness Map (Grayscale) where white = rough (matte) and black = smooth (glossy).
 */
export function generateRoughnessMapCanvas(
    img: HTMLImageElement,
    w: number,
    h: number,
    settings: PbrGeneratorSettings
): string {
    const { lum, alpha } = getLuminanceBuffer(img, w, h, settings.roughnessBlur);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const contrast = Math.max(0, settings.roughnessContrast) / 100;
    const baseOffset = (settings.roughnessBase ?? 0) / 100;
    const edgeWear = (settings.roughnessEdgeWear ?? 0) / 100;
    const invert = settings.roughnessInvert;

    const sampleL = (x: number, y: number): number => {
        const cx = ((x % w) + w) % w;
        const cy = ((y % h) + h) % h;
        return lum[cy * w + cx];
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const idx = p * 4;

            if (alpha[p] < 0.01) {
                dst[idx] = 255;
                dst[idx + 1] = 255;
                dst[idx + 2] = 255;
                dst[idx + 3] = 255;
                continue;
            }

            let val = invert ? 1.0 - lum[p] : lum[p];

            // Contrast & base offset
            val = (val - 0.5) * contrast + 0.5 + baseOffset;

            // Optional high-frequency edge/cavity roughness boost
            if (edgeWear > 0) {
                const lap =
                    Math.abs(4 * lum[p] - sampleL(x - 1, y) - sampleL(x + 1, y) - sampleL(x, y - 1) - sampleL(x, y + 1));
                val += lap * edgeWear * 2.5;
            }

            const byteVal = Math.max(0, Math.min(255, Math.round(val * 255)));
            dst[idx] = byteVal;
            dst[idx + 1] = byteVal;
            dst[idx + 2] = byteVal;
            dst[idx + 3] = 255;
        }
    }

    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL('image/png');
}

/**
 * Generates a Metallic Map (Grayscale) where white = metallic and black = dielectric/non-metal.
 */
export function generateMetallicMapCanvas(
    img: HTMLImageElement,
    w: number,
    h: number,
    settings: PbrGeneratorSettings
): string {
    const { lum, alpha } = getLuminanceBuffer(img, w, h, settings.metallicBlur);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const contrast = Math.max(0, settings.metallicContrast) / 100;
    const baseOffset = (settings.metallicBase ?? 0) / 100;
    const threshold = (settings.metallicThreshold ?? 50) / 100;
    const invert = settings.metallicInvert;

    for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        if (alpha[i] < 0.01) {
            dst[idx] = 0;
            dst[idx + 1] = 0;
            dst[idx + 2] = 0;
            dst[idx + 3] = 255;
            continue;
        }

        let val = invert ? 1.0 - lum[i] : lum[i];

        // Soft threshold curve around `threshold`
        val = (val - threshold) * contrast + 0.5 + baseOffset;

        const byteVal = Math.max(0, Math.min(255, Math.round(val * 255)));
        dst[idx] = byteVal;
        dst[idx + 1] = byteVal;
        dst[idx + 2] = byteVal;
        dst[idx + 3] = 255;
    }

    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL('image/png');
}

/**
 * Generates a Grayscale Displacement / Height Map where white = high (+Y) and black = low (-Y).
 */
export function generateDisplacementMapCanvas(
    img: HTMLImageElement,
    w: number,
    h: number,
    settings: PbrGeneratorSettings,
    colorRules?: ColorHeightRule[],
    colorBaseMix: number = 100
): string {
    const { lum, alpha } = getLuminanceBuffer(img, w, h, settings.displacementBlur, colorRules, colorBaseMix);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const contrast = Math.max(0, settings.displacementContrast) / 100;
    const brightness = (settings.displacementBrightness ?? 0) / 100;
    const invert = settings.displacementInvert;

    for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const a = alpha[i];
        let val = invert ? 1.0 - lum[i] : lum[i];
        val = ((val - 0.5) * contrast + 0.5 + brightness) * a;

        const byteVal = Math.max(0, Math.min(255, Math.round(val * 255)));
        dst[idx] = byteVal;
        dst[idx + 1] = byteVal;
        dst[idx + 2] = byteVal;
        dst[idx + 3] = 255;
    }

    ctx.putImageData(out, 0, 0);
    return canvas.toDataURL('image/png');
}

export interface GeneratedPbrSuite {
    normalMapUrl?: string;
    roughnessMapUrl?: string;
    metallicMapUrl?: string;
    displacementMapUrl?: string;
}

/**
 * Generates all enabled (or missing) PBR maps from the given diffuse texture source.
 */
export async function generatePbrMapsFromDiffuse(
    diffuseUrl: string,
    settings: PbrGeneratorSettings,
    maxRes: number = 512,
    colorRules?: ColorHeightRule[],
    colorBaseMix: number = 100
): Promise<GeneratedPbrSuite | null> {
    const img = await loadSourceImage(diffuseUrl);
    if (!img) return null;

    const aspect = img.width / (img.height || 1);
    const w = aspect >= 1 ? Math.min(maxRes, img.width) : Math.max(32, Math.round(Math.min(maxRes, img.height) * aspect));
    const h = aspect >= 1 ? Math.max(32, Math.round(w / aspect)) : Math.min(maxRes, img.height);

    const result: GeneratedPbrSuite = {};

    if (settings.normalEnabled) {
        result.normalMapUrl = generateNormalMapCanvas(img, w, h, settings, colorRules, colorBaseMix);
    }
    if (settings.roughnessEnabled) {
        result.roughnessMapUrl = generateRoughnessMapCanvas(img, w, h, settings);
    }
    if (settings.metallicEnabled) {
        result.metallicMapUrl = generateMetallicMapCanvas(img, w, h, settings);
    }
    if (settings.displacementEnabled) {
        result.displacementMapUrl = generateDisplacementMapCanvas(img, w, h, settings, colorRules, colorBaseMix);
    }

    return result;
}
