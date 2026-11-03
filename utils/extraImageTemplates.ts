import { Tile, TmpFile, TmpParser, RGB } from './formats';
import { generateTileBaseZData, generateExtraImageZData } from './extraImageZHelper';
import { updateTmpFileFromCanvas } from './westwoodTmpParser';

export interface ExtraTemplatePreset {
    id: string;
    name: string;
    subtitle: string;
    padLeft: number;
    padTop: number;
    padRight: number;
    padBottom: number;
}

export const EXTRA_IMAGE_TEMPLATES: ExtraTemplatePreset[] = [
    {
        id: 'tree_canopy_top',
        name: 'Top Canopy (Tree / Pole)',
        subtitle: 'Extends 36px above & 12px around diamond',
        padLeft: 12,
        padTop: 36,
        padRight: 12,
        padBottom: 4,
    },
    {
        id: 'scatter_halo_medium',
        name: 'Scatter Halo (Medium)',
        subtitle: 'Extends 20px top & 14px sides for bushes/rocks',
        padLeft: 14,
        padTop: 20,
        padRight: 14,
        padBottom: 8,
    },
    {
        id: 'tall_spire',
        name: 'Tall Spire / Cliff Peak',
        subtitle: 'Extends 56px upward for tall structures/trees',
        padLeft: 8,
        padTop: 56,
        padRight: 8,
        padBottom: 2,
    },
    {
        id: 'wide_overhang',
        name: 'Wide Overhang (360°)',
        subtitle: 'Extends 24px in all directions around tile',
        padLeft: 24,
        padTop: 24,
        padRight: 24,
        padBottom: 16,
    },
];

/**
 * Restores full RGB brightness for semi-transparent edge pixels rendered over a transparent black
 * WebGL clear color so anti-aliased grass/tree edges never turn into black spots.
 */
export function unpremultiplyAndDefringeRgb(
    r: number,
    g: number,
    b: number,
    a: number
): { r: number; g: number; b: number } {
    if (a >= 250 || a <= 0) {
        return { r, g, b };
    }
    const scale = 255 / a;
    return {
        r: Math.min(255, Math.round(r * scale)),
        g: Math.min(255, Math.round(g * scale)),
        b: Math.min(255, Math.round(b * scale)),
    };
}

/**
 * Finds the closest Westwood palette index (1..255) for an RGB pixel.
 * Strictly skips pure-black (0,0,0) slots at indices > 0 so dark green shadows or crevices
 * never turn into pitch-black spots or trigger black-key canvas transparency.
 */
export function findClosestPaletteColorIndex(
    r: number,
    g: number,
    b: number,
    palette: RGB[],
    cache?: Map<number, number>
): number {
    const key = (r << 16) | (g << 8) | b;
    if (cache && cache.has(key)) return cache.get(key)!;

    let bestIdx = 1;
    let minDist = Infinity;

    for (let i = 1; i < palette.length; i++) {
        const p = palette[i];
        if (!p) continue;
        // Skip pure black / near-zero unused slots in .pal so lit pixels never snap to (0,0,0)
        if (p.r + p.g + p.b < 8) continue;

        const dr = p.r - r;
        const dg = p.g - g;
        const db = p.b - b;
        // Perceptual luminance-weighted RGB distance
        const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (dist < minDist) {
            minDist = dist;
            bestIdx = i;
        }
    }

    if (cache) cache.set(key, bestIdx);
    return bestIdx;
}

/**
 * Ensures a CanvasImage has a valid parsed TmpFile structure.
 * If the image is a plain PNG tile without a tmpBuffer, converts its base diamond into a 1x1 TmpFile.
 */
