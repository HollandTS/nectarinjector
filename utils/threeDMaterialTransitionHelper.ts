import * as THREE from 'three';
import type {
    ThreeDTransitionPairSettings,
    ThreeDMaterialTransitionSettings,
} from '../types';

export type MaterialTransitionPairKey = 'mainCliff' | 'mainSlope' | 'cliffSlope';

export const DEFAULT_TRANSITION_PAIR_SETTINGS: ThreeDTransitionPairSettings = {
    enabled: false,
    thickness: 28,
    softness: 45,
    mixBias: 0,
    brightness: 92,
    contrast: 110,
    tintColor: '#3b3026',
    tintMix: 25,
    strokeStrength: 35,
    strokeCount: 1,
    strokeSharpness: 55,
    noiseBreakup: 35,
    noiseScale: 6.0,
};

export const DEFAULT_MATERIAL_TRANSITION_SETTINGS: ThreeDMaterialTransitionSettings = {
    mainCliff: {
        ...DEFAULT_TRANSITION_PAIR_SETTINGS,
        tintColor: '#3b2e22',
    },
    mainSlope: {
        ...DEFAULT_TRANSITION_PAIR_SETTINGS,
        tintColor: '#353e27',
    },
    cliffSlope: {
        ...DEFAULT_TRANSITION_PAIR_SETTINGS,
        tintColor: '#2c2926',
    },
};

export interface TransitionStylePreset {
    id: string;
    name: string;
    subtitle: string;
    settings: Partial<ThreeDTransitionPairSettings>;
}

export const TRANSITION_STYLE_PRESETS: TransitionStylePreset[] = [
    {
        id: 'soft_blend',
        name: 'Smooth Seamless Blend',
        subtitle: 'Wide feathered mix with gentle organic noise',
        settings: {
            enabled: true,
            thickness: 38,
            softness: 75,
            mixBias: 0,
            brightness: 100,
            contrast: 100,
            tintMix: 12,
            strokeStrength: 0,
            strokeCount: 1,
            strokeSharpness: 30,
            noiseBreakup: 45,
            noiseScale: 5.5,
        },
    },
    {
        id: 'dark_seam_stroke',
        name: 'Crisp Dark Rim Stroke',
        subtitle: 'Defined dark border line along the material seam',
        settings: {
            enabled: true,
            thickness: 22,
            softness: 30,
            mixBias: 0,
            brightness: 72,
            contrast: 125,
            tintColor: '#1e1813',
            tintMix: 40,
            strokeStrength: 70,
            strokeCount: 1,
            strokeSharpness: 75,
            noiseBreakup: 30,
            noiseScale: 7.0,
        },
    },
    {
        id: 'strata_contour_lines',
        name: 'Multi-Stroke Contour Lines',
        subtitle: '3 stepped contour stroke rings across the border',
        settings: {
            enabled: true,
            thickness: 36,
            softness: 35,
            mixBias: 0,
            brightness: 84,
            contrast: 120,
            tintColor: '#2a221b',
            tintMix: 30,
            strokeStrength: 65,
            strokeCount: 3,
            strokeSharpness: 70,
            noiseBreakup: 25,
            noiseScale: 6.5,
        },
    },
    {
        id: 'bright_weathered_edge',
        name: 'Sunlit Weathered Lip',
        subtitle: 'Brightened dry edge highlight where surfaces meet',
        settings: {
            enabled: true,
            thickness: 26,
            softness: 45,
            mixBias: 10,
            brightness: 132,
            contrast: 115,
            tintColor: '#8c7a64',
            tintMix: 28,
            strokeStrength: 45,
            strokeCount: 1,
            strokeSharpness: 50,
            noiseBreakup: 40,
            noiseScale: 6.0,
        },
    },
];

export function resolveMaterialTransitionSettings(
    raw?: Partial<ThreeDMaterialTransitionSettings>
): ThreeDMaterialTransitionSettings {
    return {
        mainCliff: {
            ...DEFAULT_MATERIAL_TRANSITION_SETTINGS.mainCliff,
            ...(raw?.mainCliff || {}),
        },
        mainSlope: {
            ...DEFAULT_MATERIAL_TRANSITION_SETTINGS.mainSlope,
            ...(raw?.mainSlope || {}),
        },
        cliffSlope: {
            ...DEFAULT_MATERIAL_TRANSITION_SETTINGS.cliffSlope,
            ...(raw?.cliffSlope || {}),
        },
    };
}

function parseHexToVec3(hex: string | undefined): THREE.Vector3 {
    const clean = (hex || '#3b3026').replace('#', '');
    if (clean.length === 6) {
        const r = parseInt(clean.slice(0, 2), 16) / 255;
        const g = parseInt(clean.slice(2, 4), 16) / 255;
        const b = parseInt(clean.slice(4, 6), 16) / 255;
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            return new THREE.Vector3(r, g, b);
        }
    }
    return new THREE.Vector3(0.23, 0.19, 0.15);
}

/**
 * Packs a ThreeDTransitionPairSettings object into 3 compact Vector4 uniforms + 1 Vector3 tint color:
 * - ParamsA: (enabled: 0|1, thickness: 0.01..1, softness: 0..1, mixBias: -1..1)
 * - ParamsB: (brightness: 0..2.5, contrast: 0..2.5, tintMix: 0..1, strokeStrength: 0..1)
 * - ParamsC: (strokeCount: 1..8, strokeSharpness: 0..1, noiseBreakup: 0..1, noiseScale: 0.5..25)
 * - Tint:    vec3(r, g, b)
 */
