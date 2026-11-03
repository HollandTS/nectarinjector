import type { CanvasImage, BrushHistoryEntry, BrushHistoryTileSnapshot, HandBrushSettings } from '../types';

/**
 * Builds a BrushHistoryEntry comparing the affected tiles before and after a brush stroke.
 */
export function buildBrushHistoryEntry(
    beforeMap: Map<string, { name: string; src: string }>,
    afterImages: CanvasImage[],
    affectedIds: string[],
    settings: HandBrushSettings
): BrushHistoryEntry | null {
    const snapshots: BrushHistoryTileSnapshot[] = [];
    const afterMap = new Map<string, CanvasImage>();
    for (const img of afterImages) {
        afterMap.set(img.id, img);
    }

    for (const id of affectedIds) {
        const before = beforeMap.get(id);
        const after = afterMap.get(id);
        if (before && after && before.src !== after.src) {
            snapshots.push({
                tileId: id,
                tileName: after.filename || before.name || 'Tile',
                beforeSrc: before.src,
                afterSrc: after.src,
            });
        }
    }

    if (snapshots.length === 0) return null;

    return {
        id: `brush-hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        brushName: settings.brushName || 'Brush Stroke',
        brushThumbSrc: settings.brushSrc || '',
        mode: settings.mode,
        tileSnapshots: snapshots,
    };
}

/**
 * Applies a transition from `currentIndex` to `targetIndex` on the canvas images
 * using the isolated `entries` list, without touching the main app Undo/Redo stack.
 */
export function applyBrushHistoryJump(
    currentImages: CanvasImage[],
    entries: BrushHistoryEntry[],
    currentIndex: number,
    targetIndex: number
): CanvasImage[] {
    if (targetIndex === currentIndex) return currentImages;

    const srcOverrides = new Map<string, string>();

    if (targetIndex < currentIndex) {
        // Walk backward from currentIndex down to targetIndex + 1, restoring beforeSrc
        for (let i = currentIndex; i > targetIndex; i--) {
            const entry = entries[i];
            if (!entry) continue;
            for (const snap of entry.tileSnapshots) {
                srcOverrides.set(snap.tileId, snap.beforeSrc);
            }
        }
    } else {
        // Walk forward from currentIndex + 1 up to targetIndex, applying afterSrc
        for (let i = currentIndex + 1; i <= targetIndex; i++) {
            const entry = entries[i];
            if (!entry) continue;
            for (const snap of entry.tileSnapshots) {
                srcOverrides.set(snap.tileId, snap.afterSrc);
            }
        }
    }

    if (srcOverrides.size === 0) return currentImages;

    return currentImages.map((img) => {
        const nextSrc = srcOverrides.get(img.id);
        return nextSrc !== undefined ? { ...img, src: nextSrc } : img;
    });
}
