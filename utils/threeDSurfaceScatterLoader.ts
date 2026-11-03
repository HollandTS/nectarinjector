import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ThreeDSurfaceScatterItem } from '../types';
import { getThreeDPaletteTexture, THREE_D_PALETTE_GLSL_DEFS } from './threeDPaletteShaderHelper';

export interface ScatterMeshPrimitive {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    normScale: number; // Normalization scale factor so a 1.0 unit scatter item has canonical size
}

const scatterGlbCache = new Map<string, Promise<ScatterMeshPrimitive[]>>();
const scatterCustomTexCache = new Map<string, Promise<THREE.Texture | null>>();

export function loadScatterItemTexture(url?: string): Promise<THREE.Texture | null> {
    if (!url) return Promise.resolve(null);
    const cached = scatterCustomTexCache.get(url);
    if (cached) return cached;

    const promise = new Promise<THREE.Texture | null>((resolve) => {
        const loader = new THREE.TextureLoader();
        loader.load(
            url,
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.needsUpdate = true;
                resolve(tex);
            },
            undefined,
            () => {
                scatterCustomTexCache.delete(url);
                resolve(null);
            }
        );
    });

    scatterCustomTexCache.set(url, promise);
    return promise;
}

/**
 * Loads a GLB model URL and extracts all its Mesh primitives transformed so that
 * the combined model is horizontally centered at (0, _, 0) and sits with its base at y = 0.
 */
export function loadScatterAssetPrimitives(glbUrl: string): Promise<ScatterMeshPrimitive[]> {
    if (!glbUrl) return Promise.resolve([]);
    const cached = scatterGlbCache.get(glbUrl);
    if (cached) return cached;

    const promise = new Promise<ScatterMeshPrimitive[]>((resolve) => {
        const loader = new GLTFLoader();
        loader.load(
            glbUrl,
            (gltf) => {
                const root = gltf.scene;
                root.position.set(0, 0, 0);
                root.rotation.set(0, 0, 0);
                root.scale.set(1, 1, 1);
                root.updateMatrixWorld(true);

                const fullBox = new THREE.Box3().setFromObject(root);
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                fullBox.getCenter(center);
                fullBox.getSize(size);

                const maxDim = Math.max(0.001, Math.max(size.x, size.y, size.z));
                // Canonical size: 1.0 baseScale corresponds to ~8.0 world units (roughly 3.5x a single tile width)
                const canonicalTarget = 8.0;
                const normScale = canonicalTarget / maxDim;

                // Shift matrix so bottom rests at Y = 0 and X, Z are centered at 0
                const offsetMatrix = new THREE.Matrix4().makeTranslation(
                    -center.x,
                    -fullBox.min.y,
                    -center.z
                );

                const primitives: ScatterMeshPrimitive[] = [];

                root.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        if (!mesh.geometry) return;

                        const geo = mesh.geometry.clone();
                        const worldMat = new THREE.Matrix4()
                            .copy(offsetMatrix)
                            .multiply(mesh.matrixWorld);
                        geo.applyMatrix4(worldMat);
                        geo.computeVertexNormals();
                        geo.computeBoundingBox();
                        geo.computeBoundingSphere();

                        const rawMat = Array.isArray(mesh.material)
                            ? mesh.material[0]
                            : mesh.material;

                        let mat: THREE.MeshStandardMaterial;
                        if (rawMat && (rawMat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
                            const basic = rawMat as THREE.MeshBasicMaterial;
                            mat = new THREE.MeshStandardMaterial({
                                name: basic.name,
                                color: basic.color ? basic.color.clone() : new THREE.Color(0xffffff),
                                map: basic.map || null,
                                alphaMap: basic.alphaMap || null,
                                transparent: basic.transparent,
                                opacity: basic.opacity,
                                alphaTest: basic.alphaTest,
                                side: basic.side,
                                roughness: 0.85,
                                metalness: 0.0,
                            });
                        } else if (rawMat) {
                            mat = rawMat.clone() as THREE.MeshStandardMaterial;
                        } else {
                            mat = new THREE.MeshStandardMaterial({ color: 0x5c8a32, roughness: 0.85 });
                        }

                        primitives.push({
                            geometry: geo,
                            material: mat,
                            normScale,
                        });
                    }
                });

                resolve(primitives);
            },
            undefined,
            (err) => {
                console.warn('Failed to load scatter GLB asset:', glbUrl, err);
                scatterGlbCache.delete(glbUrl);
                resolve([]);
            }
        );
    });

    scatterGlbCache.set(glbUrl, promise);
    return promise;
}

