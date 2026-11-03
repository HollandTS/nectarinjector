import type { SeamlessMakerSettings, SeamlessBlendCurve } from './seamlessMakerUtils';
import type { Tile } from './formats';
import type { PaletteColor } from './westwoodTmpParser';
import { isInsideOpenTsDiamond } from './openTsTileRenderer';

export type SeamlessExtraTargetMode = 'base_only' | 'both' | 'extra_only';
export type SeamlessExtraBlendAxis = 'horizontal' | 'vertical' | 'both';

export interface ExtraArtRegion {
    tileId: string;
    subSlot: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    imgData: ImageData;
    origData: Uint8ClampedArray;
    // Bounding box of extra art in canvas coordinates
    ex: number;
    ey: number;
    ew: number;
    eh: number;
    // Base diamond offset in canvas coordinates (for PNG fallback or overlap detection)
    bx: number;
    by: number;
    cx: number;
    cy: number;
    // Global isometric grid cell coordinates (i, j) of this sub-tile
    cellI: number;
    cellJ: number;
    // Optional parsed TMP sub-tile reference
    subTileObj: Tile | null;
    // Active pixel mask (1 if part of extra art, 0 if transparent / base-only)
    activeMask: Uint8Array;
    // Per-row horizontal span [leftCol, rightCol] of active extra art pixels
    rowSpans: { minX: number; maxX: number; valid: boolean }[];
    // Per-column vertical span [topRow, bottomRow] of active extra art pixels
    colSpans: { minY: number; maxY: number; valid: boolean }[];
    meanR: number;
    meanG: number;
    meanB: number;
    meanLum: number;
}

function evalExtraCurve(t: number, curve: SeamlessBlendCurve): number {
    const c = Math.max(0, Math.min(1, t));
    if (curve === 'linear') return c;
    if (curve === 'smoothstep') return c * c * (3 - 2 * c);
    return 0.5 - 0.5 * Math.cos(c * Math.PI);
}

/**
 * Builds an ExtraArtRegion for a TMP sub-tile that has `has_extra_data` (`ExtraImage`),
 * or for a tall PNG isotile whose height extends above the base `cy` diamond (e.g., cliff PNGs).
 */
export function buildExtraArtRegion(
    tileId: string,
    subSlot: number,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    imgData: ImageData,
    origData: Uint8ClampedArray,
    ex: number,
    ey: number,
    ew: number,
    eh: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    cellI: number,
    cellJ: number,
    subTileObj: Tile | null
): ExtraArtRegion | null {
    if (ew <= 0 || eh <= 0) return null;

    const w = imgData.width;
    const h = imgData.height;
    const activeMask = new Uint8Array(ew * eh);
    const rowSpans: { minX: number; maxX: number; valid: boolean }[] = [];
    const colSpans: { minY: number; maxY: number; valid: boolean }[] = Array.from({ length: ew }, () => ({
        minY: eh,
        maxY: -1,
        valid: false,
    }));

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;

    for (let py = 0; py < eh; py++) {
        let rMinX = ew;
        let rMaxX = -1;
        for (let px = 0; px < ew; px++) {
            const canvasX = ex + px;
            const canvasY = ey + py;
            if (canvasX < 0 || canvasX >= w || canvasY < 0 || canvasY >= h) continue;

            let isExtraPixel = false;
            if (subTileObj && subTileObj.header.has_extra_data && subTileObj.extraImageData) {
                // Exact OpenTS ExtraImage mask: non-zero palette index in extraImageData
                isExtraPixel = subTileObj.extraImageData[py * ew + px] !== 0;
            } else {
                // PNG fallback: any non-transparent pixel that is either above the base diamond
                // or outside the base OpenTS diamond mask
                const idx = (canvasY * w + canvasX) * 4;
                if (origData[idx + 3] >= 10) {
                    const lx = canvasX - bx;
                    const ly = canvasY - by;
                    if (!isInsideOpenTsDiamond(lx, ly, cx, cy) || canvasY < by + cy / 2) {
                        isExtraPixel = true;
                    }
                }
            }

            if (!isExtraPixel) continue;

            const idx = (canvasY * w + canvasX) * 4;
            if (origData[idx + 3] < 10) continue;

            activeMask[py * ew + px] = 1;
            if (px < rMinX) rMinX = px;
            if (px > rMaxX) rMaxX = px;

            const cs = colSpans[px];
            if (py < cs.minY) cs.minY = py;
            if (py > cs.maxY) cs.maxY = py;
            cs.valid = true;

            sumR += origData[idx];
            sumG += origData[idx + 1];
            sumB += origData[idx + 2];
            count++;
        }
        rowSpans.push({
            minX: rMinX,
            maxX: rMaxX,
            valid: rMaxX >= rMinX && rMaxX - rMinX >= 2,
        });
    }

    if (count === 0) return null;

    const meanR = sumR / count;
    const meanG = sumG / count;
    const meanB = sumB / count;
    const meanLum = 0.299 * meanR + 0.587 * meanG + 0.114 * meanB;

    return {
        tileId,
        subSlot,
        canvas,
        ctx,
        imgData,
        origData,
        ex,
        ey,
        ew,
        eh,
        bx,
        by,
        cx,
        cy,
        cellI,
        cellJ,
        subTileObj,
        activeMask,
        rowSpans,
        colSpans,
        meanR,
        meanG,
        meanB,
        meanLum,
    };
}

