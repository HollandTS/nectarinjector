/**
 * Hole Repair Utility
 * Fills pinholes in resized image data and repairs dark zero-depth holes in Z-buffers.
 */

import { fillTransparentPinholes } from './transparentHoleFiller';

export { fillTransparentPinholes } from './transparentHoleFiller';

/**
 * Repairs isolated dark holes in base/ramp tile Z-data and fills transparent pinholes.
 */
export function repairTileHoles(
  data: Uint8Array,
  zData: Uint8Array | null,
  width: number,
  height: number,
  mask?: { left: Int32Array; right: Int32Array }
): void {
  // Pass 1: Multi-pass fill for transparent pinholes, 2px gaps, and seams strictly within mask
  fillTransparentPinholes(data, width, height, 3, mask);

  // Pass 2: Repair dark Z-depth holes on valid visible pixels
  if (zData) {
    for (let pass = 0; pass < 3; pass++) {
      let repairedCount = 0;
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
          const idx = rowOffset + x;
          // Pixel is visible terrain, but has zero or invalid depth
          if (data[idx] !== 0 && (zData[idx] === 0 || zData[idx] >= 200)) {
            // Sample valid neighbor depths
            let sumZ = 0;
            let countZ = 0;

            const neighbors = [
              y > 0 ? zData[(y - 1) * width + x] : 0,
              y < height - 1 ? zData[(y + 1) * width + x] : 0,
              x > 0 ? zData[rowOffset + x - 1] : 0,
              x < width - 1 ? zData[rowOffset + x + 1] : 0,
              (y > 0 && x > 0) ? zData[(y - 1) * width + (x - 1)] : 0,
              (y > 0 && x < width - 1) ? zData[(y - 1) * width + (x + 1)] : 0,
              (y < height - 1 && x > 0) ? zData[(y + 1) * width + (x - 1)] : 0,
              (y < height - 1 && x < width - 1) ? zData[(y + 1) * width + (x + 1)] : 0,
            ];

            for (const nz of neighbors) {
              if (nz > 0 && nz < 200) {
                sumZ += nz;
                countZ++;
              }
            }

            if (countZ > 0) {
              zData[idx] = Math.max(1, Math.min(height - 1, Math.round(sumZ / countZ)));
              repairedCount++;
            } else if (pass === 2) {
              // Final fallback: default diamond depth
              zData[idx] = Math.max(1, Math.min(height - 1, height - 1 - y));
              repairedCount++;
            }
          }
        }
      }
      if (repairedCount === 0) break;
    }
  }
}

/**
 * Repairs dark holes in extra cliff image data and extra Z-data.
 * For extra cliffs, depths are aligned by vertical column.
 */
export function repairExtraHoles(
  extraData: Uint8Array,
  extraZData: Uint8Array | null,
  width: number,
  height: number,
  maxEngineZ: number
): void {
  // Pass 1: Strict enclosed fill for true transparent pinholes only (no edge creeping)
  fillTransparentPinholes(extraData, width, height, 1, undefined, true);

  // Pass 2: Repair dark Z-depth holes in extra Z-buffer
  if (extraZData) {
    // 1. Build column depth dictionary from valid pixels
    const colDepth = new Int32Array(width).fill(-1);
    for (let x = 0; x < width; x++) {
      const freq = new Map<number, number>();
      let bestZ = -1;
      let maxCount = 0;

      for (let y = 0; y < height; y++) {
        const idx = y * width + x;
        if (extraData[idx] !== 0) {
          const z = extraZData[idx];
          if (z > 0 && z < 200) {
            const count = (freq.get(z) || 0) + 1;
            freq.set(z, count);
            if (count > maxCount) {
              maxCount = count;
              bestZ = z;
            }
          }
        }
      }
      if (bestZ > 0) {
        colDepth[x] = Math.min(maxEngineZ, bestZ);
      }
    }

    // 2. Interpolate empty columns
    for (let x = 0; x < width; x++) {
      if (colDepth[x] === -1) {
        for (let r = 1; r < width; r++) {
          if (x - r >= 0 && colDepth[x - r] !== -1) {
            colDepth[x] = colDepth[x - r];
            break;
          }
          if (x + r < width && colDepth[x + r] !== -1) {
            colDepth[x] = colDepth[x + r];
            break;
          }
        }
      }
    }

    // 3. Fill any visible pixel having Z=0 with column depth
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        if (extraData[idx] !== 0 && (extraZData[idx] === 0 || extraZData[idx] >= 200)) {
          const depth = colDepth[x];
          extraZData[idx] = depth > 0 ? depth : Math.max(1, Math.min(maxEngineZ, Math.round(maxEngineZ / 2)));
        }
      }
    }
  }
}