export function packTransitionPairUniforms(pair: ThreeDTransitionPairSettings): {
    paramsA: THREE.Vector4;
    paramsB: THREE.Vector4;
    paramsC: THREE.Vector4;
    tint: THREE.Vector3;
} {
    return {
        paramsA: new THREE.Vector4(
            pair.enabled ? 1.0 : 0.0,
            Math.max(1, Math.min(100, pair.thickness ?? 28)) / 100,
            Math.max(0, Math.min(100, pair.softness ?? 45)) / 100,
            Math.max(-100, Math.min(100, pair.mixBias ?? 0)) / 100
        ),
        paramsB: new THREE.Vector4(
            Math.max(0, Math.min(250, pair.brightness ?? 92)) / 100,
            Math.max(0, Math.min(250, pair.contrast ?? 110)) / 100,
            Math.max(0, Math.min(100, pair.tintMix ?? 25)) / 100,
            Math.max(0, Math.min(100, pair.strokeStrength ?? 35)) / 100
        ),
        paramsC: new THREE.Vector4(
            Math.max(1, Math.min(8, Math.round(pair.strokeCount ?? 1))),
            Math.max(0, Math.min(100, pair.strokeSharpness ?? 55)) / 100,
            Math.max(0, Math.min(100, pair.noiseBreakup ?? 35)) / 100,
            Math.max(0.5, Math.min(25, pair.noiseScale ?? 6.0))
        ),
        tint: parseHexToVec3(pair.tintColor),
    };
}

/**
 * GLSL helper declarations and function for evaluating custom transition colors,
 * mix balance, brightness/contrast, tinting, and multi-contour stroke lines
 * wherever two 3D textures meet (Main ↔ Cliff, Main ↔ Slope, or Cliff ↔ Slope).
 */
export const THREE_D_TRANSITION_GLSL_CHUNK = `
    uniform vec4 uTransMC_A;
    uniform vec4 uTransMC_B;
    uniform vec4 uTransMC_C;
    uniform vec3 uTransMC_Tint;

    uniform vec4 uTransMS_A;
    uniform vec4 uTransMS_B;
    uniform vec4 uTransMS_C;
    uniform vec3 uTransMS_Tint;

    uniform vec4 uTransCS_A;
    uniform vec4 uTransCS_B;
    uniform vec4 uTransCS_C;
    uniform vec3 uTransCS_Tint;

    vec3 blendPairWithTransition(
        vec3 colA,
        vec3 colB,
        float rawMask,
        vec4 pA,
        vec4 pB,
        vec4 pC,
        vec3 tintCol,
        vec3 localPos,
        float triplanarUnit
    ) {
        if (pA.x < 0.5) {
            return mix(colA, colB, clamp(rawMask, 0.0, 1.0));
        }

        float thickness = max(0.02, pA.y);
        float softness = clamp(pA.z, 0.0, 1.0);
        float mixBias = clamp(pA.w, -0.95, 0.95);

        float brt = pB.x;
        float cnt = pB.y;
        float tintMix = clamp(pB.z, 0.0, 1.0);
        float strokeStr = clamp(pB.w, 0.0, 1.0);

        float strokeCnt = max(1.0, pC.x);
        float strokeSharp = clamp(pC.y, 0.0, 1.0);
        float noiseAmt = clamp(pC.z, 0.0, 1.0);
        float noiseFreq = max(0.5, pC.w);

        // Organic 3D noise breakup along the transition seam
        float n = 0.0;
        if (noiseAmt > 0.001) {
            vec3 np = localPos * triplanarUnit * noiseFreq;
            n = (slopeSpotNoise3D(np, 1.37) - 0.5) * 2.0 * noiseAmt * 0.32;
        }

        // Shift and reshape the blend mask across the transition band
        float m = clamp(rawMask + mixBias * 0.45 + n, 0.0, 1.0);
        float halfSpan = clamp(thickness * (0.35 + softness * 0.65), 0.01, 0.495);
        float shapedMask = smoothstep(0.5 - halfSpan, 0.5 + halfSpan, m);
        vec3 baseMixed = mix(colA, colB, shapedMask);

        // Compute normalized distance from the 0.5 boundary center (0 at seam center, 1 at outer edge)
        float distFromCenter = abs(m - 0.5) / max(0.015, thickness * 0.5);
        float edgeFade = mix(0.08, 0.55, softness);
        float bandWeight = 1.0 - smoothstep(1.0 - edgeFade, 1.0 + edgeFade * 0.35, distFromCenter);

        // Only apply inside true transition borders (where rawMask is between the two materials)
        float activeSeamGuard = smoothstep(0.002, 0.04, rawMask) * (1.0 - smoothstep(0.96, 0.998, rawMask));
        bandWeight *= activeSeamGuard;

        if (bandWeight > 0.001) {
            vec3 transCol = (baseMixed * brt - 0.5) * cnt + 0.5;
            transCol = clamp(transCol, 0.0, 1.0);
            transCol = mix(transCol, tintCol, tintMix);

            if (strokeStr > 0.001) {
                float phase = clamp(distFromCenter, 0.0, 1.0) * strokeCnt * 3.14159265;
                float wave = abs(cos(phase));
                float expPow = mix(1.2, 10.0, strokeSharp);
                float lineMask = pow(clamp(wave, 0.0, 1.0), expPow) * bandWeight;
                vec3 strokeTarget = mix(transCol * 0.35, tintCol, max(0.45, tintMix));
                transCol = mix(transCol, strokeTarget, lineMask * strokeStr);
            }

            return mix(baseMixed, clamp(transCol, 0.0, 1.0), bandWeight);
        }

        return baseMixed;
    }
`;
