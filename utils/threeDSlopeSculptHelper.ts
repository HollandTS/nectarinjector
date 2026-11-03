import * as THREE from 'three';
import type { ThreeDSlopeShapingSettings, ThreeDObject } from '../types';
import { DEFAULT_SLOPE_SHAPING_SETTINGS } from './threeDSlopePresets';
import { isProceduralPlaneUrl } from './layerTo3DPlaneUtils';
import {
    buildSubdividedWeldedGeometry,
    computeSpatialWeldedNormals,
} from './threeDCliffSculptHelper';
import {
    buildSpatialVertexWeldInfo,
    enforceWeldedVertexPositions,
} from './threeDMeshWeldHelper';

interface CachedSlopeDepthBuffer {
    signature: string;
    width: number;
    height: number;
    heights: Float32Array;
}

const slopeDepthCache = new Map<string, CachedSlopeDepthBuffer>();

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

async function getSlopeDepthBuffer(
    sourceUrl: string | undefined,
    overlayCanvas: HTMLCanvasElement | HTMLImageElement | null | undefined,
    contrastPct: number,
    blurPxInput: number,
    invertFlag: boolean
): Promise<CachedSlopeDepthBuffer | null> {
    if (!sourceUrl && !overlayCanvas) return null;

    const sig = JSON.stringify({
        src: sourceUrl
            ? sourceUrl.length > 100
                ? `${sourceUrl.slice(0, 48)}_${sourceUrl.slice(-32)}_${sourceUrl.length}`
                : sourceUrl
            : `overlay_${overlayCanvas?.width}x${overlayCanvas?.height}`,
        contrast: contrastPct,
        blur: blurPxInput,
        invert: invertFlag,
    });

    const cached = slopeDepthCache.get(sig);
    if (cached && !(overlayCanvas instanceof HTMLCanvasElement)) return cached;

    let sourceEl: HTMLImageElement | HTMLCanvasElement | null = overlayCanvas || null;
    if (!sourceEl && sourceUrl) {
        sourceEl = await loadImageElement(sourceUrl);
    }
    if (!sourceEl) return null;

    const maxRes = 256;
    const sw = sourceEl.width || 256;
    const sh = sourceEl.height || 256;
    const aspect = sw / (sh || 1);
    const w = aspect >= 1 ? Math.min(maxRes, sw) : Math.max(32, Math.round(Math.min(maxRes, sh) * aspect));
    const h = aspect >= 1 ? Math.max(32, Math.round(w / aspect)) : Math.min(maxRes, sh);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const blurPx = Math.max(0, blurPxInput ?? 1);
    if (blurPx > 0) {
        const pad = Math.min(32, Math.ceil(blurPx * 3));
        const padCanvas = document.createElement('canvas');
        padCanvas.width = w + pad * 2;
        padCanvas.height = h + pad * 2;
        const pCtx = padCanvas.getContext('2d')!;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                pCtx.drawImage(sourceEl, pad + dx * w, pad + dy * h, w, h);
            }
        }
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(padCanvas, -pad, -pad);
        ctx.filter = 'none';
    } else {
        ctx.drawImage(sourceEl, 0, 0, w, h);
    }

    const data = ctx.getImageData(0, 0, w, h).data;
    const heights = new Float32Array(w * h);
    const contrast = Math.max(0, (contrastPct ?? 115) / 100);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        let lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        if (invertFlag) lum = 1.0 - lum;
        lum = (lum - 0.5) * contrast + 0.5;
        heights[p] = Math.max(0, Math.min(1, lum));
    }

    const result: CachedSlopeDepthBuffer = { signature: sig, width: w, height: h, heights };
    if (!(overlayCanvas instanceof HTMLCanvasElement)) {
        if (slopeDepthCache.size > 16) {
            const firstKey = slopeDepthCache.keys().next().value;
            if (firstKey) slopeDepthCache.delete(firstKey);
        }
        slopeDepthCache.set(sig, result);
    }
    return result;
}

