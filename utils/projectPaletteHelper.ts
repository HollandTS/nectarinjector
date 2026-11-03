import type { PaletteColor } from './westwoodPaletteParser';
import type { CanvasImage } from '../types';
import { parseTmpFile, renderTmpToPng, getTmpMinOffsets } from './westwoodTmpParser';

/**
 * Serializes a 256-color palette to standard ASCII JASC-PAL format.
 */
export function serializePaletteToJasc(palette: PaletteColor[]): string {
    const lines = ["JASC-PAL", "0100", "256"];
    for (let i = 0; i < 256; i++) {
        const c = palette[i] || { r: 0, g: 0, b: 0 };
        lines.push(`${Math.max(0, Math.min(255, Math.round(c.r)))} ${Math.max(0, Math.min(255, Math.round(c.g)))} ${Math.max(0, Math.min(255, Math.round(c.b)))}`);
    }
    return lines.join("\r\n");
}

/**
 * Serializes a 256-color palette to standard 768-byte raw Westwood binary format (6-bit depth).
 */
export function serializePaletteToRaw(palette: PaletteColor[]): Uint8Array {
    const raw = new Uint8Array(768);
    for (let i = 0; i < 256; i++) {
        const c = palette[i] || { r: 0, g: 0, b: 0 };
        raw[i * 3] = Math.max(0, Math.min(63, Math.floor(c.r / 4)));
        raw[i * 3 + 1] = Math.max(0, Math.min(63, Math.floor(c.g / 4)));
        raw[i * 3 + 2] = Math.max(0, Math.min(63, Math.floor(c.b / 4)));
    }
    return raw;
}

/**
 * Re-renders any CanvasImages that contain Westwood .tmp buffers using the given palette.
 */
export function reRenderTmpImagesWithPalette(images: CanvasImage[], palette: PaletteColor[]): CanvasImage[] {
    return images.map(img => {
        const hasValidTmpBuffer = img.tmpBuffer && (img.tmpBuffer instanceof ArrayBuffer || (img.tmpBuffer as any).buffer instanceof ArrayBuffer);
        if (hasValidTmpBuffer) {
            try {
                const parsedTmp = parseTmpFile(img.tmpBuffer);
                const rendered = renderTmpToPng(parsedTmp, palette);
                const offsets = getTmpMinOffsets(parsedTmp);
                return {
                    ...img,
                    src: rendered.src,
                    originalSrc: rendered.src,
                    width: rendered.width,
                    height: rendered.height,
                    tmpMinX: offsets.minX,
                    tmpMinY: offsets.minY,
                    tmpCols: offsets.cols,
                    tmpRows: offsets.rows,
                    tmpCells: offsets.cells
                };
            } catch (e: any) {
                console.error(`Failed to re-render tile ${img.name} with palette:`, e);
            }
        }
        return img;
    });
}
