import { loadImage } from './textureInjection';
import { removeFakeTransparency } from './transparencyUtils';
import type { RgbaColor } from '../types';

export const downloadCleanPng = async (
    src: string,
    filename: string,
    keyColor?: RgbaColor | null,
    tolerance?: number
) => {
    try {
        const img = await loadImage(src);
        if (!img) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        const cleanCanvas = removeFakeTransparency(canvas, keyColor, tolerance ?? 30);
        const link = document.createElement('a');
        link.href = cleanCanvas.toDataURL('image/png');
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Download failed:", e);
    }
};
