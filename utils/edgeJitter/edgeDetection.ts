import { OverlayFilters } from '../../types';
import { isColorInRange } from './colorRangeMatcher';

export interface EdgeDetectionResult {
    edgeMap: Float32Array; // 0 (interior/background) to 1 (close to edge)
    isEdgeCandidate: Uint8Array; // 1 if pixel is candidate for jitter
}

/**
 * Computes an edge weight map for an image based on target mode ('outer' vs 'all')
 * and color range constraints.
 */
export function computeEdgeMap(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    f: OverlayFilters
): EdgeDetectionResult {
    const totalPixels = width * height;
    const edgeMap = new Float32Array(totalPixels);
    const isEdgeCandidate = new Uint8Array(totalPixels);

    const thickness = Math.max(1, f.edgeJitterThickness ?? 6);
    const target = f.edgeJitterTarget || 'outer';
    const isColorRangeOnly = Boolean(f.edgeJitterColorRangeOnly);
    const targetColors = f.edgeJitterColors || [];
    const colorTol = f.edgeJitterColorTolerance ?? 20;

    const isOpaque = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
        const a = data[i * 4 + 3];
        isOpaque[i] = a > 20 ? 1 : 0;
    }

    // Step 1: Detect raw boundary edges
    const rawEdge = new Uint8Array(totalPixels);

    const hasColorFilter = isColorRangeOnly && targetColors.length > 0;
    const colorMatch = new Uint8Array(totalPixels);
    if (hasColorFilter) {
        for (let i = 0; i < totalPixels; i++) {
            if (isOpaque[i]) {
                const px = i * 4;
                colorMatch[i] = isColorInRange(data[px], data[px + 1], data[px + 2], targetColors, colorTol) ? 1 : 0;
            }
        }
    }

    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const idx = row + x;
            if (!isOpaque[idx]) continue;

            const px = idx * 4;

            if (hasColorFilter) {
                // In color-range mode, only matching pixels can be edge candidates
                if (!colorMatch[idx]) continue;

                // An edge of the color range is a matching pixel adjacent to a non-matching pixel (or border)
                let isColorBoundary = false;
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    isColorBoundary = true;
                } else {
                    if (!colorMatch[idx - 1] || !colorMatch[idx + 1] ||
                        !colorMatch[idx - width] || !colorMatch[idx + width]) {
                        isColorBoundary = true;
                    }
                }
                if (isColorBoundary) {
                    rawEdge[idx] = 1;
                }
                continue;
            }

            let isBoundary = false;

            if (target === 'outer') {
                // Check if adjacent to transparent pixel or image boundary
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    isBoundary = true;
                } else {
                    if (!isOpaque[idx - 1] || !isOpaque[idx + 1] ||
                        !isOpaque[idx - width] || !isOpaque[idx + width]) {
                        isBoundary = true;
                    }
                }
            } else {
                // 'all' edges: transparent boundaries OR high internal color contrast
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    isBoundary = true;
                } else if (!isOpaque[idx - 1] || !isOpaque[idx + 1] ||
                           !isOpaque[idx - width] || !isOpaque[idx + width]) {
                    isBoundary = true;
                } else {
                    // Internal color delta check (Sobel / cross contrast)
                    const r = data[px], g = data[px + 1], b = data[px + 2];
                    const rRight = data[(idx + 1) * 4], gRight = data[(idx + 1) * 4 + 1], bRight = data[(idx + 1) * 4 + 2];
                    const rDown = data[(idx + width) * 4], gDown = data[(idx + width) * 4 + 1], bDown = data[(idx + width) * 4 + 2];

                    const diffX = Math.abs(r - rRight) + Math.abs(g - gRight) + Math.abs(b - bRight);
                    const diffY = Math.abs(r - rDown) + Math.abs(g - gDown) + Math.abs(b - bDown);

                    if (diffX > 20 || diffY > 20) {
                        isBoundary = true;
                    }
                }
            }

            if (isBoundary) {
                rawEdge[idx] = 1;
            }
        }
    }

    // Step 2: Distance propagation to create falloff over thickness
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const idx = row + x;
            if (!isOpaque[idx]) continue;

            if (hasColorFilter && !colorMatch[idx]) {
                continue;
            }

            if (rawEdge[idx]) {
                edgeMap[idx] = 1.0;
                isEdgeCandidate[idx] = 1;
                continue;
            }

            // Find closest rawEdge pixel within radius
            let minDistSq = Infinity;
            const rLim = Math.ceil(thickness);

            const yMin = Math.max(0, y - rLim);
            const yMax = Math.min(height - 1, y + rLim);
            const xMin = Math.max(0, x - rLim);
            const xMax = Math.min(width - 1, x + rLim);

            for (let ny = yMin; ny <= yMax; ny++) {
                const nRow = ny * width;
                const dy = ny - y;
                for (let nx = xMin; nx <= xMax; nx++) {
                    if (rawEdge[nRow + nx]) {
                        const dx = nx - x;
                        const distSq = dx * dx + dy * dy;
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                        }
                    }
                }
            }

            const dist = Math.sqrt(minDistSq);
            if (dist <= thickness) {
                const weight = Math.max(0, 1 - (dist / thickness));
                edgeMap[idx] = weight;
                isEdgeCandidate[idx] = 1;
            }
        }
    }

    return { edgeMap, isEdgeCandidate };
}
