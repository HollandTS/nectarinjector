import { applySharpen, applyPixelFilters, applySmartColorSwap } from './imageEffects';
import { applyAdvancedEffects } from './filterEngine';
import { applyAllSmartSwaps } from './smartColorSwapHelper';
import { applyAllTileSwaps } from './tileColorMatchHelper';
import type { OverlayFilters } from '../types';

/**
 * Loads an image from a URL or source data into an HTMLImageElement safely.
 */
const loadImageElement = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error("Failed to load source image: " + e));
        img.src = src;
    });
};

/**
 * Renders the overlay image onto a temporary canvas, applies standard CSS filters
 * (blur, brightness, contrast, saturation, hue-rotate), sharpens if requested,
 * and outputs the result as a dataURL.
 */
export async function bakeColorFiltersToImageUrl(
    src: string,
    filters: Partial<OverlayFilters> & {
        blur: number;
        sharpen: number;
        brightness: number;
        contrast: number;
        saturation: number;
        hue: number;
    }
): Promise<string> {
    const img = await loadImageElement(src);
    
    // Capture original alpha channel to prevent CSS filters from bleeding into transparent areas
    const refCanvas = document.createElement('canvas');
    refCanvas.width = img.width;
    refCanvas.height = img.height;
    const refCtx = refCanvas.getContext('2d', { willReadFrequently: true });
    if (!refCtx) {
        throw new Error("Could not acquire reference 2D canvas context");
    }
    refCtx.drawImage(img, 0, 0);
    const originalData = refCtx.getImageData(0, 0, img.width, img.height);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error("Could not acquire 2D canvas context");
    }

    const isSmooth = filters.renderMode === 'smooth';
    ctx.imageSmoothingEnabled = isSmooth;
    if (isSmooth) {
        ctx.imageSmoothingQuality = 'high';
    }
    
    // Apply standard CSS filters
    ctx.filter = `blur(${filters.blur}px) brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) hue-rotate(${filters.hue}deg)`;
    ctx.drawImage(img, 0, 0);
    
    // Apply advanced sharpening / smoothing effects matching render pipeline
    applyAdvancedEffects(ctx, canvas.width, canvas.height, filters as OverlayFilters);
    
    // Restore the precise original alpha channel and zero-out fully transparent pixels
    const filteredData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < filteredData.data.length; i += 4) {
        filteredData.data[i + 3] = originalData.data[i + 3];
        if (originalData.data[i + 3] === 0) {
            filteredData.data[i] = 0;
            filteredData.data[i + 1] = 0;
            filteredData.data[i + 2] = 0;
        }
    }
    ctx.putImageData(filteredData, 0, 0);
    
    return canvas.toDataURL('image/png');
}

/**
 * Bakes normal multiple color swaps or smart color swaps directly onto an overlay image,
 * matching full preview settings and outputting the baked result as a dataURL.
 */
export async function bakeColorSwapsToOverlayImage(
    src: string,
    filters: any, // OverlayFilters
    swapType: 'smart' | 'normal' | 'tile' | 'all'
): Promise<string> {
    const img = await loadImageElement(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);

    if (swapType === 'normal' || swapType === 'all') {
        applyPixelFilters(canvas, {
            ...filters,
            smartColorSwapEnabled: false,
            smartColorSwaps: [],
            tileColorSwaps: []
        });
    }

    if (swapType === 'smart' || swapType === 'all') {
        if (filters.smartColorSwaps && filters.smartColorSwaps.length > 0) {
            applyAllSmartSwaps(canvas, filters.smartColorSwaps);
        } else if (filters.smartColorSwapSettings) {
            applySmartColorSwap(canvas, filters.smartColorSwapSettings);
        }
    }

    if (swapType === 'tile' || swapType === 'all') {
        if (filters.tileColorSwaps && filters.tileColorSwaps.length > 0) {
            applyAllTileSwaps(canvas, filters.tileColorSwaps);
        }
    }

    return canvas.toDataURL('image/png');
}

