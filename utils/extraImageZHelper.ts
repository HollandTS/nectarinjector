import { Tile, TmpParser } from './formats';

export type ExtraZMode = 'blit_cpp_gradient' | 'smart_column' | 'flat_top' | 'uniform';

/**
 * Generates accurate Westwood C&C Tiberian Sun / Red Alert 2 / OpenTS
 * Z-data for base diamond tiles and rectangular extra images.
 */
export function generateTileBaseZData(cx: number, cy: number): Uint8Array {
    const zData = new Uint8Array(cx * cy);
    const maxZ = cy - 1;
    for (let y = 0; y < cy; y++) {
        const baseZ = Math.max(1, Math.min(maxZ, cy - 1 - y));
        const rowOffset = y * cx;
        for (let x = 0; x < cx; x++) {
            if (TmpParser.isInsideWestwoodDiamond(x, y, cx, cy)) {
                zData[rowOffset + x] = baseZ;
            }
        }
    }
    return zData;
}

/**
 * Computes the Westwood isometric base column Z for a given local tile X coordinate.
 */
function computeIsometricColumnBaseZ(localTileX: number, cx: number, cy: number): number {
    const maxAllowedZ = Math.max(1, cy - 1);
    const halfW = cx / 2;
    let floatZ: number;
    if (localTileX <= halfW) {
        floatZ = cy / 2 + localTileX * (cy / cx);
    } else {
        floatZ = cy - 1 - (localTileX - halfW) * (cy / cx);
    }
    return Math.max(1, Math.min(maxAllowedZ, Math.round(floatZ)));
}

/**
 * Generates ExtraZData for a tile's extraImageData.
 * - 'blit_cpp_gradient': Exact Westwood Studios `blit.cpp` bottom-up fractional scanline Z interpolation
 *   (anchored at the bottom root of each object column and stepping with fixed-point `z_fraction`).
 * - 'smart_column': Continuous isometric column depth gradient across X, unified vertically per column.
 * - 'flat_top': Sets non-zero pixels to max engine ceiling (cy - 1) so foliage/trees stay above units.
 * - 'uniform': Uses a custom uniform Z value (clamped to 1 .. cy - 1).
 */
export function generateExtraImageZData(
    cxExtra: number,
    cyExtra: number,
    extraImageData: Uint8Array,
    relXExtra: number,
    cx: number,
    cy: number,
    mode: ExtraZMode = 'blit_cpp_gradient',
    customZ: number = 23,
    existingExtraZ?: Uint8Array | null
): Uint8Array {
    const outZ = new Uint8Array(cxExtra * cyExtra);
    const maxAllowedZ = Math.max(1, cy - 1);

    // Fixed-point fractional parameters from Westwood's blit.cpp ZGradients (45/90 deg slope step)
    const zStepNumerator = 2;
    const zStepDenominator = 1;
    const zStepRatio = Math.max(1, Math.floor(zStepNumerator / zStepDenominator));
    const wrapIncrement = 1;

    for (let x = 0; x < cxExtra; x++) {
        const localTileX = relXExtra + x;
        const isoColZ = computeIsometricColumnBaseZ(localTileX, cx, cy);

        if (mode === 'blit_cpp_gradient') {
            // Find top and bottom opaque scanlines in this column (the vertical span of the object)
            let topY = -1;
            let bottomY = -1;
            for (let y = 0; y < cyExtra; y++) {
                if (extraImageData[y * cxExtra + x] !== 0) {
                    if (topY === -1) topY = y;
                    bottomY = y;
                }
            }
            if (topY === -1 || bottomY === -1) continue;

            const spanHeight = bottomY - topY + 1;
            // Exact blit.cpp bottom-up fractional Z initialization:
            // Start from bottom of the object span anchored to isoColZ, pre-adjust upward by spanHeight
            let currentZ = Math.floor((isoColZ + Math.floor(spanHeight / zStepRatio)) / zStepRatio) * zStepRatio;
            currentZ -= Math.floor(spanHeight / zStepRatio);
            let zFraction = zStepNumerator - (spanHeight % zStepRatio);
            if (zFraction === zStepNumerator) {
                zFraction = 0;
                currentZ += wrapIncrement;
            }

            for (let y = topY; y <= bottomY; y++) {
                const idx = y * cxExtra + x;
                if (extraImageData[idx] !== 0) {
                    if (existingExtraZ && existingExtraZ[idx] > 0 && existingExtraZ[idx] < 200) {
                        outZ[idx] = Math.min(maxAllowedZ, existingExtraZ[idx]);
                    } else {
                        outZ[idx] = Math.max(1, Math.min(maxAllowedZ, currentZ));
                    }
                }
                zFraction += zStepDenominator;
                if (zFraction >= zStepNumerator) {
                    currentZ += wrapIncrement;
                    zFraction -= zStepNumerator;
                }
            }
            continue;
        }

        let colZ: number;
        if (mode === 'flat_top') {
            colZ = maxAllowedZ;
        } else if (mode === 'uniform') {
            colZ = Math.max(1, Math.min(maxAllowedZ, Math.round(customZ)));
        } else {
            colZ = isoColZ;
        }

        for (let y = 0; y < cyExtra; y++) {
            const idx = y * cxExtra + x;
            if (extraImageData[idx] === 0) {
                outZ[idx] = 0;
                continue;
            }
            if (existingExtraZ && existingExtraZ[idx] > 0 && existingExtraZ[idx] < 200) {
                outZ[idx] = Math.min(maxAllowedZ, existingExtraZ[idx]);
            } else {
                outZ[idx] = colZ;
            }
        }
    }

    return outZ;
}

