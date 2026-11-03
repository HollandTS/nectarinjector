import type { OverlayFilters } from '../types';
import { applyColorBalance } from './colorBalanceHelper';

/**
 * Edge-preserving Bilateral Smoothing filter.
 * Keeps prominent boundaries crisp while smoothing out gradients, noise, and flat regions.
 */
export function applyBilateralSmooth(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    strength: number, // 0 to 100
    radius: number,   // 1 to 5
    tolerance: number  // 1 to 100
) {
    if (strength <= 0 || width <= 0 || height <= 0) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const output = ctx.createImageData(width, height);
    const outData = output.data;

    const r = Math.min(5, Math.max(1, Math.round(radius)));
    // sigma space based on radius:
    const sigmaS = r * 0.5;
    // sigma color based on tolerance (tolerance 1..100 maps to 1..150 sigma)
    const sigmaC = Math.max(1, tolerance * 1.5);

    // Precompute spatial weights
    const spaceWeights: number[][] = [];
    for (let dy = -r; dy <= r; dy++) {
        spaceWeights[dy + r] = [];
        for (let dx = -r; dx <= r; dx++) {
            const distSq = dx * dx + dy * dy;
            spaceWeights[dy + r][dx + r] = Math.exp(-distSq / (2 * sigmaS * sigmaS));
        }
    }

    const sigmaC2 = 2 * sigmaC * sigmaC;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const centerIdx = (y * width + x) * 4;
            const a = data[centerIdx + 3];
            
            // If transparent, preserve it completely
            if (a === 0) {
                outData[centerIdx] = data[centerIdx];
                outData[centerIdx + 1] = data[centerIdx + 1];
                outData[centerIdx + 2] = data[centerIdx + 2];
                outData[centerIdx + 3] = 0;
                continue;
            }

            const cr = data[centerIdx];
            const cg = data[centerIdx + 1];
            const cb = data[centerIdx + 2];

            let sumR = 0, sumG = 0, sumB = 0;
            let totalWeight = 0;

            for (let dy = -r; dy <= r; dy++) {
                const ny = y + dy;
                if (ny < 0 || ny >= height) continue;

                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx;
                    if (nx < 0 || nx >= width) continue;

                    const nIdx = (ny * width + nx) * 4;
                    const na = data[nIdx + 3];
                    if (na === 0) continue; // Skip transparency boundaries

                    const nr = data[nIdx];
                    const ng = data[nIdx + 1];
                    const nb = data[nIdx + 2];

                    // Color similarity (L2 Euclidean distance in RGB)
                    const dr = nr - cr;
                    const dg = ng - cg;
                    const db = nb - cb;
                    const colorDistSq = dr * dr + dg * dg + db * db;

                    const wS = spaceWeights[dy + r][dx + r];
                    const wC = Math.exp(-colorDistSq / sigmaC2);
                    const w = wS * wC;

                    sumR += nr * w;
                    sumG += ng * w;
                    sumB += nb * w;
                    totalWeight += w;
                }
            }

            if (totalWeight > 0) {
                const bR = sumR / totalWeight;
                const bG = sumG / totalWeight;
                const bB = sumB / totalWeight;

                // Blend with original base pixels mapping to strength (0..100)
                const alpha = strength / 100;
                outData[centerIdx] = Math.round(cr * (1 - alpha) + bR * alpha);
                outData[centerIdx + 1] = Math.round(cg * (1 - alpha) + bG * alpha);
                outData[centerIdx + 2] = Math.round(cb * (1 - alpha) + bB * alpha);
                outData[centerIdx + 3] = a;
            } else {
                outData[centerIdx] = cr;
                outData[centerIdx + 1] = cg;
                outData[centerIdx + 2] = cb;
                outData[centerIdx + 3] = a;
            }
        }
    }

    ctx.putImageData(output, 0, 0);
}

/**
 * Advanced Unsharp Masking filter.
 * Subtracts a Gaussian-blurred version to obtain fine texture details, then amplifies them.
 */
