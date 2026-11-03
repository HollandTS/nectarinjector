import JSZip from 'jszip';
import type { GridType, ThreeDObject } from '../types';
import { PROCEDURAL_PLANE_PREFIX, getWorldTileUnitSize } from './layerTo3DPlaneUtils';
import { DEFAULT_DISPLACEMENT_SETTINGS } from './threeDDisplacementHelper';

export interface ParsedPbrBundle {
    baseName: string;
    textureUrl?: string;
    textureFileName?: string;
    displacementMapUrl?: string;
    displacementFileName?: string;
    normalMapUrl?: string;
    normalFileName?: string;
    metallicMapUrl?: string;
    metallicFileName?: string;
    roughnessMapUrl?: string;
    roughnessFileName?: string;
}

export type PbrChannelRole = 'albedo' | 'height' | 'normal' | 'metallic' | 'roughness' | 'ignore';

/**
 * Classifies an image filename into a PBR channel role based on common suffixes/tokens:
 * _albedo, _basecolor, _diffuse, _color, _col
 * _height, _disp, _displacement, _bump, _depth
 * _normal, _nor, _nrm, _norm
 * _metallic, _metalness, _metal, _met
 * _roughness, _rough, _rgh, _gloss
 */
export function classifyPbrFilename(filename: string): PbrChannelRole {
    // Strip path and extension
    const cleanName = filename.split('/').pop() || filename;
    const dotIdx = cleanName.lastIndexOf('.');
    const stem = (dotIdx !== -1 ? cleanName.substring(0, dotIdx) : cleanName).toLowerCase();

    // Ignore ambient occlusion or preview thumbnails unless nothing else matches
    if (/(^|[_\-\s.])(ao|ambientocclusion|ambient|preview|thumb|arm|orm)($|[_\-\s.])/.test(stem)) {
        return 'ignore';
    }

    if (/(^|[_\-\s.])(normal|nor|nrm|norm|normalgl|normaldx)($|[_\-\s.\d])/.test(stem) || stem.includes('_normal') || stem.includes('_nrm') || stem.includes('_nor')) {
        return 'normal';
    }

    if (/(^|[_\-\s.])(height|disp|displacement|bump|depth|hgt)($|[_\-\s.\d])/.test(stem) || stem.includes('_height') || stem.includes('_disp') || stem.includes('_bump')) {
        return 'height';
    }

    if (/(^|[_\-\s.])(metallic|metalness|metal|met|mtl)($|[_\-\s.\d])/.test(stem) || stem.includes('_metallic') || stem.includes('_metal')) {
        return 'metallic';
    }

    if (/(^|[_\-\s.])(roughness|rough|rgh|gloss|glossiness)($|[_\-\s.\d])/.test(stem) || stem.includes('_roughness') || stem.includes('_rough')) {
        return 'roughness';
    }

    if (
        /(^|[_\-\s.])(albedo|basecolor|base_color|diffuse|diff|color|col|alb|tex)($|[_\-\s.\d])/.test(stem) ||
        stem.includes('_albedo') ||
        stem.includes('_diffuse') ||
        stem.includes('_basecolor') ||
        stem.includes('_color')
    ) {
        return 'albedo';
    }

    // Fallback: if an image has no specific PBR suffix, treat as albedo/diffuse candidate
    return 'albedo';
}

function deriveMaterialBaseName(filename: string): string {
    const clean = filename.split('/').pop() || filename;
    const dotIdx = clean.lastIndexOf('.');
    const stem = dotIdx !== -1 ? clean.substring(0, dotIdx) : clean;
    const stripped = stem.replace(
        /[_\-\s.]*(albedo|basecolor|base_color|diffuse|diff|color|col|normal|nor|nrm|norm|normalgl|normaldx|height|disp|displacement|bump|depth|metallic|metalness|metal|met|roughness|rough|rgh|1k|2k|4k|8k)+$/gi,
        ''
    );
    return stripped.trim() || stem || 'PBR Plane';
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(blob);
    });
}

function getMimeFromFilename(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    return 'image/png';
}

/**
 * Extracts and auto-assigns PBR map images from a list of Files (which can include .zip archives and/or image files).
 */
