import * as THREE from 'three';
import type { ThreeDObject } from '../types';
import type { ObjectShadowState } from './threeDShadowHelper';
import { SCATTER_GROUP_NAME, isSurfaceScatterChild } from './threeDSurfaceScatterHelper';
import { isProceduralPlaneUrl } from './layerTo3DPlaneUtils';
import { applyBaseMeshHoldoutState } from './threeDSurfaceScatterHoldoutHelper';

export interface TileDiamondSpec {
    id: string;
    centerX: number;
    centerY: number;
    halfW: number;
    halfH: number;
}

export interface IsolatedTileCaptureParams {
    targetDiamond: TileDiamondSpec;
    otherDiamonds: TileDiamondSpec[];
    searchRadiusPx: number;
    mode: 'base_diamond' | 'extra_objects_only';
    includeShadowsInBase?: boolean;
}

export interface IsolatedTileCaptureResult {
    canvas: HTMLCanvasElement;
    matchedObjectRoots: { x: number; y: number }[];
    matchedCount: number;
}

export interface ThreeDSceneCaptureContext {
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.OrthographicCamera | null;
    models: Map<string, THREE.Group>;
    shadowPlanes: Map<string, ObjectShadowState>;
    selectionHelpers: Map<string, THREE.BoxHelper>;
    objects: ThreeDObject[];
    width: number;
    height: number;
    viewportPadding: number;
}

/**
 * Standard full-scene or single-object canvas capture used by regular texture injection.
 */
export function captureStandardThreeDCanvas(
    ctx: ThreeDSceneCaptureContext,
    onlyObjectId?: string
): HTMLCanvasElement | null {
    const { renderer, scene, camera, models, shadowPlanes, selectionHelpers, width, height, viewportPadding } = ctx;
    if (!renderer || !scene || !camera) return null;

    const fullWidth = width + viewportPadding * 2;
    const fullHeight = height + viewportPadding * 2;

    const prevHelperVis = new Map<string, boolean>();
    selectionHelpers.forEach((h, id) => {
        prevHelperVis.set(id, h.visible);
        h.visible = false;
    });

    const prevCamPos = camera.position.clone();
    const prevCamQuat = camera.quaternion.clone();
    camera.position.set(110.039, 89.8467, 110.039);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const prevModelVis = new Map<string, boolean>();
    const prevShadowVis = new Map<string, boolean>();

    if (onlyObjectId && onlyObjectId !== 'all') {
        models.forEach((m, id) => {
            prevModelVis.set(id, m.visible);
            m.visible = id === onlyObjectId;
        });
        shadowPlanes.forEach((st, id) => {
            prevShadowVis.set(id, st.plane.visible);
            st.plane.visible = id === onlyObjectId && prevShadowVis.get(id) === true;
        });
    }

    renderer.render(scene, camera);

    const outCanvas = copyRendererToCroppedCanvas(renderer, width, height, fullWidth, fullHeight, viewportPadding);

    if (onlyObjectId && onlyObjectId !== 'all') {
        models.forEach((m, id) => {
            if (prevModelVis.has(id)) m.visible = prevModelVis.get(id)!;
        });
        shadowPlanes.forEach((st, id) => {
            if (prevShadowVis.has(id)) st.plane.visible = prevShadowVis.get(id)!;
        });
    }

    camera.position.copy(prevCamPos);
    camera.quaternion.copy(prevCamQuat);
    camera.updateMatrixWorld(true);
    selectionHelpers.forEach((h, id) => {
        if (prevHelperVis.has(id)) h.visible = prevHelperVis.get(id)!;
    });
    renderer.render(scene, camera);

    return outCanvas;
}

function copyRendererToCroppedCanvas(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    fullWidth: number,
    fullHeight: number,
    viewportPadding: number
): HTMLCanvasElement {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true })!;
    outCtx.imageSmoothingEnabled = false;
    const srcEl = renderer.domElement;
    const scaleX = srcEl.width / fullWidth;
    const scaleY = srcEl.height / fullHeight;
    outCtx.drawImage(
        srcEl,
        viewportPadding * scaleX,
        viewportPadding * scaleY,
        width * scaleX,
        height * scaleY,
        0,
        0,
        width,
        height
    );
    return outCanvas;
}

/**
 * Computes normalized diamond distance (<= 1.0 means inside the 1x1 diamond)
 * and signed perpendicular pixel distance outside the diamond boundary.
 */
function computeDiamondDistance(
    px: number,
    py: number,
    d: TileDiamondSpec
): { normDist: number; perpOutsidePx: number } {
    const hw = Math.max(1, d.halfW);
    const hh = Math.max(1, d.halfH);
    const normDist = Math.abs(px - d.centerX) / hw + Math.abs(py - d.centerY) / hh;
    const edgeFactor = (hw * hh) / Math.hypot(hw, hh);
    const perpOutsidePx = (normDist - 1.0) * edgeFactor;
    return { normDist, perpOutsidePx };
}

