import * as THREE from 'three';
import type { ThreeDCliffShapingSettings, ThreeDObject } from '../types';
import { DEFAULT_CLIFF_SHAPING_SETTINGS } from './threeDCliffPresets';
import { isProceduralPlaneUrl } from './layerTo3DPlaneUtils';
import {
    buildSpatialVertexWeldInfo,
    enforceWeldedVertexPositions,
} from './threeDMeshWeldHelper';

interface CachedWallDepthMap {
    signature: string;
    width: number;
    height: number;
    heights: Float32Array;
}

const wallDepthCache = new Map<string, CachedWallDepthMap>();

function loadRawImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * Generates or retrieves a normalized [0, 1] height/depth buffer for the cliff wall
 * from `wallDepthMapUrl`, `wallTextureUrl`, or a rendered 2D layer canvas.
 */
async function getWallDepthBuffer(
    sourceUrl: string | undefined,
    fallbackCanvas: HTMLCanvasElement | null | undefined,
    cliff: ThreeDCliffShapingSettings
): Promise<{ heights: Float32Array; width: number; height: number } | null> {
    if (!sourceUrl && !fallbackCanvas) return null;

    const sigKey = sourceUrl
        ? sourceUrl.length > 120
            ? `${sourceUrl.slice(0, 60)}_${sourceUrl.slice(-40)}_${sourceUrl.length}`
            : sourceUrl
        : `canvas_${fallbackCanvas?.width}x${fallbackCanvas?.height}`;

    const sig = JSON.stringify({
        sigKey,
        contrast: cliff.wallDepthContrast ?? 120,
        blur: cliff.wallDepthBlur ?? 1,
        invert: !!cliff.wallDepthInvert,
    });

    const cached = wallDepthCache.get(sig);
    if (cached) {
        return { heights: cached.heights, width: cached.width, height: cached.height };
    }

    let sourceEl: HTMLImageElement | HTMLCanvasElement | null = fallbackCanvas || null;
    if (sourceUrl) {
        const loaded = await loadRawImage(sourceUrl);
        if (loaded) sourceEl = loaded;
    }
    if (!sourceEl) return null;

    const srcW = sourceEl.width || 256;
    const srcH = sourceEl.height || 256;
    const maxRes = 384;
    const aspect = srcW / Math.max(1, srcH);
    const w = aspect >= 1 ? Math.min(maxRes, srcW) : Math.max(32, Math.round(Math.min(maxRes, srcH) * aspect));
    const h = aspect >= 1 ? Math.max(32, Math.round(w / aspect)) : Math.min(maxRes, srcH);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const blurPx = Math.max(0, cliff.wallDepthBlur ?? 1);
    if (blurPx > 0) {
        ctx.filter = `blur(${blurPx}px)`;
    }
    ctx.drawImage(sourceEl, 0, 0, w, h);
    ctx.filter = 'none';

    const imgData = ctx.getImageData(0, 0, w, h).data;
    const heights = new Float32Array(w * h);
    const contrastFactor = Math.max(0, cliff.wallDepthContrast ?? 120) / 100;
    const inv = !!cliff.wallDepthInvert;

    for (let i = 0, p = 0; i < imgData.length; i += 4, p++) {
        const r = imgData[i] / 255;
        const g = imgData[i + 1] / 255;
        const b = imgData[i + 2] / 255;
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (inv) lum = 1.0 - lum;
        lum = (lum - 0.5) * contrastFactor + 0.5;
        heights[p] = Math.max(0, Math.min(1, lum));
    }

    if (wallDepthCache.size > 16) {
        const firstKey = wallDepthCache.keys().next().value;
        if (firstKey) wallDepthCache.delete(firstKey);
    }
    wallDepthCache.set(sig, { signature: sig, width: w, height: h, heights });

    return { heights, width: w, height: h };
}

function sampleWrappedBilinear(
    heights: Float32Array,
    width: number,
    height: number,
    u: number,
    v: number
): number {
    // Wrap u, v into [0, 1)
    const wu = ((u % 1) + 1) % 1;
    const wv = ((1.0 - v) % 1 + 1) % 1;

    const x = wu * width;
    const y = wv * height;
    const x0 = Math.floor(x) % width;
    const y0 = Math.floor(y) % height;
    const x1 = (x0 + 1) % width;
    const y1 = (y0 + 1) % height;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);

    const h00 = heights[y0 * width + x0];
    const h10 = heights[y0 * width + x1];
    const h01 = heights[y1 * width + x0];
    const h11 = heights[y1 * width + x1];

    const top = h00 + (h10 - h00) * fx;
    const bottom = h01 + (h11 - h01) * fx;
    return top + (bottom - top) * fy;
}

