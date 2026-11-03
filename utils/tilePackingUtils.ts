import type { CanvasImage, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { rgbToHsl } from './colorUtils';
import { getTileCellSpan } from './openTsTileRenderer';

export const getAverageColorHsl = (src: string): Promise<{ h: number; s: number; l: number }> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                resolve({ h: 0, s: 0, l: 0 });
                return;
            }
            ctx.drawImage(img, 0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            resolve(rgbToHsl(data[0], data[1], data[2]));
        };
        img.onerror = () => resolve({ h: 0, s: 0, l: 0 });
        img.src = src;
    });
};

/**
 * Calculates packed isometric positions for a group of tiles,
 * ensuring the packed group remains centered around the original selection's center.
 */
export function calculatePackedPositions(
    selectedImages: CanvasImage[],
    gridType: GridType
): Map<string, { gridX: number; gridY: number }> {
    if (selectedImages.length === 0) return new Map();

    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const cols = Math.ceil(Math.sqrt(selectedImages.length));

    // Calculate original bounding box and its center in grid units
    const origMinX = Math.min(...selectedImages.map(img => {
        const { minCol } = getTileCellSpan(img, config.width, config.height);
        return img.gridX + minCol;
    }));
    const origMaxX = Math.max(...selectedImages.map(img => {
        const { spanX, minCol } = getTileCellSpan(img, config.width, config.height);
        return img.gridX + minCol + (spanX - 1);
    }));
    const origMinY = Math.min(...selectedImages.map(img => {
        const { minRow } = getTileCellSpan(img, config.width, config.height);
        return img.gridY + minRow;
    }));
    const origMaxY = Math.max(...selectedImages.map(img => {
        const { spanY, minRow } = getTileCellSpan(img, config.width, config.height);
        return img.gridY + minRow + (spanY - 1);
    }));
    const origCenterX = (origMinX + origMaxX) / 2;
    const origCenterY = (origMinY + origMaxY) / 2;

    // Place each image into a packed grid layout relative to (0, 0)
    const relativePositions: { id: string; relX: number; relY: number; spanX: number; spanY: number; minCol: number; minRow: number }[] = [];
    let currentX = 0;
    let currentY = 0;
    let maxRowSpanY = 1;
    let count = 0;

    for (const img of selectedImages) {
        const { spanX, spanY, minCol, minRow } = getTileCellSpan(img, config.width, config.height);
        relativePositions.push({ id: img.id, relX: currentX, relY: currentY, spanX, spanY, minCol, minRow });
        currentX += spanX;
        maxRowSpanY = Math.max(maxRowSpanY, spanY);
        count++;

        if (count >= cols) {
            currentX = 0;
            currentY += maxRowSpanY;
            maxRowSpanY = 1;
            count = 0;
        }
    }

    // Determine the bounding box of the packed layout
    const minRelX = Math.min(...relativePositions.map(p => p.relX));
    const maxRelX = Math.max(...relativePositions.map(p => p.relX + (p.spanX - 1)));
    const minRelY = Math.min(...relativePositions.map(p => p.relY));
    const maxRelY = Math.max(...relativePositions.map(p => p.relY + (p.spanY - 1)));
    const packedCenterRelX = (minRelX + maxRelX) / 2;
    const packedCenterRelY = (minRelY + maxRelY) / 2;

    // Anchor the packed block so its center matches the original selection's center
    const startGridX = Math.round(origCenterX - packedCenterRelX);
    const startGridY = Math.round(origCenterY - packedCenterRelY);

    const resultMap = new Map<string, { gridX: number; gridY: number }>();
    for (const p of relativePositions) {
        resultMap.set(p.id, {
            gridX: startGridX + p.relX - p.minCol,
            gridY: startGridY + p.relY - p.minRow
        });
    }

    return resultMap;
}

/**
 * Sorts selected tiles by hue/lightness and packs them isometrically,
 * keeping the packed block anchored at the original selection's center.
 */
export async function calculateColorPackedPositions(
    selectedImages: CanvasImage[],
    gridType: GridType
): Promise<Map<string, { gridX: number; gridY: number }>> {
    const imagesWithColor = await Promise.all(selectedImages.map(async (img) => ({
        img,
        hsl: await getAverageColorHsl(img.src)
    })));

    imagesWithColor.sort((a, b) => a.hsl.h - b.hsl.h || a.hsl.l - b.hsl.l);
    const sortedImages = imagesWithColor.map(i => i.img);

    return calculatePackedPositions(sortedImages, gridType);
}
