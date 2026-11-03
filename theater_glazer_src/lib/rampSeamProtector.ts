import type { TileEdgeMask } from './tileEdgeMask';

/**
 * Ensures seamless, slit-free pixel connection between Base Diamond and Extra Data.
 * Prevents 1-pixel sampling gaps, subpixel seam slits, and clipping at the intersection.
 */
export function protectRampSeams(
  baseData: Uint8Array,
  extraData: Uint8Array,
  dw: number,
  dh: number,
  cxExtra: number,
  cyExtra: number,
  xExtra: number,
  yExtra: number,
  rampType: number,
  tileMask: TileEdgeMask
): void {
  const rampWidth = Math.floor(dw / 2);

  for (let ey = 0; ey < cyExtra; ey++) {
    const gy = ey + yExtra;
    const eRowOff = ey * cxExtra;

    if (gy < 0) {
      // Top extra rows above diamond (gy = -2, -1): ensure full solid coverage
      if (rampType === 1) {
        const globalL = (dw / 2 - 2) - 2 * gy;
        const globalR = Math.min(xExtra + cxExtra - 1, globalL + rampWidth - 1);
        const exStart = Math.max(0, globalL - xExtra);
        const exEnd = Math.min(cxExtra - 1, globalR - xExtra);

        fillExtraRowSpan(extraData, eRowOff, exStart, exEnd, cxExtra);
      } else if (rampType === 2) {
        const globalR = (dw / 2 + 1) + 2 * gy;
        const globalL = Math.max(xExtra, globalR - rampWidth + 1);
        const exStart = Math.max(0, globalL - xExtra);
        const exEnd = Math.min(cxExtra - 1, globalR - xExtra);

        fillExtraRowSpan(extraData, eRowOff, exStart, exEnd, cxExtra);
      }
      continue;
    }

    if (gy >= dh) continue;

    const baseL = tileMask.left[gy];
    const baseR = tileMask.right[gy];
    const bRowOff = gy * dw;

    const extraMinX = findRowMin(extraData, eRowOff, cxExtra);
    const extraMaxX = findRowMax(extraData, eRowOff, cxExtra);

    if (rampType === 1) {
      // Extra data is on the right side (e.g. slope01)
      if (baseR !== -1 && extraMinX !== -1) {
        const extraGlobalMinX = xExtra + extraMinX;

        if (extraGlobalMinX > baseR + 1 && extraGlobalMinX - baseR <= 4) {
          // Fill bridge in extra data or base data
          const fillVal = extraData[eRowOff + extraMinX] || baseData[bRowOff + baseR];
          for (let gx = baseR + 1; gx < extraGlobalMinX; gx++) {
            const ex = gx - xExtra;
            if (ex >= 0 && ex < cxExtra) {
              extraData[eRowOff + ex] = fillVal;
            } else if (gx >= 0 && gx < dw) {
              baseData[bRowOff + gx] = fillVal;
            }
          }
        }
      }
    } else if (rampType === 2) {
      // Extra data is on the left side (e.g. slope02)
      if (baseL !== -1 && extraMaxX !== -1) {
        const extraGlobalMaxX = xExtra + extraMaxX;

        if (extraGlobalMaxX < baseL - 1 && baseL - extraGlobalMaxX <= 4) {
          // Fill bridge
          const fillVal = extraData[eRowOff + extraMaxX] || baseData[bRowOff + baseL];
          for (let gx = extraGlobalMaxX + 1; gx < baseL; gx++) {
            const ex = gx - xExtra;
            if (ex >= 0 && ex < cxExtra) {
              extraData[eRowOff + ex] = fillVal;
            } else if (gx >= 0 && gx < dw) {
              baseData[bRowOff + gx] = fillVal;
            }
          }
        }
      }
    }
  }
}

function findRowMin(data: Uint8Array, offset: number, width: number): number {
  for (let x = 0; x < width; x++) {
    if (data[offset + x] !== 0) return x;
  }
  return -1;
}

function findRowMax(data: Uint8Array, offset: number, width: number): number {
  for (let x = width - 1; x >= 0; x--) {
    if (data[offset + x] !== 0) return x;
  }
  return -1;
}

function fillExtraRowSpan(data: Uint8Array, offset: number, start: number, end: number, width: number): void {
  let donor = 0;
  for (let x = 0; x < width; x++) {
    if (data[offset + x] !== 0) {
      donor = data[offset + x];
      break;
    }
  }
  if (donor === 0) return;

  for (let x = start; x <= end; x++) {
    if (data[offset + x] === 0) {
      data[offset + x] = donor;
    }
  }
}