function sampleExtraPixel(
    reg: ExtraArtRegion,
    px: number,
    py: number
): { r: number; g: number; b: number; a: number } {
    const w = reg.imgData.width;
    const h = reg.imgData.height;
    const cx = Math.max(0, Math.min(w - 1, reg.ex + Math.round(px)));
    const cy = Math.max(0, Math.min(h - 1, reg.ey + Math.round(py)));
    const idx = (cy * w + cx) * 4;
    return {
        r: reg.origData[idx],
        g: reg.origData[idx + 1],
        b: reg.origData[idx + 2],
        a: reg.origData[idx + 3],
    };
}

function sampleExtraLowPass(
    reg: ExtraArtRegion,
    px: number,
    py: number
): { r: number; g: number; b: number } {
    let sr = 0,
        sg = 0,
        sb = 0,
        count = 0;
    const offsets = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
    ];
    for (const [ox, oy] of offsets) {
        const nx = Math.round(px) + ox;
        const ny = Math.round(py) + oy;
        if (nx >= 0 && nx < reg.ew && ny >= 0 && ny < reg.eh) {
            if (reg.activeMask[ny * reg.ew + nx]) {
                const p = sampleExtraPixel(reg, nx, ny);
                if (p.a > 10) {
                    sr += p.r;
                    sg += p.g;
                    sb += p.b;
                    count++;
                }
            }
        }
    }
    if (count === 0) {
        const p = sampleExtraPixel(reg, px, py);
        return { r: p.r, g: p.g, b: p.b };
    }
    return { r: sr / count, g: sg / count, b: sb / count };
}

/**
 * Processes all extracted ExtraArtRegions (cliff faces, rocky overhangs, walls, tall extra sprites)
 * to make their lateral and vertical transitions seamless across repeating or neighboring cliff tiles.
 */
