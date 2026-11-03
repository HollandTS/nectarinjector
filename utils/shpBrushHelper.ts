import type { HandBrushSettings, LoadedShpBrushItem } from '../types';
import {
    parseShpBuffer,
    renderShpFramePair,
    resolveShpBrushPalette,
} from './shp';
import { isValidWwPal, parsePalFile, PaletteColor } from './westwoodPaletteParser';
import { renderHandBrushStamp, RenderedBrushStamp } from './handBrushHelper';

export interface ShpBrushUpdateResult {
    updates: Partial<HandBrushSettings>;
    error?: string;
}

/**
 * Builds a LoadedShpBrushItem from a raw SHP buffer and palette.
 */
export async function buildLoadedShpItem(
    id: string,
    buffer: ArrayBuffer,
    fileName: string,
    frameIndex: number,
    hasShadowHalfOverride: boolean | undefined,
    customPalette: PaletteColor[] | null | undefined,
    customPaletteName: string | null | undefined,
    shadowOptions?: {
        shadowEnabled?: boolean;
        shadowDarkness?: number;
        shadowOffsetX?: number;
        shadowOffsetY?: number;
    }
): Promise<LoadedShpBrushItem | null> {
    const shp = parseShpBuffer(buffer);
    if (!shp || shp.frames.length === 0) return null;

    const palette = await resolveShpBrushPalette(customPalette);
    const totalFrames = shp.frames.length;
    const defaultHasShadow = totalFrames >= 2 && totalFrames % 2 === 0;
    const hasShadowHalf =
        hasShadowHalfOverride !== undefined ? hasShadowHalfOverride : defaultHasShadow;

    const rendered = renderShpFramePair(shp, frameIndex, palette, {
        hasShadowHalf,
        includeShadowInPreview: shadowOptions?.shadowEnabled ?? true,
        shadowOpacity: shadowOptions?.shadowDarkness ?? 55,
        shadowOffsetX: shadowOptions?.shadowOffsetX ?? 0,
        shadowOffsetY: shadowOptions?.shadowOffsetY ?? 0,
    });

    const safeFrameIndex = Math.max(0, Math.min(rendered.normalFrameCount - 1, frameIndex));

    return {
        id,
        fileName,
        buffer,
        frameIndex: safeFrameIndex,
        totalFrames,
        normalFrameCount: rendered.normalFrameCount,
        hasShadowHalf: rendered.hasShadowHalf,
        brushSrc: rendered.normalCanvas.toDataURL('image/png'),
        shadowSrc: rendered.shadowCanvas
            ? rendered.shadowCanvas.toDataURL('image/png')
            : null,
        customPalette: customPalette ?? null,
        customPaletteName: customPaletteName ?? null,
    };
}

/**
 * Converts a LoadedShpBrushItem into partial HandBrushSettings for the currently active SHP brush.
 */
export function applyLoadedShpItemToSettings(
    item: LoadedShpBrushItem,
    loadedShpItems?: LoadedShpBrushItem[],
    selectedShpIds?: string[]
): Partial<HandBrushSettings> {
    const updates: Partial<HandBrushSettings> = {
        isShpBrush: true,
        activeShpId: item.id,
        shpBuffer: item.buffer,
        shpFileName: item.fileName,
        shpFrameIndex: item.frameIndex,
        shpTotalFrames: item.totalFrames,
        shpNormalFrameCount: item.normalFrameCount,
        shpHasShadowHalf: item.hasShadowHalf,
        brushSrc: item.brushSrc,
        shpShadowSrc: item.shadowSrc,
        brushName: `${item.fileName} [Frame ${item.frameIndex + 1}/${item.normalFrameCount}]`,
        shpCustomPalette: item.customPalette,
        shpCustomPaletteName: item.customPaletteName,
        tilingMode: 'untransformed',
    };
    if (loadedShpItems !== undefined) {
        updates.loadedShpItems = loadedShpItems;
    }
    if (selectedShpIds !== undefined) {
        updates.selectedShpIds = selectedShpIds;
    }
    return updates;
}

/**
 * Re-renders the active SHP brush frame and its paired shadow frame into DataURLs,
 * and updates its corresponding entry inside `loadedShpItems` so its frame & palette are remembered.
 */