/**
 * Deterministic 3D value noise for rock strata and vertical crag sculpting.
 */
function hash3D(ix: number, iy: number, iz: number, seed: number): number {
    let n = ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise3D(x: number, y: number, z: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;

    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const w = fz * fz * (3 - 2 * fz);

    const c000 = hash3D(ix, iy, iz, seed);
    const c100 = hash3D(ix + 1, iy, iz, seed);
    const c010 = hash3D(ix, iy + 1, iz, seed);
    const c110 = hash3D(ix + 1, iy + 1, iz, seed);
    const c001 = hash3D(ix, iy, iz + 1, seed);
    const c101 = hash3D(ix + 1, iy, iz + 1, seed);
    const c011 = hash3D(ix, iy + 1, iz + 1, seed);
    const c111 = hash3D(ix + 1, iy + 1, iz + 1, seed);

    const x00 = c000 + (c100 - c000) * u;
    const x10 = c010 + (c110 - c010) * u;
    const x01 = c001 + (c101 - c001) * u;
    const x11 = c011 + (c111 - c011) * u;

    const y0 = x00 + (x10 - x00) * v;
    const y1 = x01 + (x11 - x01) * v;

    return y0 + (y1 - y0) * w;
}

/**
 * Non-destructively subdivides a BufferGeometry by splitting each triangle into 4 sub-triangles
 * per level, while welding coincident vertices so displaced cliff faces remain watertight.
 */
export function buildSubdividedWeldedGeometry(
    sourceGeo: THREE.BufferGeometry,
    levels: number
): THREE.BufferGeometry {
    let current = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();
    const clampedLevels = Math.max(0, Math.min(3, Math.round(levels)));

    for (let lvl = 0; lvl < clampedLevels; lvl++) {
        const pos = current.attributes.position as THREE.BufferAttribute;
        const norm = current.attributes.normal as THREE.BufferAttribute | undefined;
        const uv = current.attributes.uv as THREE.BufferAttribute | undefined;
        const triCount = Math.floor(pos.count / 3);

        // Guard against excessive vertex explosion on already high-poly models
        if (triCount > 45000) break;

        const nextPos = new Float32Array(triCount * 12 * 3);
        const nextNorm = norm ? new Float32Array(triCount * 12 * 3) : null;
        const nextUv = uv ? new Float32Array(triCount * 12 * 2) : null;

        let outV = 0;
        const pushVertex = (
            px: number, py: number, pz: number,
            nx: number, ny: number, nz: number,
            ux: number, uy: number
        ) => {
            nextPos[outV * 3] = px;
            nextPos[outV * 3 + 1] = py;
            nextPos[outV * 3 + 2] = pz;
            if (nextNorm) {
                const len = Math.hypot(nx, ny, nz) || 1;
                nextNorm[outV * 3] = nx / len;
                nextNorm[outV * 3 + 1] = ny / len;
                nextNorm[outV * 3 + 2] = nz / len;
            }
            if (nextUv) {
                nextUv[outV * 2] = ux;
                nextUv[outV * 2 + 1] = uy;
            }
            outV++;
        };

        for (let t = 0; t < triCount; t++) {
            const i0 = t * 3;
            const i1 = t * 3 + 1;
            const i2 = t * 3 + 2;

            const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
            const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
            const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);

            const nx0 = norm ? norm.getX(i0) : 0, ny0 = norm ? norm.getY(i0) : 1, nz0 = norm ? norm.getZ(i0) : 0;
            const nx1 = norm ? norm.getX(i1) : 0, ny1 = norm ? norm.getY(i1) : 1, nz1 = norm ? norm.getZ(i1) : 0;
            const nx2 = norm ? norm.getX(i2) : 0, ny2 = norm ? norm.getY(i2) : 1, nz2 = norm ? norm.getZ(i2) : 0;

            const u0 = uv ? uv.getX(i0) : 0, v0 = uv ? uv.getY(i0) : 0;
            const u1 = uv ? uv.getX(i1) : 0, v1 = uv ? uv.getY(i1) : 0;
            const u2 = uv ? uv.getX(i2) : 0, v2 = uv ? uv.getY(i2) : 0;

            // Midpoints 01, 12, 20
            const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5, z01 = (z0 + z1) * 0.5;
            const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5, z12 = (z1 + z2) * 0.5;
            const x20 = (x2 + x0) * 0.5, y20 = (y2 + y0) * 0.5, z20 = (z2 + z0) * 0.5;

            const nx01 = (nx0 + nx1) * 0.5, ny01 = (ny0 + ny1) * 0.5, nz01 = (nz0 + nz1) * 0.5;
            const nx12 = (nx1 + nx2) * 0.5, ny12 = (ny1 + ny2) * 0.5, nz12 = (nz1 + nz2) * 0.5;
            const nx20 = (nx2 + nx0) * 0.5, ny20 = (ny2 + ny0) * 0.5, nz20 = (nz2 + nz0) * 0.5;

            const u01 = (u0 + u1) * 0.5, v01 = (v0 + v1) * 0.5;
            const u12 = (u1 + u2) * 0.5, v12 = (v1 + v2) * 0.5;
            const u20 = (u2 + u0) * 0.5, v20 = (v2 + v0) * 0.5;

            // Tri 1: 0, 01, 20
            pushVertex(x0, y0, z0, nx0, ny0, nz0, u0, v0);
            pushVertex(x01, y01, z01, nx01, ny01, nz01, u01, v01);
            pushVertex(x20, y20, z20, nx20, ny20, nz20, u20, v20);

            // Tri 2: 01, 1, 12
            pushVertex(x01, y01, z01, nx01, ny01, nz01, u01, v01);
            pushVertex(x1, y1, z1, nx1, ny1, nz1, u1, v1);
            pushVertex(x12, y12, z12, nx12, ny12, nz12, u12, v12);

            // Tri 3: 20, 12, 2
            pushVertex(x20, y20, z20, nx20, ny20, nz20, u20, v20);
            pushVertex(x12, y12, z12, nx12, ny12, nz12, u12, v12);
            pushVertex(x2, y2, z2, nx2, ny2, nz2, u2, v2);

            // Tri 4: 01, 12, 20
            pushVertex(x01, y01, z01, nx01, ny01, nz01, u01, v01);
            pushVertex(x12, y12, z12, nx12, ny12, nz12, u12, v12);
            pushVertex(x20, y20, z20, nx20, ny20, nz20, u20, v20);
        }

        const nextGeo = new THREE.BufferGeometry();
        nextGeo.setAttribute('position', new THREE.BufferAttribute(nextPos, 3));
        if (nextNorm) nextGeo.setAttribute('normal', new THREE.BufferAttribute(nextNorm, 3));
        if (nextUv) nextGeo.setAttribute('uv', new THREE.BufferAttribute(nextUv, 2));
        current.dispose();
        current = nextGeo;
    }

    return current;
}

