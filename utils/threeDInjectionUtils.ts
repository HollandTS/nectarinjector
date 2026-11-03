import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

export const THREE_D_TARGET_PREFIX = '3d-obj:';

export function makeThreeDTargetId(objectId: string): string {
    return `${THREE_D_TARGET_PREFIX}${objectId}`;
}

export function isThreeDTargetId(id: string | null | undefined): boolean {
    return typeof id === 'string' && id.startsWith(THREE_D_TARGET_PREFIX);
}

export function getThreeDObjectIdFromTarget(targetId: string): string {
    return targetId.startsWith(THREE_D_TARGET_PREFIX)
        ? targetId.slice(THREE_D_TARGET_PREFIX.length)
        : targetId;
}

// Global reference to the active ThreeDCanvas capture methods so textureInjection / overlaySurfaceRenderer
// can sample rendered 3D objects at exact canvas coordinates without prop-drilling through every utility.
import type {
    IsolatedTileCaptureParams,
    IsolatedTileCaptureResult,
} from './threeDSceneCaptureHelper';

export interface ThreeDCaptureHandle {
    capture: () => string | null;
    captureObject?: (objectId: string) => string | null;
    captureCanvas?: (objectId?: string) => HTMLCanvasElement | null;
    captureIsolatedTileObjects?: (params: IsolatedTileCaptureParams) => IsolatedTileCaptureResult | null;
    getObjects?: () => any[];
}

let activeThreeDCaptureHandle: ThreeDCaptureHandle | null = null;

export function getRegisteredThreeDObjects(): any[] {
    return activeThreeDCaptureHandle?.getObjects ? activeThreeDCaptureHandle.getObjects() : [];
}
const threeDSurfaceCanvasCache = new Map<string, { timestamp: number; canvas: HTMLCanvasElement }>();

export function registerThreeDCaptureHandle(handle: ThreeDCaptureHandle | null): void {
    activeThreeDCaptureHandle = handle;
}

export function clearThreeDSurfaceCache(): void {
    threeDSurfaceCanvasCache.clear();
}

/**
 * Renders only the individual 3D objects / scatter instances belonging to `params.targetDiamond`
 * (masking out all other scatter instances, flat ground planes in extra mode, and shadow planes in extra mode),
 * and crops `(cropX, cropY, cropW, cropH)` at 1:1 scale.
 */
export function renderIsolatedThreeDTileObjectsCrop(
    params: IsolatedTileCaptureParams,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number
): { cropCanvas: HTMLCanvasElement; matchedObjectRoots: { x: number; y: number }[]; matchedCount: number } | null {
    if (!activeThreeDCaptureHandle?.captureIsolatedTileObjects) return null;
    const res = activeThreeDCaptureHandle.captureIsolatedTileObjects(params);
    if (!res) return null;

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cropW));
    out.height = Math.max(1, Math.round(cropH));
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        res.canvas,
        0,
        0,
        res.canvas.width,
        res.canvas.height,
        -Math.round(cropX),
        -Math.round(cropY),
        res.canvas.width,
        res.canvas.height
    );

    return {
        cropCanvas: out,
        matchedObjectRoots: res.matchedObjectRoots,
        matchedCount: res.matchedCount,
    };
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * Renders a specific 3D object (or the full 3D scene if objectId === 'all') to a full-canvas
 * HTMLCanvasElement at the exact viewport dimensions (CANVAS_WIDTH × CANVAS_HEIGHT = 2400 × 1600),
 * and crops a sub-rectangle `(cropX, cropY, cropW, cropH)` from it at 1:1 pixel scale.
 */
export async function renderThreeDObjectCrop(
    targetId: string,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
    canvasWidth: number = CANVAS_WIDTH,
    canvasHeight: number = CANVAS_HEIGHT
): Promise<HTMLCanvasElement | null> {
    if (!activeThreeDCaptureHandle) return null;

    const objectId = getThreeDObjectIdFromTarget(targetId);
    const now = performance.now();
    const cached = threeDSurfaceCanvasCache.get(objectId);

    let fullCanvas: HTMLCanvasElement | null = null;

    // Reuse cached full-scene render within 250ms so batch tile baking doesn't re-capture 100 times
    if (cached && now - cached.timestamp < 250) {
        fullCanvas = cached.canvas;
    } else if (activeThreeDCaptureHandle.captureCanvas) {
        fullCanvas = activeThreeDCaptureHandle.captureCanvas(objectId);
        if (fullCanvas) {
            threeDSurfaceCanvasCache.set(objectId, { timestamp: now, canvas: fullCanvas });
        }
    } else {
        const dataUrl =
            objectId !== 'all' && activeThreeDCaptureHandle.captureObject
                ? activeThreeDCaptureHandle.captureObject(objectId)
                : activeThreeDCaptureHandle.capture();

        if (!dataUrl) return null;
        const img = await loadImageElement(dataUrl);
        if (!img) return null;

        fullCanvas = document.createElement('canvas');
        fullCanvas.width = canvasWidth;
        fullCanvas.height = canvasHeight;
        const fCtx = fullCanvas.getContext('2d', { willReadFrequently: true })!;
        fCtx.imageSmoothingEnabled = false;
        fCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        threeDSurfaceCanvasCache.set(objectId, { timestamp: now, canvas: fullCanvas });
    }

    if (!fullCanvas) return null;

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cropW));
    out.height = Math.max(1, Math.round(cropH));
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        fullCanvas,
        0,
        0,
        fullCanvas.width,
        fullCanvas.height,
        -Math.round(cropX),
        -Math.round(cropY),
        fullCanvas.width,
        fullCanvas.height
    );
    return out;
}
