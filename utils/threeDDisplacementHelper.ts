import * as THREE from 'three';
import type { ThreeDDisplacementSettings, ThreeDObject } from '../types';
import { isProceduralPlaneUrl } from './layerTo3DPlaneUtils';
import { evaluateColorHeightBoostAtPixel } from './colorHeightSculptHelper';
import {
    resolvePlaneTileCounts,
    computeTileLockedSubdivisions,
    samplePeriodicTileTerrainNoise,
    sampleSeamlessTileHeight,
    applySeamlessTileNormalWrap,
} from './threeDSeamlessTileHelper';
import {
    buildSpatialVertexWeldInfo,
    enforceWeldedVertexPositions,
} from './threeDMeshWeldHelper';

export const DEFAULT_DISPLACEMENT_SETTINGS: ThreeDDisplacementSettings = {
    enabled: false,
    scale: 2.5,
    bias: 0,
    invert: false,
    contrast: 100,
    brightness: 0,
    blur: 1,
    blackPoint: 0,
    whitePoint: 100,
    terracing: 0,
    subdivisions: 96,
    colorHeightRules: [],
    colorBaseMix: 100,
    terrainEnabled: false,
    terrainAmplitude: 2.0,
    terrainFrequency: 2.5,
    terrainRoughness: 0.5,
    terrainSeed: 1337,
    terrainRidgeMode: false,
    edgeFalloff: 0,
    tileLockEnabled: true,
    tileNormalWrap: true,
    tileSeamBlend: 35,
    weldVertices: true,
    weldTolerance: 35,
};

// Cache of loaded grayscale image pixel arrays by URL + filter signature
interface CachedHeightMap {
    signature: string;
    width: number;
    height: number;
    heights: Float32Array; // normalized [0, 1] per pixel
    previewDataUrl: string;
}

const heightMapCache = new Map<string, CachedHeightMap>();

function loadRawImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * Draws an image with 3x3 toroidal tiling before applying canvas blur so that
 * blurring a seamless tile texture never introduces dark/clamped border seams.
 */
function drawSeamlessBlurredImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    w: number,
    h: number,
    blurPx: number,
    wrapBorders: boolean
): void {
    if (blurPx <= 0) {
        ctx.drawImage(img, 0, 0, w, h);
        return;
    }

    if (!wrapBorders) {
        ctx.filter = `blur(${blurPx}px)`;
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';
        return;
    }

    const pad = Math.min(Math.max(8, Math.ceil(blurPx * 3)), Math.floor(Math.min(w, h) / 2));
    const paddedCanvas = document.createElement('canvas');
    paddedCanvas.width = w + pad * 2;
    paddedCanvas.height = h + pad * 2;
    const pCtx = paddedCanvas.getContext('2d')!;

    // Draw 3x3 tiled pattern around the center so blur wraps toroidally across edges
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            pCtx.drawImage(img, pad + dx * w, pad + dy * h, w, h);
        }
    }

    const blurredCanvas = document.createElement('canvas');
    blurredCanvas.width = w + pad * 2;
    blurredCanvas.height = h + pad * 2;
    const bCtx = blurredCanvas.getContext('2d')!;
    bCtx.filter = `blur(${blurPx}px)`;
    bCtx.drawImage(paddedCanvas, 0, 0);
    bCtx.filter = 'none';

    ctx.drawImage(blurredCanvas, pad, pad, w, h, 0, 0, w, h);
}

/**
 * Generates a grayscale displacement map dataURL from a source texture (or existing heightmap)
 * with brightness, contrast, black/white level clamping, inversion, smoothing blur, and terracing.
 * Light values -> 1.0 (High / +Y), Dark values -> 0.0 (Low / -Y).
 */
