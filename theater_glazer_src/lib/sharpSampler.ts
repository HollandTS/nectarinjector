export type FilterType = 'quadratic' | 'linear' | 'box' | 'nearest';

/**
 * Samples a paletted rectangular image (e.g. extra image / cliff).
 * Preserves sharp edges against transparent backgrounds using modal kernel voting.
 */
export function getSharpSample(
  src: Uint8Array,
  sw: number,
  sh: number,
  tx: number,
  ty: number,
  invX: number,
  invY: number,
  srcBounds: { w: number; x: number }[],
  forceLenient: boolean = false,
  filterType: FilterType = 'quadratic'
): number {
  const centerX = (tx + 0.5) * invX;
  const centerY = (ty + 0.5) * invY;
  
  if (filterType === 'nearest') {
    const sx = Math.max(0, Math.min(sw - 1, Math.floor(centerX)));
    const sy = Math.max(0, Math.min(sh - 1, Math.floor(centerY)));
    
    const sb = srcBounds[sy];
    if (forceLenient || (sx >= sb.x && sx < sb.x + sb.w)) {
      return src[sy * sw + sx];
    }
    return 0;
  }

  const radiusX = invX <= 1.0 ? Math.max(0.55, invX * 0.85) : invX * 0.9;
  const radiusY = invY <= 1.0 ? Math.max(0.55, invY * 0.85) : invY * 0.9;
  
  const sxStart = Math.floor(centerX - radiusX);
  const sxEnd = Math.ceil(centerX + radiusX);
  const syStart = Math.floor(centerY - radiusY);
  const syEnd = Math.ceil(centerY + radiusY);

  const weights = new Map<number, number>();
  let bestVal = 0;
  let maxW = -1;
  let totalWeight = 0;
  let zeroWeight = 0;

  for (let sy = syStart; sy <= syEnd; sy++) {
    if (sy < 0 || sy >= sh) continue;
    const sb = srcBounds[sy];
    const dy = Math.abs(sy + 0.5 - centerY) / radiusY;
    if (dy >= 1.0) continue;
    
    let wy = 1.0;
    if (filterType === 'quadratic') {
      wy = 1.0 - dy * dy;
    } else if (filterType === 'linear') {
      wy = 1.0 - dy;
    } else if (filterType === 'box') {
      wy = 1.0;
    }
    const rowOff = sy * sw;
    
    for (let sx = sxStart; sx <= sxEnd; sx++) {
      if (sx < 0 || sx >= sw) continue;
      
      const dx = Math.abs(sx + 0.5 - centerX) / radiusX;
      if (dx >= 1.0) continue;
      
      let wx = 1.0;
      if (filterType === 'quadratic') {
        wx = 1.0 - dx * dx;
      } else if (filterType === 'linear') {
        wx = 1.0 - dx;
      } else if (filterType === 'box') {
        wx = 1.0;
      }

      const w = wx * wy;
      totalWeight += w;

      const isOutsideBounds = !forceLenient && (sx < sb.x || sx >= sb.x + sb.w);
      const val = isOutsideBounds ? 0 : src[rowOff + sx];

      if (val === 0) {
        zeroWeight += w;
        continue;
      }

      const currentW = (weights.get(val) || 0) + w;
      weights.set(val, currentW);
      if (currentW > maxW) {
        maxW = currentW;
        bestVal = val;
      }
    }
  }

  // Alpha thresholding: if predominantly transparent background, keep transparent
  if (totalWeight <= 0 || (zeroWeight / totalWeight) >= 0.5) {
    return 0;
  }

  if (bestVal !== 0) {
    return bestVal;
  }

  // Fallback to nearest source pixel
  const sx = Math.max(0, Math.min(sw - 1, Math.floor(centerX)));
  const sy = Math.max(0, Math.min(sh - 1, Math.floor(centerY)));
  const sb = srcBounds[sy];
  if (forceLenient || (sx >= sb.x && sx < sb.x + sb.w)) {
    return src[sy * sw + sx];
  }
  return 0;
}
