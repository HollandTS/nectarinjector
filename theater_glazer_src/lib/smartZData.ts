/**
 * Smart Z-Data Generator
 * Generates mathematically accurate Westwood C&C Tiberian Sun / RA2 / OpenTS
 * isometric Z-buffer depth data for terrain tiles and extra images.
 */

import { getDiamondBounds } from './tileResizer';
import { interpolateExtraZData } from './extraZInterpolator';

/**
 * Generates crisp, mathematically exact Westwood Z-buffer data for a base diamond tile.
 * In Westwood's engine:
 * TS (48x24): depths range from 1 at bottom to 23 at top (row-by-row: cy - 1 - y).
 * RA2 (60x30): depths range from 1 at bottom to 29 at top (row-by-row: cy - 1 - y).
 * OpenTS (120x60): depths range from 1 at bottom to 59 at top (row-by-row: cy - 1 - y).
 */
export function generateSmartTileZData(
  targetCx: number,
  targetCy: number,
  sourceZData: Uint8Array | null,
  sourceCx: number,
  sourceCy: number,
  targetPixelData: Uint8Array,
  isRamp: boolean = false
): Uint8Array {
  const dw = targetCx;
  const dh = targetCy;
  const newZData = new Uint8Array(dw * dh);

  // Check if source tile had an elevation ceiling / clamp (e.g. cliff foot clamped to cy/2)
  let sourceMaxZ = 0;
  if (sourceZData && sourceZData.length > 0) {
    for (let i = 0; i < sourceZData.length; i++) {
      const v = sourceZData[i];
      if (v !== 0 && v !== 255 && v > sourceMaxZ) {
        sourceMaxZ = v;
      }
    }
  }

  let targetMaxZ = dh - 1;
  if (sourceMaxZ > 0 && sourceCy > 0 && sourceMaxZ < sourceCy - 1) {
    // Proportional clamp ceiling for plateau / cliff tiles
    targetMaxZ = Math.round(sourceMaxZ * (dh / sourceCy));
  }

  for (let ty = 0; ty < dh; ty++) {
    const tb = getDiamondBounds(ty, dw, dh, 0);
    // Base Westwood depth: bottom row = 1, top row = dh - 1
    const baseDepth = Math.max(1, dh - 1 - ty);
    const zValue = Math.min(targetMaxZ, baseDepth);

    const rowOffset = ty * dw;
    for (let tx = 0; tx < dw; tx++) {
      // Must be inside diamond bounds
      if (tx < tb.x || tx >= tb.x + tb.w) {
        newZData[rowOffset + tx] = 0;
        continue;
      }

      // In Westwood C&C, the base diamond Z-buffer ALWAYS covers 100% of the isometric
      // diamond footprint (even on slopes/ramps where the texture only covers part of the tile).
      newZData[rowOffset + tx] = zValue;
    }
  }

  return newZData;
}

/**
 * Generates accurate Westwood extra image Z-data (cliffs, height)
 * with continuous 2D depth gradients, eliminating 3-4px width banding.
 */
export function generateSmartExtraZData(
  targetCxExtra: number,
  targetCyExtra: number,
  sourceExtraZData: Uint8Array | null,
  sourceCxExtra: number,
  sourceCyExtra: number,
  sourceCy: number,
  targetCy: number,
  targetExtraImageData: Uint8Array | null,
  tileXExtra: number = 0,
  targetCx: number = 48
): Uint8Array | null {
  return interpolateExtraZData(
    targetCxExtra,
    targetCyExtra,
    sourceExtraZData,
    sourceCxExtra,
    sourceCyExtra,
    sourceCy,
    targetCy,
    targetExtraImageData,
    tileXExtra,
    targetCx
  );
}

