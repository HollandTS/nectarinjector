/**
 * Smoothly balances all visible pixels in the canvas toward the layer's overall average (middle) color.
 * At balanceStrength = 0, original colors are unchanged.
 * As balanceStrength increases toward 100, colors smoothly converge toward the mean color of all visible pixels.
 * At balanceStrength = 100, the entire layer becomes 1 solid color (the middle color of all colors in the layer).
 */
export function applyColorBalance(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    balanceStrength: number
) {
    if (balanceStrength <= 0 || width <= 0 || height <= 0) return;

    const t = Math.min(1, Math.max(0, balanceStrength / 100));
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let totalWeight = 0;

    for (let i = 0; i < len; i += 4) {
        const a = data[i + 3];
        if (a > 0) {
            const weight = a / 255;
            sumR += data[i] * weight;
            sumG += data[i + 1] * weight;
            sumB += data[i + 2] * weight;
            totalWeight += weight;
        }
    }

    if (totalWeight <= 0) return;

    const avgR = sumR / totalWeight;
    const avgG = sumG / totalWeight;
    const avgB = sumB / totalWeight;

    for (let i = 0; i < len; i += 4) {
        if (data[i + 3] > 0) {
            data[i] = Math.round(data[i] + (avgR - data[i]) * t);
            data[i + 1] = Math.round(data[i + 1] + (avgG - data[i + 1]) * t);
            data[i + 2] = Math.round(data[i + 2] + (avgB - data[i + 2]) * t);
        }
    }

    ctx.putImageData(imgData, 0, 0);
}
