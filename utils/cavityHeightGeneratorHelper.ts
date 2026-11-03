import type { ColorHeightRule } from '../types';
import { evaluateColorHeightBoostAtPixel } from './colorHeightSculptHelper';

export type CavityHeightMode = 'hybrid_cavity' | 'binary_solid' | 'local_valley' | 'luminance_levels';

export interface CavityHeightGeneratorSettings {
    mode: CavityHeightMode;
    // Cavity / Seam Detection (Local Neighborhood Valley Comparison)
    cavitySensitivity: number;    // 0 to 100, default 65 (how strongly darker local grooves/seams are detected as cavities)
    cavityRadius: number;         // 1 to 16, default 4 (pixel radius of local neighborhood to detect panel seams vs broad shading)
    seamEdgeWeight: number;       // 0 to 100, default 45 (boosts dark groove edges / panel gaps using Sobel/Laplacian dark-edge detection)
    // Solid Black / White Thresholding & Levels
    blackThreshold: number;       // 0 to 100, default 42 (luminance / cavity cutoff below which pixels become solid black 0)
    transitionHardness: number;   // 0 to 100, default 85 (100 = crisp binary solid black/white, 0 = smooth gradient ramp)
    whiteClip: number;            // 10 to 100, default 75 (clamps upper plateau to pure solid white 255)
    contrast: number;             // 0 to 300, default 160
    brightness: number;           // -100 to 100, default 0
    gamma: number;                // 0.2 to 3.0, default 1.0
    // Morphological Cavity Shaping (Widen / Narrow Cavities & Clean Specks)
    cavityWidthOffset: number;    // -5 to 5, default 0 (+ = dilate/widen black cavities, - = erode/thin cavities)
    despeckle: number;            // 0 to 4, default 1 (removes tiny 1-2px surface noise specks on flat metal plates so plates stay pure white)
    bevelBlur: number;            // 0 to 10, default 0.5 (post-threshold bevel smoothing for sloped cavity walls if desired; 0 = razor sharp B&W)
    terracingSteps: number;       // 0 to 16, default 0 (0 = continuous/binary, 2 = pure binary B&W, 3+ = stepped mechanical depth tiers)
    invert: boolean;              // default false (Black = Deep Cavity -Y, White = High Surface +Y)
    syncNormalMap: boolean;       // default true (also update Normal Map from this synthesized cavity height map when applying)
    normalStrengthFromHeight: number; // 0.5 to 16, default 5.5
}

export const DEFAULT_CAVITY_HEIGHT_SETTINGS: CavityHeightGeneratorSettings = {
    mode: 'hybrid_cavity',
    cavitySensitivity: 68,
    cavityRadius: 4,
    seamEdgeWeight: 50,
    blackThreshold: 44,
    transitionHardness: 88,
    whiteClip: 72,
    contrast: 165,
    brightness: 0,
    gamma: 1.0,
    cavityWidthOffset: 0,
    despeckle: 1,
    bevelBlur: 0.0,
    terracingSteps: 0,
    invert: false,
    syncNormalMap: true,
    normalStrengthFromHeight: 5.5,
};

