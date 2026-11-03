import * as THREE from 'three';
import type {
    ThreeDCliffShapingSettings,
    ThreeDSlopeShapingSettings,
    ThreeDTextureSettings,
    ThreeDMaterialTransitionSettings,
} from '../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from './threeDCliffPresets';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from './threeDSlopePresets';
import { getThreeDPaletteTexture, THREE_D_PALETTE_GLSL_DEFS } from './threeDPaletteShaderHelper';
import {
    resolveMaterialTransitionSettings,
    packTransitionPairUniforms,
    THREE_D_TRANSITION_GLSL_CHUNK,
} from './threeDMaterialTransitionHelper';
import {
    packSlopeEmergeUniforms,
    THREE_D_SLOPE_EMERGE_GLSL_CHUNK,
} from './threeDSlopeEmergeShaderHelper';
import {
    packCliffEmergeUniforms,
    THREE_D_CLIFF_EMERGE_GLSL_CHUNK,
} from './threeDCliffEmergeShaderHelper';

export interface CliffWallTextures {
    wallDiffuse: THREE.Texture | null;
    wallNormal: THREE.Texture | null;
    wallRoughness: THREE.Texture | null;
    wallDepth?: THREE.Texture | null;
}

export interface SlopeSurfaceTextures {
    slopeDiffuse: THREE.Texture | null;
    slopeNormal: THREE.Texture | null;
    slopeRoughness: THREE.Texture | null;
    slopeDepth?: THREE.Texture | null;
}

/**
 * Configures repeat/wrap/filter settings on a secondary cliff or slope texture.
 */
export function configureCliffWallTexture(
    tex: THREE.Texture | null,
     _cliffOrSlope: ThreeDCliffShapingSettings | ThreeDSlopeShapingSettings,
    baseSettings: ThreeDTextureSettings
) {
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = baseSettings.magFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
    tex.minFilter = baseSettings.minFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    tex.anisotropy = baseSettings.anisotropy || 1;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
}

/**
 * Computes mesh local bounding box size and actual steep-wall Y bounds so triplanar projection and
 * top-ground plateau transition scale to the true vertical cliff wall height (even when the top
 * dirt plateau slopes upward behind the cliff lip).
 */
export function getMeshCliffBoundsInfo(
    mesh: THREE.Mesh,
    slopeThresholdDeg: number = 32
): {
    triplanarUnit: number;
    minY: number;
    maxY: number;
} {
    const baseGeo = (mesh.geometry.userData?.pristineGlbGeometry as THREE.BufferGeometry) || mesh.geometry;
    if (!baseGeo.boundingBox) {
        baseGeo.computeBoundingBox();
    }
    const bb = baseGeo.boundingBox;
    if (!bb) return { triplanarUnit: 1.0, minY: 0, maxY: 1 };
    const size = new THREE.Vector3();
    bb.getSize(size);
    const maxHoriz = Math.max(0.001, Math.max(size.x, size.z));
    const fullSpanY = Math.max(0.001, size.y);

    // Measure actual vertical extent of steep cliff-wall faces so top-ground transition
    // is anchored to the cliff lip rather than an elevated rear plateau.
    let wallMinY = Infinity;
    let wallMaxY = -Infinity;
    const posAttr = baseGeo.attributes.position as THREE.BufferAttribute | undefined;
    const normAttr = baseGeo.attributes.normal as THREE.BufferAttribute | undefined;
    if (posAttr && normAttr) {
        const cosThresh = Math.cos((Math.max(10, Math.min(80, slopeThresholdDeg)) * Math.PI) / 180);
        for (let i = 0; i < posAttr.count; i++) {
            const ny = Math.abs(normAttr.getY(i));
            if (ny <= cosThresh) {
                const vy = posAttr.getY(i);
                if (vy < wallMinY) wallMinY = vy;
                if (vy > wallMaxY) wallMaxY = vy;
            }
        }
    }

    const minY = isFinite(wallMinY) ? wallMinY : bb.min.y;
    const maxY = isFinite(wallMaxY) && wallMaxY > minY + 0.001 ? wallMaxY : Math.max(bb.min.y + 0.001, bb.max.y);
    const wallSpanY = Math.max(0.001, maxY - minY);

    // Scale triplanar unit so 1x repeat covers the cliff wall height cleanly without giant zoom
    const refScale = Math.max(0.001, Math.min(maxHoriz, Math.max(wallSpanY * 1.6, maxHoriz * 0.45, fullSpanY)));
    return {
        triplanarUnit: 1.0 / refScale,
        minY,
        maxY,
    };
}

function parseHexToVec3(hex: string | undefined): THREE.Vector3 {
    const clean = (hex || '#1f1914').replace('#', '');
    if (clean.length === 6) {
        const r = parseInt(clean.slice(0, 2), 16) / 255;
        const g = parseInt(clean.slice(2, 4), 16) / 255;
        const b = parseInt(clean.slice(4, 6), 16) / 255;
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            return new THREE.Vector3(r, g, b);
        }
    }
    return new THREE.Vector3(0.12, 0.1, 0.08);
}

/**
 * Applies base color/filter adjustments, Cliff Shaping (steep wall dual material + top ground transition),
 * AND Slope Shaping (inclined ramp angle-band dual material + dip darkening + procedural darker spots)
 * via MeshStandardMaterial's `onBeforeCompile`.
 */
