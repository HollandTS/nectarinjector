import * as THREE from 'three';
import type { ThreeDObject, ThreeDShadowSettings } from '../types';

export const DEFAULT_SHADOW_SETTINGS: ThreeDShadowSettings = {
    enabled: true,
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
};

export interface ObjectShadowState {
    plane: THREE.Mesh;
    texture: THREE.CanvasTexture;
    canvas: HTMLCanvasElement;
    renderTarget: THREE.WebGLRenderTarget;
    shadowCam: THREE.OrthographicCamera;
    silhouetteMat: THREE.MeshBasicMaterial;
    lastSignature: string;
}

const SHADOW_MAP_RES = 1024;
const SHADOW_PLANE_SIZE = 600;

/**
 * Configure directional light for 3D scene illumination.
 */
export function setupDirectionalLightShadow(light: THREE.DirectionalLight): void {
    light.castShadow = false;
    const sunDir = new THREE.Vector3(-1, 1, 0.75).normalize();
    light.position.copy(sunDir.clone().multiplyScalar(300));
    light.target.position.set(0, 0, 0);
}

/**
 * Update mesh castShadow flags on the model (kept for compatibility).
 */
export function updateModelMeshShadows(model: THREE.Object3D, castShadow: boolean): void {
    model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            child.castShadow = castShadow;
            child.receiveShadow = false;
        }
    });
}

function computeSignature(
    obj: ThreeDObject,
    shadow: ThreeDShadowSettings,
    contactBaseY: number
): string {
    return JSON.stringify({
        baseY: Number(contactBaseY.toFixed(2)),
        rx: Number(obj.rotation.x.toFixed(3)),
        ry: Number(obj.rotation.y.toFixed(3)),
        rz: Number(obj.rotation.z.toFixed(3)),
        sx: Number(obj.scale.x.toFixed(3)),
        sy: Number(obj.scale.y.toFixed(3)),
        sz: Number(obj.scale.z.toFixed(3)),
        enabled: shadow.enabled !== false,
        opacity: shadow.opacity ?? 0.5,
        blur: shadow.blur ?? 2,
        color: shadow.color || '#000000',
        ox: shadow.offsetX ?? 0,
        oy: shadow.offsetY ?? 0,
        oz: shadow.offsetZ ?? 0,
        srx: shadow.rotationX ?? 0,
        sry: shadow.rotationY ?? 0,
        srz: shadow.rotationZ ?? 0,
        sscale: shadow.scale ?? 1,
        scatterEnabled: Boolean(obj.surfaceScatterSettings?.enabled),
        scatterCount: obj.surfaceScatterSettings?.amount ?? 0,
        scatterDensity: obj.surfaceScatterSettings?.density ?? 100,
        scatterSeed: obj.surfaceScatterSettings?.seed ?? 0,
        scatterScale: obj.surfaceScatterSettings?.baseScale ?? 0.55,
        scatterHideBase: Boolean(obj.surfaceScatterSettings?.hideBaseMesh),
        scatterHoldout: Boolean(obj.surfaceScatterSettings?.holdoutMask),
        scatterItems: (obj.surfaceScatterSettings?.items || []).map((i) => `${i.id}:${i.enabled}:${i.scaleMultiplier}`),
    });
}

/**
 * Renders an isolated per-object projected shadow onto a ground plane mesh.
 * Because the camera is orthographic and there is no vertical depth in the 2D canvas,
 * the shadow plane automatically tracks the exact bottom of the 3D object (`box.min.y`)
 * plus any manual `shadow.offsetY`. This guarantees the shadow is always anchored
 * right at the base of the object by default without floating or drifting!
 */
