/**
 * Edge Step Optimizer
 * Regularizes pixel steps along custom edges (ramps, cliffs, non-diamond bounds)
 * to ensure uniform isometric staircase steps (e.g. clean 2:1 steps) without
 * jagged triangular bumps or overflowing pixels.
 */

/**
 * Regularizes an edge array (left or right bounds of each row)
 * to eliminate sampling phase jitter like alternating [3, 1] or [1, 3] steps.
 */
export function regularizeEdgeSteps(
  edge: Int32Array,
  height: number,
  isRightEdge: boolean
): { original: Int32Array; adjusted: Int32Array } {
  const adjusted = new Int32Array(edge);

  // Analyze consecutive rows with valid edge coordinates
  let startY = -1;

  for (let y = 0; y <= height; y++) {
    const hasPoint = y < height && edge[y] !== -1;

    if (hasPoint) {
      if (startY === -1) startY = y;
    } else {
      if (startY !== -1) {
        const endY = y - 1;
        const segmentLen = endY - startY + 1;

        if (segmentLen >= 3) {
          // Iterate passes to smooth jitter
          for (let pass = 0; pass < 2; pass++) {
            for (let cy = startY + 1; cy < endY; cy++) {
              const prev = adjusted[cy - 1];
              const curr = adjusted[cy];
              const next = adjusted[cy + 1];

              const s1 = curr - prev;
              const s2 = next - curr;

              // 1. Isometric +2 slope jitter: steps [3, 1] -> [2, 2]
              if (s1 === 3 && s2 === 1) {
                adjusted[cy] = curr - 1;
              } else if (s1 === 1 && s2 === 3) {
                adjusted[cy] = curr + 1;
              }
              // 2. Isometric -2 slope jitter: steps [-3, -1] -> [-2, -2]
              else if (s1 === -3 && s2 === -1) {
                adjusted[cy] = curr + 1;
              } else if (s1 === -1 && s2 === -3) {
                adjusted[cy] = curr - 1;
              }
              // 3. Vertical cliff jitter: steps [1, -1] -> [0, 0] or [-1, 1] -> [0, 0]
              else if (s1 === 1 && s2 === -1) {
                adjusted[cy] = curr - 1;
              } else if (s1 === -1 && s2 === 1) {
                adjusted[cy] = curr + 1;
              }
              // 4. Diagonal 1:1 slope jitter: steps [2, 0] -> [1, 1] or [-2, 0] -> [-1, -1]
              else if (s1 === 2 && s2 === 0) {
                adjusted[cy] = curr - 1;
              } else if (s1 === 0 && s2 === 2) {
                adjusted[cy] = curr + 1;
              } else if (s1 === -2 && s2 === 0) {
                adjusted[cy] = curr + 1;
              } else if (s1 === 0 && s2 === -2) {
                adjusted[cy] = curr - 1;
              }
            }
          }
        }
        startY = -1;
      }
    }
  }

  return { original: edge, adjusted };
}

/**
 * Optimizes custom edges of a tile or extra image to maintain regular pixel steps.
 */
export function optimizeCustomEdges(
  data: Uint8Array,
  zData: Uint8Array | null,
  width: number,
  height: number
): void {
  const leftEdge = new Int32Array(height).fill(-1);
  const rightEdge = new Int32Array(height).fill(-1);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let minX = -1;
    let maxX = -1;

    for (let x = 0; x < width; x++) {
      if (data[rowOffset + x] !== 0) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }

    leftEdge[y] = minX;
    rightEdge[y] = maxX;
  }

  // Regularize right and left boundaries
  const regRight = regularizeEdgeSteps(rightEdge, height, true);
  const regLeft = regularizeEdgeSteps(leftEdge, height, false);

  // Apply right edge adjustments
  for (let y = 0; y < height; y++) {
    const origR = regRight.original[y];
    const adjR = regRight.adjusted[y];
    if (origR === -1 || adjR === -1) continue;

    const rowOffset = y * width;
    if (adjR < origR) {
      // Trim overflowing pixels
      for (let x = adjR + 1; x <= origR; x++) {
        data[rowOffset + x] = 0;
        if (zData) zData[rowOffset + x] = 0;
      }
    } else if (adjR > origR && adjR < width) {
      // Fill notched pixels with edge value
      const fillVal = data[rowOffset + origR];
      const fillZ = zData ? zData[rowOffset + origR] : 0;
      for (let x = origR + 1; x <= adjR; x++) {
        data[rowOffset + x] = fillVal;
        if (zData) zData[rowOffset + x] = fillZ;
      }
    }
  }

  // Apply left edge adjustments
  for (let y = 0; y < height; y++) {
    const origL = regLeft.original[y];
    const adjL = regLeft.adjusted[y];
    if (origL === -1 || adjL === -1) continue;

    const rowOffset = y * width;
    if (adjL > origL) {
      // Trim overflowing pixels on left
      for (let x = origL; x < adjL; x++) {
        data[rowOffset + x] = 0;
        if (zData) zData[rowOffset + x] = 0;
      }
    } else if (adjL < origL && adjL >= 0) {
      // Fill notched pixels on left
      const fillVal = data[rowOffset + origL];
      const fillZ = zData ? zData[rowOffset + origL] : 0;
      for (let x = adjL; x < origL; x++) {
        data[rowOffset + x] = fillVal;
        if (zData) zData[rowOffset + x] = fillZ;
      }
    }
  }
}
