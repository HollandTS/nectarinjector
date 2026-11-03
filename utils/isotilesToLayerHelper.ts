import type { CanvasImage, ProjectOverlay, GridType, AdditionalTexture } from '../types';
import { GRID_CONFIGS, DEFAULT_FILTERS } from '../constants';
import { loadImage } from './textureInjection';
import { untransformDiamondCanvasToFlatUV } from './layerTo3DPlaneUtils';
import { parseTmpFile, getTmpMinOffsets } from './westwoodTmpParser';
import { getImageDrawPos } from './geoUtils';

/**
 * Un-transforms a single isometric tile (or each sub-tile of a multi-tile .TMP)
 * into flat, rectangular UV texture data URL(s).
 */
export async function untransformIsotileToFlatImages(
    tile: CanvasImage,
    gridType: GridType
): Promise<string[]> {
    const img = await loadImage(tile.src);
    if (!img) return [];

    // Prepare source canvas (with flipH / flipV if the tile was flipped)
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = tile.width || img.width;
    srcCanvas.height = tile.height || img.height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) return [];

    srcCtx.imageSmoothingEnabled = false;
    srcCtx.save();
    if (tile.flipH || tile.flipV) {
        srcCtx.translate(tile.flipH ? srcCanvas.width : 0, tile.flipV ? srcCanvas.height : 0);
        srcCtx.scale(tile.flipH ? -1 : 1, tile.flipV ? -1 : 1);
    }
    srcCtx.drawImage(img, 0, 0);
    srcCtx.restore();

    const activeGrid = gridType === 'none' ? 'ts_full' : gridType;
    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };

    const results: string[] = [];

    // If this tile has a binary .TMP buffer with sub-tiles, extract each sub-tile diamond accurately
    if (tile.tmpBuffer) {
        try {
            const parsed = parseTmpFile(tile.tmpBuffer);
            const activeSubTiles = parsed.tiles.filter(t => t !== null);
            if (activeSubTiles.length > 0) {
                const offsets = getTmpMinOffsets(parsed);
                const minX = offsets.rawMinX;
                const minY = offsets.rawMinY;
                const mult = parsed.cy / 2;
                const subW = parsed.cx;
                const subH = parsed.cy;
                const uvSize = Math.max(64, Math.round(subW * 2));

                for (const sub of activeSubTiles) {
                    if (!sub || !sub.header) continue;
                    const h = sub.header;
                    const elev = (h.height || 0) * mult;
                    const bx = h.x - minX;
                    const by = h.y - elev - minY;

                    // Top vertex of the sub-tile diamond is at (bx + subW / 2, by)
                    const topX = bx + subW / 2;
                    const topY = by;
                    const colVecX = subW / 2;
                    const colVecY = subH / 2;
                    const rowVecX = -subW / 2;
                    const rowVecY = subH / 2;

                    const uvCanvas = untransformDiamondCanvasToFlatUV(
                        srcCanvas,
                        topX,
                        topY,
                        colVecX,
                        colVecY,
                        rowVecX,
                        rowVecY,
                        uvSize,
                        uvSize,
                        false
                    );
                    results.push(uvCanvas.toDataURL('image/png'));
                }

                if (results.length > 0) {
                    return results;
                }
            }
        } catch {
            // Fallback to bounding-box diamond un-transform below
        }
    }

    // Standard single or composite PNG tile:
    // Find tight non-transparent bounding box so any padding/extra height is handled cleanly,
    // or use the full tile diamond if it matches standard 2:1 isometric dimensions.
    const w = srcCanvas.width;
    const h = srcCanvas.height;

    const topX = w / 2;
    const topY = 0;
    const colVecX = w / 2;
    const colVecY = h / 2;
    const rowVecX = -w / 2;
    const rowVecY = h / 2;

    const uvSize = Math.max(64, Math.round(Math.max(w, config.width) * 2));
    const uvCanvas = untransformDiamondCanvasToFlatUV(
        srcCanvas,
        topX,
        topY,
        colVecX,
        colVecY,
        rowVecX,
        rowVecY,
        uvSize,
        uvSize,
        false
    );

    results.push(uvCanvas.toDataURL('image/png'));
    return results;
}