export function processSeamlessExtraArtRegions(
    extraRegions: ExtraArtRegion[],
    settings: SeamlessMakerSettings,
    quantizeRGB: (r: number, g: number, b: number) => PaletteColor
) {
    if (extraRegions.length === 0) return;

    let globalMeanR = 0,
        globalMeanG = 0,
        globalMeanB = 0,
        globalMeanLum = 0;
    for (const r of extraRegions) {
        globalMeanR += r.meanR;
        globalMeanG += r.meanG;
        globalMeanB += r.meanB;
        globalMeanLum += r.meanLum;
    }
    globalMeanR /= extraRegions.length;
    globalMeanG /= extraRegions.length;
    globalMeanB /= extraRegions.length;
    globalMeanLum /= extraRegions.length;

    // Spatial lookup of extra art regions by isometric cell (cellI, cellJ)
    const extraCellMap = new Map<string, ExtraArtRegion>();
    for (const r of extraRegions) {
        extraCellMap.set(`${r.cellI},${r.cellJ}`, r);
    }

    const strength = (settings.extraBlendStrength ?? settings.blendStrength ?? 85) / 100;
    const edgePx = Math.max(1, settings.extraEdgeWidth ?? settings.edgeWidth ?? 6);
    const detailKeep = (settings.detailPreservation ?? 70) / 100;
    const lumMatch = (settings.luminanceMatch ?? 50) / 100;
    const chromaMatch = (settings.chrominanceMatch ?? 40) / 100;
    const axis = settings.extraBlendAxis || 'horizontal';
    const doHoriz = axis === 'horizontal' || axis === 'both';
    const doVert = axis === 'vertical' || axis === 'both';

    for (const reg of extraRegions) {
        const w = reg.imgData.width;
        const h = reg.imgData.height;
        const outPixels = reg.imgData.data;

        // Find left/right screen-space neighbors among selected extra regions
        // In isometric projection:
        // Left on screen is (-i, +j) or (-i) or (+j)
        // Right on screen is (+i, -j) or (+i) or (-j)
        const leftNeighbor =
            extraCellMap.get(`${reg.cellI - 1},${reg.cellJ}`) ||
            extraCellMap.get(`${reg.cellI},${reg.cellJ + 1}`) ||
            extraCellMap.get(`${reg.cellI - 1},${reg.cellJ + 1}`);
        const rightNeighbor =
            extraCellMap.get(`${reg.cellI + 1},${reg.cellJ}`) ||
            extraCellMap.get(`${reg.cellI},${reg.cellJ - 1}`) ||
            extraCellMap.get(`${reg.cellI + 1},${reg.cellJ - 1}`);

        const topNeighbor =
            extraCellMap.get(`${reg.cellI - 1},${reg.cellJ - 1}`) ||
            extraCellMap.get(`${reg.cellI - 1},${reg.cellJ}`) ||
            extraCellMap.get(`${reg.cellI},${reg.cellJ - 1}`);
        const bottomNeighbor =
            extraCellMap.get(`${reg.cellI + 1},${reg.cellJ + 1}`) ||
            extraCellMap.get(`${reg.cellI + 1},${reg.cellJ}`) ||
            extraCellMap.get(`${reg.cellI},${reg.cellJ + 1}`);

        for (let py = 0; py < reg.eh; py++) {
            const rSpan = reg.rowSpans[py];
            if (!rSpan || !rSpan.valid) continue;

            const spanW = rSpan.maxX - rSpan.minX + 1;
            const normY = reg.eh > 1 ? py / (reg.eh - 1) : 0.5;

            for (let px = rSpan.minX; px <= rSpan.maxX; px++) {
                if (!reg.activeMask[py * reg.ew + px]) continue;

                const canvasX = reg.ex + px;
                const canvasY = reg.ey + py;
                if (canvasX < 0 || canvasX >= w || canvasY < 0 || canvasY >= h) continue;

                const dstIdx = (canvasY * w + canvasX) * 4;
                if (reg.origData[dstIdx + 3] < 10) continue;

                let r = reg.origData[dstIdx];
                let g = reg.origData[dstIdx + 1];
                let b = reg.origData[dstIdx + 2];

                const localLow = sampleExtraLowPass(reg, px, py);
                const grainR = r - localLow.r;
                const grainG = g - localLow.g;
                const grainB = b - localLow.b;

                const uRow = spanW > 1 ? (px - rSpan.minX) / (spanW - 1) : 0.5;
                const cSpan = reg.colSpans[px];
                const spanH = cSpan && cSpan.valid ? cSpan.maxY - cSpan.minY + 1 : 1;
                const vCol = cSpan && cSpan.valid && spanH > 1 ? (py - cSpan.minY) / (spanH - 1) : 0.5;

                // Step A: Luminance & Chrominance Equalization across cliff/extra art
                if (lumMatch > 0 || chromaMatch > 0) {
                    const edgeProx = Math.max(Math.abs(uRow - 0.5) * 2, Math.abs(vCol - 0.5) * 2);
                    const radialWeight = evalExtraCurve(edgeProx, 'smoothstep');

                    if (lumMatch > 0) {
                        const localLum = 0.299 * localLow.r + 0.587 * localLow.g + 0.114 * localLow.b;
                        const targetLum = globalMeanLum * lumMatch + reg.meanLum * (1 - lumMatch);
                        const lumDelta = (targetLum - localLum) * lumMatch * (0.35 + 0.65 * radialWeight);
                        r += lumDelta;
                        g += lumDelta;
                        b += lumDelta;
                    }

                    if (chromaMatch > 0) {
                        r += (globalMeanR - reg.meanR) * chromaMatch;
                        g += (globalMeanG - reg.meanG) * chromaMatch;
                        b += (globalMeanB - reg.meanB) * chromaMatch;
                    }
                }

                let targetR = r;
                let targetG = g;
                let targetB = b;

                // Step B: Horizontal Cliff Wall Seam Blending (Left <-> Right active silhouette edges per row)
                if (doHoriz && spanW >= 4) {
                    const distLeft = px - rSpan.minX;
                    const distRight = rSpan.maxX - px;
                    const distEdge = Math.min(distLeft, distRight);
                    const effBand = Math.min(edgePx, Math.floor(spanW * 0.48));

                    if (effBand >= 1 && distEdge < effBand) {
                        const rawT = 1 - distEdge / effBand;
                        const wH = 0.5 * evalExtraCurve(rawT, settings.blendCurve) * strength;
                        const isLeft = distLeft <= distRight;

                        const oppReg =
                            settings.stitchGridNeighbors && (isLeft ? leftNeighbor : rightNeighbor)
                                ? (isLeft ? leftNeighbor! : rightNeighbor!)
                                : settings.wrapOuterPerimeter || !settings.stitchGridNeighbors
                                ? reg
                                : null;

                        if (oppReg) {
                            const oppY = Math.max(
                                0,
                                Math.min(oppReg.eh - 1, Math.round(normY * (oppReg.eh - 1)))
                            );
                            const oppSpan = oppReg.rowSpans[oppY];
                            if (oppSpan && oppSpan.valid) {
                                const oppSpanW = oppSpan.maxX - oppSpan.minX + 1;
                                let sampleU: number;
                                if (settings.mode === 'mirror_blend') {
                                    sampleU = isLeft ? 1 - uRow - 0.04 : 1 - uRow + 0.04;
                                } else if (settings.mode === 'harmonic_bridge') {
                                    sampleU = isLeft ? 1 - uRow * 0.5 : 0.5 - (1 - uRow) * 0.5;
                                } else {
                                    sampleU = 1 - uRow;
                                }
                                sampleU = Math.max(0, Math.min(1, sampleU));
                                const oppX = Math.round(oppSpan.minX + sampleU * (oppSpanW - 1));

                                const oppLow = sampleExtraLowPass(oppReg, oppX, oppY);
                                const oppPx = sampleExtraPixel(oppReg, oppX, oppY);
                                const oppGrainR = oppPx.r - oppLow.r;
                                const oppGrainG = oppPx.g - oppLow.g;
                                const oppGrainB = oppPx.b - oppLow.b;

                                const blendedR =
                                    oppLow.r + grainR * detailKeep + oppGrainR * (1 - detailKeep) * 0.5;
                                const blendedG =
                                    oppLow.g + grainG * detailKeep + oppGrainG * (1 - detailKeep) * 0.5;
                                const blendedB =
                                    oppLow.b + grainB * detailKeep + oppGrainB * (1 - detailKeep) * 0.5;

                                targetR = targetR * (1 - wH) + blendedR * wH;
                                targetG = targetG * (1 - wH) + blendedG * wH;
                                targetB = targetB * (1 - wH) + blendedB * wH;
                            }
                        }
                    }
                }

                // Step C: Vertical Extra Art Seam Blending (Top <-> Bottom active column spans)
                if (doVert && cSpan && cSpan.valid && spanH >= 4) {
                    const distTop = py - cSpan.minY;
                    const distBottom = cSpan.maxY - py;
                    const distEdgeV = Math.min(distTop, distBottom);
                    const effBandV = Math.min(edgePx, Math.floor(spanH * 0.48));

                    if (effBandV >= 1 && distEdgeV < effBandV) {
                        const rawT = 1 - distEdgeV / effBandV;
                        const wV = 0.5 * evalExtraCurve(rawT, settings.blendCurve) * strength;
                        const isTop = distTop <= distBottom;

                        const oppReg =
                            settings.stitchGridNeighbors && (isTop ? topNeighbor : bottomNeighbor)
                                ? (isTop ? topNeighbor! : bottomNeighbor!)
                                : settings.wrapOuterPerimeter || !settings.stitchGridNeighbors
                                ? reg
                                : null;

                        if (oppReg) {
                            const normX = reg.ew > 1 ? px / (reg.ew - 1) : 0.5;
                            const oppX = Math.max(
                                0,
                                Math.min(oppReg.ew - 1, Math.round(normX * (oppReg.ew - 1)))
                            );
                            const oppColSpan = oppReg.colSpans[oppX];
                            if (oppColSpan && oppColSpan.valid) {
                                const oppSpanH = oppColSpan.maxY - oppColSpan.minY + 1;
                                const sampleV = Math.max(0, Math.min(1, 1 - vCol));
                                const oppY = Math.round(oppColSpan.minY + sampleV * (oppSpanH - 1));

                                const oppLow = sampleExtraLowPass(oppReg, oppX, oppY);
                                const oppPx = sampleExtraPixel(oppReg, oppX, oppY);
                                const oppGrainR = oppPx.r - oppLow.r;
                                const oppGrainG = oppPx.g - oppLow.g;
                                const oppGrainB = oppPx.b - oppLow.b;

                                const blendedR =
                                    oppLow.r + grainR * detailKeep + oppGrainR * (1 - detailKeep) * 0.5;
                                const blendedG =
                                    oppLow.g + grainG * detailKeep + oppGrainG * (1 - detailKeep) * 0.5;
                                const blendedB =
                                    oppLow.b + grainB * detailKeep + oppGrainB * (1 - detailKeep) * 0.5;

                                targetR = targetR * (1 - wV) + blendedR * wV;
                                targetG = targetG * (1 - wV) + blendedG * wV;
                                targetB = targetB * (1 - wV) + blendedB * wV;
                            }
                        }
                    }
                }

                if (settings.quantizeToPalette) {
                    const q = quantizeRGB(targetR, targetG, targetB);
                    outPixels[dstIdx] = q.r;
                    outPixels[dstIdx + 1] = q.g;
                    outPixels[dstIdx + 2] = q.b;
                } else {
                    outPixels[dstIdx] = Math.max(0, Math.min(255, Math.round(targetR)));
                    outPixels[dstIdx + 1] = Math.max(0, Math.min(255, Math.round(targetG)));
                    outPixels[dstIdx + 2] = Math.max(0, Math.min(255, Math.round(targetB)));
                }
            }
        }
    }
}
