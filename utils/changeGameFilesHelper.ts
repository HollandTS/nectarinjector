import type { CanvasImage, RgbaColor } from '../types';
import {
    isValidWwPal,
    parsePalFile,
    isValidWwTmp,
    parseTmpFile,
    renderTmpToPng,
    getTmpMinOffsets,
    loadDefaultPalette,
    PaletteColor,
} from './westwoodTmpParser';
import { setLoadedPalette, getLoadedPalette } from './paletteViewerHelper';
import { reRenderTmpImagesWithPalette } from './projectPaletteHelper';
import { processTransparency } from './imageUtils';

export interface ParsedReplacementTile {
    baseKey: string;
    fileName: string;
    src: string;
    originalSrc: string;
    width: number;
    height: number;
    tmpBuffer?: ArrayBuffer;
    tmpMinX?: number;
    tmpMinY?: number;
    tmpCols?: number;
    tmpRows?: number;
    tmpCells?: { col: number; row: number; height: number; rampType: number }[];
}

/**
 * Strips directory path and file extension to get the lowercase base filename
 * (e.g., "cliff01.tem" -> "cliff01", "cliff01.urb" -> "cliff01").
 */
export function getTileBaseKey(fileName: string): string {
    const clean = (fileName || '').split(/[\\/]/).pop() || '';
    const lastDot = clean.lastIndexOf('.');
    return (lastDot > 0 ? clean.substring(0, lastDot) : clean).trim().toLowerCase();
}

/**
 * Processes a list of dropped/selected files (.tmp, .tem, .sno, .urb, .ubn, .des, .lun, .png, .pal, etc.)
 * into a map of replacement tiles keyed by their extension-agnostic base name (`baseKey`),
 * plus an optional newly detected `.pal` palette if one was dropped along with the files.
 */
