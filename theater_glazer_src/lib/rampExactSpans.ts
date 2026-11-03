export interface ExactRampSpec {
  minY: number;
  maxY: number;
  xExtra: number;
  yExtra: number;
  cxExtra: number;
  cyExtra: number;
  hasExtra: boolean;
  getSpan: (gy: number) => { left: number; right: number } | null;
}

/**
 * Returns the exact isometric 2:1 combined (Base + Extra) pixel spans and Extra Header box
 * for canonical single-tile slopes (ramp_type 1..20) at any resolution (48x24, 60x30, 96x48, 120x60).
 */
export function getExactRampSpans(rampType: number, dw: number, dh: number): ExactRampSpec | null {
  const H = dh / 2;
  const W = dw;
  const halfW = dw / 2;
  const hHalfCeil = Math.ceil(H / 2);
  const hTwoThirdsCeil = Math.ceil((2 * H) / 3);

  switch (rampType) {
    case 1:
      return {
        minY: -1, maxY: H - 2,
        xExtra: halfW, yExtra: -1, cxExtra: halfW, cyExtra: hHalfCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > H - 2) ? null : { left: halfW - 2 - 2 * gy, right: W - 3 - 2 * gy }
      };
    case 2:
      return {
        minY: -1, maxY: H - 2,
        xExtra: 0, yExtra: -1, cxExtra: halfW, cyExtra: hHalfCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > H - 2) ? null : { left: 2 * gy + 2, right: halfW + 1 + 2 * gy }
      };
    case 3:
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 0, yExtra: -H, cxExtra: W - 1, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= -1 ? -2 - 2 * gy : gy + 1,
          right: gy <= H - 1 ? halfW + H + gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    case 4:
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 1, yExtra: -H, cxExtra: W - 1, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= H - 1 ? H - 1 - gy : 2 * (gy - (H - 1)),
          right: gy <= -1 ? W + 1 + 2 * gy : W - 2 - gy
        }
      };
    case 5:
      return {
        minY: 0, maxY: H - 2,
        xExtra: 0, yExtra: 0, cxExtra: 0, cyExtra: 0, hasExtra: false,
        getSpan: (gy) => (gy < 0 || gy > H - 2) ? null : { left: halfW - 2 - 2 * gy, right: halfW + 1 + 2 * gy }
      };
    case 6:
      return {
        minY: -1, maxY: dh - 2,
        xExtra: 0, yExtra: -1, cxExtra: halfW, cyExtra: hTwoThirdsCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > dh - 2) ? null : {
          left: gy + 1,
          right: gy <= H - 1 ? halfW + 1 + 2 * gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    case 7:
    case 20:
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 1, yExtra: -H, cxExtra: W - 2, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= H - 1 ? H - 1 - gy : 2 * (gy - (H - 1)),
          right: gy <= H - 1 ? halfW + H + gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    case 8:
      return {
        minY: -1, maxY: dh - 2,
        xExtra: halfW, yExtra: -1, cxExtra: halfW, cyExtra: hTwoThirdsCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > dh - 2) ? null : {
          left: gy <= H - 1 ? halfW - 2 - 2 * gy : 2 * (gy - (H - 1)),
          right: W - 2 - gy
        }
      };
    case 9:
      return {
        minY: -2, maxY: H - 2,
        xExtra: 0, yExtra: -2, cxExtra: W, cyExtra: hHalfCeil + 1, hasExtra: true,
        getSpan: (gy) => (gy < -2 || gy > H - 2) ? null : gy === -2
          ? { left: halfW - 2, right: halfW + 1 }
          : { left: 2 * (gy + 1), right: W - 1 - 2 * (gy + 1) }
      };
    case 10:
      return {
        minY: -H, maxY: H - 2,
        xExtra: 0, yExtra: -H, cxExtra: W - 1, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > H - 2) ? null : {
          left: gy <= -1 ? -2 - 2 * gy : 2 * (gy + 1),
          right: halfW + H + gy
        }
      };
    case 11:
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 0, yExtra: -H, cxExtra: W, cyExtra: H + hTwoThirdsCeil - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= -1 ? -2 - 2 * gy : gy + 1,
          right: gy <= -1 ? W + 1 + 2 * gy : W - 2 - gy
        }
      };
    case 12:
      return {
        minY: -H, maxY: H - 2,
        xExtra: 1, yExtra: -H, cxExtra: W - 1, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > H - 2) ? null : {
          left: H - 1 - gy,
          right: gy <= -1 ? W + 1 + 2 * gy : W - 1 - 2 * (gy + 1)
        }
      };
    case 13:
      return {
        minY: -2, maxY: -2,
        xExtra: halfW - 2, yExtra: -2, cxExtra: 4, cyExtra: 2, hasExtra: true,
        getSpan: (gy) => gy === -2 ? { left: halfW - 2, right: halfW + 1 } : null
      };
    case 14:
      return {
        minY: -H - 1, maxY: H - 2,
        xExtra: 0, yExtra: -H - 1, cxExtra: W - 1, cyExtra: dh, hasExtra: true,
        getSpan: (gy) => (gy < -H - 1 || gy > H - 2) ? null : { left: gy + H + 1, right: gy + H + halfW }
      };
    case 15:
      return {
        minY: -dh, maxY: dh - 2,
        xExtra: 0, yExtra: -dh, cxExtra: W, cyExtra: dh + hTwoThirdsCeil - 1, hasExtra: true,
        getSpan: (gy) => (gy < -dh || gy > dh - 2) ? null : {
          left: gy <= -1 ? -1 - gy : gy + 1,
          right: gy <= -1 ? W + gy : W - 2 - gy
        }
      };
    case 16:
      return {
        minY: -H - 1, maxY: H - 2,
        xExtra: 1, yExtra: -H - 1, cxExtra: W - 1, cyExtra: dh, hasExtra: true,
        getSpan: (gy) => (gy < -H - 1 || gy > H - 2) ? null : { left: H - 1 - gy, right: W - H - 2 - gy }
      };
    case 17:
      return {
        minY: -1, maxY: dh - 2,
        xExtra: 0, yExtra: -1, cxExtra: W, cyExtra: hTwoThirdsCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > dh - 2) ? null : { left: gy + 1, right: W - 2 - gy }
      };
    case 18:
      return {
        minY: -H, maxY: H - 2,
        xExtra: 1, yExtra: -H, cxExtra: W - 2, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > H - 2) ? null : { left: H - 1 - gy, right: halfW + H + gy }
      };
    case 19:
      return {
        minY: -2, maxY: dh - 2,
        xExtra: 0, yExtra: -2, cxExtra: W, cyExtra: H + 1, hasExtra: true,
        getSpan: (gy) => (gy < -2 || gy > dh - 2) ? null : gy === -2
          ? { left: halfW - 2, right: halfW + 1 }
          : gy <= H - 1
            ? { left: 0, right: W - 1 }
            : { left: 2 * (gy - (H - 1)), right: W - 1 - 2 * (gy - (H - 1)) }
      };
    default:
      return null;
  }
}
