import JSZip from 'jszip';
import type { CanvasImage, ProjectOverlay, ThreeDObject, GridType } from '../types';
import { getFullOverlaySurface, getOverlayTileCrop } from './overlaySurfaceRenderer';
import {
    renderThreeDObjectCrop,
    makeThreeDTargetId,
    isThreeDTargetId,
    getRegisteredThreeDObjects,
} from './threeDInjectionUtils';
import { isAllLayersTargetId } from './allLayersInjectionHelper';
import { getOverlayCompositeOrder, getThreeDDefaultStackOrder } from './sceneOrderHelper';

export const SCENE_GROUP_PREFIX = 'scene-group:';

export function isSceneGroupId(id: string | null | undefined): boolean {
    return typeof id === 'string' && id.startsWith(SCENE_GROUP_PREFIX);
}

export interface SceneGroupInfo {
    id: string;
    name: string;
    moveTogether: boolean;
    overlays: ProjectOverlay[];
    threeDObjects: ThreeDObject[];
    images: CanvasImage[];
}

/**
 * Extracts all unique Scene Groups from the current overlays, 3D objects, and Isotiles.
 */
export function getSceneGroups(
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[] = [],
    images: CanvasImage[] = []
): SceneGroupInfo[] {
    const map = new Map<string, SceneGroupInfo>();

    const ensureGroup = (id: string, name?: string, moveTogether?: boolean): SceneGroupInfo => {
        let g = map.get(id);
        if (!g) {
            g = {
                id,
                name: name || 'Scene Group',
                moveTogether: moveTogether ?? true,
                overlays: [],
                threeDObjects: [],
                images: [],
            };
            map.set(id, g);
        } else {
            if (name && g.name === 'Scene Group') g.name = name;
            if (moveTogether !== undefined) g.moveTogether = moveTogether;
        }
        return g;
    };

    for (const ov of overlays) {
        if (ov.sceneGroupId && !isThreeDTargetId(ov.id) && !isAllLayersTargetId(ov.id) && !isSceneGroupId(ov.id)) {
            const g = ensureGroup(ov.sceneGroupId, ov.sceneGroupName, ov.sceneGroupMoveTogether);
            g.overlays.push(ov);
        }
    }

    for (const obj of threeDObjects) {
        if (obj.sceneGroupId) {
            const g = ensureGroup(obj.sceneGroupId, obj.sceneGroupName, obj.sceneGroupMoveTogether);
            g.threeDObjects.push(obj);
        }
    }

    for (const img of images) {
        if (img.sceneGroupId) {
            const g = ensureGroup(img.sceneGroupId, img.sceneGroupName, img.sceneGroupMoveTogether);
            g.images.push(img);
        }
    }

    return Array.from(map.values());
}

/**
 * Assigns a new Scene Group to the selected items (identified by their SceneOrganizer UIDs:
 * `layer:<id>`, `3d:<id>`, `tile:<id>`, or `tiles-group:all`).
 * Keeps all items in their current positions and stack order.
 */
