/**
 * Extra Z Interpolator
 * Performs continuous, smooth 2D depth interpolation for Extra Images (cliffs, slopes).
 * Eliminates 3-4px flat bands by using sub-pixel continuous floating-point depth
 * interpolation rather than nearest-neighbor column grouping.
 */

export function interpolateExtraZData(
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
  if (targetCxExtra <= 0 || targetCyExtra <= 0 || !targetExtraImageData) {
    return null;
  }

  const newExtraZ = new Uint8Array(targetCxExtra * targetCyExtra);
  const scaleZ = sourceCy > 0 ? targetCy / sourceCy : targetCy / 24;
  const maxAllowedZ = targetCy - 1;

  const hasSourceZ = Boolean(
    sourceExtraZData &&
    sourceCxExtra > 0 &&
    sourceCyExtra > 0 &&
    sourceExtraZData.some((v) => v > 0 && v < 200)
  );

  const scaleX = sourceCxExtra / targetCxExtra;
  const scaleY = sourceCyExtra / targetCyExtra;

  for (let dey = 0; dey < targetCyExtra; dey++) {
    const rowOffset = dey * targetCxExtra;

    for (let dex = 0; dex < targetCxExtra; dex++) {
      const idx = rowOffset + dex;

      if (hasSourceZ && sourceExtraZData) {
        // Continuous sub-pixel mapping
        const fx = (dex + 0.5) * scaleX - 0.5;
        const fy = (dey + 0.5) * scaleY - 0.5;

        const x0 = Math.max(0, Math.min(sourceCxExtra - 1, Math.floor(fx)));
        const x1 = Math.max(0, Math.min(sourceCxExtra - 1, Math.ceil(fx)));
        const y0 = Math.max(0, Math.min(sourceCyExtra - 1, Math.floor(fy)));
        const y1 = Math.max(0, Math.min(sourceCyExtra - 1, Math.ceil(fy)));

        const wx = Math.max(0, Math.min(1, fx - x0));
        const wy = Math.max(0, Math.min(1, fy - y0));

        let sumZ = 0;
        let sumW = 0;

        const p00 = sourceExtraZData[y0 * sourceCxExtra + x0];
        const p10 = sourceExtraZData[y0 * sourceCxExtra + x1];
        const p01 = sourceExtraZData[y1 * sourceCxExtra + x0];
        const p11 = sourceExtraZData[y1 * sourceCxExtra + x1];

        if (p00 > 0 && p00 < 200) {
          const w = (1 - wx) * (1 - wy);
          sumZ += p00 * w;
          sumW += w;
        }
        if (p10 > 0 && p10 < 200) {
          const w = wx * (1 - wy);
          sumZ += p10 * w;
          sumW += w;
        }
        if (p01 > 0 && p01 < 200) {
          const w = (1 - wx) * wy;
          sumZ += p01 * w;
          sumW += w;
        }
        if (p11 > 0 && p11 < 200) {
          const w = wx * wy;
          sumZ += p11 * w;
          sumW += w;
        }

        if (sumW > 0.001) {
          const interpolated = (sumZ / sumW) * scaleZ;
          newExtraZ[idx] = Math.max(1, Math.min(maxAllowedZ, Math.round(interpolated)));
          continue;
        }

        // Search nearest valid depth in source window
        let bestVal = 0;
        let bestDist = Infinity;
        const searchR = Math.max(2, Math.ceil(Math.max(scaleX, scaleY) * 2));
        const cx = Math.round(fx);
        const cy = Math.round(fy);

        for (let dy = -searchR; dy <= searchR; dy++) {
          const sy = cy + dy;
          if (sy < 0 || sy >= sourceCyExtra) continue;
          const sRow = sy * sourceCxExtra;
          for (let dx = -searchR; dx <= searchR; dx++) {
            const sx = cx + dx;
            if (sx < 0 || sx >= sourceCxExtra) continue;
            const val = sourceExtraZData[sRow + sx];
            if (val > 0 && val < 200) {
              const dist = dx * dx + dy * dy;
              if (dist < bestDist) {
                bestDist = dist;
                bestVal = val;
              }
            }
          }
        }

        if (bestVal > 0) {
          newExtraZ[idx] = Math.max(1, Math.min(maxAllowedZ, Math.round(bestVal * scaleZ)));
          continue;
        }
      }

      // Continuous isometric procedural depth fallback
      const tileX = tileXExtra + dex;
      const halfW = targetCx / 2;
      let floatZ: number;
      if (tileX <= halfW) {
        floatZ = (targetCy / 2) + (tileX * (targetCy / targetCx));
      } else {
        floatZ = (targetCy - 1) - ((tileX - halfW) * (targetCy / targetCx));
      }
      newExtraZ[idx] = Math.max(1, Math.min(maxAllowedZ, Math.round(floatZ)));
    }
  }

  // Smooth vertical column consistency pass for cliff walls
  // If a column is a vertical cliff face, ensure the gradient across columns (X)
  // is continuous without abrupt jumps or jagged steps.
  smoothCliffGradients(newExtraZ, targetCxExtra, targetCyExtra, maxAllowedZ);

  return newExtraZ;
}

/**
 * Ensures smooth horizontal gradient transitions across cliff columns,
 * eliminating any remaining 3-4px flat steps.
 */
function smoothCliffGradients(
  zData: Uint8Array,
  width: number,
  height: number,
  maxZ: number
) {
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      const cur = zData[idx];
      if (cur === 0) continue;

      const prev = zData[idx - 1];
      const next = zData[idx + 1];

      // If sandwiched between two valid depths with a smooth slope, interpolate
      if (prev > 0 && next > 0) {
        if (Math.abs(prev - next) === 2 && cur !== Math.round((prev + next) / 2)) {
          zData[idx] = Math.max(1, Math.min(maxZ, Math.round((prev + next) / 2)));
        }
      }
    }
  }
}