/**
 * Determines whether an individual 3D object/scatter instance at canvas coordinate (px, py)
 * belongs to `targetDiamond`:
 * 1. Its root must be inside the diamond or within `searchRadiusPx` outside the diamond edge.
 * 2. If other tiles are also being baked (`otherDiamonds`), `targetDiamond` must be the closest
 *    tile diamond to `(px, py)` so two adjacent tiles never duplicate the same object.
 */
function doesObjectRootBelongToTile(
    px: number,
    py: number,
    targetDiamond: TileDiamondSpec,
    otherDiamonds: TileDiamondSpec[],
    searchRadiusPx: number
): boolean {
    const myMetric = computeDiamondDistance(px, py, targetDiamond);
    if (myMetric.perpOutsidePx > searchRadiusPx) {
        return false;
    }

    for (let i = 0; i < otherDiamonds.length; i++) {
        const other = otherDiamonds[i];
        if (other.id === targetDiamond.id) continue;
        const otherMetric = computeDiamondDistance(px, py, other);
        if (otherMetric.normDist < myMetric.normDist - 1e-4) {
            return false;
        }
    }

    return true;
}

/**
 * Captures the 3D scene while isolating ONLY the individual scattered objects / 3D models
 * whose roots belong to `params.targetDiamond`, masking out all other scattered instances and objects.
 * In `'extra_objects_only'` mode, also masks out flat ground planes and shadow planes so
 * only clean, whole object silhouettes are rendered with zero rectangular cutoffs or black shadow blobs.
 */
