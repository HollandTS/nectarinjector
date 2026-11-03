import type { CanvasImage, ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { isoToScreen } from './geoUtils';
import { Tile, TmpParser, RGB } from './formats';
import { getTmpMinOffsets, loadDefaultPalette, parseTmpFile } from './westwoodTmpParser';
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
    ExtraBakeSourceMode,
    ExtraImageBakeOptions,
} from './extraImageSourceSampler';
import {
    buildUpdatedCanvasImageFromTmp,
    applyExtraTemplateToTile,
    modifyTileExtraState,
} from './extraImageStateActions';
import type { TileDiamondSpec } from './threeDSceneCaptureHelper';

export type { ExtraBakeSourceMode, ExtraImageBakeOptions };
export { buildUpdatedCanvasImageFromTmp, applyExtraTemplateToTile, modifyTileExtraState };

/**
 * Collects the 1x1 diamond centers in canvas coordinates for a list of tiles,
 * allowing multi-tile bakes to partition scattered objects cleanly to their closest owning tile.
 */
export function collectTileDiamondSpecs(
    images: CanvasImage[],
    gridType: GridType
): TileDiamondSpec[] {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const cellW = config.width;
    const cellH = config.height;
    const specs: TileDiamondSpec[] = [];

    for (const img of images) {
        const rawPos = isoToScreen(img.gridX, img.gridY, cellW, cellH);
        const heightStepOffset = (img.heightLevel || 0) * (cellH / 2);

        if (img.tmpBuffer && img.tmpBuffer.byteLength >= 16) {
            try {
                const parsed = parseTmpFile(img.tmpBuffer);
                const alignOffsets = getTmpMinOffsets(parsed);
                const elevCancelY = alignOffsets.minY - alignOffsets.rawMinY;
                const originCanvasX = Math.round(rawPos.x - cellW / 2) + (img.offsetX || 0);
                const originCanvasY = Math.round(rawPos.y + elevCancelY - heightStepOffset) + (img.offsetY || 0);
                const mult = parsed.cy / 2;

                parsed.tiles.forEach((tile, slotIdx) => {
                    if (!tile) return;
                    const h = tile.header;
                    const elev = h.height * mult;
                    const bx = originCanvasX + h.x;
                    const by = originCanvasY + (h.y - elev);
                    specs.push({
                        id: `${img.id}:${slotIdx}`,
                        centerX: bx + tile.cx / 2,
                        centerY: by + tile.cy / 2,
                        halfW: tile.cx / 2,
                        halfH: tile.cy / 2,
                    });
                });
                continue;
            } catch {
                // fallback below
            }
        }

        const bx = Math.round(rawPos.x - cellW / 2) + (img.offsetX || 0);
        const by = Math.round(rawPos.y - heightStepOffset) + (img.offsetY || 0);
        specs.push({
            id: `${img.id}:0`,
            centerX: bx + cellW / 2,
            centerY: by + cellH / 2,
            halfW: cellW / 2,
            halfH: cellH / 2,
        });
    }

    return specs;
}

/**
 * Smartly scans for individual 3D scattered objects (trees, grass clumps, rocks, props) or 2D sprites
 * whose roots lie within `searchRadiusPx` of the tile's diamond, masks out all other objects, flat ground
 * planes, and black shadow planes, bakes the whole unclipped object silhouettes into `extraImageData`
 * (using index 0 for transparency), and generates Westwood-compliant `extraZData` (`blit.cpp` gradient).
 * Preserves any prior Smart Layer / Texture Injection bakes on the tile!
 */
