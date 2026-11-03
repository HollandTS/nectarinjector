import type { SmartColorSwapItem, SmartColorSwapSettings } from '../types';
import { rgbToHsl, hslToRgb } from './colorUtils';
import { applySharpen } from './imageEffects';

export const createDefaultSmartSwap = (id?: string): SmartColorSwapItem => ({
    id: id || `smart-swap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    enabled: true,
    targetColor: { r: 255, g: 255, b: 255, a: 1 },
    replaceColor: { r: 255, g: 255, b: 255, a: 1 },
    tolerance: 20,
    hue: 0,
    saturation: 100,
    brightness: 100,
    sharpening: 0,
    smoothing: 0
});

export const applySingleSmartSwap = (
    canvas: HTMLCanvasElement,
    settings: SmartColorSwapSettings
): void => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const tc = settings.targetColor || { r: 255, g: 255, b: 255 };
    const rc = settings.replaceColor || tc;

    const { width: w, height: h } = canvas;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const rawTol = settings.tolerance ?? 20;
    const tol = rawTol <= 100 ? (rawTol / 100) * 442 : rawTol;
    const hueShift = settings.hue ?? 0;
    const satMult = (settings.saturation ?? 100) / 100;
    const briMult = (settings.brightness ?? 100) / 100;

    const isBaseColorSame = tc.r === rc.r && tc.g === rc.g && tc.b === rc.b;
    const hasAdjustment = hueShift !== 0 || satMult !== 1 || briMult !== 1;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;

        const r = data[i], g = data[i + 1], b = data[i + 2];
        const dist = Math.hypot(r - tc.r, g - tc.g, b - tc.b);

        if (dist <= tol) {
            let nr = isBaseColorSame ? r : rc.r;
            let ng = isBaseColorSame ? g : rc.g;
            let nb = isBaseColorSame ? b : rc.b;

            if (hasAdjustment) {
                let { h: hue, s: sat, l: lum } = rgbToHsl(nr, ng, nb);
                hue = (hue + hueShift + 360) % 360;
                sat = Math.max(0, Math.min(100, sat * satMult));
                lum = Math.max(0, Math.min(100, lum * briMult));
                const rgb = hslToRgb(hue, sat, lum);
                nr = rgb.r; ng = rgb.g; nb = rgb.b;
            }

            data[i] = nr;
            data[i + 1] = ng;
            data[i + 2] = nb;
        }
    }

    ctx.putImageData(imageData, 0, 0);

    if (settings.sharpening > 0) {
        applySharpen(ctx, w, h, settings.sharpening, imageData);
    }

    if (settings.smoothing > 0) {
        ctx.filter = `blur(${settings.smoothing / 10}px)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
    }
};

export const applyAllSmartSwaps = (
    canvas: HTMLCanvasElement,
    swaps: SmartColorSwapItem[]
): void => {
    if (!swaps || swaps.length === 0) return;
    for (const swap of swaps) {
        if (swap.enabled !== false) {
            applySingleSmartSwap(canvas, swap);
        }
    }
};
