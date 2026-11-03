import * as THREE from 'three';
import type { ThreeDObject, ThreeDSubdivisionSettings } from '../types';
import { isProceduralPlaneUrl } from './layerTo3DPlaneUtils';
import {
    resolvePlaneTileCounts,
    computeTileLockedSubdivisions,
} from './threeDSeamlessTileHelper';
import { DEFAULT_DISPLACEMENT_SETTINGS } from './threeDDisplacementHelper';

export const DEFAULT_SUBDIVISION_SETTINGS: ThreeDSubdivisionSettings = {
    level: 0,
    mode: 'flat',
    smoothStrength: 65,
    creaseAngle: 60,
    bakeVersion: 0,
};

export interface ModelMeshStats {
    baseTriangles: number;
    baseVertices: number;
    activeTriangles: number;
    activeVertices: number;
    clampedByBudget: boolean;
}

const MAX_TRIANGLES_PER_SUBDIV_STEP = 45000;
const liveMeshStatsMap = new Map<string, ModelMeshStats>();

export function getLiveModelMeshStats(objectId: string): ModelMeshStats | null {
    return liveMeshStatsMap.get(objectId) || null;
}

/**
 * Splits every triangle in `sourceGeo` into 4 sub-triangles per level (4^levels),
 * linearly interpolating position, normal, and UV attributes.
 */
