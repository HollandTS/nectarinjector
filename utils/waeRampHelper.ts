import type { CanvasImage } from '../types';
import { getCanvasImageCells } from './tmpAlignmentHelper';

/**
 * Corner elevation offsets [Top(N), Right(E), Bottom(S), Left(W)] for Westwood / WAE RampType 0..20.
 *
 * In isometric space (where +i/+col goes Down-Right (SE) and +j/+row goes Down-Left (SW)):
 * - Cell (col, row) has 4 corners in grid corner coordinates:
 *   - Top (North):    (col, row)
 *   - Right (East):   (col + 1, row)
 *   - Bottom (South): (col + 1, row + 1)
 *   - Left (West):    (col, row + 1)
 * - Edges of Cell (col, row):
 *   - NE edge (col, row) -> (col + 1, row): shared with neighbor at (col, row - 1) [Top-Right / NE]
 *   - SE edge (col + 1, row) -> (col + 1, row + 1): shared with neighbor at (col + 1, row) [Bottom-Right / SE]
 *   - SW edge (col, row + 1) -> (col + 1, row + 1): shared with neighbor at (col, row + 1) [Bottom-Left / SW]
 *   - NW edge (col, row) -> (col, row + 1): shared with neighbor at (col - 1, row) [Top-Left / NW]
 *
 * WAE / Westwood 20 RampType specification (CornerHeightField.cs):
 *  0: Flat ground [0, 0, 0, 0]
 *  1: Ramp rising NW (Top-Left edge high): [1, 0, 0, 1]
 *  2: Ramp rising NE (Top-Right edge high): [1, 1, 0, 0]
 *  3: Ramp rising SE (Bottom-Right edge high): [0, 1, 1, 0]
 *  4: Ramp rising SW (Bottom-Left edge high): [0, 0, 1, 1]
 *  5: Corner ramp, N (Top) corner raised: [1, 0, 0, 0]
 *  6: Corner ramp, E (Right) corner raised: [0, 1, 0, 0]
 *  7: Corner ramp, S (Bottom) corner raised: [0, 0, 1, 0]
 *  8: Corner ramp, W (Left) corner raised: [0, 0, 0, 1]
 *  9: Corner ramp, all except S (Bottom) raised (N, E, W high): [1, 1, 0, 1]
 * 10: Corner ramp, all except W (Left) raised (N, E, S high): [1, 1, 1, 0]
 * 11: Corner ramp, all except N (Top) raised (E, S, W high): [0, 1, 1, 1]
 * 12: Corner ramp, all except E (Right) raised (N, S, W high): [1, 0, 1, 1]
 * 13: Steep/Split slope N-S (Top=2, E=1, S=0, W=1): [2, 1, 0, 1]
 * 14: Steep/Split slope E-W (Top=1, E=2, S=1, W=0): [1, 2, 1, 0]
 * 15: Steep/Split slope S-N (Top=0, E=1, S=2, W=1): [0, 1, 2, 1]
 * 16: Steep/Split slope W-E (Top=1, E=0, S=1, W=2): [1, 0, 1, 2]
 * 17: Double-height ramp rising NW: [2, 0, 0, 2]
 * 18: Double-height ramp rising NE: [2, 2, 0, 0]
 * 19: Double-height ramp rising SE: [0, 2, 2, 0]
 * 20: Double-height ramp rising SW: [0, 0, 2, 2]
 */
export type CornerHeights = [number, number, number, number]; // [Top, Right, Bottom, Left]

export const WAE_RAMP_CORNERS: Record<number, CornerHeights> = {
    0: [0, 0, 0, 0],
    1: [1, 0, 0, 1],
    2: [1, 1, 0, 0],
    3: [0, 1, 1, 0],
    4: [0, 0, 1, 1],
    5: [1, 0, 0, 0],
    6: [0, 1, 0, 0],
    7: [0, 0, 1, 0],
    8: [0, 0, 0, 1],
    9: [1, 1, 0, 1],
    10: [1, 1, 1, 0],
    11: [0, 1, 1, 1],
    12: [1, 0, 1, 1],
    13: [2, 1, 0, 1],
    14: [1, 2, 1, 0],
    15: [0, 1, 2, 1],
    16: [1, 0, 1, 2],
    17: [2, 0, 0, 2],
    18: [2, 2, 0, 0],
    19: [0, 2, 2, 0],
    20: [0, 0, 2, 2],
};

