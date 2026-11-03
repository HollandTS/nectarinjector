import { RGB } from '../../lib/formats';

/**
 * Returns an RGBA tuple for a given Z value and max depth.
 */
export function getZColor(
  z: number,
  maxZ: number,
  mode: 'heatmap' | 'grayscale'
): [number, number, number, number] {
  if (z <= 0) {
    return [0, 0, 0, 0];
  }

  const safeMax = Math.max(1, maxZ);
  const ratio = Math.min(1, Math.max(0, z / safeMax));

  if (mode === 'grayscale') {
    const val = Math.min(255, Math.round(25 + ratio * 230));
    return [val, val, val, 255];
  }

  // Smooth pseudo-thermal heatmap: deep blue -> cyan -> green -> yellow -> red
  let r = 0;
  let g = 0;
  let b = 0;

  if (ratio < 0.2) {
    // dark indigo to blue
    const t = ratio / 0.2;
    r = Math.round(40 * (1 - t));
    g = Math.round(50 * t);
    b = Math.round(140 + 115 * t);
  } else if (ratio < 0.4) {
    // blue to cyan
    const t = (ratio - 0.2) / 0.2;
    r = 0;
    g = Math.round(50 + 190 * t);
    b = 255;
  } else if (ratio < 0.6) {
    // cyan to green
    const t = (ratio - 0.4) / 0.2;
    r = 0;
    g = 240;
    b = Math.round(255 * (1 - t));
  } else if (ratio < 0.8) {
    // green to yellow
    const t = (ratio - 0.6) / 0.2;
    r = Math.round(255 * t);
    g = 230;
    b = 0;
  } else {
    // yellow to red
    const t = (ratio - 0.8) / 0.2;
    r = 255;
    g = Math.round(230 * (1 - t));
    b = Math.round(30 * (1 - t));
  }

  return [r, g, b, 255];
}

/**
 * Blend a Z-color over a base pixel color from the palette.
 */
export function blendOverlay(
  pixelColor: RGB | null,
  z: number,
  maxZ: number
): [number, number, number, number] {
  if (!pixelColor) {
    return [0, 0, 0, 0];
  }

  if (z <= 0) {
    return [pixelColor.r, pixelColor.g, pixelColor.b, 255];
  }

  const [zr, zg, zb] = getZColor(z, maxZ, 'heatmap');
  // 50% image texture + 50% Z-heat
  const r = Math.round(pixelColor.r * 0.45 + zr * 0.55);
  const g = Math.round(pixelColor.g * 0.45 + zg * 0.55);
  const b = Math.round(pixelColor.b * 0.45 + zb * 0.55);

  return [r, g, b, 255];
}
