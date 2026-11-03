import { getDiamondBounds } from './tileResizer';
import type { TileEdgeMask } from './tileEdgeMask';

export interface RampDetection {
  isUpperHalfRamp: boolean;
  isFullHeightRamp: boolean;
  rampType: number; // 1 = upper NW-SE, 2 = upper NE-SW, 0 = other/generic
  swRampWidth: number;
}

/**
 * Analyzes source tile geometry to detect ramp type and dimensions.
 */
export function detectRampGeometry(
  srcMinX: Int32Array,
  srcMaxX: Int32Array,
  sw: number,
  sh: number,
  rampTypeHeader: number,
  isRampFlag: boolean
): RampDetection {
  let firstSy = -1;
  let lastSy = -1;
  let maxW = 0;

  for (let y = 0; y < sh; y++) {
    if (srcMinX[y] !== -1 && srcMaxX[y] !== -1) {
      if (firstSy === -1) firstSy = y;
      lastSy = y;
      const w = srcMaxX[y] - srcMinX[y] + 1;
      if (w > maxW) maxW = w;
    }
  }

  const halfSh = Math.floor(sh / 2);
  const isUpperHalf = firstSy <= 1 && lastSy < halfSh + 1;
  const isFullHeight = firstSy <= 1 && lastSy >= sh - 3;

  let rampType = rampTypeHeader;
  if (rampType === 0 && (isRampFlag || isUpperHalf)) {
    // Check if left edge follows diamond left edge
    let leftMatches = 0;
    let rightMatches = 0;
    let checkedRows = 0;

    for (let y = firstSy; y <= lastSy; y++) {
      if (srcMinX[y] === -1) continue;
      const tb = getDiamondBounds(y, sw, sh, 0);
      if (tb.w <= 0) continue;
      checkedRows++;
      if (Math.abs(srcMinX[y] - tb.x) <= 1) leftMatches++;
      if (Math.abs(srcMaxX[y] - (tb.x + tb.w - 1)) <= 1) rightMatches++;
    }

    if (checkedRows >= 3) {
      if (leftMatches > rightMatches && leftMatches >= checkedRows * 0.6) {
        rampType = 1;
      } else if (rightMatches > leftMatches && rightMatches >= checkedRows * 0.6) {
        rampType = 2;
      }
    }
  }

  const swRampWidth = maxW > 0 ? maxW : Math.floor(sw / 2);

  return {
    isUpperHalfRamp: isUpperHalf,
    isFullHeightRamp: isFullHeight,
    rampType,
    swRampWidth
  };
}

/**
 * Builds an exact 2:1 isometric ramp mask for target tile dimensions.
 * Eliminates seam gaps, row cutoffs, and edge stair-step jitter.
 */
export function buildRampMask(
  detection: RampDetection,
  dw: number,
  dh: number,
  srcMinX: Int32Array,
  srcMaxX: Int32Array,
  sw: number,
  sh: number
): TileEdgeMask {
  const left = new Int32Array(dh).fill(-1);
  const right = new Int32Array(dh).fill(-1);
  const halfDh = Math.floor(dh / 2);
  const targetRampWidth = Math.floor(dw / 2);

  if (detection.isUpperHalfRamp && (detection.rampType === 1 || detection.rampType === 2)) {
    // Exact upper-half diamond ramp: spans row 0 to halfDh - 1 (row 29 for 60-height, row 23 for 48-height)
    for (let ty = 0; ty < halfDh; ty++) {
      const tb = getDiamondBounds(ty, dw, dh, 0);
      if (tb.w <= 0) continue;

      if (detection.rampType === 1) {
        // Upper NW-SE ramp (e.g. slope01): left follows diamond, width = targetRampWidth
        left[ty] = tb.x;
        right[ty] = Math.min(tb.x + tb.w - 1, tb.x + targetRampWidth - 1);
      } else {
        // Upper NE-SW ramp (e.g. slope02): right follows diamond, width = targetRampWidth
        right[ty] = tb.x + tb.w - 1;
        left[ty] = Math.max(tb.x, right[ty] - targetRampWidth + 1);
      }
    }

    return { left, right, isStandardDiamond: false, dw, dh };
  }

  // General ramp or slope contour interpolation with normalized height mapping
  let firstSy = 0;
  let lastSy = sh - 1;
  while (firstSy < sh && srcMinX[firstSy] === -1) firstSy++;
  while (lastSy >= 0 && srcMinX[lastSy] === -1) lastSy--;

  if (firstSy > lastSy) {
    return { left, right, isStandardDiamond: false, dw, dh };
  }

  const targetFirstTy = firstSy <= 1 ? 0 : Math.round((firstSy / sh) * dh);
  let targetLastTy: number;
  if (detection.isUpperHalfRamp) {
    targetLastTy = halfDh - 1;
  } else if (detection.isFullHeightRamp) {
    targetLastTy = dh - 2;
  } else {
    targetLastTy = Math.min(dh - 1, Math.round(((lastSy + 1) / sh) * dh) - 1);
  }

  const scaleX = dw / sw;

  for (let ty = targetFirstTy; ty <= targetLastTy; ty++) {
    const dstTb = getDiamondBounds(ty, dw, dh, 0);
    if (dstTb.w <= 0) continue;

    const progress = targetLastTy > targetFirstTy ? (ty - targetFirstTy) / (targetLastTy - targetFirstTy) : 0;
    const clampedSrcY = Math.max(firstSy, Math.min(lastSy, firstSy + progress * (lastSy - firstSy)));
    const sy0 = Math.floor(clampedSrcY);
    const sy1 = Math.min(lastSy, Math.ceil(clampedSrcY));
    const fy = clampedSrcY - sy0;

    let sMin = srcMinX[sy0] !== -1 && srcMinX[sy1] !== -1 
      ? (1 - fy) * srcMinX[sy0] + fy * srcMinX[sy1]
      : srcMinX[sy0] !== -1 ? srcMinX[sy0] : srcMinX[sy1];

    let sMax = srcMaxX[sy0] !== -1 && srcMaxX[sy1] !== -1
      ? (1 - fy) * srcMaxX[sy0] + fy * srcMaxX[sy1]
      : srcMaxX[sy0] !== -1 ? srcMaxX[sy0] : srcMaxX[sy1];

    if (sMin === -1 || sMax === -1) continue;

    const tb0 = getDiamondBounds(sy0, sw, sh, 0);
    const tb1 = getDiamondBounds(sy1, sw, sh, 0);
    const isLeftDiamond = (srcMinX[sy0] !== -1 && Math.abs(srcMinX[sy0] - tb0.x) <= 1) &&
                          (srcMinX[sy1] !== -1 && Math.abs(srcMinX[sy1] - tb1.x) <= 1);
    const isRightDiamond = (srcMaxX[sy0] !== -1 && Math.abs(srcMaxX[sy0] - (tb0.x + tb0.w - 1)) <= 1) &&
                           (srcMaxX[sy1] !== -1 && Math.abs(srcMaxX[sy1] - (tb1.x + tb1.w - 1)) <= 1);

    const targetL = isLeftDiamond
      ? dstTb.x
      : Math.max(dstTb.x, Math.min(dstTb.x + dstTb.w - 1, Math.round(sMin * scaleX)));

    const targetR = isRightDiamond
      ? dstTb.x + dstTb.w - 1
      : Math.max(dstTb.x, Math.min(dstTb.x + dstTb.w - 1, Math.round((sMax + 1) * scaleX) - 1));

    if (targetL <= targetR) {
      left[ty] = targetL;
      right[ty] = targetR;
    }
  }

  return { left, right, isStandardDiamond: false, dw, dh };
}