export function createSceneGroupFromSelection(
    selectedUids: Set<string>,
    groupName: string,
    moveTogether: boolean,
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[],
    images: CanvasImage[]
): {
    sceneGroupId: string;
    nextOverlays: ProjectOverlay[];
    nextThreeDObjects: ThreeDObject[];
    nextImages: CanvasImage[];
} {
    const cleanName = groupName.trim() || 'Scene Group';
    const sceneGroupId = `${SCENE_GROUP_PREFIX}${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const includeAllTiles = selectedUids.has('tiles-group:all');

    const nextOverlays = overlays.map((ov) => {
        if (selectedUids.has(`layer:${ov.id}`)) {
            return {
                ...ov,
                sceneGroupId,
                sceneGroupName: cleanName,
                sceneGroupMoveTogether: moveTogether,
            };
        }
        return ov;
    });

    const nextThreeDObjects = threeDObjects.map((obj) => {
        if (selectedUids.has(`3d:${obj.id}`)) {
            return {
                ...obj,
                sceneGroupId,
                sceneGroupName: cleanName,
                sceneGroupMoveTogether: moveTogether,
            };
        }
        return obj;
    });

    const nextImages = images.map((img) => {
        if (includeAllTiles || selectedUids.has(`tile:${img.id}`)) {
            return {
                ...img,
                sceneGroupId,
                sceneGroupName: cleanName,
                sceneGroupMoveTogether: moveTogether,
            };
        }
        return img;
    });

    return {
        sceneGroupId,
        nextOverlays,
        nextThreeDObjects,
        nextImages,
    };
}

/**
 * Updates `sceneGroupMoveTogether` or `sceneGroupName` across all members of a Scene Group.
 */
export function updateSceneGroupProperties(
    sceneGroupId: string,
    updates: { name?: string; moveTogether?: boolean },
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[],
    images: CanvasImage[]
): {
    nextOverlays: ProjectOverlay[];
    nextThreeDObjects: ThreeDObject[];
    nextImages: CanvasImage[];
} {
    const apply = <T extends { sceneGroupId?: string; sceneGroupName?: string; sceneGroupMoveTogether?: boolean }>(
        item: T
    ): T => {
        if (item.sceneGroupId !== sceneGroupId) return item;
        return {
            ...item,
            ...(updates.name !== undefined ? { sceneGroupName: updates.name } : {}),
            ...(updates.moveTogether !== undefined ? { sceneGroupMoveTogether: updates.moveTogether } : {}),
        };
    };

    return {
        nextOverlays: overlays.map(apply),
        nextThreeDObjects: threeDObjects.map(apply),
        nextImages: images.map(apply),
    };
}

/**
 * Ungroups an entire Scene Group or removes a single item from its Scene Group.
 */
export function ungroupSceneGroup(
    sceneGroupId: string,
    overlays: ProjectOverlay[],
    threeDObjects: ThreeDObject[],
    images: CanvasImage[],
    onlyItemUid?: string
): {
    nextOverlays: ProjectOverlay[];
    nextThreeDObjects: ThreeDObject[];
    nextImages: CanvasImage[];
} {
    const strip = <T extends { sceneGroupId?: string; sceneGroupName?: string; sceneGroupMoveTogether?: boolean }>(
        item: T
    ): T => {
        const copy = { ...item };
        delete copy.sceneGroupId;
        delete copy.sceneGroupName;
        delete copy.sceneGroupMoveTogether;
        return copy;
    };

    return {
        nextOverlays: overlays.map((ov) => {
            if (ov.sceneGroupId !== sceneGroupId) return ov;
            if (onlyItemUid && onlyItemUid !== `layer:${ov.id}`) return ov;
            return strip(ov);
        }),
        nextThreeDObjects: threeDObjects.map((obj) => {
            if (obj.sceneGroupId !== sceneGroupId) return obj;
            if (onlyItemUid && onlyItemUid !== `3d:${obj.id}`) return obj;
            return strip(obj);
        }),
        nextImages: images.map((img) => {
            if (img.sceneGroupId !== sceneGroupId) return img;
            if (onlyItemUid && onlyItemUid !== `tile:${img.id}` && onlyItemUid !== 'tiles-group:all') return img;
            return strip(img);
        }),
    };
}

/**
 * Renders a composite crop at (cropX, cropY, cropW, cropH) of all visible 2D layers and 3D objects
 * that belong to `sceneGroupId`, ordered by their `stackOrder` and with normalized opaque alpha
 * so the group can be picked as a Target Layer in Texture Injection.
 */
export async function renderSceneGroupCompositeCrop(
    sceneGroupId: string,
    allOverlays: ProjectOverlay[],
    gridType: GridType,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number
): Promise<HTMLCanvasElement | null> {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cropW));
    out.height = Math.max(1, Math.round(cropH));
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;

    const groupOverlays = allOverlays.filter(
        (o) =>
            o.sceneGroupId === sceneGroupId &&
            o.isVisible &&
            o.src &&
            !isThreeDTargetId(o.id) &&
            !isAllLayersTargetId(o.id) &&
            !isSceneGroupId(o.id)
    );

    const allThreeDObjects = getRegisteredThreeDObjects() as ThreeDObject[];
    const groupThreeD = (allThreeDObjects || []).filter((o) => o.sceneGroupId === sceneGroupId);

    if (groupOverlays.length === 0 && groupThreeD.length === 0) {
        return null;
    }

    type RenderStep =
        | { kind: '2d'; ov: ProjectOverlay; order: number }
        | { kind: '3d-obj'; objId: string; order: number };

    const steps: RenderStep[] = [];

    groupOverlays.forEach((ov) => {
        const idx = allOverlays.findIndex((o) => o.id === ov.id);
        steps.push({
            kind: '2d',
            ov,
            order: getOverlayCompositeOrder(ov, Math.max(0, idx)),
        });
    });

    groupThreeD.forEach((obj) => {
        const idx = allThreeDObjects.findIndex((o) => o.id === obj.id);
        steps.push({
            kind: '3d-obj',
            objId: obj.id,
            order: getThreeDDefaultStackOrder(obj, Math.max(0, idx)),
        });
    });

    steps.sort((a, b) => a.order - b.order);

    for (const step of steps) {
        if (step.kind === '2d') {
            const ov = step.ov;
            const surface = await getFullOverlaySurface(ov, gridType, allOverlays);
            if (!surface) continue;
            const tileCrop = getOverlayTileCrop(
                surface,
                cropX,
                cropY,
                out.width,
                out.height,
                ov.filters.renderMode
            );
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, (ov.opacity ?? 100) / 100));
            ctx.drawImage(tileCrop, 0, 0);
            ctx.restore();
        } else {
            const threeDCrop = await renderThreeDObjectCrop(
                makeThreeDTargetId(step.objId),
                cropX,
                cropY,
                out.width,
                out.height
            );
            if (threeDCrop) {
                ctx.save();
                ctx.globalAlpha = 1;
                ctx.drawImage(threeDCrop, 0, 0);
                ctx.restore();
            }
        }
    }

    const imgData = ctx.getImageData(0, 0, out.width, out.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a > 0 && a < 255) {
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(imgData, 0, 0);

    return out;
}

/**
 * Saves a Scene Group (including its 2D layers + additional textures, 3D objects + GLBs/maps, and Isotiles)
 * to a `.nectargroup` archive file and triggers a browser download.
 */
export async function saveSceneGroupToFile(
    group: SceneGroupInfo,
    templateName: string = 'project'
): Promise<void> {
    const zip = new JSZip();
    const payload = {
        version: '1.0',
        groupId: group.id,
        groupName: group.name,
        moveTogether: group.moveTogether,
        overlays: [] as any[],
        threeDObjects: [] as any[],
        images: [] as any[],
        timestamp: Date.now(),
    };

    const addAssetToZip = async (url: string | undefined | null, folder: string, id: string) => {
        if (!url) return null;
        if (
            url.startsWith('procedural://') ||
            url.startsWith('3d-obj:') ||
            url.startsWith('all-layers:') ||
            url.startsWith(SCENE_GROUP_PREFIX)
        ) {
            return url;
        }
        try {
            let blob: Blob;
            if (url.startsWith('data:')) {
                const parts = url.split(',');
                const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
                const bstr = atob(parts[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                blob = new Blob([u8arr], { type: mime });
            } else {
                const response = await fetch(url);
                blob = await response.blob();
            }
            const ext = (blob.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
            const filename = `${folder}/${id}.${ext}`;
            zip.file(filename, blob);
            return filename;
        } catch (e) {
            console.warn('Failed to bundle group asset:', url, e);
            return url;
        }
    };

    for (const ov of group.overlays) {
        const srcPath = await addAssetToZip(ov.src, 'overlays', ov.id);
        let nextAddTextures = ov.filters.additionalTextures || [];
        if (nextAddTextures.length > 0) {
            nextAddTextures = await Promise.all(
                nextAddTextures.map(async (add, idx) => {
                    const p = await addAssetToZip(add.src, 'overlays', `${ov.id}_add_${idx}`);
                    return { ...add, src: p || add.src };
                })
            );
        }
        payload.overlays.push({
            ...ov,
            src: srcPath,
            filters: {
                ...ov.filters,
                additionalTextures: nextAddTextures,
            },
        });
    }

    for (const obj of group.threeDObjects) {
        const glbPath = await addAssetToZip(obj.glbUrl, 'models', `${obj.id}_model`);
        const textureUrl = obj.textureUrl
            ? (await addAssetToZip(obj.textureUrl, 'models', `${obj.id}_diffuse`)) || undefined
            : undefined;
        const normalMapUrl = obj.normalMapUrl
            ? (await addAssetToZip(obj.normalMapUrl, 'models', `${obj.id}_normal`)) || undefined
            : undefined;
        const metallicMapUrl = obj.metallicMapUrl
            ? (await addAssetToZip(obj.metallicMapUrl, 'models', `${obj.id}_metallic`)) || undefined
            : undefined;
        const roughnessMapUrl = obj.roughnessMapUrl
            ? (await addAssetToZip(obj.roughnessMapUrl, 'models', `${obj.id}_roughness`)) || undefined
            : undefined;
        const displacementMapUrl = obj.displacementMapUrl
            ? (await addAssetToZip(obj.displacementMapUrl, 'models', `${obj.id}_displacement`)) || undefined
            : undefined;

        payload.threeDObjects.push({
            ...obj,
            glbUrl: glbPath || obj.glbUrl,
            textureUrl,
            normalMapUrl,
            metallicMapUrl,
            roughnessMapUrl,
            displacementMapUrl,
        });
    }

    for (const img of group.images) {
        const srcPath = await addAssetToZip(img.src, 'images', img.id);
        const origPath = img.originalSrc
            ? await addAssetToZip(img.originalSrc, 'images', `${img.id}_orig`)
            : srcPath;
        let tmpBufferPath: string | undefined = undefined;
        let cleanTmpBuffer = img.tmpBuffer;
        if (
            cleanTmpBuffer &&
            !(cleanTmpBuffer instanceof ArrayBuffer) &&
            (cleanTmpBuffer as any).buffer instanceof ArrayBuffer
        ) {
            cleanTmpBuffer = (cleanTmpBuffer as any).buffer;
        }
        if (cleanTmpBuffer && cleanTmpBuffer instanceof ArrayBuffer && cleanTmpBuffer.byteLength > 0) {
            tmpBufferPath = `tmp_buffers/${img.id}.bin`;
            zip.file(tmpBufferPath, cleanTmpBuffer);
        }
        const { tmpBuffer, ...restImg } = img;
        payload.images.push({
            ...restImg,
            src: srcPath,
            originalSrc: origPath,
            tmpBufferPath,
        });
    }

    zip.file('group.json', JSON.stringify(payload, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const cleanTemplate = (templateName || 'project').trim();
    const cleanGroup = (group.name || 'group').trim();
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanTemplate}+${cleanGroup}.nectargroup`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Loads a `.nectargroup` file (either ZIP archive or raw JSON fallback) and returns new
 * uniquely-ID'd overlays, 3D objects, and Isotiles belonging to the imported Scene Group.
 */
export async function loadSceneGroupFromFile(file: File): Promise<{
    groupName: string;
    sceneGroupId: string;
    moveTogether: boolean;
    overlays: ProjectOverlay[];
    threeDObjects: ThreeDObject[];
    images: CanvasImage[];
}> {
    const newGroupId = `${SCENE_GROUP_PREFIX}${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const zip = await JSZip.loadAsync(file);
    const groupJsonStr = await zip.file('group.json')?.async('string');
    if (!groupJsonStr) {
        throw new Error('Invalid .nectargroup file: group.json missing.');
    }

    const parsed = JSON.parse(groupJsonStr);
    const groupName = parsed.groupName || file.name.replace(/\.nectargroup$/i, '') || 'Scene Group';
    const moveTogether = parsed.moveTogether ?? true;

    const extractAssetAsDataOrBlobUrl = async (
        path: string | undefined | null,
        asDataUrl: boolean = false
    ): Promise<string | undefined> => {
        if (!path) return undefined;
        if (
            path.startsWith('http') ||
            path.startsWith('data:') ||
            path.startsWith('procedural://') ||
            path.startsWith('3d-obj:') ||
            path.startsWith('all-layers:') ||
            path.startsWith(SCENE_GROUP_PREFIX)
        ) {
            return path;
        }
        const entry = zip.file(path);
        if (!entry) return path;
        if (asDataUrl) {
            const base64 = await entry.async('base64');
            const ext = path.split('.').pop()?.toLowerCase() || 'png';
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            return `data:${mime};base64,${base64}`;
        }
        const blob = await entry.async('blob');
        return URL.createObjectURL(blob);
    };

    const now = Date.now();

    const loadedOverlays: ProjectOverlay[] = await Promise.all(
        (parsed.overlays || []).map(async (ov: any, idx: number) => {
            const src = (await extractAssetAsDataOrBlobUrl(ov.src, true)) || null;
            let additionalTextures = ov.filters?.additionalTextures || [];
            if (additionalTextures.length > 0) {
                additionalTextures = await Promise.all(
                    additionalTextures.map(async (add: any) => ({
                        ...add,
                        src: (await extractAssetAsDataOrBlobUrl(add.src, true)) || add.src,
                    }))
                );
            }
            return {
                ...ov,
                id: `overlay-${now}-${idx}-${Math.floor(Math.random() * 1000)}`,
                src,
                filters: {
                    ...ov.filters,
                    additionalTextures,
                },
                sceneGroupId: newGroupId,
                sceneGroupName: groupName,
                sceneGroupMoveTogether: moveTogether,
            } as ProjectOverlay;
        })
    );

    const loadedThreeD: ThreeDObject[] = await Promise.all(
        (parsed.threeDObjects || []).map(async (obj: any, idx: number) => ({
            ...obj,
            id: `3d-${now}-${idx}-${Math.floor(Math.random() * 1000)}`,
            glbUrl: (await extractAssetAsDataOrBlobUrl(obj.glbUrl, false)) || obj.glbUrl,
            textureUrl: obj.textureUrl ? await extractAssetAsDataOrBlobUrl(obj.textureUrl, true) : undefined,
            normalMapUrl: obj.normalMapUrl ? await extractAssetAsDataOrBlobUrl(obj.normalMapUrl, true) : undefined,
            metallicMapUrl: obj.metallicMapUrl ? await extractAssetAsDataOrBlobUrl(obj.metallicMapUrl, true) : undefined,
            roughnessMapUrl: obj.roughnessMapUrl ? await extractAssetAsDataOrBlobUrl(obj.roughnessMapUrl, true) : undefined,
            displacementMapUrl: obj.displacementMapUrl
                ? await extractAssetAsDataOrBlobUrl(obj.displacementMapUrl, true)
                : undefined,
            sceneGroupId: newGroupId,
            sceneGroupName: groupName,
            sceneGroupMoveTogether: moveTogether,
        }))
    );

    const loadedImages: CanvasImage[] = await Promise.all(
        (parsed.images || []).map(async (img: any, idx: number) => {
            const cleanImg = { ...img };
            if (img.tmpBufferPath) {
                const binFile = zip.file(img.tmpBufferPath);
                if (binFile) {
                    cleanImg.tmpBuffer = await binFile.async('arraybuffer');
                }
            }
            delete cleanImg.tmpBufferPath;
            const src = (await extractAssetAsDataOrBlobUrl(img.src, true)) || img.src;
            const originalSrc = (await extractAssetAsDataOrBlobUrl(img.originalSrc, true)) || src;
            return {
                ...cleanImg,
                id: `img-${now}-${idx}-${Math.floor(Math.random() * 1000)}`,
                src,
                originalSrc,
                sceneGroupId: newGroupId,
                sceneGroupName: groupName,
                sceneGroupMoveTogether: moveTogether,
            } as CanvasImage;
        })
    );

    return {
        groupName,
        sceneGroupId: newGroupId,
        moveTogether,
        overlays: loadedOverlays,
        threeDObjects: loadedThreeD,
        images: loadedImages,
    };
}
