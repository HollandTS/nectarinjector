
import type { ContourSettings, RgbaColor, OverlayFilters, JitterWaveShape, SmartColorSwapSettings, OriginalColorSettings } from '../types';
import { colorDistance, rgbToHsl, hslToRgb } from './colorUtils';
import { applyEdgeJitter, computeEdgeMap } from './edgeJitter';
import { applyAllSmartSwaps } from './smartColorSwapHelper';
import { applyAllTileSwaps } from './tileColorMatchHelper';

const getWaveValue = (v: number, shape: JitterWaveShape): number => {
    switch (shape) {
        case 'square': return Math.sign(Math.sin(v));
        case 'triangle': return Math.asin(Math.sin(v)) * (2 / Math.PI);
        case 'sawtooth': {
            const p = v / (2 * Math.PI);
            return 2 * (p - Math.floor(0.5 + p));
        }
        default: return Math.sin(v);
    }
};

export const applySharpen = (ctx: CanvasRenderingContext2D, width: number, height: number, amount: number, existingData?: ImageData) => {
    if (amount <= 0) return;
    const imageData = existingData || ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = ctx.createImageData(width, height);
    const outputData = output.data;
    const k = amount / 100;
    const matrix = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] === 0) {
                outputData[i + 3] = 0;
                continue;
            }
            const centerR = data[i];
            const centerG = data[i + 1];
            const centerB = data[i + 2];
            let diffR = 0, diffG = 0, diffB = 0;
            let validNeighbors = 0;
            const offsets = [
                ((y - 1) * width + x) * 4,
                ((y + 1) * width + x) * 4,
                (y * width + (x - 1)) * 4,
                (y * width + (x + 1)) * 4
            ];
            for (let n = 0; n < 4; n++) {
                const nIdx = offsets[n];
                if (data[nIdx + 3] > 0) {
                    diffR += centerR - data[nIdx];
                    diffG += centerG - data[nIdx + 1];
                    diffB += centerB - data[nIdx + 2];
                    validNeighbors++;
                }
            }
            if (validNeighbors > 0) {
                const effK = (k * 4) / validNeighbors;
                outputData[i] = Math.min(255, Math.max(0, centerR + diffR * effK * 0.25));
                outputData[i + 1] = Math.min(255, Math.max(0, centerG + diffG * effK * 0.25));
                outputData[i + 2] = Math.min(255, Math.max(0, centerB + diffB * effK * 0.25));
            } else {
                outputData[i] = centerR;
                outputData[i + 1] = centerG;
                outputData[i + 2] = centerB;
            }
            outputData[i + 3] = data[i + 3];
        }
    }
    if (existingData) {
        for (let i = 0; i < data.length; i++) data[i] = outputData[i];
    } else {
        ctx.putImageData(output, 0, 0);
    }
};

export const applyPixelFilters = (canvas: HTMLCanvasElement, f: OverlayFilters, existingData?: ImageData) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const imageData = existingData || ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Process single legacy swap if present
    if (f.targetColor && f.replaceColor) {
        const tc = f.targetColor; const rc = f.replaceColor; const tol = f.colorTolerance;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const dist = Math.sqrt(Math.pow(data[i] - tc.r, 2) + Math.pow(data[i + 1] - tc.g, 2) + Math.pow(data[i + 2] - tc.b, 2));
            if (dist <= tol) { data[i] = rc.r; data[i + 1] = rc.g; data[i + 2] = rc.b; }
        }
    }

    // Process multiple swaps
    if (f.colorSwaps && f.colorSwaps.length > 0) {
        for (const swap of f.colorSwaps) {
            if (!swap.targetColor || !swap.replaceColor) continue;
            const tc = swap.targetColor; const rc = swap.replaceColor; const tol = swap.tolerance;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const dist = Math.sqrt(Math.pow(data[i] - tc.r, 2) + Math.pow(data[i + 1] - tc.g, 2) + Math.pow(data[i + 2] - tc.b, 2));
                if (dist <= tol) { data[i] = rc.r; data[i + 1] = rc.g; data[i + 2] = rc.b; }
            }
        }
    }

    if (!existingData) ctx.putImageData(imageData, 0, 0);

    // Process multiple smart color swaps (or fallback to legacy single swap)
    if (f.smartColorSwaps && f.smartColorSwaps.length > 0) {
        applyAllSmartSwaps(canvas, f.smartColorSwaps);
    } else if (f.smartColorSwapEnabled && f.smartColorSwapSettings) {
        applySmartColorSwap(canvas, f.smartColorSwapSettings);
    }

    // Process tile color match
    if (f.tileColorSwaps && f.tileColorSwaps.length > 0) {
        applyAllTileSwaps(canvas, f.tileColorSwaps);
    }
};

