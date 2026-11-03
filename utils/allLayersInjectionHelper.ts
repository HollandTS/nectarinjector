import type { ProjectOverlay, GridType, ThreeDObject } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import { getFullOverlaySurface, getOverlayTileCrop } from './overlaySurfaceRenderer';
import {
    renderThreeDObjectCrop,
    makeThreeDTargetId,
    isThreeDTargetId,
    getRegisteredThreeDObjects,
} from './threeDInjectionUtils';
import { getOverlayCompositeOrder, getThreeDDefaultStackOrder } from './sceneOrderHelper';

export const ALL_LAYERS_TARGET_ID = 'all-layers:composite';

export function isAllLayersTargetId(id: string | null | undefined): boolean {
    return id === ALL_LAYERS_TARGET_ID;
}

let cachedAllLayersFullSurface: {
    timestamp: number;
    key: string;
    canvas: HTMLCanvasElement;
} | null = null;

export function clearAllLayersCompositeCache(): void {
    cachedAllLayersFullSurface = null;
}

/**
 * Renders a composite crop at (cropX, cropY, cropW, cropH) combining both the 3D scene
 * and all visible 2D layers (Tiled & Smart overlays) respecting each layer's stackOrder
 * and relative opacity, and normalizes the final composite pixel opacity so that
 * semi-transparent layers blend with each other/3D rather than letting the original
 * tile color (e.g. white mask pixels) bleed through.
 */