export async function parseDroppedGameReplacementFiles(
    files: FileList | File[],
    transparencyColor: RgbaColor | null,
    tolerance: number,
    existingMap?: Map<string, ParsedReplacementTile>
): Promise<{
    replacementMap: Map<string, ParsedReplacementTile>;
    detectedPalette: PaletteColor[] | null;
    detectedPaletteName?: string;
}> {
    const map = new Map<string, ParsedReplacementTile>(existingMap || []);
    const fileArray = Array.from(files);

    const fileBuffers = await Promise.all(
        fileArray.map(
            (file) =>
                new Promise<{ file: File; buffer: ArrayBuffer }>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve({ file, buffer: (e.target?.result as ArrayBuffer) || new ArrayBuffer(0) });
                    reader.onerror = () => resolve({ file, buffer: new ArrayBuffer(0) });
                    reader.readAsArrayBuffer(file);
                })
        )
    );

    let detectedPalette: PaletteColor[] | null = null;
    let detectedPaletteName: string | undefined = undefined;

    const palEntry = fileBuffers.find((p) => isValidWwPal(p.buffer, p.file.name));
    if (palEntry) {
        try {
            detectedPalette = parsePalFile(palEntry.buffer);
            detectedPaletteName = palEntry.file.name;
            setLoadedPalette(detectedPalette, palEntry.file.name);
        } catch (err) {
            console.warn('Could not parse dropped palette file:', err);
        }
    }

    const activePalette =
        detectedPalette || getLoadedPalette() || (await loadDefaultPalette());

    // If a new palette was dropped, re-render any previously staged .tmp items in the map
    if (detectedPalette && map.size > 0) {
        for (const [k, item] of map.entries()) {
            if (item.tmpBuffer) {
                try {
                    const parsedTmp = parseTmpFile(item.tmpBuffer);
                    const rendered = renderTmpToPng(parsedTmp, detectedPalette);
                    const offsets = getTmpMinOffsets(parsedTmp);
                    map.set(k, {
                        ...item,
                        src: rendered.src,
                        originalSrc: rendered.src,
                        width: rendered.width,
                        height: rendered.height,
                        tmpMinX: offsets.minX,
                        tmpMinY: offsets.minY,
                        tmpCols: offsets.cols,
                        tmpRows: offsets.rows,
                        tmpCells: offsets.cells,
                    });
                } catch {
                    // Keep existing rendered src
                }
            }
        }
    }

    await Promise.all(
        fileBuffers.map(async ({ file, buffer }) => {
            if (!buffer || buffer.byteLength === 0) return;
            if (isValidWwPal(buffer, file.name)) return;

            const baseKey = getTileBaseKey(file.name);
            if (!baseKey) return;

            if (isValidWwTmp(buffer)) {
                try {
                    const parsedTmp = parseTmpFile(buffer);
                    const rendered = renderTmpToPng(parsedTmp, activePalette);
                    const offsets = getTmpMinOffsets(parsedTmp);
                    map.set(baseKey, {
                        baseKey,
                        fileName: file.name,
                        src: rendered.src,
                        originalSrc: rendered.src,
                        width: rendered.width,
                        height: rendered.height,
                        tmpBuffer: buffer,
                        tmpMinX: offsets.minX,
                        tmpMinY: offsets.minY,
                        tmpCols: offsets.cols,
                        tmpRows: offsets.rows,
                        tmpCells: offsets.cells,
                    });
                } catch (err) {
                    console.warn(`Failed parsing replacement TMP file ${file.name}:`, err);
                }
            } else {
                await new Promise<void>((resolve) => {
                    const blob = new Blob([buffer], { type: file.type || 'image/png' });
                    const blobUrl = URL.createObjectURL(blob);
                    const img = new Image();
                    img.onload = () => {
                        const origCanvas = document.createElement('canvas');
                        origCanvas.width = img.width;
                        origCanvas.height = img.height;
                        const origCtx = origCanvas.getContext('2d');
                        if (origCtx) {
                            origCtx.imageSmoothingEnabled = false;
                            origCtx.drawImage(img, 0, 0);
                        }
                        const rawDataUrl = origCanvas.toDataURL('image/png');
                        const processedCanvas = processTransparency(
                            img,
                            transparencyColor,
                            tolerance
                        );
                        const src = processedCanvas.toDataURL('image/png');
                        map.set(baseKey, {
                            baseKey,
                            fileName: file.name,
                            src,
                            originalSrc: rawDataUrl,
                            width: processedCanvas.width,
                            height: processedCanvas.height,
                        });
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        resolve();
                    };
                    img.src = blobUrl;
                });
            }
        })
    );

    return {
        replacementMap: map,
        detectedPalette,
        detectedPaletteName,
    };
}

/**
 * Applies the staged `ParsedReplacementTile` map onto the existing `CanvasImage[]` array.
 * Preserves each tile's `id`, `gridX`, `gridY`, `offsetX`, `offsetY`, `flipH`, `flipV`, `zOrder`, and `sceneGroupId`,
 * while swapping its `name` (including the new game extension like `.urb`), `src`, `width`, `height`, and `tmpBuffer`.
 */
export function applyGameFileReplacementsToImages(
    images: CanvasImage[],
    replacementMap: Map<string, ParsedReplacementTile>,
    detectedPalette?: PaletteColor[] | null
): CanvasImage[] {
    let nextImages = images.map((img) => {
        const key = getTileBaseKey(img.name);
        const rep = replacementMap.get(key);
        if (!rep) return img;

        return {
            ...img,
            name: rep.fileName,
            src: rep.src,
            originalSrc: rep.originalSrc,
            width: rep.width,
            height: rep.height,
            tmpBuffer: rep.tmpBuffer,
            tmpMinX: rep.tmpMinX,
            tmpMinY: rep.tmpMinY,
            tmpCols: rep.tmpCols,
            tmpRows: rep.tmpRows,
            tmpCells: rep.tmpCells,
        };
    });

    if (detectedPalette && detectedPalette.length > 0) {
        nextImages = reRenderTmpImagesWithPalette(nextImages, detectedPalette);
    }

    return nextImages;
}