function sampleWrappedBilinear(
    heights: Float32Array,
    width: number,
    height: number,
    u: number,
    v: number
): number {
    const wu = ((u % 1) + 1) % 1;
    const wv = ((v % 1) + 1) % 1;
    const fx = wu * width - 0.5;
    const fy = (1.0 - wv) * height - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const ix0 = ((x0 % width) + width) % width;
    const ix1 = (ix0 + 1) % width;
    const iy0 = ((y0 % height) + height) % height;
    const iy1 = (iy0 + 1) % height;

    const h00 = heights[iy0 * width + ix0];
    const h10 = heights[iy0 * width + ix1];
    const h01 = heights[iy1 * width + ix0];
    const h11 = heights[iy1 * width + ix1];

    const top = h00 * (1 - tx) + h10 * tx;
    const bot = h01 * (1 - tx) + h11 * tx;
    return top * (1 - ty) + bot * ty;
}

function hash3(ix: number, iy: number, iz: number, seed: number): number {
    let n = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1664525) | 0;
    n = (n ^ (n >> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smoothNoise3D(x: number, y: number, z: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);

    const n000 = hash3(ix, iy, iz, seed);
    const n100 = hash3(ix + 1, iy, iz, seed);
    const n010 = hash3(ix, iy + 1, iz, seed);
    const n110 = hash3(ix + 1, iy + 1, iz, seed);
    const n001 = hash3(ix, iy, iz + 1, seed);
    const n101 = hash3(ix + 1, iy, iz + 1, seed);
    const n011 = hash3(ix, iy + 1, iz + 1, seed);
    const n111 = hash3(ix + 1, iy + 1, iz + 1, seed);

    const nx00 = n000 + (n100 - n000) * ux;
    const nx10 = n010 + (n110 - n010) * ux;
    const nx01 = n001 + (n101 - n001) * ux;
    const nx11 = n011 + (n111 - n011) * ux;

    const nxy0 = nx00 + (nx10 - nx00) * uy;
    const nxy1 = nx01 + (nx11 - nx01) * uy;

    return nxy0 + (nxy1 - nxy0) * uz;
}

/**
 * Evaluates a bandpass slope angle mask in [0, 1].
 * Targets inclined ramp faces whose angle from horizontal is between [minAngle, maxAngle].
 * Flat horizontal ground (< minAngle) and steep vertical cliffs (> maxAngle) smoothly fade to 0.
 */
export function evaluateSlopeBandMask(
    absNormalY: number,
    minAngleDeg: number,
    maxAngleDeg: number,
    featherDeg: number,
    invert: boolean = false
): number {
    const clampedNy = Math.max(0, Math.min(1, absNormalY));
    const angleDeg = (Math.acos(clampedNy) * 180) / Math.PI;
    const halfF = Math.max(0.5, featherDeg * 0.5);

    const lowEdge0 = minAngleDeg - halfF;
    const lowEdge1 = minAngleDeg + halfF;
    const tLow = Math.max(0, Math.min(1, (angleDeg - lowEdge0) / Math.max(0.1, lowEdge1 - lowEdge0)));
    const rampIn = tLow * tLow * (3 - 2 * tLow);

    const highEdge0 = maxAngleDeg - halfF;
    const highEdge1 = maxAngleDeg + halfF;
    const tHigh = Math.max(0, Math.min(1, (angleDeg - highEdge0) / Math.max(0.1, highEdge1 - highEdge0)));
    const rampOut = 1.0 - tHigh * tHigh * (3 - 2 * tHigh);

    const mask = rampIn * rampOut;
    return invert ? 1.0 - mask : mask;
}

/**
 * Applies Angle-Band Slope Shaping, Concave/Convex Ramp Profile, Terrain Dips / Gullies,
 * and computes per-vertex `aSlopeDipDepth` for hollow darkening in the shader.
 */
export async function applySlopeShapingToModel(
    model: THREE.Group,
    obj: ThreeDObject,
    slopeOverlayCanvas?: HTMLCanvasElement | null,
    mainDiffuseCanvas?: HTMLCanvasElement | null
): Promise<void> {
    const slope: ThreeDSlopeShapingSettings = {
        ...DEFAULT_SLOPE_SHAPING_SETTINGS,
        ...(obj.slopeShapingSettings || {}),
    };

    const hasAnySlopeDeformation =
        Math.abs(slope.slopeNormalPush ?? 0) > 1e-4 ||
        Math.abs(slope.slopeCurvature ?? 0) > 1e-4 ||
        (Boolean(slope.mainSlopeDisplacementEnabled) &&
            (Math.abs(slope.mainSlopeDepthScale ?? 0) > 1e-4 ||
                Math.abs(slope.mainSlopeDepthBias ?? 0) > 1e-4)) ||
        Math.abs(slope.slopeDepthScale ?? 0) > 1e-4 ||
        (Boolean(slope.dipsEnabled) && Math.abs(slope.dipAmplitude ?? 0) > 1e-4) ||
        (slope.crestBevel ?? 0) > 0.5;

    // Note: Mesh subdivision (0..4, Flat or Smooth) is now handled first in applyModelSubdivision
    if (!slope.enabled || !hasAnySlopeDeformation) {
        // Clear dip attribute when disabled so shader doesn't use stale dip values
        model.traverse((child) => {
            if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
            if ((child as THREE.Mesh).isMesh) {
                const geo = (child as THREE.Mesh).geometry;
                const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
                if (posAttr && geo.attributes.aSlopeDipDepth) {
                    geo.setAttribute(
                        'aSlopeDipDepth',
                        new THREE.BufferAttribute(new Float32Array(posAttr.count), 1)
                    );
                }
            }
        });
        return;
    }

    // Extract embedded GLB texture image if no external main texture or displacement map is set
    let embeddedMainImg: HTMLImageElement | HTMLCanvasElement | null = null;
    if (!obj.displacementMapUrl && !obj.textureUrl && !mainDiffuseCanvas) {
        model.traverse((child) => {
            if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
            if (embeddedMainImg || !(child as THREE.Mesh).isMesh) return;
            const mat = (child as THREE.Mesh).material as any;
            const origMap = mat?.userData?.origMap || mat?.map;
            if (origMap?.image && (origMap.image instanceof HTMLImageElement || origMap.image instanceof HTMLCanvasElement)) {
                embeddedMainImg = origMap.image;
            }
        });
    }

    // 1. Main Texture Depth Buffer (for displacing the main texture strictly on slopes)
    const mainDispEnabled = slope.mainSlopeDisplacementEnabled ?? false;
    const mainDepthScale = slope.mainSlopeDepthScale ?? 0;
    const mainDepthBias = slope.mainSlopeDepthBias ?? 0;
    const needMainDepthBuffer =
        mainDispEnabled && (Math.abs(mainDepthScale) > 1e-4 || Math.abs(mainDepthBias) > 1e-4);
    const mainDepthSourceUrl = obj.displacementMapUrl || obj.textureUrl;
    const mainDepthBuffer = needMainDepthBuffer
        ? await getSlopeDepthBuffer(
              mainDepthSourceUrl,
              mainDiffuseCanvas || embeddedMainImg,
              slope.mainSlopeDepthContrast ?? 120,
              slope.mainSlopeDepthBlur ?? 1,
              !!slope.mainSlopeDepthInvert
          )
        : null;

    // 2. Secondary Slope Material Depth Buffer
    const slopeDepthSource =
        slope.slopeDepthMapUrl || slope.slopeTextureUrl || obj.displacementMapUrl || obj.textureUrl;
    const needDepthBuffer = Math.abs(slope.slopeDepthScale ?? 0) > 1e-4;
    const depthBuffer = needDepthBuffer
        ? await getSlopeDepthBuffer(
              slopeDepthSource,
              slopeOverlayCanvas || mainDiffuseCanvas || embeddedMainImg,
              slope.slopeDepthContrast ?? 115,
              slope.slopeDepthBlur ?? 1,
              !!slope.slopeDepthInvert
          )
        : null;

    const seed = Math.round(slope.slopeSeed ?? 2048);
    const scaleU = (slope.slopeScale || 1) * (slope.slopeRepeatX || 1);
    const scaleV = (slope.slopeScale || 1) * (slope.slopeRepeatY || 1);
    const offU = slope.slopeOffsetX || 0;
    const offV = slope.slopeOffsetY || 0;

    // Main texture UV transform settings
    const mainTexSettings = obj.textureSettings;
    const mainScaleU = (mainTexSettings?.scale || 1) * (mainTexSettings?.repeatX || 1);
    const mainScaleV = (mainTexSettings?.scale || 1) * (mainTexSettings?.repeatY || 1);
    const mainOffU = mainTexSettings?.offsetX || 0;
    const mainOffV = mainTexSettings?.offsetY || 0;
    const mainDispMode = slope.mainSlopeDisplacementMode ?? 'normal';
    const mainTriplanar = slope.mainSlopeTriplanar ?? true;

    model.traverse((child) => {
        if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const geo = mesh.geometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
        if (!posAttr) return;

        // If neither standard displacement nor cliff shaping ran before us, reset to basePositions
        const hasPriorDeform =
            obj.displacementSettings?.enabled ||
            obj.displacementSettings?.terrainEnabled ||
            obj.cliffShapingSettings?.enabled;
        if (!hasPriorDeform && geo.userData.basePositions) {
            posAttr.copy(geo.userData.basePositions as THREE.BufferAttribute);
        }

        geo.computeVertexNormals();
        const normAttr = geo.attributes.normal as THREE.BufferAttribute;
        const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;

        geo.computeBoundingBox();
        const bbox =
            geo.boundingBox || new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
        const minY = bbox.min.y;
        const maxY = bbox.max.y;
        const spanY = Math.max(0.001, maxY - minY);
        const sizeVec = new THREE.Vector3();
        bbox.getSize(sizeVec);
        const refSize = Math.max(0.1, Math.max(sizeVec.x, sizeVec.y, sizeVec.z));
        const unitScale = refSize * 0.04;

        const weldEnabled = slope.weldVertices ?? true;
        const weldTolerance = slope.weldTolerance ?? 35;
        const basePosAttr = (geo.userData.basePositions as THREE.BufferAttribute | undefined) || posAttr;
        const weldInfo = weldEnabled
            ? buildSpatialVertexWeldInfo(basePosAttr, normAttr, refSize, weldTolerance)
            : null;
        const weldedNormals = weldInfo
            ? weldInfo.weldedNormals
            : computeSpatialWeldedNormals(posAttr, normAttr);
        const dipDepthArray = new Float32Array(posAttr.count);

        const crestPct = Math.max(0, Math.min(75, slope.crestTransition ?? 0)) / 100;
        const toePct = Math.max(0, Math.min(75, slope.toeTransition ?? 18)) / 100;
        const transFeatherPct = Math.max(1, Math.min(50, slope.transitionFeather ?? 20)) / 100;
        const transNoisePct = Math.max(0, Math.min(100, slope.transitionNoise ?? 30)) / 100;
        const bevelPct = Math.max(0, Math.min(100, slope.crestBevel ?? 25)) / 100;
        const pinPct = Math.max(0, Math.min(100, slope.pinEdges ?? 30)) / 100;

        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            // Use canonical welded position for noise/angle evaluation when welding is active so shared vertices evaluate identically
            const evalX = weldInfo ? weldInfo.canonicalBasePositions[i * 3] : vx;
            const evalY = weldInfo ? weldInfo.canonicalBasePositions[i * 3 + 1] : vy;
            const evalZ = weldInfo ? weldInfo.canonicalBasePositions[i * 3 + 2] : vz;

            const wnx = weldedNormals[i * 3];
            const wny = weldedNormals[i * 3 + 1];
            const wnz = weldedNormals[i * 3 + 2];

            const fny = normAttr.getY(i);

            const normY = Math.max(0, Math.min(1, (evalY - minY) / spanY));
            const nxCoord = (evalX - bbox.min.x) / Math.max(0.001, sizeVec.x || refSize);
            const nzCoord = (evalZ - bbox.min.z) / Math.max(0.001, sizeVec.z || refSize);

            // Organic border noise for Crest & Toe transitions
            const borderNoise =
                (smoothNoise3D(nxCoord * 4.2, normY * 3.2, nzCoord * 4.2, seed + 409) * 2 - 1) *
                transNoisePct *
                0.2;

            // Upper Crest attenuation (blends ramp smoothly into top ground plateau)
            let crestFade = 1.0;
            if (crestPct > 0.001) {
                const crestStart = 1.0 - crestPct;
                const e0 = crestStart - transFeatherPct;
                const e1 = crestStart + transFeatherPct * 0.5;
                const tc = Math.max(0, Math.min(1, (normY + borderNoise - e0) / Math.max(0.001, e1 - e0)));
                crestFade = 1.0 - tc * tc * (3 - 2 * tc);
            }

            // Lower Toe attenuation (blends ramp smoothly into bottom ground)
            let toeFade = 1.0;
            if (toePct > 0.001) {
                const toeEnd = toePct;
                const e0 = toeEnd - transFeatherPct * 0.5;
                const e1 = toeEnd + transFeatherPct;
                const tt = Math.max(0, Math.min(1, (normY + borderNoise - e0) / Math.max(0.001, e1 - e0)));
                toeFade = tt * tt * (3 - 2 * tt);
            }

            const avgNy = weldEnabled ? Math.min(1, Math.abs(wny)) : Math.min(1, Math.abs(wny * 0.65 + fny * 0.35));
            let slopeMask = evaluateSlopeBandMask(
                avgNy,
                slope.minAngle ?? 8,
                slope.maxAngle ?? 55,
                slope.feather ?? 12,
                !!slope.invertMask
            );
            slopeMask *= crestFade * toeFade;

            let totalNormalDelta = 0;
            let totalVerticalDelta = 0;
            let dipDepthNormalized = 0; // [0, 1] how deep inside a dip/hollow this vertex sits

            // 1. Uniform Slope Normal Push
            if (slope.slopeNormalPush) {
                totalNormalDelta += slope.slopeNormalPush * unitScale;
            }

            // 2. Concave / Convex Ramp Profile Curvature (sin(pi * normY) peaks in middle of slope)
            if (Math.abs(slope.slopeCurvature) > 1e-4) {
                const arch = Math.sin(normY * Math.PI);
                const archDelta = arch * slope.slopeCurvature * unitScale * 1.4;
                totalNormalDelta += archDelta;
                if (slope.slopeCurvature < 0) {
                    // Concave scoop contributes to hollow darkening in the middle of the slope
                    dipDepthNormalized += arch * Math.min(1, Math.abs(slope.slopeCurvature) / 4.0) * 0.45;
                }
            }

            // 2.5. Main Texture Displacement on Slopes Only
            if (mainDispEnabled && (Math.abs(mainDepthScale) > 1e-4 || Math.abs(mainDepthBias) > 1e-4)) {
                let mainH = 0.5;
                if (mainDepthBuffer) {
                    let mU = uvAttr ? uvAttr.getX(i) : nxCoord;
                    let mV = uvAttr ? uvAttr.getY(i) : nzCoord;
                    if (mainTriplanar || (weldEnabled && !uvAttr)) {
                        mU = nxCoord;
                        mV = nzCoord;
                    }
                    mainH = sampleWrappedBilinear(
                        mainDepthBuffer.heights,
                        mainDepthBuffer.width,
                        mainDepthBuffer.height,
                        mU * mainScaleU + mainOffU,
                        mV * mainScaleV + mainOffV
                    );
                }
                const mainDispDelta = ((mainH - 0.5) * mainDepthScale + mainDepthBias * 0.5) * unitScale * 1.55;
                if (mainDispMode === 'vertical') {
                    totalVerticalDelta += mainDispDelta;
                } else {
                    totalNormalDelta += mainDispDelta;
                }
                if (mainH < 0.46 && Math.abs(mainDepthScale) > 0.1) {
                    dipDepthNormalized += (0.46 - mainH) * 0.55;
                }
            }

            // 3. PBR Depth / Height Map Displacement on Slope (Secondary Slope Texture / Depth)
            if (depthBuffer && Math.abs(slope.slopeDepthScale) > 1e-4) {
                let sampleU = uvAttr ? uvAttr.getX(i) : nxCoord;
                let sampleV = uvAttr ? uvAttr.getY(i) : nzCoord;

                if (slope.slopeTriplanar || weldEnabled) {
                    sampleU = nxCoord;
                    sampleV = nzCoord;
                }

                const hSample = sampleWrappedBilinear(
                    depthBuffer.heights,
                    depthBuffer.width,
                    depthBuffer.height,
                    sampleU * scaleU + offU,
                    sampleV * scaleV + offV
                );
                totalNormalDelta += (hSample - 0.5) * slope.slopeDepthScale * unitScale * 1.5;
                if (hSample < 0.48) {
                    dipDepthNormalized += (0.48 - hSample) * 0.7;
                }
            }

            // 4. Procedural Slope Dips, Bowl Hollows & Downhill Erosion Gullies
            if (slope.dipsEnabled && (slope.dipAmplitude ?? 0) > 1e-4) {
                const freq = Math.max(0.5, slope.dipFrequency ?? 3.2);
                const sharp = Math.max(0, Math.min(1, (slope.dipSharpness ?? 45) / 100));
                const runoff = Math.max(0, Math.min(1, (slope.gullyRunoff ?? 40) / 100));

                // Downhill direction in XZ plane is along (wnx, wnz), cross-slope is (-wnz, wnx)
                const hLen = Math.hypot(wnx, wnz);
                const downX = hLen > 1e-3 ? wnx / hLen : 0.707;
                const downZ = hLen > 1e-3 ? wnz / hLen : 0.707;
                const crossX = -downZ;
                const crossZ = downX;

                // Project vertex onto cross-slope and downhill axes
                const uCross = nxCoord * crossX + nzCoord * crossZ;
                const vDown = nxCoord * downX + nzCoord * downZ;

                // When gullyRunoff > 0, compress frequency along downhill axis and stretch cross-slope to form downhill ruts
                const crossFreq = freq * (1.0 + runoff * 1.6);
                const downFreq = freq * (1.0 - runoff * 0.65);

                const n1 = smoothNoise3D(
                    uCross * crossFreq,
                    normY * downFreq,
                    vDown * downFreq,
                    seed + 73
                );
                const n2 = smoothNoise3D(
                    uCross * crossFreq * 2.15,
                    normY * downFreq * 2.15,
                    vDown * downFreq * 2.15,
                    seed + 191
                );

                // Extract sunken basins/troughs: values below threshold carve inward
                const rawField = n1 * 0.7 + n2 * 0.3; // in [0, 1]
                // Create pocket depressions & gully channels
                const pocket = Math.max(0, 1.0 - rawField * 1.65); // 0 on high ground, up to 1 in dip centers
                const gullyChannel = Math.pow(1.0 - Math.abs(n1 * 2.0 - 1.0), 1.5 + sharp * 2.5);

                const combinedDip =
                    pocket * (1.0 - runoff * 0.55) +
                    gullyChannel * (0.35 + runoff * 0.65);
                const shapedDip = Math.pow(Math.max(0, Math.min(1, combinedDip)), 1.1 + sharp * 1.4);

                // Carve inward (negative normal displacement) in dips
                const dipCarve = -shapedDip * slope.dipAmplitude * unitScale * 1.45;
                totalNormalDelta += dipCarve;
                dipDepthNormalized += shapedDip;
            }

            // 5. Pin outer tile/ramp connection borders so adjacent slope tiles stitch cleanly
            if (pinPct > 0) {
                const fadeLow = Math.min(1, normY / Math.max(0.02, pinPct * 0.3));
                const fadeHigh = Math.min(1, (1.0 - normY) / Math.max(0.02, pinPct * 0.3));
                const borderX = Math.min(nxCoord, 1.0 - nxCoord);
                const borderZ = Math.min(nzCoord, 1.0 - nzCoord);
                const fadeSide = Math.min(1, Math.min(borderX, borderZ) / Math.max(0.01, pinPct * 0.18));
                const pinWeight =
                    fadeLow * fadeLow * (3 - 2 * fadeLow) *
                    (fadeHigh * fadeHigh * (3 - 2 * fadeHigh)) *
                    (0.35 + 0.65 * fadeSide);
                totalNormalDelta *= pinWeight;
                totalVerticalDelta *= pinWeight;
            }

            // 6. Crest & Toe Corner Rounding / Bevel
            let bevelDy = 0;
            if (bevelPct > 0.01) {
                const cornerZone = 4.0 * slopeMask * (1.0 - slopeMask);
                if (normY > 0.65) {
                    const topRim = (normY - 0.65) / 0.35;
                    bevelDy = -topRim * topRim * bevelPct * cornerZone * unitScale * 0.45;
                } else if (normY < 0.35) {
                    const botToe = (0.35 - normY) / 0.35;
                    bevelDy = botToe * botToe * bevelPct * cornerZone * unitScale * 0.35;
                }
            }

            const finalDx = wnx * totalNormalDelta * slopeMask;
            const finalDy = (wny * totalNormalDelta + totalVerticalDelta) * slopeMask + bevelDy;
            const finalDz = wnz * totalNormalDelta * slopeMask;

            posAttr.setXYZ(i, vx + finalDx, vy + finalDy, vz + finalDz);
            dipDepthArray[i] = Math.max(0, Math.min(1, dipDepthNormalized * slopeMask));
        }

        // Enforce spatial seam welding so shared vertices across ramp faces stay 100% connected
        if (weldInfo) {
            enforceWeldedVertexPositions(posAttr, weldInfo, [dipDepthArray]);
        }

        posAttr.needsUpdate = true;
        geo.setAttribute('aSlopeDipDepth', new THREE.BufferAttribute(dipDepthArray, 1));
        geo.computeVertexNormals();

        // Smooth normals across crest & toe when Crest Bevel > 0
        if (bevelPct > 0.01) {
            const computedNorm = geo.attributes.normal as THREE.BufferAttribute;
            const smoothWelded = computeSpatialWeldedNormals(posAttr, computedNorm);
            for (let i = 0; i < posAttr.count; i++) {
                const fnx = computedNorm.getX(i);
                const fny = computedNorm.getY(i);
                const fnz = computedNorm.getZ(i);
                const snx = smoothWelded[i * 3];
                const sny = smoothWelded[i * 3 + 1];
                const snz = smoothWelded[i * 3 + 2];
                const blend = bevelPct * 0.65;
                const bx = fnx * (1 - blend) + snx * blend;
                const by = fny * (1 - blend) + sny * blend;
                const bz = fnz * (1 - blend) + snz * blend;
                const len = Math.hypot(bx, by, bz) || 1;
                computedNorm.setXYZ(i, bx / len, by / len, bz / len);
            }
            computedNorm.needsUpdate = true;
        }
    });
}
