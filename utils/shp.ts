import type { PaletteColor } from './westwoodPaletteParser';
import { getLoadedPalette } from './paletteViewerHelper';
import { loadDefaultPalette } from './westwoodTmpParser';

export interface ShpFrame {
    x: number;          // X offset on global canvas
    y: number;          // Y offset on global canvas
    w: number;          // Frame width
    h: number;          // Frame height
    flags?: number;     // Compression flags (0 = raw, 2 = RLE, 3 = Format 80 RLE Zero)
    fileOffset?: number;// Byte offset in file
    data: Uint8Array;   // w * h uncompressed 8-bit palette indices
    isShadow?: boolean; // Optional shadow indicator
}

export interface ShpFile {
    width: number;      // Global canvas width
    height: number;     // Global canvas height
    frames: ShpFrame[];
    type?: 'SHP';
    sourceType?: 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96';
}

/**
 * Decodes a Format 80 (RLE Zero, compression mode = 3) SHP frame row-by-row.
 * Matches Section 3 of `shp_specification_handbook.txt`.
 */
export function decodeRLEZero(
    fileData: Uint8Array,
    dataOffset: number,
    w: number,
    h: number
): Uint8Array {
    const out = new Uint8Array(w * h);
    out.fill(0); // Initialize everything to index 0 (transparency)

    let currentReadOffset = 0;
    const totalLen = fileData.length;

    for (let y = 0; y < h; y++) {
        const lineStart = dataOffset + currentReadOffset;
        if (lineStart + 2 > totalLen) break;

        // Line length is saved as 16-bit integer (little-endian), includes the 2 length bytes
        const lineLen = fileData[lineStart] | (fileData[lineStart + 1] << 8);
        if (lineLen < 2 || lineStart + lineLen > totalLen) break;

        let curByte = 2;
        let x = 0;
        const lineOffset = y * w;

        while (curByte < lineLen && x < w) {
            const val = fileData[lineStart + curByte];
            if (val === 0) {
                if (curByte + 1 >= lineLen) break;
                const count = fileData[lineStart + curByte + 1];
                curByte += 2;
                x += count; // Skip 'count' empty transparent pixels (staying value 0)
            } else {
                out[lineOffset + x] = val; // Direct color mapping
                x++;
                curByte++;
            }
        }
        currentReadOffset += lineLen;
    }

    return out;
}

/**
 * Encodes a 1D array of 8-bit palette indices into Format 80 (RLE Zero).
 * Matches Section 4 of `shp_specification_handbook.txt`.
 */
export function encodeRLEZero(indices: Uint8Array, w: number, h: number): Uint8Array {
    const lines: Uint8Array[] = [];
    let totalPayloadSize = 0;

    for (let y = 0; y < h; y++) {
        const lineBytes: number[] = [];
        let x = 0;
        const lineOffset = y * w;

        while (x < w) {
            const val = indices[lineOffset + x];
            if (val === 0) {
                let count = 0;
                while (x < w && indices[lineOffset + x] === 0 && count < 255) {
                    count++;
                    x++;
                }
                lineBytes.push(0);
                lineBytes.push(count);
            } else {
                lineBytes.push(val);
                x++;
            }
        }

        const lineLen = lineBytes.length + 2;
        const lineBuffer = new Uint8Array(lineLen);
        lineBuffer[0] = lineLen & 0xff;
        lineBuffer[1] = (lineLen >> 8) & 0xff;
        for (let i = 0; i < lineBytes.length; i++) {
            lineBuffer[2 + i] = lineBytes[i];
        }

        lines.push(lineBuffer);
        totalPayloadSize += lineLen;
    }

    const output = new Uint8Array(totalPayloadSize);
    let ptr = 0;
    for (const ln of lines) {
        output.set(ln, ptr);
        ptr += ln.length;
    }
    return output;
}

/**
 * Checks whether an ArrayBuffer is a valid TS/RA2/OpenTS Format 80 SHP file
 * (regardless of its file extension, e.g. .shp, .tem, .sno, .urb, .ubn, .des, .lun).
 */
export function isValidShpBuffer(buffer: ArrayBuffer): boolean {
    if (!buffer || buffer.byteLength < 8 + 24) return false;
    const dv = new DataView(buffer);
    const headerType = dv.getUint16(0, true);
    const globalW = dv.getUint16(2, true);
    const globalH = dv.getUint16(4, true);
    const numFrames = dv.getUint16(6, true);

    if (headerType !== 0) return false;
    if (globalW === 0 || globalW > 4096 || globalH === 0 || globalH > 4096) return false;
    if (numFrames === 0 || numFrames > 4096) return false;

    const minFileSize = 8 + numFrames * 24;
    if (buffer.byteLength < minFileSize) return false;

    // Validate first non-empty frame header
    for (let i = 0; i < Math.min(numFrames, 8); i++) {
        const hOff = 8 + i * 24;
        const fw = dv.getUint16(hOff + 4, true);
        const fh = dv.getUint16(hOff + 6, true);
        const fileOffset = dv.getUint32(hOff + 20, true);

        if (fw > 4096 || fh > 4096) return false;
        if (fw > 0 && fh > 0 && fileOffset > 0 && fileOffset >= buffer.byteLength) {
            return false;
        }
    }

    return true;
}

