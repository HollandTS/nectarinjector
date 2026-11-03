import type { Tile, TmpFile } from './formats';
import type { CanvasImage } from '../types';

export interface TmpCellFootprint {
    col: number;
    row: number;
    height: number;
    rampType: number;
}

export interface TmpAlignmentData {
    /** Raw pixel bounding-box top-left X of rendered TMP image (includes elevation shift) */
    rawMinX: number;
    /** Raw pixel bounding-box top-left Y of rendered TMP image (includes elevation shift) */
    rawMinY: number;
    /** Ground-level canvas draw offset X relative to cell (0, 0) top-left */
    groundOffsetX: number;
    /** Ground-level canvas draw offset Y relative to cell (0, 0) top-left (cancels base elevation shift so ground edges snap flush) */
    groundOffsetY: number;
    /** Number of columns in the TMP block grid */
    cols: number;
    /** Number of rows in the TMP block grid */
    rows: number;
    /** Minimum active sub-tile column index */
    minCol: number;
    /** Maximum active sub-tile column index */
    maxCol: number;
    /** Minimum active sub-tile row index */
    minRow: number;
    /** Maximum active sub-tile row index */
    maxRow: number;
    /** Minimum height level among active sub-tiles (ground reference level) */
    minHeight: number;
    /** Maximum height level among active sub-tiles */
    maxHeight: number;
    /** Whether any sub-tile in this TMP is a ramp (`ramp_type > 0`) */
    hasRamp: boolean;
    /** Active cell footprints within the TMP block table */
    cells: TmpCellFootprint[];
}

/**
 * Determines whether a TMP file should be rendered without subtracting per-tile `height * (cy / 2)`
 * so that all ramp sub-tiles and ground-level edges stay flush on the 2D isometric canvas grid.
 *
 * Why:
 * - Single-tile ramps (1x1 TMP with `ramp_type > 0` or `height > 0`) have `h.x = 0, h.y = 0`,
 *   and if `elev = h.height * (cy / 2)` is subtracted, `minY` becomes `-elev`, shifting the
 *   tile upward by 12px/15px per height level so its edges no longer snap flush with flat tiles.
 * - Multi-tile cliff/ramp templates (like `ramp01.tem`) store pre-elevated pixel coordinates in
 *   some sub-tiles and un-elevated coordinates in others, so `renderCompleteToCanvas` needs
 *   the standard `elev` during internal compositing, while `groundOffsetY` cancels any uniform
 *   base `minHeight` shift on the canvas.
 */
export function shouldZeroSingleTileElevation(tmp: TmpFile): boolean {
    if (!tmp || !tmp.tiles) return false;
    const active = tmp.tiles.filter((t): t is Tile => t !== null);
    if (active.length === 0) return false;
    if (active.length === 1) {
        return true;
    }
    // Also check if all active tiles share the exact same height > 0 (uniformly elevated flat/ramp block)
    const firstH = active[0].header?.height || 0;
    if (firstH > 0 && active.every(t => (t.header?.height || 0) === firstH)) {
        return true;
    }
    return false;
}

/**
 * Extracts raw render bounding-box offsets (`rawMinX`, `rawMinY`), ground-level canvas draw offsets
 * (`groundOffsetX`, `groundOffsetY`), and the true active cell footprint from a parsed Westwood TMP file.
 */
export function computeTmpAlignmentData(tmp: TmpFile): TmpAlignmentData {
    if (!tmp || !tmp.tiles) {
        return {
            rawMinX: 0,
            rawMinY: 0,
            groundOffsetX: 0,
            groundOffsetY: 0,
            cols: 1,
            rows: 1,
            minCol: 0,
            maxCol: 0,
            minRow: 0,
            maxRow: 0,
            minHeight: 0,
            maxHeight: 0,
            hasRamp: false,
            cells: [],
        };
    }

    const mult = tmp.cy / 2;
    const cbx = Math.max(1, tmp.cblocks_x || 1);
    const cby = Math.max(1, tmp.cblocks_y || 1);

    let fileMinX = Infinity;
    let fileMinY = Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minHeight = Infinity;
    let maxHeight = -Infinity;
    let hasRamp = false;
    const cells: TmpCellFootprint[] = [];

    tmp.tiles.forEach((tile, slotIdx) => {
        if (!tile || !tile.header) return;
        const h = tile.header;
        const height = h.height || 0;
        const rampType = h.ramp_type || 0;
        const elev = height * mult;
        const col = slotIdx % cbx;
        const row = Math.floor(slotIdx / cbx);

        fileMinX = Math.min(fileMinX, h.x);
        fileMinY = Math.min(fileMinY, h.y - elev);

        if (h.has_extra_data && tile.extraImageData && h.cx_extra > 0 && h.cy_extra > 0) {
            fileMinX = Math.min(fileMinX, h.x_extra);
            fileMinY = Math.min(fileMinY, h.y_extra - elev);
        }

        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
        if (rampType > 0) hasRamp = true;

        cells.push({
            col,
            row,
            height,
            rampType,
        });
    });

    if (cells.length === 0) {
        return {
            rawMinX: 0,
            rawMinY: 0,
            groundOffsetX: 0,
            groundOffsetY: 0,
            cols: cbx,
            rows: cby,
            minCol: 0,
            maxCol: 0,
            minRow: 0,
            maxRow: 0,
            minHeight: 0,
            maxHeight: 0,
            hasRamp: false,
            cells: [],
        };
    }

    const rawMinX = fileMinX === Infinity ? 0 : fileMinX;
    const rawMinY = fileMinY === Infinity ? 0 : fileMinY;
    const baseHeight = minHeight === Infinity ? 0 : minHeight;
    const topHeight = maxHeight === -Infinity ? 0 : maxHeight;

    // Adding `baseHeight * mult` brings the lowest cell in the template down to ground level (elevation 0)
    // so single-tile ramps or elevated tiles with height > 0 sit flush on the canvas grid at their cell diamond.
    return {
        rawMinX,
        rawMinY,
        groundOffsetX: rawMinX,
        groundOffsetY: rawMinY + baseHeight * mult,
        cols: cbx,
        rows: cby,
        minCol: minCol === Infinity ? 0 : minCol,
        maxCol: maxCol === -Infinity ? 0 : maxCol,
        minRow: minRow === Infinity ? 0 : minRow,
        maxRow: maxRow === -Infinity ? 0 : maxRow,
        minHeight: baseHeight,
        maxHeight: topHeight,
        hasRamp,
        cells,
    };
}

/**
 * Returns the active cell footprint for a `CanvasImage` (either from cached `tmpCells`,
 * parsed `tmpBuffer`, or a standard rectangular `spanX * spanY` grid).
 */
export function getCanvasImageCells(
    image: CanvasImage,
    cellW: number,
    cellH: number
): TmpCellFootprint[] {
    if (image.tmpCells && image.tmpCells.length > 0) {
        return image.tmpCells;
    }
    const cols = image.tmpCols && image.tmpCols > 0 ? image.tmpCols : Math.max(1, Math.round(image.width / cellW));
    const rows = image.tmpRows && image.tmpRows > 0 ? image.tmpRows : cols;
    const result: TmpCellFootprint[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            result.push({ col: c, row: r, height: 0, rampType: 0 });
        }
    }
    return result;
}
