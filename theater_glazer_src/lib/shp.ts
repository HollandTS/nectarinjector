import { RGB } from './formats';
import { scaleShpFile } from './shpResizer';
import type { TargetEngine } from './tileResizer';

export interface ShpFrame {
    x: number;
    y: number;
    w: number;
    h: number;
    flags: number;
    fileOffset: number;
    data: Uint8Array; // Decoded uncompressed 8-bit index array of size w * h
    isShadow: boolean; // Detected if it is a shadow frame (only uses index 1 and transparency 0)
}

export interface ShpFile {
    width: number;
    height: number;
    frames: ShpFrame[];
    type: 'SHP';
    sourceType?: 'TS' | 'RA2' | 'OpenTS' | 'OpenTS_48x96'; // To keep track of whether it is scaled
}

export { detectFileType } from './tmpDetector';

function isFrameShadow(data: Uint8Array): boolean {
    let hasPixels = false;
    for (let i = 0; i < data.length; i++) {
        if (data[i] !== 0) {
            if (data[i] !== 1) return false;
            hasPixels = true;
        }
    }
    return hasPixels;
}

export class ShpParser {
    static parseShp(buffer: ArrayBuffer, filename: string = ''): ShpFile {
        if (buffer.byteLength < 8) {
            throw new Error('File too small to be an SHP file.');
        }
        const dv = new DataView(buffer);
        const u8 = new Uint8Array(buffer);

        const headerType = dv.getUint16(0, true);
        const width = dv.getUint16(2, true);
        const height = dv.getUint16(4, true);
        const numFrames = dv.getUint16(6, true);

        const frames: ShpFrame[] = [];

        for (let i = 0; i < numFrames; i++) {
            const hOffset = 8 + i * 24;
            const x = dv.getUint16(hOffset, true);
            const y = dv.getUint16(hOffset + 2, true);
            const w = dv.getUint16(hOffset + 4, true);
            const h = dv.getUint16(hOffset + 6, true);
            const flags = dv.getUint32(hOffset + 8, true);
            const fileOffset = dv.getUint32(hOffset + 20, true);

            let data = new Uint8Array(w * h);
            const compression = flags & 0x03;

            if (compression === 3) {
                // RLE Zero / Format 80
                data = decodeRLEZero(u8, fileOffset, w, h);
            } else if (compression === 0) {
                // Uncompressed
                if (fileOffset + w * h <= buffer.byteLength) {
                    data = u8.slice(fileOffset, fileOffset + w * h);
                }
            } else {
                console.warn(`[SHP Parser] Unsupported compression flag ${compression} at frame ${i}.`);
            }

            const isShadow = isFrameShadow(data);

            frames.push({
                x,
                y,
                w,
                h,
                flags,
                fileOffset,
                data,
                isShadow
            });
        }

        // Guess sourceType of SHP based on name/extension
        // Or default to 'TS' usually, which can be modified under conversion
        let sourceType: 'TS' | 'RA2' = 'TS';
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('urb') || lowerName.includes('des') || lowerName.includes('sno')) {
            sourceType = 'RA2';
        }