/**
 * Parses a TS/RA2/OpenTS Format 80 SHP binary buffer into a ShpFile structure.
 * Automatically handles uncompressed (mode 0), scanline RLE (mode 2), and RLE Zero (mode 3),
 * as well as the 2-half normal + shadow frame convention.
 */
export function parseShpBuffer(buffer: ArrayBuffer): ShpFile | null {
    if (!isValidShpBuffer(buffer)) return null;

    const dv = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    const width = dv.getUint16(2, true);
    const height = dv.getUint16(4, true);
    const numFrames = dv.getUint16(6, true);

    const frames: ShpFrame[] = [];
    const halfCount = numFrames >= 2 && numFrames % 2 === 0 ? numFrames / 2 : numFrames;

    for (let i = 0; i < numFrames; i++) {
        const hOffset = 8 + i * 24;
        const x = dv.getUint16(hOffset, true);
        const y = dv.getUint16(hOffset + 2, true);
        const w = dv.getUint16(hOffset + 4, true);
        const h = dv.getUint16(hOffset + 6, true);
        const flags = dv.getUint32(hOffset + 8, true);
        const fileOffset = dv.getUint32(hOffset + 20, true);

        const compressionMode = flags & 0x03;
        let data: Uint8Array;

        if (w === 0 || h === 0 || fileOffset === 0 || fileOffset >= u8.length) {
            data = new Uint8Array(Math.max(1, w * h));
        } else if (compressionMode === 3) {
            // Format 80 RLE Zero
            data = decodeRLEZero(u8, fileOffset, w, h);
        } else if (compressionMode === 2) {
            // Format 40 / scanline RLE with length prefix
            data = decodeRLEZero(u8, fileOffset, w, h);
        } else {
            // Mode 0 / Uncompressed raw 8-bit index array
            data = new Uint8Array(w * h);
            const available = Math.min(w * h, u8.length - fileOffset);
            if (available > 0) {
                data.set(u8.subarray(fileOffset, fileOffset + available));
            }
        }

        frames.push({
            x,
            y,
            w,
            h,
            flags,
            fileOffset,
            data,
            isShadow: numFrames >= 2 && numFrames % 2 === 0 && i >= halfCount,
        });
    }

    return {
        width,
        height,
        frames,
        type: 'SHP',
    };
}

/**
 * Resolves the active 256-color palette for an SHP brush:
 * 1. Custom .pal loaded specifically for this SHP (`shpCustomPalette`)
 * 2. Globally loaded project palette (`getLoadedPalette()`)
 * 3. Default `isotem.pal` (`loadDefaultPalette()`)
 */
export async function resolveShpBrushPalette(
    shpCustomPalette?: PaletteColor[] | null
): Promise<PaletteColor[]> {
    if (shpCustomPalette && shpCustomPalette.length > 0) {
        return shpCustomPalette;
    }
    const loaded = getLoadedPalette();
    if (loaded && loaded.length > 0) {
        return loaded;
    }
    return await loadDefaultPalette();
}

export interface RenderedShpStampPair {
    normalCanvas: HTMLCanvasElement;
    shadowCanvas: HTMLCanvasElement | null;
    combinedPreviewDataUrl: string;
    globalWidth: number;
    globalHeight: number;
    normalFrameCount: number;
    hasShadowHalf: boolean;
}

/**
 * Renders the selected SHP normal frame (`frameIndex`) and its paired shadow frame
 * (`frameIndex + normalFrameCount`) onto full global-canvas surfaces (`shp.width x shp.height`)
 * using exact frame offsets `(frame.x, frame.y)` so frames never wobble or drift.
 *
 * Also returns a combined preview DataURL (including shadow) for thumbnails and cursors.
 */
