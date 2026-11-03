import * as THREE from 'three';
import type { ThreeDDisplacementSettings, ThreeDObject } from '../types';

/**
 * Resolves the effective (tilesX, tilesZ) grid dimensions for a 3D object.
 * Uses explicit displacementSettings.tileCountX / tileCountZ if set, otherwise
 * falls back to rounded object scale (since converted planes have scale.x = totalRx * footprint, scale.z = totalRy * footprint).
 */
export function resolvePlaneTileCounts(
    obj: ThreeDObject,
    disp: ThreeDDisplacementSettings
): { tilesX: number; tilesZ: number } {
    const rawX = disp.tileCountX && disp.tileCountX > 0 ? disp.tileCountX : Math.round(Math.abs(obj.scale?.x || 1));
    const rawZ = disp.tileCountZ && disp.tileCountZ > 0 ? disp.tileCountZ : Math.round(Math.abs(obj.scale?.z || 1));
    return {
        tilesX: Math.max(1, Math.min(64, Math.round(rawX))),
        tilesZ: Math.max(1, Math.min(64, Math.round(rawZ))),
    };
}

/**
 * Computes tile-commensurate PlaneGeometry segment counts (segsX, segsZ) so that
 * every 1x1 diamond game tile on the plane has the exact same vertex grid and diagonal triangulation.
 */
export function computeTileLockedSubdivisions(
    baseSubdivisions: number,
    tilesX: number,
    tilesZ: number,
    tileLockEnabled: boolean
): { segsX: number; segsZ: number } {
    const clampedBase = Math.min(256, Math.max(16, Math.round(baseSubdivisions || 96)));
    if (!tileLockEnabled) {
        return { segsX: clampedBase, segsZ: clampedBase };
    }

    // Ensure each 1x1 tile gets an identical integer number of segments (at least 4, up to 256 total)
    const maxTiles = Math.max(1, tilesX, tilesZ);
    const idealPerTile = Math.max(4, Math.round(clampedBase / maxTiles));
    // Cap total segments along either axis to 256 for fast interactive performance
    const maxPerTileX = Math.max(2, Math.floor(256 / Math.max(1, tilesX)));
    const maxPerTileZ = Math.max(2, Math.floor(256 / Math.max(1, tilesZ)));
    const segsPerTile = Math.max(2, Math.min(idealPerTile, maxPerTileX, maxPerTileZ));

    return {
        segsX: segsPerTile * Math.max(1, tilesX),
        segsZ: segsPerTile * Math.max(1, tilesZ),
    };
}