export function applyUnsharpMask(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    amount: number, // Sharpen strength/percent
    radius: number, // Blur/High-Pass radius
    threshold: number // Contrast threshold (0 to 100)
) {
    if (amount <= 0 || width <= 0 || height <= 0) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const blurred = ctx.createImageData(width, height);
    const blurData = blurred.data;

    const r = Math.max(1, Math.round(radius || 1.5));
    const sigma = radius || 1.5;
    const sigma2 = 2 * sigma * sigma;

    const gWeights: number[] = [];
    let gSum = 0;
    for (let d = -r; d <= r; d++) {
        const w = Math.exp(-(d * d) / sigma2);
        gWeights.push(w);
        gSum += w;
    }
    for (let i = 0; i < gWeights.length; i++) {
        gWeights[i] /= gSum;
    }

    const temp = new Uint8ClampedArray(width * height * 4);

    // Horizontal blur pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] === 0) continue;

            let sumR = 0, sumG = 0, sumB = 0, weightTotal = 0;
            for (let d = -r; d <= r; d++) {
                const nx = Math.min(width - 1, Math.max(0, x + d));
                const nIdx = (y * width + nx) * 4;
                const na = data[nIdx + 3];
                if (na === 0) continue;
                const weight = gWeights[d + r] * (na / 255);
                sumR += data[nIdx] * weight;
                sumG += data[nIdx + 1] * weight;
                sumB += data[nIdx + 2] * weight;
                weightTotal += weight;
            }
            if (weightTotal > 0) {
                temp[idx] = sumR / weightTotal;
                temp[idx + 1] = sumG / weightTotal;
                temp[idx + 2] = sumB / weightTotal;
                temp[idx + 3] = data[idx + 3];
            } else {
                temp[idx] = data[idx];
                temp[idx + 1] = data[idx + 1];
                temp[idx + 2] = data[idx + 2];
                temp[idx + 3] = data[idx + 3];
            }
        }
    }

    // Vertical blur pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] === 0) {
                blurData[idx + 3] = 0;
                continue;
            }

            let sumR = 0, sumG = 0, sumB = 0, weightTotal = 0;
            for (let d = -r; d <= r; d++) {
                const ny = Math.min(height - 1, Math.max(0, y + d));
                const nIdx = (ny * width + x) * 4;
                const na = temp[nIdx + 3];
                if (na === 0) continue;
                const weight = gWeights[d + r] * (na / 255);
                sumR += temp[nIdx] * weight;
                sumG += temp[nIdx + 1] * weight;
                sumB += temp[nIdx + 2] * weight;
                weightTotal += weight;
            }
            if (weightTotal > 0) {
                blurData[idx] = sumR / weightTotal;
                blurData[idx + 1] = sumG / weightTotal;
                blurData[idx + 2] = sumB / weightTotal;
                blurData[idx + 3] = data[idx + 3];
            } else {
                blurData[idx] = data[idx];
                blurData[idx + 1] = data[idx + 1];
                blurData[idx + 2] = data[idx + 2];
                blurData[idx + 3] = data[idx + 3];
            }
        }
    }

    const thresVal = (threshold / 100) * 25.5;
    const factor = amount / 100;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;

        const origR = data[i];
        const origG = data[i + 1];
        const origB = data[i + 2];

        const blurR = blurData[i];
        const blurG = blurData[i + 1];
        const blurB = blurData[i + 2];

        const diffR = origR - blurR;
        const diffG = origG - blurG;
        const diffB = origB - blurB;

        const diffLum = Math.abs(diffR * 0.299 + diffG * 0.587 + diffB * 0.114);

        let weight = 1;
        if (thresVal > 0) {
            if (diffLum < thresVal) {
                weight = 0;
            } else if (diffLum < thresVal * 2) {
                weight = (diffLum - thresVal) / thresVal;
            }
        }

        if (weight > 0) {
            const effFactor = factor * weight;
            data[i] = Math.min(255, Math.max(0, origR + diffR * effFactor));
            data[i + 1] = Math.min(255, Math.max(0, origG + diffG * effFactor));
            data[i + 2] = Math.min(255, Math.max(0, origB + diffB * effFactor));
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

/**
 * Applies advanced sharpness/smoothness filter pipeline holding master and detailed sliders.
 */
export function applyAdvancedEffects(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    filters: OverlayFilters
) {
    if (width <= 0 || height <= 0) return;

    const master = filters.masterSharpSmooth ?? 0;
    const isSmooth = filters.renderMode === 'smooth';
    
    if (master < 0) {
        // Master negative: Bilateral Smart Smoothing
        const strength = Math.abs(master);
        const radius = filters.smartSmoothRadius ?? 2;
        const tolerance = filters.smartSmoothTolerance ?? 30;
        applyBilateralSmooth(ctx, width, height, strength, radius, tolerance);
    } else if (master > 0) {
        // Master positive: Unsharp Mask Sharpening
        const amount = isSmooth ? master * 1.0 : master * 2.0;
        const radius = filters.sharpenRadius ?? (isSmooth ? 1.0 : 1.5);
        const threshold = filters.sharpenThreshold ?? (isSmooth ? 2 : 5);
        applyUnsharpMask(ctx, width, height, amount, radius, threshold);
    } else {
        // Explicit sliders if master is 0
        const strength = filters.smartSmoothStrength ?? 0;
        if (strength > 0) {
            const radius = filters.smartSmoothRadius ?? 2;
            const tolerance = filters.smartSmoothTolerance ?? 30;
            applyBilateralSmooth(ctx, width, height, strength, radius, tolerance);
        }
        
        const sharpVal = filters.sharpen ?? 0;
        if (sharpVal > 0) {
            const amount = isSmooth ? sharpVal * 1.0 : sharpVal * 1.5;
            const radius = filters.sharpenRadius ?? (isSmooth ? 1.0 : 1.5);
            const threshold = filters.sharpenThreshold ?? (isSmooth ? 2 : 5);
            applyUnsharpMask(ctx, width, height, amount, radius, threshold);
        }
    }

    const balanceColors = filters.balanceColors ?? 0;
    if (balanceColors > 0) {
        applyColorBalance(ctx, width, height, balanceColors);
    }
}