export async function parsePbrFilesOrZip(files: FileList | File[]): Promise<ParsedPbrBundle> {
    const fileArray = Array.from(files);
    const result: ParsedPbrBundle = {
        baseName: '',
    };

    const candidateEntries: { name: string; getDataUrl: () => Promise<string> }[] = [];

    for (const file of fileArray) {
        const low = file.name.toLowerCase();
        if (low.endsWith('.zip')) {
            if (!result.baseName) {
                result.baseName = file.name.replace(/\.zip$/i, '');
            }
            const zip = await JSZip.loadAsync(file);
            const entries = Object.values(zip.files);
            for (const entry of entries) {
                if (entry.dir) continue;
                const entryLow = entry.name.toLowerCase();
                // Skip macOS resource fork files
                if (entryLow.includes('__macosx') || entry.name.split('/').pop()?.startsWith('._')) {
                    continue;
                }
                if (/\.(png|jpe?g|webp)$/i.test(entryLow)) {
                    candidateEntries.push({
                        name: entry.name.split('/').pop() || entry.name,
                        getDataUrl: async () => {
                            const uint8 = await entry.async('uint8array');
                            const blob = new Blob([uint8], { type: getMimeFromFilename(entry.name) });
                            return blobToDataUrl(blob);
                        },
                    });
                }
            }
        } else if (/\.(png|jpe?g|webp)$/i.test(low)) {
            candidateEntries.push({
                name: file.name,
                getDataUrl: () => blobToDataUrl(file),
            });
        }
    }

    let fallbackAlbedoCandidate: { name: string; getDataUrl: () => Promise<string> } | null = null;

    for (const item of candidateEntries) {
        const role = classifyPbrFilename(item.name);
        if (!result.baseName) {
            result.baseName = deriveMaterialBaseName(item.name);
        }

        if (role === 'normal' && !result.normalMapUrl) {
            result.normalMapUrl = await item.getDataUrl();
            result.normalFileName = item.name;
        } else if (role === 'height' && !result.displacementMapUrl) {
            result.displacementMapUrl = await item.getDataUrl();
            result.displacementFileName = item.name;
        } else if (role === 'metallic' && !result.metallicMapUrl) {
            result.metallicMapUrl = await item.getDataUrl();
            result.metallicFileName = item.name;
        } else if (role === 'roughness' && !result.roughnessMapUrl) {
            result.roughnessMapUrl = await item.getDataUrl();
            result.roughnessFileName = item.name;
        } else if (role === 'albedo') {
            // Prefer explicit _albedo / _diffuse / _basecolor over generic names
            const isExplicit = /(albedo|basecolor|base_color|diffuse|diff|color|col)/i.test(item.name);
            if (isExplicit && !result.textureUrl) {
                result.textureUrl = await item.getDataUrl();
                result.textureFileName = item.name;
            } else if (!fallbackAlbedoCandidate) {
                fallbackAlbedoCandidate = item;
            }
        }
    }

    if (!result.textureUrl && fallbackAlbedoCandidate) {
        result.textureUrl = await fallbackAlbedoCandidate.getDataUrl();
        result.textureFileName = fallbackAlbedoCandidate.name;
    }

    return result;
}

/**
 * Creates a new `ThreeDObject` procedural plane of `tilesX × tilesZ` grid tiles
 * with optional auto-assigned PBR maps.
 */
export function buildNewThreeDPlaneObject(params: {
    name?: string;
    tilesX: number;
    tilesZ: number;
    gridType: GridType;
    pbr?: ParsedPbrBundle;
}): ThreeDObject {
    const activeGrid = params.gridType === 'none' ? 'ts_full' : params.gridType;
    const unitSize = getWorldTileUnitSize(activeGrid);
    const tx = Math.max(1, Math.round(params.tilesX || 1));
    const tz = Math.max(1, Math.round(params.tilesZ || 1));

    const pbr = params.pbr;
    const planeName =
        params.name?.trim() ||
        (pbr?.baseName ? `${pbr.baseName} (${tx}×${tz})` : `Plane ${tx}×${tz}`);

    return {
        id: `3d-plane-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        glbUrl: `${PROCEDURAL_PLANE_PREFIX}?unitSize=${unitSize.toFixed(4)}`,
        name: planeName,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: {
            x: tx,
            y: 1,
            z: tz,
        },
        uvMapping: 'default',
        textureUrl: pbr?.textureUrl,
        displacementMapUrl: pbr?.displacementMapUrl,
        normalMapUrl: pbr?.normalMapUrl,
        metallicMapUrl: pbr?.metallicMapUrl,
        roughnessMapUrl: pbr?.roughnessMapUrl,
        displacementSettings: {
            ...DEFAULT_DISPLACEMENT_SETTINGS,
            enabled: false,
            tileLockEnabled: true,
            tileNormalWrap: true,
            tileSeamBlend: 35,
            tileCountX: tx,
            tileCountZ: tz,
        },
        textureSettings: {
            sharpness: 0,
            scale: 1,
            contrast: 100,
            brightness: 100,
            hue: 0,
            saturation: 100,
            metallic: pbr?.metallicMapUrl ? 1 : 0,
            roughness: 1,
            normalScale: 1.0,
            magFilter: 'linear',
            minFilter: 'linear',
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
}
