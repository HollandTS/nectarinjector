import * as THREE from 'three';

export interface SpatialVertexWeldInfo {
    /** Number of unique spatial clusters */
    clusterCount: number;
    /** Maps each vertex index [0 .. count-1] to its spatial cluster index [0 .. clusterCount-1] */
    vertexClusterIndex: Int32Array;
    /** Lists of vertex indices belonging to each spatial cluster */
    clusterVertices: number[][];
    /** Canonical (averaged) base position [x, y, z] per vertex so pre-existing micro-gaps are sealed */
    canonicalBasePositions: Float32Array;
    /** Area/face-averaged smooth normal [nx, ny, nz] per vertex across all faces sharing the cluster */
    weldedNormals: Float32Array;
}

/**
 * Computes spatial vertex clusters and welded normals for a geometry so that
 * disconnected triangles or hard-edged faces sharing the same 3D edge/corner
 * stay 100% connected when displaced (never cracking or separating apart).
 *
 * @param basePosAttr The rest/base position attribute of the mesh (used for stable clustering)
 * @param currentNormAttr The current normal attribute of the mesh
 * @param refSize Reference bounding-box dimension of the mesh
 * @param tolerancePct 0..100% spatial snap tolerance (0 = exact shared vertices only, >0 = closes small modeling gaps)
 */
export function buildSpatialVertexWeldInfo(
    basePosAttr: THREE.BufferAttribute,
    currentNormAttr: THREE.BufferAttribute,
    refSize: number,
    tolerancePct: number = 35
): SpatialVertexWeldInfo {
    const count = basePosAttr.count;
    const clampedTol = Math.max(0, Math.min(100, tolerancePct)) / 100;

    // Tolerance cell size in model units:
    // At 0%, cell is tiny (1e-5 * refSize, matching exact shared vertices).
    // At 35% (default), cell is ~0.0025 * refSize (snaps slightly split edges without collapsing detail).
    // At 100%, cell is ~0.018 * refSize (closes noticeable modeling gaps between puzzle pieces).
    const cellSize = Math.max(
        1e-6,
        refSize * (0.00002 + clampedTol * clampedTol * 0.018)
    );
    const invCell = 1.0 / cellSize;

    const clusterMap = new Map<string, number>();
    const clusterVertices: number[][] = [];
    const vertexClusterIndex = new Int32Array(count);

    const sumPos: number[] = [];
    const sumNorm: number[] = [];

    for (let i = 0; i < count; i++) {
        const bx = basePosAttr.getX(i);
        const by = basePosAttr.getY(i);
        const bz = basePosAttr.getZ(i);

        const kx = Math.round(bx * invCell);
        const ky = Math.round(by * invCell);
        const kz = Math.round(bz * invCell);
        const key = `${kx}_${ky}_${kz}`;

        const nx = currentNormAttr.getX(i);
        const ny = currentNormAttr.getY(i);
        const nz = currentNormAttr.getZ(i);

        let cIdx = clusterMap.get(key);
        if (cIdx === undefined) {
            cIdx = clusterVertices.length;
            clusterMap.set(key, cIdx);
            clusterVertices.push([i]);
            sumPos.push(bx, by, bz);
            sumNorm.push(nx, ny, nz);
        } else {
            clusterVertices[cIdx].push(i);
            const pOff = cIdx * 3;
            sumPos[pOff] += bx;
            sumPos[pOff + 1] += by;
            sumPos[pOff + 2] += bz;
            sumNorm[pOff] += nx;
            sumNorm[pOff + 1] += ny;
            sumNorm[pOff + 2] += nz;
        }
        vertexClusterIndex[i] = cIdx;
    }

    const canonicalBasePositions = new Float32Array(count * 3);
    const weldedNormals = new Float32Array(count * 3);
    const clusterCount = clusterVertices.length;

    for (let c = 0; c < clusterCount; c++) {
        const verts = clusterVertices[c];
        const invN = 1.0 / verts.length;
        const pOff = c * 3;

        const cx = sumPos[pOff] * invN;
        const cy = sumPos[pOff + 1] * invN;
        const cz = sumPos[pOff + 2] * invN;

        const snx = sumNorm[pOff];
        const sny = sumNorm[pOff + 1];
        const snz = sumNorm[pOff + 2];
        const nLen = Math.hypot(snx, sny, snz) || 1.0;
        const wnx = snx / nLen;
        const wny = sny / nLen;
        const wnz = snz / nLen;

        for (let j = 0; j < verts.length; j++) {
            const vIdx = verts[j] * 3;
            canonicalBasePositions[vIdx] = cx;
            canonicalBasePositions[vIdx + 1] = cy;
            canonicalBasePositions[vIdx + 2] = cz;
            weldedNormals[vIdx] = wnx;
            weldedNormals[vIdx + 1] = wny;
            weldedNormals[vIdx + 2] = wnz;
        }
    }

    return {
        clusterCount,
        vertexClusterIndex,
        clusterVertices,
        canonicalBasePositions,
        weldedNormals,
    };
}

/**
 * Post-displacement pass that averages the final deformed 3D position (and optional
 * scalar vertex attributes such as `aCliffSlopeMask` or `aSlopeDipDepth`) across every
 * vertex in the same spatial cluster.
 *
 * This guarantees that even when adjacent faces have different UVs, face normals, or
 * slope angles, their shared seam vertices end up at the exact same (X, Y, Z) coordinate
 * and never break or separate apart.
 */
export function enforceWeldedVertexPositions(
    posAttr: THREE.BufferAttribute,
    weldInfo: SpatialVertexWeldInfo,
    scalarAttributes?: Float32Array[]
): void {
    const { clusterCount, clusterVertices } = weldInfo;

    for (let c = 0; c < clusterCount; c++) {
        const verts = clusterVertices[c];
        if (verts.length <= 1) continue;

        let sx = 0;
        let sy = 0;
        let sz = 0;
        const invN = 1.0 / verts.length;

        for (let j = 0; j < verts.length; j++) {
            const idx = verts[j];
            sx += posAttr.getX(idx);
            sy += posAttr.getY(idx);
            sz += posAttr.getZ(idx);
        }

        const ax = sx * invN;
        const ay = sy * invN;
        const az = sz * invN;

        for (let j = 0; j < verts.length; j++) {
            posAttr.setXYZ(verts[j], ax, ay, az);
        }

        if (scalarAttributes && scalarAttributes.length > 0) {
            for (let a = 0; a < scalarAttributes.length; a++) {
                const arr = scalarAttributes[a];
                let sVal = 0;
                for (let j = 0; j < verts.length; j++) {
                    sVal += arr[verts[j]];
                }
                const avgVal = sVal * invN;
                for (let j = 0; j < verts.length; j++) {
                    arr[verts[j]] = avgVal;
                }
            }
        }
    }
}