export const WAE_RAMP_LABELS: Record<number, string> = {
    0: 'Flat',
    1: 'Ramp NW',
    2: 'Ramp NE',
    3: 'Ramp SE',
    4: 'Ramp SW',
    5: 'Corner N',
    6: 'Corner E',
    7: 'Corner S',
    8: 'Corner W',
    9: 'Inner N',
    10: 'Inner E',
    11: 'Inner S',
    12: 'Inner W',
    13: 'Split N',
    14: 'Split E',
    15: 'Split S',
    16: 'Split W',
    17: 'Steep NW',
    18: 'Steep NE',
    19: 'Steep SE',
    20: 'Steep SW',
};

/**
 * Returns the 4 corner offsets [Top, Right, Bottom, Left] for a given WAE RampType.
 */
export function getRampCornerOffsets(rampType: number): CornerHeights {
    return WAE_RAMP_CORNERS[rampType] || [0, 0, 0, 0];
}

/**
 * Infers a primary ramp type for a CanvasImage (from `tmpCells` or filename conventions like `ramp01`..`ramp20`).
 */
export function getImagePrimaryRampType(image: CanvasImage): number {
    if (image.tmpCells && image.tmpCells.length > 0) {
        const rampCell = image.tmpCells.find(c => c.rampType > 0);
        if (rampCell) return rampCell.rampType;
        return 0;
    }
    const match = image.name.match(/ramp0*(\d{1,2})/i);
    if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 20) return num;
    }
    return 0;
}

/**
 * Returns a short human-readable summary of a tile's ramp/height info for UI lists.
 */
export function getTileRampSummary(image: CanvasImage): string | null {
    const rampType = getImagePrimaryRampType(image);
    if (rampType > 0) {
        return WAE_RAMP_LABELS[rampType] || `Ramp #${rampType}`;
    }
    if (image.tmpCells && image.tmpCells.length > 1) {
        let minH = Infinity;
        let maxH = -Infinity;
        for (const c of image.tmpCells) {
            minH = Math.min(minH, c.height);
            maxH = Math.max(maxH, c.height);
        }
        if (maxH > minH) {
            return `Elev 0..+${maxH - minH}`;
        }
    }
    return null;
}

interface WorldCellCornerData {
    cellX: number;
    cellY: number;
    corners: CornerHeights; // Absolute corner heights [Top, Right, Bottom, Left]
}

/**
 * Expands a `CanvasImage` at `(overrideGridX, overrideGridY)` with `baseHeightLevel`
 * into its occupied world grid cells and their 4 absolute corner elevations.
 *
 * Note on multi-tile TMP templates:
 * `computeTmpAlignmentData` normalizes rendering by `minHeight` (so the lowest sub-tile in a template
 * sits at ground level 0 on the canvas). Therefore, each sub-tile's relative height above the image's
 * ground baseline is `(cell.height - minCellHeight)`.
 */
