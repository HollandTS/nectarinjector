/**
 * Transparent Hole Filler
 * Multi-pass repair for isolated transparent pinholes, 2-pixel gaps, and seam lines
 * in resized image data.
 */

export function fillTransparentPinholes(
  data: Uint8Array,
  width: number,
  height: number,
  maxPasses: number = 3,
  mask?: { left: Int32Array; right: Int32Array },
  strictEnclosedOnly: boolean = false
): void {
  for (let pass = 0; pass < maxPasses; pass++) {
    let repaired = 0;

    for (let y = 0; y < height; y++) {
      if (mask) {
        const ml = mask.left[y];
        const mr = mask.right[y];
        if (ml === -1 || mr < ml) continue;
      }

      const rowOff = y * width;
      for (let x = 0; x < width; x++) {
        if (mask) {
          if (x < mask.left[y] || x > mask.right[y]) continue;
        }

        const idx = rowOff + x;
        if (data[idx] !== 0) continue;

        const up = y > 0 ? data[(y - 1) * width + x] : 0;
        const down = y < height - 1 ? data[(y + 1) * width + x] : 0;
        const left = x > 0 ? data[rowOff + x - 1] : 0;
        const right = x < width - 1 ? data[rowOff + x + 1] : 0;

        let solidOrthogonal = 0;
        if (up !== 0) solidOrthogonal++;
        if (down !== 0) solidOrthogonal++;
        if (left !== 0) solidOrthogonal++;
        if (right !== 0) solidOrthogonal++;

        // In strict mode (e.g. cliff extra data), only repair 100% enclosed interior holes (all 4 sides)
        if (strictEnclosedOnly) {
          if (solidOrthogonal === 4) {
            data[idx] = up;
            repaired++;
          }
          continue;
        }

        // 1. Enclosed pinhole (>= 3 orthogonal neighbors)
        if (solidOrthogonal >= 3) {
          data[idx] = up || down || left || right;
          repaired++;
          continue;
        }

        // 2. Opposing seam gap (left & right solid, or up & down solid)
        if ((left !== 0 && right !== 0) || (up !== 0 && down !== 0)) {
          data[idx] = left || right || up || down;
          repaired++;
          continue;
        }

        // 3. Notch hole (2 orthogonal + at least 2 diagonal neighbors)
        if (solidOrthogonal >= 2) {
          const ul = (y > 0 && x > 0) ? data[(y - 1) * width + (x - 1)] : 0;
          const ur = (y > 0 && x < width - 1) ? data[(y - 1) * width + (x + 1)] : 0;
          const dl = (y < height - 1 && x > 0) ? data[(y + 1) * width + (x - 1)] : 0;
          const dr = (y < height - 1 && x < width - 1) ? data[(y + 1) * width + (x + 1)] : 0;

          let solidDiag = 0;
          if (ul !== 0) solidDiag++;
          if (ur !== 0) solidDiag++;
          if (dl !== 0) solidDiag++;
          if (dr !== 0) solidDiag++;

          if (solidDiag >= 2) {
            data[idx] = up || down || left || right || ul || ur || dl || dr;
            repaired++;
          }
        }
      }
    }

    if (repaired === 0) break;
  }
}
