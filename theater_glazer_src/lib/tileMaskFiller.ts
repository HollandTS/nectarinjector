import type { TileEdgeMask } from './tileEdgeMask';
import type { FilterType } from './sharpSampler';

/**
 * Fills pixel data and Z-depth data strictly within the calculated TileEdgeMask.
 * Guarantees:
 * 1. 100% solid terrain inside the mask (zero transparent pinholes).
 * 2. Strict transparency (0) outside the mask.
 * 3. Preserves custom art edge cuts (ramps, slopes) and standard diamond bounds.
 */
export function fillTileFromMask(
  targetData: Uint8Array,
  sourceData: Uint8Array,
  mask: TileEdgeMask,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  filterType: FilterType = 'quadratic'
): void {
  const invScaleX = sw / dw;
  const invScaleY = sh / dh;

  // 1. Initial sampling pass
  for (let ty = 0; ty < dh; ty++) {
    const l = mask.left[ty];
    const r = mask.right[ty];
    const rowOff = ty * dw;

    if (l === -1 || r < l) {
      for (let tx = 0; tx < dw; tx++) {
        targetData[rowOff + tx] = 0;
      }
      continue;
    }

    // Zero outside left edge
    for (let tx = 0; tx < l; tx++) {
      targetData[rowOff + tx] = 0;
    }
    // Zero outside right edge
    for (let tx = r + 1; tx < dw; tx++) {
      targetData[rowOff + tx] = 0;
    }

    const centerY = (ty + 0.5) * invScaleY;
    const syClamped = Math.max(0, Math.min(sh - 1, Math.floor(centerY)));

    for (let tx = l; tx <= r; tx++) {
      const centerX = (tx + 0.5) * invScaleX;
      let val = 0;

      if (filterType === 'nearest') {
        const sx = Math.max(0, Math.min(sw - 1, Math.floor(centerX)));
        val = sourceData[syClamped * sw + sx];
      } else {
        const radiusX = invScaleX <= 1.0 ? Math.max(0.55, invScaleX * 0.85) : invScaleX * 0.9;
        const radiusY = invScaleY <= 1.0 ? Math.max(0.55, invScaleY * 0.85) : invScaleY * 0.9;
        const syStart = Math.max(0, Math.floor(centerY - radiusY));
        const syEnd = Math.min(sh - 1, Math.ceil(centerY + radiusY));
        const sxStart = Math.max(0, Math.floor(centerX - radiusX));
        const sxEnd = Math.min(sw - 1, Math.ceil(centerX + radiusX));

        const weights = new Map<number, number>();
        let maxW = -1;
        let bestVal = 0;

        for (let sy = syStart; sy <= syEnd; sy++) {
          const dy = Math.abs(sy + 0.5 - centerY) / radiusY;
          if (dy >= 1.0) continue;
          const wy = filterType === 'quadratic' ? 1.0 - dy * dy : 1.0 - dy;
          const sRowOff = sy * sw;

          for (let sx = sxStart; sx <= sxEnd; sx++) {
            const dx = Math.abs(sx + 0.5 - centerX) / radiusX;
            if (dx >= 1.0) continue;
            const wx = filterType === 'quadratic' ? 1.0 - dx * dx : 1.0 - dx;
            const w = wx * wy;

            const sVal = sourceData[sRowOff + sx];
            if (sVal === 0) continue;

            const curW = (weights.get(sVal) || 0) + w;
            weights.set(sVal, curW);
            if (curW > maxW) {
              maxW = curW;
              bestVal = sVal;
            }
          }
        }
        val = bestVal;
      }

      // Fallback to nearest non-zero source pixel on this row if sampling hit a transparent sub-pixel
      if (val === 0) {
        const sxMid = Math.max(0, Math.min(sw - 1, Math.floor(centerX)));
        const sRowOff = syClamped * sw;
        for (let rad = 0; rad < sw; rad++) {
          if (sxMid + rad < sw && sourceData[sRowOff + sxMid + rad] !== 0) {
            val = sourceData[sRowOff + sxMid + rad];
            break;
          }
          if (sxMid - rad >= 0 && sourceData[sRowOff + sxMid - rad] !== 0) {
            val = sourceData[sRowOff + sxMid - rad];
            break;
          }
        }
      }

      targetData[rowOff + tx] = val;
    }
  }

  // 2. Guarantee 100% solid fill inside mask bounds (fill any remaining pinholes and corner holes)
  for (let pass = 0; pass < 2; pass++) {
    for (let ty = 0; ty < dh; ty++) {
      const l = mask.left[ty];
      const r = mask.right[ty];
      if (l === -1 || r < l) continue;

      const rowOff = ty * dw;
      for (let tx = l; tx <= r; tx++) {
        const idx = rowOff + tx;
        if (targetData[idx] === 0) {
          let fillVal = 0;
          // Search horizontal neighbors on row
          for (let rad = 1; rad <= Math.max(r - l, 4); rad++) {
            if (tx + rad <= r && targetData[rowOff + tx + rad] !== 0) {
              fillVal = targetData[rowOff + tx + rad];
              break;
            }
            if (tx - rad >= l && targetData[rowOff + tx - rad] !== 0) {
              fillVal = targetData[rowOff + tx - rad];
              break;
            }
          }
          // Search 8 neighbors (vertical & diagonal)
          if (fillVal === 0) {
            const neighbors = [
              ty > 0 ? targetData[(ty - 1) * dw + tx] : 0,
              ty < dh - 1 ? targetData[(ty + 1) * dw + tx] : 0,
              (ty > 0 && tx > 0) ? targetData[(ty - 1) * dw + (tx - 1)] : 0,
              (ty > 0 && tx < dw - 1) ? targetData[(ty - 1) * dw + (tx + 1)] : 0,
              (ty < dh - 1 && tx > 0) ? targetData[(ty + 1) * dw + (tx - 1)] : 0,
              (ty < dh - 1 && tx < dw - 1) ? targetData[(ty + 1) * dw + (tx + 1)] : 0,
            ];
            for (const nv of neighbors) {
              if (nv !== 0) {
                fillVal = nv;
                break;
              }
            }
          }
          // Radial fallback within tile if in an isolated corner tip
          if (fillVal === 0) {
            for (let dy = -2; dy <= 2; dy++) {
              const ny = ty + dy;
              if (ny < 0 || ny >= dh) continue;
              const nl = mask.left[ny];
              const nr = mask.right[ny];
              if (nl === -1 || nr < nl) continue;
              for (let dx = -2; dx <= 2; dx++) {
                const nx = tx + dx;
                if (nx >= nl && nx <= nr && targetData[ny * dw + nx] !== 0) {
                  fillVal = targetData[ny * dw + nx];
                  break;
                }
              }
              if (fillVal !== 0) break;
            }
          }
          targetData[idx] = fillVal;
        }
      }
    }
  }
}

