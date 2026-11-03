import type { CanvasImage, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { TmpFile, TmpParser, RGB } from './formats';
import { getTmpMinOffsets, loadDefaultPalette } from './westwoodTmpParser';
import { getLoadedPalette } from './paletteViewerHelper';
import { ensureTmpFileForCanvasImage, ExtraTemplatePreset } from './extraImageTemplates';
import { generateExtraImageZData, repairTileExtraAndBaseZ } from './extraImageZHelper';
import { loadImage } from './textureInjection';

export interface PreviousCanvasPreserveInfo {
    prevCanvas: HTMLCanvasElement;
    prevRawMinX: number;
    prevRawMinY: number;
    newlyStampedMask?: {
        rawMinX: number;
        rawMinY: number;
        width: number;
        height: number;
        stamped: Uint8Array; // 1 where Step 2 actively stamped a new pixel
    };
}

/**
 * Re-renders a modified TmpFile back into a CanvasImage, updating tmpBuffer, tmpMinX, tmpMinY, width, and height
 * so the tile stays anchored at its exact isometric grid cell (gridX, gridY).
 * If `preserveInfo` is provided, preserves the exact RGB pixels from `prevCanvas` (e.g. from a prior Smart Layer bake)
 * everywhere that wasn't overwritten by the new Extra-Image bake!
 */
export function buildUpdatedCanvasImageFromTmp(
    image: CanvasImage,
    tmpFile: TmpFile,
    palette: RGB[],
    preserveInfo?: PreviousCanvasPreserveInfo
): CanvasImage {
    const newBuffer = TmpParser.writeTmp(tmpFile);
    const offsets = getTmpMinOffsets(tmpFile);

    const outCanvas = document.createElement('canvas');
    TmpParser.renderCompleteToCanvas(outCanvas, tmpFile, palette);

    if (preserveInfo && outCanvas.width > 0 && outCanvas.height > 0) {
        const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
        const prevCtx = preserveInfo.prevCanvas.getContext('2d', { willReadFrequently: true });
        if (outCtx && prevCtx) {
            const outImgData = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
            const outData = outImgData.data;
            const prevW = preserveInfo.prevCanvas.width;
            const prevH = preserveInfo.prevCanvas.height;
            const prevData = prevCtx.getImageData(0, 0, prevW, prevH).data;

            const shiftX = preserveInfo.prevRawMinX - offsets.rawMinX;
            const shiftY = preserveInfo.prevRawMinY - offsets.rawMinY;
            const mask = preserveInfo.newlyStampedMask;

            for (let py = 0; py < prevH; py++) {
                const dy = py + shiftY;
                if (dy < 0 || dy >= outCanvas.height) continue;
                for (let px = 0; px < prevW; px++) {
                    const dx = px + shiftX;
                    if (dx < 0 || dx >= outCanvas.width) continue;

                    const prevOff = (py * prevW + px) * 4;
                    if (prevData[prevOff + 3] < 128) continue;

                    const outOff = (dy * outCanvas.width + dx) * 4;
                    if (outData[outOff + 3] === 0) continue;

                    // Check if Step 2 actively stamped a new pixel at this TMP coordinate
                    const tmpX = offsets.rawMinX + dx;
                    const tmpY = offsets.rawMinY + dy;
                    let wasOverwrittenByStep2 = false;
                    if (mask) {
                        const mx = tmpX - mask.rawMinX;
                        const my = tmpY - mask.rawMinY;
                        if (mx >= 0 && mx < mask.width && my >= 0 && my < mask.height) {
                            if (mask.stamped[my * mask.width + mx] === 1) {
                                wasOverwrittenByStep2 = true;
                            }
                        }
                    }

                    if (!wasOverwrittenByStep2) {
                        outData[outOff] = prevData[prevOff];
                        outData[outOff + 1] = prevData[prevOff + 1];
                        outData[outOff + 2] = prevData[prevOff + 2];
                        outData[outOff + 3] = prevData[prevOff + 3];
                    }
                }
            }
            outCtx.putImageData(outImgData, 0, 0);
        }
    }

    const finalSrc = outCanvas.toDataURL('image/png');

    return {
        ...image,
        src: finalSrc,
        originalSrc: finalSrc,
        width: outCanvas.width,
        height: outCanvas.height,
        tmpBuffer: newBuffer,
        tmpMinX: offsets.minX,
        tmpMinY: offsets.minY,
        tmpCols: offsets.cols,
        tmpRows: offsets.rows,
        tmpCells: offsets.cells,
        isIsotile: true,
    };
}

/**
 * Applies an Extra Image Template bounding box (or custom padding) to a tile.
 */
export async function applyExtraTemplateToTile(
    image: CanvasImage,
    preset: ExtraTemplatePreset,
    gridType: GridType,
    customPalette?: RGB[] | null
): Promise<CanvasImage> {
    const palette = customPalette || getLoadedPalette() || (await loadDefaultPalette());
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const currentImg = await loadImage(image.src);
    if (!currentImg) return image;

    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = image.width;
    imgCanvas.height = image.height;
    const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true })!;
    imgCtx.imageSmoothingEnabled = false;
    imgCtx.drawImage(currentImg, 0, 0);

    const tmpFile = ensureTmpFileForCanvasImage(image.tmpBuffer, imgCanvas, config.width, config.height, palette);
    const prevOffsets = getTmpMinOffsets(tmpFile);

    tmpFile.tiles = tmpFile.tiles.map((tile) => {
        if (!tile) return null;
        const h = tile.header;
        const mult = tile.cy / 2;
        const elev = h.height * mult;

        const targetMinX = h.x - preset.padLeft;
        const targetMaxX = h.x + tile.cx + preset.padRight;
        const targetMinY = h.y - elev - preset.padTop;
        const targetMaxY = h.y - elev + tile.cy + preset.padBottom;

        let newCxExtra = targetMaxX - targetMinX;
        let newCyExtra = targetMaxY - targetMinY;
        if (newCxExtra % 2 !== 0) newCxExtra++;
        if (newCyExtra % 2 !== 0) newCyExtra++;

        const newExtraImg = new Uint8Array(newCxExtra * newCyExtra);

        if (h.has_extra_data && tile.extraImageData && h.cx_extra > 0 && h.cy_extra > 0) {
            const oldMinX = h.x_extra;
            const oldMinY = h.y_extra - elev;
            for (let oy = 0; oy < h.cy_extra; oy++) {
                for (let ox = 0; ox < h.cx_extra; ox++) {
                    const val = tile.extraImageData[oy * h.cx_extra + ox];
                    if (val !== 0) {
                        const nx = oldMinX + ox - targetMinX;
                        const ny = oldMinY + oy - targetMinY;
                        if (nx >= 0 && nx < newCxExtra && ny >= 0 && ny < newCyExtra) {
                            newExtraImg[ny * newCxExtra + nx] = val;
                        }
                    }
                }
            }
        }

        const newXExtra = targetMinX;
        const newYExtra = targetMinY + elev;
        const relX = newXExtra - h.x;
        const newExtraZ = generateExtraImageZData(
            newCxExtra,
            newCyExtra,
            newExtraImg,
            relX,
            tile.cx,
            tile.cy,
            'blit_cpp_gradient'
        );

        return repairTileExtraAndBaseZ({
            ...tile,
            extraImageData: newExtraImg,
            extraZData: newExtraZ,
            header: {
                ...h,
                has_extra_data: true,
                has_z_data: true,
                flags: h.flags | 0x01 | 0x02,
                x_extra: newXExtra,
                y_extra: newYExtra,
                cx_extra: newCxExtra,
                cy_extra: newCyExtra,
            },
        });
    });

    return buildUpdatedCanvasImageFromTmp(image, tmpFile, palette, {
        prevCanvas: imgCanvas,
        prevRawMinX: prevOffsets.rawMinX,
        prevRawMinY: prevOffsets.rawMinY,
    });
}