export const MECHANICAL_CAVITY_PRESETS: {
    id: string;
    name: string;
    description: string;
    settings: Partial<CavityHeightGeneratorSettings>;
}[] = [
    {
        id: 'solid_bw_cavities',
        name: 'Solid B&W Cavities',
        description: 'Pure white metal plates with crisp solid black recessed cavities & panel seams',
        settings: {
            mode: 'hybrid_cavity',
            cavitySensitivity: 72,
            cavityRadius: 4,
            seamEdgeWeight: 55,
            blackThreshold: 45,
            transitionHardness: 95,
            whiteClip: 68,
            contrast: 180,
            brightness: 5,
            gamma: 1.0,
            cavityWidthOffset: 0,
            despeckle: 1,
            bevelBlur: 0,
            terracingSteps: 0,
            invert: false,
        },
    },
    {
        id: 'deep_panel_seams',
        name: 'Deep Panel Seams',
        description: 'Targets narrow dark mechanical joints, rivets, and vents while flattening surface rust',
        settings: {
            mode: 'local_valley',
            cavitySensitivity: 85,
            cavityRadius: 3,
            seamEdgeWeight: 70,
            blackThreshold: 40,
            transitionHardness: 92,
            whiteClip: 65,
            contrast: 200,
            brightness: 10,
            gamma: 0.9,
            cavityWidthOffset: 1,
            despeckle: 2,
            bevelBlur: 0,
            terracingSteps: 0,
            invert: false,
        },
    },
    {
        id: 'beveled_armor_plates',
        name: 'Beveled Armor Plates',
        description: 'Solid white plates and black cavities with a micro-bevel ramp on cavity walls for 3D extrusion',
        settings: {
            mode: 'hybrid_cavity',
            cavitySensitivity: 68,
            cavityRadius: 5,
            seamEdgeWeight: 45,
            blackThreshold: 44,
            transitionHardness: 80,
            whiteClip: 74,
            contrast: 165,
            brightness: 0,
            gamma: 1.0,
            cavityWidthOffset: 0,
            despeckle: 1,
            bevelBlur: 1.2,
            terracingSteps: 0,
            invert: false,
        },
    },
    {
        id: 'stepped_mech_tiers',
        name: '3-Tier Mech Depth',
        description: 'Quantizes height into 3 crisp mechanical depth levels (White Top, Mid Recess, Black Abyss)',
        settings: {
            mode: 'hybrid_cavity',
            cavitySensitivity: 60,
            cavityRadius: 6,
            seamEdgeWeight: 40,
            blackThreshold: 38,
            transitionHardness: 65,
            whiteClip: 82,
            contrast: 150,
            brightness: 0,
            gamma: 1.0,
            cavityWidthOffset: 0,
            despeckle: 1,
            bevelBlur: 0,
            terracingSteps: 3,
            invert: false,
        },
    },
];

function loadImg(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function computeToroidalBoxBlur(
    src: Float32Array,
    w: number,
    h: number,
    radius: number
): Float32Array {
    const r = Math.max(1, Math.round(radius));
    const temp = new Float32Array(w * h);
    const dst = new Float32Array(w * h);
    const inv = 1 / (2 * r + 1);

    // Horizontal pass with toroidal wrap
    for (let y = 0; y < h; y++) {
        const rowOffset = y * w;
        let sum = 0;
        for (let k = -r; k <= r; k++) {
            const cx = ((k % w) + w) % w;
            sum += src[rowOffset + cx];
        }
        temp[rowOffset] = sum * inv;
        for (let x = 1; x < w; x++) {
            const removeX = (((x - r - 1) % w) + w) % w;
            const addX = (((x + r) % w) + w) % w;
            sum += src[rowOffset + addX] - src[rowOffset + removeX];
            temp[rowOffset + x] = sum * inv;
        }
    }

    // Vertical pass with toroidal wrap
    for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -r; k <= r; k++) {
            const cy = ((k % h) + h) % h;
            sum += temp[cy * w + x];
        }
        dst[x] = sum * inv;
        for (let y = 1; y < h; y++) {
            const removeY = (((y - r - 1) % h) + h) % h;
            const addY = (((y + r) % h) + h) % h;
            sum += temp[addY * w + x] - temp[removeY * w + x];
            dst[y * w + x] = sum * inv;
        }
    }

    return dst;
}

/**
 * Applies morphological dilation/erosion on dark cavities.
 * Positive offset widens dark cavities (min filter on height); negative offset narrows cavities (max filter on height).
 */