/**
 * Clones and configures a scatter primitive's material to support:
 * - Custom texture override (`customTexture`)
 * - Per-item texture color adjustments (Hue, Brightness, Contrast, Saturation)
 * - Object opacity
 * - Per-instance vertex/instance color tinting (via InstancedMesh instanceColor)
 * - Global Westwood .pal Palette Viewer quantization when enabled on the host 3D object
 */
export function createConfiguredScatterMaterial(
    baseMat: THREE.Material,
    paletteViewer: boolean,
    objectOpacity: number,
    customTexture?: THREE.Texture | null,
    item?: ThreeDSurfaceScatterItem
): THREE.Material {
    const mat = baseMat.clone() as THREE.MeshStandardMaterial;

    if (customTexture) {
        mat.map = customTexture.clone();
        mat.map.needsUpdate = true;
        if (mat.color) {
            mat.color.setHex(0xffffff);
        }
    }

    const clampedOpacity = Math.max(0, Math.min(100, objectOpacity)) / 100;
    if (clampedOpacity < 0.999) {
        mat.transparent = true;
        mat.opacity = (mat.opacity ?? 1) * clampedOpacity;
    }

    const itemHue = (item?.hueShift ?? 0) / 360;
    const itemBrightness = (item?.brightness ?? 100) / 100;
    const itemContrast = (item?.contrast ?? 100) / 100;
    const itemSaturation = (item?.saturation ?? 100) / 100;

    const palTex = getThreeDPaletteTexture();
    const uniforms = {
        uItemHue: { value: itemHue },
        uItemBrightness: { value: itemBrightness },
        uItemContrast: { value: itemContrast },
        uItemSaturation: { value: itemSaturation },
        uPaletteViewerActive: { value: paletteViewer && palTex ? 1.0 : 0.0 },
        uPaletteLUT: { value: palTex },
    };

    mat.userData.scatterUniforms = uniforms;
    mat.customProgramCacheKey = () => `scatter_mat_v2_${paletteViewer ? 'pal' : 'std'}`;

    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        shader.fragmentShader = `
            uniform float uItemHue;
            uniform float uItemBrightness;
            uniform float uItemContrast;
            uniform float uItemSaturation;
            ${THREE_D_PALETTE_GLSL_DEFS}
            ${shader.fragmentShader}
        `
            .replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                vec3 itemCol = diffuseColor.rgb * uItemBrightness;
                itemCol = (itemCol - 0.5) * uItemContrast + 0.5;
                const vec3 kItemAxis = vec3(0.57735, 0.57735, 0.57735);
                float cosItemA = cos(uItemHue * 6.2831853);
                float sinItemA = sin(uItemHue * 6.2831853);
                itemCol = itemCol * cosItemA + cross(kItemAxis, itemCol) * sinItemA + kItemAxis * dot(kItemAxis, itemCol) * (1.0 - cosItemA);
                float itemGray = dot(itemCol, vec3(0.299, 0.587, 0.114));
                itemCol = mix(vec3(itemGray), itemCol, uItemSaturation);
                diffuseColor.rgb = clamp(itemCol, 0.0, 1.0);
                `
            )
            .replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                if (uPaletteViewerActive > 0.5) {
                    gl_FragColor.rgb = quantizeToWestwoodPalette(gl_FragColor.rgb);
                }
                `
            );
    };

    mat.needsUpdate = true;
    return mat;
}
