import * as THREE from 'three';
import type { ThreeDSurfaceScatterSettings } from '../types';

export interface CandidateTriangle {
    vA: THREE.Vector3;
    vB: THREE.Vector3;
    vC: THREE.Vector3;
    nA: THREE.Vector3;
    nB: THREE.Vector3;
    nC: THREE.Vector3;
    faceNormal: THREE.Vector3;
    area: number;
    cumArea: number;
}

export interface SpawnSample {
    pos: THREE.Vector3;
    normal: THREE.Vector3;
    itemIndex: number;
}

/**
 * Deterministic PRNG (Mulberry32) so scatter positions, rotations, and scales stay
 * 100% locked when moving/rotating the parent plane unless the user changes the seed.
 */
export function createSeededRandom(seed: number): () => number {
    let a = (seed | 0) + 0x6d2b79f5;
    return () => {
        a = Math.imul(a ^ (a >>> 15), a | 1);
        a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
        return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
    };
}

function hash2D(ix: number, iy: number, seed: number): number {
    let n = ix * 374761393 + iy * 668265263 + seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

export function smoothClumpNoise2D(x: number, z: number, seed: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);

    const a = hash2D(ix, iz, seed);
    const b = hash2D(ix + 1, iz, seed);
    const c = hash2D(ix, iz + 1, seed);
    const d = hash2D(ix + 1, iz + 1, seed);

    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function isScatterChild(child: THREE.Object3D, scatterGroupName: string): boolean {
    if (child.userData?.isScatterInstance) return true;
    let cur: THREE.Object3D | null = child;
    while (cur) {
        if (cur.name === scatterGroupName) return true;
        cur = cur.parent;
    }
    return false;
}

export function collectEligibleSurfaceTriangles(
    model: THREE.Group,
    scatter: ThreeDSurfaceScatterSettings,
    scatterGroupName: string
): {
    triangles: CandidateTriangle[];
    totalArea: number;
    bounds: THREE.Box3;
} {
    const baseMeshes: THREE.Mesh[] = [];
    model.traverse((child) => {
        if (isScatterChild(child, scatterGroupName)) {
            return;
        }
        if ((child as THREE.Mesh).isMesh) {
            baseMeshes.push(child as THREE.Mesh);
        }
    });

    const bounds = new THREE.Box3();
    const rawTriangles: {
        vA: THREE.Vector3;
        vB: THREE.Vector3;
        vC: THREE.Vector3;
        nA: THREE.Vector3;
        nB: THREE.Vector3;
        nC: THREE.Vector3;
        faceNormal: THREE.Vector3;
        area: number;
    }[] = [];

    model.updateMatrixWorld(true);
    const invModelMatrix = new THREE.Matrix4().copy(model.matrixWorld).invert();

    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const pC = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const crossVec = new THREE.Vector3();

    for (const mesh of baseMeshes) {
        const geo = mesh.geometry;
        if (!geo || !geo.attributes.position) continue;

        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        if (!geo.attributes.normal) {
            geo.computeVertexNormals();
        }
        const normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
        const indexAttr = geo.index;

        const toModelLocal = new THREE.Matrix4()
            .copy(invModelMatrix)
            .multiply(mesh.matrixWorld);

        const modelScale = new THREE.Vector3(
            Math.max(1e-4, Math.abs(model.scale.x)),
            Math.max(1e-4, Math.abs(model.scale.y)),
            Math.max(1e-4, Math.abs(model.scale.z))
        );

        const toUniformLocal = new THREE.Matrix4()
            .makeScale(modelScale.x, modelScale.y, modelScale.z)
            .multiply(toModelLocal);

        const normalMat = new THREE.Matrix3().getNormalMatrix(toUniformLocal);

        const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

        for (let t = 0; t < triCount; t++) {
            const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
            const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
            const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

            pA.fromBufferAttribute(posAttr, i0).applyMatrix4(toUniformLocal);
            pB.fromBufferAttribute(posAttr, i1).applyMatrix4(toUniformLocal);
            pC.fromBufferAttribute(posAttr, i2).applyMatrix4(toUniformLocal);

            bounds.expandByPoint(pA);
            bounds.expandByPoint(pB);
            bounds.expandByPoint(pC);

            edge1.subVectors(pB, pA);
            edge2.subVectors(pC, pA);
            crossVec.crossVectors(edge1, edge2);
            const area = 0.5 * crossVec.length();
            if (area < 1e-6) continue;

            const faceNormal = crossVec.clone().normalize();

            const nA = normAttr
                ? new THREE.Vector3().fromBufferAttribute(normAttr, i0).applyMatrix3(normalMat).normalize()
                : faceNormal.clone();
            const nB = normAttr
                ? new THREE.Vector3().fromBufferAttribute(normAttr, i1).applyMatrix3(normalMat).normalize()
                : faceNormal.clone();
            const nC = normAttr
                ? new THREE.Vector3().fromBufferAttribute(normAttr, i2).applyMatrix3(normalMat).normalize()
                : faceNormal.clone();

            rawTriangles.push({
                vA: pA.clone(),
                vB: pB.clone(),
                vC: pC.clone(),
                nA,
                nB,
                nC,
                faceNormal,
                area,
            });
        }
    }

    if (rawTriangles.length === 0) {
        return { triangles: [], totalArea: 0, bounds };
    }

    const minSlopeDeg = Math.max(0, Math.min(90, scatter.minSlopeAngle ?? 0));
    const maxSlopeDeg = Math.max(minSlopeDeg, Math.min(90, scatter.maxSlopeAngle ?? 42));

    const minY = bounds.min.y;
    const maxY = bounds.max.y;
    const heightSpan = Math.max(0.0001, maxY - minY);
    const minH = minY + (Math.max(0, Math.min(100, scatter.minHeightPct ?? 0)) / 100) * heightSpan - 0.001;
    const maxH = minY + (Math.max(0, Math.min(100, scatter.maxHeightPct ?? 100)) / 100) * heightSpan + 0.001;

    const eligible: CandidateTriangle[] = [];
    let cumArea = 0;

    for (const tri of rawTriangles) {
        if (tri.faceNormal.y < -0.05 && maxSlopeDeg < 88) continue;

        const clampedNy = Math.max(-1, Math.min(1, tri.faceNormal.y));
        const angleDeg = (Math.acos(clampedNy) * 180) / Math.PI;
        if (angleDeg < minSlopeDeg - 0.5 || angleDeg > maxSlopeDeg + 0.5) continue;

        const avgY = (tri.vA.y + tri.vB.y + tri.vC.y) / 3;
        if (heightSpan > 0.01 && (avgY < minH || avgY > maxH)) continue;

        cumArea += tri.area;
        eligible.push({
            ...tri,
            cumArea,
        });
    }

    return { triangles: eligible, totalArea: cumArea, bounds };
}

function binarySearchTriangle(triangles: CandidateTriangle[], targetArea: number): CandidateTriangle {
    let low = 0;
    let high = triangles.length - 1;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (triangles[mid].cumArea < targetArea) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return triangles[low];
}

export function samplePointOnSurface(
    triangles: CandidateTriangle[],
    totalArea: number,
    rng: () => number
): { pos: THREE.Vector3; normal: THREE.Vector3 } {
    const rArea = rng() * totalArea;
    const tri = binarySearchTriangle(triangles, rArea);

    let r1 = rng();
    let r2 = rng();
    if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
    }
    const r3 = 1 - r1 - r2;

    const pos = new THREE.Vector3()
        .addScaledVector(tri.vA, r1)
        .addScaledVector(tri.vB, r2)
        .addScaledVector(tri.vC, r3);

    const normal = new THREE.Vector3()
        .addScaledVector(tri.nA, r1)
        .addScaledVector(tri.nB, r2)
        .addScaledVector(tri.nC, r3)
        .normalize();

    return { pos, normal };
}
