import { getDiamondBounds } from '../../lib/tileResizer';
import { ZValidationReport, ZValidationIssue } from './types';

/**
 * Fills base diamond tile with standard Westwood depth formula: cy - 1 - y
 */
export function fillStandardBaseZ(
  cx: number,
  cy: number,
  pixelData: Uint8Array,
  clampMax?: number
): Uint8Array {
  const result = new Uint8Array(cx * cy);
  const maxZ = clampMax !== undefined ? clampMax : cy - 1;

  for (let y = 0; y < cy; y++) {
    const tb = getDiamondBounds(y, cx, cy, 0);
    const baseZ = Math.max(1, cy - 1 - y);
    const zVal = Math.min(maxZ, baseZ);
    const rowOffset = y * cx;

    for (let x = 0; x < cx; x++) {
      if (x >= tb.x && x < tb.x + tb.w && pixelData[rowOffset + x] !== 0) {
        result[rowOffset + x] = zVal;
      } else {
        result[rowOffset + x] = 0;
      }
    }
  }

  return result;
}

/**
 * Applies a uniform Z-depth across an entire vertical column of an extra image (cliff).
 */
export function applyColumnZ(
  currentZ: Uint8Array,
  cxExtra: number,
  cyExtra: number,
  extraImageData: Uint8Array,
  colX: number,
  zVal: number
): Uint8Array {
  const result = new Uint8Array(currentZ);
  if (colX < 0 || colX >= cxExtra) return result;

  for (let y = 0; y < cyExtra; y++) {
    const idx = y * cxExtra + colX;
    if (extraImageData[idx] !== 0) {
      result[idx] = Math.max(0, Math.min(255, zVal));
    }
  }

  return result;
}

/**
 * Clamps all non-zero Z-values to a maximum threshold (plateau effect).
 */
export function clampZBuffer(
  currentZ: Uint8Array,
  maxZ: number
): Uint8Array {
  const result = new Uint8Array(currentZ.length);
  for (let i = 0; i < currentZ.length; i++) {
    const v = currentZ[i];
    if (v > 0) {
      result[i] = Math.min(maxZ, v);
    }
  }
  return result;
}

/**
 * Stamps a Z integer value at (x, y) with a given brush size.
 */
export function stampZValue(
  currentZ: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  zVal: number,
  brushSize: number,
  pixelData?: Uint8Array
): Uint8Array {
  const result = new Uint8Array(currentZ);
  const half = Math.floor(brushSize / 2);

  for (let dy = -half; dy <= half; dy++) {
    const py = y + dy;
    if (py < 0 || py >= height) continue;

    for (let dx = -half; dx <= half; dx++) {
      const px = x + dx;
      if (px < 0 || px >= width) continue;

      const idx = py * width + px;
      if (pixelData && pixelData[idx] === 0) {
        continue;
      }
      result[idx] = Math.max(0, Math.min(255, zVal));
    }
  }

  return result;
}

/**
 * Validates a Z-buffer against Westwood C&C engine specifications.
 */
export function validateZData(
  zData: Uint8Array | null,
  width: number,
  height: number,
  isExtra: boolean,
  cy: number,
  pixelData: Uint8Array | null
): ZValidationReport {
  const expectedMaxZ = cy - 1;
  const issues: ZValidationIssue[] = [];

  if (!zData || zData.length === 0) {
    return {
      minZ: 0,
      maxZ: 0,
      expectedMaxZ,
      totalPixels: 0,
      transparentPixelsWithZ: 0,
      discontinuousColumns: 0,
      issues: [{ type: 'info', message: 'No Z-data present on this layer.' }]
    };
  }

  let minZ = 255;
  let maxZ = 0;
  let totalNonZero = 0;
  let transparentWithZ = 0;

  for (let i = 0; i < zData.length; i++) {
    const v = zData[i];
    if (v > 0) {
      totalNonZero++;
      if (v < minZ) minZ = v;
      if (v > maxZ) maxZ = v;

      if (pixelData && pixelData[i] === 0) {
        transparentWithZ++;
      }
    }
  }

  if (minZ === 255) minZ = 0;

  // Check 1: Max depth overflow
  if (maxZ > expectedMaxZ) {
    issues.push({
      type: 'warning',
      message: `Max Z (${maxZ}) exceeds engine ceiling (${expectedMaxZ}). Units may clip through terrain.`,
    });
  }

  // Check 2: Transparent pixels having non-zero Z
  if (transparentWithZ > 0) {
    issues.push({
      type: 'warning',
      message: `${transparentWithZ} transparent pixels have non-zero Z values.`,
      count: transparentWithZ
    });
  }

  // Check 3: Cliff column continuity
  let discontinuousColumns = 0;
  if (isExtra && pixelData) {
    for (let x = 0; x < width; x++) {
      let firstZ: number | null = null;
      let hasVariance = false;

      for (let y = 0; y < height; y++) {
        const idx = y * width + x;
        if (pixelData[idx] !== 0) {
          const z = zData[idx];
          if (firstZ === null) {
            firstZ = z;
          } else if (firstZ !== z) {
            hasVariance = true;
            break;
          }
        }
      }

      if (hasVariance) {
        discontinuousColumns++;
      }
    }

    if (discontinuousColumns > 0) {
      issues.push({
        type: 'error',
        message: `${discontinuousColumns} cliff columns have varying Z values. Westwood engine requires uniform column depth.`,
        count: discontinuousColumns
      });
    }
  }

  if (issues.length === 0) {
    issues.push({ type: 'info', message: 'All depth values conform to engine rules.' });
  }

  return {
    minZ,
    maxZ,
    expectedMaxZ,
    totalPixels: totalNonZero,
    transparentPixelsWithZ: transparentWithZ,
    discontinuousColumns,
    issues
  };
}

/**
 * Automatically repairs common Z issues (zeros transparent pixels, unifies cliff columns).
 */
export function autoFixZData(
  zData: Uint8Array,
  width: number,
  height: number,
  isExtra: boolean,
  cy: number,
  pixelData: Uint8Array | null
): Uint8Array {
  const result = new Uint8Array(zData);
  const expectedMaxZ = cy - 1;

  // 1. Clamp to expected max, clear sentinel bytes, and clear transparent
  for (let i = 0; i < result.length; i++) {
    if (pixelData && pixelData[i] === 0) {
      result[i] = 0;
    } else if (result[i] >= 200) {
      // 205 (0xCD) and 255 are Westwood uninitialized / sentinel bytes
      result[i] = 0;
    } else if (result[i] > expectedMaxZ) {
      result[i] = expectedMaxZ;
    }
  }

  // 2. Unify cliff columns
  if (isExtra && pixelData) {
    for (let x = 0; x < width; x++) {
      // Find mode Z value for this column
      const freq = new Map<number, number>();
      let bestZ = 0;
      let maxCount = 0;

      for (let y = 0; y < height; y++) {
        const idx = y * width + x;
        if (pixelData[idx] !== 0) {
          const z = result[idx];
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
        for (let y = 0; y < height; y++) {
          const idx = y * width + x;
          if (pixelData[idx] !== 0) {
            result[idx] = bestZ;
          }
        }
      }
    }
  }

  return result;
}
