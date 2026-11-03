import * as THREE from 'three';
import type { ThreeDCliffShapingSettings } from '../types';

export interface PackedCliffEmergeUniforms {
    /** (mixAmount [0..1], heightDissolve [0..1], heightThreshold [0..1], heightSharpness [0..1]) */
    emergeParams: THREE.Vector4;
    /** (heightInvert [0|1], bumpStrength [0..3], hasDepthMap [0|1], reserved) */
    bumpParams: THREE.Vector4;
}

export function packCliffEmergeUniforms(
    cliff: ThreeDCliffShapingSettings,
    hasDepthMap: boolean
): PackedCliffEmergeUniforms {
    const mixAmount = Math.max(0, Math.min(100, cliff.wallMixAmount ?? 100)) / 100;
    const heightDissolve = Math.max(0, Math.min(100, cliff.wallHeightDissolve ?? 75)) / 100;
    const heightThreshold = Math.max(0, Math.min(100, cliff.wallHeightThreshold ?? 65)) / 100;
    const heightSharpness = Math.max(0, Math.min(100, cliff.wallHeightSharpness ?? 65)) / 100;
    const heightInvert = cliff.wallHeightInvert ? 1.0 : 0.0;
    const bumpStrength = Math.max(0, Math.min(4, cliff.wallBumpStrength ?? 1.3));

    return {
        emergeParams: new THREE.Vector4(mixAmount, heightDissolve, heightThreshold, heightSharpness),
        bumpParams: new THREE.Vector4(heightInvert, bumpStrength, hasDepthMap ? 1.0 : 0.0, 0.0),
    };
}

/**
 * GLSL functions for height-map based cliff wall rock emergence, dissolve with the main ground texture,
 * and finite-difference height bump normals (zero mesh vertex deformation required).
 */
export const THREE_D_CLIFF_EMERGE_GLSL_CHUNK = `
uniform sampler2D uWallDepthMap;
uniform vec4 uWallEmergeParams; // x: mixAmount, y: heightDissolve, z: heightThreshold, w: heightSharpness
uniform vec4 uWallBumpParams;   // x: heightInvert, y: bumpStrength, z: hasDepthMap, w: reserved

float sampleWallHeightValue(vec2 uvOffset) {
    vec2 rep = uWallRepeat;
    vec2 off = uWallOffset + uvOffset;
    float h = 0.5;
    if (uWallBumpParams.z > 0.5) {
        h = sampleTriplanarOrUv(uWallDepthMap, uWallTriplanar, rep, off).r;
    } else if (uHasWallDiffuse > 0.5) {
        vec3 col = sampleTriplanarOrUv(uWallDiffuseMap, uWallTriplanar, rep, off).rgb;
        h = dot(col, vec3(0.299, 0.587, 0.114));
    }
    if (uWallBumpParams.x > 0.5) {
        h = 1.0 - h;
    }
    return clamp(h, 0.0, 1.0);
}

/**
 * Modulates the geometric cliff wall angle mask (\`baseCliffMask\`) using the wall heightmap / luminance
 * so high rocks emerge first out of the main dirt texture as \`heightThreshold\` increases from 0 -> 1.
 */
float computeEffectiveCliffEmergeMask(float baseCliffMask) {
    if (baseCliffMask <= 0.001) return 0.0;
    float mixAmt = uWallEmergeParams.x;
    float dissolveStrength = uWallEmergeParams.y;
    float emergeAmount = uWallEmergeParams.z;
    float sharpness = uWallEmergeParams.w;

    float combined = baseCliffMask * mixAmt;
    if (dissolveStrength <= 0.001 || (uWallBumpParams.z < 0.5 && uHasWallDiffuse < 0.5)) {
        return clamp(combined * emergeAmount, 0.0, 1.0);
    }

    float hVal = sampleWallHeightValue(vec2(0.0));
    float localDrive = clamp(baseCliffMask * emergeAmount * 1.18, 0.0, 1.0);
    float halfWidth = mix(0.42, 0.025, sharpness);
    float cutoff = 1.0 - localDrive;
    float heightMask = smoothstep(cutoff - halfWidth, cutoff + halfWidth, hVal);

    float linearMask = combined * emergeAmount;
    return clamp(mix(linearMask, heightMask * mixAmt * smoothstep(0.0, 0.12, baseCliffMask), dissolveStrength), 0.0, 1.0);
}

/**
 * Computes extra surface bump normal perturbation directly from the Wall Height / Depth map
 * (or diffuse luminance) so emerging cliff rocks have crisp 3D relief lighting without deforming the mesh.
 */
vec3 computeWallHeightBumpNormal() {
    float bumpStr = uWallBumpParams.y;
    if (bumpStr <= 0.001 || (uWallBumpParams.z < 0.5 && uHasWallDiffuse < 0.5)) {
        return vec3(0.0);
    }
    float eps = 0.0035;
    float hC = sampleWallHeightValue(vec2(0.0, 0.0));
    float hX = sampleWallHeightValue(vec2(eps, 0.0));
    float hY = sampleWallHeightValue(vec2(0.0, eps));
    float dX = (hC - hX) * bumpStr * 6.5;
    float dY = (hC - hY) * bumpStr * 6.5;
    return vec3(dX, dY, 0.0);
}
`;