/**
 * Repairs Z-Data & Extra Z-Data on a tile or strips its Extra Image cleanly.
 */
export async function modifyTileExtraState(
    image: CanvasImage,
    action: 'repair_z' | 'remove_extra',
    gridType: GridType,
    customPalette?: RGB[] | null
): Promise<CanvasImage> {
    const palette = customPalette || getLoadedPalette() || (await loadDefaultPalette());
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const currentImg = await loadImage(image.src);
    if (!currentImg) return image;

    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = image.width;
    imgCanvas.height = image.height;
    const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true })!;
    imgCtx.imageSmoothingEnabled = false;
    imgCtx.drawImage(currentImg, 0, 0);

    const tmpFile = ensureTmpFileForCanvasImage(image.tmpBuffer, imgCanvas, config.width, config.height, palette);
    const prevOffsets = getTmpMinOffsets(tmpFile);

    tmpFile.tiles = tmpFile.tiles.map((tile) => {
        if (!tile) return null;
        if (action === 'remove_extra') {
            return repairTileExtraAndBaseZ({
                ...tile,
                extraImageData: null,
                extraZData: null,
                header: {
                    ...tile.header,
                    has_extra_data: false,
                    flags: tile.header.flags & ~0x01,
                    x_extra: 0,
                    y_extra: 0,
                    cx_extra: 0,
                    cy_extra: 0,
                },
            });
        }
        return repairTileExtraAndBaseZ(tile);
    });

    return buildUpdatedCanvasImageFromTmp(image, tmpFile, palette, {
        prevCanvas: imgCanvas,
        prevRawMinX: prevOffsets.rawMinX,
        prevRawMinY: prevOffsets.rawMinY,
    });
}
