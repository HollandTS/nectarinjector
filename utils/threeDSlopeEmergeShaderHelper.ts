import * as THREE from 'three';
import type { ThreeDSlopeShapingSettings } from '../types';

export interface PackedSlopeEmergeUniforms {
    /** (mixAmount [0..1], heightDissolve [0..1], heightThreshold [0..1], heightSharpness [0..1]) */
    emergeParams: THREE.Vector4;
    /** (heightInvert [0|1], bumpStrength [0..3], hasDepthMap [0|1], reserved) */
    bumpParams: THREE.Vector4;
}

export function packSlopeEmergeUniforms(
    slope: ThreeDSlopeShapingSettings,
    hasDepthMap: boolean
): PackedSlopeEmergeUniforms {
    const mixAmount = Math.max(0, Math.min(100, slope.slopeMixAmount ?? 100)) / 100;
    const heightDissolve = Math.max(0, Math.min(100, slope.slopeHeightDissolve ?? 75)) / 100;
    const heightThreshold = Math.max(0, Math.min(100, slope.slopeHeightThreshold ?? 60)) / 100;
    const heightSharpness = Math.max(0, Math.min(100, slope.slopeHeightSharpness ?? 65)) / 100;
    const heightInvert = slope.slopeHeightInvert ? 1.0 : 0.0;
    const bumpStrength = Math.max(0, Math.min(4, slope.slopeBumpStrength ?? 1.25));

    return {
        emergeParams: new THREE.Vector4(mixAmount, heightDissolve, heightThreshold, heightSharpness),
        bumpParams: new THREE.Vector4(heightInvert, bumpStrength, hasDepthMap ? 1.0 : 0.0, 0.0),
    };
}

/**
 * GLSL functions for height-map based slope rock emergence, dissolve with the main ground texture,
 * and finite-difference height bump normals (zero mesh vertex deformation required).
 */
export const THREE_D_SLOPE_EMERGE_GLSL_CHUNK = `
uniform sampler2D uSlopeDepthMap;
uniform vec4 uSlopeEmergeParams; // x: mixAmount, y: heightDissolve, z: heightThreshold, w: heightSharpness
uniform vec4 uSlopeBumpParams;   // x: heightInvert, y: bumpStrength, z: hasDepthMap, w: reserved

float sampleSlopeHeightValue(vec2 uvOffset) {
    vec2 rep = uSlopeRepeat;
    vec2 off = uSlopeOffset + uvOffset;
    float h = 0.5;
    if (uSlopeBumpParams.z > 0.5) {
        h = sampleTriplanarOrUv(uSlopeDepthMap, uSlopeTriplanar, rep, off).r;
    } else if (uHasSlopeDiffuse > 0.5) {
        vec3 col = sampleTriplanarOrUv(uSlopeDiffuseMap, uSlopeTriplanar, rep, off).rgb;
        h = dot(col, vec3(0.299, 0.587, 0.114));
    }
    if (uSlopeBumpParams.x > 0.5) {
        h = 1.0 - h;
    }
    return clamp(h, 0.0, 1.0);
}

/**
 * Modulates the geometric slope angle mask (\`baseRampMask\`) using the slope heightmap / luminance
 * so high rocks emerge first out of the main dirt texture as \`heightThreshold\` increases from 0 -> 1.
 */
float computeEffectiveSlopeEmergeMask(float baseRampMask) {
    if (baseRampMask <= 0.001) return 0.0;
    float mixAmt = uSlopeEmergeParams.x;
    float dissolveStrength = uSlopeEmergeParams.y;
    float emergeAmount = uSlopeEmergeParams.z;
    float sharpness = uSlopeEmergeParams.w;

    float combined = baseRampMask * mixAmt;
    if (dissolveStrength <= 0.001 || (uSlopeBumpParams.z < 0.5 && uHasSlopeDiffuse < 0.5)) {
        return clamp(combined * emergeAmount, 0.0, 1.0);
    }

    float hVal = sampleSlopeHeightValue(vec2(0.0));
    // Drive emergence from both the slope angle mask (so crest/toe feathers naturally dissolve via rock height)
    // and the user's "Rock Emerge Amount" slider (emergeAmount: 0 = pure dirt, 0.5 = rock peaks, 1.0 = full rock)
    float localDrive = clamp(baseRampMask * emergeAmount * 1.18, 0.0, 1.0);
    float halfWidth = mix(0.42, 0.025, sharpness);
    float cutoff = 1.0 - localDrive;
    float heightMask = smoothstep(cutoff - halfWidth, cutoff + halfWidth, hVal);

    float linearMask = combined * emergeAmount;
    return clamp(mix(linearMask, heightMask * mixAmt * smoothstep(0.0, 0.12, baseRampMask), dissolveStrength), 0.0, 1.0);
}

/**
 * Computes extra surface bump normal perturbation directly from the Slope Height / Depth map
 * (or diffuse luminance) so emerging rocks have crisp 3D relief lighting without deforming the mesh.
 */
vec3 computeSlopeHeightBumpNormal() {
    float bumpStr = uSlopeBumpParams.y;
    if (bumpStr <= 0.001 || (uSlopeBumpParams.z < 0.5 && uHasSlopeDiffuse < 0.5)) {
        return vec3(0.0);
    }
    float eps = 0.0035;
    float hC = sampleSlopeHeightValue(vec2(0.0, 0.0));
    float hX = sampleSlopeHeightValue(vec2(eps, 0.0));
    float hY = sampleSlopeHeightValue(vec2(0.0, eps));
    float dX = (hC - hX) * bumpStr * 6.5;
    float dY = (hC - hY) * bumpStr * 6.5;
    return vec3(dX, dY, 0.0);
}
`;
