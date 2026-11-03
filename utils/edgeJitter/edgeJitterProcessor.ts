import { OverlayFilters } from '../../types';
import { computeEdgeMap } from './edgeDetection';
import { calculateWaveOffset } from './offsetWave';
import { smooth2DField } from './smoothing';

/**
 * Main processor that applies Edge Jitter to a canvas context or ImageData.
 */
export function applyEdgeJitter(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    f: OverlayFilters,
    existingData?: ImageData
): void {
    const amount = f.edgeJitterAmount ?? 25;
    if (amount <= 0 && f.jitterType === 'edge') return;

    const mode = f.edgeJitterMode || 'pixel';
    const grainSize = Math.max(1, f.edgeJitterSize ?? 3);
    const rotationDeg = f.edgeJitterRotation ?? 0;
    const waveShape = f.edgeJitterWaveShape || 'sine';
    const frequency = Math.max(1, f.edgeJitterFrequency ?? 10);
    const smoothing = Math.max(0, Math.min(100, f.edgeJitterSmoothing ?? 0));

    const imgData = existingData || ctx.getImageData(0, 0, width, height);
    const srcData = imgData.data;
    const totalPixels = width * height;

    const { edgeMap, isEdgeCandidate } = computeEdgeMap(srcData, width, height, f);

    // Create displacement fields
    const dxField = new Float32Array(totalPixels);
    const dyField = new Float32Array(totalPixels);

    const rad = (rotationDeg * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    const maxDisp = (amount / 100) * (grainSize * 5 + 4);
    const wavelength = Math.max(3, 160 / frequency);

    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const idx = row + x;
            if (!isEdgeCandidate[idx]) continue;

            const weight = edgeMap[idx];
            if (weight <= 0.01) continue;

            if (mode === 'offset') {
                // Directional wave offset along rotation angle
                const projectedPos = (x * cosR + y * sinR) / wavelength;
                const waveVal = calculateWaveOffset(projectedPos, waveShape);
                const perpX = -sinR * waveVal * maxDisp * weight;
                const perpY = cosR * waveVal * maxDisp * weight;

                dxField[idx] = perpX;
                dyField[idx] = perpY;
            } else if (mode === 'noise') {
                // Continuous pseudo-noise displacement
                const nX = (Math.sin(x / grainSize + y * 0.5) + Math.cos(y / grainSize + x * 0.3)) * 0.5;
                const nY = (Math.cos(x / grainSize - y * 0.4) + Math.sin(y / grainSize - x * 0.5)) * 0.5;
                dxField[idx] = nX * maxDisp * weight;
                dyField[idx] = nY * maxDisp * weight;
            } else if (mode === 'rough') {
                // Chalk/rough jagged jitter
                const blockX = Math.floor(x / grainSize);
                const blockY = Math.floor(y / grainSize);
                const pseudo = Math.sin(blockX * 12.9898 + blockY * 78.233) * 43758.5453;
                const rand = pseudo - Math.floor(pseudo);
                const disp = (rand * 2 - 1) * maxDisp * weight;
                dxField[idx] = disp * cosR;
                dyField[idx] = disp * sinR;
            } else {
                // Pixel scattering
                const blockX = Math.floor(x / grainSize);
                const blockY = Math.floor(y / grainSize);
                const pseudo = Math.sin(blockX * 37.123 + blockY * 91.456) * 21453.123;
                const randX = (pseudo - Math.floor(pseudo)) * 2 - 1;
                const randY = ((pseudo * 1.5) - Math.floor(pseudo * 1.5)) * 2 - 1;
                dxField[idx] = randX * maxDisp * weight;
                dyField[idx] = randY * maxDisp * weight;
            }
        }
    }

    // Apply smoothing to displacement fields if requested
    const smoothedDx = smoothing > 0 ? smooth2DField(dxField, width, height, smoothing) : dxField;
    const smoothedDy = smoothing > 0 ? smooth2DField(dyField, width, height, smoothing) : dyField;

    // Buffer to write displaced output
    const outputBuffer = new Uint8ClampedArray(srcData);

    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const idx = row + x;
            if (!isEdgeCandidate[idx]) continue;

            const dx = smoothedDx[idx];
            const dy = smoothedDy[idx];

            if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) continue;

            const sampleX = Math.round(Math.max(0, Math.min(width - 1, x + dx)));
            const sampleY = Math.round(Math.max(0, Math.min(height - 1, y + dy)));
            const sampleIdx = (sampleY * width + sampleX) * 4;
            const destIdx = idx * 4;

            // Copy pixel data
            outputBuffer[destIdx] = srcData[sampleIdx];
            outputBuffer[destIdx + 1] = srcData[sampleIdx + 1];
            outputBuffer[destIdx + 2] = srcData[sampleIdx + 2];
            outputBuffer[destIdx + 3] = srcData[sampleIdx + 3];
        }
    }

    // Write back to canvas
    for (let i = 0; i < srcData.length; i++) {
        srcData[i] = outputBuffer[i];
    }
    ctx.putImageData(imgData, 0, 0);
}