export function applyMaterialAndCliffShader(
    mesh: THREE.Mesh,
    mat: THREE.Material,
    settings: ThreeDTextureSettings,
    cliffSettings?: ThreeDCliffShapingSettings,
    wallTextures?: CliffWallTextures,
    slopeSettings?: ThreeDSlopeShapingSettings,
    slopeTextures?: SlopeSurfaceTextures,
    paletteViewer: boolean = false,
    transitionSettings?: ThreeDMaterialTransitionSettings
) {
    const cliff: ThreeDCliffShapingSettings = {
        ...DEFAULT_CLIFF_SHAPING_SETTINGS,
        ...(cliffSettings || {}),
    };
    const slope: ThreeDSlopeShapingSettings = {
        ...DEFAULT_SLOPE_SHAPING_SETTINGS,
        ...(slopeSettings || {}),
    };
    const transitions = resolveMaterialTransitionSettings(transitionSettings);
    const transMC = packTransitionPairUniforms(transitions.mainCliff);
    const transMS = packTransitionPairUniforms(transitions.mainSlope);
    const transCS = packTransitionPairUniforms(transitions.cliffSlope);

    const brightness = (settings.brightness ?? 100) / 100;
    const contrast = (settings.contrast ?? 100) / 100;
    const saturation = (settings.saturation ?? 100) / 100;
    const hue = (settings.hue ?? 0) / 360;
    const sharpness = (settings.sharpness ?? 0) / 100;

    const hasWallDiffuse = !!(cliff.enabled && cliff.dualTextureEnabled && wallTextures?.wallDiffuse);
    const hasWallNormal = !!(cliff.enabled && cliff.dualTextureEnabled && wallTextures?.wallNormal);
    const hasWallRoughness = !!(cliff.enabled && cliff.dualTextureEnabled && wallTextures?.wallRoughness);
    const hasWallDepth = !!(cliff.enabled && cliff.dualTextureEnabled && wallTextures?.wallDepth);
    const cliffShaderActive = !!(
        cliff.enabled &&
        cliff.dualTextureEnabled &&
        (hasWallDiffuse || hasWallNormal || hasWallRoughness || hasWallDepth)
    );

    if (wallTextures?.wallDiffuse) configureCliffWallTexture(wallTextures.wallDiffuse, cliff, settings);
    if (wallTextures?.wallNormal) configureCliffWallTexture(wallTextures.wallNormal, cliff, settings);
    if (wallTextures?.wallRoughness) configureCliffWallTexture(wallTextures.wallRoughness, cliff, settings);
    if (wallTextures?.wallDepth) configureCliffWallTexture(wallTextures.wallDepth, cliff, settings);
    const packedCliffEmerge = packCliffEmergeUniforms(cliff, hasWallDepth);

    const hasSlopeDiffuse = !!(slope.enabled && slope.dualTextureEnabled && slopeTextures?.slopeDiffuse);
    const hasSlopeNormal = !!(slope.enabled && slope.dualTextureEnabled && slopeTextures?.slopeNormal);
    const hasSlopeRoughness = !!(slope.enabled && slope.dualTextureEnabled && slopeTextures?.slopeRoughness);
    const hasSlopeDepth = !!(slope.enabled && slope.dualTextureEnabled && slopeTextures?.slopeDepth);
    const hasSlopeDarkening = !!(
        slope.enabled &&
        slope.darkSpotsEnabled &&
        ((slope.dipDarkening ?? 0) > 0.5 || (slope.spotIntensity ?? 0) > 0.5)
    );
    const slopeShaderActive = !!(
        slope.enabled && (hasSlopeDiffuse || hasSlopeNormal || hasSlopeRoughness || hasSlopeDepth || hasSlopeDarkening)
    );

    if (slopeTextures?.slopeDiffuse) configureCliffWallTexture(slopeTextures.slopeDiffuse, slope, settings);
    if (slopeTextures?.slopeNormal) configureCliffWallTexture(slopeTextures.slopeNormal, slope, settings);
    if (slopeTextures?.slopeRoughness) configureCliffWallTexture(slopeTextures.slopeRoughness, slope, settings);
    if (slopeTextures?.slopeDepth) configureCliffWallTexture(slopeTextures.slopeDepth, slope, settings);

    const packedSlopeEmerge = packSlopeEmergeUniforms(slope, hasSlopeDepth);

    const boundsInfo = getMeshCliffBoundsInfo(mesh, cliff.slopeThreshold ?? 32);
    const triplanarUnit = boundsInfo.triplanarUnit;
    const degToRad = Math.PI / 180;

    // Cliff angle thresholds
    const threshDeg = cliff.slopeThreshold ?? 32;
    const featherDeg = Math.max(1, cliff.slopeFeather ?? 10);
    const cosHigh = Math.cos(Math.max(0, threshDeg - featherDeg * 0.5) * degToRad);
    const cosLow = Math.cos(Math.min(89.9, threshDeg + featherDeg * 0.5) * degToRad);
    const wallCoverageBoost = Math.max(0, Math.min(100, cliff.wallCoverageBoost ?? 45)) / 100;

    const repX = (cliff.wallScale ?? 1) * (cliff.wallRepeatX ?? 1);
    const repY = (cliff.wallScale ?? 1) * (cliff.wallRepeatY ?? 1);
    const offX = cliff.wallOffsetX ?? 0;
    const offY = cliff.wallOffsetY ?? 0;

    const topTrans = Math.max(0, Math.min(85, cliff.topGroundTransition ?? 8)) / 100;
    const topFeather = Math.max(0.5, Math.min(60, cliff.topGroundFeather ?? 8)) / 100;
    const topDrop = Math.max(-50, Math.min(50, cliff.topGroundDrop ?? 0)) / 100;
    const topNoise = Math.max(0, Math.min(100, cliff.topGroundNoise ?? 25)) / 100;

    // Slope angle-band thresholds (minAngle .. maxAngle)
    const sMinDeg = slope.minAngle ?? 8;
    const sMaxDeg = Math.max(sMinDeg + 2, slope.maxAngle ?? 55);
    const sFeatherDeg = Math.max(1, slope.feather ?? 12);
    // In cos(angle) space: smaller angle = larger cosine
    const sMinCosHigh = Math.cos(Math.max(0, sMinDeg - sFeatherDeg * 0.5) * degToRad);
    const sMinCosLow = Math.cos(Math.min(89.9, sMinDeg + sFeatherDeg * 0.5) * degToRad);
    const sMaxCosHigh = Math.cos(Math.max(0, sMaxDeg - sFeatherDeg * 0.5) * degToRad);
    const sMaxCosLow = Math.cos(Math.min(89.9, sMaxDeg + sFeatherDeg * 0.5) * degToRad);

    const sCrestTrans = Math.max(0, Math.min(75, slope.crestTransition ?? 0)) / 100;
    const sToeTrans = Math.max(0, Math.min(75, slope.toeTransition ?? 18)) / 100;
    const sTransFeather = Math.max(1, Math.min(50, slope.transitionFeather ?? 20)) / 100;
    const sTransNoise = Math.max(0, Math.min(100, slope.transitionNoise ?? 30)) / 100;

    const sRepX = (slope.slopeScale ?? 1) * (slope.slopeRepeatX ?? 1);
    const sRepY = (slope.slopeScale ?? 1) * (slope.slopeRepeatY ?? 1);
    const offSX = slope.slopeOffsetX ?? 0;
    const offSY = slope.slopeOffsetY ?? 0;
    const spotTintVec = parseHexToVec3(slope.spotTint);

    const palLutTex = paletteViewer ? getThreeDPaletteTexture() : null;
    const isPaletteActive = !!(paletteViewer && palLutTex);

    // Ensure custom vertex attributes exist on geometry so WebGL never sees missing/unmatched attribute bindings
    const geo = mesh.geometry;
    const posCount = geo?.attributes?.position?.count || 0;
    if (geo && posCount > 0) {
        if (!geo.attributes.aSlopeDipDepth || geo.attributes.aSlopeDipDepth.count !== posCount) {
            geo.setAttribute('aSlopeDipDepth', new THREE.BufferAttribute(new Float32Array(posCount), 1));
        }
        if (!geo.attributes.aCliffSlopeMask || geo.attributes.aCliffSlopeMask.count !== posCount) {
            geo.setAttribute('aCliffSlopeMask', new THREE.BufferAttribute(new Float32Array(posCount), 1));
        }
    }

    if (!mat.userData.shaderUniforms) {
        mat.userData.shaderUniforms = {
            uBrightness: { value: brightness },
            uContrast: { value: contrast },
            uSaturation: { value: saturation },
            uHue: { value: hue },
            uSharpness: { value: sharpness },
            // Cliff Dual-Material Uniforms
            uCliffActive: { value: cliffShaderActive ? 1.0 : 0.0 },
            uHasWallDiffuse: { value: hasWallDiffuse ? 1.0 : 0.0 },
            uHasWallNormal: { value: hasWallNormal ? 1.0 : 0.0 },
            uHasWallRoughness: { value: hasWallRoughness ? 1.0 : 0.0 },
            uWallDiffuseMap: { value: wallTextures?.wallDiffuse || null },
            uWallNormalMap: { value: wallTextures?.wallNormal || null },
            uWallRoughnessMap: { value: wallTextures?.wallRoughness || null },
            uWallDepthMap: { value: wallTextures?.wallDepth || null },
            uWallEmergeParams: { value: packedCliffEmerge.emergeParams },
            uWallBumpParams: { value: packedCliffEmerge.bumpParams },
            uCliffCosHigh: { value: cosHigh },
            uCliffCosLow: { value: cosLow },
            uCliffInvert: { value: cliff.invertSlopeMask ? 1.0 : 0.0 },
            uWallCoverageBoost: { value: wallCoverageBoost },
            uWallTriplanar: { value: cliff.wallTriplanar ? 1.0 : 0.0 },
            uTriplanarUnit: { value: triplanarUnit },
            uMeshMinY: { value: boundsInfo.minY },
            uMeshMaxY: { value: boundsInfo.maxY },
            uTopGroundTrans: { value: topTrans },
            uTopGroundFeather: { value: topFeather },
            uTopGroundDrop: { value: topDrop },
            uTopGroundNoise: { value: topNoise },
            uWallRepeat: { value: new THREE.Vector2(repX, repY) },
            uWallOffset: { value: new THREE.Vector2(offX, offY) },
            uWallBrightness: { value: (cliff.wallBrightness ?? 100) / 100 },
            uWallContrast: { value: (cliff.wallContrast ?? 100) / 100 },
            uWallSaturation: { value: (cliff.wallSaturation ?? 100) / 100 },
            uWallHue: { value: (cliff.wallHue ?? 0) / 360 },
            uWallRoughnessVal: { value: cliff.wallRoughness ?? 0.85 },
            uWallNormalScale: { value: cliff.wallNormalScale ?? 1.2 },
            // Slope Shaping & Dark Spots Uniforms
            uSlopeActive: { value: slopeShaderActive ? 1.0 : 0.0 },
            uHasSlopeDiffuse: { value: hasSlopeDiffuse ? 1.0 : 0.0 },
            uHasSlopeNormal: { value: hasSlopeNormal ? 1.0 : 0.0 },
            uHasSlopeRoughness: { value: hasSlopeRoughness ? 1.0 : 0.0 },
            uSlopeDiffuseMap: { value: slopeTextures?.slopeDiffuse || null },
            uSlopeNormalMap: { value: slopeTextures?.slopeNormal || null },
            uSlopeRoughnessMap: { value: slopeTextures?.slopeRoughness || null },
            uSlopeDepthMap: { value: slopeTextures?.slopeDepth || null },
            uSlopeEmergeParams: { value: packedSlopeEmerge.emergeParams },
            uSlopeBumpParams: { value: packedSlopeEmerge.bumpParams },
            uSlopeMinCosHigh: { value: sMinCosHigh },
            uSlopeMinCosLow: { value: sMinCosLow },
            uSlopeMaxCosHigh: { value: sMaxCosHigh },
            uSlopeMaxCosLow: { value: sMaxCosLow },
            uSlopeInvert: { value: slope.invertMask ? 1.0 : 0.0 },
            uSlopeCrestTrans: { value: sCrestTrans },
            uSlopeToeTrans: { value: sToeTrans },
            uSlopeTransFeather: { value: sTransFeather },
            uSlopeTransNoise: { value: sTransNoise },
            uSlopeTriplanar: { value: slope.slopeTriplanar ? 1.0 : 0.0 },
            uSlopeRepeat: { value: new THREE.Vector2(sRepX, sRepY) },
            uSlopeOffset: { value: new THREE.Vector2(offSX, offSY) },
            uSlopeBrightness: { value: (slope.slopeBrightness ?? 100) / 100 },
            uSlopeContrast: { value: (slope.slopeContrast ?? 100) / 100 },
            uSlopeSaturation: { value: (slope.slopeSaturation ?? 100) / 100 },
            uSlopeHue: { value: (slope.slopeHue ?? 0) / 360 },
            uSlopeRoughnessVal: { value: slope.slopeRoughness ?? 0.85 },
            uSlopeNormalScale: { value: slope.slopeNormalScale ?? 1.15 },
            uSlopeDarkSpotsActive: { value: hasSlopeDarkening ? 1.0 : 0.0 },
            uSlopeDipDarkening: { value: Math.max(0, Math.min(100, slope.dipDarkening ?? 48)) / 100 },
            uSlopeSpotIntensity: { value: Math.max(0, Math.min(100, slope.spotIntensity ?? 38)) / 100 },
            uSlopeSpotScale: { value: Math.max(0.5, slope.spotScale ?? 4.5) },
            uSlopeSpotContrast: { value: Math.max(0, Math.min(100, slope.spotContrast ?? 52)) / 100 },
            uSlopeSpotCoverage: { value: Math.max(0, Math.min(100, slope.spotCoverage ?? 48)) / 100 },
            uSlopeSpotTint: { value: spotTintVec },
            uSlopeSpotWetness: { value: Math.max(-100, Math.min(100, slope.spotWetness ?? 20)) / 100 },
            uSlopeSeed: { value: (slope.slopeSeed ?? 2048) * 0.013 },
            // Material Transition Uniforms (Main↔Cliff, Main↔Slope, Cliff↔Slope)
            uTransMC_A: { value: transMC.paramsA },
            uTransMC_B: { value: transMC.paramsB },
            uTransMC_C: { value: transMC.paramsC },
            uTransMC_Tint: { value: transMC.tint },
            uTransMS_A: { value: transMS.paramsA },
            uTransMS_B: { value: transMS.paramsB },
            uTransMS_C: { value: transMS.paramsC },
            uTransMS_Tint: { value: transMS.tint },
            uTransCS_A: { value: transCS.paramsA },
            uTransCS_B: { value: transCS.paramsB },
            uTransCS_C: { value: transCS.paramsC },
            uTransCS_Tint: { value: transCS.tint },
            // 3D Palette Viewer Uniforms
            uPaletteViewerActive: { value: isPaletteActive ? 1.0 : 0.0 },
            uPaletteLUT: { value: palLutTex },
        };

        const uniforms = mat.userData.shaderUniforms;
        mat.customProgramCacheKey = () => 'nectar_cliff_slope_dual_shader_v11';

        mat.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms);

            shader.vertexShader = `
                attribute float aSlopeDipDepth;
                attribute float aCliffSlopeMask;
                varying vec3 vCliffLocalPos;
                varying vec3 vCliffLocalNormal;
                varying vec2 vCliffUv;
                varying float vSlopeDipDepth;
                varying float vVertexCliffMask;
                ${shader.vertexShader}
            `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vCliffLocalPos = position;
                #ifdef USE_NORMAL
                    vCliffLocalNormal = normalize(objectNormal);
                #else
                    vCliffLocalNormal = vec3(0.0, 1.0, 0.0);
                #endif
                vSlopeDipDepth = aSlopeDipDepth;
                vVertexCliffMask = aCliffSlopeMask;
                #ifdef USE_UV
                    vCliffUv = uv;
                #else
                    vCliffUv = position.xz;
                #endif
                `
            );

            shader.fragmentShader = `
                uniform float uBrightness;
                uniform float uContrast;
                uniform float uSaturation;
                uniform float uHue;
                uniform float uSharpness;

                uniform float uCliffActive;
                uniform float uHasWallDiffuse;
                uniform float uHasWallNormal;
                uniform float uHasWallRoughness;
                uniform sampler2D uWallDiffuseMap;
                uniform sampler2D uWallNormalMap;
                uniform sampler2D uWallRoughnessMap;
                uniform float uCliffCosHigh;
                uniform float uCliffCosLow;
                uniform float uCliffInvert;
                uniform float uWallCoverageBoost;
                uniform float uWallTriplanar;
                uniform float uTriplanarUnit;
                uniform float uMeshMinY;
                uniform float uMeshMaxY;
                uniform float uTopGroundTrans;
                uniform float uTopGroundFeather;
                uniform float uTopGroundDrop;
                uniform float uTopGroundNoise;
                uniform vec2 uWallRepeat;
                uniform vec2 uWallOffset;
                uniform float uWallBrightness;
                uniform float uWallContrast;
                uniform float uWallSaturation;
                uniform float uWallHue;
                uniform float uWallRoughnessVal;
                uniform float uWallNormalScale;

                uniform float uSlopeActive;
                uniform float uHasSlopeDiffuse;
                uniform float uHasSlopeNormal;
                uniform float uHasSlopeRoughness;
                uniform sampler2D uSlopeDiffuseMap;
                uniform sampler2D uSlopeNormalMap;
                uniform sampler2D uSlopeRoughnessMap;
                uniform float uSlopeMinCosHigh;
                uniform float uSlopeMinCosLow;
                uniform float uSlopeMaxCosHigh;
                uniform float uSlopeMaxCosLow;
                uniform float uSlopeInvert;
                uniform float uSlopeCrestTrans;
                uniform float uSlopeToeTrans;
                uniform float uSlopeTransFeather;
                uniform float uSlopeTransNoise;
                uniform float uSlopeTriplanar;
                uniform vec2 uSlopeRepeat;
                uniform vec2 uSlopeOffset;
                uniform float uSlopeBrightness;
                uniform float uSlopeContrast;
                uniform float uSlopeSaturation;
                uniform float uSlopeHue;
                uniform float uSlopeRoughnessVal;
                uniform float uSlopeNormalScale;
                uniform float uSlopeDarkSpotsActive;
                uniform float uSlopeDipDarkening;
                uniform float uSlopeSpotIntensity;
                uniform float uSlopeSpotScale;
                uniform float uSlopeSpotContrast;
                uniform float uSlopeSpotCoverage;
                uniform vec3 uSlopeSpotTint;
                uniform float uSlopeSpotWetness;
                uniform float uSlopeSeed;

                ${THREE_D_PALETTE_GLSL_DEFS}

                varying vec3 vCliffLocalPos;
                varying vec3 vCliffLocalNormal;
                varying vec2 vCliffUv;
                varying float vSlopeDipDepth;
                varying float vVertexCliffMask;

                vec3 applyHsbFilter(vec3 col, float brt, float cnt, float sat, float hueShift) {
                    vec3 c = col * brt;
                    c = (c - 0.5) * cnt + 0.5;
                    const vec3 k = vec3(0.57735, 0.57735, 0.57735);
                    float cosA = cos(hueShift * 6.2831853);
                    float sinA = sin(hueShift * 6.2831853);
                    c = c * cosA + cross(k, c) * sinA + k * dot(k, c) * (1.0 - cosA);
                    float g = dot(c, vec3(0.299, 0.587, 0.114));
                    c = mix(vec3(g), c, sat);
                    return clamp(c, 0.0, 1.0);
                }

                float cliffRimNoise(vec3 p) {
                    vec3 q = p * 9.5;
                    float n1 = sin(q.x * 1.7 + cos(q.z * 1.9)) * cos(q.z * 1.5 - sin(q.x * 2.1));
                    float n2 = sin(q.x * 3.9 - q.z * 3.3 + q.y * 2.2) * 0.5;
                    return (n1 + n2) * 0.5;
                }

                // Multi-octave 3D organic soil/moisture patch noise in [0, 1]
                float slopeSpotNoise3D(vec3 p, float seedShift) {
                    vec3 q1 = p + vec3(seedShift, seedShift * 0.7, -seedShift * 1.3);
                    float n1 = sin(q1.x * 2.1 + cos(q1.z * 2.3 + q1.y * 1.7)) * cos(q1.z * 1.9 - sin(q1.x * 2.5));
                    vec3 q2 = q1 * 2.17 + vec3(3.1, 1.7, 4.9);
                    float n2 = sin(q2.x * 2.3 - cos(q2.z * 2.1)) * cos(q2.y * 2.0 + sin(q2.x * 1.8));
                    vec3 q3 = q1 * 4.43 - vec3(2.3, 5.1, 1.4);
                    float n3 = sin(q3.x * 1.9 + q3.z * 2.2) * cos(q3.z * 2.4 - q3.y * 1.6);
                    return clamp((n1 * 0.55 + n2 * 0.3 + n3 * 0.15) * 0.5 + 0.5, 0.0, 1.0);
                }

                // Computes true geometric triangle normal in local space so smoothed/beveled vertex normals
                // never trick vertical cliff faces into thinking they are flat top ground
                vec3 getCliffGeomNormal() {
                    vec3 dx = dFdx(vCliffLocalPos);
                    vec3 dy = dFdy(vCliffLocalPos);
                    vec3 gn = cross(dx, dy);
                    float len = length(gn);
                    if (len > 1e-6) {
                        return gn / len;
                    }
                    return normalize(vCliffLocalNormal);
                }

                float getCliffSlopeFactor() {
                    vec3 vNorm = normalize(vCliffLocalNormal);
                    vec3 gNorm = getCliffGeomNormal();
                    // Take whichever normal is steeper (smaller |ny|) so top lip beveling or welded normals
                    // never suppress the vertical cliff wall material
                    float absNy = min(abs(vNorm.y), abs(gNorm.y));
                    float m = 1.0 - smoothstep(uCliffCosLow, uCliffCosHigh, absNy);
                    // Also combine with per-vertex pre-bevel cliff mask so sculpted overhangs/ledges stay 100% cliff wall
                    m = max(m, vVertexCliffMask);
                    float slopeMask = uCliffInvert > 0.5 ? (1.0 - m) : m;

                    // Boost cliff wall coverage so steep faces immediately show crisp, full-strength wall texture
                    if (uWallCoverageBoost > 0.001 && slopeMask > 0.01) {
                        float boosted = smoothstep(0.02, max(0.08, 1.0 - uWallCoverageBoost * 0.85), slopeMask);
                        slopeMask = mix(slopeMask, boosted, uWallCoverageBoost);
                    }

                    // Top Ground / Plateau Rim Transition:
                    // Only allow top ground dirt to spill over the very top lip, and NEVER erase the vertical
                    // cliff face unless Rim Height Shift (uTopGroundDrop) explicitly pushes it down
                    if (uTopGroundTrans > 0.001 || abs(uTopGroundDrop) > 0.001) {
                        float spanY = max(0.001, uMeshMaxY - uMeshMinY);
                        float normY = clamp((vCliffLocalPos.y - uMeshMinY) / spanY, 0.0, 1.0);
                        vec3 unitP = vCliffLocalPos * uTriplanarUnit;
                        float rimJitter = cliffRimNoise(unitP) * uTopGroundNoise * 0.12;
                        float effectiveY = normY + uTopGroundDrop * 0.65 + rimJitter;
                        // Keep transition tightly near the top lip (scaled by 0.45 so 20% UI only touches the top 9% rim)
                        float rimDepth = uTopGroundTrans * 0.45;
                        float rimFeather = max(0.01, uTopGroundFeather * 0.35);
                        float rimStart = 1.0 - rimDepth;
                        float topBlend = smoothstep(rimStart - rimFeather, rimStart + rimFeather * 0.5, effectiveY);
                        // On truly vertical wall faces (absNy < 0.35), cap top ground spill so the cliff image always shows through clearly
                        float verticalWallGuard = smoothstep(0.15, 0.55, absNy);
                        float maxSpill = mix(0.65 - uWallCoverageBoost * 0.45, 1.0, verticalWallGuard);
                        slopeMask *= (1.0 - topBlend * clamp(maxSpill, 0.15, 1.0));
                    }

                    return clamp(slopeMask, 0.0, 1.0);
                }

                float getRampSlopeFactor() {
                    vec3 vNorm = normalize(vCliffLocalNormal);
                    vec3 gNorm = getCliffGeomNormal();
                    float absNy = mix(abs(vNorm.y), abs(gNorm.y), 0.5);
                    // Ramp in when steeper than minAngle (absNy drops below uSlopeMinCosHigh)
                    float rampIn = 1.0 - smoothstep(uSlopeMinCosLow, uSlopeMinCosHigh, absNy);
                    // Ramp out when steeper than maxAngle (absNy drops below uSlopeMaxCosHigh)
                    float rampOut = smoothstep(uSlopeMaxCosLow, uSlopeMaxCosHigh, absNy);
                    float band = rampIn * rampOut;
                    float mask = uSlopeInvert > 0.5 ? (1.0 - band) : band;

                    float spanY = max(0.001, uMeshMaxY - uMeshMinY);
                    float normY = clamp((vCliffLocalPos.y - uMeshMinY) / spanY, 0.0, 1.0);
                    vec3 unitP = vCliffLocalPos * uTriplanarUnit;
                    float borderJitter = cliffRimNoise(unitP) * uSlopeTransNoise * 0.2;

                    if (uSlopeCrestTrans > 0.001) {
                        float crestStart = 1.0 - uSlopeCrestTrans;
                        float crestBlend = smoothstep(crestStart - uSlopeTransFeather, crestStart + uSlopeTransFeather * 0.5, normY + borderJitter);
                        mask *= (1.0 - crestBlend);
                    }
                    if (uSlopeToeTrans > 0.001) {
                        float toeEnd = uSlopeToeTrans;
                        float toeBlend = smoothstep(toeEnd - uSlopeTransFeather * 0.5, toeEnd + uSlopeTransFeather, normY + borderJitter);
                        mask *= toeBlend;
                    }
                    return clamp(mask, 0.0, 1.0);
                }

                float getSlopeDarkSpotWeight(float rampMask) {
                    if (uSlopeDarkSpotsActive < 0.5 || rampMask < 0.001) return 0.0;
                    vec3 unitP = vCliffLocalPos * uTriplanarUnit * uSlopeSpotScale;
                    float rawSpot = slopeSpotNoise3D(unitP, uSlopeSeed);
                    float thresh = 1.0 - uSlopeSpotCoverage;
                    float softness = max(0.03, (1.0 - uSlopeSpotContrast) * 0.42);
                    float spotMask = smoothstep(thresh - softness, thresh + softness, rawSpot) * uSlopeSpotIntensity;
                    float dipShade = clamp(vSlopeDipDepth * 1.4, 0.0, 1.0) * uSlopeDipDarkening;
                    return clamp((spotMask + dipShade - spotMask * dipShade * 0.35) * rampMask, 0.0, 0.95);
                }

                vec4 sampleTriplanarOrUv(sampler2D tex, float useTriplanar, vec2 rep, vec2 off) {
                    if (useTriplanar > 0.5) {
                        vec3 gNorm = getCliffGeomNormal();
                        vec3 vNorm = normalize(vCliffLocalNormal);
                        vec3 blendN = normalize(mix(vNorm, gNorm, 0.65));
                        vec3 bf = abs(blendN);
                        // Favor horizontal wall axes (X and Z) on cliff faces so ledges don't smear top-down Y projection
                        bf.y *= 0.55;
                        bf = max(bf - 0.1, 0.0001);
                        bf /= (bf.x + bf.y + bf.z);
                        vec3 p = (vCliffLocalPos - vec3(0.0, uMeshMinY, 0.0)) * uTriplanarUnit;
                        vec2 uvX = p.zy * rep + off;
                        vec2 uvY = p.xz * rep + off;
                        vec2 uvZ = p.xy * rep + off;
                        return texture2D(tex, uvX) * bf.x + texture2D(tex, uvY) * bf.y + texture2D(tex, uvZ) * bf.z;
                    } else {
                        vec2 uvMapped = vCliffUv * rep + off;
                        return texture2D(tex, uvMapped);
                    }
                }

                ${THREE_D_CLIFF_EMERGE_GLSL_CHUNK}

                ${THREE_D_SLOPE_EMERGE_GLSL_CHUNK}

                ${THREE_D_TRANSITION_GLSL_CHUNK}

                ${shader.fragmentShader}
            `
                .replace(
                    '#include <map_fragment>',
                    `
                    #include <map_fragment>
                    vec3 baseCol = applyHsbFilter(diffuseColor.rgb, uBrightness, uContrast, uSaturation, uHue);
                    baseCol = mix(baseCol, baseCol * baseCol * 1.5, uSharpness * 0.2);
                    diffuseColor.rgb = baseCol;
                    float activeCliffMask = 0.0;
                    if (uCliffActive > 0.5) {
                        float baseCliffMask = getCliffSlopeFactor();
                        activeCliffMask = computeEffectiveCliffEmergeMask(baseCliffMask);
                        if (uHasWallDiffuse > 0.5 && activeCliffMask > 0.001) {
                            vec4 wallTexel = sampleTriplanarOrUv(uWallDiffuseMap, uWallTriplanar, uWallRepeat, uWallOffset);
                            vec3 wallCol = applyHsbFilter(wallTexel.rgb, uWallBrightness, uWallContrast, uWallSaturation, uWallHue);
                            diffuseColor.rgb = blendPairWithTransition(
                                diffuseColor.rgb,
                                wallCol,
                                activeCliffMask,
                                uTransMC_A,
                                uTransMC_B,
                                uTransMC_C,
                                uTransMC_Tint,
                                vCliffLocalPos,
                                uTriplanarUnit
                            );
                        }
                    }
                    if (uSlopeActive > 0.5) {
                        float baseRampMask = getRampSlopeFactor();
                        float rampMask = computeEffectiveSlopeEmergeMask(baseRampMask);
                        if (uHasSlopeDiffuse > 0.5 && rampMask > 0.001) {
                            vec4 slopeTexel = sampleTriplanarOrUv(uSlopeDiffuseMap, uSlopeTriplanar, uSlopeRepeat, uSlopeOffset);
                            vec3 slopeCol = applyHsbFilter(slopeTexel.rgb, uSlopeBrightness, uSlopeContrast, uSlopeSaturation, uSlopeHue);
                            vec3 blendedMainSlope = blendPairWithTransition(
                                diffuseColor.rgb,
                                slopeCol,
                                rampMask,
                                uTransMS_A,
                                uTransMS_B,
                                uTransMS_C,
                                uTransMS_Tint,
                                vCliffLocalPos,
                                uTriplanarUnit
                            );
                            if (uCliffActive > 0.5 && uHasWallDiffuse > 0.5 && activeCliffMask > 0.01) {
                                vec3 blendedCliffSlope = blendPairWithTransition(
                                    diffuseColor.rgb,
                                    slopeCol,
                                    rampMask,
                                    uTransCS_A,
                                    uTransCS_B,
                                    uTransCS_C,
                                    uTransCS_Tint,
                                    vCliffLocalPos,
                                    uTriplanarUnit
                                );
                                diffuseColor.rgb = mix(blendedMainSlope, blendedCliffSlope, clamp(activeCliffMask, 0.0, 1.0));
                            } else {
                                diffuseColor.rgb = blendedMainSlope;
                            }
                        }
                        float darkWeight = getSlopeDarkSpotWeight(baseRampMask);
                        if (darkWeight > 0.001) {
                            vec3 darkened = mix(diffuseColor.rgb * uSlopeSpotTint * 1.6, uSlopeSpotTint, 0.35);
                            diffuseColor.rgb = mix(diffuseColor.rgb, darkened, darkWeight);
                        }
                    }
                    `
                )
                .replace(
                    '#include <roughnessmap_fragment>',
                    `
                    #include <roughnessmap_fragment>
                    if (uCliffActive > 0.5) {
                        float baseCliffMaskR = getCliffSlopeFactor();
                        float cliffMaskR = computeEffectiveCliffEmergeMask(baseCliffMaskR);
                        if (cliffMaskR > 0.001) {
                            float targetWallRough = uWallRoughnessVal;
                            if (uHasWallRoughness > 0.5) {
                                targetWallRough *= sampleTriplanarOrUv(uWallRoughnessMap, uWallTriplanar, uWallRepeat, uWallOffset).g;
                            }
                            roughnessFactor = mix(roughnessFactor, clamp(targetWallRough, 0.04, 1.0), cliffMaskR);
                        }
                    }
                    if (uSlopeActive > 0.5) {
                        float baseRampMaskR = getRampSlopeFactor();
                        float rampMaskR = computeEffectiveSlopeEmergeMask(baseRampMaskR);
                        if (rampMaskR > 0.001 && (uHasSlopeDiffuse > 0.5 || uHasSlopeRoughness > 0.5)) {
                            float targetSlopeRough = uSlopeRoughnessVal;
                            if (uHasSlopeRoughness > 0.5) {
                                targetSlopeRough *= sampleTriplanarOrUv(uSlopeRoughnessMap, uSlopeTriplanar, uSlopeRepeat, uSlopeOffset).g;
                            }
                            roughnessFactor = mix(roughnessFactor, clamp(targetSlopeRough, 0.04, 1.0), rampMaskR);
                        }
                        if (baseRampMaskR > 0.001) {
                            float darkWeightR = getSlopeDarkSpotWeight(baseRampMaskR);
                            if (darkWeightR > 0.001 && abs(uSlopeSpotWetness) > 0.001) {
                                float wetTarget = clamp(roughnessFactor - uSlopeSpotWetness * 0.55, 0.05, 1.0);
                                roughnessFactor = mix(roughnessFactor, wetTarget, darkWeightR);
                            }
                        }
                    }
                    `
                )
                .replace(
                    '#include <normal_fragment_maps>',
                    `
                    #include <normal_fragment_maps>
                    if (uCliffActive > 0.5) {
                        float baseCliffMaskN = getCliffSlopeFactor();
                        float cliffMaskN = computeEffectiveCliffEmergeMask(baseCliffMaskN);
                        if (cliffMaskN > 0.001) {
                            vec3 totalWallBump = vec3(0.0);
                            if (uHasWallNormal > 0.5) {
                                vec3 wallN = sampleTriplanarOrUv(uWallNormalMap, uWallTriplanar, uWallRepeat, uWallOffset).xyz * 2.0 - 1.0;
                                wallN.xy *= uWallNormalScale;
                                totalWallBump += wallN * 0.65;
                            }
                            vec3 wallHeightBump = computeWallHeightBumpNormal();
                            totalWallBump += wallHeightBump * 0.45;
                            if (length(totalWallBump) > 0.0001) {
                                normal = normalize(mix(normal, normalize(normal + totalWallBump), cliffMaskN));
                            }
                        }
                    }
                    if (uSlopeActive > 0.5) {
                        float baseRampMaskN = getRampSlopeFactor();
                        float rampMaskN = computeEffectiveSlopeEmergeMask(baseRampMaskN);
                        if (rampMaskN > 0.001) {
                            vec3 totalSlopeBump = vec3(0.0);
                            if (uHasSlopeNormal > 0.5) {
                                vec3 slopeN = sampleTriplanarOrUv(uSlopeNormalMap, uSlopeTriplanar, uSlopeRepeat, uSlopeOffset).xyz * 2.0 - 1.0;
                                slopeN.xy *= uSlopeNormalScale;
                                totalSlopeBump += slopeN * 0.65;
                            }
                            vec3 heightBump = computeSlopeHeightBumpNormal();
                            totalSlopeBump += heightBump * 0.45;
                            if (length(totalSlopeBump) > 0.0001) {
                                normal = normalize(mix(normal, normalize(normal + totalSlopeBump), rampMaskN));
                            }
                        }
                    }
                    `
                )
                .replace(
                    '#include <opaque_fragment>',
                    `
                    if (uPaletteViewerActive > 0.5) {
                        outgoingLight = quantizeToWestwoodPalette(outgoingLight);
                    }
                    #include <opaque_fragment>
                    `
                );
        };
        mat.needsUpdate = true;
    } else {
        const u = mat.userData.shaderUniforms;
        u.uBrightness.value = brightness;
        u.uContrast.value = contrast;
        u.uSaturation.value = saturation;
        u.uHue.value = hue;
        u.uSharpness.value = sharpness;
        // Cliff
        u.uCliffActive.value = cliffShaderActive ? 1.0 : 0.0;
        u.uHasWallDiffuse.value = hasWallDiffuse ? 1.0 : 0.0;
        u.uHasWallNormal.value = hasWallNormal ? 1.0 : 0.0;
        u.uHasWallRoughness.value = hasWallRoughness ? 1.0 : 0.0;
        u.uWallDiffuseMap.value = wallTextures?.wallDiffuse || null;
        u.uWallNormalMap.value = wallTextures?.wallNormal || null;
        u.uWallRoughnessMap.value = wallTextures?.wallRoughness || null;
        if (u.uWallDepthMap) u.uWallDepthMap.value = wallTextures?.wallDepth || null;
        if (u.uWallEmergeParams) u.uWallEmergeParams.value.copy(packedCliffEmerge.emergeParams);
        if (u.uWallBumpParams) u.uWallBumpParams.value.copy(packedCliffEmerge.bumpParams);
        u.uCliffCosHigh.value = cosHigh;
        u.uCliffCosLow.value = cosLow;
        u.uCliffInvert.value = cliff.invertSlopeMask ? 1.0 : 0.0;
        u.uWallCoverageBoost.value = wallCoverageBoost;
        u.uWallTriplanar.value = cliff.wallTriplanar ? 1.0 : 0.0;
        u.uTriplanarUnit.value = triplanarUnit;
        u.uMeshMinY.value = boundsInfo.minY;
        u.uMeshMaxY.value = boundsInfo.maxY;
        u.uTopGroundTrans.value = topTrans;
        u.uTopGroundFeather.value = topFeather;
        u.uTopGroundDrop.value = topDrop;
        u.uTopGroundNoise.value = topNoise;
        u.uWallRepeat.value.set(repX, repY);
        u.uWallOffset.value.set(offX, offY);
        u.uWallBrightness.value = (cliff.wallBrightness ?? 100) / 100;
        u.uWallContrast.value = (cliff.wallContrast ?? 100) / 100;
        u.uWallSaturation.value = (cliff.wallSaturation ?? 100) / 100;
        u.uWallHue.value = (cliff.wallHue ?? 0) / 360;
        u.uWallRoughnessVal.value = cliff.wallRoughness ?? 0.85;
        u.uWallNormalScale.value = cliff.wallNormalScale ?? 1.2;
        // Slope
        u.uSlopeActive.value = slopeShaderActive ? 1.0 : 0.0;
        u.uHasSlopeDiffuse.value = hasSlopeDiffuse ? 1.0 : 0.0;
        u.uHasSlopeNormal.value = hasSlopeNormal ? 1.0 : 0.0;
        u.uHasSlopeRoughness.value = hasSlopeRoughness ? 1.0 : 0.0;
        u.uSlopeDiffuseMap.value = slopeTextures?.slopeDiffuse || null;
        u.uSlopeNormalMap.value = slopeTextures?.slopeNormal || null;
        u.uSlopeRoughnessMap.value = slopeTextures?.slopeRoughness || null;
        if (u.uSlopeDepthMap) u.uSlopeDepthMap.value = slopeTextures?.slopeDepth || null;
        if (u.uSlopeEmergeParams) u.uSlopeEmergeParams.value.copy(packedSlopeEmerge.emergeParams);
        if (u.uSlopeBumpParams) u.uSlopeBumpParams.value.copy(packedSlopeEmerge.bumpParams);
        u.uSlopeMinCosHigh.value = sMinCosHigh;
        u.uSlopeMinCosLow.value = sMinCosLow;
        u.uSlopeMaxCosHigh.value = sMaxCosHigh;
        u.uSlopeMaxCosLow.value = sMaxCosLow;
        u.uSlopeInvert.value = slope.invertMask ? 1.0 : 0.0;
        u.uSlopeCrestTrans.value = sCrestTrans;
        u.uSlopeToeTrans.value = sToeTrans;
        u.uSlopeTransFeather.value = sTransFeather;
        u.uSlopeTransNoise.value = sTransNoise;
        u.uSlopeTriplanar.value = slope.slopeTriplanar ? 1.0 : 0.0;
        u.uSlopeRepeat.value.set(sRepX, sRepY);
        u.uSlopeOffset.value.set(offSX, offSY);
        u.uSlopeBrightness.value = (slope.slopeBrightness ?? 100) / 100;
        u.uSlopeContrast.value = (slope.slopeContrast ?? 100) / 100;
        u.uSlopeSaturation.value = (slope.slopeSaturation ?? 100) / 100;
        u.uSlopeHue.value = (slope.slopeHue ?? 0) / 360;
        u.uSlopeRoughnessVal.value = slope.slopeRoughness ?? 0.85;
        u.uSlopeNormalScale.value = slope.slopeNormalScale ?? 1.15;
        u.uSlopeDarkSpotsActive.value = hasSlopeDarkening ? 1.0 : 0.0;
        u.uSlopeDipDarkening.value = Math.max(0, Math.min(100, slope.dipDarkening ?? 48)) / 100;
        u.uSlopeSpotIntensity.value = Math.max(0, Math.min(100, slope.spotIntensity ?? 38)) / 100;
        u.uSlopeSpotScale.value = Math.max(0.5, slope.spotScale ?? 4.5);
        u.uSlopeSpotContrast.value = Math.max(0, Math.min(100, slope.spotContrast ?? 52)) / 100;
        u.uSlopeSpotCoverage.value = Math.max(0, Math.min(100, slope.spotCoverage ?? 48)) / 100;
        u.uSlopeSpotTint.value = spotTintVec;
        u.uSlopeSpotWetness.value = Math.max(-100, Math.min(100, slope.spotWetness ?? 20)) / 100;
        u.uSlopeSeed.value = (slope.slopeSeed ?? 2048) * 0.013;
        // Material Transition Uniforms
        if (u.uTransMC_A) {
            u.uTransMC_A.value.copy(transMC.paramsA);
            u.uTransMC_B.value.copy(transMC.paramsB);
            u.uTransMC_C.value.copy(transMC.paramsC);
            u.uTransMC_Tint.value.copy(transMC.tint);
            u.uTransMS_A.value.copy(transMS.paramsA);
            u.uTransMS_B.value.copy(transMS.paramsB);
            u.uTransMS_C.value.copy(transMS.paramsC);
            u.uTransMS_Tint.value.copy(transMS.tint);
            u.uTransCS_A.value.copy(transCS.paramsA);
            u.uTransCS_B.value.copy(transCS.paramsB);
            u.uTransCS_C.value.copy(transCS.paramsC);
            u.uTransCS_Tint.value.copy(transCS.tint);
        }
        // 3D Palette Viewer
        if (u.uPaletteViewerActive) {
            u.uPaletteViewerActive.value = isPaletteActive ? 1.0 : 0.0;
        }
        if (u.uPaletteLUT) {
            u.uPaletteLUT.value = palLutTex;
        }
    }
}

