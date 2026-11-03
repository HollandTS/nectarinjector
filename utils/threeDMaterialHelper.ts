import * as THREE from 'three';
import type {
    ThreeDTextureSettings,
    ThreeDCliffShapingSettings,
    ThreeDSlopeShapingSettings,
    ThreeDMaterialTransitionSettings,
} from '../types';
import {
    applyMaterialAndCliffShader,
    CliffWallTextures,
    SlopeSurfaceTextures,
} from './threeDCliffShaderHelper';

export function initGlbModel(model: THREE.Object3D) {
    model.traverse((child) => {
        child.frustumCulled = false;
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.frustumCulled = false;
            // 1. Cache original UVs if present
            if (mesh.geometry && mesh.geometry.attributes.position) {
                mesh.geometry.computeBoundingBox();
                mesh.geometry.computeBoundingSphere();
                if (mesh.geometry.attributes.uv && !mesh.geometry.userData.originalUVs) {
                    mesh.geometry.userData.originalUVs = mesh.geometry.attributes.uv.clone();
                }
            }

            // 2. Upgrade unlit MeshBasicMaterial (e.g. from unlit GLBs) to MeshStandardMaterial and cache originals
            const convertBasicIfNeeded = (mat: THREE.Material): THREE.Material => {
                if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
                    const basic = mat as THREE.MeshBasicMaterial;
                    const std = new THREE.MeshStandardMaterial({
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
                    return std;
                }
                return mat;
            };

            if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map(convertBasicIfNeeded);
            } else if (mesh.material) {
                mesh.material = convertBasicIfNeeded(mesh.material);
            }

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
                if (mat && !mat.userData.origSaved) {
                    mat.userData.origSaved = true;
                    mat.userData.origMap = (mat as any).map || null;
                    mat.userData.origNormalMap = (mat as any).normalMap || null;
                    mat.userData.origMetalnessMap = (mat as any).metalnessMap || null;
                    mat.userData.origRoughnessMap = (mat as any).roughnessMap || null;
                    mat.userData.origMetalness = 'metalness' in mat ? (mat as any).metalness : undefined;
                    mat.userData.origRoughness = 'roughness' in mat ? (mat as any).roughness : undefined;
                    mat.userData.origTransparent = mat.transparent;
                    mat.userData.origOpacity = mat.opacity;
                    if ('color' in mat && (mat as any).color) {
                        mat.userData.origColor = (mat as any).color.clone();
                    }

                    // Ensure embedded textures are marked for update
                    if ((mat as any).map) {
                        (mat as any).map.needsUpdate = true;
                    }
                    mat.needsUpdate = true;
                }
            });
        }
    });
}

export function restoreUVs(model: THREE.Object3D) {
    model.traverse((child) => {
        if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') {
            return;
        }
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geometry = mesh.geometry;
            if (geometry?.userData?.originalUVs) {
                geometry.setAttribute('uv', geometry.userData.originalUVs.clone());
                geometry.attributes.uv.needsUpdate = true;
            }
        }
    });
}

export function applySmartUVs(model: THREE.Object3D) {
    model.traverse((child) => {
        if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') {
            return;
        }
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geometry = mesh.geometry;
            if (!geometry?.attributes?.position) return;

            // Store original UVs if not already stored
            if (!geometry.userData.originalUVs && geometry.attributes.uv) {
                geometry.userData.originalUVs = geometry.attributes.uv.clone();
            }

            const pos = geometry.attributes.position;
            const uvs = new Float32Array(pos.count * 2);
            const normal = geometry.attributes.normal;

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);

                let nx = 0, ny = 0, nz = 0;
                if (normal) {
                    nx = Math.abs(normal.getX(i));
                    ny = Math.abs(normal.getY(i));
                    nz = Math.abs(normal.getZ(i));
                }

                // Box projection
                if (nx >= ny && nx >= nz) {
                    uvs[i * 2] = z;
                    uvs[i * 2 + 1] = y;
                } else if (ny >= nx && ny >= nz) {
                    uvs[i * 2] = x;
                    uvs[i * 2 + 1] = z;
                } else {
                    uvs[i * 2] = x;
                    uvs[i * 2 + 1] = y;
                }
            }
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geometry.attributes.uv.needsUpdate = true;
        }
    });
}