export function getImageWorldCellCorners(
    image: CanvasImage,
    cellW: number,
    cellH: number,
    overrideGridX?: number,
    overrideGridY?: number,
    overrideHeightLevel?: number
): WorldCellCornerData[] {
    const gx = overrideGridX !== undefined ? overrideGridX : image.gridX;
    const gy = overrideGridY !== undefined ? overrideGridY : image.gridY;
    const baseLevel = overrideHeightLevel !== undefined ? overrideHeightLevel : (image.heightLevel ?? 0);

    const rawCells = getCanvasImageCells(image, cellW, cellH);
    if (rawCells.length === 0) return [];

    let minCellHeight = Infinity;
    for (const c of rawCells) {
        if (c.height < minCellHeight) minCellHeight = c.height;
    }
    if (!isFinite(minCellHeight)) minCellHeight = 0;

    const fallbackRamp = rawCells.length === 1 && rawCells[0].rampType === 0
        ? getImagePrimaryRampType(image)
        : 0;

    return rawCells.map(c => {
        const relCellHeight = c.height - minCellHeight;
        const effectiveRamp = c.rampType > 0 ? c.rampType : fallbackRamp;
        const [ct, cr, cb, cl] = getRampCornerOffsets(effectiveRamp);
        const totalBase = baseLevel + relCellHeight;
        return {
            cellX: Math.round(gx + c.col),
            cellY: Math.round(gy + c.row),
            corners: [
                totalBase + ct,
                totalBase + cr,
                totalBase + cb,
                totalBase + cl,
            ],
        };
    });
}

/**
 * Computes the smart `heightLevel` for a tile (or group of tiles) placed/snapped at `(targetGridX, targetGridY)`
 * by matching shared edge corners (and shared vertices) with existing non-moving tiles on the canvas.
 *
 * Priority:
 * 1. Shared full isometric edges (2 corners shared between adjacent cells) where both corners agree on the required height level.
 * 2. Shared full isometric edges using average corner height if a flat tile meets an angled corner ramp.
 * 3. Shared single diagonal corner vertex if no cardinal edge neighbor exists.
 * 4. Preserves the tile's current `heightLevel` if no neighbors touch it.
 */
