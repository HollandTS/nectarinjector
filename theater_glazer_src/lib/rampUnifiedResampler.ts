import type { Tile } from './formats';
import { getDiamondBounds } from './tileResizer';
import { getSharpSample } from './sharpSampler';
import { getExactRampSpans, type ExactRampSpec } from './rampExactSpans';
import { getMultiSlopeSpans, type MultiSlopeRole } from './multiSlopeSpans';
import { computeDiamondMask } from './diamondMask';
import { fillTileZFromMask } from './tileMaskFiller';
import { generateSmartTileZData } from './smartZData';
import { interpolateExtraZData } from './extraZInterpolator';
import { repairTileHoles, repairExtraHoles } from './holeRepair';

/**
 * Determines whether a tile in a TmpFile is a canonical single-tile slope (1..20)
 * or part of a pure multi-tile slope set (wslope, drslpe, prslpe), and returns its
 * exact source and destination combined (Base + Extra) geometric specifications.
 */
export function resolveExactSlopeSpecs(
  tile: Tile,
  tileIndex: number,
  allTiles: (Tile | null)[],
  sw: number,
  sh: number,
  dw: number,
  dh: number
): { srcSpec: ExactRampSpec; dstSpec: ExactRampSpec } | null {
  const rampType = tile.header.ramp_type;
  if (rampType < 1 || rampType > 20) return null;

  const nonNullTiles = allTiles.filter((t): t is Tile => t !== null);
  if (nonNullTiles.length === 1) {
    const srcSpec = getExactRampSpans(rampType, sw, sh);
    const dstSpec = getExactRampSpans(rampType, dw, dh);
    if (srcSpec && dstSpec && matchesCombinedFootprint(tile, srcSpec, sw, sh)) {
      return { srcSpec, dstSpec };
    }
    return null;
  }

  // Multi-tile slope set check (e.g. wslope01..04, drslpe01..08, prslpe01..04)
  if (
    nonNullTiles.length >= 2 &&
    nonNullTiles.length <= 4 &&
    rampType >= 1 &&
    rampType <= 4 &&
    nonNullTiles.every(t => t.header.ramp_type === rampType)
  ) {
    const role: MultiSlopeRole =
      tileIndex === 0 ? 'first' : tileIndex === allTiles.length - 1 ? 'last' : 'middle';
    const srcSpec = getMultiSlopeSpans(rampType, role, sw, sh);
    const dstSpec = getMultiSlopeSpans(rampType, role, dw, dh);
    if (srcSpec && dstSpec && matchesCombinedFootprint(tile, srcSpec, sw, sh)) {
      return { srcSpec, dstSpec };
    }
  }

  return null;
}

