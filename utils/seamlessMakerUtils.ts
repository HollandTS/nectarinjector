import type { CanvasImage, GridType, RgbaColor } from '../types';
import { GRID_CONFIGS } from '../constants';
import { getOpenTsDiamondSpans, isInsideOpenTsDiamond } from './openTsTileRenderer';
import { parseTmpFile, getTmpMinOffsets, updateTmpFileFromCanvas, loadDefaultPalette, PaletteColor } from './westwoodTmpParser';
import { getLoadedPalette } from './paletteViewerHelper';
import { TmpParser } from './formats';
import { loadImage } from './textureInjection';
import { applyKeyColorToCanvas } from './transparencyKeyHelper';
import {
    SeamlessExtraTargetMode,
    SeamlessExtraBlendAxis,
    ExtraArtRegion,
    buildExtraArtRegion,
    processSeamlessExtraArtRegions,
} from './seamlessExtraArtHelper';

export type { SeamlessExtraTargetMode, SeamlessExtraBlendAxis };

export type SeamlessBlendCurve = 'cosine' | 'smoothstep' | 'linear';
export type SeamlessEdgeDirection = 'ne_sw' | 'nw_se' | 'both';
export type SeamlessSynthesisMode = 'mirror_blend' | 'opposite_wrap' | 'harmonic_bridge' | 'neighbor_stitch';

export interface SeamlessMakerSettings {
    targetArea: SeamlessExtraTargetMode; // 'base_only' (Extra Art Disabled) | 'both' (Base + Extra Art) | 'extra_only' (Isolate Extra Art Only)
    mode: SeamlessSynthesisMode;
    edgeWidth: number;             // 1 to 14 diamond steps inward from the 4 isometric borders (default 6)
    blendStrength: number;         // 0 to 100% (default 85)
    blendCurve: SeamlessBlendCurve; // 'cosine' | 'smoothstep' | 'linear'
    edgeDirection: SeamlessEdgeDirection; // 'both' | 'ne_sw' | 'nw_se'
    // Extra Art (Cliff / Overhang) Specific Controls
    extraBlendAxis: SeamlessExtraBlendAxis; // 'horizontal' | 'vertical' | 'both'
    extraEdgeWidth: number;        // 1 to 18px inward from cliff silhouette edges (default 7)
    extraBlendStrength: number;    // 0 to 100% (default 85)
    // Corner Diamond Vertex Equalizer (eliminates 4-way grid cross intersections at Top/Right/Bottom/Left apexes)
    cornerEqualizer: number;       // 0 to 100% (default 65)
    cornerRadius: number;          // 2 to 12px (default 5)
    // OpenTS Low/High Color & Luminance Equalizer (inspired by Build_Preview_Tiles LowColor/HighColor in isotype.cpp)
    luminanceMatch: number;        // 0 to 100% (default 50) - removes dark/bright edge vignetting across tiles
    chrominanceMatch: number;      // 0 to 100% (default 40) - harmonizes hue/tint across selected tiles
    // Detail & Crispness Preservation (prevents blurry mush while removing the seam)
    detailPreservation: number;    // 0 to 100% (default 70) - preserves high-frequency stone/grass/sand grain
    // Multi-Tile Neighbor Awareness (when multiple adjacent tiles are selected on the grid)
    stitchGridNeighbors: boolean;  // true by default - blends shared edges between adjacent selected tiles on the canvas
    wrapOuterPerimeter: boolean;   // true by default - wraps outer perimeter edges so the whole block tiles seamlessly
    // Palette quantization option (locks colors to active Westwood/OpenTS 256-color palette)
    quantizeToPalette: boolean;    // false by default (or true for strict .TMP index fidelity)
    protectExtraArtwork: boolean;  // legacy/synced with targetArea === 'base_only'
}

export const DEFAULT_SEAMLESS_SETTINGS: SeamlessMakerSettings = {
    targetArea: 'base_only',
    mode: 'opposite_wrap',
    edgeWidth: 6,
    blendStrength: 85,
    blendCurve: 'cosine',
    edgeDirection: 'both',
    extraBlendAxis: 'horizontal',
    extraEdgeWidth: 7,
    extraBlendStrength: 85,
    cornerEqualizer: 65,
    cornerRadius: 5,
    luminanceMatch: 50,
    chrominanceMatch: 40,
    detailPreservation: 70,
    stitchGridNeighbors: true,
    wrapOuterPerimeter: true,
    quantizeToPalette: false,
    protectExtraArtwork: true,
};

