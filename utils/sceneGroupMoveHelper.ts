import type { CanvasImage, GridType, ProjectOverlay, ThreeDObject } from '../types';
import { GRID_CONFIGS, CANVAS_HEIGHT } from '../constants';

/**
 * Converts a 2D canvas pixel delta `(dxPixels, dyPixels)` into:
 * - 3D world space delta `(delta3DX, delta3DZ)` along the canonical orthographic isometric plane
 * - Isometric grid step delta `(dgx, dgy)` for Isotiles
 */
export function convert2DPixelDeltaTo3DAndIso(
    dxPixels: number,
    dyPixels: number,
    gridType: GridType
): {
    delta3DX: number;
    delta3DZ: number;
    dgx: number;
    dgy: number;
} {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const cW = config.width || 48;
    const cH = config.height || 24;

    // 1. Isometric grid delta from screen pixel delta:
    // screenX = (i - j) * (cW / 2), screenY = (i + j) * (cH / 2)
    // => di = dx / cW + dy / cH, dj = dy / cH - dx / cW
    const dgx = dxPixels / cW + dyPixels / cH;
    const dgy = dyPixels / cH - dxPixels / cW;

    // 2. 3D world delta along the ground plane (Y = 0) matching handleSnap3DTo2D:
    // In handleSnap3DTo2D:
    // scale = (74.8 / CANVAS_HEIGHT) * cH
    // threeDZ = di * scale, threeDX = dj * scale
    const scale3D = (74.8 / CANVAS_HEIGHT) * cH;
    const delta3DZ = dgx * scale3D;
    const delta3DX = dgy * scale3D;

    return {
        delta3DX,
        delta3DZ,
        dgx,
        dgy,
    };
}

/**
 * Converts a 3D world space delta `(delta3DX, delta3DZ)` into:
 * - 2D canvas pixel delta `(dxPixels, dyPixels)`
 * - Isometric grid step delta `(dgx, dgy)`
 */
export function convert3DDeltaTo2DPixelsAndIso(
    delta3DX: number,
    delta3DZ: number,
    gridType: GridType
): {
    dxPixels: number;
    dyPixels: number;
    dgx: number;
    dgy: number;
} {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const cW = config.width || 48;
    const cH = config.height || 24;

    const scale3D = (74.8 / CANVAS_HEIGHT) * cH;
    const dgx = scale3D !== 0 ? delta3DZ / scale3D : 0;
    const dgy = scale3D !== 0 ? delta3DX / scale3D : 0;

    const dxPixels = (dgx - dgy) * (cW / 2);
    const dyPixels = (dgx + dgy) * (cH / 2);

    return {
        dxPixels,
        dyPixels,
        dgx,
        dgy,
    };
}

/**
 * Applies a 2D pixel delta `(dxPixels, dyPixels)` to all other members of `sceneGroupId`
 * when `sceneGroupMoveTogether !== false`.
 */
export function applySceneGroupMoveFrom2DDelta(
    sceneGroupId: string,
    sourceItemUid: string,
    dxPixels: number,
    dyPixels: number,
    gridType: GridType,
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[],
    images: CanvasImage[]
): {
    nextOverlays: ProjectOverlay[];
    nextThreeDObjects: ThreeDObject[];
    nextImages: CanvasImage[];
} {
    const { delta3DX, delta3DZ, dgx, dgy } = convert2DPixelDeltaTo3DAndIso(
        dxPixels,
        dyPixels,
        gridType
    );

    const nextOverlays = overlays.map((ov) => {
        if (ov.sceneGroupId !== sceneGroupId || ov.sceneGroupMoveTogether === false) return ov;
        if (`layer:${ov.id}` === sourceItemUid) return ov;
        return {
            ...ov,
            x: ov.x + dxPixels,
            y: ov.y + dyPixels,
        };
    });

    const nextThreeDObjects = threeDObjects.map((obj) => {
        if (obj.sceneGroupId !== sceneGroupId || obj.sceneGroupMoveTogether === false) return obj;
        if (`3d:${obj.id}` === sourceItemUid) return obj;
        return {
            ...obj,
            position: {
                x: obj.position.x + delta3DX,
                y: obj.position.y,
                z: obj.position.z + delta3DZ,
            },
        };
    });

    const nextImages = images.map((img) => {
        if (img.sceneGroupId !== sceneGroupId || img.sceneGroupMoveTogether === false) return img;
        if (`tile:${img.id}` === sourceItemUid) return img;
        return {
            ...img,
            gridX: img.gridX + dgx,
            gridY: img.gridY + dgy,
        };
    });

    return {
        nextOverlays,
        nextThreeDObjects,
        nextImages,
    };
}