export function updateObjectShadowPlane(
    scene: THREE.Scene,
    obj: ThreeDObject,
    shadowStatesMap: Map<string, ObjectShadowState>,
    renderer?: THREE.WebGLRenderer | null,
    model?: THREE.Group | null
): void {
    const shadow = obj.shadowSettings || DEFAULT_SHADOW_SETTINGS;
    const isEnabled = shadow.enabled !== false;

    let state = shadowStatesMap.get(obj.id);

    if (!isEnabled) {
        if (state) {
            state.plane.visible = false;
        }
        return;
    }

    if (!state) {
        const planeGeo = new THREE.PlaneGeometry(SHADOW_PLANE_SIZE, SHADOW_PLANE_SIZE);
        planeGeo.rotateX(-Math.PI / 2);

        const canvas = document.createElement('canvas');
        canvas.width = SHADOW_MAP_RES;
        canvas.height = SHADOW_MAP_RES;

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const planeMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: shadow.opacity ?? 0.5,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.userData.id = `shadow-${obj.id}`;
        plane.renderOrder = -1;
        plane.frustumCulled = false;

        const half = SHADOW_PLANE_SIZE / 2;
        const shadowCam = new THREE.OrthographicCamera(-half, half, half, -half, -2000, 4000);

        const renderTarget = new THREE.WebGLRenderTarget(SHADOW_MAP_RES, SHADOW_MAP_RES, {
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        });

        const silhouetteMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(shadow.color || '#000000'),
            side: THREE.DoubleSide,
        });

        scene.add(plane);

        state = {
            plane,
            texture,
            canvas,
            renderTarget,
            shadowCam,
            silhouetteMat,
            lastSignature: '',
        };
        shadowStatesMap.set(obj.id, state);
    }

    // Automatically find the exact lowest point of the object in world space
    // so the shadow always touches the base of the object by default
    let contactBaseY = obj.position?.y || 0;
    if (model) {
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        if (isFinite(box.min.y)) {
            contactBaseY = box.min.y;
        }
    }

    const planeY = contactBaseY + (shadow.offsetY ?? 0);
    const posX = (obj.position?.x || 0) + (shadow.offsetX || 0);
    const posZ = (obj.position?.z || 0) + (shadow.offsetZ || 0);
    state.plane.position.set(posX, planeY, posZ);

    const rotX = ((shadow.rotationX || 0) * Math.PI) / 180;
    const rotY = ((shadow.rotationY || 0) * Math.PI) / 180;
    const rotZ = ((shadow.rotationZ || 0) * Math.PI) / 180;
    state.plane.rotation.set(rotX, rotY, rotZ);

    const s = Math.max(0.1, shadow.scale ?? 1);
    state.plane.scale.set(s, s, s);

    const objOpacityFactor = Math.max(0, Math.min(100, obj.opacity ?? 100)) / 100;
    const mat = state.plane.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, Math.min(1, (shadow.opacity ?? 0.5) * objOpacityFactor));
    state.plane.visible = objOpacityFactor > 0.001;

    if (!renderer || !model) return;

    const sig = computeSignature(obj, shadow, contactBaseY - (obj.position?.y || 0));
    if (state.lastSignature === sig) return;
    state.lastSignature = sig;

    state.silhouetteMat.color.set(shadow.color || '#000000');

    // Sun direction vector from ground to sun is (-1, 1, 0.75)
    // A point at height h = (y - planeY) projects onto the plane at:
    // x_proj = x + h * 1.0, z_proj = z - h * 0.75
    const shearMatrix = new THREE.Matrix4().set(
        1, 1.0, 0, -planeY * 1.0 - (obj.position?.x || 0),
        0, 1, 0, -planeY,
        0, -0.75, 1, planeY * 0.75 - (obj.position?.z || 0),
        0, 0, 0, 1
    );

    state.shadowCam.position.set(0, 400, 0);
    state.shadowCam.up.set(0, 0, -1);
    state.shadowCam.lookAt(0, 0, 0);
    state.shadowCam.updateMatrixWorld(true);

    const shadowScene = new THREE.Scene();
    const shearedGroup = new THREE.Group();
    shearedGroup.matrixAutoUpdate = false;
    shearedGroup.matrix.copy(shearMatrix);

    const modelClone = model.clone(true);
    // Copy InstancedMesh instanceMatrix buffer references onto the cloned InstancedMesh instances
    const origInstanced: THREE.InstancedMesh[] = [];
    model.traverse((c) => {
        if ((c as THREE.InstancedMesh).isInstancedMesh) {
            origInstanced.push(c as THREE.InstancedMesh);
        }
    });
    const hideBaseInShadow = Boolean(
        obj.surfaceScatterSettings?.enabled &&
        (obj.surfaceScatterSettings?.items || []).some((i) => i.enabled && i.glbUrl) &&
        obj.surfaceScatterSettings?.hideBaseMesh
    );

    let instIdx = 0;
    modelClone.traverse((child) => {
        if ((child as THREE.InstancedMesh).isInstancedMesh) {
            const srcInst = origInstanced[instIdx++];
            if (srcInst) {
                (child as THREE.InstancedMesh).instanceMatrix = srcInst.instanceMatrix;
                (child as THREE.InstancedMesh).count = srcInst.count;
            }
        } else if ((child as THREE.Mesh).isMesh) {
            if (hideBaseInShadow) {
                child.visible = false;
            }
        }
        if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = state!.silhouetteMat;
        }
    });
    shearedGroup.add(modelClone);
    shadowScene.add(shearedGroup);

    const prevRenderTarget = renderer.getRenderTarget();
    const prevClearColor = renderer.getClearColor(new THREE.Color());
    const prevClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(state.renderTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(shadowScene, state.shadowCam);

    const pixelBuffer = new Uint8Array(SHADOW_MAP_RES * SHADOW_MAP_RES * 4);
    renderer.readRenderTargetPixels(
        state.renderTarget,
        0,
        0,
        SHADOW_MAP_RES,
        SHADOW_MAP_RES,
        pixelBuffer
    );

    renderer.setRenderTarget(prevRenderTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);

    const ctx = state.canvas.getContext('2d');
    if (ctx) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = SHADOW_MAP_RES;
        tempCanvas.height = SHADOW_MAP_RES;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            const imgData = tempCtx.createImageData(SHADOW_MAP_RES, SHADOW_MAP_RES);
            for (let y = 0; y < SHADOW_MAP_RES; y++) {
                const srcRow = (SHADOW_MAP_RES - 1 - y) * SHADOW_MAP_RES * 4;
                const dstRow = y * SHADOW_MAP_RES * 4;
                for (let x = 0; x < SHADOW_MAP_RES * 4; x++) {
                    imgData.data[dstRow + x] = pixelBuffer[srcRow + x];
                }
            }
            tempCtx.putImageData(imgData, 0, 0);

            ctx.clearRect(0, 0, SHADOW_MAP_RES, SHADOW_MAP_RES);
            const blurPx = Math.max(0, (shadow.blur ?? 2) * 1.5);
            ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.filter = 'none';
            state.texture.needsUpdate = true;
        }
    }
}

