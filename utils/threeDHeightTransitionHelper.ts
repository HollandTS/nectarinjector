import { colorDistance } from './colorUtils';
import type { MaskGroup, RgbaColor } from '../types';

/**
 * Computes a height-driven overhang/elevation spillover alpha mask for a color group
 * when injecting a 3D object (or displaced texture) onto a tile.
 *
 * How it works:
 * 1. Builds the exact binary membership mask of pixels matching the color group.
 * 2. For pixels outside the color group but within `elevationHeight` pixels of the group's border
 *    (specifically biased upward `-dy` in screen space, matching how 3D height/displacement
 *    rises up the Y axis in the isometric camera, plus radial spread around the border),
 *    evaluates the local height/luminance of the 3D object's rendered texture.
 * 3. Where the 3D texture is high/bright (or has high displacement peaks like grass blades/clumps),
 *    it naturally spills over and covers the border beyond the color mask!
 */
export function computeGroupElevationOverhangWeights(
    refPixels: Uint8ClampedArray,
    srcPixels: Uint8ClampedArray,
    width: number,
    height: number,
    group: MaskGroup
): Float32Array | null {
    const elevation = group.threeDElevation ?? 0;
    if (elevation <= 0 || !group.colors || group.colors.length === 0) {
        return null;
    }

    const totalPixels = width * height;
    const inGroup = new Uint8Array(totalPixels);
    const tolVal = (group.tolerance / 100) * 442;

    let hasAnyGroupPixel = false;
    for (let p = 0; p < totalPixels; p++) {
        const idx = p * 4;
        if (refPixels[idx + 3] === 0) continue;
        const color: RgbaColor = {
            r: refPixels[idx],
            g: refPixels[idx + 1],
            b: refPixels[idx + 2],
            a: 1,
        };
        for (let c = 0; c < group.colors.length; c++) {
            if (colorDistance(group.colors[c], color) <= tolVal) {
                inGroup[p] = 1;
                hasAnyGroupPixel = true;
                break;
            }
        }
    }

    if (!hasAnyGroupPixel) return null;

    const weights = new Float32Array(totalPixels);
    // Max pixel reach scales with the Height slider (1..100 -> up to ~28px overhang)
    const maxRadius = Math.max(1, Math.ceil(elevation * 0.28));
    // Upward bias: in isometric view, +Y 3D height projects upward on screen (positive dy means looking down to find the base color)
    const upwardStretch = 1.65;
    const sideStretch = 1.0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const p = y * width + x;
            const pxIdx = p * 4;
            if (refPixels[pxIdx + 3] === 0) continue;

            if (inGroup[p] === 1) {
                weights[p] = 1.0;
                continue;
            }

            if (srcPixels[pxIdx + 3] === 0) continue;

            // Search neighborhood for the nearest pixel that belongs to this color group.
            // Because 3D height rises UP (-y on screen), a pixel at (x, y) above a group pixel at (x, y + dy)
            // should have a shorter effective distance when dy > 0 (looking downward for the base group).
            let minEffectiveDist = Infinity;

            const dyMin = -Math.ceil(maxRadius * 1.35);
            const dyMax = Math.ceil(maxRadius * upwardStretch);
            const dxRange = Math.ceil(maxRadius * sideStretch);

            for (let dy = dyMin; dy <= dyMax; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= height) continue;
                const rowOffset = ny * width;

                // Support both upward 3D height projection (dy > 0) and downward top-ground lip overhang (dy < 0)
                const vScale = dy > 0 ? 1 / upwardStretch : 1 / 1.25;
                const dyScaledSq = (dy * vScale) * (dy * vScale);
                if (dyScaledSq >= minEffectiveDist * minEffectiveDist) continue;

                for (let dx = -dxRange; dx <= dxRange; dx++) {
                    const nx = x + dx;
                    if (nx < 0 || nx >= width) continue;
                    if (inGroup[rowOffset + nx] === 1) {
                        const d = Math.sqrt(dx * dx + dyScaledSq);
                        if (d < minEffectiveDist) {
                            minEffectiveDist = d;
                        }
                    }
                }
            }

            if (minEffectiveDist <= maxRadius) {
                // Normalized distance from border: 0 at border, 1 at maxRadius
                const normDist = minEffectiveDist / maxRadius;

                // Sample local height/luminance of the 3D rendered pixel (0..1)
                const sr = srcPixels[pxIdx] / 255;
                const sg = srcPixels[pxIdx + 1] / 255;
                const sb = srcPixels[pxIdx + 2] / 255;
                const lum = 0.299 * sr + 0.587 * sg + 0.114 * sb;

                // Micro-variation based on coordinates + luminance so grass/3D displaced tips look organic over the border
                const organicMod =
                    0.85 +
                    0.15 * Math.sin(x * 0.65 + y * 0.45) * Math.cos(x * 0.35 - y * 0.55);

                // Higher luminance/displacement peaks extend further across the border;
                // closer to the border (normDist -> 0), even medium heights spill over smoothly.
                const heightPower = Math.min(1, Math.max(0.15, lum * 1.25)) * organicMod;
                const reachAtPixel = maxRadius * (0.35 + 0.65 * heightPower);

                if (minEffectiveDist <= reachAtPixel) {
                    const falloff = 1.0 - minEffectiveDist / Math.max(0.5, reachAtPixel);
                    // Smoothstep curve for natural transition over the border
                    const smoothAlpha = falloff * falloff * (3 - 2 * falloff);
                    weights[p] = Math.max(0, Math.min(1, smoothAlpha));
                }
            }
        }
    }

    return weights;
}
