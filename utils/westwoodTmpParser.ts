import { isValidWwPal, parsePalFile, loadDefaultPalette, PaletteColor } from './westwoodPaletteParser';
import { isInsideOpenTsDiamond } from './openTsTileRenderer';
import { decodeTileDiamond, encodeTileDiamond } from './westwoodDiamondUtils';
import { TmpParser, TmpFile, Tile, RGB } from './formats';
import { computeTmpAlignmentData, TmpCellFootprint } from './tmpAlignmentHelper';

// Re-export utility modules so that consumers don't have to change their imports
export { isValidWwPal, parsePalFile, loadDefaultPalette };
export { decodeTileDiamond, encodeTileDiamond };
export type { PaletteColor, TmpCellFootprint };

export type ParsedTmp = TmpFile;
export type WestwoodTile = Tile;

/**
 * Calculates ground-level canvas alignment offsets (`minX`, `minY`), raw render bounding-box offsets
 * (`rawMinX`, `rawMinY`), and active TMP cell footprint (`cols`, `rows`, `cells`) for a parsed TMP file.
 */
export function getTmpMinOffsets(tmp: TmpFile): {
    minX: number;
    minY: number;
    rawMinX: number;
    rawMinY: number;
    cols: number;
    rows: number;
    cells: TmpCellFootprint[];
} {
    const align = computeTmpAlignmentData(tmp);
    return {
        minX: align.groundOffsetX,
        minY: align.groundOffsetY,
        rawMinX: align.rawMinX,
        rawMinY: align.rawMinY,
        cols: align.cols,
        rows: align.rows,
        cells: align.cells,
    };
}

/**
 * Parses Westwood's binary .TMP map terrain tileset data structure.
 */
export function parseTmpFile(buffer: any): TmpFile {
    if (!buffer) {
        throw new Error("No buffer provided to parseTmpFile");
    }
    const actualBuffer = buffer instanceof ArrayBuffer ? buffer : (buffer && buffer.buffer instanceof ArrayBuffer ? buffer.buffer : null);
    if (!actualBuffer) {
        throw new Error("First argument to parseTmpFile must be an ArrayBuffer or contain an ArrayBuffer (.buffer property)");
    }
    return TmpParser.parseTmp(actualBuffer);
}

/**
 * Renders all decoded tiles of a .TMP onto a single fully-constructed composited PNG source.
 */
export function renderTmpToPng(parsed: TmpFile, palette: PaletteColor[]): { src: string; width: number; height: number } {
    const canvas = document.createElement('canvas');
    TmpParser.renderCompleteToCanvas(canvas, parsed, palette);
    return {
        src: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
    };
}

/**
 * Validates whether an ArrayBuffer appears to contain a Westwood TMP file structure.
 */
