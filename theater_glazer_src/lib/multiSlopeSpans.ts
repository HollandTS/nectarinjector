import type { ExactRampSpec } from './rampExactSpans';

export type MultiSlopeRole = 'first' | 'middle' | 'last';

/**
 * Returns the exact isometric 2:1 combined (Base + Extra) pixel spans and local Extra Header box
 * for multi-tile slope sets (wslope01..04, drslpe01..08, prslpe01..04) where all tiles share ramp_type 1..4.
 */
export function getMultiSlopeSpans(
  rampType: number,
  role: MultiSlopeRole,
  dw: number,
  dh: number
): ExactRampSpec | null {
  const H = dh / 2;
  const W = dw;
  const halfW = dw / 2;
  const hHalf = Math.floor(H / 2);
  const hHalfCeil = Math.ceil(H / 2);
  const maxYLower = H + hHalf - 2;

  if (rampType === 1) {
    if (role === 'first') {
      return {
        minY: -1, maxY: maxYLower,
        xExtra: halfW, yExtra: -1, cxExtra: halfW, cyExtra: hHalfCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > maxYLower) ? null : {
          left: gy <= H - 1 ? halfW - 2 - 2 * gy : 2 * (gy - (H - 1)),
          right: W - 3 - 2 * gy
        }
      };
    }
    if (role === 'middle') {
      return {
        minY: 0, maxY: maxYLower,
        xExtra: 0, yExtra: 0, cxExtra: 0, cyExtra: 0, hasExtra: false,
        getSpan: (gy) => (gy < 0 || gy > maxYLower) ? null : {
          left: gy <= H - 1 ? halfW - 2 - 2 * gy : 2 * (gy - (H - 1)),
          right: gy <= hHalf - 1 ? halfW + 1 + 2 * gy : halfW + 1 + 2 * (hHalf - 1) - 2 * (gy - (hHalf - 1))
        }
      };
    }
    return {
      minY: 0, maxY: H - 2,
      xExtra: 0, yExtra: 0, cxExtra: 0, cyExtra: 0, hasExtra: false,
      getSpan: (gy) => (gy < 0 || gy > H - 2) ? null : {
        left: halfW - 2 - 2 * gy,
        right: gy <= hHalf - 1 ? halfW + 1 + 2 * gy : halfW + 1 + 2 * (hHalf - 1) - 2 * (gy - (hHalf - 1))
      }
    };
  }

  if (rampType === 2) {
    if (role === 'first') {
      return {
        minY: -1, maxY: maxYLower,
        xExtra: 0, yExtra: -1, cxExtra: halfW, cyExtra: hHalfCeil, hasExtra: true,
        getSpan: (gy) => (gy < -1 || gy > maxYLower) ? null : {
          left: 2 * gy + 2,
          right: gy <= H - 1 ? halfW + 1 + 2 * gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    }
    if (role === 'middle') {
      return {
        minY: 0, maxY: maxYLower,
        xExtra: 0, yExtra: 0, cxExtra: 0, cyExtra: 0, hasExtra: false,
        getSpan: (gy) => (gy < 0 || gy > maxYLower) ? null : {
          left: gy <= hHalf - 1 ? halfW - 2 - 2 * gy : halfW - 2 - 2 * (hHalf - 1) + 2 * (gy - (hHalf - 1)),
          right: gy <= H - 1 ? halfW + 1 + 2 * gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    }
    return {
      minY: 0, maxY: H - 2,
      xExtra: 0, yExtra: 0, cxExtra: 0, cyExtra: 0, hasExtra: false,
      getSpan: (gy) => (gy < 0 || gy > H - 2) ? null : {
        left: gy <= hHalf - 1 ? halfW - 2 - 2 * gy : halfW - 2 - 2 * (hHalf - 1) + 2 * (gy - (hHalf - 1)),
        right: halfW + 1 + 2 * gy
      }
    };
  }

  if (rampType === 3) {
    if (role === 'first') {
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 0, yExtra: -H, cxExtra: W - 1, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= -1 ? -2 - 2 * gy : gy <= H - 1 ? 0 : 2 * (gy - (H - 1)),
          right: gy <= H - 1 ? halfW + H + gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    }
    if (role === 'middle') {
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 0, yExtra: -H, cxExtra: halfW, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= -1 ? -2 - 2 * gy : gy <= H - 1 ? 0 : 2 * (gy - (H - 1)),
          right: gy <= -1 ? halfW - 1 : gy <= H - 1 ? halfW + 1 + 2 * gy : W - 1 - 2 * (gy - (H - 1))
        }
      };
    }
    return {
      minY: -H, maxY: dh - 2,
      xExtra: 0, yExtra: -H, cxExtra: halfW, cyExtra: H + Math.ceil((2 * H) / 3) - 1, hasExtra: true,
      getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
        left: gy <= -1 ? -2 - 2 * gy : gy + 1,
        right: gy <= -1 ? halfW - 1 : gy <= H - 1 ? halfW + 1 + 2 * gy : W - 1 - 2 * (gy - (H - 1))
      }
    };
  }

  if (rampType === 4) {
    if (role === 'first') {
      return {
        minY: -H, maxY: dh - 2,
        xExtra: 1, yExtra: -H, cxExtra: W - 1, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= H - 1 ? H - 1 - gy : 2 * (gy - (H - 1)),
          right: gy <= -1 ? W + 1 + 2 * gy : gy <= H - 1 ? W - 1 : W - 1 - 2 * (gy - (H - 1))
        }
      };
    }
    if (role === 'middle') {
      return {
        minY: -H, maxY: dh - 2,
        xExtra: halfW, yExtra: -H, cxExtra: halfW, cyExtra: dh - 1, hasExtra: true,
        getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
          left: gy <= -1 ? halfW : gy <= H - 1 ? halfW - 2 - 2 * gy : 2 * (gy - (H - 1)),
          right: gy <= -1 ? W + 1 + 2 * gy : gy <= H - 1 ? W - 1 : W - 1 - 2 * (gy - (H - 1))
        }
      };
    }
    return {
      minY: -H, maxY: dh - 2,
      xExtra: halfW, yExtra: -H, cxExtra: halfW, cyExtra: H + Math.ceil((2 * H) / 3) - 1, hasExtra: true,
      getSpan: (gy) => (gy < -H || gy > dh - 2) ? null : {
        left: gy <= -1 ? halfW : gy <= H - 1 ? halfW - 2 - 2 * gy : 2 * (gy - (H - 1)),
        right: gy <= -1 ? W + 1 + 2 * gy : W - 2 - gy
      }
    };
  }

  return null;
}