        return {
            width,
            height,
            frames,
            type: 'SHP',
            sourceType
        };
    }

    static writeShp(shp: ShpFile): ArrayBuffer {
        const numFrames = shp.frames.length;
        const frameHeadersSize = numFrames * 24;
        const baseHeaderSize = 8;
        let dataPayloadSize = 0;

        // Pre-compute dynamic buffer allocations for each compressed frame
        const encodedFrames: Uint8Array[] = [];

        shp.frames.forEach(frame => {
            const encoded = encodeRLEZero(frame.data, frame.w, frame.h);
            encodedFrames.push(encoded);
            dataPayloadSize += encoded.length;
        });

        const totalSize = baseHeaderSize + frameHeadersSize + dataPayloadSize;
        const buffer = new ArrayBuffer(totalSize);
        const dv = new DataView(buffer);
        const u8 = new Uint8Array(buffer);

        // Global Header
        dv.setUint16(0, 0, true);
        dv.setUint16(2, shp.width, true);
        dv.setUint16(4, shp.height, true);
        dv.setUint16(6, numFrames, true);

        let currentDataOffset = baseHeaderSize + frameHeadersSize;

        // Write Frame Headers and Payload
        for (let i = 0; i < numFrames; i++) {
            const frame = shp.frames[i];
            const hOffset = baseHeaderSize + i * 24;
            const encoded = encodedFrames[i];

            // Header fields
            dv.setUint16(hOffset, frame.x, true);
            dv.setUint16(hOffset + 2, frame.y, true);
            dv.setUint16(hOffset + 4, frame.w, true);
            dv.setUint16(hOffset + 6, frame.h, true);
            dv.setUint32(hOffset + 8, 3, true); // Force Format 80 compression flag
            dv.setUint32(hOffset + 12, 0, true);
            dv.setUint32(hOffset + 16, 0, true);
            dv.setUint32(hOffset + 20, currentDataOffset, true);

            // Copy payload
            u8.set(encoded, currentDataOffset);
            currentDataOffset += encoded.length;
        }

        return buffer;
    }

    static scaleShp(shp: ShpFile, target: TargetEngine): ShpFile {
        return scaleShpFile(shp, target);
    }

    static renderFrameToCanvas(canvas: HTMLCanvasElement, frame: ShpFrame, globalWidth: number, globalHeight: number, palette: RGB[]) {
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Palette translation (little-endian: ABGR colors in uint32 representation)
        const p32 = new Uint32Array(256);
        for (let j = 0; j < 256; j++) {
            const c = palette[j] || { r: 0, g: 0, b: 0 };
            p32[j] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
        }

        // Draw within frame dimensions on the canvas
        canvas.width = frame.w;
        canvas.height = frame.h;

        const imgData = ctx.createImageData(frame.w, frame.h);
        const data32 = new Uint32Array(imgData.data.buffer);

        for (let i = 0; i < frame.data.length; i++) {
            const idx = frame.data[i];
            if (idx === 0) {
                data32[i] = 0;
            } else if (frame.isShadow) {
                // If detected as shadow frame, strictly retain shadow index 1 mapping
                data32[i] = p32[1];
            } else {
                data32[i] = p32[idx];
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }

    static renderShpCompleteToCanvas(canvas: HTMLCanvasElement, shp: ShpFile, frameIndex: number, palette: RGB[]) {
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        canvas.width = shp.width;
        canvas.height = shp.height;
        ctx.clearRect(0, 0, shp.width, shp.height);

        const frame = shp.frames[frameIndex];
        if (!frame) return;

        // Sub canvas for frame image before overlaying
        const subCanvas = document.createElement('canvas');
        this.renderFrameToCanvas(subCanvas, frame, shp.width, shp.height, palette);

        // Project centered on global stage using bounding offsets
        ctx.drawImage(subCanvas, frame.x, frame.y);
    }
}

function decodeRLEZero(fileData: Uint8Array, dataOffset: number, w: number, h: number): Uint8Array {
    const out = new Uint8Array(w * h);
    out.fill(0);

    if (dataOffset === 0 || w <= 0 || h <= 0) return out;

    let currentReadOffset = 0;
    const totalLen = fileData.length;

    for (let y = 0; y < h; y++) {
        const lineStart = dataOffset + currentReadOffset;
        if (lineStart + 2 > totalLen) break;

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
                x += count;
            } else {
                out[lineOffset + x] = val;
                x++;
                curByte++;
            }
        }
        currentReadOffset += lineLen;
    }
    return out;
}

function encodeRLEZero(indices: Uint8Array, w: number, h: number): Uint8Array {
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
        lineBuffer[0] = lineLen & 0xFF;
        lineBuffer[1] = (lineLen >> 8) & 0xFF;
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
