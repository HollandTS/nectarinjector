import type { CanvasImage, ProjectOverlay, ThreeDObject } from '../types';
import { isThreeDTargetId } from './threeDInjectionUtils';
import { isAllLayersTargetId } from './allLayersInjectionHelper';
import { isSceneGroupId } from './sceneGroupUtils';

export interface SceneHierarchyEntry {
    uid: string;
    itemType: 'layer' | '3d' | 'tile' | 'tiles-group';
    id: string;
    name: string;
    stackOrder: number;
    opacity?: number;
    isVisible?: boolean;
    subLabel?: string;
    sceneGroupId?: string;
    sceneGroupName?: string;
    sceneGroupMoveTogether?: boolean;
}

/**
 * Computes the default stackOrder for a 2D Layer if `ov.stackOrder` is undefined.
 * Preserves legacy behavior: 'back' (Under tiles) layers start around 100..900,
 * 'front' layers start around 4000..4900.
 */
export function getOverlayDefaultStackOrder(ov: ProjectOverlay, indexInArray: number): number {
    if (typeof ov.stackOrder === 'number' && !isNaN(ov.stackOrder)) {
        return ov.stackOrder;
    }
    return ov.placement === 'back' ? 100 + indexInArray * 20 : 4000 + indexInArray * 20;
}

/**
 * Computes the compositing order for "All Layers" texture injection.
 * Unless the user explicitly assigned `stackOrder` in the Scene Organizer,
 * 2D layers in the LayerStack (top of LayerStack = highest indexInArray) composite ON TOP of 3D objects,
 * regardless of whether the 2D layer has "Under" (`placement === 'back'`, which only means under the Isotiles) checked!
 */
export function getOverlayCompositeOrder(ov: ProjectOverlay, indexInArray: number): number {
    if (typeof ov.stackOrder === 'number' && !isNaN(ov.stackOrder)) {
        return ov.stackOrder;
    }
    // Both 'front' and 'back' 2D layers composite above default 3D (3500) in their LayerStack order
    return 4000 + indexInArray * 20;
}

/**
 * Computes the effective canvas zIndex for a 2D Layer (`TiledOverlay` or `SmartOverlay`).
 */
export function getOverlayZIndex(ov: ProjectOverlay, allOverlays: ProjectOverlay[]): number {
    const idx = Math.max(0, allOverlays.findIndex((o) => o.id === ov.id));
    return Math.round(getOverlayDefaultStackOrder(ov, idx));
}

/**
 * Computes the default stackOrder for a 3D Object if `obj.stackOrder` is undefined.
 */
export function getThreeDDefaultStackOrder(obj: ThreeDObject, indexInArray: number = 0): number {
    if (typeof obj.stackOrder === 'number' && !isNaN(obj.stackOrder)) {
        return obj.stackOrder;
    }
    return 3500 + indexInArray * 20;
}

/**
 * Computes the effective canvas zIndex for the 3D scene container when not actively transforming,
 * and sets Three.js `renderOrder` per object when multiple 3D objects overlap.
 */
export function getThreeDCanvasZIndex(
    objects: ThreeDObject[],
    isActive: boolean,
    isVisible: boolean
): number {
    if (!isVisible) return -1;
    if (isActive) return 9999;
    if (objects.length === 0) return 50;
    let maxOrder = -Infinity;
    objects.forEach((obj, idx) => {
        const order = getThreeDDefaultStackOrder(obj, idx);
        if (order > maxOrder) maxOrder = order;
    });
    return isFinite(maxOrder) ? Math.max(1, Math.round(maxOrder)) : 3500;
}

/**
 * Computes the default stackOrder for an Isotile (`CanvasImage`) if `img.stackOrder` is undefined.
 */
export function getTileDefaultStackOrder(img: CanvasImage): number {
    if (typeof img.stackOrder === 'number' && !isNaN(img.stackOrder)) {
        return img.stackOrder;
    }
    return 1500 + Math.floor((img.gridX + img.gridY) * 2) + (img.heightLevel || 0);
}

/**
 * Computes the effective canvas zIndex for an Isotile (`DraggableImage`).
 */
export function getTileZIndex(img: CanvasImage, isSelected: boolean): number {
    const base = Math.round(getTileDefaultStackOrder(img));
    // Give selected tiles a tiny +1 boost within their band so they stay crisp over neighbor tiles
    // without jumping above layers or 3D objects that are intentionally placed on top!
    return isSelected ? base + 1 : base;
}

/**
 * Builds a unified sorted list of items (from top-most to bottom-most) for the Scene Organizer panel.
 * Supports either grouping all Isotiles as a single "All Isotiles" block or listing individual Isotiles.
 */