/**
 * Computes welded smooth normals by spatial position key so that adjacent triangles on
 * a GLB cliff face displace together without cracking apart at hard edges, while also
 * returning each vertex's face-averaged slope normal.
 */
export function computeSpatialWeldedNormals(posAttr: THREE.BufferAttribute, faceNormAttr: THREE.BufferAttribute): Float32Array {
    const count = posAttr.count;
    const welded = new Float32Array(count * 3);
    const accum = new Map<string, [number, number, number]>();

    for (let i = 0; i < count; i++) {
        const kx = Math.round(posAttr.getX(i) * 10000);
        const ky = Math.round(posAttr.getY(i) * 10000);
        const kz = Math.round(posAttr.getZ(i) * 10000);
        const key = `${kx}_${ky}_${kz}`;

        const nx = faceNormAttr.getX(i);
        const ny = faceNormAttr.getY(i);
        const nz = faceNormAttr.getZ(i);

        const existing = accum.get(key);
        if (existing) {
            existing[0] += nx;
            existing[1] += ny;
            existing[2] += nz;
        } else {
            accum.set(key, [nx, ny, nz]);
        }
    }

    for (let i = 0; i < count; i++) {
        const kx = Math.round(posAttr.getX(i) * 10000);
        const ky = Math.round(posAttr.getY(i) * 10000);
        const kz = Math.round(posAttr.getZ(i) * 10000);
        const key = `${kx}_${ky}_${kz}`;
        const sum = accum.get(key)!;
        const len = Math.hypot(sum[0], sum[1], sum[2]) || 1;
        welded[i * 3] = sum[0] / len;
        welded[i * 3 + 1] = sum[1] / len;
        welded[i * 3 + 2] = sum[2] / len;
    }

    return welded;
}

