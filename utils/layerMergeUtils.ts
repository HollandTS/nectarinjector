import type { ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS, DEFAULT_FILTERS } from '../constants';
import { renderOverlayFully } from './textureInjection';

/**
 * Merges selected overlays into a single SMART overlay exactly as they are viewed in the viewport.
 */
export const mergeSelectedOverlays = async (
    selectedOverlays: ProjectOverlay[],
    allOverlays: ProjectOverlay[],
    gridType: GridType
): Promise<ProjectOverlay[]> => {
    if (selectedOverlays.length < 2) return allOverlays;

    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };

    // 1. Calculate combined bounding box in viewport canvas space
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ov of selectedOverlays) {
        if (ov.type === 'smart') {
            const footprint = (ov.filters.staticScale || 100) / 100;
            const mainScale = (ov.filters.mainScale || 100) / 100;
            const w = ov.width * footprint * mainScale;
            const h = ov.height * footprint * mainScale;
            minX = Math.min(minX, ov.x);
            minY = Math.min(minY, ov.y);
            maxX = Math.max(maxX, ov.x + Math.max(ov.width, w));
            maxY = Math.max(maxY, ov.y + Math.max(ov.height, h));
        } else {
            const footprint = (ov.filters.staticScale || 100) / 100;
            const tileW = config.width * footprint;
            const tileH = config.height * footprint;
            const rx = Math.max(1, Number(ov.repeatX) || 1);
            const ry = Math.max(1, Number(ov.repeatY) || 1);

            const ovMinX = ov.x - ry * (tileW / 2);
            const ovMaxX = ov.x + rx * (tileW / 2) + tileW * 2;
            const ovMinY = ov.y - tileH;
            const ovMaxY = ov.y + (rx + ry) * (tileH / 2) + tileH * 2.5;

            minX = Math.min(minX, ovMinX);
            minY = Math.min(minY, ovMinY);
            maxX = Math.max(maxX, ovMaxX);
            maxY = Math.max(maxY, ovMaxY);
        }
    }

    if (!isFinite(minX)) {
        minX = 0;
        minY = 0;
        maxX = 100;
        maxY = 100;
    }

    minX = Math.floor(minX);
    minY = Math.floor(minY);
    const targetWidth = Math.max(1, Math.ceil(maxX - minX));
    const targetHeight = Math.max(1, Math.ceil(maxY - minY));

    // 2. Render each selected layer onto a combined offscreen canvas in stack order
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = targetWidth;
    mergedCanvas.height = targetHeight;
    const ctx = mergedCanvas.getContext('2d', { willReadFrequently: true })!;

    // Sort selectedOverlays by their original index in allOverlays (bottom to top)
    const sortedSelected = [...selectedOverlays].sort((a, b) => {
        return allOverlays.findIndex(o => o.id === a.id) - allOverlays.findIndex(o => o.id === b.id);
    });

    for (const ov of sortedSelected) {
        if (!ov.isVisible) continue;
        const layerCanvas = await renderOverlayFully(
            ov,
            minX,
            minY,
            config,
            targetWidth,
            targetHeight,
            allOverlays,
            1
        );

        if (layerCanvas) {
            ctx.save();
            ctx.globalAlpha = (ov.opacity ?? 100) / 100;
            ctx.drawImage(layerCanvas, 0, 0);
            ctx.restore();
        }
    }

    const mergedDataUrl = mergedCanvas.toDataURL('image/png');

    // 3. Find topmost selected layer's index in allOverlays
    const selectedIds = new Set(selectedOverlays.map(o => o.id));
    let topmostIndex = -1;
    for (let i = 0; i < allOverlays.length; i++) {
        if (selectedIds.has(allOverlays[i].id)) {
            topmostIndex = i;
        }
    }

    const topmostSelected = sortedSelected[sortedSelected.length - 1];

    const mergedOverlay: ProjectOverlay = {
        id: `ov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: `Merged Layer (${selectedOverlays.length})`,
        type: 'smart',
        src: mergedDataUrl,
        x: minX,
        y: minY,
        width: targetWidth,
        height: targetHeight,
        repeatX: 1,
        repeatY: 1,
        opacity: 100,
        isVisible: true,
        placement: topmostSelected ? topmostSelected.placement : 'front',
        filters: {
            ...DEFAULT_FILTERS,
            staticScale: 100,
            mainScale: 100,
            canvasZoom: 100,
            maskGroups: [],
            maskOverlayIds: [],
            colorSwaps: [],
            maskEntries: []
        }
    };

    // 4. Construct updated overlays array replacing selected layers with single merged layer
    const updatedOverlays: ProjectOverlay[] = [];
    let inserted = false;

    for (let i = 0; i < allOverlays.length; i++) {
        const ov = allOverlays[i];
        if (selectedIds.has(ov.id)) {
            if (!inserted && i === topmostIndex) {
                updatedOverlays.push(mergedOverlay);
                inserted = true;
            }
        } else {
            updatedOverlays.push(ov);
        }
    }

    if (!inserted) {
        updatedOverlays.push(mergedOverlay);
    }

    return updatedOverlays;
};
