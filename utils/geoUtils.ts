
import type { CanvasImage } from '../types';

export const isoToScreen = (i: number, j: number, cellW: number, cellH: number) => ({
    // Return precise floats to avoid cumulative rounding errors
    x: (i - j) * (cellW / 2),
    y: (i + j) * (cellH / 2)
});

export const screenToIso = (x: number, y: number, cellW: number, cellH: number) => {
    const w2 = cellW / 2;
    const h2 = cellH / 2;
    // Standard isometric inverse transformation aligned to tile diamond center
    const u = (x - w2) / w2;
    const v = y / h2;
    const i = (v + u) / 2;
    const j = (v - u) / 2;
    return { i, j };
};

export const getImageDrawPos = (image: CanvasImage, cellW: number, cellH: number) => {
    const rawPos = isoToScreen(image.gridX, image.gridY, cellW, cellH);
    const isTmp = image.tmpMinX !== undefined && image.tmpMinY !== undefined;
    const heightStepOffset = (image.heightLevel || 0) * (cellH / 2);
    return {
        // Align TMP tile diamond top-center (x = cellW / 2) with IsometricGrid apex at rawPos.x,
        // matching OpenTS World_To_Screen and standard PNG isotiles pixel-perfectly.
        // Subtract heightStepOffset so each fake height level shifts upward by half a cell height (12px TS / 15px RA2).
        x: isTmp ? rawPos.x - (cellW / 2) + image.tmpMinX! : rawPos.x - (image.width / 2),
        y: (isTmp ? rawPos.y + image.tmpMinY! : rawPos.y + cellH - image.height) - heightStepOffset
    };
};


