/**
 * Expands / dilates a binary/grayscale mask so that white/opaque regions expand outward.
 * Used when brush hardness > 100% (e.g. up to 300% or more) to cause white areas to spread.
 */
export function dilateMask(
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    radius: number
): Uint8ClampedArray {
    if (radius <= 0) return srcData;

    const r = Math.min(Math.round(radius), 40); // Cap radius to safe maximum for performance
    const output = new Uint8ClampedArray(srcData.length);

    // Copy original data first
    output.set(srcData);

    const w = width;
    const h = height;

    // For each pixel, find maximum luminance/alpha in circle of radius r
    // Optimization: Pre-calculate offsets within circular radius r
    const offsets: { dx: number; dy: number }[] = [];
    const rSq = r * r;
    for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= rSq) {
                offsets.push({ dx, dy });
            }
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const mA = srcData[idx + 3];
            const mLum = (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114);

            // If already maxed out, keep it
            if (mA >= 250 && mLum >= 250) {
                continue;
            }

            let maxLum = mLum;
            let maxA = mA;

            for (let k = 0; k < offsets.length; k++) {
                const nx = x + offsets[k].dx;
                const ny = y + offsets[k].dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    const nIdx = (ny * w + nx) * 4;
                    const nA = srcData[nIdx + 3];
                    if (nA > 0) {
                        const nLum = srcData[nIdx] * 0.299 + srcData[nIdx + 1] * 0.587 + srcData[nIdx + 2] * 0.114;
                        if (nLum > maxLum) maxLum = nLum;
                        if (nA > maxA) maxA = nA;
                    }
                }
            }

            output[idx] = Math.min(255, Math.round(maxLum));
            output[idx + 1] = Math.min(255, Math.round(maxLum));
            output[idx + 2] = Math.min(255, Math.round(maxLum));
            output[idx + 3] = Math.min(255, Math.round(maxA));
        }
    }

    return output;
}
