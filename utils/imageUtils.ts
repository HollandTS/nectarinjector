
import { RgbaColor } from '../types';
import { processKeyColorTransparency } from './transparencyKeyHelper';

export const processTransparency = (img: HTMLImageElement, keyColor: RgbaColor | null, tolerance: number = 1): HTMLCanvasElement => {
    return processKeyColorTransparency(img, keyColor, tolerance);
};

export const sliceImageInto4 = async (base64: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Could not get canvas context");

            const w = img.width / 2;
            const h = img.height / 2;
            canvas.width = w;
            canvas.height = h;
            ctx.imageSmoothingEnabled = false;

            const slices: string[] = [];
            
            // Top Left
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
            slices.push(canvas.toDataURL('image/png'));

            // Top Right
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, w, 0, w, h, 0, 0, w, h);
            slices.push(canvas.toDataURL('image/png'));

            // Bottom Left
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, h, w, h, 0, 0, w, h);
            slices.push(canvas.toDataURL('image/png'));

            // Bottom Right
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, w, h, w, h, 0, 0, w, h);
            slices.push(canvas.toDataURL('image/png'));

            resolve(slices);
        };
        img.onerror = reject;
        img.src = base64;
    });
};