export async function buildShpBrushRenderUpdates(
    buffer: ArrayBuffer,
    fileName: string,
    frameIndex: number,
    hasShadowHalfOverride: boolean | undefined,
    customPalette: PaletteColor[] | null | undefined,
    customPaletteName: string | null | undefined,
    shadowOptions?: {
        shadowEnabled?: boolean;
        shadowDarkness?: number;
        shadowOffsetX?: number;
        shadowOffsetY?: number;
    },
    currentSettings?: HandBrushSettings
): Promise<ShpBrushUpdateResult> {
    const activeId = currentSettings?.activeShpId || `shp-${fileName.toLowerCase()}`;
    const item = await buildLoadedShpItem(
        activeId,
        buffer,
        fileName,
        frameIndex,
        hasShadowHalfOverride,
        customPalette,
        customPaletteName,
        shadowOptions
    );
    if (!item) {
        return {
            updates: {},
            error: `File "${fileName}" is not a valid Format 80 SHP file.`,
        };
    }

    let nextList = currentSettings?.loadedShpItems
        ? [...currentSettings.loadedShpItems]
        : undefined;
    if (nextList) {
        const idx = nextList.findIndex((i) => i.id === activeId);
        if (idx >= 0) {
            nextList[idx] = item;
        } else {
            nextList.push(item);
        }
    }

    return {
        updates: applyLoadedShpItemToSettings(item, nextList),
    };
}

/**
 * Assigns a parsed `.pal` file (or `null` to revert to project PAL) to multiple SHPs in `loadedShpItems`.
 * - `targetScope === 'selected'`: applies to all checked SHPs in `selectedShpIds` (plus the active SHP if none are checked)
 * - `targetScope === 'all'`: applies to every SHP in `loadedShpItems`
 * - `targetScope === 'active'`: applies only to the currently active SHP
 */
export async function assignPaletteToMultipleShps(
    pal: PaletteColor[] | null,
    palName: string | null,
    targetScope: 'active' | 'selected' | 'all',
    currentSettings: HandBrushSettings
): Promise<ShpBrushUpdateResult> {
    const existingList = [...(currentSettings.loadedShpItems || [])];
    const selectedSet = new Set<string>(currentSettings.selectedShpIds || []);

    if (existingList.length === 0) {
        if (!currentSettings.shpBuffer || !currentSettings.shpFileName) {
            return {
                updates: {
                    shpCustomPalette: pal,
                    shpCustomPaletteName: palName,
                },
            };
        }
        return await buildShpBrushRenderUpdates(
            currentSettings.shpBuffer,
            currentSettings.shpFileName,
            currentSettings.shpFrameIndex ?? 0,
            currentSettings.shpHasShadowHalf,
            pal,
            palName,
            {
                shadowEnabled: currentSettings.shpShadowEnabled ?? true,
                shadowDarkness: currentSettings.shpShadowDarkness ?? 55,
                shadowOffsetX: currentSettings.shpShadowOffsetX ?? 0,
                shadowOffsetY: currentSettings.shpShadowOffsetY ?? 0,
            },
            currentSettings
        );
    }

    const shouldUpdateItem = (item: LoadedShpBrushItem): boolean => {
        if (targetScope === 'all') return true;
        if (targetScope === 'selected') {
            if (selectedSet.size > 0) return selectedSet.has(item.id);
            return item.id === currentSettings.activeShpId;
        }
        return item.id === currentSettings.activeShpId;
    };

    const nextList: LoadedShpBrushItem[] = [];
    for (const item of existingList) {
        if (shouldUpdateItem(item)) {
            const rebuilt = await buildLoadedShpItem(
                item.id,
                item.buffer,
                item.fileName,
                item.frameIndex,
                item.hasShadowHalf,
                pal,
                palName,
                {
                    shadowEnabled: currentSettings.shpShadowEnabled ?? true,
                    shadowDarkness: currentSettings.shpShadowDarkness ?? 55,
                    shadowOffsetX: currentSettings.shpShadowOffsetX ?? 0,
                    shadowOffsetY: currentSettings.shpShadowOffsetY ?? 0,
                }
            );
            nextList.push(rebuilt || item);
        } else {
            nextList.push(item);
        }
    }

    const activeItem =
        nextList.find((i) => i.id === currentSettings.activeShpId) || nextList[0];

    return {
        updates: applyLoadedShpItemToSettings(activeItem, nextList),
    };
}

/**
 * Handles one or more files dropped or selected for the SHP Hand Brush.
 * Supports loading multiple SHP files (with any extension: .shp, .tem, .sno, .urb, .ubn, .des, .lun)
 * along with one or more .pal files. Every loaded SHP and its .pal are remembered in `loadedShpItems`.
 */