function hash2D(ix: number, iy: number, seed: number): number {
    let n = ix * 374761393 + iy * 668265263 + seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

/**
 * Periodic 2D smooth value noise with integer period (periodX, periodY).
 * When x wraps from periodX -> 0 or y wraps from periodY -> 0, both the value and
 * its quintic derivatives match seamlessly with zero discontinuity.
 */
function smoothPeriodicNoise2D(
    x: number,
    y: number,
    periodX: number,
    periodY: number,
    seed: number
): number {
    const px = Math.max(1, Math.round(periodX));
    const py = Math.max(1, Math.round(periodY));

    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    const x0 = ((ix % px) + px) % px;
    const x1 = (x0 + 1) % px;
    const y0 = ((iy % py) + py) % py;
    const y1 = (y0 + 1) % py;

    const a = hash2D(x0, y0, seed);
    const b = hash2D(x1, y0, seed);
    const c = hash2D(x0, y1, seed);
    const d = hash2D(x1, y1, seed);

    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Samples 1x1 tile-periodic FBM terrain noise so that every single 1x1 game tile
 * on the plane has seamlessly repeating terrain elevation across all 4 diamond edges.
 */
export function samplePeriodicTileTerrainNoise(
    u: number,
    v: number,
    tilesX: number,
    tilesZ: number,
    settings: ThreeDDisplacementSettings
): number {
    if (!settings.terrainEnabled || settings.terrainAmplitude === 0) return 0;

    // Local [0, 1) tile UV coordinates inside the current 1x1 game tile
    const uTile = ((u * tilesX) % 1 + 1) % 1;
    const vTile = ((v * tilesZ) % 1 + 1) % 1;

    // Integer base frequency per 1x1 tile (minimum 1 cycle per tile so it wraps PERIODICALLY)
    const basePeriod = Math.max(1, Math.round(settings.terrainFrequency ?? 2.5));
    const persistence = Math.max(0, Math.min(1, settings.terrainRoughness ?? 0.5));
    const seed = Math.round(settings.terrainSeed ?? 1337);
    const ridge = !!settings.terrainRidgeMode;

    let total = 0;
    let amplitude = 1;
    let maxAmp = 0;
    let period = basePeriod;

    const octaves = 4;
    for (let o = 0; o < octaves; o++) {
        let n = smoothPeriodicNoise2D(
            uTile * period,
            vTile * period,
            period,
            period,
            seed + o * 101
        );
        if (ridge) {
            n = 1.0 - Math.abs(n * 2.0 - 1.0);
            n = n * n;
        } else {
            n = n * 2.0 - 1.0;
        }
        total += n * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        period *= 2; // Exact integer doubling keeps all octaves 100% periodic on [0, 1)
    }

    const normalized = maxAmp > 0 ? total / maxAmp : 0;
    const centered = ridge ? (normalized - 0.5) * 2.0 : normalized;
    return centered * (settings.terrainAmplitude ?? 2.0);
}

/**
 * Samples height from a heightmap with seam blending across every 1x1 tile cell boundary
 * (and across the outer plane edges), ensuring that adjacent 1x1 game tiles meet at the
 * exact same height profile along their shared diamond edges.
 */
export function sampleSeamlessTileHeight(
    heights: Float32Array,
    width: number,
    height: number,
    u: number,
    v: number,
    tilesX: number,
    tilesZ: number,
    tileLockEnabled: boolean,
    seamBlendPct: number,
    sampleBilinearFn: (heights: Float32Array, w: number, h: number, u: number, v: number) => number
): number {
    const baseH = sampleBilinearFn(heights, width, height, u, v);
    if (!tileLockEnabled || seamBlendPct <= 0) {
        return baseH;
    }

    // Normalized blend radius in tile-local UV space [0, 0.5]
    const blendRadius = Math.max(0.005, Math.min(0.49, (seamBlendPct / 100) * 0.45));

    const tx = Math.max(1, tilesX);
    const tz = Math.max(1, tilesZ);

    // Local coordinates within the 1x1 tile cell: fu, fv in [0, 1)
    const scaledU = Math.max(0, Math.min(tx, u * tx));
    const scaledV = Math.max(0, Math.min(tz, v * tz));

    const cellX = Math.min(tx - 1, Math.floor(scaledU));
    const cellZ = Math.min(tz - 1, Math.floor(scaledV));

    const fu = scaledU - cellX; // [0, 1] inside current tile
    const fv = scaledV - cellZ; // [0, 1] inside current tile

    // Compute canonical periodic edge profile by averaging across all tiles in the grid
    // at the opposite border of the tile cell so every tile's left edge == right edge
    // and top edge == bottom edge.
    const sampleTileAvgAtLocalUV = (lu: number, lv: number): number => {
        // Sample the current tile's opposite edge AND the primary tile (0,0) edge
        // so that both adjacent tiles on the plane and repeated game tiles match seamlessly.
        const uCurr = (cellX + lu) / tx;
        const vCurr = (cellZ + lv) / tz;
        const uZero = lu / tx;
        const vZero = lv / tz;
        const uLast = (tx - 1 + lu) / tx;
        const vLast = (tz - 1 + lv) / tz;

        const hCurr = sampleBilinearFn(heights, width, height, uCurr, vCurr);
        const hZero = sampleBilinearFn(heights, width, height, uZero, vZero);
        const hLast = sampleBilinearFn(heights, width, height, uLast, vLast);
        return (hCurr + hZero + hLast) / 3;
    };

    // Distance to nearest U tile border (0 or 1) and V tile border (0 or 1)
    const distU = Math.min(fu, 1.0 - fu);
    const distV = Math.min(fv, 1.0 - fv);

    let resultH = baseH;

    // 1. Horizontal (U / Col) tile seam equalization:
    // Blend both fu -> 0 and fu -> 1 toward the shared U-border height (average of fu=0 and fu=1)
    if (distU < blendRadius) {
        const t = 1.0 - distU / blendRadius; // 1 right on the tile edge, 0 at blendRadius inside
        const smoothT = t * t * (3.0 - 2.0 * t);

        const hLeftEdge = sampleTileAvgAtLocalUV(0.0, fv);
        const hRightEdge = sampleTileAvgAtLocalUV(1.0, fv);
        const sharedUEdgeH = 0.5 * (hLeftEdge + hRightEdge);

        resultH = resultH * (1.0 - smoothT * 0.85) + sharedUEdgeH * (smoothT * 0.85);
    }

    // 2. Vertical (V / Row) tile seam equalization:
    // Blend both fv -> 0 and fv -> 1 toward the shared V-border height (average of fv=0 and fv=1)
    if (distV < blendRadius) {
        const t = 1.0 - distV / blendRadius;
        const smoothT = t * t * (3.0 - 2.0 * t);

        const hBottomEdge = sampleTileAvgAtLocalUV(fu, 0.0);
        const hTopEdge = sampleTileAvgAtLocalUV(fu, 1.0);
        const sharedVEdgeH = 0.5 * (hBottomEdge + hTopEdge);

        resultH = resultH * (1.0 - smoothT * 0.85) + sharedVEdgeH * (smoothT * 0.85);
    }

    // 3. Corner lock (where all 4 diamond vertices meet at fu in {0,1}, fv in {0,1})
    if (distU < blendRadius && distV < blendRadius) {
        const tu = 1.0 - distU / blendRadius;
        const tv = 1.0 - distV / blendRadius;
        const cornerWeight = tu * tv;
        const smoothCorner = cornerWeight * cornerWeight * (3.0 - 2.0 * cornerWeight);

        const c00 = sampleTileAvgAtLocalUV(0.0, 0.0);
        const c10 = sampleTileAvgAtLocalUV(1.0, 0.0);
        const c01 = sampleTileAvgAtLocalUV(0.0, 1.0);
        const c11 = sampleTileAvgAtLocalUV(1.0, 1.0);
        const sharedCornerH = 0.25 * (c00 + c10 + c01 + c11);

        resultH = resultH * (1.0 - smoothCorner * 0.9) + sharedCornerH * (smoothCorner * 0.9);
    }

    return resultH;
}

/**
 * Wraps and equalizes vertex normals across 1x1 tile boundaries and outer plane borders
 * on a Three.js PlaneGeometry of grid dimensions (segsX + 1) x (segsZ + 1).
 * This eliminates directional lighting creases between adjacent or repeated game tiles.
 */
export function applySeamlessTileNormalWrap(
    geo: THREE.BufferGeometry,
    segsX: number,
    segsZ: number,
    tilesX: number,
    tilesZ: number
): void {
    const normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
    if (!normAttr) return;

    const cols = segsX + 1;
    const rows = segsZ + 1;
    if (normAttr.count !== cols * rows) return;

    const idx = (ix: number, iz: number) => iz * cols + ix;

    const averageNormalsAt = (indices: number[]) => {
        let nx = 0;
        let ny = 0;
        let nz = 0;
        for (const i of indices) {
            nx += normAttr.getX(i);
            ny += normAttr.getY(i);
            nz += normAttr.getZ(i);
        }
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        for (const i of indices) {
            normAttr.setXYZ(i, nx, ny, nz);
        }
    };

    const tx = Math.max(1, tilesX);
    const tz = Math.max(1, tilesZ);
    const stepX = segsX % tx === 0 ? segsX / tx : 0;
    const stepZ = segsZ % tz === 0 ? segsZ / tz : 0;

    // 1. If segsX is a multiple of tilesX, lock all corresponding tile column seams together
    if (stepX > 0) {
        for (let iz = 0; iz < rows; iz++) {
            const seamIndices: number[] = [];
            for (let t = 0; t <= tx; t++) {
                seamIndices.push(idx(t * stepX, iz));
            }
            averageNormalsAt(seamIndices);
        }
    } else {
        // Fallback: wrap outer left (ix=0) and right (ix=segsX) plane borders
        for (let iz = 0; iz < rows; iz++) {
            averageNormalsAt([idx(0, iz), idx(segsX, iz)]);
        }
    }

    // 2. If segsZ is a multiple of tilesZ, lock all corresponding tile row seams together
    if (stepZ > 0) {
        for (let ix = 0; ix < cols; ix++) {
            const seamIndices: number[] = [];
            for (let t = 0; t <= tz; t++) {
                seamIndices.push(idx(ix, t * stepZ));
            }
            averageNormalsAt(seamIndices);
        }
    } else {
        // Fallback: wrap outer top (iz=0) and bottom (iz=segsZ) plane borders
        for (let ix = 0; ix < cols; ix++) {
            averageNormalsAt([idx(ix, 0), idx(ix, segsZ)]);
        }
    }

    normAttr.needsUpdate = true;
}