interface SubTileDiamondRegion {
    tileId: string;
    subSlot: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    imgData: ImageData;
    origData: Uint8ClampedArray;
    // Offset of this diamond inside the tile's image canvas
    bx: number;
    by: number;
    cx: number;
    cy: number;
    // Global isometric grid cell coordinates (i, j) of this sub-tile
    cellI: number;
    cellJ: number;
    meanR: number;
    meanG: number;
    meanB: number;
    meanLum: number;
}

function evalCurve(t: number, curve: SeamlessBlendCurve): number {
    const c = Math.max(0, Math.min(1, t));
    if (curve === 'linear') return c;
    if (curve === 'smoothstep') return c * c * (3 - 2 * c);
    // 'cosine'
    return 0.5 - 0.5 * Math.cos(c * Math.PI);
}

/**
 * Converts a local diamond pixel (lx, ly) inside a (cx, cy) OpenTS diamond
 * into normalized isometric UV coordinates (u, v) in [0, 1] x [0, 1],
 * where:
 * - u = 0 is the Top-Left (NW) edge
 * - u = 1 is the Bottom-Right (SE) edge
 * - v = 0 is the Top-Right (NE) edge
 * - v = 1 is the Bottom-Left (SW) edge
 */
export function diamondPixelToIsoUV(lx: number, ly: number, cx: number, cy: number): { u: number; v: number } {
    const halfW = cx / 2;
    const halfH = (cy - 1) / 2; // OpenTS active diamond height is cy - 1 (row halfH - 1 is center)
    const centerX = halfW - 0.5;
    const centerY = halfH;

    const dx = (lx - centerX) / halfW;
    const dy = (ly - centerY) / halfH;

    // In isometric projection:
    // dx = u - v
    // dy = u + v - 1
    // Therefore:
    // u = (dx + dy + 1) / 2
    // v = (dy - dx + 1) / 2
    const u = Math.max(0, Math.min(1, (dx + dy + 1) * 0.5));
    const v = Math.max(0, Math.min(1, (dy - dx + 1) * 0.5));
    return { u, v };
}

/**
 * Converts normalized isometric UV coordinates (u, v) in [0, 1] x [0, 1]
 * back into integer local diamond pixel coordinates (lx, ly) clamped inside the OpenTS `_tilemask`.
 */
export function isoUVToDiamondPixel(u: number, v: number, cx: number, cy: number): { lx: number; ly: number } {
    const halfW = cx / 2;
    const halfH = (cy - 1) / 2;
    const centerX = halfW - 0.5;
    const centerY = halfH;

    const cu = Math.max(0, Math.min(1, u));
    const cv = Math.max(0, Math.min(1, v));

    const dx = cu - cv;
    const dy = cu + cv - 1;

    const rawY = Math.round(centerY + dy * halfH);
    const ly = Math.max(0, Math.min(cy - 2, rawY));

    const spans = getOpenTsDiamondSpans(cx, cy);
    const span = spans[ly];
    if (!span || span.runLength <= 0) {
        return { lx: Math.floor(halfW), ly: 0 };
    }

    const rawX = Math.round(centerX + dx * halfW);
    const lx = Math.max(span.startCol, Math.min(span.startCol + span.runLength - 1, rawX));
    return { lx, ly };
}

function sampleRegionPixel(
    reg: SubTileDiamondRegion,
    lx: number,
    ly: number
): { r: number; g: number; b: number; a: number } {
    const w = reg.imgData.width;
    const h = reg.imgData.height;
    const px = Math.max(0, Math.min(w - 1, reg.bx + lx));
    const py = Math.max(0, Math.min(h - 1, reg.by + ly));
    const idx = (py * w + px) * 4;
    return {
        r: reg.origData[idx],
        g: reg.origData[idx + 1],
        b: reg.origData[idx + 2],
        a: reg.origData[idx + 3],
    };
}

