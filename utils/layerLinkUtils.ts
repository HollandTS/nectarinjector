import type { ProjectOverlay, GridType } from '../types';
import { GRID_CONFIGS } from '../constants';
import { renderOverlayFully } from './textureInjection';

export interface LinkedLayerGroup {
    id: string;
    name: string;
    layers: ProjectOverlay[];
}

export function isLinkedGroupId(id: string | null | undefined): boolean {
    return typeof id === 'string' && id.startsWith('link-group:');
}

/**
 * Extracts unique linked layer groups from the overlays list.
 * Only groups with at least 1 valid layer are returned.
 */
export function getLinkedGroups(overlays: ProjectOverlay[]): LinkedLayerGroup[] {
    const map = new Map<string, LinkedLayerGroup>();
    for (const ov of overlays) {
        if (ov.linkGroupId) {
            let group = map.get(ov.linkGroupId);
            if (!group) {
                group = {
                    id: ov.linkGroupId,
                    name: ov.linkGroupName || 'Linked Layer',
                    layers: []
                };
                map.set(ov.linkGroupId, group);
            }
            group.layers.push(ov);
        }
    }
    return Array.from(map.values()).filter(g => g.layers.length >= 2);
}

/**
 * Links selected layers together with a custom group name.
 */
export function linkSelectedOverlays(
    selectedIds: Set<string>,
    overlays: ProjectOverlay[],
    groupName: string
): ProjectOverlay[] {
    const cleanName = groupName.trim() || 'Linked Layer';
    const linkGroupId = `link-group:${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return overlays.map(ov => {
        if (selectedIds.has(ov.id)) {
            return {
                ...ov,
                linkGroupId,
                linkGroupName: cleanName
            };
        }
        return ov;
    });
}

/**
 * Unlinks a single layer or an entire link group if < 2 remain.
 */
export function unlinkOverlay(
    overlayId: string,
    overlays: ProjectOverlay[]
): ProjectOverlay[] {
    const target = overlays.find(o => o.id === overlayId);
    if (!target || !target.linkGroupId) return overlays;
    const groupId = target.linkGroupId;

    const remainingInGroup = overlays.filter(o => o.linkGroupId === groupId && o.id !== overlayId);
    const dissolveGroup = remainingInGroup.length < 2;

    return overlays.map(ov => {
        if (ov.id === overlayId || (dissolveGroup && ov.linkGroupId === groupId)) {
            const copy = { ...ov };
            delete copy.linkGroupId;
            delete copy.linkGroupName;
            return copy;
        }
        return ov;
    });
}

/**
 * Renames a linked layer group across all its member layers.
 */
export function renameLinkedGroup(
    linkGroupId: string,
    newName: string,
    overlays: ProjectOverlay[]
): ProjectOverlay[] {
    return overlays.map(ov => {
        if (ov.linkGroupId === linkGroupId) {
            return {
                ...ov,
                linkGroupName: newName
            };
        }
        return ov;
    });
}

/**
 * Computes the combined viewport bounding box for a set of layers.
 */
export function getCombinedLayersBounds(
    layers: ProjectOverlay[],
    gridType: GridType
): { minX: number; minY: number; width: number; height: number } {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ov of layers) {
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
        return { minX: 0, minY: 0, width: 100, height: 100 };
    }

    const finalMinX = Math.floor(minX);
    const finalMinY = Math.floor(minY);
    const width = Math.max(1, Math.ceil(maxX - finalMinX));
    const height = Math.max(1, Math.ceil(maxY - finalMinY));

    return { minX: finalMinX, minY: finalMinY, width, height };
}

/**
 * Renders all layers belonging to a linked group onto a single composite canvas
 * in their bottom-to-top stack order.
 */
export async function renderLinkedGroupComposite(
    linkGroupId: string,
    allOverlays: ProjectOverlay[],
    gridType: GridType,
    targetX?: number,
    targetY?: number,
    targetWidth?: number,
    targetHeight?: number
): Promise<{ canvas: HTMLCanvasElement; originX: number; originY: number; width: number; height: number } | null> {
    const groupLayers = allOverlays.filter(o => o.linkGroupId === linkGroupId && o.isVisible);
    if (groupLayers.length === 0) return null;

    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const bounds = getCombinedLayersBounds(groupLayers, gridType);

    const originX = targetX !== undefined ? targetX : bounds.minX;
    const originY = targetY !== undefined ? targetY : bounds.minY;
    const width = targetWidth !== undefined ? targetWidth : bounds.width;
    const height = targetHeight !== undefined ? targetHeight : bounds.height;

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = width;
    compositeCanvas.height = height;
    const ctx = compositeCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    for (const ov of groupLayers) {
        const layerCanvas = await renderOverlayFully(
            ov,
            originX,
            originY,
            config,
            width,
            height,
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

    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && d[i + 3] < 255) {
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    return {
        canvas: compositeCanvas,
        originX,
        originY,
        width,
        height
    };
}
