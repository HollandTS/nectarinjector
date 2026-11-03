import type { RgbaColor } from '../types';
import { colorDistance } from './colorUtils';

/**
 * Clean fake transparency (checkerboard background patterns or key colors)
 * from a canvas element, returning a new canvas with real alpha transparency.
 */
export const removeFakeTransparency = (
    inputCanvas: HTMLCanvasElement,
    keyColor?: RgbaColor | null,
    tolerance: number = 30
): HTMLCanvasElement => {
    const w = inputCanvas.width;
    const h = inputCanvas.height;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = w;
    outputCanvas.height = h;
    const ctx = outputCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(inputCanvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // 1. First pass: Apply key color transparency if specified
    if (keyColor) {
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const dist = colorDistance(keyColor, { r: data[i], g: data[i + 1], b: data[i + 2] });
            if (dist <= tolerance) {
                data[i + 3] = 0;
            }
        }
    }

    // 2. Second pass: Detect and remove fake transparency checkerboard patterns
    // Sample corners and borders
    const sampleIndices = [
        0, // top-left
        (w - 1) * 4, // top-right
        ((h - 1) * w) * 4, // bottom-left
        ((h - 1) * w + w - 1) * 4, // bottom-right
        (Math.floor(h / 2) * w) * 4, // mid-left
        (Math.floor(h / 2) * w + w - 1) * 4, // mid-right
        (Math.floor(w / 2)) * 4, // top-mid
        ((h - 1) * w + Math.floor(w / 2)) * 4 // bottom-mid
    ];

    const sampledColors: { r: number; g: number; b: number }[] = [];
    for (const idx of sampleIndices) {
        if (data[idx + 3] > 0) {
            sampledColors.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
        }
    }

    const isNeutralLight = (c: { r: number; g: number; b: number }) => {
        const isMono = Math.abs(c.r - c.g) < 15 && Math.abs(c.g - c.b) < 15;
        return isMono && c.r > 160;
    };

    const neutralLightColors = sampledColors.filter(isNeutralLight);

    if (neutralLightColors.length >= 2) {
        // Detect checkerboard grid sizes (4, 8, 10, 12, 16, 20, 24, 32)
        const gridSizes = [4, 8, 10, 12, 16, 20, 24, 32];
        let detectedGridSize = 0;
        let c1 = { r: 255, g: 255, b: 255 };
        let c2 = { r: 204, g: 204, b: 204 };

        for (const sz of gridSizes) {
            let samples = 0;
            for (let x = 0; x < Math.min(w, 120); x++) {
                const idx = x * 4;
                if (data[idx + 3] === 0) continue;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                if (!isNeutralLight({ r, g, b })) continue;

                const gridPos = Math.floor(x / sz) % 2;
                if (x === 0) {
                    c1 = { r, g, b };
                } else if (gridPos === 1 && Math.abs(r - c1.r) > 15) {
                    c2 = { r, g, b };
                }
                samples++;
            }
            if (samples > 10 && Math.abs(c1.r - c2.r) > 15) {
                detectedGridSize = sz;
                break;
            }
        }

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = (y * w + x) * 4;
                if (data[idx + 3] === 0) continue;

                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                const isMono = Math.abs(r - g) < 12 && Math.abs(g - b) < 12;
                if (!isMono) continue;

                const d1 = Math.hypot(r - c1.r, g - c1.g, b - c1.b);
                const d2 = Math.hypot(r - c2.r, g - c2.g, b - c2.b);
                const isWhite = r > 235 && g > 235 && b > 235;
                const isGrey = r > 170 && r < 230 && Math.abs(r - g) < 8 && Math.abs(g - b) < 8;

                if (d1 < 25 || d2 < 25 || isWhite || isGrey) {
                    if (detectedGridSize > 0) {
                        const cellX = Math.floor(x / detectedGridSize);
                        const cellY = Math.floor(y / detectedGridSize);
                        const isEven = (cellX + cellY) % 2 === 0;
                        if ((isEven && (d1 < 30 || isWhite)) || (!isEven && (d2 < 30 || isGrey))) {
                            data[idx + 3] = 0;
                        }
                    } else if (isWhite || isGrey) {
                        data[idx + 3] = 0;
                    }
                }
            }
        }
    } else {
        // Fallback: Check if image has NO transparency at all, and clear white/grey checkerboard background pixels
        let hasTransparent = false;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) {
                hasTransparent = true;
                break;
            }
        }

        if (!hasTransparent) {
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const isWhite = r > 240 && g > 240 && b > 240;
                const isGrey = r > 180 && r < 225 && Math.abs(r - g) < 5 && Math.abs(g - b) < 5;
                if ((isWhite || isGrey) && Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
                    data[i + 3] = 0;
                }
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return outputCanvas;
};