export async function renderAllLayersCompositeCrop(
    allOverlays: ProjectOverlay[],
    gridType: GridType,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number
): Promise<HTMLCanvasElement | null> {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cropW));
    out.height = Math.max(1, Math.round(cropH));
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;

    const visible2D = allOverlays.filter(
        (o) =>
            o.isVisible &&
            o.src &&
            !isThreeDTargetId(o.id) &&
            !isThreeDTargetId(o.src) &&
            !isAllLayersTargetId(o.id) &&
            !isAllLayersTargetId(o.src)
    );

    const threeDObjects = getRegisteredThreeDObjects() as ThreeDObject[];
    const now = performance.now();
    const sigKey = `${gridType}_${visible2D.map((o) => `${o.id}:${o.x}:${o.y}:${o.opacity}:${o.stackOrder ?? ''}`).join('|')}_${(threeDObjects || []).map((o) => `${o.id}:${o.position.x}:${o.position.y}:${o.position.z}:${o.stackOrder ?? ''}:${o.opacity ?? 100}`).join('|')}`;

    // If crop is within standard canvas bounds, render the full composite surface once and crop from it
    const withinCanvasBounds =
        cropX >= 0 &&
        cropY >= 0 &&
        cropX + out.width <= CANVAS_WIDTH &&
        cropY + out.height <= CANVAS_HEIGHT;

    if (withinCanvasBounds && cachedAllLayersFullSurface && cachedAllLayersFullSurface.key === sigKey && now - cachedAllLayersFullSurface.timestamp < 500) {
        ctx.drawImage(
            cachedAllLayersFullSurface.canvas,
            Math.round(cropX),
            Math.round(cropY),
            out.width,
            out.height,
            0,
            0,
            out.width,
            out.height
        );
        return out;
    }

    // Build sorted render items from bottom-most to top-most
    type RenderStep =
        | { kind: '2d'; ov: ProjectOverlay; order: number }
        | { kind: '3d-obj'; objId: string; order: number }
        | { kind: '3d-all'; order: number };

    const steps: RenderStep[] = visible2D.map((ov) => {
        const idx = allOverlays.findIndex((o) => o.id === ov.id);
        return {
            kind: '2d',
            ov,
            order: getOverlayCompositeOrder(ov, Math.max(0, idx)),
        };
    });

    if (threeDObjects && threeDObjects.length > 0) {
        // Check if any 3D object has a custom stackOrder that interleaves with 2D layers
        const hasCustom3DOrder = threeDObjects.some((o) => typeof o.stackOrder === 'number');
        if (hasCustom3DOrder && threeDObjects.length > 1) {
            threeDObjects.forEach((obj, idx) => {
                steps.push({
                    kind: '3d-obj',
                    objId: obj.id,
                    order: getThreeDDefaultStackOrder(obj, idx),
                });
            });
        } else {
            // Render all 3D objects together in one WebGL pass at their highest stackOrder
            const max3DOrder = Math.max(
                ...threeDObjects.map((obj, idx) => getThreeDDefaultStackOrder(obj, idx))
            );
            steps.push({ kind: '3d-all', order: max3DOrder });
        }
    } else {
        steps.push({ kind: '3d-all', order: 3500 });
    }

    steps.sort((a, b) => a.order - b.order);

    if (withinCanvasBounds) {
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = CANVAS_WIDTH;
        fullCanvas.height = CANVAS_HEIGHT;
        const fCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
        if (fCtx) {
            fCtx.imageSmoothingEnabled = false;
            for (const step of steps) {
                if (step.kind === '2d') {
                    const ov = step.ov;
                    const surface = await getFullOverlaySurface(ov, gridType, allOverlays);
                    if (!surface) continue;
                    const fullCrop = getOverlayTileCrop(
                        surface,
                        0,
                        0,
                        CANVAS_WIDTH,
                        CANVAS_HEIGHT,
                        ov.filters.renderMode
                    );
                    fCtx.save();
                    fCtx.globalAlpha = Math.max(0, Math.min(1, (ov.opacity ?? 100) / 100));
                    fCtx.drawImage(fullCrop, 0, 0);
                    fCtx.restore();
                } else if (step.kind === '3d-obj') {
                    const threeDFull = await renderThreeDObjectCrop(
                        makeThreeDTargetId(step.objId),
                        0,
                        0,
                        CANVAS_WIDTH,
                        CANVAS_HEIGHT
                    );
                    if (threeDFull) {
                        fCtx.save();
                        fCtx.globalAlpha = 1;
                        fCtx.drawImage(threeDFull, 0, 0);
                        fCtx.restore();
                    }
                } else {
                    const threeDFull = await renderThreeDObjectCrop(
                        makeThreeDTargetId('all'),
                        0,
                        0,
                        CANVAS_WIDTH,
                        CANVAS_HEIGHT
                    );
                    if (threeDFull) {
                        fCtx.save();
                        fCtx.globalAlpha = 1;
                        fCtx.drawImage(threeDFull, 0, 0);
                        fCtx.restore();
                    }
                }
            }

            // Normalize non-zero composite alpha on the full surface
            const fullImgData = fCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            const fd = fullImgData.data;
            for (let i = 0; i < fd.length; i += 4) {
                const a = fd[i + 3];
                if (a > 0 && a < 255) {
                    fd[i + 3] = 255;
                }
            }
            fCtx.putImageData(fullImgData, 0, 0);

            cachedAllLayersFullSurface = {
                timestamp: performance.now(),
                key: sigKey,
                canvas: fullCanvas,
            };

            ctx.drawImage(
                fullCanvas,
                Math.round(cropX),
                Math.round(cropY),
                out.width,
                out.height,
                0,
                0,
                out.width,
                out.height
            );
            return out;
        }
    }

    for (const step of steps) {
        if (step.kind === '2d') {
            const ov = step.ov;
            const surface = await getFullOverlaySurface(ov, gridType, allOverlays);
            if (!surface) continue;
            const tileCrop = getOverlayTileCrop(
                surface,
                cropX,
                cropY,
                out.width,
                out.height,
                ov.filters.renderMode
            );
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, (ov.opacity ?? 100) / 100));
            ctx.drawImage(tileCrop, 0, 0);
            ctx.restore();
        } else if (step.kind === '3d-obj') {
            const threeDCrop = await renderThreeDObjectCrop(
                makeThreeDTargetId(step.objId),
                cropX,
                cropY,
                out.width,
                out.height
            );
            if (threeDCrop) {
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.drawImage(threeDCrop, 0, 0);
                ctx.restore();
            }
        } else {
            const threeDCrop = await renderThreeDObjectCrop(
                makeThreeDTargetId('all'),
                cropX,
                cropY,
                out.width,
                out.height
            );
            if (threeDCrop) {
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.drawImage(threeDCrop, 0, 0);
                ctx.restore();
            }
        }
    }

    // Normalize non-zero composite alpha so semi-transparent layers blend with each other/3D
    // and fully replace the target mask color (e.g. white) instead of letting white bleed through!
    const imgData = ctx.getImageData(0, 0, out.width, out.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a > 0 && a < 255) {
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    return out;
}