export function buildUnifiedSceneList(
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[],
    images: CanvasImage[],
    groupTiles: boolean
): SceneHierarchyEntry[] {
    const entries: SceneHierarchyEntry[] = [];

    const validOverlays = overlays.filter(
        (o) => !isThreeDTargetId(o.id) && !isAllLayersTargetId(o.id) && !isSceneGroupId(o.id)
    );

    validOverlays.forEach((ov, idx) => {
        entries.push({
            uid: `layer:${ov.id}`,
            itemType: 'layer',
            id: ov.id,
            name: ov.name || 'Layer',
            stackOrder: getOverlayDefaultStackOrder(ov, idx),
            opacity: ov.opacity,
            isVisible: ov.isVisible,
            subLabel: `${ov.type === 'tiled' ? 'Tiled' : 'Smart'} Layer`,
            sceneGroupId: ov.sceneGroupId,
            sceneGroupName: ov.sceneGroupName,
            sceneGroupMoveTogether: ov.sceneGroupMoveTogether,
        });
    });

    threeDObjects.forEach((obj, idx) => {
        entries.push({
            uid: `3d:${obj.id}`,
            itemType: '3d',
            id: obj.id,
            name: obj.name || '3D Object',
            stackOrder: getThreeDDefaultStackOrder(obj, idx),
            opacity: obj.opacity ?? 100,
            isVisible: true,
            subLabel: '3D Model',
            sceneGroupId: obj.sceneGroupId,
            sceneGroupName: obj.sceneGroupName,
            sceneGroupMoveTogether: obj.sceneGroupMoveTogether,
        });
    });

    if (groupTiles) {
        if (images.length > 0) {
            const sum = images.reduce((acc, img) => acc + getTileDefaultStackOrder(img), 0);
            const avgOrder = Math.round(sum / images.length);
            const firstGrouped = images.find((i) => i.sceneGroupId);
            entries.push({
                uid: 'tiles-group:all',
                itemType: 'tiles-group',
                id: 'all-tiles',
                name: `All Isotiles (${images.length})`,
                stackOrder: avgOrder,
                isVisible: true,
                subLabel: 'Isotile Grid Group',
                sceneGroupId: firstGrouped?.sceneGroupId,
                sceneGroupName: firstGrouped?.sceneGroupName,
                sceneGroupMoveTogether: firstGrouped?.sceneGroupMoveTogether,
            });
        }
    } else {
        images.forEach((img) => {
            entries.push({
                uid: `tile:${img.id}`,
                itemType: 'tile',
                id: img.id,
                name: img.name || img.id,
                stackOrder: getTileDefaultStackOrder(img),
                isVisible: true,
                subLabel: `Tile (${img.gridX}, ${img.gridY})`,
                sceneGroupId: img.sceneGroupId,
                sceneGroupName: img.sceneGroupName,
                sceneGroupMoveTogether: img.sceneGroupMoveTogether,
            });
        });
    }

    // Sort descending by stackOrder (highest = on top first)
    entries.sort((a, b) => b.stackOrder - a.stackOrder);
    return entries;
}

/**
 * Given a reordered list of `SceneHierarchyEntry` (sorted top-to-bottom),
 * assigns clean, monotonic `stackOrder` values and updates `placement` on 2D layers
 * relative to the Isotiles band so everything stays consistent.
 */
export function applySceneHierarchyOrder(
    orderedEntries: SceneHierarchyEntry[],
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[],
    images: CanvasImage[]
): {
    nextOverlays: ProjectOverlay[];
    nextThreeDObjects: ThreeDObject[];
    nextImages: CanvasImage[];
} {
    const total = orderedEntries.length;
    const orderByUid = new Map<string, number>();

    // Top item gets highest stackOrder, bottom item gets lowest
    // Range: 500 to 500 + total * 100
    orderedEntries.forEach((entry, idx) => {
        const orderVal = (total - idx) * 100 + 200;
        orderByUid.set(entry.uid, orderVal);
    });

    // Find average tile stackOrder to set 'front' vs 'back' on 2D layers for legacy compatibility
    let tileReferenceOrder = 1500;
    const groupTileOrder = orderByUid.get('tiles-group:all');
    if (groupTileOrder !== undefined) {
        tileReferenceOrder = groupTileOrder;
    } else {
        const tileOrders: number[] = [];
        images.forEach((img) => {
            const o = orderByUid.get(`tile:${img.id}`);
            if (o !== undefined) tileOrders.push(o);
        });
        if (tileOrders.length > 0) {
            tileReferenceOrder =
                tileOrders.reduce((a, b) => a + b, 0) / tileOrders.length;
        }
    }

    const nextOverlays = overlays.map((ov, idx) => {
        const assigned = orderByUid.get(`layer:${ov.id}`);
        if (assigned === undefined) return ov;
        const nextPlacement: 'front' | 'back' =
            assigned >= tileReferenceOrder ? 'front' : 'back';
        return {
            ...ov,
            stackOrder: assigned,
            placement: nextPlacement,
        };
    });

    // Sort overlays array in ascending stackOrder so components that iterate overlays render in order
    nextOverlays.sort(
        (a, b) =>
            (a.stackOrder ?? getOverlayDefaultStackOrder(a, 0)) -
            (b.stackOrder ?? getOverlayDefaultStackOrder(b, 0))
    );

    const nextThreeDObjects = threeDObjects.map((obj) => {
        const assigned = orderByUid.get(`3d:${obj.id}`);
        if (assigned === undefined) return obj;
        return {
            ...obj,
            stackOrder: assigned,
        };
    });

    const nextImages = images.map((img) => {
        if (groupTileOrder !== undefined) {
            // Preserve subtle isometric depth offset within the group band
            const isoOffset = Math.min(40, Math.max(-40, Math.floor((img.gridX + img.gridY) * 0.5)));
            return {
                ...img,
                stackOrder: groupTileOrder + isoOffset,
            };
        }
        const assigned = orderByUid.get(`tile:${img.id}`);
        if (assigned === undefined) return img;
        return {
            ...img,
            stackOrder: assigned,
        };
    });

    return {
        nextOverlays,
        nextThreeDObjects,
        nextImages,
    };
}
