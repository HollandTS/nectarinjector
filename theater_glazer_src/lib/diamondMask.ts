import { getDiamondBounds } from './tileResizer';
import type { TileEdgeMask } from './tileEdgeMask';

/**
 * Computes a standard 2:1 isometric diamond mask spanning the full tile footprint.
 * In Westwood C&C (Tiberian Sun and RA2), base diamond Z-buffers always cover
 * the entire diamond regardless of terrain art cuts or transparency.
 */
export function computeDiamondMask(dw: number, dh: number): TileEdgeMask {
  const left = new Int32Array(dh).fill(-1);
  const right = new Int32Array(dh).fill(-1);

  for (let ty = 0; ty < dh; ty++) {
    const tb = getDiamondBounds(ty, dw, dh, 0);
    if (tb.w > 0) {
      left[ty] = tb.x;
      right[ty] = tb.x + tb.w - 1;
    }
  }

  return { left, right, isStandardDiamond: true, dw, dh };
}