/**
 * Fills Z-buffer data for tiles using the computed TileEdgeMask.
 */
export function fillTileZFromMask(
  targetZData: Uint8Array,
  sourceZData: Uint8Array,
  mask: TileEdgeMask,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  filterType: FilterType = 'linear'
): void {
  const invScaleX = sw / dw;
  const invScaleY = sh / dh;
  const zScale = dh / sh;

  for (let ty = 0; ty < dh; ty++) {
    const l = mask.left[ty];
    const r = mask.right[ty];
    const rowOff = ty * dw;

    if (l === -1 || r < l) {
      for (let tx = 0; tx < dw; tx++) targetZData[rowOff + tx] = 0;
      continue;
    }

    for (let tx = 0; tx < l; tx++) targetZData[rowOff + tx] = 0;
    for (let tx = r + 1; tx < dw; tx++) targetZData[rowOff + tx] = 0;

    const centerY = (ty + 0.5) * invScaleY;
    const syClamped = Math.max(0, Math.min(sh - 1, Math.floor(centerY)));

    for (let tx = l; tx <= r; tx++) {
      const centerX = (tx + 0.5) * invScaleX;
      const sx = Math.max(0, Math.min(sw - 1, Math.floor(centerX)));
      const rawZ = sourceZData[syClamped * sw + sx];

      if (rawZ > 0 && rawZ < 200) {
        targetZData[rowOff + tx] = Math.max(1, Math.min(dh - 1, Math.round(rawZ * zScale)));
      } else {
        targetZData[rowOff + tx] = Math.max(1, Math.min(dh - 1, dh - 1 - ty));
      }
    }
  }
}
