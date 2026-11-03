import type { CanvasImage, ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { isoToScreen } from './geoUtils';
import { Tile, TmpParser, RGB } from './formats';
import { getTmpMinOffsets, loadDefaultPalette } from './westwoodTmpParser';
import { getLoadedPalette } from './paletteViewerHelper';
import {
    ensureTmpFileForCanvasImage,
    findClosestPaletteColorIndex,
    unpremultiplyAndDefringeRgb,
} from './extraImageTemplates';
import {
    generateExtraImageZData,
    generateTileBaseZData,
    repairTileExtraAndBaseZ,
} from './extraImageZHelper';
import { loadImage } from './textureInjection';
import {
    sampleIsolatedSourceForTile,
    ExtraImageBakeOptions,
} from './extraImageSourceSampler';
import {
    evaluateOutsidePixelMask,
    OutsidePixelPresetId,
} from './extraOutsidePixelPresets';

export type OutsidePixelColorSource = 'tile_edge' | 'active_source';

function sampleInteriorDiamondCoord(
    relX: number,
    relY: number,
    cx: number,
    cy: number,
    seed: number
): { ix: number; iy: number } {
    const centerX = (cx - 1) * 0.5;
    const centerY = (cy - 1) * 0.5;
    const hw = cx * 0.5;
    const hh = cy * 0.5;

    const vx = relX - centerX;
    const vy = relY - centerY;
    const normDist = Math.max(0.001, Math.abs(vx) / hw + Math.abs(vy) / hh);

    let h = (relX * 374761393 + relY * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const rand01 = ((h ^ (h >>> 16)) >>> 0) / 4294967296;

    // Sample 1 to 4 pixels inside the nearest diamond edge for organic texture continuation
    const inwardScale = (0.68 + rand01 * 0.24) / normDist;
    let ix = Math.round(centerX + vx * inwardScale);
    let iy = Math.round(centerY + vy * inwardScale);

    ix = Math.max(0, Math.min(cx - 1, ix));
    iy = Math.max(0, Math.min(cy - 1, iy));

    if (!TmpParser.isInsideWestwoodDiamond(ix, iy, cx, cy)) {
        ix = Math.round(centerX);
        iy = Math.round(centerY);
    }
    return { ix, iy };
}

/**
 * Applies one or a randomized pool of Outside Pixel Presets around a tile's 1x1 diamond,
 * baking the spread into `extraImageData` and generating matching Westwood `extraZData` while
 * keeping the tile's existing 1x1 Base Diamond (including any prior Smart Layer bakes) 100% intact.
 */
export async function applyOutsidePixelPresetToTile(
    image: CanvasImage,
    presetOrPool: OutsidePixelPresetId | OutsidePixelPresetId[],
    spreadPx: number,
    colorSource: OutsidePixelColorSource,
    options: ExtraImageBakeOptions,
    overlays: ProjectOverlay[],
    gridType: GridType,
    seedOffset: number = 0,
    keepExistingExtra: boolean = false,
    customPalette?: RGB[] | null
): Promise<CanvasImage> {
    const presetPool: OutsidePixelPresetId[] = Array.isArray(presetOrPool)
        ? presetOrPool.length > 0
            ? presetOrPool
            : ['oval_spray_classic']
        : [presetOrPool];

    const palette = customPalette || getLoadedPalette() || (await loadDefaultPalette());
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const cellW = config.width;
    const cellH = config.height;

    const currentImg = await loadImage(image.src);
    if (!currentImg) return image;

    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = image.width;
    imgCanvas.height = image.height;
    const imgCtx = imgCanvas.getContext('2d', { willReadFrequently: true })!;
    imgCtx.imageSmoothingEnabled = false;
    imgCtx.drawImage(currentImg, 0, 0);
    const prevImgPixels = imgCtx.getImageData(0, 0, image.width, image.height).data;

    const tmpFile = ensureTmpFileForCanvasImage(image.tmpBuffer, imgCanvas, cellW, cellH, palette);
    const prevOffsets = getTmpMinOffsets(tmpFile);

    const activeTiles = tmpFile.tiles
        .map((t, idx) => ({ tile: t, idx }))
        .filter((item): item is { tile: Tile; idx: number } => item.tile !== null);

    if (activeTiles.length === 0) return image;

    const rawPos = isoToScreen(image.gridX, image.gridY, cellW, cellH);
    const heightStepOffset = (image.heightLevel || 0) * (cellH / 2);
    const elevCancelY = prevOffsets.minY - prevOffsets.rawMinY;
    const originCanvasX = Math.round(rawPos.x - cellW / 2) + (image.offsetX || 0);
    const originCanvasY = Math.round(rawPos.y + elevCancelY - heightStepOffset) + (image.offsetY || 0);

    const mult = tmpFile.cy / 2;
    const spreadClamped = Math.max(2, Math.min(24, Math.round(spreadPx)));
    const pad = Math.ceil(spreadClamped * 1.45) + 2;
    const colorCache = new Map<number, number>();

    // Map of newly generated outside pixel RGBs in TMP space so image.src preserves exact Smart Layer RGBs
    const customRgbMap = new Map<string, { r: number; g: number; b: number }>();

    // Hash image ID for deterministic randomization across selected tiles
    let idHash = 0;
    for (let i = 0; i < image.id.length; i++) {
        idHash = (Math.imul(idHash, 31) + image.id.charCodeAt(i)) | 0;
    }

    for (let aIdx = 0; aIdx < activeTiles.length; aIdx++) {
        const { tile, idx: slotIdx } = activeTiles[aIdx];
        const h = tile.header;
        const elev = h.height * mult;
        const bx = h.x;
        const by = h.y - elev;

        const winMinX = bx - pad;
        const winMaxX = bx + tile.cx + pad - 1;
        const winMinY = by - pad;
        const winMaxY = by + tile.cy + pad - 1;
        const winW = winMaxX - winMinX + 1;
        const winH = winMaxY - winMinY + 1;

        let activeLayerPixels: Uint8ClampedArray | null = null;
        if (colorSource === 'active_source') {
            const targetDiamond = {
                id: `${image.id}:${slotIdx}`,
                centerX: originCanvasX + bx + tile.cx / 2,
                centerY: originCanvasY + by + tile.cy / 2,
                halfW: tile.cx / 2,
                halfH: tile.cy / 2,
            };
            const layerCanvas = await sampleIsolatedSourceForTile(
                originCanvasX + winMinX,
                originCanvasY + winMinY,
                winW,
                winH,
                { ...options, isolateObjectsPerTile: false },
                overlays,
                gridType,
                targetDiamond,
                [targetDiamond],
                'base_diamond'
            );
            if (layerCanvas) {
                const lCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;
                activeLayerPixels = lCtx.getImageData(0, 0, winW, winH).data;
            }
        }

        const hasExistingExtra =
            keepExistingExtra &&
            h.has_extra_data &&
            tile.extraImageData &&
            h.cx_extra > 0 &&
            h.cy_extra > 0;

        const exOldMinX = hasExistingExtra ? h.x_extra : Infinity;
        const exOldMinY = hasExistingExtra ? h.y_extra - elev : Infinity;
        const exOldMaxX = hasExistingExtra ? h.x_extra + h.cx_extra - 1 : -Infinity;
        const exOldMaxY = hasExistingExtra ? h.y_extra - elev + h.cy_extra - 1 : -Infinity;

        let boundMinX = exOldMinX;
        let boundMinY = exOldMinY;
        let boundMaxX = exOldMaxX;
        let boundMaxY = exOldMaxY;

        const tileSeed =
            1337 +
            seedOffset * 997 +
            (image.gridX * 73 + image.gridY * 151 + slotIdx * 31 + (idHash & 0xffff));

        // Pick preset deterministically per tile/sub-tile from the multi-selected pool
        let pickHash = (tileSeed * 2654435761) | 0;
        pickHash = Math.imul(pickHash ^ (pickHash >>> 13), 1274126177);
        const pickedPresetId =
            presetPool[Math.abs(pickHash ^ (pickHash >>> 16)) % presetPool.length];

        const candidates: { tx: number; ty: number; colorIdx: number }[] = [];

        for (let ty = winMinY; ty <= winMaxY; ty++) {
            const relY = ty - by;
            for (let tx = winMinX; tx <= winMaxX; tx++) {
                const relX = tx - bx;

                // Evaluate if this outside pixel is selected by the chosen spray/dither mask preset
                if (
                    !evaluateOutsidePixelMask(
                        pickedPresetId,
                        relX,
                        relY,
                        tile.cx,
                        tile.cy,
                        spreadClamped,
                        tileSeed
                    )
                ) {
                    continue;
                }

                // Prevent bleeding inside another sub-tile's base diamond in multi-tile TMPs
                if (activeTiles.length > 1) {
                    let insideOtherDiamond = false;
                    for (const other of activeTiles) {
                        if (other.idx === slotIdx) continue;
                        const oh = other.tile.header;
                        const oElev = oh.height * mult;
                        const orx = tx - oh.x;
                        const ory = ty - (oh.y - oElev);
                        if (
                            orx >= 0 &&
                            orx < other.tile.cx &&
                            ory >= 0 &&
                            ory < other.tile.cy &&
                            TmpParser.isInsideWestwoodDiamond(orx, ory, other.tile.cx, other.tile.cy)
                        ) {
                            insideOtherDiamond = true;
                            break;
                        }
                    }
                    if (insideOtherDiamond) continue;
                }

                let pickedR = 120;
                let pickedG = 105;
                let pickedB = 80;
                let pickedColorIdx = 0;

                // Try active source layer first if requested
                if (activeLayerPixels) {
                    const sx = tx - winMinX;
                    const sy = ty - winMinY;
                    const pOff = (sy * winW + sx) * 4;
                    const a = activeLayerPixels[pOff + 3];
                    if (a >= 90) {
                        const clean = unpremultiplyAndDefringeRgb(
                            activeLayerPixels[pOff],
                            activeLayerPixels[pOff + 1],
                            activeLayerPixels[pOff + 2],
                            a
                        );
                        pickedR = clean.r;
                        pickedG = clean.g;
                        pickedB = clean.b;
                        pickedColorIdx = findClosestPaletteColorIndex(pickedR, pickedG, pickedB, palette, colorCache);
                    }
                }

                // Sample from the tile's own interior diamond edge (matches exact tile colors & Smart Layer bake!)
                if (pickedColorIdx === 0) {
                    const { ix, iy } = sampleInteriorDiamondCoord(relX, relY, tile.cx, tile.cy, tileSeed);
                    const prevCanvasX = bx + ix - prevOffsets.rawMinX;
                    const prevCanvasY = by + iy - prevOffsets.rawMinY;

                    if (
                        prevCanvasX >= 0 &&
                        prevCanvasX < image.width &&
                        prevCanvasY >= 0 &&
                        prevCanvasY < image.height
                    ) {
                        const pOff = (prevCanvasY * image.width + prevCanvasX) * 4;
                        if (prevImgPixels[pOff + 3] >= 100) {
                            pickedR = prevImgPixels[pOff];
                            pickedG = prevImgPixels[pOff + 1];
                            pickedB = prevImgPixels[pOff + 2];
                            pickedColorIdx = findClosestPaletteColorIndex(
                                pickedR,
                                pickedG,
                                pickedB,
                                palette,
                                colorCache
                            );
                        }
                    }

                    if (pickedColorIdx === 0) {
                        const fallbackIdx = tile.data[iy * tile.cx + ix] || 1;
                        pickedColorIdx = fallbackIdx;
                        const palCol = palette[fallbackIdx] || { r: 120, g: 105, b: 80 };
                        pickedR = palCol.r;
                        pickedG = palCol.g;
                        pickedB = palCol.b;
                    }
                }

                candidates.push({ tx, ty, colorIdx: pickedColorIdx });
                customRgbMap.set(`${tx},${ty}`, { r: pickedR, g: pickedG, b: pickedB });
                boundMinX = Math.min(boundMinX, tx);
                boundMaxX = Math.max(boundMaxX, tx);
                boundMinY = Math.min(boundMinY, ty);
                boundMaxY = Math.max(boundMaxY, ty);
            }
        }

        if (boundMinX <= boundMaxX && boundMinY <= boundMaxY) {
            let newCxExtra = boundMaxX - boundMinX + 1;
            let newCyExtra = boundMaxY - boundMinY + 1;
            if (newCxExtra % 2 !== 0) newCxExtra++;
            if (newCyExtra % 2 !== 0) newCyExtra++;

            const newExtraImg = new Uint8Array(newCxExtra * newCyExtra);

            if (hasExistingExtra && tile.extraImageData) {
                const oldW = h.cx_extra;
                const oldH = h.cy_extra;
                const offX = exOldMinX - boundMinX;
                const offY = exOldMinY - boundMinY;
                for (let oy = 0; oy < oldH; oy++) {
                    for (let ox = 0; ox < oldW; ox++) {
                        const val = tile.extraImageData[oy * oldW + ox];
                        if (val !== 0) {
                            const nx = ox + offX;
                            const ny = oy + offY;
                            if (nx >= 0 && nx < newCxExtra && ny >= 0 && ny < newCyExtra) {
                                newExtraImg[ny * newCxExtra + nx] = val;
                            }
                        }
                    }
                }
            }

            for (const pt of candidates) {
                const nx = pt.tx - boundMinX;
                const ny = pt.ty - boundMinY;
                if (nx >= 0 && nx < newCxExtra && ny >= 0 && ny < newCyExtra) {
                    newExtraImg[ny * newCxExtra + nx] = pt.colorIdx;
                }
            }

            const newXExtra = boundMinX;
            const newYExtra = boundMinY + elev;
            const relXExtra = newXExtra - h.x;

            const newExtraZ = generateExtraImageZData(
                newCxExtra,
                newCyExtra,
                newExtraImg,
                relXExtra,
                tile.cx,
                tile.cy,
                options.zMode,
                options.customZValue ?? tile.cy - 1
            );

            tmpFile.tiles[slotIdx] = {
                ...tile,
                zData: tile.zData || generateTileBaseZData(tile.cx, tile.cy),
                extraImageData: newExtraImg,
                extraZData: newExtraZ,
                header: {
                    ...h,
                    has_extra_data: true,
                    has_z_data: true,
                    flags: h.flags | 0x01 | 0x02,
                    x_extra: newXExtra,
                    y_extra: newYExtra,
                    cx_extra: newCxExtra,
                    cy_extra: newCyExtra,
                },
            };
        } else {
            tmpFile.tiles[slotIdx] = repairTileExtraAndBaseZ(tile);
        }
    }

    // Render updated TMP and preserve exact Base Diamond RGB pixels from imgCanvas + exact sampled RGBs for outside pixels
    const newBuffer = TmpParser.writeTmp(tmpFile);
    const offsets = getTmpMinOffsets(tmpFile);
    const outCanvas = document.createElement('canvas');
    TmpParser.renderCompleteToCanvas(outCanvas, tmpFile, palette);

    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (outCtx && outCanvas.width > 0 && outCanvas.height > 0) {
        const outImgData = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
        const outData = outImgData.data;

        // 1. Restore exact Base Diamond RGB pixels from prevImgPixels (preserving Smart Layer bakes 100%)
        activeTiles.forEach(({ tile }) => {
            const h = tile.header;
            const elev = h.height * mult;
            const bx = h.x;
            const by = h.y - elev;

            for (let py = 0; py < tile.cy; py++) {
                for (let px = 0; px < tile.cx; px++) {
                    if (!TmpParser.isInsideWestwoodDiamond(px, py, tile.cx, tile.cy)) continue;
                    const prevX = bx + px - prevOffsets.rawMinX;
                    const prevY = by + py - prevOffsets.rawMinY;
                    const newX = bx + px - offsets.rawMinX;
                    const newY = by + py - offsets.rawMinY;
                    if (
                        prevX >= 0 &&
                        prevX < image.width &&
                        prevY >= 0 &&
                        prevY < image.height &&
                        newX >= 0 &&
                        newX < outCanvas.width &&
                        newY >= 0 &&
                        newY < outCanvas.height
                    ) {
                        const pOff = (prevY * image.width + prevX) * 4;
                        if (prevImgPixels[pOff + 3] >= 128) {
                            const nOff = (newY * outCanvas.width + newX) * 4;
                            outData[nOff] = prevImgPixels[pOff];
                            outData[nOff + 1] = prevImgPixels[pOff + 1];
                            outData[nOff + 2] = prevImgPixels[pOff + 2];
                            outData[nOff + 3] = 255;
                        }
                    }
                }
            }
        });

        // 2. Apply exact sampled RGBs to the newly sprayed outside pixels
        customRgbMap.forEach((rgb, key) => {
            const [txStr, tyStr] = key.split(',');
            const nx = parseInt(txStr, 10) - offsets.rawMinX;
            const ny = parseInt(tyStr, 10) - offsets.rawMinY;
            if (nx >= 0 && nx < outCanvas.width && ny >= 0 && ny < outCanvas.height) {
                const nOff = (ny * outCanvas.width + nx) * 4;
                if (outData[nOff + 3] > 0) {
                    outData[nOff] = rgb.r;
                    outData[nOff + 1] = rgb.g;
                    outData[nOff + 2] = rgb.b;
                }
            }
        });

        outCtx.putImageData(outImgData, 0, 0);
    }

    const finalSrc = outCanvas.toDataURL('image/png');
    return {
        ...image,
        src: finalSrc,
        originalSrc: finalSrc,
        width: outCanvas.width,
        height: outCanvas.height,
        tmpBuffer: newBuffer,
        tmpMinX: offsets.minX,
        tmpMinY: offsets.minY,
        tmpCols: offsets.cols,
        tmpRows: offsets.rows,
        tmpCells: offsets.cells,
        isIsotile: true,
    };
}
