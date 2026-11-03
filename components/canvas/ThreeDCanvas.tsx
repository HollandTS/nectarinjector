
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ThreeDObject, ProjectOverlay, GridType } from '../../types';
import { renderOverlayToCanvas } from '../../utils/overlayRenderer';
import { 
    setupDirectionalLightShadow, 
    updateModelMeshShadows, 
    updateObjectShadowPlane, 
    cleanupShadowPlane, 
    cleanupAllShadowPlanes,
    ObjectShadowState
} from '../../utils/threeDShadowHelper';
import { 
    initGlbModel, 
    restoreUVs, 
    applySmartUVs, 
    applyMaterialsToMesh, 
    loadTextureAsync 
} from '../../utils/threeDMaterialHelper';
import { isLinkedGroupId, renderLinkedGroupComposite } from '../../utils/layerLinkUtils';
import { isProceduralPlaneUrl, createProceduralPlaneGroup } from '../../utils/layerTo3DPlaneUtils';
import { applyGeometryDisplacementToModel } from '../../utils/threeDDisplacementHelper';
import { applyCliffShapingToModel } from '../../utils/threeDCliffSculptHelper';
import { applySlopeShapingToModel } from '../../utils/threeDSlopeSculptHelper';
import { applySurfaceScatterToModel, syncBaseMeshVisibilityAndHoldout, SCATTER_GROUP_NAME } from '../../utils/threeDSurfaceScatterHelper';
import { registerThreeDCaptureHandle, clearThreeDSurfaceCache } from '../../utils/threeDInjectionUtils';
import {
    captureStandardThreeDCanvas,
    captureIsolatedTileObjectsCanvas,
    IsolatedTileCaptureParams,
} from '../../utils/threeDSceneCaptureHelper';
import { findModelsInSelectionBox } from '../../utils/threeDSelectionHelper';
import { ThreeDGizmoOverlay } from './ThreeDGizmoOverlay';
import { getThreeDCanvasZIndex, getThreeDDefaultStackOrder } from '../../utils/sceneOrderHelper';
import { computeNextThreeDObjectScale, applyMouseDeltaToThreeDModel } from '../../utils/threeDTransformHelper';
import { applyModelSubdivision } from '../../utils/threeDSubdivisionHelper';

interface ThreeDCanvasProps {
    width: number;
    height: number;
    objects: ThreeDObject[];
    overlays: ProjectOverlay[];
    gridType: GridType;
    selectedObjectId: string | null;
    selectedObjectIds?: Set<string>;
    onSelectObject: (id: string | null) => void;
    onSelectObjects?: (ids: string[]) => void;
    autoGrabTrigger?: number;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>) => void;
    onTransformStart: () => void;
    onTransformEnd: () => void;
    isActive: boolean;
    isVisible: boolean;
    zoom: number;
}

const VIEWPORT_PADDING = 500;