export function isValidWwTmp(buffer: any): boolean {
    if (!buffer) return false;
    const actualBuffer = buffer instanceof ArrayBuffer ? buffer : (buffer && buffer.buffer instanceof ArrayBuffer ? buffer.buffer : null);
    if (!actualBuffer) return false;
    if (actualBuffer.byteLength < 8) return false;
    const view = new DataView(actualBuffer);
    try {
        const cblocks_x = view.getInt32(0, true);
        const cblocks_y = view.getInt32(4, true);
        const cx = view.getInt32(8, true);
        const cy = view.getInt32(12, true);
        
        const cx16le = view.getUint16(2, true);
        const cy16le = view.getUint16(4, true);
        
        const is32Bit = (cx === 48 && cy === 24) || (cx === 60 && cy === 30) || (cx === 48 && cy === 96) || (cx === 96 && cy === 48);
        const is16Bit = (cx16le === 48 && cy16le === 24) || (cx16le === 60 && cy16le === 30);
        
        if (!is32Bit && !is16Bit) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Updates a TmpFile's tile pixels by mapping RGBA canvas pixels back to indexed palette colors.
 * Uses the exact OpenTS `_tilemask` diamond spans from `OPENTS_CODE/isotype.cpp`.
 */
export function updateTmpFileFromCanvas(canvas: HTMLCanvasElement, tmpFile: TmpFile, palette: PaletteColor[]) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    const activeTiles = tmpFile.tiles.filter((t): t is Tile => t !== null);
    if (activeTiles.length === 0) return;

    const offsets = getTmpMinOffsets(tmpFile);
    const minX = offsets.rawMinX;
    const minY = offsets.rawMinY;
    const mult = tmpFile.cy / 2;

    const colorCache = new Map<number, number>();

    const getClosestIndex = (r: number, g: number, b: number, a: number): number => {
        if (a < 128) return 0;
        
        const key = (r << 16) | (g << 8) | b;
        if (colorCache.has(key)) return colorCache.get(key)!;

        let bestIdx = 1;
        let minDist = Infinity;
        for (let i = 1; i < palette.length; i++) {
            const p = palette[i];
            const dr = p.r - r;
            const dg = p.g - g;
            const db = p.b - b;
            const dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) {
                minDist = dist;
                bestIdx = i;
            }
        }
        colorCache.set(key, bestIdx);
        return bestIdx;
    };

    activeTiles.forEach(tile => {
        const h = tile.header;
        const elev = h.height * mult;

        // 1. Update Base Diamond pixels using exact OpenTS _tilemask
        const bx = h.x - minX;
        const by = (h.y - elev) - minY;

        const tileW = tile.cx;
        const tileH = tile.cy;
        const origBase = tile.data;
        const baseRect = new Uint8Array(tileW * tileH);

        for (let py = 0; py < tileH; py++) {
            for (let px = 0; px < tileW; px++) {
                const bIdx = py * tileW + px;
                if (!isInsideOpenTsDiamond(px, py, tileW, tileH)) {
                    baseRect[bIdx] = 0;
                    continue;
                }

                const cx = bx + px;
                const cy = by + py;

                if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                    const idx = (cy * width + cx) * 4;
                    const r = pixels[idx];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];
                    const a = pixels[idx + 3];
                    
                    if (a < 128) {
                        // User requirement: If isotiles are exported while they have transparency from this brush,
                        // turn black (closest to black in the pal automatically)
                        baseRect[bIdx] = getClosestIndex(0, 0, 0, 255);
                    } else {
                        // Preserve exact original palette index if the pixel color still matches its original palette entry
                        const origPalIdx = origBase ? origBase[bIdx] : 0;
                        const origCol = palette[origPalIdx];
                        if (
                            origPalIdx > 0 &&
                            origCol &&
                            Math.abs(origCol.r - r) <= 4 &&
                            Math.abs(origCol.g - g) <= 4 &&
                            Math.abs(origCol.b - b) <= 4
                        ) {
                            baseRect[bIdx] = origPalIdx;
                        } else {
                            baseRect[bIdx] = getClosestIndex(r, g, b, a);
                        }
                    }
                } else {
                    baseRect[bIdx] = origBase ? origBase[bIdx] : getClosestIndex(0, 0, 0, 255);
                }
            }
        }
        tile.data = baseRect;

        // 2. Update Extra Data pixels (preserving original ExtraImage silhouette where index == 0)
        if (h.has_extra_data && tile.extraImageData) {
            const ex = h.x_extra - minX;
            const ey = (h.y_extra - elev) - minY;
            const ew = h.cx_extra;
            const eh = h.cy_extra;
            const origExtra = tile.extraImageData;
            const extraRect = new Uint8Array(ew * eh);

            for (let py = 0; py < eh; py++) {
                for (let px = 0; px < ew; px++) {
                    const eIdx = py * ew + px;
                    const origPalIdx = origExtra[eIdx];
                    if (origPalIdx === 0) {
                        extraRect[eIdx] = 0;
                        continue;
                    }

                    const cx = ex + px;
                    const cy = ey + py;

                    if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                        const idx = (cy * width + cx) * 4;
                        const r = pixels[idx];
                        const g = pixels[idx + 1];
                        const b = pixels[idx + 2];
                        const a = pixels[idx + 3];

                        const origCol = palette[origPalIdx];
                        if (
                            origCol &&
                            a >= 128 &&
                            Math.abs(origCol.r - r) <= 4 &&
                            Math.abs(origCol.g - g) <= 4 &&
                            Math.abs(origCol.b - b) <= 4
                        ) {
                            extraRect[eIdx] = origPalIdx;
                        } else {
                            extraRect[eIdx] = getClosestIndex(r, g, b, a);
                        }
                    } else {
                        extraRect[eIdx] = origPalIdx;
                    }
                }
            }
            tile.extraImageData = extraRect;
        }
    });
}