function sampleLocalLowPass(
    reg: SubTileDiamondRegion,
    lx: number,
    ly: number
): { r: number; g: number; b: number } {
    let sr = 0, sg = 0, sb = 0, count = 0;
    const offsets = [
        [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1],
        [-2, 0], [2, 0], [0, -2], [0, 2]
    ];
    for (const [ox, oy] of offsets) {
        const nx = lx + ox;
        const ny = ly + oy;
        if (isInsideOpenTsDiamond(nx, ny, reg.cx, reg.cy)) {
            const p = sampleRegionPixel(reg, nx, ny);
            if (p.a > 10) {
                sr += p.r;
                sg += p.g;
                sb += p.b;
                count++;
            }
        }
    }
    if (count === 0) {
        const c = sampleRegionPixel(reg, lx, ly);
        return { r: c.r, g: c.g, b: c.b };
    }
    return { r: sr / count, g: sg / count, b: sb / count };
}

/**
 * Processes a set of selected CanvasImage isotiles to make their OpenTS diamond edges
 * transition seamlessly without visible tessellation lines.
 */
export async function processSeamlessIsotiles(
    selectedTiles: CanvasImage[],
    gridType: GridType,
    settings: SeamlessMakerSettings,
    transparencyColor: RgbaColor | null,
    tolerance: number,
    activePalette?: PaletteColor[] | null
): Promise<Map<string, CanvasImage>> {
    const result = new Map<string, CanvasImage>();
    if (selectedTiles.length === 0) return result;

    const activeGrid = gridType === 'none' ? 'ts_full' : gridType;
    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
    const loadedPal = activePalette && activePalette.length > 0 ? activePalette : getLoadedPalette();
    const palette = loadedPal && loadedPal.length > 0 ? loadedPal : await loadDefaultPalette();

    const tileCanvases = new Map<
        string,
        {
            tile: CanvasImage;
            canvas: HTMLCanvasElement;
            ctx: CanvasRenderingContext2D;
            imgData: ImageData;
            origData: Uint8ClampedArray;
            parsedTmp: ReturnType<typeof parseTmpFile> | null;
        }
    >();

    const allRegions: SubTileDiamondRegion[] = [];
    const allExtraRegions: ExtraArtRegion[] = [];

    // 1. Load each selected tile and extract its sub-tile diamond regions & cliff/extra-art regions
    for (const tile of selectedTiles) {
        const img = await loadImage(tile.src);
        if (!img) continue;

        const w = tile.width || img.width;
        const h = tile.height || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;

        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (tile.flipH || tile.flipV) {
            ctx.translate(tile.flipH ? w : 0, tile.flipV ? h : 0);
            ctx.scale(tile.flipH ? -1 : 1, tile.flipV ? -1 : 1);
        }
        ctx.drawImage(img, 0, 0);
        ctx.restore();

        if (transparencyColor && !tile.tmpBuffer) {
            applyKeyColorToCanvas(ctx, transparencyColor, tolerance);
        }

        const imgData = ctx.getImageData(0, 0, w, h);
        const origData = new Uint8ClampedArray(imgData.data);

        let parsedTmp: ReturnType<typeof parseTmpFile> | null = null;
        let addedSubRegions = false;

        if (tile.tmpBuffer) {
            try {
                parsedTmp = parseTmpFile(tile.tmpBuffer);
                const offsets = getTmpMinOffsets(parsedTmp);
                const minX = offsets.rawMinX;
                const minY = offsets.rawMinY;
                const mult = parsedTmp.cy / 2;
                const cbx = Math.max(1, parsedTmp.cblocks_x);

                parsedTmp.tiles.forEach((sub, slotIdx) => {
                    if (!sub || !sub.header) return;
                    const sh = sub.header;
                    const elev = (sh.height || 0) * mult;
                    const bx = sh.x - minX;
                    const by = (sh.y - elev) - minY;
                    const subCol = slotIdx % cbx;
                    const subRow = Math.floor(slotIdx / cbx);

                    const reg = buildSubTileRegion(
                        tile.id,
                        slotIdx,
                        canvas,
                        ctx,
                        imgData,
                        origData,
                        bx,
                        by,
                        sub.cx,
                        sub.cy,
                        tile.gridX + subCol,
                        tile.gridY + subRow
                    );
                    allRegions.push(reg);
                    addedSubRegions = true;

                    if (sh.has_extra_data && sub.extraImageData && sh.cx_extra > 0 && sh.cy_extra > 0) {
                        const ex = sh.x_extra - minX;
                        const ey = (sh.y_extra - elev) - minY;
                        const extraReg = buildExtraArtRegion(
                            tile.id,
                            slotIdx,
                            canvas,
                            ctx,
                            imgData,
                            origData,
                            ex,
                            ey,
                            sh.cx_extra,
                            sh.cy_extra,
                            bx,
                            by,
                            sub.cx,
                            sub.cy,
                            tile.gridX + subCol,
                            tile.gridY + subRow,
                            sub
                        );
                        if (extraReg) allExtraRegions.push(extraReg);
                    }
                });
            } catch {
                parsedTmp = null;
            }
        }

        if (!addedSubRegions) {
            // Standard single or composite PNG tile
            const subCx = w >= config.width ? config.width : w;
            const subCy = h >= config.height ? config.height : h;
            const bx = Math.round((w - subCx) / 2);
            const by = h - subCy;

            const reg = buildSubTileRegion(
                tile.id,
                0,
                canvas,
                ctx,
                imgData,
                origData,
                bx,
                by,
                subCx,
                subCy,
                tile.gridX,
                tile.gridY
            );
            allRegions.push(reg);

            // If this PNG isotile has pixels extending outside/above the base diamond (e.g. PNG cliff),
            // build an ExtraArtRegion for those extra pixels too.
            const extraReg = buildExtraArtRegion(
                tile.id,
                0,
                canvas,
                ctx,
                imgData,
                origData,
                0,
                0,
                w,
                h,
                bx,
                by,
                subCx,
                subCy,
                tile.gridX,
                tile.gridY,
                null
            );
            if (extraReg) allExtraRegions.push(extraReg);
        }

        tileCanvases.set(tile.id, {
            tile,
            canvas,
            ctx,
            imgData,
            origData,
            parsedTmp,
        });
    }

    if (allRegions.length === 0 && allExtraRegions.length === 0) return result;

    // Palette lookup cache for optional strict 256-color quantization
    const palCache = new Map<number, { r: number; g: number; b: number }>();
    const quantizeRGB = (r: number, g: number, b: number) => {
        const ir = Math.max(0, Math.min(255, Math.round(r)));
        const ig = Math.max(0, Math.min(255, Math.round(g)));
        const ib = Math.max(0, Math.min(255, Math.round(b)));
        const key = (ir << 16) | (ig << 8) | ib;
        const cached = palCache.get(key);
        if (cached) return cached;
        let best = palette[1] || { r: ir, g: ig, b: ib };
        let minD = Infinity;
        for (let i = 1; i < palette.length; i++) {
            const p = palette[i];
            const d = (p.r - ir) ** 2 + (p.g - ig) ** 2 + (p.b - ib) ** 2;
            if (d < minD) {
                minD = d;
                best = p;
            }
        }
        palCache.set(key, best);
        return best;
    };

    const targetMode = settings.targetArea || (settings.protectExtraArtwork ? 'base_only' : 'both');
    const doBaseDiamond = targetMode === 'base_only' || targetMode === 'both';
    const doExtraArt = targetMode === 'extra_only' || targetMode === 'both';

    // 2. Process Base Isometric Diamonds (if enabled)
    if (doBaseDiamond && allRegions.length > 0) {
        let globalMeanR = 0, globalMeanG = 0, globalMeanB = 0, globalMeanLum = 0;
        for (const r of allRegions) {
            globalMeanR += r.meanR;
            globalMeanG += r.meanG;
            globalMeanB += r.meanB;
            globalMeanLum += r.meanLum;
        }
        globalMeanR /= allRegions.length;
        globalMeanG /= allRegions.length;
        globalMeanB /= allRegions.length;
        globalMeanLum /= allRegions.length;

        const cellMap = new Map<string, SubTileDiamondRegion>();
        for (const r of allRegions) {
            cellMap.set(`${r.cellI},${r.cellJ}`, r);
        }

        const cornerSamples: { r: number; g: number; b: number }[] = [];
        for (const r of allRegions) {
            const topPx = isoUVToDiamondPixel(0.04, 0.04, r.cx, r.cy);
            const rightPx = isoUVToDiamondPixel(0.96, 0.04, r.cx, r.cy);
            const bottomPx = isoUVToDiamondPixel(0.96, 0.96, r.cx, r.cy);
            const leftPx = isoUVToDiamondPixel(0.04, 0.96, r.cx, r.cy);
            for (const pt of [topPx, rightPx, bottomPx, leftPx]) {
                const c = sampleLocalLowPass(r, pt.lx, pt.ly);
                cornerSamples.push(c);
            }
        }
        const avgCorner = cornerSamples.reduce(
            (acc, c) => ({ r: acc.r + c.r / cornerSamples.length, g: acc.g + c.g / cornerSamples.length, b: acc.b + c.b / cornerSamples.length }),
            { r: 0, g: 0, b: 0 }
        );

        const strength = (settings.blendStrength ?? 85) / 100;
        const detailKeep = (settings.detailPreservation ?? 70) / 100;
        const lumMatch = (settings.luminanceMatch ?? 50) / 100;
        const chromaMatch = (settings.chrominanceMatch ?? 40) / 100;
        const cornerEq = (settings.cornerEqualizer ?? 65) / 100;

        const bandUV = Math.max(0.04, Math.min(0.48, (settings.edgeWidth || 6) / 24));
        const cornerBandUV = Math.max(0.05, Math.min(0.42, (settings.cornerRadius || 5) / 24));

        for (const reg of allRegions) {
            const w = reg.imgData.width;
            const h = reg.imgData.height;
            const outPixels = reg.imgData.data;

            // Always avoid overwriting extra-art pixels during the base diamond pass;
            // if targetMode === 'both', the dedicated Extra Art pass will process them right after.
            const parentInfo = tileCanvases.get(reg.tileId);
            const subTileObj = parentInfo?.parsedTmp?.tiles[reg.subSlot] || null;
            const hasExtra = Boolean(
                subTileObj &&
                subTileObj.header.has_extra_data &&
                subTileObj.extraImageData
            );
            const extraMinX = hasExtra && subTileObj ? subTileObj.header.x_extra - (subTileObj.header.x - reg.bx) : 0;
            const extraMinY =
                hasExtra && subTileObj
                    ? subTileObj.header.y_extra -
                      (subTileObj.header.height || 0) * (reg.cy / 2) -
                      (subTileObj.header.y - (subTileObj.header.height || 0) * (reg.cy / 2) - reg.by)
                    : 0;

            const neighborNW = cellMap.get(`${reg.cellI - 1},${reg.cellJ}`);
            const neighborSE = cellMap.get(`${reg.cellI + 1},${reg.cellJ}`);
            const neighborNE = cellMap.get(`${reg.cellI},${reg.cellJ - 1}`);
            const neighborSW = cellMap.get(`${reg.cellI},${reg.cellJ + 1}`);

            for (let ly = 0; ly < reg.cy - 1; ly++) {
                for (let lx = 0; lx < reg.cx; lx++) {
                    if (!isInsideOpenTsDiamond(lx, ly, reg.cx, reg.cy)) continue;

                    const canvasX = reg.bx + lx;
                    const canvasY = reg.by + ly;
                    if (canvasX < 0 || canvasX >= w || canvasY < 0 || canvasY >= h) continue;

                    if (hasExtra && subTileObj && subTileObj.extraImageData) {
                        const ex = canvasX - extraMinX;
                        const ey = canvasY - extraMinY;
                        const ew = subTileObj.header.cx_extra;
                        const eh = subTileObj.header.cy_extra;
                        if (ex >= 0 && ex < ew && ey >= 0 && ey < eh) {
                            if (subTileObj.extraImageData[ey * ew + ex] !== 0) {
                                continue;
                            }
                        }
                    }

                    const dstIdx = (canvasY * w + canvasX) * 4;
                    const baseA = reg.origData[dstIdx + 3];
                    if (baseA < 10) continue;

                    let r = reg.origData[dstIdx];
                    let g = reg.origData[dstIdx + 1];
                    let b = reg.origData[dstIdx + 2];

                    const localLow = sampleLocalLowPass(reg, lx, ly);
                    const grainR = r - localLow.r;
                    const grainG = g - localLow.g;
                    const grainB = b - localLow.b;

                    const { u, v } = diamondPixelToIsoUV(lx, ly, reg.cx, reg.cy);

                    if (lumMatch > 0 || chromaMatch > 0) {
                        const edgeProximity = Math.max(
                            Math.abs(u - 0.5) * 2,
                            Math.abs(v - 0.5) * 2
                        );
                        const radialWeight = evalCurve(edgeProximity, 'smoothstep');

                        if (lumMatch > 0) {
                            const localLum = 0.299 * localLow.r + 0.587 * localLow.g + 0.114 * localLow.b;
                            const targetLum = globalMeanLum * lumMatch + reg.meanLum * (1 - lumMatch);
                            const lumDelta = (targetLum - localLum) * lumMatch * (0.35 + 0.65 * radialWeight);
                            r += lumDelta;
                            g += lumDelta;
                            b += lumDelta;
                        }

                        if (chromaMatch > 0) {
                            const dr = (globalMeanR - reg.meanR) * chromaMatch;
                            const dg = (globalMeanG - reg.meanG) * chromaMatch;
                            const db = (globalMeanB - reg.meanB) * chromaMatch;
                            r += dr;
                            g += dg;
                            b += db;
                        }
                    }

                    const doU = settings.edgeDirection === 'both' || settings.edgeDirection === 'nw_se';
                    const doV = settings.edgeDirection === 'both' || settings.edgeDirection === 'ne_sw';

                    let targetR = r;
                    let targetG = g;
                    let targetB = b;

                    if (doU) {
                        const distU = Math.min(u, 1 - u);
                        if (distU < bandUV) {
                            const rawT = 1 - distU / bandUV;
                            const wU = 0.5 * evalCurve(rawT, settings.blendCurve) * strength;

                            const isNW = u < 0.5;
                            const oppRegion =
                                settings.stitchGridNeighbors && (isNW ? neighborNW : neighborSE)
                                    ? (isNW ? neighborNW! : neighborSE!)
                                    : settings.wrapOuterPerimeter || !settings.stitchGridNeighbors
                                    ? reg
                                    : null;

                            if (oppRegion) {
                                let sampleU: number;
                                const sampleV = v;
                                if (settings.mode === 'mirror_blend') {
                                    sampleU = isNW ? 1 - u - 0.02 : 1 - u + 0.02;
                                } else if (settings.mode === 'harmonic_bridge') {
                                    sampleU = isNW ? 1 - u * 0.5 : 0.5 - (1 - u) * 0.5;
                                } else {
                                    sampleU = 1 - u;
                                }
                                const oppPt = isoUVToDiamondPixel(sampleU, sampleV, oppRegion.cx, oppRegion.cy);
                                const oppLow = sampleLocalLowPass(oppRegion, oppPt.lx, oppPt.ly);
                                const oppPx = sampleRegionPixel(oppRegion, oppPt.lx, oppPt.ly);
                                const oppGrainR = oppPx.r - oppLow.r;
                                const oppGrainG = oppPx.g - oppLow.g;
                                const oppGrainB = oppPx.b - oppLow.b;

                                const blendedR =
                                    oppLow.r + grainR * detailKeep + oppGrainR * (1 - detailKeep) * 0.5;
                                const blendedG =
                                    oppLow.g + grainG * detailKeep + oppGrainG * (1 - detailKeep) * 0.5;
                                const blendedB =
                                    oppLow.b + grainB * detailKeep + oppGrainB * (1 - detailKeep) * 0.5;

                                targetR = targetR * (1 - wU) + blendedR * wU;
                                targetG = targetG * (1 - wU) + blendedG * wU;
                                targetB = targetB * (1 - wU) + blendedB * wU;
                            }
                        }
                    }

                    if (doV) {
                        const distV = Math.min(v, 1 - v);
                        if (distV < bandUV) {
                            const rawT = 1 - distV / bandUV;
                            const wV = 0.5 * evalCurve(rawT, settings.blendCurve) * strength;

                            const isNE = v < 0.5;
                            const oppRegion =
                                settings.stitchGridNeighbors && (isNE ? neighborNE : neighborSW)
                                    ? (isNE ? neighborNE! : neighborSW!)
                                    : settings.wrapOuterPerimeter || !settings.stitchGridNeighbors
                                    ? reg
                                    : null;

                            if (oppRegion) {
                                const sampleU = u;
                                let sampleV: number;
                                if (settings.mode === 'mirror_blend') {
                                    sampleV = isNE ? 1 - v - 0.02 : 1 - v + 0.02;
                                } else if (settings.mode === 'harmonic_bridge') {
                                    sampleV = isNE ? 1 - v * 0.5 : 0.5 - (1 - v) * 0.5;
                                } else {
                                    sampleV = 1 - v;
                                }
                                const oppPt = isoUVToDiamondPixel(sampleU, sampleV, oppRegion.cx, oppRegion.cy);
                                const oppLow = sampleLocalLowPass(oppRegion, oppPt.lx, oppPt.ly);
                                const oppPx = sampleRegionPixel(oppRegion, oppPt.lx, oppPt.ly);
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

                    if (cornerEq > 0) {
                        const distToCorner = Math.min(
                            Math.hypot(u, v),
                            Math.hypot(1 - u, v),
                            Math.hypot(u, 1 - v),
                            Math.hypot(1 - u, 1 - v)
                        );
                        if (distToCorner < cornerBandUV) {
                            const cT = 1 - distToCorner / cornerBandUV;
                            const wCorner = 0.65 * evalCurve(cT, settings.blendCurve) * cornerEq * strength;
                            const cornerR = avgCorner.r + grainR * detailKeep * 0.7;
                            const cornerG = avgCorner.g + grainG * detailKeep * 0.7;
                            const cornerB = avgCorner.b + grainB * detailKeep * 0.7;

                            targetR = targetR * (1 - wCorner) + cornerR * wCorner;
                            targetG = targetG * (1 - wCorner) + cornerG * wCorner;
                            targetB = targetB * (1 - wCorner) + cornerB * wCorner;
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

    // 3. Process Cliff / Extra Art Regions (`ExtraImage`) if enabled ('extra_only' or 'both')
    if (doExtraArt && allExtraRegions.length > 0) {
        processSeamlessExtraArtRegions(allExtraRegions, settings, quantizeRGB);
    }

    // 4. Write modified ImageData back to each tile's canvas (and update .TMP binary buffer if present)
    for (const [tileId, info] of tileCanvases.entries()) {
        info.ctx.putImageData(info.imgData, 0, 0);
        const newSrc = info.canvas.toDataURL('image/png');

        let updatedTmpBuffer = info.tile.tmpBuffer;
        if (info.parsedTmp && info.tile.tmpBuffer) {
            try {
                updateTmpFileFromCanvas(info.canvas, info.parsedTmp, palette);
                updatedTmpBuffer = TmpParser.writeTmp(info.parsedTmp);
            } catch {
                // Keep existing tmpBuffer if binary re-encode fails
            }
        }

        result.set(tileId, {
            ...info.tile,
            src: newSrc,
            originalSrc: newSrc,
            flipH: false,
            flipV: false,
            tmpBuffer: updatedTmpBuffer,
        });
    }

    return result;
}

function buildSubTileRegion(
    tileId: string,
    subSlot: number,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    imgData: ImageData,
    origData: Uint8ClampedArray,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    cellI: number,
    cellJ: number
): SubTileDiamondRegion {
    const w = imgData.width;
    const h = imgData.height;
    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let ly = 0; ly < cy - 1; ly++) {
        for (let lx = 0; lx < cx; lx++) {
            if (!isInsideOpenTsDiamond(lx, ly, cx, cy)) continue;
            const px = bx + lx;
            const py = by + ly;
            if (px < 0 || px >= w || py < 0 || py >= h) continue;
            const idx = (py * w + px) * 4;
            if (origData[idx + 3] < 10) continue;
            sumR += origData[idx];
            sumG += origData[idx + 1];
            sumB += origData[idx + 2];
            count++;
        }
    }

    const meanR = count > 0 ? sumR / count : 128;
    const meanG = count > 0 ? sumG / count : 128;
    const meanB = count > 0 ? sumB / count : 128;
    const meanLum = 0.299 * meanR + 0.587 * meanG + 0.114 * meanB;

    return {
        tileId,
        subSlot,
        canvas,
        ctx,
        imgData,
        origData,
        bx,
        by,
        cx,
        cy,
        cellI,
        cellJ,
        meanR,
        meanG,
        meanB,
        meanLum,
    };
}