export const ThreeDCanvas = forwardRef<{ capture: () => string | null }, ThreeDCanvasProps>(({
    width, height, objects, overlays, gridType, selectedObjectId, selectedObjectIds, onSelectObject, onSelectObjects, autoGrabTrigger, onUpdateObject, onTransformStart, onTransformEnd, isActive, isVisible, zoom
}, ref) => {
    const fullWidth = width + VIEWPORT_PADDING * 2;
    const fullHeight = height + VIEWPORT_PADDING * 2;
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelsRef = useRef<Map<string, THREE.Group>>(new Map());
    const shadowPlanesRef = useRef<Map<string, ObjectShadowState>>(new Map());
    const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
    const raycaster = useRef(new THREE.Raycaster());
    const mouse = useRef(new THREE.Vector2());

    const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale' | null>(null);
    const [transformAxis, setTransformAxis] = useState<'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz'>('xyz');
    const [selectionBox, setSelectionBox] = useState<{ active: boolean; x1: number; y1: number; x2: number; y2: number }>({
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
    });

    const [isSceneReady, setIsSceneReady] = useState(false);
    const animationFrameRef = useRef<number | null>(null);

    const selectionHelpersRef = useRef<Map<string, THREE.BoxHelper>>(new Map());
    const objectsRef = useRef(objects);
    const selectedObjectIdRef = useRef(selectedObjectId);
    const selectedObjectIdsRef = useRef<Set<string>>(
        selectedObjectIds && selectedObjectIds.size > 0
            ? selectedObjectIds
            : new Set(selectedObjectId ? [selectedObjectId] : [])
    );
    const transformModeRef = useRef(transformMode);
    const transformAxisRef = useRef(transformAxis);
    const onUpdateObjectRef = useRef(onUpdateObject);
    const onTransformStartRef = useRef(onTransformStart);
    const onTransformEndRef = useRef(onTransformEnd);
    const stateUpdateTimeoutRef = useRef<number | null>(null);
    const initialTransformsRef = useRef<Map<string, {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
    }>>(new Map());
    const lastAutoGrabHandledRef = useRef<number>(0);

    useEffect(() => { objectsRef.current = objects; }, [objects]);
    useEffect(() => { selectedObjectIdRef.current = selectedObjectId; }, [selectedObjectId]);
    useEffect(() => {
        if (selectedObjectIds && selectedObjectIds.size > 0) {
            selectedObjectIdsRef.current = selectedObjectIds;
        } else if (selectedObjectId) {
            selectedObjectIdsRef.current = new Set([selectedObjectId]);
        } else {
            selectedObjectIdsRef.current = new Set();
        }
    }, [selectedObjectIds, selectedObjectId]);
    useEffect(() => { transformModeRef.current = transformMode; }, [transformMode]);
    useEffect(() => { transformAxisRef.current = transformAxis; }, [transformAxis]);
    useEffect(() => { onUpdateObjectRef.current = onUpdateObject; }, [onUpdateObject]);
    useEffect(() => { onTransformStartRef.current = onTransformStart; }, [onTransformStart]);
    useEffect(() => { onTransformEndRef.current = onTransformEnd; }, [onTransformEnd]);

    const getEffectiveSelectedIds = (): string[] => {
        const set = selectedObjectIdsRef.current;
        const baseIds = set && set.size > 0 ? Array.from(set) : (selectedObjectIdRef.current ? [selectedObjectIdRef.current] : []);
        if (baseIds.length === 0) return [];

        const activeGroupIds = new Set<string>();
        baseIds.forEach((id) => {
            const obj = objectsRef.current.find((o) => o.id === id);
            if (obj?.sceneGroupId && obj.sceneGroupMoveTogether !== false) {
                activeGroupIds.add(obj.sceneGroupId);
            }
        });

        if (activeGroupIds.size === 0) return baseIds;

        const expanded = new Set<string>(baseIds);
        objectsRef.current.forEach((o) => {
            if (o.sceneGroupId && activeGroupIds.has(o.sceneGroupId) && o.sceneGroupMoveTogether !== false) {
                expanded.add(o.id);
            }
        });
        return Array.from(expanded);
    };

    const beginTransformSession = (mode: 'translate' | 'rotate' | 'scale', explicitIds?: string[]) => {
        const ids = explicitIds && explicitIds.length > 0 ? explicitIds : getEffectiveSelectedIds();
        if (ids.length === 0) return;

        if (transformModeRef.current && initialTransformsRef.current.size > 0) {
            // Switching between G / R / S mid-transform preserves the original starting snapshot
            transformModeRef.current = mode;
            setTransformMode(mode);
            setTransformAxis('xyz');
            transformAxisRef.current = 'xyz';
            return;
        }

        const nextMap = new Map<string, {
            position: { x: number; y: number; z: number };
            rotation: { x: number; y: number; z: number };
            scale: { x: number; y: number; z: number };
        }>();

        ids.forEach((id) => {
            const model = modelsRef.current.get(id);
            const obj = objectsRef.current.find((o) => o.id === id);
            if (model) {
                nextMap.set(id, {
                    position: { x: model.position.x, y: model.position.y, z: model.position.z },
                    rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                    scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
                });
            } else if (obj) {
                nextMap.set(id, {
                    position: { ...obj.position },
                    rotation: { ...obj.rotation },
                    scale: { ...obj.scale },
                });
            }
        });

        initialTransformsRef.current = nextMap;
        onTransformStartRef.current();
        transformModeRef.current = mode;
        transformAxisRef.current = 'xyz';
        setTransformMode(mode);
        setTransformAxis('xyz');
    };

    const confirmActiveTransform = () => {
        if (!transformModeRef.current) return;
        if (stateUpdateTimeoutRef.current) {
            window.clearTimeout(stateUpdateTimeoutRef.current);
            stateUpdateTimeoutRef.current = null;
        }
        const ids = getEffectiveSelectedIds();
        ids.forEach((id) => {
            const model = modelsRef.current.get(id);
            if (model) {
                onUpdateObjectRef.current(id, {
                    position: { x: model.position.x, y: model.position.y, z: model.position.z },
                    rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                    scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
                });
            }
        });
        initialTransformsRef.current.clear();
        transformModeRef.current = null;
        setTransformMode(null);
        onTransformEndRef.current();
    };

    const cancelActiveTransform = () => {
        if (!transformModeRef.current) return;
        if (stateUpdateTimeoutRef.current) {
            window.clearTimeout(stateUpdateTimeoutRef.current);
            stateUpdateTimeoutRef.current = null;
        }
        const ids = getEffectiveSelectedIds();
        ids.forEach((id) => {
            const snap = initialTransformsRef.current.get(id);
            const fallbackObj = objectsRef.current.find((o) => o.id === id);
            const restore = snap || fallbackObj;
            if (!restore) return;

            const model = modelsRef.current.get(id);
            if (model) {
                model.position.set(restore.position.x, restore.position.y, restore.position.z);
                model.rotation.set(restore.rotation.x, restore.rotation.y, restore.rotation.z);
                model.scale.set(restore.scale.x, restore.scale.y, restore.scale.z);

                const helper = selectionHelpersRef.current.get(id);
                if (helper) helper.update();

                if (sceneRef.current && fallbackObj) {
                    updateObjectShadowPlane(
                        sceneRef.current,
                        {
                            ...fallbackObj,
                            position: { ...restore.position },
                            rotation: { ...restore.rotation },
                            scale: { ...restore.scale },
                        },
                        shadowPlanesRef.current,
                        rendererRef.current,
                        model
                    );
                }
            }
            onUpdateObjectRef.current(id, {
                position: { ...restore.position },
                rotation: { ...restore.rotation },
                scale: { ...restore.scale },
            });
        });

        initialTransformsRef.current.clear();
        transformModeRef.current = null;
        setTransformMode(null);
        onTransformEndRef.current();
    };

    // Automatically enter Grab ('translate') mode when an object is duplicated
    useEffect(() => {
        if (!autoGrabTrigger || autoGrabTrigger === lastAutoGrabHandledRef.current) return;
        const ids =
            selectedObjectIds && selectedObjectIds.size > 0
                ? Array.from(selectedObjectIds)
                : selectedObjectId
                ? [selectedObjectId]
                : [];
        if (ids.length === 0) return;
        lastAutoGrabHandledRef.current = autoGrabTrigger;
        selectedObjectIdsRef.current = new Set(ids);
        selectedObjectIdRef.current = ids[ids.length - 1];
        beginTransformSession('translate', ids);
    }, [autoGrabTrigger, selectedObjectId, selectedObjectIds, objects]);

    useEffect(() => {
        const hasAny =
            (selectedObjectIds && selectedObjectIds.size > 0) || !!selectedObjectId;
        if (!hasAny) {
            initialTransformsRef.current.clear();
            transformModeRef.current = null;
            setTransformMode(null);
        }
    }, [selectedObjectId, selectedObjectIds]);

    const getCaptureContext = () => ({
        renderer: rendererRef.current,
        scene: sceneRef.current,
        camera: cameraRef.current,
        models: modelsRef.current,
        shadowPlanes: shadowPlanesRef.current,
        selectionHelpers: selectionHelpersRef.current,
        objects: objectsRef.current,
        width,
        height,
        viewportPadding: VIEWPORT_PADDING,
    });

    const captureSceneOrObjectCanvas = (onlyObjectId?: string): HTMLCanvasElement | null => {
        return captureStandardThreeDCanvas(getCaptureContext(), onlyObjectId);
    };

    const captureSceneOrObject = (onlyObjectId?: string): string | null => {
        const c = captureSceneOrObjectCanvas(onlyObjectId);
        return c ? c.toDataURL('image/png') : null;
    };

    useImperativeHandle(ref, () => ({
        capture: () => captureSceneOrObject(),
        captureObject: (objectId: string) => captureSceneOrObject(objectId),
    }));

    useEffect(() => {
        registerThreeDCaptureHandle({
            capture: () => captureSceneOrObject(),
            captureObject: (objectId: string) => captureSceneOrObject(objectId),
            captureCanvas: (objectId?: string) => captureSceneOrObjectCanvas(objectId),
            captureIsolatedTileObjects: (params: IsolatedTileCaptureParams) =>
                captureIsolatedTileObjectsCanvas(getCaptureContext(), params),
            getObjects: () => objectsRef.current,
        });
        return () => {
            registerThreeDCaptureHandle(null);
        };
    }, [isSceneReady, objects, width, height]);

    useEffect(() => {
        if (!sceneRef.current) return;
        const scene = sceneRef.current;

        selectionHelpersRef.current.forEach((helper) => {
            scene.remove(helper);
        });
        selectionHelpersRef.current.clear();

        const activeIds =
            selectedObjectIds && selectedObjectIds.size > 0
                ? Array.from(selectedObjectIds)
                : selectedObjectId
                ? [selectedObjectId]
                : [];

        if (activeIds.length > 0 && isVisible) {
            activeIds.forEach((id) => {
                const model = modelsRef.current.get(id);
                if (model) {
                    let color = id === selectedObjectId ? 0x00ffff : 0x38bdf8;
                    if (isActive && transformMode) {
                        if (transformMode === 'translate') color = 0x00ff00; // Green
                        else if (transformMode === 'rotate') color = 0xff0000; // Red
                        else if (transformMode === 'scale') color = 0x0000ff; // Blue
                    }
                    const helper = new THREE.BoxHelper(model, color);
                    scene.add(helper);
                    selectionHelpersRef.current.set(id, helper);
                }
            });
        }
    }, [selectedObjectId, selectedObjectIds, objects, isActive, isVisible, transformMode, transformAxis]);

    useEffect(() => {
        if (!containerRef.current || width <= 0 || height <= 0) return;
        
        const scene = sceneRef.current || new THREE.Scene();
        if (!sceneRef.current) {
            sceneRef.current = scene;
            const ambientLight = new THREE.AmbientLight(0xcccccc, 1.0);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
            setupDirectionalLightShadow(directionalLight);
            scene.add(directionalLight);
            scene.add(directionalLight.target);
            directionalLightRef.current = directionalLight;
        }

        const baseFrustumSize = 74.8;
        const unitsPerPixel = baseFrustumSize / height;
        const frustumWidth = fullWidth * unitsPerPixel;
        const frustumHeight = fullHeight * unitsPerPixel;
        const camera = new THREE.OrthographicCamera(
            -frustumWidth / 2,
            frustumWidth / 2,
            frustumHeight / 2,
            -frustumHeight / 2,
            -4000,
            6000
        );
        camera.position.set(110.039, 89.8467, 110.039);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(fullWidth, fullHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.pointerEvents = 'none';
        // Clear existing canvases
        const canvases = containerRef.current.querySelectorAll('canvas');
        canvases.forEach(c => c.remove());
        
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Attach OrbitControls to the container using RIGHT mouse button for camera orbit/view drag
        const controls = new OrbitControls(camera, containerRef.current);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.enableZoom = false;
        controls.mouseButtons = {
            LEFT: null as any,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
        };
        controlsRef.current = controls;

        const initialPosition = new THREE.Vector3(110.039, 89.8467, 110.039);
        const initialTarget = new THREE.Vector3(0, 0, 0);
        let isInteracting = false;

        const onStart = () => isInteracting = true;
        const onEnd = () => isInteracting = false;
        controls.addEventListener('start', onStart);
        controls.addEventListener('end', onEnd);

        const animate = () => {
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
            animationFrameRef.current = requestAnimationFrame(animate);
            
            selectionHelpersRef.current.forEach((helper) => {
                helper.update();
            });

            // Disable camera reset if we are in a transform mode
            if (!isInteracting && !transformModeRef.current) {
                cameraRef.current.position.lerp(initialPosition, 0.05);
                controlsRef.current?.target.lerp(initialTarget, 0.05);
            }

            // Disable controls if we are transforming
            if (controlsRef.current) {
                controlsRef.current.enabled = !transformModeRef.current;
                controlsRef.current.update();
            }

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();
        setIsSceneReady(true);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            controls.removeEventListener('start', onStart);
            controls.removeEventListener('end', onEnd);
            controls.dispose();
            renderer.dispose();
            if (sceneRef.current) {
                cleanupAllShadowPlanes(sceneRef.current, shadowPlanesRef.current);
            }
            containerRef.current?.removeChild(renderer.domElement);
            setIsSceneReady(false);
        };
    }, [width, height]);

    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene || !isSceneReady) return;

        const loader = new GLTFLoader();

        objects.forEach(obj => {
            if (!modelsRef.current.has(obj.id)) {
                if (isProceduralPlaneUrl(obj.glbUrl)) {
                    const wrapper = createProceduralPlaneGroup(obj.id, obj.glbUrl);
                    scene.add(wrapper);
                    modelsRef.current.set(obj.id, wrapper);
                    updateModelProps(wrapper, obj);
                } else {
                    loader.load(obj.glbUrl, (gltf) => {
                        const model = gltf.scene;
                        model.userData.id = obj.id;
                        initGlbModel(model);
                        
                        // Ensure model is at origin before computing box
                        model.position.set(0, 0, 0);
                        model.updateMatrixWorld(true);
                        
                        // Center the model's geometry horizontally, and put bottom at y=0
                        const box = new THREE.Box3().setFromObject(model);
                        if (isFinite(box.min.x) && isFinite(box.min.y) && isFinite(box.min.z)) {
                            const center = new THREE.Vector3();
                            box.getCenter(center);
                            model.position.x = -center.x;
                            model.position.z = -center.z;
                            model.position.y = -box.min.y;
                        }
                        
                        // Re-wrap in a group to maintain the offset but allow clean position updates
                        const wrapper = new THREE.Group();
                        wrapper.add(model);
                        wrapper.userData.id = obj.id;
                        
                        scene.add(wrapper);
                        modelsRef.current.set(obj.id, wrapper);
                        
                        // Auto-scale on initial import only if object is still at default (1, 1, 1) scale
                        const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        const targetSize = 40;
                        const isDefaultScale =
                            Math.abs(obj.scale.x - 1) < 1e-5 &&
                            Math.abs(obj.scale.y - 1) < 1e-5 &&
                            Math.abs(obj.scale.z - 1) < 1e-5;

                        if (isDefaultScale && maxDim > 0 && (maxDim > targetSize || maxDim < 1)) {
                            const scaleFactor = targetSize / maxDim;
                            const nextScale = { x: scaleFactor, y: scaleFactor, z: scaleFactor };
                            wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
                            setTimeout(() => {
                                onUpdateObject(obj.id, { scale: nextScale });
                            }, 0);
                        }

                        updateModelProps(wrapper, obj);
                    });
                }
            } else {
                const model = modelsRef.current.get(obj.id);
                if (model) {
                    if (!scene.children.includes(model)) scene.add(model);
                    updateModelProps(model, obj);
                }
            }
        });

        // Cleanup removed objects
        modelsRef.current.forEach((model, id) => {
            if (!objects.find(o => o.id === id)) {
                scene.remove(model);
                modelsRef.current.delete(id);
                cleanupShadowPlane(scene, id, shadowPlanesRef.current);
            }
        });
    }, [objects, overlays, gridType, isSceneReady]);

    const textureCache = useRef<Map<string, THREE.Texture>>(new Map());
    const overlayTextureCache = useRef<Map<string, THREE.CanvasTexture>>(new Map());
    const wallOverlayTextureCache = useRef<Map<string, THREE.CanvasTexture>>(new Map());
    const slopeOverlayTextureCache = useRef<Map<string, THREE.CanvasTexture>>(new Map());

    const renderOverlayOrGroupCanvas = async (targetId: string): Promise<HTMLCanvasElement | null> => {
        if (isLinkedGroupId(targetId)) {
            const comp = await renderLinkedGroupComposite(targetId, overlays, gridType);
            return comp ? comp.canvas : null;
        }
        const overlay = overlays.find((ov) => ov.id === targetId);
        if (overlay) {
            return await renderOverlayToCanvas(overlay, gridType);
        }
        return null;
    };

    const updateModelProps = async (model: THREE.Group, obj: ThreeDObject) => {
        model.position.set(obj.position.x, obj.position.y, obj.position.z);
        model.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
        model.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);

        const isShadowEnabled = obj.shadowSettings?.enabled !== false;
        updateModelMeshShadows(model, isShadowEnabled);
        if (sceneRef.current) {
            updateObjectShadowPlane(sceneRef.current, obj, shadowPlanesRef.current, rendererRef.current, model);
        }

        // 0. Apply non-destructive Mesh Subdivision (Flat Tessellation or Smooth Subdivision, Levels 0..4 + Bake)
        applyModelSubdivision(model, obj);

        if (obj.uvMapping === 'smart') {
            applySmartUVs(model);
        } else {
            restoreUVs(model);
        }

        const settings = obj.textureSettings || { 
            sharpness: 0, scale: 1, metallic: 0, roughness: 1, brightness: 100, contrast: 100, saturation: 100, hue: 0,
            magFilter: 'linear', minFilter: 'linear', anisotropy: 1, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0
        };

        const cliff = obj.cliffShapingSettings;
        const slope = obj.slopeShapingSettings;

        const [
            diffuseTex,
            normalTex,
            metallicTex,
            roughnessTex,
            wallDiffuseTex,
            wallNormalTex,
            wallRoughnessTex,
            wallDepthTex,
            slopeDiffuseTex,
            slopeNormalTex,
            slopeRoughnessTex,
            slopeDepthTex,
        ] = await Promise.all([
            loadTextureAsync(obj.textureUrl, textureCache.current, true),
            loadTextureAsync(obj.normalMapUrl, textureCache.current, false),
            loadTextureAsync(obj.metallicMapUrl, textureCache.current, false),
            loadTextureAsync(obj.roughnessMapUrl, textureCache.current, false),
            loadTextureAsync(cliff?.wallTextureUrl, textureCache.current, true),
            loadTextureAsync(cliff?.wallNormalMapUrl, textureCache.current, false),
            loadTextureAsync(cliff?.wallRoughnessMapUrl, textureCache.current, false),
            loadTextureAsync(cliff?.wallDepthMapUrl, textureCache.current, false),
            loadTextureAsync(slope?.slopeTextureUrl, textureCache.current, true),
            loadTextureAsync(slope?.slopeNormalMapUrl, textureCache.current, false),
            loadTextureAsync(slope?.slopeRoughnessMapUrl, textureCache.current, false),
            loadTextureAsync(slope?.slopeDepthMapUrl, textureCache.current, false),
        ]);

        let activeDiffuseTex = diffuseTex;
        let activeDiffuseCanvas: HTMLCanvasElement | null = null;
        if (obj.textureOverlayId) {
            const canvas = await renderOverlayOrGroupCanvas(obj.textureOverlayId);
            if (canvas) {
                activeDiffuseCanvas = canvas;
                const oldTex = overlayTextureCache.current.get(obj.id);
                if (oldTex) oldTex.dispose();

                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                overlayTextureCache.current.set(obj.id, texture);
                activeDiffuseTex = texture;
            }
        }

        let activeWallDiffuseTex = wallDiffuseTex;
        let activeWallOverlayCanvas: HTMLCanvasElement | null = null;
        if (cliff?.wallOverlayId) {
            const wallCanvas = await renderOverlayOrGroupCanvas(cliff.wallOverlayId);
            if (wallCanvas) {
                activeWallOverlayCanvas = wallCanvas;
                const oldWallTex = wallOverlayTextureCache.current.get(obj.id);
                if (oldWallTex) oldWallTex.dispose();

                const wallTex = new THREE.CanvasTexture(wallCanvas);
                wallTex.colorSpace = THREE.SRGBColorSpace;
                wallOverlayTextureCache.current.set(obj.id, wallTex);
                activeWallDiffuseTex = wallTex;
            }
        }

        let activeSlopeDiffuseTex = slopeDiffuseTex;
        let activeSlopeOverlayCanvas: HTMLCanvasElement | null = null;
        if (slope?.slopeOverlayId) {
            const slopeCanvas = await renderOverlayOrGroupCanvas(slope.slopeOverlayId);
            if (slopeCanvas) {
                activeSlopeOverlayCanvas = slopeCanvas;
                const oldSlopeTex = slopeOverlayTextureCache.current.get(obj.id);
                if (oldSlopeTex) oldSlopeTex.dispose();

                const slopeTex = new THREE.CanvasTexture(slopeCanvas);
                slopeTex.colorSpace = THREE.SRGBColorSpace;
                slopeOverlayTextureCache.current.set(obj.id, slopeTex);
                activeSlopeDiffuseTex = slopeTex;
            }
        }

        // 1. Apply heightmap displacement and/or procedural terrain deformation to mesh vertices
        await applyGeometryDisplacementToModel(model, obj, activeDiffuseCanvas);

        // 2. Apply Angle-Aware Cliff Shaping (GLB subdivision, wall normal push, rock strata, crags, and wall depth)
        await applyCliffShapingToModel(model, obj, activeWallOverlayCanvas);

        // 3. Apply Angle-Band Slope Shaping (Ramp curvature, main texture slope displacement, terrain dips & erosion gullies, crest/toe bevel, and dip depth attribute)
        await applySlopeShapingToModel(model, obj, activeSlopeOverlayCanvas, activeDiffuseCanvas);

        // 4. Apply Top-Surface 3D Scatter / Array (Grass Plugs, Rocks, Shrubs moving with the parent object)
        const objOrder = getThreeDDefaultStackOrder(obj, objects.findIndex((o) => o.id === obj.id));
        await applySurfaceScatterToModel(model, obj, objOrder);

        clearThreeDSurfaceCache();

        if (sceneRef.current) {
            updateObjectShadowPlane(sceneRef.current, obj, shadowPlanesRef.current, rendererRef.current, model);
        }

        const wallTextures = {
            wallDiffuse: activeWallDiffuseTex,
            wallNormal: wallNormalTex,
            wallRoughness: wallRoughnessTex,
            wallDepth: wallDepthTex,
        };

        const slopeTextures = {
            slopeDiffuse: activeSlopeDiffuseTex,
            slopeNormal: slopeNormalTex,
            slopeRoughness: slopeRoughnessTex,
            slopeDepth: slopeDepthTex,
        };

        model.renderOrder = objOrder;
        model.traverse((child) => {
            child.renderOrder = objOrder;
            if (
                child.name === SCATTER_GROUP_NAME ||
                child.parent?.name === SCATTER_GROUP_NAME ||
                child.userData?.isScatterInstance
            ) {
                return;
            }
            if ((child as THREE.Mesh).isMesh) {
                applyMaterialsToMesh(
                    child as THREE.Mesh, 
                    activeDiffuseTex, 
                    normalTex, 
                    metallicTex, 
                    roughnessTex, 
                    settings,
                    cliff,
                    wallTextures,
                    slope,
                    slopeTextures,
                    Boolean(obj.paletteViewer),
                    obj.opacity ?? 100,
                    obj.transitionSettings
                );
            }
        });

        // Re-sync base mesh visibility and holdout depth mask after material updates
        syncBaseMeshVisibilityAndHoldout(model, obj, objOrder);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isActive || !containerRef.current || !cameraRef.current) return;

        const isGizmoClick = (e.target as HTMLElement).closest('.gizmo-ui');
        if (isGizmoClick) return;

        // If currently in an active Grab / Rotate / Scale transform:
        // Left-click (button === 0) confirms; Right-click (button === 2) cancels and restores original transform
        if (transformModeRef.current) {
            e.preventDefault();
            e.stopPropagation();
            if (e.button === 0) {
                confirmActiveTransform();
            } else if (e.button === 2) {
                cancelActiveTransform();
            }
            return;
        }

        // Ignore right-clicks when not transforming so OrbitControls can rotate the camera view
        if (e.button !== 0) return;

        e.stopPropagation();

        const containerEl = containerRef.current;
        const rect = containerEl.getBoundingClientRect();
        const startX = (e.clientX - rect.left) / zoom;
        const startY = (e.clientY - rect.top) / zoom;
        const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;

        setSelectionBox({ active: true, x1: startX, y1: startY, x2: startX, y2: startY });

        const onDragMove = (moveEv: MouseEvent) => {
            const curRect = containerEl.getBoundingClientRect();
            const curX = (moveEv.clientX - curRect.left) / zoom;
            const curY = (moveEv.clientY - curRect.top) / zoom;
            setSelectionBox((prev) => ({ ...prev, x2: curX, y2: curY }));
        };

        const onDragUp = (upEv: MouseEvent) => {
            window.removeEventListener('mousemove', onDragMove);
            window.removeEventListener('mouseup', onDragUp);

            const curRect = containerEl.getBoundingClientRect();
            const endX = (upEv.clientX - curRect.left) / zoom;
            const endY = (upEv.clientY - curRect.top) / zoom;
            const dragDist = Math.abs(endX - startX) + Math.abs(endY - startY);

            setSelectionBox((prev) => ({ ...prev, active: false }));

            if (!cameraRef.current) return;

            if (dragDist > 4) {
                // Rectangular marquee multi-selection of 3D objects
                const hitIds = findModelsInSelectionBox(
                    modelsRef.current,
                    cameraRef.current,
                    fullWidth,
                    fullHeight,
                    { x1: startX, y1: startY, x2: endX, y2: endY }
                );
                const nextSet = new Set<string>(isAdditive ? Array.from(selectedObjectIdsRef.current) : []);
                hitIds.forEach((id) => nextSet.add(id));
                const nextList = Array.from(nextSet);
                if (onSelectObjects) {
                    setTimeout(() => onSelectObjects(nextList), 0);
                } else {
                    setTimeout(() => onSelectObject(nextList.length > 0 ? nextList[nextList.length - 1] : null), 0);
                }
            } else {
                // Single click raycast selection
                mouse.current.x = (startX / fullWidth) * 2 - 1;
                mouse.current.y = -(startY / fullHeight) * 2 + 1;

                raycaster.current.setFromCamera(mouse.current, cameraRef.current);
                const intersects = raycaster.current.intersectObjects(Array.from(modelsRef.current.values()), true);

                if (intersects.length > 0) {
                    let target = intersects[0].object;
                    while (target.parent && !target.userData.id) {
                        target = target.parent;
                    }
                    const hitId = target.userData.id;
                    if (isAdditive && onSelectObjects) {
                        const nextSet = new Set<string>(Array.from(selectedObjectIdsRef.current));
                        if (nextSet.has(hitId)) nextSet.delete(hitId);
                        else nextSet.add(hitId);
                        const nextList = Array.from(nextSet);
                        setTimeout(() => onSelectObjects(nextList), 0);
                    } else if (onSelectObjects) {
                        setTimeout(() => onSelectObjects([hitId]), 0);
                    } else {
                        setTimeout(() => onSelectObject(hitId), 0);
                    }
                } else if (!isAdditive) {
                    if (onSelectObjects) {
                        setTimeout(() => onSelectObjects([]), 0);
                    } else {
                        setTimeout(() => onSelectObject(null), 0);
                    }
                }
            }
        };

        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragUp);
    };

    // Use direct props in the effect to ensure they are always fresh
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Guard for inputs
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const activeIds = getEffectiveSelectedIds();
            if (!isActive || activeIds.length === 0) return;

            const key = e.key.toLowerCase();
            const shift = e.shiftKey;

            // Mode selection (G, R, S)
            if (key === 'g') { e.preventDefault(); beginTransformSession('translate'); return; }
            if (key === 'r') { e.preventDefault(); beginTransformSession('rotate'); return; }
            if (key === 's') { e.preventDefault(); beginTransformSession('scale'); return; }
            
            // Axis / Plane locking (X, Y, Z)
            if (['x', 'y', 'z'].includes(key)) {
                e.preventDefault();
                if (shift) {
                    const plane = key === 'z' ? 'xy' : key === 'y' ? 'xz' : 'yz';
                    transformAxisRef.current = plane as any;
                    setTransformAxis(plane as any);
                } else {
                    transformAxisRef.current = key as any;
                    setTransformAxis(key as any);
                }
                return;
            }
            
            if (key === 'escape') {
                e.preventDefault();
                cancelActiveTransform();
                return;
            }

            if (key === 'enter') {
                if (transformModeRef.current) {
                    e.preventDefault();
                    confirmActiveTransform();
                    return;
                }
            }

            const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
            if (!isArrow) return;

            e.preventDefault();
            e.stopPropagation();

            const direction = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1 : -1;
            const stepBase = e.shiftKey ? 2 : (e.altKey ? 0.05 : 0.5);
            const mode = transformModeRef.current || 'translate';
            const axis = transformAxisRef.current;

            const axesToUpdate: ('x' | 'y' | 'z')[] = [];
            if (axis.length === 1) {
                axesToUpdate.push(axis as any);
            } else {
                if (axis.includes('x')) axesToUpdate.push('x');
                if (axis.includes('y')) axesToUpdate.push('y');
                if (axis.includes('z')) axesToUpdate.push('z');
            }

            let moveVec: THREE.Vector3 | null = null;
            if (mode === 'translate' && axis.length > 1 && cameraRef.current) {
                const cam = cameraRef.current;
                const moveX = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                const moveY = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
                const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0).multiplyScalar(moveX * stepBase);
                const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1).multiplyScalar(moveY * stepBase);
                moveVec = right.add(up);
            }

            const batchUpdates: { id: string; updates: Partial<ThreeDObject> }[] = [];

            activeIds.forEach((id) => {
                const obj = objectsRef.current.find((o) => o.id === id);
                if (!obj) return;
                const model = modelsRef.current.get(id);

                const curPos = model
                    ? { x: model.position.x, y: model.position.y, z: model.position.z }
                    : { ...obj.position };
                const curRot = model
                    ? { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z }
                    : { ...obj.rotation };
                const curScale = model
                    ? { x: model.scale.x, y: model.scale.y, z: model.scale.z }
                    : { ...obj.scale };

                const updates: Partial<ThreeDObject> = {};

                if (mode === 'translate') {
                    const nextPos = { ...curPos };
                    if (axis.length === 1) {
                        const a = axis as 'x' | 'y' | 'z';
                        nextPos[a] += stepBase * direction;
                    } else if (moveVec) {
                        axesToUpdate.forEach((a) => {
                            nextPos[a] += moveVec![a];
                        });
                    } else {
                        axesToUpdate.forEach((a) => {
                            nextPos[a] += stepBase * direction;
                        });
                    }
                    updates.position = nextPos;
                    if (model) model.position.set(nextPos.x, nextPos.y, nextPos.z);
                } else if (mode === 'rotate') {
                    const nextRot = { ...curRot };
                    axesToUpdate.forEach((a) => {
                        nextRot[a] += stepBase * direction * 0.1;
                    });
                    updates.rotation = nextRot;
                    if (model) model.rotation.set(nextRot.x, nextRot.y, nextRot.z);
                } else if (mode === 'scale') {
                    const isProcPlane = isProceduralPlaneUrl(obj.glbUrl);
                    const scaleMultiplier = Math.max(0.05, 1 + (stepBase * direction * 0.1) / Math.max(0.01, curScale.x));
                    const nextScale = computeNextThreeDObjectScale(curScale, axis, scaleMultiplier, isProcPlane);
                    updates.scale = nextScale;
                    if (model) model.scale.set(nextScale.x, nextScale.y, nextScale.z);
                }

                const helper = selectionHelpersRef.current.get(id);
                if (helper) helper.update();

                if (sceneRef.current && model) {
                    updateObjectShadowPlane(
                        sceneRef.current,
                        {
                            ...obj,
                            position: updates.position || curPos,
                            rotation: updates.rotation || curRot,
                            scale: updates.scale || curScale,
                        },
                        shadowPlanesRef.current,
                        rendererRef.current,
                        model
                    );
                }

                batchUpdates.push({ id, updates });
            });

            setTimeout(() => {
                batchUpdates.forEach(({ id, updates }) => {
                    onUpdateObjectRef.current(id, updates);
                });
                if (!transformModeRef.current) {
                    onTransformEndRef.current();
                }
            }, 0);
        };

        const onMouseMove = (e: MouseEvent) => {
            const mode = transformModeRef.current;
            const axis = transformAxisRef.current;
            const activeIds = getEffectiveSelectedIds();
            if (!mode || activeIds.length === 0 || !isActive) return;

            e.preventDefault();
            const deltaX = e.movementX;
            const deltaY = e.movementY;
            const sensitivity = 0.1;
            const scaleSensitivity = 0.01;

            let moveVec: THREE.Vector3 | null = null;
            if (mode === 'translate' && cameraRef.current) {
                const cam = cameraRef.current;
                const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0).multiplyScalar(deltaX * sensitivity);
                const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1).multiplyScalar(-deltaY * sensitivity);
                moveVec = right.add(up);
            }

            const rotRads = (deltaX - deltaY) * 0.01;
            const scaleAmount = 1 + (deltaX - deltaY) * scaleSensitivity;

            activeIds.forEach((id) => {
                const model = modelsRef.current.get(id);
                if (!model) return;
                const currentObj = objectsRef.current.find((o) => o.id === id);

                applyMouseDeltaToThreeDModel(model, currentObj, mode, axis, moveVec, rotRads, scaleAmount);

                const helper = selectionHelpersRef.current.get(id);
                if (helper) helper.update();

                if (sceneRef.current) {
                    const currentObj = objectsRef.current.find((o) => o.id === id);
                    if (currentObj) {
                        updateObjectShadowPlane(
                            sceneRef.current,
                            {
                                ...currentObj,
                                position: { x: model.position.x, y: model.position.y, z: model.position.z },
                                rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                                scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
                            },
                            shadowPlanesRef.current,
                            rendererRef.current,
                            model
                        );
                    }
                }
            });

            if (stateUpdateTimeoutRef.current) {
                window.clearTimeout(stateUpdateTimeoutRef.current);
            }

            stateUpdateTimeoutRef.current = window.setTimeout(() => {
                activeIds.forEach((id) => {
                    const model = modelsRef.current.get(id);
                    if (model) {
                        onUpdateObjectRef.current(id, {
                            position: { x: model.position.x, y: model.position.y, z: model.position.z },
                            rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z },
                            scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
                        });
                    }
                });
            }, 100);
        };

        const onGlobalMouseDown = (e: MouseEvent) => {
            if (!isActive || !transformModeRef.current) return;
            const target = e.target as HTMLElement | null;
            if (target && target.closest('.gizmo-ui')) return;

            if (e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                confirmActiveTransform();
            } else if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
                cancelActiveTransform();
            }
        };

        const onGlobalContextMenu = (e: MouseEvent) => {
            if (!isActive) return;
            if (transformModeRef.current) {
                e.preventDefault();
                e.stopPropagation();
                cancelActiveTransform();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onGlobalMouseDown, true);
        window.addEventListener('contextmenu', onGlobalContextMenu, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mousedown', onGlobalMouseDown, true);
            window.removeEventListener('contextmenu', onGlobalContextMenu, true);
            if (stateUpdateTimeoutRef.current) {
                window.clearTimeout(stateUpdateTimeoutRef.current);
            }
        };
    }, [isActive]);

    return (
        <div 
            ref={containerRef} 
            className={`absolute transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onMouseDown={handleMouseDown}
            onContextMenu={(e) => {
                e.preventDefault();
                if (transformModeRef.current) {
                    cancelActiveTransform();
                }
            }}
            style={{ 
                left: -VIEWPORT_PADDING,
                top: -VIEWPORT_PADDING,
                width: fullWidth, 
                height: fullHeight, 
                zIndex: getThreeDCanvasZIndex(objects, isActive, isVisible),
                pointerEvents: isActive ? 'auto' : 'none'
            }}
        >
            {selectionBox.active && (
                <div
                    className="absolute border-2 border-cyan-400/80 bg-cyan-400/15 pointer-events-none z-[10000] rounded-[2px]"
                    style={{
                        left: Math.min(selectionBox.x1, selectionBox.x2),
                        top: Math.min(selectionBox.y1, selectionBox.y2),
                        width: Math.abs(selectionBox.x1 - selectionBox.x2),
                        height: Math.abs(selectionBox.y1 - selectionBox.y2),
                    }}
                />
            )}
            {isActive && (
                <ThreeDGizmoOverlay
                    selectedObjectId={selectedObjectId}
                    selectedCount={selectedObjectIds ? selectedObjectIds.size : (selectedObjectId ? 1 : 0)}
                    transformMode={transformMode}
                    transformAxis={transformAxis}
                    onStartTransform={(mode) => beginTransformSession(mode)}
                    onSetAxis={(axis) => {
                        transformAxisRef.current = axis;
                        setTransformAxis(axis);
                    }}
                    onConfirmTransform={confirmActiveTransform}
                    onCancelTransform={cancelActiveTransform}
                />
            )}
        </div>
    );
});

ThreeDCanvas.displayName = 'ThreeDCanvas';