/**
 * Computes balanced repeatX and repeatY values for a given count of selected tiles
 * (e.g. 9 -> 3x3, 6 -> 3x2, 4 -> 2x2, 1 -> 1x1).
 */
export function computeBalancedRepeatCounts(tileCount: number): { repeatX: number; repeatY: number } {
    const count = Math.max(1, tileCount);
    const repeatX = Math.max(1, Math.ceil(Math.sqrt(count)));
    const repeatY = Math.max(1, Math.round(count / repeatX));
    return { repeatX, repeatY };
}

/**
 * Converts a list of selected CanvasImage isotiles into a single tiled ProjectOverlay:
 * - Un-transforms each tile from isometric diamond into a flat rectangular texture
 * - Uses the first un-transformed image as the main layer texture (`src`)
 * - Places any remaining un-transformed images into `filters.additionalTextures`
 * - Sets `repeatX` and `repeatY` to a balanced near-square grid (e.g. 9 tiles -> 3x3)
 */
export async function convertIsotilesToTiledOverlay(
    selectedTiles: CanvasImage[],
    gridType: GridType,
    placement: 'front' | 'back' = 'front'
): Promise<ProjectOverlay | null> {
    if (!selectedTiles || selectedTiles.length === 0) return null;

    const allFlatUrls: string[] = [];
    for (const tile of selectedTiles) {
        const urls = await untransformIsotileToFlatImages(tile, gridType);
        allFlatUrls.push(...urls);
    }

    if (allFlatUrls.length === 0) return null;

    const mainSrc = allFlatUrls[0];
    const extraSrcs = allFlatUrls.slice(1);

    const additionalTextures: AdditionalTexture[] = extraSrcs.map((src) => ({
        src,
        weight: 100,
        canvasZoom: 100,
        filters: { ...DEFAULT_FILTERS },
    }));

    // Compute repeatX and repeatY based on total un-transformed tile textures (or selected tiles count)
    const totalCount = Math.max(selectedTiles.length, allFlatUrls.length);
    const { repeatX, repeatY } = computeBalancedRepeatCounts(totalCount);

    // Position the new tiled layer near the top-most selected tile on the canvas
    const activeGrid = gridType === 'none' ? 'ts_full' : gridType;
    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };

    let sumX = 0;
    let sumY = 0;
    let minDrawY = Infinity;
    let topTileDrawPos = { x: 400, y: 400 };

    for (const t of selectedTiles) {
        const dp = getImageDrawPos(t, config.width, config.height);
        const cx = Math.round(dp.x) + t.offsetX + t.width / 2;
        const cy = Math.round(dp.y) + t.offsetY + t.height / 2;
        sumX += cx;
        sumY += cy;
        if (cy < minDrawY) {
            minDrawY = cy;
            topTileDrawPos = { x: cx, y: cy };
        }
    }

    const firstName = selectedTiles[0].name.replace(/\.[^/.]+$/, '');
    const layerName =
        selectedTiles.length === 1
            ? `${firstName} (Layer)`
            : `${firstName} +${selectedTiles.length - 1} (Layer)`;

    const newOverlay: ProjectOverlay = {
        id: `ov-isotile-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: layerName,
        type: 'tiled',
        src: mainSrc,
        repeatX,
        repeatY,
        x: Math.round(topTileDrawPos.x),
        y: Math.round(topTileDrawPos.y),
        width: 0,
        height: 0,
        opacity: 100,
        isVisible: true,
        placement,
        filters: {
            ...DEFAULT_FILTERS,
            staticScale: 100,
            shuffleMode: additionalTextures.length > 0 ? 'default' : 'none',
            additionalTextures,
            maskGroups: [],
            maskOverlayIds: [],
            colorSwaps: [],
            maskEntries: [],
        },
    };

    return newOverlay;
}