export function tessellateGeometryFlat(
    sourceGeo: THREE.BufferGeometry,
    levels: number
): { geometry: THREE.BufferGeometry; clamped: boolean } {
    let current = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();
    const clampedLevels = Math.max(0, Math.min(4, Math.round(levels)));
    let clamped = false;

    for (let lvl = 0; lvl < clampedLevels; lvl++) {
        const pos = current.attributes.position as THREE.BufferAttribute;
        const norm = current.attributes.normal as THREE.BufferAttribute | undefined;
        const uv = current.attributes.uv as THREE.BufferAttribute | undefined;
        const triCount = Math.floor(pos.count / 3);

        if (triCount > MAX_TRIANGLES_PER_SUBDIV_STEP) {
            clamped = true;
            break;
        }

        const nextPos = new Float32Array(triCount * 12 * 3);
        const nextNorm = norm ? new Float32Array(triCount * 12 * 3) : null;
        const nextUv = uv ? new Float32Array(triCount * 12 * 2) : null;

        let outV = 0;
        const pushVertex = (
            px: number,
            py: number,
            pz: number,
            nx: number,
            ny: number,
            nz: number,
            ux: number,
            uy: number
        ) => {
            const p3 = outV * 3;
            nextPos[p3] = px;
            nextPos[p3 + 1] = py;
            nextPos[p3 + 2] = pz;
            if (nextNorm) {
                const len = Math.hypot(nx, ny, nz) || 1;
                nextNorm[p3] = nx / len;
                nextNorm[p3 + 1] = ny / len;
                nextNorm[p3 + 2] = nz / len;
            }
            if (nextUv) {
                const u2 = outV * 2;
                nextUv[u2] = ux;
                nextUv[u2 + 1] = uy;
            }
            outV++;
        };

        for (let t = 0; t < triCount; t++) {
            const i0 = t * 3;
            const i1 = i0 + 1;
            const i2 = i0 + 2;

            const x0 = pos.getX(i0), y0 = pos.getY(i0), z0 = pos.getZ(i0);
            const x1 = pos.getX(i1), y1 = pos.getY(i1), z1 = pos.getZ(i1);
            const x2 = pos.getX(i2), y2 = pos.getY(i2), z2 = pos.getZ(i2);

            const nx0 = norm ? norm.getX(i0) : 0, ny0 = norm ? norm.getY(i0) : 1, nz0 = norm ? norm.getZ(i0) : 0;
            const nx1 = norm ? norm.getX(i1) : 0, ny1 = norm ? norm.getY(i1) : 1, nz1 = norm ? norm.getZ(i1) : 0;
            const nx2 = norm ? norm.getX(i2) : 0, ny2 = norm ? norm.getY(i2) : 1, nz2 = norm ? norm.getZ(i2) : 0;

            const u0 = uv ? uv.getX(i0) : 0, v0 = uv ? uv.getY(i0) : 0;
            const u1 = uv ? uv.getX(i1) : 0, v1 = uv ? uv.getY(i1) : 0;
            const u2 = uv ? uv.getX(i2) : 0, v2 = uv ? uv.getY(i2) : 0;

            const x01 = (x0 + x1) * 0.5, y01 = (y0 + y1) * 0.5, z01 = (z0 + z1) * 0.5;
            const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5, z12 = (z1 + z2) * 0.5;
            const x20 = (x2 + x0) * 0.5, y20 = (y2 + y0) * 0.5, z20 = (z2 + z0) * 0.5;

            const nx01 = (nx0 + nx1) * 0.5, ny01 = (ny0 + ny1) * 0.5, nz01 = (nz0 + nz1) * 0.5;
            const nx12 = (nx1 + nx2) * 0.5, ny12 = (ny1 + ny2) * 0.5, nz12 = (nz1 + nz2) * 0.5;
            const nx20 = (nx2 + nx0) * 0.5, ny20 = (ny2 + ny0) * 0.5, nz20 = (nz2 + nz0) * 0.5;

            const u01 = (u0 + u1) * 0.5, v01 = (v0 + v1) * 0.5;
            const u12 = (u1 + u2) * 0.5, v12 = (v1 + v2) * 0.5;
            const u20 = (u2 + u0) * 0.5, v20 = (v2 + v0) * 0.5;

            // Sub-triangle 1: 0, 01, 20
            pushVertex(x0, y0, z0, nx0, ny0, nz0, u0, v0);
            pushVertex(x01, y01, z01, nx01, ny01, nz01, u01, v01);
            pushVertex(x20, y20, z20, nx20, ny20, nz20, u20, v20);

            // Sub-triangle 2: 01, 1, 12
            pushVertex(x01, y01, z01, nx01, ny01, nz01, u01, v01);
            pushVertex(x1, y1, z1, nx1, ny1, nz1, u1, v1);
            pushVertex(x12, y12, z12, nx12, ny12, nz12, u12, v12);

            // Sub-triangle 3: 20, 12, 2
            pushVertex(x20, y20, z20, nx20, ny20, nz20, u20, v20);
            pushVertex(x12, y12, z12, nx12, ny12, nz12, u12, v12);
            pushVertex(x2, y2, z2, nx2, ny2, nz2, u2, v2);

            // Sub-triangle 4: 01, 12, 20
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

    return { geometry: current, clamped };
}

/**
 * Applies seam-welded, crease-aware Loop/Taubin-style surface smoothing to a non-indexed
 * BufferGeometry so low-poly models become organically rounded without tearing UV seams
 * or collapsing sharp creases above `creaseAngleDeg`.
 */
export function applySmoothSubdivisionRelaxation(
    geo: THREE.BufferGeometry,
    smoothStrengthPct: number,
    creaseAngleDeg: number
): void {
    const strength = Math.max(0, Math.min(100, smoothStrengthPct)) / 100;
    if (strength <= 0.001) return;

    const posAttr = geo.attributes.position as THREE.BufferAttribute | undefined;
    if (!posAttr || posAttr.count < 3) return;

    geo.computeBoundingBox();
    const bbox = geo.boundingBox || new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const sizeVec = new THREE.Vector3();
    bbox.getSize(sizeVec);
    const refSize = Math.max(1e-4, Math.max(sizeVec.x, sizeVec.y, sizeVec.z));
    const weldEps = refSize * 1e-4;
    const invEps = 1.0 / weldEps;

    const vertCount = posAttr.count;
    const triCount = Math.floor(vertCount / 3);

    // 1. Cluster spatially coincident vertices across UV seams
    const clusterMap = new Map<string, number>();
    const vertToCluster = new Int32Array(vertCount);
    const clusterPos: number[] = [];
    const clusterVerts: number[][] = [];

    for (let i = 0; i < vertCount; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const key = `${Math.round(x * invEps)}_${Math.round(y * invEps)}_${Math.round(z * invEps)}`;
        let cIdx = clusterMap.get(key);
        if (cIdx === undefined) {
            cIdx = clusterVerts.length;
            clusterMap.set(key, cIdx);
            clusterVerts.push([i]);
            clusterPos.push(x, y, z);
        } else {
            clusterVerts[cIdx].push(i);
        }
        vertToCluster[i] = cIdx;
    }

    const clusterCount = clusterVerts.length;

    // 2. Compute face normals & build cluster adjacency + edge face normal dot products
    const faceNormals = new Float32Array(triCount * 3);
    const neighbors: Set<number>[] = Array.from({ length: clusterCount }, () => new Set<number>());
    const edgeFaces = new Map<string, number[]>();

    const makeEdgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

    for (let t = 0; t < triCount; t++) {
        const i0 = t * 3;
        const i1 = i0 + 1;
        const i2 = i0 + 2;

        const c0 = vertToCluster[i0];
        const c1 = vertToCluster[i1];
        const c2 = vertToCluster[i2];

        const x0 = clusterPos[c0 * 3], y0 = clusterPos[c0 * 3 + 1], z0 = clusterPos[c0 * 3 + 2];
        const x1 = clusterPos[c1 * 3], y1 = clusterPos[c1 * 3 + 1], z1 = clusterPos[c1 * 3 + 2];
        const x2 = clusterPos[c2 * 3], y2 = clusterPos[c2 * 3 + 1], z2 = clusterPos[c2 * 3 + 2];

        const ux = x1 - x0, uy = y1 - y0, uz = z1 - z0;
        const vx = x2 - x0, vy = y2 - y0, vz = z2 - z0;
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;

        faceNormals[t * 3] = nx;
        faceNormals[t * 3 + 1] = ny;
        faceNormals[t * 3 + 2] = nz;

        if (c0 !== c1) {
            neighbors[c0].add(c1);
            neighbors[c1].add(c0);
            const k01 = makeEdgeKey(c0, c1);
            const f01 = edgeFaces.get(k01);
            if (f01) f01.push(t);
            else edgeFaces.set(k01, [t]);
        }
        if (c1 !== c2) {
            neighbors[c1].add(c2);
            neighbors[c2].add(c1);
            const k12 = makeEdgeKey(c1, c2);
            const f12 = edgeFaces.get(k12);
            if (f12) f12.push(t);
            else edgeFaces.set(k12, [t]);
        }
        if (c2 !== c0) {
            neighbors[c2].add(c0);
            neighbors[c0].add(c2);
            const k20 = makeEdgeKey(c2, c0);
            const f20 = edgeFaces.get(k20);
            if (f20) f20.push(t);
            else edgeFaces.set(k20, [t]);
        }
    }

    // 3. Identify boundary or sharp crease clusters according to creaseAngleDeg
    const cosCrease = Math.cos((Math.max(15, Math.min(180, creaseAngleDeg)) * Math.PI) / 180);
    const isCreaseOrBoundaryCluster = new Uint8Array(clusterCount);
    const creaseNeighbors: Set<number>[] = Array.from({ length: clusterCount }, () => new Set<number>());

    edgeFaces.forEach((tris, key) => {
        const sep = key.indexOf('_');
        const ca = parseInt(key.slice(0, sep), 10);
        const cb = parseInt(key.slice(sep + 1), 10);

        if (tris.length === 1) {
            // Open boundary edge
            isCreaseOrBoundaryCluster[ca] = 1;
            isCreaseOrBoundaryCluster[cb] = 1;
            creaseNeighbors[ca].add(cb);
            creaseNeighbors[cb].add(ca);
        } else if (tris.length >= 2 && creaseAngleDeg < 179.5) {
            const tA = tris[0] * 3;
            const tB = tris[1] * 3;
            const dot =
                faceNormals[tA] * faceNormals[tB] +
                faceNormals[tA + 1] * faceNormals[tB + 1] +
                faceNormals[tA + 2] * faceNormals[tB + 2];
            if (dot < cosCrease) {
                isCreaseOrBoundaryCluster[ca] = 1;
                isCreaseOrBoundaryCluster[cb] = 1;
                creaseNeighbors[ca].add(cb);
                creaseNeighbors[cb].add(ca);
            }
        }
    });

    // 4. Perform 2-pass Taubin-inspired volume-preserving smooth relaxation
    const curPos = new Float32Array(clusterPos);
    const nextPos = new Float32Array(clusterPos.length);

    const runStep = (lambda: number) => {
        for (let c = 0; c < clusterCount; c++) {
            const c3 = c * 3;
            const px = curPos[c3];
            const py = curPos[c3 + 1];
            const pz = curPos[c3 + 2];

            const activeSet =
                isCreaseOrBoundaryCluster[c] === 1
                    ? creaseNeighbors[c]
                    : neighbors[c];

            if (activeSet.size === 0) {
                nextPos[c3] = px;
                nextPos[c3 + 1] = py;
                nextPos[c3 + 2] = pz;
                continue;
            }

            // Corner vertex where >2 crease edges meet: keep anchored
            if (isCreaseOrBoundaryCluster[c] === 1 && activeSet.size > 2) {
                nextPos[c3] = px;
                nextPos[c3 + 1] = py;
                nextPos[c3 + 2] = pz;
                continue;
            }

            let sx = 0, sy = 0, sz = 0;
            activeSet.forEach((nb) => {
                const n3 = nb * 3;
                sx += curPos[n3];
                sy += curPos[n3 + 1];
                sz += curPos[n3 + 2];
            });
            const invN = 1.0 / activeSet.size;
            const avgX = sx * invN;
            const avgY = sy * invN;
            const avgZ = sz * invN;

            // Crease edges relax more gently along their curve
            const factor = isCreaseOrBoundaryCluster[c] === 1 ? lambda * 0.5 : lambda;
            nextPos[c3] = px + (avgX - px) * factor;
            nextPos[c3 + 1] = py + (avgY - py) * factor;
            nextPos[c3 + 2] = pz + (avgZ - pz) * factor;
        }
        curPos.set(nextPos);
    };

    const iterations = 2;
    const lambdaPos = 0.55 * strength;
    const muNeg = -0.32 * strength;

    for (let it = 0; it < iterations; it++) {
        runStep(lambdaPos);
        runStep(muNeg);
    }

    // 5. Write smoothed positions back and compute smooth welded vertex normals
    for (let c = 0; c < clusterCount; c++) {
        const c3 = c * 3;
        const sx = curPos[c3];
        const sy = curPos[c3 + 1];
        const sz = curPos[c3 + 2];
        const verts = clusterVerts[c];
        for (let j = 0; j < verts.length; j++) {
            posAttr.setXYZ(verts[j], sx, sy, sz);
        }
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    // Average normals across clusters unless separated by a sharp crease
    const normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
    if (normAttr) {
        for (let c = 0; c < clusterCount; c++) {
            if (isCreaseOrBoundaryCluster[c] === 1) continue;
            const verts = clusterVerts[c];
            if (verts.length <= 1) continue;
            let nx = 0, ny = 0, nz = 0;
            for (let j = 0; j < verts.length; j++) {
                const vi = verts[j];
                nx += normAttr.getX(vi);
                ny += normAttr.getY(vi);
                nz += normAttr.getZ(vi);
            }
            const len = Math.hypot(nx, ny, nz) || 1;
            nx /= len;
            ny /= len;
            nz /= len;
            for (let j = 0; j < verts.length; j++) {
                normAttr.setXYZ(verts[j], nx, ny, nz);
            }
        }
        normAttr.needsUpdate = true;
    }
}

/**
 * Applies the unified non-destructive Mesh Subdivision (`0`..`4`) and optional Bake action
 * to a 3D model before PBR Height Displacement, Cliff Shaping, and Slope Shaping run.
 */
export function applyModelSubdivision(
    model: THREE.Group,
    obj: ThreeDObject
): ModelMeshStats {
    const subdiv: ThreeDSubdivisionSettings = {
        ...DEFAULT_SUBDIVISION_SETTINGS,
        ...(obj.subdivisionSettings || {}),
    };

    const isProcPlane = isProceduralPlaneUrl(obj.glbUrl);
    const disp = {
        ...DEFAULT_DISPLACEMENT_SETTINGS,
        ...(obj.displacementSettings || {}),
    };

    let baseTriangles = 0;
    let baseVertices = 0;
    let activeTriangles = 0;
    let activeVertices = 0;
    let clampedByBudget = false;

    if (isProcPlane) {
        const { tilesX, tilesZ } = resolvePlaneTileCounts(obj, disp);
        const tileLockEnabled = disp.tileLockEnabled ?? true;
        const baseDensity = disp.subdivisions || 96;
        // Each subdivision level above 0 doubles the grid resolution per axis (4x triangles per level)
        const levelMult = Math.pow(2, Math.max(0, Math.min(3, subdiv.level)));
        const effectiveDensity = Math.min(384, Math.round(baseDensity * levelMult));
        if (baseDensity * levelMult > 384) clampedByBudget = true;

        const isActiveDisp =
            disp.enabled ||
            disp.terrainEnabled ||
            subdiv.level > 0 ||
            Boolean(obj.cliffShapingSettings?.enabled) ||
            Boolean(obj.slopeShapingSettings?.enabled);

        const { segsX: baseSegsX, segsZ: baseSegsZ } = computeTileLockedSubdivisions(
            baseDensity,
            tilesX,
            tilesZ,
            tileLockEnabled
        );
        const { segsX: targetSegsX, segsZ: targetSegsZ } = isActiveDisp
            ? computeTileLockedSubdivisions(effectiveDensity, tilesX, tilesZ, tileLockEnabled)
            : { segsX: baseSegsX, segsZ: baseSegsZ };

        let unitSize = 1;
        const qIdx = obj.glbUrl.indexOf('?');
        if (qIdx !== -1) {
            const params = new URLSearchParams(obj.glbUrl.substring(qIdx + 1));
            const parsed = parseFloat(params.get('unitSize') || '1');
            if (!isNaN(parsed) && parsed > 0) unitSize = parsed;
        }

        model.traverse((child) => {
            if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
            if (!(child as THREE.Mesh).isMesh) return;
            const mesh = child as THREE.Mesh;
            const curX = mesh.geometry.userData.segmentsX || mesh.geometry.userData.segments || 1;
            const curZ = mesh.geometry.userData.segmentsZ || mesh.geometry.userData.segments || 1;

            if (curX !== targetSegsX || curZ !== targetSegsZ) {
                mesh.geometry.dispose();
                const newGeo = new THREE.PlaneGeometry(unitSize, unitSize, targetSegsX, targetSegsZ);
                newGeo.rotateX(-Math.PI / 2);
                newGeo.userData.segments = targetSegsX;
                newGeo.userData.segmentsX = targetSegsX;
                newGeo.userData.segmentsZ = targetSegsZ;
                newGeo.userData.basePositions = (newGeo.attributes.position as THREE.BufferAttribute).clone();
                if (newGeo.attributes.normal) {
                    newGeo.userData.baseNormals = (newGeo.attributes.normal as THREE.BufferAttribute).clone();
                }
                mesh.geometry = newGeo;
            }
        });

        baseTriangles = baseSegsX * baseSegsZ * 2;
        baseVertices = (baseSegsX + 1) * (baseSegsZ + 1);
        activeTriangles = targetSegsX * targetSegsZ * 2;
        activeVertices = (targetSegsX + 1) * (targetSegsZ + 1);
    } else {
        // GLB Model Subdivision
        const cliffSubdiv = obj.cliffShapingSettings?.enabled
            ? Math.max(0, Math.min(3, obj.cliffShapingSettings.subdivideLevel ?? 1))
            : 0;
        const slopeSubdiv = obj.slopeShapingSettings?.enabled
            ? Math.max(0, Math.min(3, obj.slopeShapingSettings.subdivideLevel ?? 2))
            : 0;

        // Effective subdivision combines explicit user level and any active cliff/slope auto-subdivision
        const effectiveLevel = Math.max(
            Math.max(0, Math.min(4, subdiv.level)),
            cliffSubdiv,
            slopeSubdiv
        );
        const bakeVersion = subdiv.bakeVersion ?? 0;

        model.traverse((child) => {
            if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
            if (!(child as THREE.Mesh).isMesh) return;
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry;

            // Store pristine GLB geometry once on initial load without altering its indexing or authored vertex normals
            if (!geo.userData.pristineGlbGeometry) {
                const baseClone = geo.clone();
                if (!baseClone.attributes.normal) {
                    baseClone.computeVertexNormals();
                }
                geo.userData.pristineGlbGeometry = baseClone;
                geo.userData.bakedVersion = 0;
            }

            // If user clicked "Bake Subdivision", permanently promote the last subdivided mesh to pristineGlbGeometry
            const prevBakeVer = geo.userData.bakedVersion ?? 0;
            if (bakeVersion > prevBakeVer && geo.userData.lastSubdividedTemplate) {
                const bakedGeo = (geo.userData.lastSubdividedTemplate as THREE.BufferGeometry).clone();
                bakedGeo.computeVertexNormals();
                geo.userData.pristineGlbGeometry = bakedGeo;
                geo.userData.bakedVersion = bakeVersion;
                geo.userData.appliedSubdivSignature = '';
            }

            const pristine = geo.userData.pristineGlbGeometry as THREE.BufferGeometry;
            const pCount = pristine.attributes.position ? pristine.attributes.position.count : 0;
            const pTris = pristine.index
                ? Math.floor(pristine.index.count / 3)
                : Math.floor(pCount / 3);
            baseVertices += pCount;
            baseTriangles += pTris;

            const sig = `${effectiveLevel}_${subdiv.mode}_${subdiv.smoothStrength}_${subdiv.creaseAngle}_${bakeVersion}`;
            if (geo.userData.appliedSubdivSignature !== sig) {
                const { geometry: rebuilt, clamped } =
                    effectiveLevel > 0
                        ? tessellateGeometryFlat(pristine, effectiveLevel)
                        : { geometry: pristine.clone(), clamped: false };

                if (clamped) clampedByBudget = true;

                if (effectiveLevel > 0 && subdiv.mode === 'smooth') {
                    applySmoothSubdivisionRelaxation(
                        rebuilt,
                        subdiv.smoothStrength ?? 65,
                        subdiv.creaseAngle ?? 60
                    );
                } else if (effectiveLevel > 0 || !rebuilt.attributes.normal) {
                    rebuilt.computeVertexNormals();
                }

                rebuilt.userData.pristineGlbGeometry = pristine;
                rebuilt.userData.bakedVersion = bakeVersion;
                rebuilt.userData.appliedSubdivSignature = sig;
                rebuilt.userData.cliffSubdivLevel = effectiveLevel;
                rebuilt.userData.lastSubdividedTemplate = rebuilt.clone();
                rebuilt.userData.basePositions = (rebuilt.attributes.position as THREE.BufferAttribute).clone();
                if (rebuilt.attributes.normal) {
                    rebuilt.userData.baseNormals = (rebuilt.attributes.normal as THREE.BufferAttribute).clone();
                }
                if (rebuilt.attributes.uv) {
                    rebuilt.userData.originalUVs = (rebuilt.attributes.uv as THREE.BufferAttribute).clone();
                }
                mesh.geometry = rebuilt;
            }

            const activePos = mesh.geometry.attributes.position as THREE.BufferAttribute | undefined;
            const aCount = activePos ? activePos.count : 0;
            const aTris = mesh.geometry.index
                ? Math.floor(mesh.geometry.index.count / 3)
                : Math.floor(aCount / 3);
            activeVertices += aCount;
            activeTriangles += aTris;
        });
    }

    const stats: ModelMeshStats = {
        baseTriangles,
        baseVertices,
        activeTriangles,
        activeVertices,
        clampedByBudget,
    };
    liveMeshStatsMap.set(obj.id, stats);
    return stats;
}