function matchesCombinedFootprint(
  tile: Tile,
  spec: ExactRampSpec,
  sw: number,
  sh: number
): boolean {
  const lx = tile.header.has_extra_data ? tile.header.x_extra - tile.header.x : 0;
  const ly = tile.header.has_extra_data ? tile.header.y_extra - tile.header.y : 0;

  let checkedRows = 0;
  let matchingRows = 0;

  for (let gy = spec.minY; gy <= spec.maxY; gy++) {
    const expected = spec.getSpan(gy);
    if (!expected) continue;

    let minX = 9999;
    let maxX = -9999;

    if (gy >= 0 && gy < sh) {
      const db = getDiamondBounds(gy, sw, sh, 0);
      for (let x = db.x; x < db.x + db.w; x++) {
        if (tile.data[gy * sw + x] !== 0) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }

    if (tile.header.has_extra_data && tile.extraImageData) {
      const ey = gy - ly;
      if (ey >= 0 && ey < tile.header.cy_extra) {
        for (let ex = 0; ex < tile.header.cx_extra; ex++) {
          if (tile.extraImageData[ey * tile.header.cx_extra + ex] !== 0) {
            const gx = lx + ex;
            minX = Math.min(minX, gx);
            maxX = Math.max(maxX, gx);
          }
        }
      }
    }

    checkedRows++;
    if (minX <= maxX && Math.abs(minX - expected.left) <= 1 && Math.abs(maxX - expected.right) <= 1) {
      matchingRows++;
    }
  }

  return checkedRows > 0 && matchingRows >= checkedRows * 0.85;
}

/**
 * Resamples a slope tile by merging Base Diamond + Extra Data into a single unified
 * surface, resampling with exact row-by-row 2:1 isometric bounds, and splitting back
 * into Base Diamond (rows 0..dh-1 inside diamond) and Extra Data (rows/cols outside diamond).
 */
export function resampleUnifiedSlopeTile(
  tile: Tile,
  srcSpec: ExactRampSpec,
  dstSpec: ExactRampSpec,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  scale: number,
  imageFilter: 'quadratic' | 'linear' | 'box' | 'nearest',
  zFilter: 'quadratic' | 'linear' | 'box' | 'nearest',
  smartZData?: boolean
): Tile {
  const rampType = tile.header.ramp_type;
  const srcLx = tile.header.has_extra_data ? tile.header.x_extra - tile.header.x : 0;
  const srcLy = tile.header.has_extra_data ? tile.header.y_extra - tile.header.y : 0;

  // 1. Assemble unified source surface [srcSpec.minY .. srcSpec.maxY] x [0 .. sw-1]
  const srcTotalH = srcSpec.maxY - srcSpec.minY + 1;
  const srcCombined = new Uint8Array(sw * srcTotalH);
  const srcBounds: { x: number; w: number }[] = [];

  for (let sgy = srcSpec.minY; sgy <= srcSpec.maxY; sgy++) {
    const rowIdx = sgy - srcSpec.minY;
    const sp = srcSpec.getSpan(sgy) || { left: 0, right: -1 };
    const rowOff = rowIdx * sw;

    // Copy base diamond pixels
    if (sgy >= 0 && sgy < sh) {
      const db = getDiamondBounds(sgy, sw, sh, 0);
      for (let x = db.x; x < db.x + db.w; x++) {
        const val = tile.data[sgy * sw + x];
        if (val !== 0) srcCombined[rowOff + x] = val;
      }
    }

    // Copy extra data pixels (extra takes precedence outside diamond)
    if (tile.header.has_extra_data && tile.extraImageData) {
      const ey = sgy - srcLy;
      if (ey >= 0 && ey < tile.header.cy_extra) {
        for (let ex = 0; ex < tile.header.cx_extra; ex++) {
          const val = tile.extraImageData[ey * tile.header.cx_extra + ex];
          const gx = srcLx + ex;
          if (val !== 0 && gx >= 0 && gx < sw) {
            srcCombined[rowOff + gx] = val;
          }
        }
      }
    }

    // Ensure every pixel within [sp.left .. sp.right] on source row has a valid non-zero donor
    let actualMin = 9999;
    let actualMax = -9999;
    for (let x = 0; x < sw; x++) {
      if (srcCombined[rowOff + x] !== 0) {
        actualMin = Math.min(actualMin, x);
        actualMax = Math.max(actualMax, x);
      }
    }
    if (actualMin <= actualMax) {
      srcBounds.push({ x: actualMin, w: actualMax - actualMin + 1 });
    } else {
      srcBounds.push({ x: Math.max(0, sp.left), w: Math.max(0, sp.right - sp.left + 1) });
    }
  }

  // 2. Resample onto unified target surface [dstSpec.minY .. dstSpec.maxY] x [0 .. dw-1]
  const newData = new Uint8Array(dw * dh);
  const newCxExtra = dstSpec.hasExtra ? dstSpec.cxExtra : 0;
  const newCyExtra = dstSpec.hasExtra ? dstSpec.cyExtra : 0;
  const newLocalXExtra = dstSpec.hasExtra ? dstSpec.xExtra : 0;
  const newLocalYExtra = dstSpec.hasExtra ? dstSpec.yExtra : 0;
  const newExtraImageData = dstSpec.hasExtra && newCxExtra > 0 && newCyExtra > 0
    ? new Uint8Array(newCxExtra * newCyExtra)
    : null;

  const leftMask = new Int32Array(dh).fill(-1);
  const rightMask = new Int32Array(dh).fill(-1);

  const dstTotalH = dstSpec.maxY - dstSpec.minY + 1;

  for (let dgy = dstSpec.minY; dgy <= dstSpec.maxY; dgy++) {
    const dsp = dstSpec.getSpan(dgy);
    if (!dsp || dsp.left > dsp.right) continue;

    // Map destination row dgy to source row index sRowFloat in [0 .. srcTotalH - 1]
    let sRowFloat: number;
    if ((rampType === 9 || rampType === 19) && srcSpec.minY === -2 && dstSpec.minY === -2) {
      if (dgy === -2) {
        sRowFloat = 0;
      } else {
        const tY = dstSpec.maxY > -1 ? (dgy - (-1)) / (dstSpec.maxY - (-1)) : 0;
        sRowFloat = Math.min(srcTotalH - 1, 1 + tY * Math.max(0, srcTotalH - 2));
      }
    } else {
      const tY = dstTotalH > 1 ? (dgy - dstSpec.minY) / (dstTotalH - 1) : 0;
      sRowFloat = tY * Math.max(0, srcTotalH - 1);
    }

    const sRowInt = Math.max(0, Math.min(srcTotalH - 1, Math.round(sRowFloat)));
    const sb = srcBounds[sRowInt];
    const db = (dgy >= 0 && dgy < dh) ? getDiamondBounds(dgy, dw, dh, 0) : { x: 0, w: 0 };

    if (dgy >= 0 && dgy < dh && db.w > 0) {
      const bLeft = Math.max(db.x, dsp.left);
      const bRight = Math.min(db.x + db.w - 1, dsp.right);
      if (bLeft <= bRight) {
        leftMask[dgy] = bLeft;
        rightMask[dgy] = bRight;
      }
    }

    for (let dgx = dsp.left; dgx <= dsp.right; dgx++) {
      const tX = dsp.right > dsp.left ? (dgx - dsp.left) / (dsp.right - dsp.left) : 0;
      const sColFloat = sb.w > 0 ? sb.x + tX * (sb.w - 1) : dgx / scale;

      let val = getSharpSample(
        srcCombined,
        sw,
        srcTotalH,
        sColFloat,
        sRowFloat,
        1,
        1,
        srcBounds,
        false,
        imageFilter
      );

      if (val === 0) {
        val = findFallbackCombinedPixel(srcCombined, sw, srcTotalH, sRowInt, Math.round(sColFloat));
      }

      const inDiamond = dgy >= 0 && dgy < dh && db.w > 0 && dgx >= db.x && dgx < db.x + db.w;
      if (inDiamond) {
        newData[dgy * dw + dgx] = val;
      } else if (newExtraImageData) {
        const ey = dgy - newLocalYExtra;
        const ex = dgx - newLocalXExtra;
        if (ey >= 0 && ey < newCyExtra && ex >= 0 && ex < newCxExtra) {
          newExtraImageData[ey * newCxExtra + ex] = val;
        }
      }
    }
  }

  // 3. Z-Data generation for Base and Extra
  let finalZData: Uint8Array | null = null;
  if (smartZData && (tile.zData || tile.header.has_z_data)) {
    finalZData = generateSmartTileZData(dw, dh, tile.zData, sw, sh, newData, true);
  } else if (tile.zData) {
    finalZData = new Uint8Array(dw * dh);
    const zMask = computeDiamondMask(dw, dh);
    fillTileZFromMask(finalZData, tile.zData, zMask, sw, sh, dw, dh, zFilter);
  }

  repairTileHoles(newData, finalZData, dw, dh, {
    left: leftMask,
    right: rightMask
  });

  const newX = Math.round(tile.header.x * scale);
  const newY = Math.round(tile.header.y * scale);
  const absXExtra = dstSpec.hasExtra ? newX + newLocalXExtra : 0;
  const absYExtra = dstSpec.hasExtra ? newY + newLocalYExtra : 0;

  let newExtraZData: Uint8Array | null = null;
  if (newExtraImageData && (tile.extraZData || (smartZData && tile.header.has_z_data))) {
    newExtraZData = interpolateExtraZData(
      newCxExtra,
      newCyExtra,
      tile.extraZData,
      tile.header.cx_extra,
      tile.header.cy_extra,
      sh,
      dh,
      newExtraImageData,
       newLocalXExtra,
      dw
    );
    repairExtraHoles(newExtraImageData, newExtraZData, newCxExtra, newCyExtra, dh - 1);
  }

  return {
    ...tile,
    cx: dw,
    cy: dh,
    header: {
      ...tile.header,
      x: newX,
      y: newY,
      x_extra: absXExtra,
      y_extra: absYExtra,
      cx_extra: newCxExtra,
      cy_extra: newCyExtra,
      has_extra_data: dstSpec.hasExtra,
      has_z_data: smartZData ? (finalZData !== null) : tile.header.has_z_data
    },
    data: newData,
    zData: finalZData,
    extraImageData: newExtraImageData,
    extraZData: newExtraZData
  };
}

function findFallbackCombinedPixel(
  srcCombined: Uint8Array,
  sw: number,
  srcTotalH: number,
  targetRow: number,
  targetCol: number
): number {
  const clampedCol = Math.max(0, Math.min(sw - 1, targetCol));
  for (let rDist = 0; rDist < srcTotalH; rDist++) {
    for (const dy of rDist === 0 ? [0] : [-rDist, rDist]) {
      const ry = targetRow + dy;
      if (ry < 0 || ry >= srcTotalH) continue;
      const rowOff = ry * sw;
      for (let cDist = 0; cDist < sw; cDist++) {
        if (clampedCol - cDist >= 0 && srcCombined[rowOff + clampedCol - cDist] !== 0) {
          return srcCombined[rowOff + clampedCol - cDist];
        }
        if (clampedCol + cDist < sw && srcCombined[rowOff + clampedCol + cDist] !== 0) {
          return srcCombined[rowOff + clampedCol + cDist];
        }
      }
    }
  }
  return 1;
}
