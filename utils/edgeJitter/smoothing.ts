/**
 * Applies horizontal and vertical box-blur passes to smooth a 2D displacement or float map.
 */
export function smooth2DField(
    field: Float32Array,
    width: number,
    height: number,
    smoothingAmount: number // 0 to 100
): Float32Array {
    if (smoothingAmount <= 0) return field;

    const radius = Math.max(1, Math.min(25, Math.round((smoothingAmount / 100) * 12)));
    const passes = smoothingAmount > 50 ? 3 : 2;

    let src = field;
    let temp = new Float32Array(width * height);

    for (let pass = 0; pass < passes; pass++) {
        // Horizontal pass
        for (let y = 0; y < height; y++) {
            const rowOffset = y * width;
            let sum = 0;
            let count = 0;

            for (let x = -radius; x <= radius; x++) {
                if (x >= 0 && x < width) {
                    sum += src[rowOffset + x];
                    count++;
                }
            }

            for (let x = 0; x < width; x++) {
                temp[rowOffset + x] = count > 0 ? sum / count : 0;
                const removeX = x - radius;
                const addX = x + radius + 1;
                if (removeX >= 0) {
                    sum -= src[rowOffset + removeX];
                    count--;
                }
                if (addX < width) {
                    sum += src[rowOffset + addX];
                    count++;
                }
            }
        }

        // Vertical pass
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let count = 0;

            for (let y = -radius; y <= radius; y++) {
                if (y >= 0 && y < height) {
                    sum += temp[y * width + x];
                    count++;
                }
            }

            for (let y = 0; y < height; y++) {
                src[y * width + x] = count > 0 ? sum / count : 0;
                const removeY = y - radius;
                const addY = y + radius + 1;
                if (removeY >= 0) {
                    sum -= temp[removeY * width + x];
                    count--;
                }
                if (addY < height) {
                    sum += temp[addY * width + x];
                    count++;
                }
            }
        }
    }

    return src;
}
