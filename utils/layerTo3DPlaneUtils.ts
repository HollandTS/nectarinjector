import * as THREE from 'three';
import type { ProjectOverlay, GridType, ThreeDObject } from '../types';
import { GRID_CONFIGS, CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import { screenToIso } from './geoUtils';
import { renderOverlayFully } from './textureInjection';
import { isLinkedGroupId, getLinkedGroups } from './layerLinkUtils';
import { initGlbModel } from './threeDMaterialHelper';
import { DEFAULT_DISPLACEMENT_SETTINGS } from './threeDDisplacementHelper';

export const PROCEDURAL_PLANE_PREFIX = 'procedural://plane';

export function isProceduralPlaneUrl(glbUrl: string): boolean {
    return glbUrl.startsWith(PROCEDURAL_PLANE_PREFIX);
}

/**
 * Parses unit dimensions encoded in `procedural://plane?unitSize=...`
 */
export function createProceduralPlaneGroup(objId: string, glbUrl: string): THREE.Group {
    let unitSize = 1;
    try {
        const qIdx = glbUrl.indexOf('?');
        if (qIdx !== -1) {
            const params = new URLSearchParams(glbUrl.substring(qIdx + 1));
            const parsed = parseFloat(params.get('unitSize') || '1');
            if (!isNaN(parsed) && parsed > 0) unitSize = parsed;
        }
    } catch {
        // fallback to 1
    }

    // Create a horizontal plane in the XZ plane:
    // PlaneGeometry(width, height) lies in XY with +X right and +Y up.
    // Rotating by -PI/2 around X puts +X along world +X (col / down-right)
    // and -Y (top-to-bottom V of texture) along world +Z (row / down-left)!
    const geometry = new THREE.PlaneGeometry(unitSize, unitSize, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 1,
        metalness: 0,
        transparent: true,
        alphaTest: 0.01,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'ProceduralLayerPlane';
    mesh.userData.id = objId;

    const wrapper = new THREE.Group();
    wrapper.add(mesh);
    wrapper.userData.id = objId;
    initGlbModel(wrapper);

    return wrapper;
}

/**
 * Computes the 3D world unit size corresponding to 1x1 isometric grid tile
 * for the given grid configuration, calibrated to the static orthographic camera.
 *
 * In ThreeDCanvas:
 * - Orthographic frustum height = 74.8 covering CANVAS_HEIGHT (2000px)
 * - Camera is at (110.039, 89.8467, 110.039) looking at (0, 0, 0)
 * - A 1-unit step in world +X or +Z projects to:
 *   dx_screen = ±(1/√2) * (CANVAS_HEIGHT / 74.8)
 *   dy_screen = +(1/√2) * sin(elevation) * (CANVAS_HEIGHT / 74.8)
 *   so 1 grid tile (tileW = 2*tileH) corresponds to worldTileUnit = (74.8 / CANVAS_HEIGHT) * config.height * √2.
 */
export function getWorldTileUnitSize(gridType: GridType): number {
    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const elevScale = (74.8 / CANVAS_HEIGHT) * config.height * Math.SQRT2;
    return elevScale;
}

/**
 * Un-transforms an isometric diamond region from a high-resolution baked canvas
 * back into a flat, orthogonal rectangular/square UV canvas.
 *
 * In isometric screen space (relative to top vertex `(topX, topY)` of the grid):
 *   x = topX + u * (totalColW / 2) - v * (totalRowW / 2)
 *   y = topY + u * (totalColH / 2) + v * (totalRowH / 2)
 * where u ∈ [0, 1] is normalized column progress and v ∈ [0, 1] is normalized row progress.
 *
 * We invert this 2D affine mapping so that on the output UV canvas of size `uvWidth × uvHeight`:
 *   topvertex     (u=0, v=0) -> (0, 0)
 *   right vertex  (u=1, v=0) -> (uvWidth, 0)
 *   left vertex   (u=0, v=1) -> (0, uvHeight)
 *   bottom vertex (u=1, v=1) -> (uvWidth, uvHeight)
 */
export function untransformDiamondCanvasToFlatUV(
    bakedCanvas: HTMLCanvasElement,
    topX: number,
    topY: number,
    colVecX: number,
    colVecY: number,
    rowVecX: number,
    rowVecY: number,
    uvWidth: number,
    uvHeight: number,
    smooth: boolean = true
): HTMLCanvasElement {
    const uvCanvas = document.createElement('canvas');
    uvCanvas.width = Math.max(1, Math.round(uvWidth));
    uvCanvas.height = Math.max(1, Math.round(uvHeight));
    const ctx = uvCanvas.getContext('2d')!;

    ctx.imageSmoothingEnabled = smooth;
    if (smooth) {
        ctx.imageSmoothingQuality = 'high';
    }

    // Forward affine mapping from source diamond (u in [0,1], v in [0,1]) to bakedCanvas (sx, sy):
    //   sx = topX + u * colVecX + v * rowVecX
    //   sy = topY + u * colVecY + v * rowVecY
    // We want to draw bakedCanvas onto uvCanvas (dx in [0, uvW], dy in [0, uvH]) where:
    //   dx = u * uvW,  dy = v * uvH
    // Expressing (dx, dy) in terms of (sx, sy):
    //   Let Δx = sx - topX, Δy = sy - topY
    //   [ Δx ] = [ colVecX  rowVecX ] [ u ]
    //   [ Δy ]   [ colVecY  rowVecY ] [ v ]
    const det = colVecX * rowVecY - rowVecX * colVecY;
    if (Math.abs(det) < 1e-6) {
        ctx.drawImage(bakedCanvas, 0, 0, uvCanvas.width, uvCanvas.height);
        return uvCanvas;
    }

    const inv00 = rowVecY / det;
    const inv01 = -rowVecX / det;
    const inv10 = -colVecY / det;
    const inv11 = colVecX / det;

    // u = inv00 * (sx - topX) + inv01 * (sy - topY)
    // v = inv10 * (sx - topX) + inv11 * (sy - topY)
    // dx = uvW * u = (uvW * inv00) * sx + (uvW * inv01) * sy - uvW * (inv00 * topX + inv01 * topY)
    // dy = uvH * v = (uvH * inv10) * sx + (uvH * inv11) * sy - uvH * (inv10 * topX + inv11 * topY)
    const a = uvCanvas.width * inv00;
    const c = uvCanvas.width * inv01;
    const e = -uvCanvas.width * (inv00 * topX + inv01 * topY);

    const b = uvCanvas.height * inv10;
    const d = uvCanvas.height * inv11;
    const f = -uvCanvas.height * (inv10 * topX + inv11 * topY);

    ctx.save();
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(bakedCanvas, 0, 0);
    ctx.restore();

    return uvCanvas;
}

/**
 * Converts a single 2D Layer (`ProjectOverlay`) or a Linked Layer Group ID into a `ThreeDObject`
 * representing a 3D Plane with:
 * 1. Exact `repeatX × repeatY` (scaled by footprint) 3D plane dimensions
 * 2. Exact 3D world position matching the 2D layer's isometric viewport position
 * 3. High-resolution baked & inverse-transformed rectangular UV texture (including all filters,
 *    color swaps, shuffled additional textures, transitions, and tiled brushes).
 */
export async function convertLayerToThreeDPlane(
    targetLayerOrGroupId: string,
    allOverlays: ProjectOverlay[],
    gridType: GridType
): Promise<ThreeDObject | null> {
    const activeGrid = gridType === 'none' ? 'ts_full' : gridType;
    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };

    let layersToBake: ProjectOverlay[] = [];
    let planeName = 'Layer Plane';

    if (isLinkedGroupId(targetLayerOrGroupId)) {
        const groups = getLinkedGroups(allOverlays);
        const group = groups.find(g => g.id === targetLayerOrGroupId);
        if (!group || group.layers.length === 0) return null;
        layersToBake = group.layers;
        planeName = `${group.name} (3D Plane)`;
    } else {
        const ov = allOverlays.find(o => o.id === targetLayerOrGroupId);
        if (!ov) return null;
        if (ov.linkGroupId) {
            const groups = getLinkedGroups(allOverlays);
            const group = groups.find(g => g.id === ov.linkGroupId);
            if (group && group.layers.length >= 2) {
                layersToBake = group.layers;
                planeName = `${group.name} (3D Plane)`;
            } else {
                layersToBake = [ov];
                planeName = `${ov.name || 'Layer'} (3D Plane)`;
            }
        } else {
            layersToBake = [ov];
            planeName = `${ov.name || 'Layer'} (3D Plane)`;
        }
    }

    // Determine primary reference layer (prefer first tiled layer in the group if any)
    const primaryOv = layersToBake.find(l => l.type === 'tiled') || layersToBake[0];
    const f = primaryOv.filters;
    const footprint = (f.staticScale ?? 100) / 100;

    const tileW = config.width * footprint;
    const tileH = config.height * footprint;

    // High-resolution bake factor (2x for crisp UV detail without excessive memory)
    const bakeScale = 2;

    // Compute screen-space bounding box of the layer (or linked layers)
    let minScreenX = Infinity;
    let minScreenY = Infinity;
    let maxScreenX = -Infinity;
    let maxScreenY = -Infinity;

    for (const ov of layersToBake) {
        const ovFootprint = (ov.filters.staticScale ?? 100) / 100;
        const ovTileW = config.width * ovFootprint;
        const ovTileH = config.height * ovFootprint;
        const ovRx = Math.max(1, Number(ov.repeatX) || 1);
        const ovRy = Math.max(1, Number(ov.repeatY) || 1);

        if (ov.type === 'smart') {
            const zoom = (ov.filters.mainScale ?? 100) / 100;
            const w = ov.width * ovFootprint * zoom;
            const h = ov.height * ovFootprint * zoom;
            minScreenX = Math.min(minScreenX, ov.x - ovTileW);
            minScreenY = Math.min(minScreenY, ov.y - ovTileH);
            maxScreenX = Math.max(maxScreenX, ov.x + w + ovTileW);
            maxScreenY = Math.max(maxScreenY, ov.y + h + ovTileH);
        } else {
            // In renderOverlayToCanvas, tile (col=0, row=0) is centered at (ov.x, ov.y).
            // The top vertex of tile (0,0) is at (ov.x, ov.y - ovTileH / 2).
            // Leftmost vertex (col=0, row=ovRy) is at ov.x - ovRy * (ovTileW / 2).
            // Rightmost vertex (col=ovRx, row=0) is at ov.x + ovRx * (ovTileW / 2).
            // Bottommost vertex (col=ovRx, row=ovRy) is at ov.y - ovTileH / 2 + (ovRx + ovRy) * (ovTileH / 2).
            const leftX = ov.x - ovRy * (ovTileW / 2) - ovTileW;
            const rightX = ov.x + ovRx * (ovTileW / 2) + ovTileW;
            const topY = ov.y - ovTileH * 1.5;
            const bottomY = ov.y + (ovRx + ovRy) * (ovTileH / 2) + ovTileH * 1.5;

            minScreenX = Math.min(minScreenX, leftX);
            minScreenY = Math.min(minScreenY, topY);
            maxScreenX = Math.max(maxScreenX, rightX);
            maxScreenY = Math.max(maxScreenY, bottomY);
        }
    }

    const screenWidth = Math.max(64, Math.ceil(maxScreenX - minScreenX));
    const screenHeight = Math.max(64, Math.ceil(maxScreenY - minScreenY));

    const bakedTargetW = Math.ceil(screenWidth * bakeScale);
    const bakedTargetH = Math.ceil(screenHeight * bakeScale);

    // Composite all layers in layersToBake onto a high-res canvas
    const compositeBaked = document.createElement('canvas');
    compositeBaked.width = bakedTargetW;
    compositeBaked.height = bakedTargetH;
    const compCtx = compositeBaked.getContext('2d')!;

    for (const ov of layersToBake) {
        const rendered = await renderOverlayFully(
            { ...ov, isVisible: true },
            minScreenX,
            minScreenY,
            config,
            bakedTargetW,
            bakedTargetH,
            allOverlays,
            bakeScale
        );
        if (rendered) {
            compCtx.save();
            compCtx.globalAlpha = Math.max(0, Math.min(1, (ov.opacity ?? 100) / 100));
            compCtx.drawImage(rendered, 0, 0);
            compCtx.restore();
        }
    }

    // Now un-transform the baked diamond into a flat rectangular UV image.
    // Let's find the exact diamond vertices of the primary tiled grid in `compositeBaked` pixel coordinates:
    // In `renderOverlayToCanvas`:
    //   tile (col, row) center is at:
    //     cx(col, row) = (primaryOv.x - minScreenX) * bakeScale + (col - row) * (tileW * bakeScale / 2)
    //     cy(col, row) = (primaryOv.y - minScreenY) * bakeScale + (col + row) * (tileH * bakeScale / 2)
    //   Each tile (col, row) spans `[-0.5, +0.5]` in `col` and `[-0.5, +0.5]` in `row` around its center `(col, row)`.
    //   Therefore, the entire `rx × ry` tiled grid spans:
    //     col ∈ [-0.5, rx - 0.5]
    //     row ∈ [-0.5, ry - 0.5]
    //   So the top-most corner of the `rx × ry` diamond (at col = -0.5, row = -0.5) is:
    //     topX = (primaryOv.x - minScreenX) * bakeScale + (-0.5 - (-0.5)) * (tileW * bakeScale / 2) = (primaryOv.x - minScreenX) * bakeScale
    //     topY = (primaryOv.y - minScreenY) * bakeScale + (-0.5 + (-0.5)) * (tileH * bakeScale / 2) = (primaryOv.y - minScreenY - tileH / 2) * bakeScale
    const scaledTileW = tileW * bakeScale;
    const scaledTileH = tileH * bakeScale;

    let uvCanvas: HTMLCanvasElement;
    let centerScreenX: number;
    let centerScreenY: number;
    let planeScaleX: number;
    let planeScaleZ: number;

    if (primaryOv.type === 'tiled') {
        // Compute the combined isometric (col, row) diamond span across all layers in layersToBake
        // relative to primaryOv's top corner (primaryOv.x, primaryOv.y - tileH / 2) and tile size (tileW, tileH).
        const baseTopX = primaryOv.x;
        const baseTopY = primaryOv.y - tileH / 2;

        const screenToColRow = (sx: number, sy: number) => {
            const dx = (sx - baseTopX) / (tileW / 2);
            const dy = (sy - baseTopY) / (tileH / 2);
            return {
                c: (dy + dx) / 2,
                r: (dy - dx) / 2,
            };
        };

        let minCol = Infinity;
        let maxCol = -Infinity;
        let minRow = Infinity;
        let maxRow = -Infinity;

        for (const ov of layersToBake) {
            const ovFootprint = (ov.filters.staticScale ?? 100) / 100;
            const ovTileW = config.width * ovFootprint;
            const ovTileH = config.height * ovFootprint;

            if (ov.type === 'tiled') {
                const ovRx = Math.max(1, Number(ov.repeatX) || 1);
                const ovRy = Math.max(1, Number(ov.repeatY) || 1);
                const ovTopX = ov.x;
                const ovTopY = ov.y - ovTileH / 2;

                const corners = [
                    { x: ovTopX, y: ovTopY },
                    { x: ovTopX + ovRx * (ovTileW / 2), y: ovTopY + ovRx * (ovTileH / 2) },
                    { x: ovTopX - ovRy * (ovTileW / 2), y: ovTopY + ovRy * (ovTileH / 2) },
                    { x: ovTopX + (ovRx - ovRy) * (ovTileW / 2), y: ovTopY + (ovRx + ovRy) * (ovTileH / 2) },
                ];

                for (const pt of corners) {
                    const cr = screenToColRow(pt.x, pt.y);
                    minCol = Math.min(minCol, cr.c);
                    maxCol = Math.max(maxCol, cr.c);
                    minRow = Math.min(minRow, cr.r);
                    maxRow = Math.max(maxRow, cr.r);
                }
            } else {
                const zoom = (ov.filters.mainScale ?? 100) / 100;
                const w = ov.width * ovFootprint * zoom;
                const h = ov.height * ovFootprint * zoom;
                const cx = ov.x + w / 2;
                const cy = ov.y + h / 2;
                // Sample the 4 diamond vertices of the smart layer's isometric footprint
                const corners = [
                    { x: cx, y: ov.y },
                    { x: ov.x + w, y: cy },
                    { x: cx, y: ov.y + h },
                    { x: ov.x, y: cy },
                ];
                for (const pt of corners) {
                    const cr = screenToColRow(pt.x, pt.y);
                    minCol = Math.min(minCol, cr.c);
                    maxCol = Math.max(maxCol, cr.c);
                    minRow = Math.min(minRow, cr.r);
                    maxRow = Math.max(maxRow, cr.r);
                }
            }
        }

        if (!isFinite(minCol) || !isFinite(minRow)) {
            minCol = 0;
            maxCol = Math.max(1, Number(primaryOv.repeatX) || 1);
            minRow = 0;
            maxRow = Math.max(1, Number(primaryOv.repeatY) || 1);
        }

        const totalRx = Math.max(0.5, maxCol - minCol);
        const totalRy = Math.max(0.5, maxRow - minRow);

        // Combined diamond top vertex in 2D screen space:
        const unionTopScreenX = baseTopX + (minCol - minRow) * (tileW / 2);
        const unionTopScreenY = baseTopY + (minCol + minRow) * (tileH / 2);

        const diamondTopX = (unionTopScreenX - minScreenX) * bakeScale;
        const diamondTopY = (unionTopScreenY - minScreenY) * bakeScale;

        // Full column vector (spanning totalRx tiles along +col / down-right):
        const colVecX = totalRx * (scaledTileW / 2);
        const colVecY = totalRx * (scaledTileH / 2);

        // Full row vector (spanning totalRy tiles along +row / down-left):
        const rowVecX = -totalRy * (scaledTileW / 2);
        const rowVecY = totalRy * (scaledTileH / 2);

        // High-res cell size in UV space (at least 128px per tile, capped so canvas stays <= 4096px)
        const baseCellRes = Math.max(128, Math.round(tileW * bakeScale));
        const maxDimTiles = Math.max(1, totalRx, totalRy);
        const cellRes = Math.min(baseCellRes, Math.floor(4096 / maxDimTiles));

        const uvWidth = Math.max(64, Math.round(totalRx * cellRes));
        const uvHeight = Math.max(64, Math.round(totalRy * cellRes));

        const isSmooth = layersToBake.some(l => l.filters.renderMode === 'smooth' || l.filters.renderMode === 'crisp');
        uvCanvas = untransformDiamondCanvasToFlatUV(
            compositeBaked,
            diamondTopX,
            diamondTopY,
            colVecX,
            colVecY,
            rowVecX,
            rowVecY,
            uvWidth,
            uvHeight,
            isSmooth
        );

        // Center of the combined `totalRx × totalRy` diamond in 2D canvas screen coordinates:
        centerScreenX = unionTopScreenX + (totalRx - totalRy) * (tileW / 4);
        centerScreenY = unionTopScreenY + (totalRx + totalRy) * (tileH / 4);

        planeScaleX = totalRx * footprint;
        planeScaleZ = totalRy * footprint;
    } else {
        // Smart overlay fallback: un-transform based on its bounding diamond or use direct bake
        const zoom = (f.mainScale ?? 100) / 100;
        const drawW = primaryOv.width * footprint * zoom;
        const drawH = primaryOv.height * footprint * zoom;

        centerScreenX = primaryOv.x + drawW / 2;
        centerScreenY = primaryOv.y + drawH / 2;

        // Estimate equivalent tile count from width/height
        const eqTilesX = Math.max(1, drawW / config.width);
        const eqTilesY = Math.max(1, drawH / config.height);

        const diamondTopX = (centerScreenX - minScreenX) * bakeScale;
        const diamondTopY = (centerScreenY - drawH / 2 - minScreenY) * bakeScale;
        const colVecX = (drawW / 2) * bakeScale;
        const colVecY = (drawH / 2) * bakeScale;
        const rowVecX = -(drawW / 2) * bakeScale;
        const rowVecY = (drawH / 2) * bakeScale;

        const uvSize = Math.min(2048, Math.max(256, Math.round(Math.max(drawW, drawH) * bakeScale)));
        uvCanvas = untransformDiamondCanvasToFlatUV(
            compositeBaked,
            diamondTopX,
            diamondTopY,
            colVecX,
            colVecY,
            rowVecX,
            rowVecY,
            uvSize,
            uvSize,
            f.renderMode !== 'pixel'
        );

        planeScaleX = eqTilesX;
        planeScaleZ = eqTilesY;
    }

    const textureDataUrl = uvCanvas.toDataURL('image/png');

    // Convert 2D diamond center (centerScreenX, centerScreenY) to 3D world position (threeDX, 0, threeDZ)
    // In ThreeDCanvas:
    // Camera looks at (0,0,0) which projects to (CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2).
    // Let's compute the exact isometric displacement from canvas center:
    const dxScreen = centerScreenX - CANVAS_WIDTH / 2;
    const dyScreen = centerScreenY - CANVAS_HEIGHT / 2;

    // Using isometric basis vectors of the active grid:
    //   1 grid step in +col (3D +X) -> (+config.width / 2, +config.height / 2)
    //   1 grid step in +row (3D +Z) -> (-config.width / 2, +config.height / 2)
    // Solving for (dCol, dRow) from (dxScreen, dyScreen):
    //   dxScreen / (config.width / 2) = dCol - dRow
    //   dyScreen / (config.height / 2) = dCol + dRow
    const uNorm = dxScreen / (config.width / 2);
    const vNorm = dyScreen / (config.height / 2);
    const dCol = (vNorm + uNorm) / 2;
    const dRow = (vNorm - uNorm) / 2;

    const unitSize = getWorldTileUnitSize(activeGrid);

    // In ThreeDCanvas:
    // Camera is at (+110.039, +89.8467, +110.039).
    // Camera right vector is (-1/√2, 0, +1/√2) or (+1/√2, 0, -1/√2)?
    // Wait: camera is at (+X, +Y, +Z) looking at (0,0,0), with up = (0,1,0).
    // Forward = normalize(-1, -0.816, -1).
    // Right = Forward × Up = normalize((-1, -0.816, -1) × (0, 1, 0)) = normalize(+1, 0, -1) = (+1/√2, 0, -1/√2)!
    // Screen Down = Forward × Right -> +X and +Z both go DOWN on screen!
    // Specifically:
    //   World +X projects to Screen Right (+dx) and Screen Down (+dy) -> That is +col!
    //   World +Z projects to Screen Left (-dx) and Screen Down (+dy)  -> That is +row!
    const threeDX = Number((dCol * unitSize).toFixed(3));
    const threeDZ = Number((dRow * unitSize).toFixed(3));

    const newObj: ThreeDObject = {
        id: `3d-plane-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        glbUrl: `${PROCEDURAL_PLANE_PREFIX}?unitSize=${unitSize.toFixed(4)}`,
        name: planeName,
        position: { x: threeDX, y: 0, z: threeDZ },
        rotation: { x: 0, y: 0, z: 0 },
        scale: {
            x: Number(planeScaleX.toFixed(3)),
            y: 1,
            z: Number(planeScaleZ.toFixed(3)),
        },
        uvMapping: 'default',
        textureUrl: textureDataUrl,
        displacementSettings: {
            ...DEFAULT_DISPLACEMENT_SETTINGS,
            tileLockEnabled: true,
            tileNormalWrap: true,
            tileSeamBlend: 35,
            tileCountX: Math.max(1, Math.round(planeScaleX)),
            tileCountZ: Math.max(1, Math.round(planeScaleZ)),
        },
        textureSettings: {
            sharpness: 0,
            scale: 1,
            contrast: 100,
            brightness: 100,
            hue: 0,
            saturation: 100,
            metallic: 0,
            roughness: 1,
            normalScale: 1.0,
            magFilter: f.renderMode === 'pixel' ? 'nearest' : 'linear',
            minFilter: f.renderMode === 'pixel' ? 'nearest' : 'linear',
            anisotropy: 4,
            repeatX: 1,
            repeatY: 1,
            offsetX: 0,
            offsetY: 0,
            rotation: 0,
        },
        shadowSettings: {
            enabled: false,
            targetLayerId: 'ground',
            opacity: 0.5,
            blur: 2,
            color: '#000000',
            offsetY: 0,
            offsetX: 0,
            offsetZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: 1,
        },
    };

    return newObj;
}