export function computeSmartTileHeightLevel(
    movingImage: CanvasImage,
    targetGridX: number,
    targetGridY: number,
    stationaryImages: CanvasImage[],
    cellW: number,
    cellH: number
): number {
    const currentLevel = movingImage.heightLevel ?? 0;
    if (stationaryImages.length === 0) return currentLevel;

    // Build a lookup map of stationary cells by "cellX,cellY"
    const stationaryCellMap = new Map<string, WorldCellCornerData>();
    for (const statImg of stationaryImages) {
        const cells = getImageWorldCellCorners(statImg, cellW, cellH);
        for (const cell of cells) {
            stationaryCellMap.set(`${cell.cellX},${cell.cellY}`, cell);
        }
    }

    // Evaluate moving image's cells at heightLevel = 0 to find the required delta
    const movingCellsZero = getImageWorldCellCorners(movingImage, cellW, cellH, targetGridX, targetGridY, 0);
    if (movingCellsZero.length === 0) return currentLevel;

    const movingCoordSet = new Set(movingCellsZero.map(c => `${c.cellX},${c.cellY}`));

    // Cardinal neighbors and which corners they share:
    // Moving cell [Top=0, Right=1, Bottom=2, Left=3]
    // Neighbor (cx, cy - 1) [NE]: Moving's Top(0) & Right(1) == Neighbor's Left(3) & Bottom(2)
    // Neighbor (cx + 1, cy) [SE]: Moving's Right(1) & Bottom(2) == Neighbor's Top(0) & Left(3)
    // Neighbor (cx, cy + 1) [SW]: Moving's Bottom(2) & Left(3) == Neighbor's Right(1) & Top(0)
    // Neighbor (cx - 1, cy) [NW]: Moving's Left(3) & Top(0) == Neighbor's Bottom(2) & Right(1)
    const EDGE_NEIGHBORS: Array<{
        dx: number;
        dy: number;
        mCorners: [number, number];
        nCorners: [number, number];
    }> = [
        { dx: 0, dy: -1, mCorners: [0, 1], nCorners: [3, 2] }, // NE edge
        { dx: 1, dy: 0, mCorners: [1, 2], nCorners: [0, 3] },  // SE edge
        { dx: 0, dy: 1, mCorners: [2, 3], nCorners: [1, 0] },  // SW edge
        { dx: -1, dy: 0, mCorners: [3, 0], nCorners: [2, 1] }, // NW edge
    ];

    const exactEdgeCandidates: number[] = [];
    const partialEdgeCandidates: number[] = [];

    for (const mCell of movingCellsZero) {
        for (const edge of EDGE_NEIGHBORS) {
            const nKey = `${mCell.cellX + edge.dx},${mCell.cellY + edge.dy}`;
            if (movingCoordSet.has(nKey)) continue;
            const nCell = stationaryCellMap.get(nKey);
            if (!nCell) continue;

            const diffA = nCell.corners[edge.nCorners[0]] - mCell.corners[edge.mCorners[0]];
            const diffB = nCell.corners[edge.nCorners[1]] - mCell.corners[edge.mCorners[1]];

            if (diffA === diffB) {
                exactEdgeCandidates.push(diffA);
            } else {
                // When a flat edge meets a 1-corner slope edge, prefer the higher corner if it's a ramp crest
                partialEdgeCandidates.push(Math.round((diffA + diffB) / 2));
            }
        }
    }

    if (exactEdgeCandidates.length > 0) {
        // Pick the most frequent exact edge match (or highest if tied so tiles step up onto ramp crests cleanly)
        const counts = new Map<number, number>();
        for (const val of exactEdgeCandidates) {
            counts.set(val, (counts.get(val) || 0) + 1);
        }
        let bestLevel = exactEdgeCandidates[0];
        let bestCount = -1;
        counts.forEach((cnt, lvl) => {
            if (cnt > bestCount || (cnt === bestCount && lvl > bestLevel)) {
                bestCount = cnt;
                bestLevel = lvl;
            }
        });
        return bestLevel;
    }

    if (partialEdgeCandidates.length > 0) {
        return partialEdgeCandidates[0];
    }

    // Check diagonal single-corner neighbors if no cardinal edge was shared
    const DIAGONAL_NEIGHBORS: Array<{
        dx: number;
        dy: number;
        mCorner: number;
        nCorner: number;
    }> = [
        { dx: -1, dy: -1, mCorner: 0, nCorner: 2 }, // Top(0) touches Bottom(2)
        { dx: 1, dy: -1, mCorner: 1, nCorner: 3 },  // Right(1) touches Left(3)
        { dx: 1, dy: 1, mCorner: 2, nCorner: 0 },   // Bottom(2) touches Top(0)
        { dx: -1, dy: 1, mCorner: 3, nCorner: 1 },  // Left(3) touches Right(1)
    ];

    for (const mCell of movingCellsZero) {
        for (const diag of DIAGONAL_NEIGHBORS) {
            const nKey = `${mCell.cellX + diag.dx},${mCell.cellY + diag.dy}`;
            if (movingCoordSet.has(nKey)) continue;
            const nCell = stationaryCellMap.get(nKey);
            if (!nCell) continue;
            return nCell.corners[diag.nCorner] - mCell.corners[diag.mCorner];
        }
    }

    return currentLevel;
}

/**
 * Batch-propagates height levels across a set of target tile IDs (or all tiles) using BFS from
 * existing ramps and lowest ground tiles so an entire slope + cliff-top arrangement snaps flush.
 */
export function autoMatchTileHeightsOnCanvas(
    allImages: CanvasImage[],
    targetIds: Set<string>,
    cellW: number,
    cellH: number
): CanvasImage[] {
    if (allImages.length <= 1) return allImages;

    const idsToSolve = targetIds.size > 0 ? new Set(targetIds) : new Set(allImages.map(i => i.id));
    const updated = allImages.map(img => ({ ...img, heightLevel: img.heightLevel ?? 0 }));

    // Perform up to 4 relaxation passes so chained ramps (Level 0 -> Level 1 -> Level 2) propagate cleanly
    for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        for (let i = 0; i < updated.length; i++) {
            const img = updated[i];
            if (!idsToSolve.has(img.id)) continue;

            // If we are solving all tiles and this tile is a base ramp at Level 0, let it anchor pass 0
            const stationary = updated.filter((_, idx) => idx !== i);
            const nextLevel = computeSmartTileHeightLevel(
                img,
                img.gridX,
                img.gridY,
                stationary,
                cellW,
                cellH
            );
            if (nextLevel !== (img.heightLevel ?? 0)) {
                updated[i] = { ...img, heightLevel: nextLevel };
                changed = true;
            }
        }
        if (!changed) break;
    }

    // Normalize if the entire solved canvas shifted below 0
    let minLevel = Infinity;
    for (const img of updated) {
        minLevel = Math.min(minLevel, img.heightLevel ?? 0);
    }
    if (minLevel < 0 && targetIds.size === 0) {
        return updated.map(img => ({
            ...img,
            heightLevel: (img.heightLevel ?? 0) - minLevel,
        }));
    }

    return updated;
}