export async function bakeSmartExtraImageToTile(
    image: CanvasImage,
    options: ExtraImageBakeOptions,
    overlays: ProjectOverlay[],
    gridType: GridType,
    allTargetDiamonds?: TileDiamondSpec[],
    customPalette?: RGB[] | null
): Promise<CanvasImage> {
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

    // Syncs current imgCanvas (including any prior Smart Layer bakes!) into tmpFile
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
    const alphaThresh = options.alphaThreshold ?? 140;
    const colorCache = new Map<number, number>();

    const localDiamonds: TileDiamondSpec[] = activeTiles.map(({ tile, idx }) => {
        const h = tile.header;
        const elev = h.height * mult;
        const bx = originCanvasX + h.x;
        const by = originCanvasY + (h.y - elev);
        return {
            id: `${image.id}:${idx}`,
            centerX: bx + tile.cx / 2,
            centerY: by + tile.cy / 2,
            halfW: tile.cx / 2,
            halfH: tile.cy / 2,
        };
    });

    const otherDiamondsPool =
        allTargetDiamonds && allTargetDiamonds.length > 0 ? allTargetDiamonds : localDiamonds;

    const silhouetteMargin = Math.max(140, Math.round(options.searchRadiusPx) + 110);
    const newlyStampedCoords = new Set<string>();

    for (let aIdx = 0; aIdx < activeTiles.length; aIdx++) {
        const { tile, idx: slotIdx } = activeTiles[aIdx];
        const targetDiamond = localDiamonds[aIdx];
        const h = tile.header;
        const elev = h.height * mult;
        const bx = h.x;
        const by = h.y - elev;

        // 1. Optional: Bake into the 1x1 Base Diamond with proper alpha-blending over existing ground pixels
        if (options.alsoBakeBaseDiamond) {
            const baseCropX = originCanvasX + bx;
            const baseCropY = originCanvasY + by;
            const baseCanvas = await sampleIsolatedSourceForTile(
                baseCropX,
                baseCropY,
                tile.cx,
                tile.cy,
                options,
                overlays,
                gridType,
                targetDiamond,
                otherDiamondsPool,
                'base_diamond'
            );

            if (baseCanvas) {
                const bCtx = baseCanvas.getContext('2d', { willReadFrequently: true })!;
                const bPixels = bCtx.getImageData(0, 0, tile.cx, tile.cy).data;
                const nextBase = new Uint8Array(tile.data);

                for (let py = 0; py < tile.cy; py++) {
                    for (let px = 0; px < tile.cx; px++) {
                        if (!TmpParser.isInsideWestwoodDiamond(px, py, tile.cx, tile.cy)) continue;
                        const pOff = (py * tile.cx + px) * 4;
                        const srcA = bPixels[pOff + 3];
                        if (srcA < 20) continue;

                        const unprem = unpremultiplyAndDefringeRgb(
                            bPixels[pOff],
                            bPixels[pOff + 1],
                            bPixels[pOff + 2],
                            srcA
                        );

                        const existingIdx = nextBase[py * tile.cx + px];
                        const existingCol = palette[existingIdx] || { r: 90, g: 80, b: 60 };
                        const weight = srcA / 255;

                        const blendR = Math.round(unprem.r * weight + existingCol.r * (1 - weight));
                        const blendG = Math.round(unprem.g * weight + existingCol.g * (1 - weight));
                        const blendB = Math.round(unprem.b * weight + existingCol.b * (1 - weight));

                        nextBase[py * tile.cx + px] = findClosestPaletteColorIndex(
                            blendR,
                            blendG,
                            blendB,
                            palette,
                            colorCache
                        );
                        newlyStampedCoords.add(`${bx + px},${by + py}`);
                    }
                }
                tile.data = nextBase;
            }
        }

        // 2. Capture ONLY the isolated whole objects belonging to this tile for ExtraImageData
        const winMinX = bx - silhouetteMargin;
        const winMaxX = bx + tile.cx + silhouetteMargin - 1;
        const winMinY = by - silhouetteMargin;
        const winMaxY = by + tile.cy + silhouetteMargin - 1;
        const winW = winMaxX - winMinX + 1;
        const winH = winMaxY - winMinY + 1;

        const extraCanvas = await sampleIsolatedSourceForTile(
            originCanvasX + winMinX,
            originCanvasY + winMinY,
            winW,
            winH,
            options,
            overlays,
            gridType,
            targetDiamond,
            otherDiamondsPool,
            'extra_objects_only'
        );

        const hasExistingExtra =
            options.preserveExistingExtra &&
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

        const extraCandidates: { tx: number; ty: number; colorIdx: number }[] = [];

        if (extraCanvas) {
            const eCtx = extraCanvas.getContext('2d', { willReadFrequently: true })!;
            const ePixels = eCtx.getImageData(0, 0, winW, winH).data;

            for (let sy = 0; sy < winH; sy++) {
                const ty = winMinY + sy;
                for (let sx = 0; sx < winW; sx++) {
                    const tx = winMinX + sx;
                    const pOff = (sy * winW + sx) * 4;
                    const a = ePixels[pOff + 3];
                    if (a < alphaThresh) continue;

                    const relX = tx - bx;
                    const relY = ty - by;
                    const inBaseDiamond =
                        relX >= 0 &&
                        relX < tile.cx &&
                        relY >= 0 &&
                        relY < tile.cy &&
                        TmpParser.isInsideWestwoodDiamond(relX, relY, tile.cx, tile.cy);

                    if (!inBaseDiamond || !options.alsoBakeBaseDiamond) {
                        const cleanRgb = unpremultiplyAndDefringeRgb(
                            ePixels[pOff],
                            ePixels[pOff + 1],
                            ePixels[pOff + 2],
                            a
                        );
                        const colorIdx = findClosestPaletteColorIndex(
                            cleanRgb.r,
                            cleanRgb.g,
                            cleanRgb.b,
                            palette,
                            colorCache
                        );
                        extraCandidates.push({ tx, ty, colorIdx });
                        newlyStampedCoords.add(`${tx},${ty}`);
                        boundMinX = Math.min(boundMinX, tx);
                        boundMaxX = Math.max(boundMaxX, tx);
                        boundMinY = Math.min(boundMinY, ty);
                        boundMaxY = Math.max(boundMaxY, ty);
                    }
                }
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

            for (const pt of extraCandidates) {
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

            const baseZ = tile.zData || generateTileBaseZData(tile.cx, tile.cy);

            tmpFile.tiles[slotIdx] = {
                ...tile,
                zData: baseZ,
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
            if (!options.preserveExistingExtra) {
                tmpFile.tiles[slotIdx] = repairTileExtraAndBaseZ({
                    ...tile,
                    extraImageData: null,
                    extraZData: null,
                    header: {
                        ...h,
                        has_extra_data: false,
                        flags: h.flags & ~0x01,
                        x_extra: 0,
                        y_extra: 0,
                        cx_extra: 0,
                        cy_extra: 0,
                    },
                });
            } else {
                tmpFile.tiles[slotIdx] = repairTileExtraAndBaseZ(tile);
            }
        }
    }

    const finalOffsets = getTmpMinOffsets(tmpFile);
    let newlyStampedMask: {
        rawMinX: number;
        rawMinY: number;
        width: number;
        height: number;
        stamped: Uint8Array;
    } | undefined;

    if (newlyStampedCoords.size > 0) {
        const mw = Math.max(1, image.width + silhouetteMargin * 4);
        const mh = Math.max(1, image.height + silhouetteMargin * 4);
        const mMinX = finalOffsets.rawMinX - silhouetteMargin;
        const mMinY = finalOffsets.rawMinY - silhouetteMargin;
        const stamped = new Uint8Array(mw * mh);
        newlyStampedCoords.forEach((coord) => {
            const [txStr, tyStr] = coord.split(',');
            const mx = parseInt(txStr, 10) - mMinX;
            const my = parseInt(tyStr, 10) - mMinY;
            if (mx >= 0 && mx < mw && my >= 0 && my < mh) {
                stamped[my * mw + mx] = 1;
            }
        });
        newlyStampedMask = {
            rawMinX: mMinX,
            rawMinY: mMinY,
            width: mw,
            height: mh,
            stamped,
        };
    }

    return buildUpdatedCanvasImageFromTmp(image, tmpFile, palette, {
        prevCanvas: imgCanvas,
        prevRawMinX: prevOffsets.rawMinX,
        prevRawMinY: prevOffsets.rawMinY,
        newlyStampedMask,
    });
}
