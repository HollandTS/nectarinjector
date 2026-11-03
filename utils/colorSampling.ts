import type { CanvasImage, GridType, RgbaColor } from '../types';
import { GRID_CONFIGS } from '../constants';
import { getImageDrawPos } from './geoUtils';
import { loadImage } from './textureInjection';

export const isPointInPoly = (p: { x: number, y: number }, poly: { x: number, y: number }[]): boolean => {
    let isInside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (((poly[i].y > p.y) !== (poly[j].y > p.y)) && 
            (p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) {
            isInside = !isInside;
        }
    }
    return isInside;
};

export const sampleColorsFromLasso = async (
    path: { x: number, y: number }[],
    images: CanvasImage[],
    gridType: GridType,
    transparencyColor: RgbaColor | null,
    tolerance: number
): Promise<RgbaColor[]> => {
    if (path.length < 2) return [];

    // Ensure polygon is closed for ray-casting
    const poly = path.length > 2 ? [...path, path[0]] : path;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    path.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });

    const currentConfig = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const collectedColors: RgbaColor[] = [];
    const colorSet = new Set<string>();

    for (const image of images) {
        const drawPos = getImageDrawPos(image, currentConfig.width, currentConfig.height);
        const drawX = Math.round(drawPos.x) + image.offsetX;
        const drawY = Math.round(drawPos.y) + image.offsetY;

        // Check bounding box intersection with tile
        if (drawX < maxX && drawX + image.width > minX && drawY < maxY && drawY + image.height > minY) {
            const img = await loadImage(image.src);
            if (!img) continue;

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) continue;

            ctx.save();
            if (image.flipH || image.flipV) {
                ctx.translate(image.flipH ? canvas.width : 0, image.flipV ? canvas.height : 0);
                ctx.scale(image.flipH ? -1 : 1, image.flipV ? -1 : 1);
            }
            ctx.drawImage(img, 0, 0);
            ctx.restore();

            const imageData = ctx.getImageData(0, 0, image.width, image.height);
            const data = imageData.data;

            const lMinX = Math.max(0, Math.floor(minX - drawX));
            const lMaxX = Math.min(image.width - 1, Math.ceil(maxX - drawX));
            const lMinY = Math.max(0, Math.floor(minY - drawY));
            const lMaxY = Math.min(image.height - 1, Math.ceil(maxY - drawY));

            const boxW = lMaxX - lMinX;
            const boxH = lMaxY - lMinY;
            const step = (boxW < 60 && boxH < 60) ? 1 : 2;

            for (let ly = lMinY; ly <= lMaxY; ly += step) {
                for (let lx = lMinX; lx <= lMaxX; lx += step) {
                    const worldX = lx + drawX;
                    const worldY = ly + drawY;

                    if (isPointInPoly({ x: worldX, y: worldY }, poly)) {
                        const idx = (ly * image.width + lx) * 4;
                        const alpha = data[idx + 3];
                        if (alpha > 64) {
                            const r = data[idx];
                            const g = data[idx + 1];
                            const b = data[idx + 2];

                            // Skip keyed transparency color
                            if (transparencyColor) {
                                const d = Math.sqrt(
                                    (r - transparencyColor.r) ** 2 +
                                    (g - transparencyColor.g) ** 2 +
                                    (b - transparencyColor.b) ** 2
                                );
                                if (d <= tolerance) continue;
                            }

                            const key = `${r},${g},${b}`;
                            if (!colorSet.has(key)) {
                                colorSet.add(key);
                                collectedColors.push({ r, g, b, a: 1 });
                            }
                        }
                    }
                }
            }

            canvas.width = 0;
            canvas.height = 0;
        }
    }

    return collectedColors;
};