export const applyPixelNoise = (ctx: CanvasRenderingContext2D, width: number, height: number, f: OverlayFilters, existingData?: ImageData) => {
    const type = f.jitterType;
    if (type === 'none') return;

    if (type === 'edge') {
        applyEdgeJitter(ctx, width, height, f, existingData);
        return;
    }

    const amount = (type === 'offset' && (f.pixelNoise ?? 0) === 0) ? (f.jitterSize ?? 10) : (f.pixelNoise ?? 0);
    const imageData = existingData || ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const size = Math.max(1, Math.round(f.jitterSize));
    if (type === 'stamp') {
        const stampCanvas = document.createElement('canvas');
        stampCanvas.width = width;
        stampCanvas.height = height;
        const sCtx = stampCanvas.getContext('2d')!;
        sCtx.putImageData(imageData, 0, 0);
        ctx.save();
        ctx.globalAlpha = f.jitterOpacity / 100;
        const customMask = (f.jitterShape === 'custom' || f.jitterShape === 'draw') && f.customStampSrc ? new Image() : null;
        if (customMask) customMask.src = f.customStampSrc!;
        for (let i = 0; i < f.jitterCount; i++) {
            const sx = Math.random() * (width - size);
            const sy = Math.random() * (height - size);
            const dx = Math.random() * (width - size);
            const dy = Math.random() * (height - size);
            ctx.save();
            if (f.jitterShape === 'circle') {
                ctx.beginPath();
                ctx.arc(dx + size / 2, dy + size / 2, size / 2, 0, Math.PI * 2);
                ctx.clip();
            } else if (customMask && customMask.complete) {
                const maskCanv = document.createElement('canvas');
                maskCanv.width = size;
                maskCanv.height = size;
                const mCtx = maskCanv.getContext('2d')!;
                mCtx.drawImage(customMask, 0, 0, size, size);
                mCtx.globalCompositeOperation = 'source-in';
                mCtx.drawImage(stampCanvas, sx, sy, size, size, 0, 0, size, size);
                ctx.drawImage(maskCanv, dx, dy);
                ctx.restore();
                continue;
            }
            ctx.drawImage(stampCanvas, sx, sy, size, size, dx, dy, size, size);
            ctx.restore();
        }
        ctx.restore();
        return;
    }
    if (amount <= 0 && type !== 'offset') return;
    const out = ctx.createImageData(width, height);
    const outData = out.data;

    // Optional edge mask when edgeJitterOnly is active
    let edgeMask: Float32Array | null = null;
    if (f.edgeJitterOnly) {
        edgeMask = computeEdgeMap(data, width, height, f).edgeMap;
    }

    // Pre-calculate rotation values for offset
    const angleRad = (f.jitterRotation * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const freq = f.jitterWidth * 0.05;
    const phaseOffset = f.jitterZoom;

    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const idx = row + x;
            const i = idx * 4;
            if (data[i + 3] === 0) continue;

            const edgeWeight = edgeMask ? edgeMask[idx] : 1.0;
            if (edgeWeight <= 0) {
                outData[i] = data[i];
                outData[i + 1] = data[i + 1];
                outData[i + 2] = data[i + 2];
                outData[i + 3] = data[i + 3];
                continue;
            }

            const effectiveAmount = amount * edgeWeight;
            let ox = x, oy = y;
            if (type === 'noise') {
                const n = (Math.random() - 0.5) * effectiveAmount;
                outData[i] = Math.min(255, Math.max(0, data[i] + n));
                outData[i + 1] = Math.min(255, Math.max(0, data[i+1] + n));
                outData[i + 2] = Math.min(255, Math.max(0, data[i+2] + n));
                outData[i + 3] = data[i + 3];
                continue;
            } else if (type === 'pixel') {
                ox = x + (Math.random() - 0.5) * (effectiveAmount / 2);
                oy = y + (Math.random() - 0.5) * (effectiveAmount / 2);
            } else if (type === 'offset') {
                const p = x * sinA + y * cosA;
                const shift = getWaveValue((p + phaseOffset) * freq, f.jitterWaveShape) * effectiveAmount;
                ox = x + shift * cosA;
                oy = y - shift * sinA;
            }
            const sx = Math.min(width - 1, Math.max(0, Math.round(ox)));
            const sy = Math.min(height - 1, Math.max(0, Math.round(oy)));
            const si = (sy * width + sx) * 4;
            outData[i] = data[si];
            outData[i + 1] = data[si+1];
            outData[i + 2] = data[si+2];
            outData[i + 3] = data[si+3];
        }
    }
    if (existingData) {
        for (let i = 0; i < data.length; i++) data[i] = outData[i];
    } else {
        ctx.putImageData(out, 0, 0);
    }
};

