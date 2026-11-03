import { TmpFile, Tile, TmpParser } from '../../lib/formats';

export interface BatchRepairSummary {
  repairedTileCount: number;
  clearedZeroPixels: number;
  clampedMaxPixels: number;
  alignedCliffColumns: number;
}

/**
 * Repairs all tiles in a TmpFile:
 * - Cleans transparent & out-of-diamond pixels in base diamond Z data
 * - Cleans transparent pixels in extra cliff Z data
 * - Clamps any Z values exceeding (cy - 1)
 * - Aligns cliff columns to uniform depth
 */
export function autoFixAllTiles(tmpFile: TmpFile): { updatedTmp: TmpFile; summary: BatchRepairSummary } {
  let repairedTileCount = 0;
  let clearedZeroPixels = 0;
  let clampedMaxPixels = 0;
  let alignedCliffColumns = 0;

  const maxEngineZ = tmpFile.cy - 1;

  const updatedTiles = tmpFile.tiles.map((tile) => {
    if (!tile) return null;

    let modified = false;
    let newZData = tile.zData ? new Uint8Array(tile.zData) : null;
    let newExtraZData = tile.extraZData ? new Uint8Array(tile.extraZData) : null;

    // 1. Repair Base Diamond Z
    if (newZData) {
      const isRamp = tile.header.ramp_type > 0;
      for (let y = 0; y < tile.cy; y++) {
        for (let x = 0; x < tile.cx; x++) {
          const idx = y * tile.cx + x;
          const z = newZData[idx];
          const isInside = TmpParser.isInsideWestwoodDiamond(x, y, tile.cx, tile.cy);
          const isTransparent = tile.data[idx] === 0;

          if (z >= 200 || (z > 0 && (isTransparent || (!isRamp && !isInside)))) {
            newZData[idx] = 0;
            clearedZeroPixels++;
            modified = true;
          } else if (z > maxEngineZ) {
            newZData[idx] = maxEngineZ;
            clampedMaxPixels++;
            modified = true;
          }
        }
      }
    }

    // 2. Repair Extra Cliff Z
    if (newExtraZData && tile.extraImageData && tile.header.cx_extra > 0 && tile.header.cy_extra > 0) {
      const ew = tile.header.cx_extra;
      const eh = tile.header.cy_extra;

      // Clean invalid transparent/sentinel pixels (205, 255, etc.)
      for (let i = 0; i < newExtraZData.length; i++) {
        const z = newExtraZData[i];
        if (z >= 200 || (z > 0 && tile.extraImageData[i] === 0)) {
          newExtraZData[i] = 0;
          clearedZeroPixels++;
          modified = true;
        } else if (z > maxEngineZ) {
          newExtraZData[i] = maxEngineZ;
          clampedMaxPixels++;
          modified = true;
        }
      }

      // Align cliff columns
      for (let x = 0; x < ew; x++) {
        const freq = new Map<number, number>();
        let bestZ = 0;
        let maxCount = 0;
        let hasVariance = false;
        let firstZ: number | null = null;

        for (let y = 0; y < eh; y++) {
          const idx = y * ew + x;
          if (tile.extraImageData[idx] !== 0) {
            const z = newExtraZData[idx];
            if (z > 0 && z < 200) {
              if (firstZ === null) {
                firstZ = z;
              } else if (firstZ !== z) {
                hasVariance = true;
              }

              const count = (freq.get(z) || 0) + 1;
              freq.set(z, count);
              if (count > maxCount) {
                maxCount = count;
                bestZ = z;
              }
            }
          }
        }

        if (hasVariance && bestZ > 0 && bestZ <= maxEngineZ) {
          for (let y = 0; y < eh; y++) {
            const idx = y * ew + x;
            if (tile.extraImageData[idx] !== 0) {
              newExtraZData[idx] = bestZ;
            }
          }
          alignedCliffColumns++;
          modified = true;
        }
      }
    }

    if (modified) {
      repairedTileCount++;
      return {
        ...tile,
        zData: newZData,
        extraZData: newExtraZData,
        header: {
          ...tile.header,
          has_z_data: Boolean(
            (newZData && newZData.some((v) => v > 0)) ||
            (newExtraZData && newExtraZData.some((v) => v > 0))
          )
        }
      };
    }

    return tile;
  });

  return {
    updatedTmp: {
      ...tmpFile,
      tiles: updatedTiles
    },
    summary: {
      repairedTileCount,
      clearedZeroPixels,
      clampedMaxPixels,
      alignedCliffColumns
    }
  };
}