function applyMorphologicalCavityOffset(
    heights: Float32Array,
    w: number,
    h: number,
    offsetSteps: number
): Float32Array {
    const steps = Math.round(offsetSteps);
    if (steps === 0) return heights;

    const isWidenCavity = steps > 0; // Widen black cavities = min filter on height
    const count = Math.min(5, Math.abs(steps));
    let current: Float32Array = heights;

    for (let iter = 0; iter < count; iter++) {
        const next = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            const ym1 = ((y - 1) + h) % h;
            const yp1 = (y + 1) % h;
            for (let x = 0; x < w; x++) {
                const xm1 = ((x - 1) + w) % w;
                const xp1 = (x + 1) % w;

                const c = current[y * w + x];
                const l = current[y * w + xm1];
                const r = current[y * w + xp1];
                const u = current[ym1 * w + x];
                const d = current[yp1 * w + x];
                const ul = current[ym1 * w + xm1];
                const ur = current[ym1 * w + xp1];
                const dl = current[yp1 * w + xm1];
                const dr = current[yp1 * w + xp1];

                if (isWidenCavity) {
                    const crossMin = Math.min(c, l, r, u, d);
                    const diagMin = Math.min(crossMin, ul, ur, dl, dr);
                    next[y * w + x] = crossMin * 0.65 + diagMin * 0.35;
                } else {
                    const crossMax = Math.max(c, l, r, u, d);
                    const diagMax = Math.max(crossMax, ul, ur, dl, dr);
                    next[y * w + x] = crossMax * 0.65 + diagMax * 0.35;
                }
            }
        }
        current = next;
    }

    return current;
}

/**
 * Despeckles isolated 1-2px dark grit/rust specks on bright flat surfaces so mechanical plates stay solid white.
 */
function applyPlateDespeckle(
    heights: Float32Array,
    w: number,
    h: number,
    passes: number
): Float32Array {
    if (passes <= 0) return heights;
    let current: Float32Array = heights;

    for (let p = 0; p < passes; p++) {
        const next = new Float32Array(w * h);
        const neigh = new Float32Array(9);
        for (let y = 0; y < h; y++) {
            const ym1 = ((y - 1) + h) % h;
            const yp1 = (y + 1) % h;
            for (let x = 0; x < w; x++) {
                const xm1 = ((x - 1) + w) % w;
                const xp1 = (x + 1) % w;

                neigh[0] = current[ym1 * w + xm1];
                neigh[1] = current[ym1 * w + x];
                neigh[2] = current[ym1 * w + xp1];
                neigh[3] = current[y * w + xm1];
                neigh[4] = current[y * w + x];
                neigh[5] = current[y * w + xp1];
                neigh[6] = current[yp1 * w + xm1];
                neigh[7] = current[yp1 * w + x];
                neigh[8] = current[yp1 * w + xp1];

                // Partial insertion sort to find median & 6th-highest neighbor (closing small dark specks)
                for (let i = 1; i < 9; i++) {
                    const v = neigh[i];
                    let j = i - 1;
                    while (j >= 0 && neigh[j] > v) {
                        neigh[j + 1] = neigh[j];
                        j--;
                    }
                    neigh[j + 1] = v;
                }

                // Blend between median (index 4) and upper-median (index 5) to fill tiny rust pits while preserving real seams
                const center = current[y * w + x];
                const median = neigh[4];
                if (median > center + 0.18) {
                    next[y * w + x] = median;
                } else {
                    next[y * w + x] = center * 0.4 + median * 0.6;
                }
            }
        }
        current = next;
    }

    return current;
}

/**
 * Generates a dedicated Cavity / Solid Black & White Height Map from an image element.
 */