export function configureTexture(texture: THREE.Texture, settings: ThreeDTextureSettings) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const repX = settings.repeatX || 1;
    const repY = settings.repeatY || 1;
    const scale = settings.scale || 1;
    texture.repeat.set(repX * scale, repY * scale);
    texture.offset.set(settings.offsetX || 0, settings.offsetY || 0);
    texture.rotation = settings.rotation || 0;

    texture.magFilter = settings.magFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
    texture.minFilter = settings.minFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    texture.anisotropy = settings.anisotropy || 1;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
}

export function applyShaderAdjustments(mat: THREE.Material, settings: ThreeDTextureSettings) {
    const brightness = settings.brightness ?? 100;
    const contrast = settings.contrast ?? 100;
    const saturation = settings.saturation ?? 100;
    const hue = settings.hue ?? 0;
    const sharpness = settings.sharpness ?? 0;

    if (!mat.userData.shaderUniforms) {
        const uniforms = {
            uBrightness: { value: brightness / 100 },
            uContrast: { value: contrast / 100 },
            uSaturation: { value: saturation / 100 },
            uHue: { value: hue / 360 },
            uSharpness: { value: sharpness / 100 }
        };
        mat.userData.shaderUniforms = uniforms;

        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uBrightness = uniforms.uBrightness;
            shader.uniforms.uContrast = uniforms.uContrast;
            shader.uniforms.uSaturation = uniforms.uSaturation;
            shader.uniforms.uHue = uniforms.uHue;
            shader.uniforms.uSharpness = uniforms.uSharpness;

            shader.fragmentShader = `
                uniform float uBrightness;
                uniform float uContrast;
                uniform float uSaturation;
                uniform float uHue;
                uniform float uSharpness;
                ${shader.fragmentShader}
            `.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                #ifdef USE_MAP
                    vec3 color = diffuseColor.rgb;
                    color *= uBrightness;
                    color = (color - 0.5) * uContrast + 0.5;
                    const vec3 k = vec3(0.57735, 0.57735, 0.57735);
                    float cosAngle = cos(uHue * 6.28318);
                    color = color * cosAngle + cross(k, color) * sin(uHue * 6.28318) + k * dot(k, color) * (1.0 - cosAngle);
                    float gray = dot(color, vec3(0.299, 0.587, 0.114));
                    color = mix(vec3(gray), color, uSaturation);
                    color = mix(color, color * color * 1.5, uSharpness * 0.2);
                    diffuseColor.rgb = color;
                #endif
                `
            );
        };
        mat.needsUpdate = true;
    } else {
        const u = mat.userData.shaderUniforms;
        u.uBrightness.value = brightness / 100;
        u.uContrast.value = contrast / 100;
        u.uSaturation.value = saturation / 100;
        u.uHue.value = hue / 360;
        u.uSharpness.value = sharpness / 100;
    }
}

export function applyMaterialsToMesh(
    mesh: THREE.Mesh,
    diffuseOverride: THREE.Texture | null,
    normalOverride: THREE.Texture | null,
    metallicOverride: THREE.Texture | null,
    roughnessOverride: THREE.Texture | null,
    settings: ThreeDTextureSettings,
    cliffSettings?: ThreeDCliffShapingSettings,
    wallTextures?: CliffWallTextures,
    slopeSettings?: ThreeDSlopeShapingSettings,
    slopeTextures?: SlopeSurfaceTextures,
    paletteViewer: boolean = false,
    objectOpacity: number = 100,
    transitionSettings?: ThreeDMaterialTransitionSettings
) {
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat) => {
        if (!mat) return;

        // Ensure original attributes are recorded
        if (!mat.userData.origSaved) {
            mat.userData.origSaved = true;
            mat.userData.origMap = (mat as any).map || null;
            mat.userData.origNormalMap = (mat as any).normalMap || null;
            mat.userData.origMetalnessMap = (mat as any).metalnessMap || null;
            mat.userData.origRoughnessMap = (mat as any).roughnessMap || null;
            mat.userData.origMetalness = 'metalness' in mat ? (mat as any).metalness : undefined;
            mat.userData.origRoughness = 'roughness' in mat ? (mat as any).roughness : undefined;
            mat.userData.origTransparent = mat.transparent;
            mat.userData.origOpacity = mat.opacity;
        }

        const clampedOpacity = Math.max(0, Math.min(100, objectOpacity)) / 100;
        const baseOpacity = mat.userData.origOpacity ?? 1;
        const nextOpacity = baseOpacity * clampedOpacity;
        const nextTransparent = clampedOpacity < 0.999 ? true : Boolean(mat.userData.origTransparent);
        if (mat.transparent !== nextTransparent || mat.opacity !== nextOpacity) {
            mat.transparent = nextTransparent;
            mat.opacity = nextOpacity;
            mat.needsUpdate = true;
        }

        const oldMap = (mat as any).map;
        const oldNormalMap = (mat as any).normalMap;
        const oldMetalnessMap = (mat as any).metalnessMap;
        const oldRoughnessMap = (mat as any).roughnessMap;

        // 1. Diffuse / Base map
        if (diffuseOverride) {
            (mat as any).map = diffuseOverride;
            configureTexture(diffuseOverride, settings);
        } else if (mat.userData.origMap) {
            // Keep GLB original texture
            (mat as any).map = mat.userData.origMap;
            const hasCustomTransform =
                (settings.scale !== undefined && settings.scale !== 1) ||
                (settings.repeatX !== undefined && settings.repeatX !== 1) ||
                (settings.repeatY !== undefined && settings.repeatY !== 1) ||
                (settings.offsetX !== undefined && settings.offsetX !== 0) ||
                (settings.offsetY !== undefined && settings.offsetY !== 0) ||
                (settings.rotation !== undefined && settings.rotation !== 0);
            if (hasCustomTransform) {
                configureTexture((mat as any).map, settings);
            }
        } else {
            (mat as any).map = null;
        }

        // 2. Normal map
        if (normalOverride) {
            (mat as any).normalMap = normalOverride;
            configureTexture(normalOverride, settings);
        } else if (mat.userData.origNormalMap) {
            (mat as any).normalMap = mat.userData.origNormalMap;
        } else {
            (mat as any).normalMap = null;
        }

        if ((mat as any).normalMap) {
            const ns = settings.normalScale !== undefined ? settings.normalScale : 1.0;
            if ('normalScale' in mat && (mat as any).normalScale) {
                (mat as any).normalScale.set(ns, ns);
            }
        }

        // 3. Metallic map & value
        if (metallicOverride) {
            (mat as any).metalnessMap = metallicOverride;
            configureTexture(metallicOverride, settings);
        } else if (mat.userData.origMetalnessMap) {
            (mat as any).metalnessMap = mat.userData.origMetalnessMap;
        } else {
            (mat as any).metalnessMap = null;
        }

        if ('metalness' in mat) {
            if ((mat as any).metalnessMap) {
                (mat as any).metalness = settings.metallic !== undefined && settings.metallic !== 0 ? settings.metallic : 1.0;
            } else if (diffuseOverride) {
                (mat as any).metalness = settings.metallic;
            } else {
                (mat as any).metalness = settings.metallic !== 0 ? settings.metallic : (mat.userData.origMetalness ?? 0);
            }
        }

        // 4. Roughness map & value
        if (roughnessOverride) {
            (mat as any).roughnessMap = roughnessOverride;
            configureTexture(roughnessOverride, settings);
        } else if (mat.userData.origRoughnessMap) {
            (mat as any).roughnessMap = mat.userData.origRoughnessMap;
        } else {
            (mat as any).roughnessMap = null;
        }

        if ('roughness' in mat) {
            if ((mat as any).roughnessMap) {
                (mat as any).roughness = settings.roughness !== undefined ? settings.roughness : 1.0;
            } else if (diffuseOverride) {
                (mat as any).roughness = settings.roughness;
            } else {
                (mat as any).roughness = settings.roughness !== 1 ? settings.roughness : (mat.userData.origRoughness ?? 1);
            }
        }

        if (
            !!oldMap !== !!(mat as any).map ||
            !!oldNormalMap !== !!(mat as any).normalMap ||
            !!oldMetalnessMap !== !!(mat as any).metalnessMap ||
            !!oldRoughnessMap !== !!(mat as any).roughnessMap
        ) {
            mat.needsUpdate = true;
        }

        applyMaterialAndCliffShader(
            mesh,
            mat,
            settings,
            cliffSettings,
            wallTextures,
            slopeSettings,
            slopeTextures,
            paletteViewer,
            transitionSettings
        );
    });
}

export function loadTextureAsync(
    url: string | undefined, 
    textureCache: Map<string, THREE.Texture>,
    isColorMap: boolean = false
): Promise<THREE.Texture | null> {
    if (!url) return Promise.resolve(null);
    if (textureCache.has(url)) {
        return Promise.resolve(textureCache.get(url)!.clone());
    }
    return new Promise((resolve) => {
        const texLoader = new THREE.TextureLoader();
        texLoader.load(
            url,
            (texture) => {
                if (isColorMap) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                }
                textureCache.set(url, texture);
                resolve(texture.clone());
            },
            undefined,
            () => resolve(null)
        );
    });
}