export function renderShpFramePair(
    shp: ShpFile,
    frameIndex: number,
    palette: PaletteColor[],
    options?: {
        hasShadowHalf?: boolean;
        includeShadowInPreview?: boolean;
        shadowOpacity?: number; // 0..100
        shadowOffsetX?: number;
        shadowOffsetY?: number;
    }
): RenderedShpStampPair {
    const totalFrames = shp.frames.length;
    const hasShadowHalf =
        options?.hasShadowHalf !== undefined
            ? options.hasShadowHalf
            : totalFrames >= 2 && totalFrames % 2 === 0;
    const normalFrameCount = hasShadowHalf ? Math.max(1, Math.floor(totalFrames / 2)) : Math.max(1, totalFrames);

    const safeIdx = Math.max(0, Math.min(normalFrameCount - 1, frameIndex));
    const normalFrame = shp.frames[safeIdx];
    const shadowFrame = hasShadowHalf ? shp.frames[safeIdx + normalFrameCount] : undefined;

    const globalW = Math.max(1, shp.width || (normalFrame ? normalFrame.x + normalFrame.w : 48));
    const globalH = Math.max(1, shp.height || (normalFrame ? normalFrame.y + normalFrame.h : 48));

    // 1. Render Normal Frame onto Global Canvas
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = globalW;
    normalCanvas.height = globalH;
    const nCtx = normalCanvas.getContext('2d', { willReadFrequently: true });

    if (nCtx && normalFrame && normalFrame.w > 0 && normalFrame.h > 0) {
        const imgData = nCtx.createImageData(globalW, globalH);
        const dst = imgData.data;

        for (let sy = 0; sy < normalFrame.h; sy++) {
            const dy = normalFrame.y + sy;
            if (dy < 0 || dy >= globalH) continue;
            const srcRow = sy * normalFrame.w;
            for (let sx = 0; sx < normalFrame.w; sx++) {
                const dx = normalFrame.x + sx;
                if (dx < 0 || dx >= globalW) continue;
                const palIdx = normalFrame.data[srcRow + sx];
                if (palIdx === 0) continue; // Index 0 is strict transparency

                const col = palette[palIdx] || { r: 255, g: 0, b: 255 };
                const dOff = (dy * globalW + dx) * 4;
                dst[dOff] = col.r;
                dst[dOff + 1] = col.g;
                dst[dOff + 2] = col.b;
                dst[dOff + 3] = 255;
            }
        }
        nCtx.putImageData(imgData, 0, 0);
    }

    // 2. Render Shadow Frame Mask onto Global Canvas
    // In TS/RA2 SHPs, shadow frames reside in the second half of the frame table,
    // and shadow pixels use non-zero index (conventionally index #1, 2nd color of the .pal).
    // Also check if the normal frame itself contains index #1 shadow pixels when there's only 1 frame.
    let shadowCanvas: HTMLCanvasElement | null = null;
    const sOffX = options?.shadowOffsetX ?? 0;
    const sOffY = options?.shadowOffsetY ?? 0;

    if (shadowFrame && shadowFrame.w > 0 && shadowFrame.h > 0) {
        shadowCanvas = document.createElement('canvas');
        shadowCanvas.width = globalW;
        shadowCanvas.height = globalH;
        const sCtx = shadowCanvas.getContext('2d', { willReadFrequently: true });
        if (sCtx) {
            const sImgData = sCtx.createImageData(globalW, globalH);
            const sDst = sImgData.data;
            // Palette index #1 is the 2nd color of the palette
            const palShadowCol = palette[1] || { r: 0, g: 0, b: 0 };

            for (let sy = 0; sy < shadowFrame.h; sy++) {
                const dy = shadowFrame.y + sy + sOffY;
                if (dy < 0 || dy >= globalH) continue;
                const srcRow = sy * shadowFrame.w;
                for (let sx = 0; sx < shadowFrame.w; sx++) {
                    const dx = shadowFrame.x + sx + sOffX;
                    if (dx < 0 || dx >= globalW) continue;
                    const palIdx = shadowFrame.data[srcRow + sx];
                    if (palIdx === 0) continue; // Transparent

                    const dOff = (dy * globalW + dx) * 4;
                    sDst[dOff] = palShadowCol.r;
                    sDst[dOff + 1] = palShadowCol.g;
                    sDst[dOff + 2] = palShadowCol.b;
                    sDst[dOff + 3] = 255; // Full mask alpha; strength is applied during darkening
                }
            }
            sCtx.putImageData(sImgData, 0, 0);
        }
    }

    // 3. Create Combined Preview DataURL for UI thumbnail
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = globalW;
    previewCanvas.height = globalH;
    const pCtx = previewCanvas.getContext('2d');
    if (pCtx) {
        if (shadowCanvas && (options?.includeShadowInPreview ?? true)) {
            pCtx.save();
            pCtx.globalAlpha = Math.max(0.15, Math.min(0.85, (options?.shadowOpacity ?? 55) / 100));
            pCtx.drawImage(shadowCanvas, 0, 0);
            pCtx.restore();
        }
        pCtx.drawImage(normalCanvas, 0, 0);
    }

    return {
        normalCanvas,
        shadowCanvas,
        combinedPreviewDataUrl: previewCanvas.toDataURL('image/png'),
        globalWidth: globalW,
        globalHeight: globalH,
        normalFrameCount,
        hasShadowHalf,
    };
}
