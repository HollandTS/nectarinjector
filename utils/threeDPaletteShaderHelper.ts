import * as THREE from 'three';
import { getLoadedPalette } from './paletteViewerHelper';
import { loadDefaultPalette, PaletteColor } from './westwoodPaletteParser';

let cachedPaletteTexture: THREE.DataTexture | null = null;
let cachedPaletteRef: PaletteColor[] | null = null;

/**
 * Ensures the default palette is pre-loaded in the background so 3D shader quantization
 * has a 256-color Westwood palette available even before a custom .pal is uploaded.
 */
let defaultPalLoaded: PaletteColor[] | null = null;
loadDefaultPalette().then((pal) => {
    defaultPalLoaded = pal;
}).catch(() => {});

/**
 * Returns a 256x1 THREE.DataTexture (SRGBColorSpace, NearestFilter) containing the
 * active loaded .pal (or fallback Westwood terrain palette) for GPU fragment quantization.
 */
export function getThreeDPaletteTexture(): THREE.DataTexture | null {
    const pal = getLoadedPalette() || defaultPalLoaded;
    if (!pal || pal.length === 0) {
        // Trigger async load if not yet ready
        loadDefaultPalette().then((loaded) => {
            defaultPalLoaded = loaded;
        }).catch(() => {});
        return null;
    }

    if (cachedPaletteTexture && cachedPaletteRef === pal) {
        return cachedPaletteTexture;
    }

    const count = 256;
    const data = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
        const c = pal[i] || { r: 0, g: 0, b: 0 };
        data[i * 4] = Math.max(0, Math.min(255, Math.round(c.r)));
        data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(c.g)));
        data[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(c.b)));
        data[i * 4 + 3] = 255;
    }

    if (cachedPaletteTexture) {
        cachedPaletteTexture.dispose();
    }

    const tex = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    cachedPaletteTexture = tex;
    cachedPaletteRef = pal;
    return tex;
}

/**
 * GLSL helper function and final output replacement that snaps the final lit 3D fragment
 * color (including lighting, shadows, cliff/slope blending, and dark spots) to the nearest
 * color in the 256-color Westwood .pal texture in sRGB perceptual space.
 */
export const THREE_D_PALETTE_GLSL_DEFS = `
uniform float uPaletteViewerActive;
uniform sampler2D uPaletteLUT;

vec3 quantizeToWestwoodPalette(vec3 linearCol) {
    // Convert linear working color to sRGB [0, 1] to match 8-bit .pal entries
    vec3 srgb = clamp(pow(max(linearCol, vec3(0.0)), vec3(1.0 / 2.2)), 0.0, 1.0);
    float bestDist = 1e9;
    vec3 bestSrgb = srgb;
    // Skip index 0 (transparent background color in Westwood .pal)
    for (int i = 1; i < 256; i++) {
        float u = (float(i) + 0.5) / 256.0;
        // uPaletteLUT has SRGBColorSpace so texture2D returns linear RGB; convert to sRGB for exact Euclidean RGB match
        vec3 palLin = texture2D(uPaletteLUT, vec2(u, 0.5)).rgb;
        vec3 palSrgb = clamp(pow(max(palLin, vec3(0.0)), vec3(1.0 / 2.2)), 0.0, 1.0);
        vec3 diff = srgb - palSrgb;
        float d = dot(diff, diff);
        if (d < bestDist) {
            bestDist = d;
            bestSrgb = palSrgb;
        }
    }
    // Convert quantized sRGB back to linear for Three.js output pipeline
    return pow(bestSrgb, vec3(2.2));
}
`;
