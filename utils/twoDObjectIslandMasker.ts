import type { TileDiamondSpec } from './threeDSceneCaptureHelper';

export interface Isolated2DObjectsResult {
    maskedPixels: Uint8ClampedArray;
    matchedRoots: { x: number; y: number }[];
}

function computeDiamondDistance(
    px: number,
    py: number,
    d: TileDiamondSpec
): { normDist: number; perpOutsidePx: number } {
    const hw = Math.max(1, d.halfW);
    const hh = Math.max(1, d.halfH);
    const normDist = Math.abs(px - d.centerX) / hw + Math.abs(py - d.centerY) / hh;
    const edgeFactor = (hw * hh) / Math.hypot(hw, hh);
    const perpOutsidePx = (normDist - 1.0) * edgeFactor;
    return { normDist, perpOutsidePx };
}

/**
 * Connected-component flood-fill island detector for 2D layers.
 * Finds discrete 2D object islands on a sampled RGBA buffer, determines each island's
 * bottom-center root anchor in canvas coordinates, keeps whole islands that belong to
 * `targetDiamond` (within `searchRadiusPx` and closer to `targetDiamond` than `otherDiamonds`),
 * and masks out all other islands (as well as giant full-bleed background fills).
 */
export function maskIsolated2DLayerObjects(
    srcPixels: Uint8ClampedArray,
    width: number,
    height: number,
    cropOriginCanvasX: number,
    cropOriginCanvasY: number,
    targetDiamond: TileDiamondSpec,
    otherDiamonds: TileDiamondSpec[],
    searchRadiusPx: number,
    alphaThreshold: number = 110
): Isolated2DObjectsResult {
    const totalPixels = width * height;
    const visited = new Uint8Array(totalPixels);
    const outPixels = new Uint8ClampedArray(srcPixels.length);
    const matchedRoots: { x: number; y: number }[] = [];

    // Max area for a discrete sprite/object before considering it a continuous ground sheet
    const maxDiscreteIslandArea = Math.min(totalPixels * 0.72, 160 * 160);
    const queue = new Int32Array(totalPixels);

    for (let startIdx = 0; startIdx < totalPixels; startIdx++) {
        if (visited[startIdx]) continue;
        const a = srcPixels[startIdx * 4 + 3];
        if (a < alphaThreshold) {
            visited[startIdx] = 1;
            continue;
        }

        // Flood-fill 8-connected component
        let head = 0;
        let tail = 0;
        queue[tail++] = startIdx;
        visited[startIdx] = 1;

        let minX = width, maxX = 0, minY = height, maxY = 0;
        let bottomXSum = 0;
        let bottomXCount = 0;
        let touchesBorder = false;

        while (head < tail) {
            const curr = queue[head++];
            const cy = Math.floor(curr / width);
            const cx = curr - cy * width;

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) {
                maxY = cy;
                bottomXSum = cx;
                bottomXCount = 1;
            } else if (cy === maxY) {
                bottomXSum += cx;
                bottomXCount++;
            }

            if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
                touchesBorder = true;
            }

            for (let dy = -1; dy <= 1; dy++) {
                const ny = cy + dy;
                if (ny < 0 || ny >= height) continue;
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = cx + dx;
                    if (nx < 0 || nx >= width) continue;
                    const nIdx = ny * width + nx;
                    if (visited[nIdx]) continue;
                    if (srcPixels[nIdx * 4 + 3] >= alphaThreshold) {
                        visited[nIdx] = 1;
                        queue[tail++] = nIdx;
                    }
                }
            }
        }

        const islandPixelCount = tail;
        if (islandPixelCount > maxDiscreteIslandArea && touchesBorder) {
            // This is a continuous ground fill covering the canvas, not an isolated object
            continue;
        }

        // Compute the object's ground root anchor (bottom-center of the sprite) in canvas coordinates
        const rootLocalX = bottomXCount > 0 ? bottomXSum / bottomXCount : (minX + maxX) * 0.5;
        const rootLocalY = maxY;
        const rootCanvasX = cropOriginCanvasX + rootLocalX;
        const rootCanvasY = cropOriginCanvasY + rootLocalY;

        // Also check center of mass in case the sprite overhangs downward
        const centerCanvasX = cropOriginCanvasX + (minX + maxX) * 0.5;
        const centerCanvasY = cropOriginCanvasY + (minY + maxY) * 0.5;

        const rootMetric = computeDiamondDistance(rootCanvasX, rootCanvasY, targetDiamond);
        const centerMetric = computeDiamondDistance(centerCanvasX, centerCanvasY, targetDiamond);
        const bestMyMetric =
            rootMetric.normDist <= centerMetric.normDist ? rootMetric : centerMetric;
        const anchorX = rootMetric.normDist <= centerMetric.normDist ? rootCanvasX : centerCanvasX;
        const anchorY = rootMetric.normDist <= centerMetric.normDist ? rootCanvasY : centerCanvasY;

        if (bestMyMetric.perpOutsidePx > searchRadiusPx) {
            continue;
        }

        let claimedByOther = false;
        for (let i = 0; i < otherDiamonds.length; i++) {
            const other = otherDiamonds[i];
            if (other.id === targetDiamond.id) continue;
            const otherMetric = computeDiamondDistance(anchorX, anchorY, other);
            if (otherMetric.normDist < bestMyMetric.normDist - 1e-4) {
                claimedByOther = true;
                break;
            }
        }
        if (claimedByOther) continue;

        matchedRoots.push({ x: anchorX, y: anchorY });

        // Copy all pixels of this kept whole object island into outPixels
        for (let k = 0; k < islandPixelCount; k++) {
            const pIdx = queue[k] * 4;
            outPixels[pIdx] = srcPixels[pIdx];
            outPixels[pIdx + 1] = srcPixels[pIdx + 1];
            outPixels[pIdx + 2] = srcPixels[pIdx + 2];
            outPixels[pIdx + 3] = srcPixels[pIdx + 3];
        }
    }

    return { maskedPixels: outPixels, matchedRoots };
}