export function generateCavityHeightMapCanvasFromImg(
    img: HTMLImageElement,
    w: number,
    h: number,
    settings: CavityHeightGeneratorSettings,
    colorRules?: ColorHeightRule[],
    colorBaseMix: number = 100
): { heightDataUrl: string; heights: Float32Array; alpha: Float32Array } {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!;
    srcCtx.drawImage(img, 0, 0, w, h);
    const rawData = srcCtx.getImageData(0, 0, w, h).data;

    const lum = new Float32Array(w * h);
    const alpha = new Float32Array(w * h);
    const activeRules = (colorRules || []).filter((r) => r.enabled);
    const baseMix = Math.max(0, Math.min(100, colorBaseMix)) / 100;

    for (let i = 0, p = 0; i < rawData.length; i += 4, p++) {
        const r255 = rawData[i];
        const g255 = rawData[i + 1];
        const b255 = rawData[i + 2];
        const r = r255 / 255;
        const g = g255 / 255;
        const b = b255 / 255;
        const a = rawData[i + 3] / 255;

        // Perceived luminance with slight min-channel weighting so dark crevices/shadows register strongly
        const stdLum = 0.299 * r + 0.587 * g + 0.114 * b;
        const minChan = Math.min(r, g, b);
        let l = stdLum * 0.75 + minChan * 0.25;

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

    // 1. Compute local neighborhood average luminance for cavity / valley isolation
    const radius = Math.max(1, Math.min(20, Math.round(settings.cavityRadius || 4)));
    const localMean = computeToroidalBoxBlur(lum, w, h, radius);
    const wideMean = computeToroidalBoxBlur(localMean, w, h, Math.max(2, radius * 2));

    const cavitySens = Math.max(0, Math.min(100, settings.cavitySensitivity ?? 68)) / 100;
    const seamWeight = Math.max(0, Math.min(100, settings.seamEdgeWeight ?? 50)) / 100;
    const contrast = Math.max(0, settings.contrast ?? 165) / 100;
    const brightness = (settings.brightness ?? 0) / 100;
    const gamma = Math.max(0.2, Math.min(3.0, settings.gamma ?? 1.0));
    const blackThresh = Math.max(0, Math.min(0.98, (settings.blackThreshold ?? 44) / 100));
    const whiteClip = Math.max(blackThresh + 0.02, Math.min(1.0, (settings.whiteClip ?? 72) / 100));
    const hardness = Math.max(0, Math.min(100, settings.transitionHardness ?? 88)) / 100;

    const sampleL = (x: number, y: number): number => {
        const cx = ((x % w) + w) % w;
        const cy = ((y % h) + h) % h;
        return lum[cy * w + cx];
    };

    let heights = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const l = lum[p];

            // Local valley depression: positive when pixel is darker than its local surrounding metal plate
            const diffFine = Math.max(0, localMean[p] - l);
            const diffWide = Math.max(0, wideMean[p] - l);
            const localValleyDepth = diffFine * 1.8 + diffWide * 1.1;

            // Dark-edge / seam crease detector (positive Laplacian where center is darker than neighbors)
            let seamCrease = 0;
            if (seamWeight > 0) {
                const nAvg =
                    0.25 *
                    (sampleL(x - 1, y) + sampleL(x + 1, y) + sampleL(x, y - 1) + sampleL(x, y + 1));
                seamCrease = Math.max(0, nAvg - l) * 3.2 * seamWeight;
            }

            let val: number;
            if (settings.mode === 'local_valley') {
                // Pure local cavity detector: flat plates become 1.0 regardless of broad brightness
                val = 1.0 - (localValleyDepth * (0.8 + cavitySens * 2.2) + seamCrease);
            } else if (settings.mode === 'luminance_levels') {
                // Direct luminance + seam boost
                val = l - seamCrease * 0.5;
            } else {
                // 'hybrid_cavity' or 'binary_solid': combines global dark cavity detection + local seam isolation
                const flatPlateBoost = l + (1.0 - localMean[p]) * cavitySens * 0.55;
                val = flatPlateBoost - localValleyDepth * cavitySens * 2.1 - seamCrease;
            }

            // Gamma & Contrast/Brightness shaping
            val = Math.max(0, Math.min(1, val));
            if (gamma !== 1.0) {
                val = Math.pow(val, gamma);
            }
            val = (val - 0.5) * contrast + 0.5 + brightness;

            // Level clamping between blackThreshold and whiteClip
            let norm = (val - blackThresh) / Math.max(0.005, whiteClip - blackThresh);
            norm = Math.max(0, Math.min(1, norm));

            // Transition Hardness: blends between smooth ramp (0%) and crisp binary solid B&W step (100%)
            if (settings.mode === 'binary_solid' || hardness >= 0.99) {
                norm = norm >= 0.5 ? 1.0 : 0.0;
            } else if (hardness > 0) {
                // Steepened sigmoid / smoothstep around 0.5
                const band = Math.max(0.005, (1.0 - hardness) * 0.5);
                const t = Math.max(0, Math.min(1, (norm - (0.5 - band)) / (2 * band)));
                norm = t * t * (3 - 2 * t);
            }

            heights[p] = norm;
        }
    }

    // 2. Despeckle surface grit so mechanical plates stay solid white
    if (settings.despeckle > 0) {
        heights = applyPlateDespeckle(heights, w, h, Math.round(settings.despeckle));
    }

    // 3. Morphological Cavity Width Offset (Dilate / Erode black cavities)
    if (settings.cavityWidthOffset !== 0) {
        heights = applyMorphologicalCavityOffset(heights, w, h, settings.cavityWidthOffset);
    }

    // 4. Optional Post-Threshold Bevel Blur (creates smooth angled walls on solid cavities)
    if (settings.bevelBlur > 0) {
        const blurPasses = Math.max(1, Math.round(settings.bevelBlur));
        heights = computeToroidalBoxBlur(heights, w, h, blurPasses);
    }

    // 5. Optional Terracing / Stepped Mechanical Depth Tiers & Invert
    const steps = Math.round(settings.terracingSteps || 0);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d')!;
    const outImg = outCtx.createImageData(w, h);
    const dst = outImg.data;

    for (let i = 0; i < w * h; i++) {
        let hVal = heights[i];
        if (steps >= 2) {
            hVal = Math.round(hVal * (steps - 1)) / (steps - 1);
        }
        if (settings.invert) {
            hVal = 1.0 - hVal;
        }
        hVal *= alpha[i];
        heights[i] = hVal;

        const byteVal = Math.max(0, Math.min(255, Math.round(hVal * 255)));
        const idx = i * 4;
        dst[idx] = byteVal;
        dst[idx + 1] = byteVal;
        dst[idx + 2] = byteVal;
        dst[idx + 3] = 255;
    }

    outCtx.putImageData(outImg, 0, 0);
    return {
        heightDataUrl: outCanvas.toDataURL('image/png'),
        heights,
        alpha,
    };
}

