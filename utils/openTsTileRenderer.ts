import type { Tile, TmpFile } from './formats';
import type { CanvasImage, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';

/**
 * OpenTS Isometric Tile Rasterizer Constants & Span Builder (from OPENTS_CODE/isotype.cpp):
 * - ISO_WIDTH = 48, ISO_HEIGHT = 24
 * - ISO_DRAW_WIDTH = 48, ISO_DRAW_HEIGHT = 23 (ISO_HEIGHT - 1)
 * - Row 11 (halfH - 1) is the single 48px-wide equator row.
 * - Row 23 (cy - 1) in _tilemask is 48 spaces (0 pixels drawn).
 * - Each row y in [0..halfH-1] has span width (y + 1) * stepFull starting at x = halfW - (y + 1) * stepHalf.
 * - Each row y in [halfH..cy-2] is symmetric around y = halfH - 1:
 *   mirrorY = (cy - 2) - y, span width = (mirrorY + 1) * stepFull.
 * - _iso_row_bases for 48x24:
 *   [0, 4, 12, 24, 40, 60, 84, 112, 144, 180, 220, 264, 312, 356, 396, 432, 464, 492, 516, 536, 552, 564, 572, 576]
 */

export interface OpenTsSpanInfo {
    startCol: number;
    runLength: number;
    streamOffset: number;
}

const spanTableCache = new Map<string, OpenTsSpanInfo[]>();

/**
 * Builds the exact OpenTS scanline span table for a tile of dimensions (cx, cy).
 * Matches `_tilemask`, `_iso_start_cols`, `_iso_run_lengths`, and `_iso_row_bases` from `OPENTS_CODE/isotype.cpp`.
 */
export function getOpenTsDiamondSpans(cx: number, cy: number): OpenTsSpanInfo[] {
    const key = `${cx}x${cy}`;
    const cached = spanTableCache.get(key);
    if (cached) return cached;

    const halfW = Math.floor(cx / 2);
    const halfH = Math.floor(cy / 2);
    const stepHalf = Math.max(1, Math.round(cx / cy)); // 2 for 2:1 isometric
    const stepFull = stepHalf * 2; // 4 for 2:1 isometric

    const spans: OpenTsSpanInfo[] = [];
    let streamOffset = 0;

    // Top half including the widest equator row (y = 0 .. halfH - 1)
    for (let y = 0; y < halfH; y++) {
        const runLength = (y + 1) * stepFull;
        const startCol = halfW - (y + 1) * stepHalf;
        spans.push({
            startCol: Math.max(0, startCol),
            runLength: Math.min(cx, runLength),
            streamOffset,
        });
        streamOffset += runLength;
    }

    // Bottom half constriction (y = halfH .. cy - 1), symmetric around y = halfH - 1
    // In isotype.cpp _tilemask, row 12 has 44 pixels (startCol = 2), down to row 22 with 4 pixels,
    // and row 23 (y = cy - 1) is completely empty (0 pixels drawn, ISO_DRAW_HEIGHT = ISO_HEIGHT - 1).
    for (let y = halfH; y < cy; y++) {
        const mirrorY = (cy - 2) - y;
        if (mirrorY < 0) {
            spans.push({
                startCol: halfW,
                runLength: 0,
                streamOffset,
            });
        } else {
            const runLength = (mirrorY + 1) * stepFull;
            const startCol = halfW - (mirrorY + 1) * stepHalf;
            spans.push({
                startCol: Math.max(0, startCol),
                runLength: Math.min(cx, runLength),
                streamOffset,
            });
            streamOffset += runLength;
        }
    }

    spanTableCache.set(key, spans);
    return spans;
}

/**
 * Checks whether local pixel (lx, ly) is inside the OpenTS `_tilemask` diamond
 * (23 active scanlines for 48x24, symmetric around row halfH - 1, so adjacent tiles tessellate with 0 overlap).
 */
export function isInsideOpenTsDiamond(lx: number, ly: number, cx: number, cy: number): boolean {
    if (lx < 0 || lx >= cx || ly < 0 || ly >= cy - 1) return false;
    const spans = getOpenTsDiamondSpans(cx, cy);
    const span = spans[ly];
    if (!span || span.runLength <= 0) return false;
    return lx >= span.startCol && lx < span.startCol + span.runLength;
}

/**
 * Decodes the raw packed diamond stream into a (cx * cy) rectangular buffer using the OpenTS `_tilemask` spans.
 */
export function decodeOpenTsTileDiamond(packed: Uint8Array, cx: number, cy: number): Uint8Array {
    const rect = new Uint8Array(cx * cy);
    if (packed.length < (cx * cy) / 2) return rect;

    const spans = getOpenTsDiamondSpans(cx, cy);
    for (let y = 0; y < cy; y++) {
        const span = spans[y];
        if (!span || span.runLength <= 0) continue;
        const rowOff = y * cx + span.startCol;
        let srcOff = span.streamOffset;
        for (let i = 0; i < span.runLength; i++) {
            if (srcOff < packed.length) {
                rect[rowOff + i] = packed[srcOff++];
            }
        }
    }
    return rect;
}

/**
 * Encodes a (cx * cy) rectangular buffer back into the packed diamond stream using the OpenTS `_tilemask` spans.
 */
export function encodeOpenTsTileDiamond(rect: Uint8Array, cx: number, cy: number): Uint8Array {
    const diamondSize = (cx * cy) / 2;
    const packed = new Uint8Array(diamondSize);
    const spans = getOpenTsDiamondSpans(cx, cy);

    for (let y = 0; y < cy; y++) {
        const span = spans[y];
        if (!span || span.runLength <= 0) continue;
        const rowOff = y * cx + span.startCol;
        let dstOff = span.streamOffset;
        for (let i = 0; i < span.runLength; i++) {
            if (dstOff < diamondSize) {
                packed[dstOff++] = rect[rowOff + i];
            }
        }
    }
    return packed;
}

/**
 * Computes the isometric cell foot-size (in grid cells) of a tile for packing/layout.
 * For `.TMP` files, uses the active sub-tile cell footprint (`tmpCells` or `tmpCols`/`tmpRows`)
 * or parses the TMP header so multi-tile templates, ramps, and cliff pieces pack with exact OpenTS cell spacing.
 */
export function getTileCellSpan(image: CanvasImage, cellW: number, cellH: number): {
    spanX: number;
    spanY: number;
    minCol: number;
    minRow: number;
} {
    if (image.tmpCells && image.tmpCells.length > 0) {
        let minCol = Infinity;
        let maxCol = -Infinity;
        let minRow = Infinity;
        let maxRow = -Infinity;
        for (const c of image.tmpCells) {
            minCol = Math.min(minCol, c.col);
            maxCol = Math.max(maxCol, c.col);
            minRow = Math.min(minRow, c.row);
            maxRow = Math.max(maxRow, c.row);
        }
        if (minCol !== Infinity && minRow !== Infinity) {
            return {
                spanX: Math.max(1, maxCol - minCol + 1),
                spanY: Math.max(1, maxRow - minRow + 1),
                minCol,
                minRow,
            };
        }
    }

    if (image.tmpCols && image.tmpCols > 0 && image.tmpRows && image.tmpRows > 0) {
        return {
            spanX: image.tmpCols,
            spanY: image.tmpRows,
            minCol: 0,
            minRow: 0,
        };
    }

    if (image.tmpBuffer) {
        try {
            const actualBuffer =
                image.tmpBuffer instanceof ArrayBuffer
                    ? image.tmpBuffer
                    : (image.tmpBuffer as any)?.buffer instanceof ArrayBuffer
                    ? (image.tmpBuffer as any).buffer
                    : null;
            if (actualBuffer && actualBuffer.byteLength >= 16) {
                const dv = new DataView(actualBuffer);
                const cbx = dv.getInt32(0, true);
                const cby = dv.getInt32(4, true);
                const cx = dv.getInt32(8, true);
                const cy = dv.getInt32(12, true);
                if (
                    cbx > 0 &&
                    cbx <= 64 &&
                    cby > 0 &&
                    cby <= 64 &&
                    ((cx === 48 && cy === 24) || (cx === 60 && cy === 30) || (cx === 96 && cy === 48))
                ) {
                    let minCol = Infinity;
                    let maxCol = -Infinity;
                    let minRow = Infinity;
                    let maxRow = -Infinity;
                    const count = cbx * cby;
                    for (let i = 0; i < count; i++) {
                        const idxOff = 16 + i * 4;
                        if (idxOff + 4 > actualBuffer.byteLength) break;
                        const tileOff = dv.getInt32(idxOff, true);
                        if (tileOff > 0 && tileOff < actualBuffer.byteLength) {
                            const col = i % cbx;
                            const row = Math.floor(i / cbx);
                            minCol = Math.min(minCol, col);
                            maxCol = Math.max(maxCol, col);
                            minRow = Math.min(minRow, row);
                            maxRow = Math.max(maxRow, row);
                        }
                    }
                    if (minCol !== Infinity && minRow !== Infinity) {
                        return {
                            spanX: Math.max(1, maxCol - minCol + 1),
                            spanY: Math.max(1, maxRow - minRow + 1),
                            minCol,
                            minRow,
                        };
                    }
                    return { spanX: cbx, spanY: cby, minCol: 0, minRow: 0 };
                }
            }
        } catch {
            // Fallback below
        }
    }
    const span = Math.max(1, Math.round(image.width / cellW));
    return { spanX: span, spanY: span, minCol: 0, minRow: 0 };
}