export async function loadFilesForShpHandBrush(
    files: FileList | File[],
    currentSettings: HandBrushSettings,
    palTargetScope: 'active' | 'selected' | 'all' = 'selected'
): Promise<ShpBrushUpdateResult> {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return { updates: {} };

    const parsedPals: Array<{ name: string; baseName: string; pal: PaletteColor[] }> = [];
    const parsedShps: Array<{ name: string; baseName: string; buffer: ArrayBuffer }> = [];

    const getBase = (name: string) => {
        const dot = name.lastIndexOf('.');
        return (dot > 0 ? name.substring(0, dot) : name).trim().toLowerCase();
    };

    for (const file of fileArray) {
        const buffer = await file.arrayBuffer();
        if (isValidWwPal(buffer, file.name)) {
            const parsedPal = parsePalFile(buffer);
            if (parsedPal && parsedPal.length > 0) {
                parsedPals.push({
                    name: file.name,
                    baseName: getBase(file.name),
                    pal: parsedPal,
                });
            }
            continue;
        }

        const shp = parseShpBuffer(buffer);
        if (shp && shp.frames.length > 0) {
            parsedShps.push({
                name: file.name,
                baseName: getBase(file.name),
                buffer,
            });
        }
    }

    const existingList = [...(currentSettings.loadedShpItems || [])];
    const existingSelected = new Set<string>(currentSettings.selectedShpIds || []);

    // Case 1: Only .pal file(s) were loaded — apply to target scope ('active' | 'selected' | 'all') and remember in the list!
    if (parsedShps.length === 0 && parsedPals.length > 0) {
        const chosenPal = parsedPals[parsedPals.length - 1];
        return await assignPaletteToMultipleShps(
            chosenPal.pal,
            chosenPal.name,
            palTargetScope,
            currentSettings
        );
    }

    if (parsedShps.length === 0) {
        return {
            updates: {},
            error: 'No valid Format 80 SHP file found in the selected file(s).',
        };
    }

    // Case 2: One or more SHP files were loaded (optionally alongside .pal files)
    const fallbackDroppedPal =
        parsedPals.length > 0 ? parsedPals[parsedPals.length - 1] : null;

    let lastLoadedItem: LoadedShpBrushItem | null = null;

    for (const shpEntry of parsedShps) {
        // Match a .pal with the same base filename if dropped together, else use any dropped .pal,
        // else preserve existing item's custom pal or currentSettings.shpCustomPalette
        const exactPal = parsedPals.find((p) => p.baseName === shpEntry.baseName) || fallbackDroppedPal;
        const existingIdx = existingList.findIndex(
            (item) => item.fileName.toLowerCase() === shpEntry.name.toLowerCase()
        );
        const existingItem = existingIdx >= 0 ? existingList[existingIdx] : null;

        const customPal = exactPal
            ? exactPal.pal
            : existingItem?.customPalette ?? currentSettings.shpCustomPalette ?? null;
        const customPalName = exactPal
            ? exactPal.name
            : existingItem?.customPaletteName ?? currentSettings.shpCustomPaletteName ?? null;

        const itemId = existingItem?.id || `shp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const builtItem = await buildLoadedShpItem(
            itemId,
            shpEntry.buffer,
            shpEntry.name,
            existingItem?.frameIndex ?? 0,
            existingItem?.hasShadowHalf,
            customPal,
            customPalName,
            {
                shadowEnabled: currentSettings.shpShadowEnabled ?? true,
                shadowDarkness: currentSettings.shpShadowDarkness ?? 55,
                shadowOffsetX: currentSettings.shpShadowOffsetX ?? 0,
                shadowOffsetY: currentSettings.shpShadowOffsetY ?? 0,
            }
        );

        if (builtItem) {
            if (existingIdx >= 0) {
                existingList[existingIdx] = builtItem;
            } else {
                existingList.push(builtItem);
            }
            existingSelected.add(builtItem.id);
            lastLoadedItem = builtItem;
        }
    }

    if (!lastLoadedItem) {
        return {
            updates: {},
            error: 'Failed to decode Format 80 SHP frames.',
        };
    }

    const updates = applyLoadedShpItemToSettings(
        lastLoadedItem,
        existingList,
        Array.from(existingSelected)
    );

    // Default to Normal stamp mode & Untransformed 1:1 sprite projection when loading SHPs
    updates.mode = 'normal';
    updates.tilingMode = 'untransformed';
    if (currentSettings.shpShadowEnabled === undefined) {
        updates.shpShadowEnabled = true;
    }
    if (currentSettings.shpShadowDarkness === undefined) {
        updates.shpShadowDarkness = 55;
    }
    if (currentSettings.shpShadowBlendPalIndex1 === undefined) {
        updates.shpShadowBlendPalIndex1 = 25;
    }

    return { updates };
}

/**
 * Rotates to the next SHP in `selectedShpIds` (or `loadedShpItems` if none checked)
 * when `shpRandomPick` is enabled.
 */
export function getNextRotatedShpItem(
    settings: HandBrushSettings
): LoadedShpBrushItem | null {
    const list = settings.loadedShpItems || [];
    if (list.length <= 1) return null;

    const selectedSet = new Set(settings.selectedShpIds || []);
    const pool = list.filter((item) => selectedSet.has(item.id));
    const effectivePool = pool.length > 0 ? pool : list;
    if (effectivePool.length <= 1) return effectivePool[0] || null;

    const curIdx = effectivePool.findIndex((item) => item.id === settings.activeShpId);
    const nextIdx = (curIdx + 1) % effectivePool.length;
    return effectivePool[nextIdx];
}

/**
 * Applies the SHP shadow frame onto a tile's ImageData.
 * In TS/RA2/OpenTS, shadows are stored in the second half of the SHP frames using palette index #1
 * (the 2nd color in the .pal). A shadow darkens the underlying tile pixels where the shadow hits
 * (instead of painting opaque black over empty air or replacing the tile's texture).
 */
export function applyShpShadowToTileImageData(
    tileImageData: ImageData,
    shadowStamp: RenderedBrushStamp,
    offsetX: number,
    offsetY: number,
    settings: HandBrushSettings
): void {
    const darknessPct = Math.max(0, Math.min(100, settings.shpShadowDarkness ?? 55)) / 100;
    if (darknessPct <= 0) return;

    const tileW = tileImageData.width;
    const tileH = tileImageData.height;

    const shadowCropCanvas = document.createElement('canvas');
    shadowCropCanvas.width = tileW;
    shadowCropCanvas.height = tileH;
    const scCtx = shadowCropCanvas.getContext('2d', { willReadFrequently: true });
    if (!scCtx) return;

    const softness = Math.max(0, Math.min(10, settings.shpShadowSoftness ?? 0));
    if (softness > 0) {
        scCtx.filter = `blur(${softness}px)`;
    } else {
        scCtx.imageSmoothingEnabled = false;
    }

    scCtx.drawImage(shadowStamp.canvas, offsetX, offsetY);
    const shadowData = scCtx.getImageData(0, 0, tileW, tileH).data;
    const tData = tileImageData.data;

    // Palette index #1 color (stored in shadowStamp RGB channels by renderShpFramePair)
    const palIndex1Blend = Math.max(0, Math.min(100, settings.shpShadowBlendPalIndex1 ?? 25)) / 100;

    for (let px = 0; px < tData.length; px += 4) {
        const sAlpha = shadowData[px + 3];
        if (sAlpha === 0) continue;

        const tileAlpha = tData[px + 3];
        if (tileAlpha === 0) continue; // Only darken existing opaque tile pixels!

        const shadowWeight = (sAlpha / 255) * darknessPct;
        const keepFactor = Math.max(0, 1 - shadowWeight);

        // Darken the underlying tile pixel (authentic multiplicative shadow darkening)
        let r = tData[px] * keepFactor;
        let g = tData[px + 1] * keepFactor;
        let b = tData[px + 2] * keepFactor;

        // Optional subtle tint toward palette index #1 (2nd color in the .pal)
        if (palIndex1Blend > 0) {
            const p1R = shadowData[px];
            const p1G = shadowData[px + 1];
            const p1B = shadowData[px + 2];
            const tintWeight = shadowWeight * palIndex1Blend;
            r = r * (1 - tintWeight) + p1R * tintWeight;
            g = g * (1 - tintWeight) + p1G * tintWeight;
            b = b * (1 - tintWeight) + p1B * tintWeight;
        }

        tData[px] = Math.max(0, Math.min(255, Math.round(r)));
        tData[px + 1] = Math.max(0, Math.min(255, Math.round(g)));
        tData[px + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
}

/**
 * Renders the SHP shadow frame through the same stamp transform (scale, rotation, mirror, projection)
 * as the main brush stamp, plus any shadow pixel offset `(shpShadowOffsetX, shpShadowOffsetY)`.
 */
export function renderShpShadowBrushStamp(
    shadowImg: HTMLImageElement | HTMLCanvasElement,
    settings: HandBrushSettings,
    config: { width: number; height: number },
    overrideRotation?: number
): RenderedBrushStamp {
    const shadowSettings: HandBrushSettings = {
        ...settings,
        invert: false,
    };
    return renderHandBrushStamp(shadowImg, shadowSettings, config, overrideRotation);
}