/**
 * Evaluates the smooth slope mask [0 = Flat Horizontal Plane, 1 = Steep Vertical Cliff Wall]
 * given the absolute vertical normal component |ny|.
 */
export function evaluateCliffSlopeMask(
    absNy: number,
    slopeThresholdDeg: number,
    slopeFeatherDeg: number,
    invert: boolean = false
): number {
    // At angle = 0 deg (flat horizontal plane), |ny| = cos(0) = 1.0
    // At angle = 90 deg (vertical wall), |ny| = cos(90) = 0.0
    const deg = Math.acos(Math.max(0, Math.min(1, absNy))) * (180 / Math.PI);
    const halfFeather = Math.max(0.5, slopeFeatherDeg * 0.5);
    const edge0 = slopeThresholdDeg - halfFeather;
    const edge1 = slopeThresholdDeg + halfFeather;

    const t = Math.max(0, Math.min(1, (deg - edge0) / Math.max(0.001, edge1 - edge0)));
    const smooth = t * t * (3 - 2 * t);
    return invert ? 1.0 - smooth : smooth;
}

/**
 * Applies Angle-Aware Cliff Shaping & Depth Sculpting to a 3D model's meshes.
 * Called inside ThreeDCanvas right after standard height/plane displacement.
 */
export async function applyCliffShapingToModel(
    model: THREE.Group,
    obj: ThreeDObject,
    wallOverlayCanvas?: HTMLCanvasElement | null
): Promise<void> {
    const cliff: ThreeDCliffShapingSettings = {
        ...DEFAULT_CLIFF_SHAPING_SETTINGS,
        ...(obj.cliffShapingSettings || {}),
    };

    const hasAnyCliffDeformation =
        Math.abs(cliff.wallNormalPush ?? 0) > 1e-4 ||
        Math.abs(cliff.wallDepthScale ?? 0) > 1e-4 ||
        Math.abs(cliff.flatTopDepthScale ?? 0) > 1e-4 ||
        (Boolean(cliff.strataEnabled) && Math.abs(cliff.strataAmplitude ?? 0) > 1e-4) ||
        (Boolean(cliff.cragEnabled) && Math.abs(cliff.cragAmplitude ?? 0) > 1e-4) ||
        Math.abs(cliff.overhangAmount ?? 0) > 1e-4 ||
        Math.abs(cliff.talusSkirtAmount ?? 0) > 1e-4 ||
        (cliff.topGroundBevel ?? 0) > 0.5;

    const hasWallTextureVisuals = !!(
        cliff.dualTextureEnabled &&
        (cliff.wallTextureUrl || cliff.wallOverlayId || cliff.wallNormalMapUrl || cliff.wallRoughnessMapUrl || cliff.wallDepthMapUrl)
    );

    if (!cliff.enabled || !hasAnyCliffDeformation) {
        if (hasWallTextureVisuals) {
            model.traverse((child) => {
                if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
                if (!(child as THREE.Mesh).isMesh) return;
                const geo = (child as THREE.Mesh).geometry;
                const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
                if (!posAttr) return;
                if (!geo.attributes.normal) geo.computeVertexNormals();
                const normAttr = geo.attributes.normal as THREE.BufferAttribute;
                const shaderWallMaskArray = new Float32Array(posAttr.count);
                for (let i = 0; i < posAttr.count; i++) {
                    const fny = Math.abs(normAttr.getY(i));
                    shaderWallMaskArray[i] = evaluateCliffSlopeMask(
                        fny,
                        cliff.slopeThreshold ?? 32,
                        cliff.slopeFeather ?? 10,
                        !!cliff.invertSlopeMask
                    );
                }
                geo.setAttribute('aCliffSlopeMask', new THREE.BufferAttribute(shaderWallMaskArray, 1));
            });
        }
        return;
    }

    // Load Wall Depth Map buffer if needed for angle-aware wall depth displacement
    const wallDepthSource = cliff.wallDepthMapUrl || cliff.wallTextureUrl || obj.displacementMapUrl || obj.textureUrl;
    const needDepthBuffer = Math.abs(cliff.wallDepthScale ?? 0) > 1e-4 || Math.abs(cliff.flatTopDepthScale ?? 0) > 1e-4;
    const depthBuffer = needDepthBuffer
        ? await getWallDepthBuffer(wallDepthSource, wallOverlayCanvas, cliff)
        : null;

    const seed = Math.round(cliff.cliffSeed ?? 4096);
    const scaleU = (cliff.wallScale || 1) * (cliff.wallRepeatX || 1);
    const scaleV = (cliff.wallScale || 1) * (cliff.wallRepeatY || 1);
    const offU = cliff.wallOffsetX || 0;
    const offV = cliff.wallOffsetY || 0;

    model.traverse((child) => {
        if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const geo = mesh.geometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
        if (!posAttr) return;

        // If standard displacement hasn't run, reset to basePositions before sculpting
        const hasStandardDisp = obj.displacementSettings?.enabled || obj.displacementSettings?.terrainEnabled;
        if (!hasStandardDisp && geo.userData.basePositions) {
            posAttr.copy(geo.userData.basePositions as THREE.BufferAttribute);
        }

        geo.computeVertexNormals();
        const normAttr = geo.attributes.normal as THREE.BufferAttribute;
        const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;

        // Compute bounding box of current mesh and actual vertical cliff wall Y range
        geo.computeBoundingBox();
        const bbox = geo.boundingBox || new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
        const sizeVec = new THREE.Vector3();
        bbox.getSize(sizeVec);
        const refSize = Math.max(0.1, Math.max(sizeVec.x, sizeVec.y, sizeVec.z));
        // Normalize displacement amplitude relative to model's local coordinate scale
        const unitScale = refSize * 0.04;

        // Measure actual vertical extent of steep cliff-wall faces so top-ground transition
        // and vertical rock sculpting anchor to the cliff wall itself rather than an elevated rear plateau
        let wallMinY = Infinity;
        let wallMaxY = -Infinity;
        const cosWallCheck = Math.cos((Math.max(10, Math.min(80, cliff.slopeThreshold ?? 32)) * Math.PI) / 180);
        for (let i = 0; i < posAttr.count; i++) {
            const ny = Math.abs(normAttr.getY(i));
            if (ny <= cosWallCheck) {
                const vy = posAttr.getY(i);
                if (vy < wallMinY) wallMinY = vy;
                if (vy > wallMaxY) wallMaxY = vy;
            }
        }
        const minY = isFinite(wallMinY) ? wallMinY : bbox.min.y;
        const maxY = isFinite(wallMaxY) && wallMaxY > minY + 0.001 ? wallMaxY : bbox.max.y;
        const spanY = Math.max(0.001, maxY - minY);

        // Compute welded vertex clusters and smooth normals so adjacent faces push outward together without splitting seams
        const weldEnabled = cliff.weldVertices ?? true;
        const weldTolerance = cliff.weldTolerance ?? 35;
        const basePosAttr = (geo.userData.basePositions as THREE.BufferAttribute | undefined) || posAttr;
        const weldInfo = weldEnabled
            ? buildSpatialVertexWeldInfo(basePosAttr, normAttr, refSize, weldTolerance)
            : null;
        const weldedNormals = weldInfo
            ? weldInfo.weldedNormals
            : computeSpatialWeldedNormals(posAttr, normAttr);

        // Store per-vertex slope mask attribute (`aCliffSlopeMask`) so shader can also use it
        const slopeMaskArray = new Float32Array(posAttr.count);
        const shaderWallMaskArray = new Float32Array(posAttr.count);

        const pinPct = Math.max(0, Math.min(100, cliff.pinBottomEdge ?? 25)) / 100;
        const topTransPct = Math.max(0, Math.min(85, cliff.topGroundTransition ?? 8)) / 100;
        const topFeatherPct = Math.max(0.5, Math.min(60, cliff.topGroundFeather ?? 8)) / 100;
        const topDropPct = Math.max(-50, Math.min(50, cliff.topGroundDrop ?? 0)) / 100;
        const topNoisePct = Math.max(0, Math.min(100, cliff.topGroundNoise ?? 25)) / 100;
        const topBevelPct = Math.max(0, Math.min(100, cliff.topGroundBevel ?? 15)) / 100;

        const tiltRad = ((cliff.strataTilt ?? 0) * Math.PI) / 180;
        const tiltSin = Math.sin(tiltRad);
        const tiltCos = Math.cos(tiltRad);

        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);

            // Use canonical welded position for noise/angle evaluation when welding is active so shared vertices evaluate identically
            const evalX = weldInfo ? weldInfo.canonicalBasePositions[i * 3] : vx;
            const evalY = weldInfo ? weldInfo.canonicalBasePositions[i * 3 + 1] : vy;
            const evalZ = weldInfo ? weldInfo.canonicalBasePositions[i * 3 + 2] : vz;

            // Use welded normal for smooth displacement direction, and face normal to preserve steep wall detection
            const wnx = weldedNormals[i * 3];
            const wny = weldedNormals[i * 3 + 1];
            const wnz = weldedNormals[i * 3 + 2];

            const fnx = normAttr.getX(i);
            const fny = normAttr.getY(i);
            const fnz = normAttr.getZ(i);

            // Normalized vertical position along cliff [0 = bottom base, 1 = top plateau lip]
            const normY = Math.max(0, Math.min(1, (evalY - minY) / spanY));

            // Normalized spatial coordinates in [0, 1] for scale-independent procedural rock noise
            const nxCoord = (evalX - bbox.min.x) / Math.max(0.001, sizeVec.x || refSize);
            const nzCoord = (evalZ - bbox.min.z) / Math.max(0.001, sizeVec.z || refSize);

            // Top Ground Rim Transition factor (0 on cliff wall, 1 only on the very top lip corner)
            let topRimBlend = 0;
            if (topTransPct > 0.001 || Math.abs(topDropPct) > 0.001) {
                const rimNoise =
                    (smoothNoise3D(nxCoord * 4.5, normY * 3.0, nzCoord * 4.5, seed + 311) * 2 - 1) *
                    topNoisePct *
                    0.12;
                const effectiveY = normY + topDropPct * 0.65 + rimNoise;
                const rimDepth = topTransPct * 0.45;
                const rimFeather = Math.max(0.01, topFeatherPct * 0.35);
                const rimStart = 1.0 - rimDepth;
                const edge0 = rimStart - rimFeather;
                const edge1 = rimStart + rimFeather * 0.5;
                const tRim = Math.max(0, Math.min(1, (effectiveY - edge0) / Math.max(0.001, edge1 - edge0)));
                topRimBlend = tRim * tRim * (3 - 2 * tRim);
            }

            // Use the steeper of face normal vs welded normal so top-lip vertices shared with the flat plateau
            // still recognize that they belong to the steep cliff wall!
            const faceAbsNy = Math.abs(fny);
            const weldAbsNy = Math.abs(wny);
            const steepNy = Math.min(faceAbsNy, weldAbsNy);

            const pureWallMask = evaluateCliffSlopeMask(
                steepNy,
                cliff.slopeThreshold ?? 32,
                cliff.slopeFeather ?? 10,
                !!cliff.invertSlopeMask
            );
            // Save un-attenuated wall mask for the fragment shader so the cliff wall texture is NEVER lost on vertical faces
            shaderWallMaskArray[i] = pureWallMask;

            const cliffMask = pureWallMask * (1.0 - topRimBlend * 0.45);
            slopeMaskArray[i] = cliffMask;
            const flatMask = 1.0 - pureWallMask;

            // Horizontal outward wall normal (projected onto XZ plane)
            const horizLen = Math.hypot(wnx, wnz);
            const fHorizLen = Math.hypot(fnx, fnz);
            const hnx = horizLen > 1e-4 ? wnx / horizLen : fHorizLen > 1e-4 ? fnx / fHorizLen : 0;
            const hnz = horizLen > 1e-4 ? wnz / horizLen : fHorizLen > 1e-4 ? fnz / fHorizLen : 0;

            let wallOutwardDelta = 0;
            let flatVerticalDelta = 0;

            // 1. Uniform Cliff Wall Normal Push
            if (cliff.wallNormalPush) {
                wallOutwardDelta += cliff.wallNormalPush * unitScale;
            }

            // 2. Angle-Aware Depth / Height Map Displacement (Separate Wall vs Flat Top)
            if (depthBuffer) {
                let sampleU = uvAttr ? uvAttr.getX(i) : nxCoord;
                let sampleV = uvAttr ? uvAttr.getY(i) : normY;

                if (cliff.wallTriplanar || weldEnabled) {
                    // Triplanar coordinate based on dominant horizontal normal axis so UV seams never split vertices
                    const absX = Math.abs(hnx);
                    const absZ = Math.abs(hnz);
                    sampleU = absX > absZ ? nzCoord : nxCoord;
                    sampleV = normY;
                }

                const hSample = sampleWrappedBilinear(
                    depthBuffer.heights,
                    depthBuffer.width,
                    depthBuffer.height,
                    sampleU * scaleU + offU,
                    sampleV * scaleV + offV
                );

                if (Math.abs(cliff.wallDepthScale) > 1e-4) {
                    wallOutwardDelta += (hSample - 0.5) * cliff.wallDepthScale * unitScale * 1.6;
                }
                if (Math.abs(cliff.flatTopDepthScale) > 1e-4) {
                    flatVerticalDelta += (hSample - 0.5) * cliff.flatTopDepthScale * unitScale * 1.6;
                }
            }

            // 3. Horizontal Sedimentary Rock Strata / Stepped Ledges
            if (cliff.strataEnabled && Math.abs(cliff.strataAmplitude) > 1e-4) {
                const freq = Math.max(0.5, cliff.strataFrequency ?? 5.0);
                // Tilted bedding plane coordinate
                const beddingY = normY * tiltCos + (nxCoord - 0.5) * tiltSin;
                const phase = beddingY * freq * Math.PI * 2;
                const wave = Math.sin(phase);
                // Add subtle 3D rock variation along the strata band
                const bandNoise = smoothNoise3D(nxCoord * 3.5, beddingY * freq, nzCoord * 3.5, seed + 17) * 2 - 1;
                const sharp = Math.max(0, Math.min(1, (cliff.strataSharpness ?? 55) / 100));
                // Blend between smooth sine wave and sharp terraced saw/step ledge
                const stepped = Math.tanh(wave * (1 + sharp * 6)) * 0.75 + ( ((beddingY * freq) % 1 + 1) % 1 - 0.5 ) * sharp * 0.5;
                const strataVal = wave * (1 - sharp) + stepped * sharp + bandNoise * 0.25;
                wallOutwardDelta += strataVal * cliff.strataAmplitude * unitScale;
            }

            // 4. Vertical Rock Crags, Crevices & Fissure Columns
            if (cliff.cragEnabled && Math.abs(cliff.cragAmplitude) > 1e-4) {
                const cFreq = Math.max(0.5, cliff.cragFrequency ?? 3.5);
                const rSharp = Math.max(0, Math.min(1, (cliff.cragSharpness ?? 60) / 100));

                // Multi-octave cellular/ridge noise stretched vertically (columns/crevices)
                const n1 = smoothNoise3D(nxCoord * cFreq * 2, normY * cFreq * 0.7, nzCoord * cFreq * 2, seed + 101);
                const n2 = smoothNoise3D(nxCoord * cFreq * 4.1, normY * cFreq * 1.4, nzCoord * cFreq * 4.1, seed + 203);
                const ridge1 = 1.0 - Math.abs(n1 * 2.0 - 1.0);
                const ridge2 = 1.0 - Math.abs(n2 * 2.0 - 1.0);
                const combinedRidge = (ridge1 * 0.7 + ridge2 * 0.3);
                const sharpened = Math.pow(Math.max(0, combinedRidge), 1 + rSharp * 2.5);
                const smoothSigned = (n1 * 0.7 + n2 * 0.3) * 2.0 - 1.0;

                const cragVal = smoothSigned * (1 - rSharp) + (sharpened * 2.0 - 1.0) * rSharp;
                wallOutwardDelta += cragVal * cliff.cragAmplitude * unitScale;
            }

            // 5. Cliff Top Lip Overhang (pushes upper 35% of cliff wall outward)
            if (Math.abs(cliff.overhangAmount) > 1e-4) {
                const lipZone = Math.max(0, (normY - 0.55) / 0.45);
                const lipCurve = lipZone * lipZone * (3 - 2 * lipZone);
                wallOutwardDelta += lipCurve * cliff.overhangAmount * unitScale * 1.5;
            }

            // 6. Talus Base Skirt (flares lower 40% of cliff wall outward)
            if (Math.abs(cliff.talusSkirtAmount) > 1e-4) {
                const baseZone = Math.max(0, (0.45 - normY) / 0.45);
                const baseCurve = baseZone * baseZone;
                wallOutwardDelta += baseCurve * cliff.talusSkirtAmount * unitScale * 1.5;
            }

            // 7. Bottom / Tile Connection Edge Pinning so adjacent cliff tiles meet seamlessly
            if (pinPct > 0) {
                const bottomFade = Math.min(1, normY / Math.max(0.02, pinPct * 0.35));
                const topLipLock = Math.min(1, (1.0 - normY) / Math.max(0.01, pinPct * 0.12));
                const edgeAttenuation = bottomFade * bottomFade * (3 - 2 * bottomFade) * (0.35 + 0.65 * topLipLock);
                wallOutwardDelta *= edgeAttenuation;
            }

            // 8. Top Ground Rim Bevel (gently rounds the sharp 90° top cliff edge where wall meets top dirt)
            let bevelDy = 0;
            if (topBevelPct > 0.01 && normY > 0.78) {
                const rimZone = (normY - 0.78) / 0.22;
                // Only bevel vertices that sit right on the lip corner (where welded normal has both horizontal and vertical components)
                const cornerFactor = 4.0 * cliffMask * (1.0 - cliffMask) + 0.35 * (1.0 - Math.abs(wny));
                bevelDy = -rimZone * rimZone * topBevelPct * cornerFactor * unitScale * 0.5;
            }

            const finalDx = hnx * wallOutwardDelta * cliffMask;
            const finalDz = hnz * wallOutwardDelta * cliffMask;
            const finalDy = wny * wallOutwardDelta * cliffMask * 0.25 + flatVerticalDelta * flatMask + bevelDy;

            posAttr.setXYZ(i, vx + finalDx, vy + finalDy, vz + finalDz);
        }

        // Enforce spatial seam welding so shared vertices across faces stay 100% locked together
        // Note: We do NOT average `shaderWallMaskArray` across flat/vertical seams so vertical cliff triangles
        // keep their full 1.0 cliff wall mask right up to the top lip edge!
        if (weldInfo) {
            enforceWeldedVertexPositions(posAttr, weldInfo);
        }

        posAttr.needsUpdate = true;
        geo.setAttribute('aCliffSlopeMask', new THREE.BufferAttribute(shaderWallMaskArray, 1));
        geo.computeVertexNormals();

        // Smooth normals ONLY right at the top lip corner (normY > 0.85) when Top Lip Bevel > 0,
        // without tilting the rest of the vertical cliff wall normals upward
        if (topBevelPct > 0.01) {
            const computedNorm = geo.attributes.normal as THREE.BufferAttribute;
            const smoothWelded = computeSpatialWeldedNormals(posAttr, computedNorm);
            for (let i = 0; i < posAttr.count; i++) {
                const vy = posAttr.getY(i);
                const normY = Math.max(0, Math.min(1, (vy - minY) / spanY));
                if (normY > 0.85) {
                    const rimWeight = Math.min(1, ((normY - 0.85) / 0.15) * topBevelPct * 0.55);
                    const fnx = computedNorm.getX(i);
                    const fny = computedNorm.getY(i);
                    const fnz = computedNorm.getZ(i);
                    const snx = smoothWelded[i * 3];
                    const sny = smoothWelded[i * 3 + 1];
                    const snz = smoothWelded[i * 3 + 2];
                    const bx = fnx * (1 - rimWeight) + snx * rimWeight;
                    const by = fny * (1 - rimWeight) + sny * rimWeight;
                    const bz = fnz * (1 - rimWeight) + snz * rimWeight;
                    const len = Math.hypot(bx, by, bz) || 1;
                    computedNorm.setXYZ(i, bx / len, by / len, bz / len);
                }
            }
            computedNorm.needsUpdate = true;
        }

        geo.computeBoundingBox();
        geo.computeBoundingSphere();
    });
}