export function captureIsolatedTileObjectsCanvas(
    ctx: ThreeDSceneCaptureContext,
    params: IsolatedTileCaptureParams
): IsolatedTileCaptureResult | null {
    const { renderer, scene, camera, models, shadowPlanes, selectionHelpers, objects, width, height, viewportPadding } = ctx;
    if (!renderer || !scene || !camera) return null;

    const fullWidth = width + viewportPadding * 2;
    const fullHeight = height + viewportPadding * 2;

    const prevHelperVis = new Map<string, boolean>();
    selectionHelpers.forEach((h, id) => {
        prevHelperVis.set(id, h.visible);
        h.visible = false;
    });

    const prevCamPos = camera.position.clone();
    const prevCamQuat = camera.quaternion.clone();
    camera.position.set(110.039, 89.8467, 110.039);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const projectWorldToCanvas = (worldPt: THREE.Vector3): { x: number; y: number } => {
        const ndc = worldPt.clone().project(camera);
        const fullX = (ndc.x * 0.5 + 0.5) * fullWidth;
        const fullY = (-ndc.y * 0.5 + 0.5) * fullHeight;
        return {
            x: fullX - viewportPadding,
            y: fullY - viewportPadding,
        };
    };

    const savedInstancedArrays: { mesh: THREE.InstancedMesh; backup: Float32Array }[] = [];
    const savedMeshVisibility: { mesh: THREE.Object3D; visible: boolean }[] = [];
    const savedBaseHoldoutRestore: { mesh: THREE.Mesh; hideBase: boolean; holdout: boolean; order: number }[] = [];
    const savedShadowVis = new Map<string, boolean>();

    const matchedObjectRoots: { x: number; y: number }[] = [];
    let matchedCount = 0;

    // 1. Handle shadow planes: ALWAYS hide shadow planes during 'extra_objects_only' so semi-transparent
    // black shadows never turn into opaque black blobs outside the diamond!
    shadowPlanes.forEach((st, id) => {
        savedShadowVis.set(id, st.plane.visible);
        if (params.mode === 'extra_objects_only' || params.includeShadowsInBase === false) {
            st.plane.visible = false;
        }
    });

    const tempMat = new THREE.Matrix4();
    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const localPos = new THREE.Vector3();
    const worldPos = new THREE.Vector3();

    // 2. Iterate each 3D model and isolate individual scatter instances / standalone objects
    models.forEach((model, objId) => {
        if (!model.visible) return;
        const objConfig = objects.find((o) => o.id === objId);
        if (!objConfig) return;

        model.updateMatrixWorld(true);
        const scatterGroup = model.getObjectByName(SCATTER_GROUP_NAME) as THREE.Group | undefined;
        const hasActiveScatter = Boolean(
            scatterGroup &&
            scatterGroup.children.length > 0 &&
            objConfig.surfaceScatterSettings?.enabled
        );

        if (hasActiveScatter && scatterGroup) {
            // Collect all InstancedMesh children inside scatterGroup
            const instMeshes: THREE.InstancedMesh[] = [];
            scatterGroup.traverse((child) => {
                if ((child as THREE.InstancedMesh).isInstancedMesh) {
                    instMeshes.push(child as THREE.InstancedMesh);
                }
            });

            // Filter each individual instance in each InstancedMesh by its 3D root position
            const recordedRootKeys = new Set<string>();
            for (const instMesh of instMeshes) {
                instMesh.updateMatrixWorld(true);
                const backup = new Float32Array(instMesh.instanceMatrix.array);
                savedInstancedArrays.push({ mesh: instMesh, backup });

                const count = instMesh.count;
                for (let i = 0; i < count; i++) {
                    instMesh.getMatrixAt(i, tempMat);
                    localPos.setFromMatrixPosition(tempMat);
                    worldPos.copy(localPos).applyMatrix4(instMesh.matrixWorld);
                    const screenPt = projectWorldToCanvas(worldPos);

                    const keep = doesObjectRootBelongToTile(
                        screenPt.x,
                        screenPt.y,
                        params.targetDiamond,
                        params.otherDiamonds,
                        params.searchRadiusPx
                    );

                    if (keep) {
                        const key = `${Math.round(screenPt.x)},${Math.round(screenPt.y)}`;
                        if (!recordedRootKeys.has(key)) {
                            recordedRootKeys.add(key);
                            matchedObjectRoots.push(screenPt);
                            matchedCount++;
                        }
                    } else {
                        instMesh.setMatrixAt(i, zeroMat);
                    }
                }
                instMesh.instanceMatrix.needsUpdate = true;
            }

            // In 'extra_objects_only' mode, hide the host base plane mesh (or set it to invisible depth holdout)
            // so the flat plane is never baked into the rectangular extra image!
            if (params.mode === 'extra_objects_only') {
                const scatter = objConfig.surfaceScatterSettings;
                const activeItems = (scatter?.items || []).filter((it) => it.enabled && it.glbUrl);
                const prevHideBase = Boolean(scatter?.enabled && activeItems.length > 0 && scatter?.hideBaseMesh);
                const prevHoldout = Boolean(prevHideBase && scatter?.holdoutMask);
                const useHoldoutInExtra = Boolean(scatter?.holdoutMask);

                model.traverse((child) => {
                    if (isSurfaceScatterChild(child)) return;
                    if ((child as THREE.Mesh).isMesh) {
                        const m = child as THREE.Mesh;
                        savedBaseHoldoutRestore.push({
                            mesh: m,
                            hideBase: prevHideBase,
                            holdout: prevHoldout,
                            order: model.renderOrder || 0,
                        });
                        applyBaseMeshHoldoutState(m, true, useHoldoutInExtra, model.renderOrder || 0);
                    }
                });
            }
        } else {
            // Standalone 3D model (no surface scatter)
            const isFlatPlane = isProceduralPlaneUrl(objConfig.glbUrl);
            if (params.mode === 'extra_objects_only' && isFlatPlane) {
                // Never bake a flat procedural plane into extraImageData
                savedMeshVisibility.push({ mesh: model, visible: model.visible });
                model.visible = false;
            } else if (!isFlatPlane) {
                const box = new THREE.Box3().setFromObject(model);
                const center = new THREE.Vector3();
                box.getCenter(center);
                const basePt = new THREE.Vector3(center.x, isFinite(box.min.y) ? box.min.y : center.y, center.z);
                const screenPt = projectWorldToCanvas(basePt);

                const keep = doesObjectRootBelongToTile(
                    screenPt.x,
                    screenPt.y,
                    params.targetDiamond,
                    params.otherDiamonds,
                    params.searchRadiusPx
                );

                if (keep) {
                    matchedObjectRoots.push(screenPt);
                    matchedCount++;
                } else {
                    savedMeshVisibility.push({ mesh: model, visible: model.visible });
                    model.visible = false;
                }
            }
        }
    });

    renderer.render(scene, camera);
    const outCanvas = copyRendererToCroppedCanvas(renderer, width, height, fullWidth, fullHeight, viewportPadding);

    // Restore all modified InstancedMesh buffers, base mesh holdout states, model visibilities, and shadows
    for (const item of savedInstancedArrays) {
        item.mesh.instanceMatrix.array.set(item.backup);
        item.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const item of savedBaseHoldoutRestore) {
        applyBaseMeshHoldoutState(item.mesh, item.hideBase, item.holdout, item.order);
    }
    for (const item of savedMeshVisibility) {
        item.mesh.visible = item.visible;
    }
    shadowPlanes.forEach((st, id) => {
        if (savedShadowVis.has(id)) {
            st.plane.visible = savedShadowVis.get(id)!;
        }
    });

    camera.position.copy(prevCamPos);
    camera.quaternion.copy(prevCamQuat);
    camera.updateMatrixWorld(true);
    selectionHelpers.forEach((h, id) => {
        if (prevHelperVis.has(id)) h.visible = prevHelperVis.get(id)!;
    });
    renderer.render(scene, camera);

    return {
        canvas: outCanvas,
        matchedObjectRoots,
        matchedCount,
    };
}
