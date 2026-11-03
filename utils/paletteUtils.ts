
import type { CanvasImage, RgbaColor } from '../types';
import { rgbToHsl } from './colorUtils';

export interface PaletteColor extends RgbaColor {
    h: number;
    s: number;
    l: number;
}

export const extractPaletteFromImages = async (images: CanvasImage[]): Promise<PaletteColor[]> => {
    const colorMap = new Map<string, PaletteColor>();
    
    for (const image of images) {
        await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Use full resolution to avoid interpolation artifacts
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    resolve();
                    return;
                }
                
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                
                // Sample pixels to keep it fast, but don't interpolate
                const step = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 10000)));
                
                for (let y = 0; y < canvas.height; y += step) {
                    for (let x = 0; x < canvas.width; x += step) {
                        const i = (y * canvas.width + x) * 4;
                        const a = data[i + 3];
                        if (a < 128) continue; // Skip transparent
                        
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
                        const key = `${r},${g},${b}`;
                        if (!colorMap.has(key)) {
                            const { h, s, l } = rgbToHsl(r, g, b);
                            colorMap.set(key, { r, g, b, a: 1, h, s, l });
                        }
                    }
                }
                resolve();
            };
            img.onerror = () => resolve();
            img.src = image.src;
        });
    }
    
    const colors = Array.from(colorMap.values());
    
    // If more than 256 colors, we should probably just take the first 256 unique ones found
    // or we could do something more complex, but "limit them by 256" suggests a simple cap.
    const limitedColors = colors.slice(0, 256);
    
    // Sort by Hue, then by Lightness
    return limitedColors.sort((a, b) => {
        if (Math.abs(a.h - b.h) > 10) return a.h - b.h;
        return a.l - b.l;
    });
};