/**
 * Generates a Tangent-Space Normal Map directly from the synthesized Cavity Height array.
 */
export function generateNormalMapFromHeightBuffer(
    heights: Float32Array,
    alpha: Float32Array,
    w: number,
    h: number,
    strength: number = 5.5
): string {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const out = ctx.createImageData(w, h);
    const dst = out.data;

    const sampleH = (x: number, y: number): number => {
        const cx = ((x % w) + w) % w;
        const cy = ((y % h) + h) % h;
        return heights[cy * w + cx];
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

            const tl = sampleH(x - 1, y - 1);
            const tc = sampleH(x, y - 1);
            const tr = sampleH(x + 1, y - 1);
            const ml = sampleH(x - 1, y);
            const mr = sampleH(x + 1, y);
            const bl = sampleH(x - 1, y + 1);
            const bc = sampleH(x, y + 1);
            const br = sampleH(x + 1, y + 1);

            const dX = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
            const dY = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

            let nx = -dX * strength;
            let ny = dY * strength;
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

export async function generateCavityHeightMapFromUrl(
    sourceUrl: string,
    settings: CavityHeightGeneratorSettings,
    maxRes: number = 512,
    colorRules?: ColorHeightRule[],
    colorBaseMix: number = 100
): Promise<{ heightDataUrl: string; normalDataUrl?: string } | null> {
    const img = await loadImg(sourceUrl);
    if (!img) return null;

    const aspect = img.width / (img.height || 1);
    const w = aspect >= 1 ? Math.min(maxRes, img.width) : Math.max(32, Math.round(Math.min(maxRes, img.height) * aspect));
    const h = aspect >= 1 ? Math.max(32, Math.round(w / aspect)) : Math.min(maxRes, img.height);

    const { heightDataUrl, heights, alpha } = generateCavityHeightMapCanvasFromImg(
        img,
        w,
        h,
        settings,
        colorRules,
        colorBaseMix
    );

    let normalDataUrl: string | undefined;
    if (settings.syncNormalMap) {
        normalDataUrl = generateNormalMapFromHeightBuffer(
            heights,
            alpha,
            w,
            h,
            settings.normalStrengthFromHeight || 5.5
        );
    }

    return { heightDataUrl, normalDataUrl };
}