export const applySmartColorSwap = (canvas: HTMLCanvasElement, settings: SmartColorSwapSettings) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    // Provide sensible fallbacks if targetColor or replaceColor were not set
    const tc = settings.targetColor || { r: 255, g: 255, b: 255 };
    const rc = settings.replaceColor || tc;
    
    const { width: w, height: h } = canvas;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    const rawTol = settings.tolerance ?? 20;
    // Map tolerance 0-100 percentage to maximum RGB Euclidean distance (~441.67)
    const tol = rawTol <= 100 ? (rawTol / 100) * 442 : rawTol;
    const hueShift = settings.hue ?? 0;
    const satMult = (settings.saturation ?? 100) / 100;
    const briMult = (settings.brightness ?? 100) / 100;

    const isBaseColorSame = tc.r === rc.r && tc.g === rc.g && tc.b === rc.b;
    const hasAdjustment = hueShift !== 0 || satMult !== 1 || briMult !== 1;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        
        const r = data[i], g = data[i+1], b = data[i+2];
        const dist = Math.sqrt(Math.pow(r - tc.r, 2) + Math.pow(g - tc.g, 2) + Math.pow(b - tc.b, 2));
        
        if (dist <= tol) {
            // If base replacement is same as target, adjust actual pixel color to preserve shading; otherwise replace
            let nr = isBaseColorSame ? r : rc.r;
            let ng = isBaseColorSame ? g : rc.g;
            let nb = isBaseColorSame ? b : rc.b;
            
            // Apply adjustments
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
    
    // Apply sharpening if needed
    if (settings.sharpening > 0) {
        applySharpen(ctx, w, h, settings.sharpening, imageData);
    }
    
    // Smoothing (simple blur for now)
    if (settings.smoothing > 0) {
        ctx.filter = `blur(${settings.smoothing / 10}px)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
    }
};

export const applyContourEffect = (
    ctx: CanvasRenderingContext2D, 
    settings: ContourSettings, 
    protectionColor: RgbaColor | null = null,
    protectionTolerance: number = 10
) => {
    const { width: w, height: h } = ctx.canvas;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const bri = settings.brightness / 100;
    const con = settings.contrast / 100;
    const satMult = settings.saturation / 100;
    const hueShift = settings.hue;
    const thickness = settings.thickness;
    const feather = settings.feather;
    const invert = settings.invert;
    
    const groups = settings.maskGroups;
    if (groups.length === 0 && !settings.targetColor) return;

    const boundaryMask = new Uint8Array(w * h);
    const targetMask = new Uint8Array(w * h);
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        const isProtected = protectionColor && colorDistance(protectionColor, { r, g, b }) <= protectionTolerance;
        const isTransparent = a === 0;
        
        let isAnchor = false;
        if (settings.targetColor && colorDistance(settings.targetColor, { r, g, b }) <= settings.tolerance) {
            isAnchor = true;
        } else {
            for (const group of groups) {
                const groupTolVal = (group.tolerance / 100) * 442;
                for (const c of group.colors) {
                    if (colorDistance(c, { r, g, b }) <= groupTolVal) {
                        isAnchor = true; break;
                    }
                }
                if (isAnchor) break;
            }
        }

        if (!invert) {
            if (isTransparent || isAnchor || isProtected) boundaryMask[i / 4] = 1;
            else targetMask[i / 4] = 1;
        } else {
            if (!isTransparent && !isAnchor && !isProtected) boundaryMask[i / 4] = 1;
            else if (isAnchor && !isProtected && !isTransparent) targetMask[i / 4] = 1;
        }
    }
    
    const outData = new Uint8ClampedArray(data);
    const rLimit = Math.ceil(thickness);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (targetMask[idx] === 0) continue;
            let minDist = Infinity;
            for (let dy = -rLimit; dy <= rLimit; dy++) {
                for (let dx = -rLimit; dx <= rLimit; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        if (boundaryMask[ny * w + nx] === 1) {
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < minDist) minDist = d;
                        }
                    }
                }
                if (minDist < 1) break;
            }
            if (minDist <= thickness) {
                let alpha = 1 - (minDist / thickness);
                if (feather > 0) alpha = Math.pow(alpha, 1 + (feather / 10));
                if (alpha > 0.01) {
                    const r = data[idx * 4], g = data[idx * 4 + 1], b = data[idx * 4 + 2];
                    let nr = r * bri; let ng = g * bri; let nb = b * bri;
                    nr = ((nr / 255 - 0.5) * con + 0.5) * 255;
                    ng = ((ng / 255 - 0.5) * con + 0.5) * 255;
                    nb = ((nb / 255 - 0.5) * con + 0.5) * 255;
                    if (hueShift !== 0 || satMult !== 1) {
                        const hsl = rgbToHsl(nr, ng, nb);
                        hsl.h = (hsl.h + hueShift + 360) % 360;
                        hsl.s = Math.max(0, Math.min(100, hsl.s * satMult));
                        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
                        nr = rgb.r; ng = rgb.g; nb = rgb.b;
                    }
                    outData[idx * 4] = r * (1 - alpha) + Math.max(0, Math.min(255, nr)) * alpha;
                    outData[idx * 4 + 1] = g * (1 - alpha) + Math.max(0, Math.min(255, ng)) * alpha;
                    outData[idx * 4 + 2] = b * (1 - alpha) + Math.max(0, Math.min(255, nb)) * alpha;
                }
            }
        }
    }
    ctx.putImageData(new ImageData(outData, w, h), 0, 0);
};

export const applyContourInjection = (
    ctx: CanvasRenderingContext2D,
    f: OverlayFilters,
    transitionSource: CanvasImageSource | null = null,
    refPixels?: Uint8ClampedArray
) => {
    const { width: w, height: h } = ctx.canvas;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const thickness = f.contourThickness;
    const feather = f.contourFeather;
    const noiseAmount = f.contourNoise;
    
    const maskA = new Uint8Array(w * h);
    const maskB = new Uint8Array(w * h);
    const targetMask = new Uint8Array(w * h);
    
    if (!refPixels || !transitionSource) return;

    // 1. Build masks for Group A and Group B selected for transition
    const gA = f.maskGroups.find(g => g.id === f.transitionGroupAId);
    const gB = f.maskGroups.find(g => g.id === f.transitionGroupBId);

    if (!gA || !gB) return;

    for (let i = 0; i < w * h; i++) {
        const pxIdx = i * 4;
        const r = refPixels[pxIdx], g = refPixels[pxIdx+1], b = refPixels[pxIdx+2], a = refPixels[pxIdx+3];
        if (a === 0) continue;
        
        const color = { r, g, b };
        
        let inA = false;
        const tolA = (gA.tolerance / 100) * 442;
        for (const c of gA.colors) {
            if (colorDistance(c, color) <= tolA) { inA = true; break; }
        }

        let inB = false;
        const tolB = (gB.tolerance / 100) * 442;
        for (const c of gB.colors) {
            if (colorDistance(c, color) <= tolB) { inB = true; break; }
        }

        if (inA) maskA[i] = 1;
        if (inB) maskB[i] = 1;
        if (inA || inB) targetMask[i] = 1;
    }

    // 2. Prepare transition source
    let transitionData: Uint8ClampedArray | null = null;
    if (transitionSource) {
        const tCanvas = document.createElement('canvas');
        tCanvas.width = w; tCanvas.height = h;
        const tCtx = tCanvas.getContext('2d')!;
        tCtx.drawImage(transitionSource, 0, 0, w, h);
        transitionData = tCtx.getImageData(0, 0, w, h).data;
    }

    const outData = new Uint8ClampedArray(data);
    const rLimit = Math.ceil(thickness + noiseAmount);
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (targetMask[idx] === 0) continue;
            
            let minDist = Infinity;
            let searchMask = (maskA[idx] === 1) ? maskB : maskA;

            for (let dy = -rLimit; dy <= rLimit; dy++) {
                for (let dx = -rLimit; dx <= rLimit; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        if (searchMask[ny * w + nx] === 1) {
                            const d = Math.sqrt(dx * dx + dy * dy);
                            if (d < minDist) minDist = d;
                        }
                    }
                }
                if (minDist < 1) break;
            }

            if (noiseAmount > 0 && minDist < thickness + noiseAmount) {
                const noise = (Math.sin(x * 0.2) + Math.sin(y * 0.2) + Math.random() * 0.5) * noiseAmount;
                minDist += noise;
            }

            if (minDist <= thickness) {
                let alpha = 1 - (minDist / thickness);
                if (feather > 0) alpha = Math.pow(alpha, 1 + (feather / 10));
                
                if (alpha > 0.01) {
                    const i = idx * 4;
                    if (transitionData) {
                        outData[i] = data[i] * (1 - alpha) + transitionData[i] * alpha;
                        outData[i+1] = data[i+1] * (1 - alpha) + transitionData[i+1] * alpha;
                        outData[i+2] = data[i+2] * (1 - alpha) + transitionData[i+2] * alpha;
                    } else {
                        outData[i] = data[i] * (1 - alpha * 0.2);
                        outData[i+1] = data[i+1] * (1 - alpha * 0.2);
                        outData[i+2] = data[i+2] * (1 - alpha * 0.2);
                    }
                }
            }
        }
    }
    ctx.putImageData(new ImageData(outData, w, h), 0, 0);
};

export const applyOriginalColorAdjustment = (
    canvas: HTMLCanvasElement,
    settings: OriginalColorSettings
) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const { width: w, height: h } = canvas;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    const { hue, saturation, brightness, contrast, targetColor, tolerance, sharpness } = settings;
    const satMult = saturation / 100;
    const briMult = brightness / 100;
    const conMult = contrast / 100;
    const tolVal = (tolerance / 100) * 442;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        
        const r = data[i], g = data[i+1], b = data[i+2];
        
        if (targetColor) {
            const dist = Math.sqrt(Math.pow(r - targetColor.r, 2) + Math.pow(g - targetColor.g, 2) + Math.pow(b - targetColor.b, 2));
            if (dist > tolVal) continue;
        }
        
        // Apply adjustments
        let nr = r, ng = g, nb = b;
        
        // Brightness
        nr *= briMult; ng *= briMult; nb *= briMult;
        
        // Contrast
        nr = ((nr / 255 - 0.5) * conMult + 0.5) * 255;
        ng = ((ng / 255 - 0.5) * conMult + 0.5) * 255;
        nb = ((nb / 255 - 0.5) * conMult + 0.5) * 255;
        
        // Hue/Sat
        if (hue !== 0 || satMult !== 1) {
            const hsl = rgbToHsl(nr, ng, nb);
            hsl.h = (hsl.h + hue + 360) % 360;
            hsl.s = Math.max(0, Math.min(100, hsl.s * satMult));
            const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
            nr = rgb.r; ng = rgb.g; nb = rgb.b;
        }
        
        data[i] = Math.max(0, Math.min(255, nr));
        data[i + 1] = Math.max(0, Math.min(255, ng));
        data[i + 2] = Math.max(0, Math.min(255, nb));
    }
    
    if (sharpness > 0) {
        applySharpen(ctx, w, h, sharpness, imageData);
    }
    
    ctx.putImageData(imageData, 0, 0);
};