export function ensureTmpFileForCanvasImage(
    existingBuffer: ArrayBuffer | undefined,
    imgCanvas: HTMLCanvasElement,
    cellW: number,
    cellH: number,
    palette: RGB[]
): TmpFile {
    if (existingBuffer && existingBuffer.byteLength >= 16) {
        try {
            const parsed = TmpParser.parseTmp(existingBuffer);
            // Sync any prior Smart Layer / Texture Injection bakes from imgCanvas (image.src) into parsed
            // so baking an Extra Image never reverts the tile back to the original un-baked .TMP!
            updateTmpFileFromCanvas(imgCanvas, parsed, palette);
            return parsed;
        } catch {
            // Fallback to creating a fresh 1x1 TmpFile
        }
    }

    const ctx = imgCanvas.getContext('2d', { willReadFrequently: true })!;
    const imgData = ctx.getImageData(0, 0, imgCanvas.width, imgCanvas.height).data;
    const data = new Uint8Array(cellW * cellH);
    const cache = new Map<number, number>();

    // Align bottom of image with bottom of 1x1 diamond
    const offsetX = Math.round((imgCanvas.width - cellW) / 2);
    const offsetY = imgCanvas.height - cellH;

    for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
            if (!TmpParser.isInsideWestwoodDiamond(px, py, cellW, cellH)) continue;
            const sx = px + offsetX;
            const sy = py + offsetY;
            if (sx >= 0 && sx < imgCanvas.width && sy >= 0 && sy < imgCanvas.height) {
                const i = (sy * imgCanvas.width + sx) * 4;
                if (imgData[i + 3] >= 128) {
                    data[py * cellW + px] = findClosestPaletteColorIndex(
                        imgData[i],
                        imgData[i + 1],
                        imgData[i + 2],
                        palette,
                        cache
                    );
                } else {
                    data[py * cellW + px] = findClosestPaletteColorIndex(0, 0, 0, palette, cache);
                }
            }
        }
    }

    const zData = generateTileBaseZData(cellW, cellH);

    // Also capture any existing pixels above/outside the diamond as initial extra image
    let minEx = Infinity, maxEx = -Infinity, minEy = Infinity, maxEy = -Infinity;
    for (let sy = 0; sy < imgCanvas.height; sy++) {
        for (let sx = 0; sx < imgCanvas.width; sx++) {
            const i = (sy * imgCanvas.width + sx) * 4;
            if (imgData[i + 3] < 128) continue;
            const dx = sx - offsetX;
            const dy = sy - offsetY;
            const inDiamond =
                dx >= 0 && dx < cellW && dy >= 0 && dy < cellH &&
                TmpParser.isInsideWestwoodDiamond(dx, dy, cellW, cellH);
            if (!inDiamond) {
                minEx = Math.min(minEx, dx);
                maxEx = Math.max(maxEx, dx);
                minEy = Math.min(minEy, dy);
                maxEy = Math.max(maxEy, dy);
            }
        }
    }

    let extraImageData: Uint8Array | null = null;
    let extraZData: Uint8Array | null = null;
    let hasExtra = false;
    let xExtra = 0, yExtra = 0, cxExtra = 0, cyExtra = 0;

    if (minEx <= maxEx && minEy <= maxEy) {
        cxExtra = maxEx - minEx + 1;
        cyExtra = maxEy - minEy + 1;
        if (cxExtra % 2 !== 0) cxExtra++;
        if (cyExtra % 2 !== 0) cyExtra++;
        xExtra = minEx;
        yExtra = minEy;
        hasExtra = true;
        extraImageData = new Uint8Array(cxExtra * cyExtra);
        for (let ey = 0; ey < cyExtra; ey++) {
            for (let ex = 0; ex < cxExtra; ex++) {
                const sx = offsetX + xExtra + ex;
                const sy = offsetY + yExtra + ey;
                if (sx >= 0 && sx < imgCanvas.width && sy >= 0 && sy < imgCanvas.height) {
                    const i = (sy * imgCanvas.width + sx) * 4;
                    if (imgData[i + 3] >= 128) {
                        extraImageData[ey * cxExtra + ex] = findClosestPaletteColorIndex(
                            imgData[i],
                            imgData[i + 1],
                            imgData[i + 2],
                            palette,
                            cache
                        );
                    }
                }
            }
        }
        extraZData = generateExtraImageZData(cxExtra, cyExtra, extraImageData, xExtra, cellW, cellH, 'smart_column');
    }

    const tile: Tile = {
        slot: 0,
        cx: cellW,
        cy: cellH,
        header: {
            x: 0,
            y: 0,
            extra_ofs: 0,
            z_ofs: 0,
            extra_z_ofs: 0,
            x_extra: xExtra,
            y_extra: yExtra,
            cx_extra: cxExtra,
            cy_extra: cyExtra,
            flags: 0x02 | (hasExtra ? 0x01 : 0),
            height: 0,
            land_type: 12,
            ramp_type: 0,
            radar_colors: [80, 120, 80, 80, 120, 80],
            has_extra_data: hasExtra,
            has_z_data: true,
            has_damaged_data: false,
            is_fully_transparent: false,
        },
        data,
        zData,
        extraImageData,
        extraZData,
        damagedData: null,
    };

    return {
        cblocks_x: 1,
        cblocks_y: 1,
        cx: cellW,
        cy: cellH,
        tiles: [tile],
        type: cellW === 48 ? 'TS' : cellW === 60 ? 'RA2' : 'OPENTS',
    };
}