export async function generateDisplacementMapFromSource(
    sourceUrl: string,
    settings: ThreeDDisplacementSettings,
    maxRes: number = 512
): Promise<{ dataUrl: string; heights: Float32Array; width: number; height: number } | null> {
    const wrapBlur = (settings.tileLockEnabled ?? true) || (settings.tileNormalWrap ?? true);
    const sig = JSON.stringify({
        sourceUrl: sourceUrl.length > 120 ? `${sourceUrl.slice(0, 60)}_${sourceUrl.slice(-40)}_${sourceUrl.length}` : sourceUrl,
        invert: settings.invert,
        contrast: settings.contrast,
        brightness: settings.brightness,
        blur: settings.blur,
        wrapBlur,
        blackPoint: settings.blackPoint,
        whitePoint: settings.whitePoint,
        terracing: settings.terracing,
        colorHeightRules: settings.colorHeightRules || [],
        colorBaseMix: settings.colorBaseMix ?? 100,
    });

    const cached = heightMapCache.get(sig);
    if (cached) {
        return {
            dataUrl: cached.previewDataUrl,
            heights: cached.heights,
            width: cached.width,
            height: cached.height,
        };
    }

    const img = await loadRawImage(sourceUrl);
    if (!img) return null;

    const aspect = img.width / (img.height || 1);
    const w = aspect >= 1 ? Math.min(maxRes, img.width) : Math.max(32, Math.round(Math.min(maxRes, img.height) * aspect));
    const h = aspect >= 1 ? Math.max(32, Math.round(w / aspect)) : Math.min(maxRes, img.height);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    drawSeamlessBlurredImage(ctx, img, w, h, settings.blur, wrapBlur);

    // Also read unblurred RGB when colorHeightRules are active so blade spikes stay crisp before/with blur
    let sharpData: Uint8ClampedArray | null = null;
    const activeRules = (settings.colorHeightRules || []).filter((r) => r.enabled);
    if (activeRules.length > 0 && settings.blur > 0) {
        const sharpCanvas = document.createElement('canvas');
        sharpCanvas.width = w;
        sharpCanvas.height = h;
        const sCtx = sharpCanvas.getContext('2d', { willReadFrequently: true });
        if (sCtx) {
            sCtx.drawImage(img, 0, 0, w, h);
            sharpData = sCtx.getImageData(0, 0, w, h).data;
        }
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const heights = new Float32Array(w * h);

    const contrastFactor = Math.max(0, settings.contrast ?? 100) / 100;
    const brightnessOffset = (settings.brightness ?? 0) / 100;
    const bp = Math.max(0, Math.min(0.99, (settings.blackPoint ?? 0) / 100));
    const wp = Math.max(bp + 0.01, Math.min(1.0, (settings.whitePoint ?? 100) / 100));
    const steps = Math.round(settings.terracing ?? 0);
    const baseMix = Math.max(0, Math.min(100, settings.colorBaseMix ?? 100)) / 100;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r255 = data[i];
        const g255 = data[i + 1];
        const b255 = data[i + 2];
        const r = r255 / 255;
        const g = g255 / 255;
        const b = b255 / 255;
        const a = data[i + 3] / 255;

        // Luminance (perceived greyscale: light = high, dark = low)
        let lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (settings.invert) {
            lum = 1.0 - lum;
        }

        // Brightness & Contrast around 0.5
        lum = (lum - 0.5) * contrastFactor + 0.5 + brightnessOffset;

        // Black & White point levels
        lum = (lum - bp) / (wp - bp);
        lum = Math.max(0, Math.min(1, lum));

        // Blend with neutral 0.5 base if user lowers Greyscale Base Mix to isolate Color Height Rules
        if (activeRules.length > 0 && baseMix < 1) {
            lum = 0.5 * (1 - baseMix) + lum * baseMix;
        }

        // Apply Color-Targeted Height Rules (e.g. Raise Green Grass + Blade Spikes, Carve Dark Soil)
        if (activeRules.length > 0) {
            const px = p % w;
            const py = (p / w) | 0;
            const sr = sharpData ? sharpData[i] : r255;
            const sg = sharpData ? sharpData[i + 1] : g255;
            const sb = sharpData ? sharpData[i + 2] : b255;
            const colorDelta = evaluateColorHeightBoostAtPixel(sr, sg, sb, px, py, activeRules);
            lum = Math.max(0, Math.min(1, lum + colorDelta));
        }

        // Terracing / Quantization steps
        if (steps >= 2) {
            lum = Math.round(lum * steps) / steps;
        }

        // Weight by alpha so transparent pixels stay at base 0
        const finalH = lum * a;
        heights[p] = finalH;

        const byteVal = Math.round(finalH * 255);
        data[i] = byteVal;
        data[i + 1] = byteVal;
        data[i + 2] = byteVal;
        data[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    const previewDataUrl = canvas.toDataURL('image/png');

    if (heightMapCache.size > 20) {
        const oldestKey = heightMapCache.keys().next().value;
        if (oldestKey) heightMapCache.delete(oldestKey);
    }

    heightMapCache.set(sig, {
        signature: sig,
        width: w,
        height: h,
        heights,
        previewDataUrl,
    });

    return { dataUrl: previewDataUrl, heights, width: w, height: h };
}

/**
 * Fast, deterministic 2D Value/Simplex-like FBM noise for random terrain-ish deformation.
 */
function hash2D(ix: number, iy: number, seed: number): number {
    let n = ix * 374761393 + iy * 668265263 + seed * 1442695041;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise2D(x: number, y: number, seed: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Quintic smoothstep
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

    const a = hash2D(ix, iy, seed);
    const b = hash2D(ix + 1, iy, seed);
    const c = hash2D(ix, iy + 1, seed);
    const d = hash2D(ix + 1, iy + 1, seed);

    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function sampleTerrainNoise(
    u: number,
    v: number,
    settings: ThreeDDisplacementSettings
): number {
    if (!settings.terrainEnabled || settings.terrainAmplitude === 0) return 0;

    const freqBase = Math.max(0.1, settings.terrainFrequency ?? 2.5);
    const persistence = Math.max(0, Math.min(1, settings.terrainRoughness ?? 0.5));
    const seed = Math.round(settings.terrainSeed ?? 1337);
    const ridge = !!settings.terrainRidgeMode;

    let total = 0;
    let amplitude = 1;
    let maxAmp = 0;
    let freq = freqBase;

    const octaves = 4;
    for (let o = 0; o < octaves; o++) {
        let n = smoothNoise2D(u * freq, v * freq, seed + o * 101);
        if (ridge) {
            // Ridge noise: invert absolute crease around 0.5
            n = 1.0 - Math.abs(n * 2.0 - 1.0);
            n = n * n;
        } else {
            // Signed [-1, 1]
            n = n * 2.0 - 1.0;
        }
        total += n * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        freq *= 2.05;
    }

    const normalized = maxAmp > 0 ? total / maxAmp : 0;
    const centered = ridge ? (normalized - 0.5) * 2.0 : normalized;
    return centered * (settings.terrainAmplitude ?? 2.0);
}

/**
 * Bilinearly samples the normalized height [0, 1] at UV coordinates (u, v).
 */
function sampleHeightBilinear(
    heights: Float32Array,
    width: number,
    height: number,
    u: number,
    v: number
): number {
    const cu = Math.max(0, Math.min(1, u));
    // Note: in Three.js UV space, v=1 is top of image (row 0), v=0 is bottom (row height-1)
    const cv = Math.max(0, Math.min(1, 1.0 - v));

    const x = cu * (width - 1);
    const y = cv * (height - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(width - 1, x0 + 1);
    const y1 = Math.min(height - 1, y0 + 1);
    const fx = x - x0;
    const fy = y - y0;

    const h00 = heights[y0 * width + x0];
    const h10 = heights[y0 * width + x1];
    const h01 = heights[y1 * width + x0];
    const h11 = heights[y1 * width + x1];

    const top = h00 + (h10 - h00) * fx;
    const bottom = h01 + (h11 - h01) * fx;
    return top + (bottom - top) * fy;
}

/**
 * Applies real vertex displacement along the Y axis (or vertex normal for 3D GLB meshes)
 * combining grayscale texture displacement AND procedural terrain deformation.
 */
export async function applyGeometryDisplacementToModel(
    model: THREE.Group,
    obj: ThreeDObject,
    activeDiffuseCanvas?: HTMLCanvasElement | null
): Promise<string | null> {
    const disp: ThreeDDisplacementSettings = {
        ...DEFAULT_DISPLACEMENT_SETTINGS,
        ...(obj.displacementSettings || {}),
    };
    const isProceduralPlane = isProceduralPlaneUrl(obj.glbUrl);

    // Determine source URL for grayscale heightmap generation
    let sourceUrl = obj.displacementMapUrl || obj.textureUrl;
    if (!sourceUrl && activeDiffuseCanvas) {
        sourceUrl = activeDiffuseCanvas.toDataURL('image/png');
    }

    const { tilesX, tilesZ } = resolvePlaneTileCounts(obj, disp);
    const tileLockEnabled = isProceduralPlane && (disp.tileLockEnabled ?? true);
    const tileNormalWrap = isProceduralPlane && (disp.tileNormalWrap ?? true);
    const tileSeamBlend = disp.tileSeamBlend ?? 35;

    const subdivLevel = Math.max(0, Math.min(3, obj.subdivisionSettings?.level ?? 0));
    const subdivMult = Math.pow(2, subdivLevel);
    const effectivePlaneSubdivs = Math.min(384, Math.round((disp.subdivisions || 96) * subdivMult));
    const isActiveDisplacement = disp.enabled || disp.terrainEnabled || subdivLevel > 0;
    const { segsX: targetSegsX, segsZ: targetSegsZ } = isProceduralPlane && isActiveDisplacement
        ? computeTileLockedSubdivisions(effectivePlaneSubdivs, tilesX, tilesZ, tileLockEnabled)
        : { segsX: 1, segsZ: 1 };

    // 1. If this is a procedural plane, ensure its PlaneGeometry has the required subdivision segments
    if (isProceduralPlane) {
        let unitSize = 1;
        const qIdx = obj.glbUrl.indexOf('?');
        if (qIdx !== -1) {
            const params = new URLSearchParams(obj.glbUrl.substring(qIdx + 1));
            const parsed = parseFloat(params.get('unitSize') || '1');
            if (!isNaN(parsed) && parsed > 0) unitSize = parsed;
        }

        model.traverse((child) => {
            if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const currentSegsX = mesh.geometry.userData.segmentsX || mesh.geometry.userData.segments || 1;
                const currentSegsZ = mesh.geometry.userData.segmentsZ || mesh.geometry.userData.segments || 1;
                if (currentSegsX !== targetSegsX || currentSegsZ !== targetSegsZ) {
                    mesh.geometry.dispose();
                    const newGeo = new THREE.PlaneGeometry(unitSize, unitSize, targetSegsX, targetSegsZ);
                    newGeo.rotateX(-Math.PI / 2);
                    newGeo.userData.segments = targetSegsX;
                    newGeo.userData.segmentsX = targetSegsX;
                    newGeo.userData.segmentsZ = targetSegsZ;
                    newGeo.userData.basePositions = (newGeo.attributes.position as THREE.BufferAttribute).clone();
                    if (newGeo.attributes.normal) {
                        newGeo.userData.baseNormals = (newGeo.attributes.normal as THREE.BufferAttribute).clone();
                    }
                    mesh.geometry = newGeo;
                }
            }
        });
    }

    // If neither texture displacement nor terrain deformation is enabled, restore base positions & base normals
    if (!disp.enabled && !disp.terrainEnabled) {
        model.traverse((child) => {
            if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const geo = mesh.geometry;
                if (geo.userData.basePositions) {
                    geo.setAttribute('position', geo.userData.basePositions.clone());
                    geo.attributes.position.needsUpdate = true;
                    if (geo.userData.baseNormals) {
                        geo.setAttribute('normal', geo.userData.baseNormals.clone());
                        geo.attributes.normal.needsUpdate = true;
                    } else {
                        geo.computeVertexNormals();
                    }
                    geo.computeBoundingBox();
                    geo.computeBoundingSphere();
                }
            }
        });
        return null;
    }

    let mapResult: { dataUrl: string; heights: Float32Array; width: number; height: number } | null = null;
    if (disp.enabled && sourceUrl) {
        mapResult = await generateDisplacementMapFromSource(sourceUrl, disp);
    }

    const scale = disp.scale ?? 2.5;
    const bias = disp.bias ?? 0;
    const falloffPct = Math.max(0, Math.min(100, disp.edgeFalloff ?? 0)) / 100;

    model.traverse((child) => {
        if (child.userData?.isScatterInstance || child.name === '__SurfaceScatterGroup__' || child.parent?.name === '__SurfaceScatterGroup__') return;
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry;
            if (!geo.attributes.position) return;

            if (!geo.userData.basePositions) {
                geo.userData.basePositions = (geo.attributes.position as THREE.BufferAttribute).clone();
            }
            if (!geo.userData.baseNormals && geo.attributes.normal) {
                geo.userData.baseNormals = (geo.attributes.normal as THREE.BufferAttribute).clone();
            }

            const basePos = geo.userData.basePositions as THREE.BufferAttribute;
            const posAttr = geo.attributes.position as THREE.BufferAttribute;
            const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;

            const weldEnabled = disp.weldVertices ?? true;
            const weldTolerance = disp.weldTolerance ?? 35;

            geo.computeBoundingBox();
            const bbox = geo.boundingBox || new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
            const sizeVec = new THREE.Vector3();
            bbox.getSize(sizeVec);
            const refSize = Math.max(0.1, Math.max(sizeVec.x, sizeVec.y, sizeVec.z));

            if (!geo.attributes.normal) {
                geo.computeVertexNormals();
            }
            const normAttr = geo.attributes.normal as THREE.BufferAttribute;
            const weldInfo = weldEnabled
                ? buildSpatialVertexWeldInfo(basePos, normAttr, refSize, weldTolerance)
                : null;

            for (let i = 0; i < basePos.count; i++) {
                const bx = weldInfo ? weldInfo.canonicalBasePositions[i * 3] : basePos.getX(i);
                const by = weldInfo ? weldInfo.canonicalBasePositions[i * 3 + 1] : basePos.getY(i);
                const bz = weldInfo ? weldInfo.canonicalBasePositions[i * 3 + 2] : basePos.getZ(i);

                const u = uvAttr ? uvAttr.getX(i) : 0.5;
                const v = uvAttr ? uvAttr.getY(i) : 0.5;

                let deltaY = 0;

                // 1. Grayscale Texture Height Displacement (Light = +Y, Dark = -Y around midpoint or 0..1)
                if (disp.enabled && mapResult) {
                    const hVal = sampleSeamlessTileHeight(
                        mapResult.heights,
                        mapResult.width,
                        mapResult.height,
                        u,
                        v,
                        tilesX,
                        tilesZ,
                        tileLockEnabled,
                        tileSeamBlend,
                        sampleHeightBilinear
                    );
                    // Map [0, 1] -> [-0.5, +0.5] * scale + bias so light goes UP (+Y) and dark goes DOWN (-Y)
                    deltaY += (hVal - 0.5) * scale + bias;
                } else if (disp.enabled) {
                    deltaY += bias;
                }

                // 2. Random Terrain Deformation (1x1 Tile-Periodic when tileLockEnabled is active)
                if (disp.terrainEnabled) {
                    deltaY += tileLockEnabled
                        ? samplePeriodicTileTerrainNoise(u, v, tilesX, tilesZ, disp)
                        : sampleTerrainNoise(u, v, disp);
                }

                // 3. Optional Edge Falloff (smoothly pins border vertices of plane to 0)
                if (falloffPct > 0) {
                    const distEdge = Math.min(u, 1 - u, v, 1 - v) * 2; // 0 at border, 1 at center
                    const mask = Math.min(1, distEdge / Math.max(0.01, falloffPct));
                    const smoothMask = mask * mask * (3 - 2 * mask);
                    deltaY *= smoothMask;
                }

                // Displace along Y axis (vertical height in isometric 3D space)
                posAttr.setXYZ(i, bx, by + deltaY, bz);
            }

            if (weldInfo) {
                enforceWeldedVertexPositions(posAttr, weldInfo);
            }

            posAttr.needsUpdate = true;
            geo.computeVertexNormals();

            // 4. Seamless Normal & Lighting Wrap Across Tiles
            if (tileNormalWrap && targetSegsX > 1 && targetSegsZ > 1) {
                applySeamlessTileNormalWrap(geo, targetSegsX, targetSegsZ, tilesX, tilesZ);
            }

            geo.computeBoundingBox();
            geo.computeBoundingSphere();
        }
    });

    return mapResult ? mapResult.dataUrl : null;
}
