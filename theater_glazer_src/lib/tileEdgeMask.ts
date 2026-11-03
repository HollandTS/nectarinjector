import { getDiamondBounds } from './tileResizer';
import { regularizeEdgeSteps } from './edgeStepOptimizer';
import { detectRampGeometry, buildRampMask } from './rampMask';

export interface TileEdgeMask {
  left: Int32Array;
  right: Int32Array;
  isStandardDiamond: boolean;
  dw: number;
  dh: number;
}

/**
 * Computes a high-precision edge boundary mask for a tile during resizing.
 * - For standard diamond tiles, preserves exact 2:1 isometric diamond bounds.
 * - For custom tiles (ramps, slopes, cuts), tracks custom pixel contours
 *   and regularizes step rhythms to prevent sampling jitter.
 */
export function computeTargetTileMask(
  srcData: Uint8Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  isRamp: boolean = false,
  rampTypeHeader: number = 0
): TileEdgeMask {
  const left = new Int32Array(dh).fill(-1);
  const right = new Int32Array(dh).fill(-1);

  // 1. Scan source tile row boundaries
  const srcMinX = new Int32Array(sh).fill(-1);
  const srcMaxX = new Int32Array(sh).fill(-1);
  let firstSy = -1;
  let lastSy = -1;
  let customCutDeviations = 0;
  let totalSolidRows = 0;

  for (let sy = 0; sy < sh; sy++) {
    const rowOff = sy * sw;
    let minX = -1;
    let maxX = -1;

    for (let sx = 0; sx < sw; sx++) {
      if (srcData[rowOff + sx] !== 0) {
        if (minX === -1) minX = sx;
        maxX = sx;
      }
    }

    srcMinX[sy] = minX;
    srcMaxX[sy] = maxX;

    if (minX !== -1) {
      if (firstSy === -1) firstSy = sy;
      lastSy = sy;
      totalSolidRows++;

      const tb = getDiamondBounds(sy, sw, sh, 0);
      if (tb.w > 0) {
        if (Math.abs(minX - tb.x) > 1 || Math.abs(maxX - (tb.x + tb.w - 1)) > 1) {
          customCutDeviations++;
        }
      } else {
        customCutDeviations++;
      }
    }
  }

  // 2. Strict standard full diamond detection (spans full height and diamond bounds)
  const isStandardDiamond =
    firstSy <= 1 && 
    lastSy >= sh - 2 && 
    totalSolidRows >= sh - 2 && 
    customCutDeviations <= 1;

  if (isStandardDiamond) {
    for (let ty = 0; ty < dh; ty++) {
      const tb = getDiamondBounds(ty, dw, dh, 0);
      if (tb.w > 0) {
        left[ty] = tb.x;
        right[ty] = tb.x + tb.w - 1;
      }
    }
    return { left, right, isStandardDiamond: true, dw, dh };
  }

  // 3. Ramp and slope tile specialized geometric mask
  const rampDetection = detectRampGeometry(srcMinX, srcMaxX, sw, sh, rampTypeHeader, isRamp);
  if (isRamp || rampTypeHeader > 0 || rampDetection.isUpperHalfRamp || rampDetection.rampType > 0) {
    return buildRampMask(rampDetection, dw, dh, srcMinX, srcMaxX, sw, sh);
  }

  // 3. Custom edge / ramp tile mapping (preserves ramp structure, slope cuts, cliff cuts)
  if (firstSy === -1) {
    return { left, right, isStandardDiamond: false, dw, dh };
  }

  const scaleX = dw / sw;
  const scaleY = dh / sh;

  for (let ty = 0; ty < dh; ty++) {
    const dstTb = getDiamondBounds(ty, dw, dh, 0);
    if (dstTb.w <= 0) continue;

    const srcY = (ty + 0.5) / scaleY - 0.5;
    if (srcY < firstSy - 0.5 || srcY > lastSy + 0.5) continue;

    const clampedSrcY = Math.max(firstSy, Math.min(lastSy, srcY));
    const sy0 = Math.max(firstSy, Math.min(lastSy, Math.floor(clampedSrcY)));
    const sy1 = Math.max(firstSy, Math.min(lastSy, Math.ceil(clampedSrcY)));
    const fy = clampedSrcY - sy0;

    if (srcMinX[sy0] === -1 && srcMinX[sy1] === -1) continue;

    let sMin = -1;
    if (srcMinX[sy0] !== -1 && srcMinX[sy1] !== -1) {
      sMin = (1 - fy) * srcMinX[sy0] + fy * srcMinX[sy1];
    } else if (srcMinX[sy0] !== -1) {
      sMin = srcMinX[sy0];
    } else {
      sMin = srcMinX[sy1];
    }

    let sMax = -1;
    if (srcMaxX[sy0] !== -1 && srcMaxX[sy1] !== -1) {
      sMax = (1 - fy) * srcMaxX[sy0] + fy * srcMaxX[sy1];
    } else if (srcMaxX[sy0] !== -1) {
      sMax = srcMaxX[sy0];
    } else {
      sMax = srcMaxX[sy1];
    }

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
      ? (dstTb.x + dstTb.w - 1) 
      : Math.max(dstTb.x, Math.min(dstTb.x + dstTb.w - 1, Math.round(sMax * scaleX)));

    if (targetL <= targetR) {
      left[ty] = targetL;
      right[ty] = targetR;
    }
  }

  // 4. Regularize custom edge steps to preserve pixel rhythms
  const regRight = regularizeEdgeSteps(right, dh, true);
  const regLeft = regularizeEdgeSteps(left, dh, false);

  for (let ty = 0; ty < dh; ty++) {
    const dstTb = getDiamondBounds(ty, dw, dh, 0);
    if (dstTb.w <= 0) {
      left[ty] = -1;
      right[ty] = -1;
      continue;
    }

    let l = regLeft.adjusted[ty];
    let r = regRight.adjusted[ty];

    if (l !== -1 && r !== -1) {
      l = Math.max(dstTb.x, Math.min(dstTb.x + dstTb.w - 1, l));
      r = Math.max(dstTb.x, Math.min(dstTb.x + dstTb.w - 1, r));
      if (l <= r) {
        left[ty] = l;
        right[ty] = r;
      } else {
        left[ty] = -1;
        right[ty] = -1;
      }
    } else {
      left[ty] = -1;
      right[ty] = -1;
    }
  }

  return { left, right, isStandardDiamond: false, dw, dh };
}