/**
 * Repairs and normalizes ZData and ExtraZData on a Westwood Tile:
 * - Zeros out transparent pixels (index 0) and sentinel bytes (>= 200)
 * - Clamps Z values to engine ceiling (cy - 1)
 * - Repairs missing or out-of-range extraZData using blit.cpp fractional column Z
 */
export function repairTileExtraAndBaseZ(tile: Tile): Tile {
    const maxZ = Math.max(1, tile.cy - 1);
    const newZData = tile.zData
        ? new Uint8Array(tile.zData)
        : generateTileBaseZData(tile.cx, tile.cy);

    for (let y = 0; y < tile.cy; y++) {
        for (let x = 0; x < tile.cx; x++) {
            const idx = y * tile.cx + x;
            const inside = TmpParser.isInsideWestwoodDiamond(x, y, tile.cx, tile.cy);
            if (!inside) {
                newZData[idx] = 0;
            } else if (newZData[idx] === 0 || newZData[idx] >= 200) {
                newZData[idx] = Math.max(1, Math.min(maxZ, tile.cy - 1 - y));
            } else if (newZData[idx] > maxZ) {
                newZData[idx] = maxZ;
            }
        }
    }

    let newExtraZData = tile.extraZData ? new Uint8Array(tile.extraZData) : null;
    if (tile.header.has_extra_data && tile.extraImageData && tile.header.cx_extra > 0 && tile.header.cy_extra > 0) {
        const ew = tile.header.cx_extra;
        const eh = tile.header.cy_extra;
        const relX = tile.header.x_extra - tile.header.x;

        if (!newExtraZData || newExtraZData.length !== ew * eh) {
            newExtraZData = generateExtraImageZData(
                ew,
                eh,
                tile.extraImageData,
                relX,
                tile.cx,
                tile.cy,
                'blit_cpp_gradient'
            );
        } else {
            for (let i = 0; i < newExtraZData.length; i++) {
                if (tile.extraImageData[i] === 0 || newExtraZData[i] >= 200) {
                    newExtraZData[i] = 0;
                } else if (newExtraZData[i] > maxZ) {
                    newExtraZData[i] = maxZ;
                }
            }
            const fallbackZ = generateExtraImageZData(
                ew,
                eh,
                tile.extraImageData,
                relX,
                tile.cx,
                tile.cy,
                'blit_cpp_gradient'
            );
            for (let i = 0; i < newExtraZData.length; i++) {
                if (tile.extraImageData[i] !== 0 && newExtraZData[i] === 0) {
                    newExtraZData[i] = fallbackZ[i];
                }
            }
        }
    }

    return {
        ...tile,
        zData: newZData,
        extraZData: newExtraZData,
        header: {
            ...tile.header,
            has_z_data: true,
            flags: tile.header.flags | 0x02 | (tile.header.has_extra_data ? 0x01 : 0),
        },
    };
}