/**
 * Updates moved tile positions and optionally computes smart heightLevel adjustments
 * relative to stationary neighbors when `snapGrid` and `autoSlopeSnap` are active.
 */
export function applyMovedTilesWithSmartHeight(
    allImages: CanvasImage[],
    movedIdSet: Set<string>,
    dgx: number,
    dgy: number,
    snapGrid: boolean,
    autoSlopeSnap: boolean,
    cellW: number,
    cellH: number
): CanvasImage[] {
    const stationary = allImages.filter(img => !movedIdSet.has(img.id));
    const movedImages = allImages.filter(img => movedIdSet.has(img.id));

    let sharedLevelDelta = 0;
    if (snapGrid && autoSlopeSnap && stationary.length > 0 && movedImages.length > 0) {
        // Find the first moved tile that actually touches a stationary neighbor at its new position
        for (const mImg of movedImages) {
            const targetGx = Math.round(mImg.gridX + dgx);
            const targetGy = Math.round(mImg.gridY + dgy);
            const candidateLevel = computeSmartTileHeightLevel(
                mImg,
                targetGx,
                targetGy,
                stationary,
                cellW,
                cellH
            );
            const delta = candidateLevel - (mImg.heightLevel ?? 0);
            if (delta !== 0) {
                sharedLevelDelta = delta;
                break;
            }
            // Even if delta === 0, check if it actually matched a neighbor (by comparing with a dummy currentLevel)
            const checkTouch = computeSmartTileHeightLevel(
                { ...mImg, heightLevel: -999 },
                targetGx,
                targetGy,
                stationary,
                cellW,
                cellH
            );
            if (checkTouch !== -999) {
                sharedLevelDelta = candidateLevel - (mImg.heightLevel ?? 0);
                break;
            }
        }
    }

    return allImages.map(img => {
        if (!movedIdSet.has(img.id)) return img;
        if (snapGrid) {
            return {
                ...img,
                gridX: Math.round(img.gridX + dgx),
                gridY: Math.round(img.gridY + dgy),
                heightLevel: (img.heightLevel ?? 0) + sharedLevelDelta,
            };
        }
        return {
            ...img,
            gridX: img.gridX + dgx,
            gridY: img.gridY + dgy,
        };
    });
}

/**
 * Computes placed coordinates and smart height levels for `heldImages` anchored at `(anchorGridX, anchorGridY)`.
 */
export function computeHeldTilesPlacement(
    heldImages: CanvasImage[],
    anchorGridX: number,
    anchorGridY: number,
    stationaryImages: CanvasImage[],
    autoSlopeSnap: boolean,
    cellW: number,
    cellH: number
): CanvasImage[] {
    const placed: CanvasImage[] = [];
    for (const img of heldImages) {
        const gridX = anchorGridX + img.gridX;
        const gridY = anchorGridY + img.gridY;
        const heightLevel = autoSlopeSnap
            ? computeSmartTileHeightLevel(
                  img,
                  gridX,
                  gridY,
                  [...stationaryImages, ...placed],
                  cellW,
                  cellH
              )
            : (img.heightLevel ?? 0);
        placed.push({
            ...img,
            gridX,
            gridY,
            heightLevel,
        });
    }
    return placed;
}