/**
 * Cleans up a single object's shadow state and plane.
 */
export function cleanupShadowPlane(
    scene: THREE.Scene,
    objId: string,
    shadowStatesMap: Map<string, ObjectShadowState>
): void {
    const state = shadowStatesMap.get(objId);
    if (state) {
        scene.remove(state.plane);
        state.plane.geometry.dispose();
        if (Array.isArray(state.plane.material)) {
            state.plane.material.forEach((m) => m.dispose());
        } else {
            state.plane.material.dispose();
        }
        state.texture.dispose();
        state.renderTarget.dispose();
        state.silhouetteMat.dispose();
        shadowStatesMap.delete(objId);
    }
}

/**
 * Cleans up all object shadow states and planes.
 */
export function cleanupAllShadowPlanes(
    scene: THREE.Scene,
    shadowStatesMap: Map<string, ObjectShadowState>
): void {
    shadowStatesMap.forEach((_, id) => {
        cleanupShadowPlane(scene, id, shadowStatesMap);
    });
}

/**
 * Creates a deep copy of a ThreeDObject with a new unique ID and identical transforms.
 */
export function cloneThreeDObject(source: ThreeDObject): ThreeDObject {
    const baseName = source.name.replace(/\s*\(Copy(\s+\d+)?\)$/i, '');
    return {
        ...source,
        id: `3d-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: `${baseName} (Copy)`,
        position: { ...source.position },
        rotation: { ...source.rotation },
        scale: { ...source.scale },
        textureSettings: source.textureSettings ? { ...source.textureSettings } : undefined,
        shadowSettings: source.shadowSettings ? { ...source.shadowSettings } : undefined,
        displacementSettings: source.displacementSettings
            ? {
                  ...source.displacementSettings,
                  colorHeightRules: source.displacementSettings.colorHeightRules
                      ? source.displacementSettings.colorHeightRules.map((r) => ({
                            ...r,
                            targetColor: { ...r.targetColor },
                        }))
                      : undefined,
              }
            : undefined,
        surfaceScatterSettings: source.surfaceScatterSettings
            ? {
                  ...source.surfaceScatterSettings,
                  items: (source.surfaceScatterSettings.items || []).map((it) => ({ ...it })),
              }
            : undefined,
    };
}

