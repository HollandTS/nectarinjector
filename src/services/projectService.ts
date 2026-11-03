import JSZip from 'jszip';

import type { CanvasImage, ProjectOverlay, ThreeDObject, GridType, ActiveGridType, TransitionStamp } from '../../types';
import type { PaletteColor } from '../../utils/westwoodPaletteParser';
import { parsePalFile } from '../../utils/westwoodPaletteParser';
import { serializePaletteToJasc } from '../../utils/projectPaletteHelper';

export interface ProjectData {
    version: string;
    name?: string;
    images: CanvasImage[];
    overlays: ProjectOverlay[];
    threeDObjects: ThreeDObject[];
    stamps?: TransitionStamp[];
    gridType: GridType;
    lastActiveGrid?: ActiveGridType;
    transparencyColor: string;
    tolerance: number;
    zoom: number;
    overlayOpacity: number;
    overlayLayer: 'front' | 'back';
    palette?: PaletteColor[];
    timestamp: number;
}

export const saveProject = async (data: ProjectData) => {
    const zip = new JSZip();
    const projectData = { ...data, images: [] as any[], overlays: [] as any[], threeDObjects: [] as any[] };

    const addAssetToZip = async (url: string | undefined, folder: string, id: string) => {
        if (!url) return null;
        if (
            url.startsWith('procedural://') ||
            url.startsWith('3d-obj:') ||
            url.startsWith('all-layers:')
        ) {
            return url;
        }
        if (url.startsWith('http') && !url.includes(window.location.host)) return url; // Keep external URLs
        
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
            
            const ext = blob.type.split('/')[1] || 'png';
            const filename = `${folder}/${id}.${ext}`;
            zip.file(filename, blob);
            return filename;
        } catch (e) {
            console.error(`Failed to bundle asset: ${url}`, e);
            return url;
        }
    };

    for (const img of data.images) {
        const path = await addAssetToZip(img.src, 'images', img.id);
        
        let tmpBufferPath: string | undefined = undefined;
        let cleanTmpBuffer = img.tmpBuffer;
        if (cleanTmpBuffer && !(cleanTmpBuffer instanceof ArrayBuffer) && (cleanTmpBuffer as any).buffer instanceof ArrayBuffer) {
            cleanTmpBuffer = (cleanTmpBuffer as any).buffer;
        }
        if (cleanTmpBuffer && cleanTmpBuffer instanceof ArrayBuffer && cleanTmpBuffer.byteLength > 0) {
            const filename = `tmp_buffers/${img.id}.bin`;
            zip.file(filename, cleanTmpBuffer);
            tmpBufferPath = filename;
        }
        
        const { tmpBuffer, ...cleanImg } = img;
        projectData.images.push({ ...cleanImg, src: path, tmpBufferPath });
    }

    for (const ov of data.overlays) {
        if (ov.id.startsWith('3d-obj:') || ov.id.startsWith('all-layers:') || ov.src?.startsWith('3d-obj:') || ov.src?.startsWith('all-layers:')) {
            projectData.overlays.push({ ...ov });
            continue;
        }
        const path = await addAssetToZip(ov.src ?? undefined, 'overlays', ov.id);
        let savedFilters = ov.filters ? { ...ov.filters } : ov.filters;
        if (savedFilters) {
            if (savedFilters.additionalTextures && savedFilters.additionalTextures.length > 0) {
                savedFilters.additionalTextures = await Promise.all(
                    savedFilters.additionalTextures.map(async (tex, idx) => ({
                        ...tex,
                        src: (await addAssetToZip(tex.src, 'overlays', `${ov.id}_addtex_${idx}`)) || tex.src,
                    }))
                );
            }
            if (savedFilters.brushes && savedFilters.brushes.length > 0) {
                savedFilters.brushes = await Promise.all(
                    savedFilters.brushes.map(async (b, idx) => ({
                        ...b,
                        src: (await addAssetToZip(b.src, 'overlays', `${ov.id}_brush_${idx}`)) || b.src,
                    }))
                );
            }
            if (savedFilters.customStampSrc) {
                savedFilters.customStampSrc =
                    (await addAssetToZip(savedFilters.customStampSrc, 'overlays', `${ov.id}_customstamp`)) ||
                    savedFilters.customStampSrc;
            }
        }
        let savedBackup = ov.originalTiledBackup ? { ...ov.originalTiledBackup } : undefined;
        if (savedBackup && savedBackup.src) {
            savedBackup.src = (await addAssetToZip(savedBackup.src, 'overlays', `${ov.id}_tiledbackup`)) || savedBackup.src;
        }
        projectData.overlays.push({ ...ov, src: path, filters: savedFilters, originalTiledBackup: savedBackup });
    }

    for (const obj of data.threeDObjects) {
        const path = await addAssetToZip(obj.glbUrl, 'models', obj.id);
        const textureUrl = obj.textureUrl ? (await addAssetToZip(obj.textureUrl, 'models', `${obj.id}_diffuse`)) || undefined : undefined;
        const normalMapUrl = obj.normalMapUrl ? (await addAssetToZip(obj.normalMapUrl, 'models', `${obj.id}_normal`)) || undefined : undefined;
        const metallicMapUrl = obj.metallicMapUrl ? (await addAssetToZip(obj.metallicMapUrl, 'models', `${obj.id}_metallic`)) || undefined : undefined;
        const roughnessMapUrl = obj.roughnessMapUrl ? (await addAssetToZip(obj.roughnessMapUrl, 'models', `${obj.id}_roughness`)) || undefined : undefined;
        const displacementMapUrl = obj.displacementMapUrl ? (await addAssetToZip(obj.displacementMapUrl, 'models', `${obj.id}_displacement`)) || undefined : undefined;

        let cliffShapingSettings = obj.cliffShapingSettings ? { ...obj.cliffShapingSettings } : undefined;
        if (cliffShapingSettings) {
            cliffShapingSettings.wallTextureUrl = cliffShapingSettings.wallTextureUrl
                ? (await addAssetToZip(cliffShapingSettings.wallTextureUrl, 'models', `${obj.id}_wall_diffuse`)) || undefined
                : undefined;
            cliffShapingSettings.wallNormalMapUrl = cliffShapingSettings.wallNormalMapUrl
                ? (await addAssetToZip(cliffShapingSettings.wallNormalMapUrl, 'models', `${obj.id}_wall_normal`)) || undefined
                : undefined;
            cliffShapingSettings.wallRoughnessMapUrl = cliffShapingSettings.wallRoughnessMapUrl
                ? (await addAssetToZip(cliffShapingSettings.wallRoughnessMapUrl, 'models', `${obj.id}_wall_roughness`)) || undefined
                : undefined;
            cliffShapingSettings.wallDepthMapUrl = cliffShapingSettings.wallDepthMapUrl
                ? (await addAssetToZip(cliffShapingSettings.wallDepthMapUrl, 'models', `${obj.id}_wall_depth`)) || undefined
                : undefined;
        }

        let slopeShapingSettings = obj.slopeShapingSettings ? { ...obj.slopeShapingSettings } : undefined;
        if (slopeShapingSettings) {
            slopeShapingSettings.slopeTextureUrl = slopeShapingSettings.slopeTextureUrl
                ? (await addAssetToZip(slopeShapingSettings.slopeTextureUrl, 'models', `${obj.id}_slope_diffuse`)) || undefined
                : undefined;
            slopeShapingSettings.slopeNormalMapUrl = slopeShapingSettings.slopeNormalMapUrl
                ? (await addAssetToZip(slopeShapingSettings.slopeNormalMapUrl, 'models', `${obj.id}_slope_normal`)) || undefined
                : undefined;
            slopeShapingSettings.slopeRoughnessMapUrl = slopeShapingSettings.slopeRoughnessMapUrl
                ? (await addAssetToZip(slopeShapingSettings.slopeRoughnessMapUrl, 'models', `${obj.id}_slope_roughness`)) || undefined
                : undefined;
            slopeShapingSettings.slopeDepthMapUrl = slopeShapingSettings.slopeDepthMapUrl
                ? (await addAssetToZip(slopeShapingSettings.slopeDepthMapUrl, 'models', `${obj.id}_slope_depth`)) || undefined
                : undefined;
        }

        projectData.threeDObjects.push({
            ...obj,
            glbUrl: path,
            textureUrl,
            normalMapUrl,
            metallicMapUrl,
            roughnessMapUrl,
            displacementMapUrl,
            cliffShapingSettings,
            slopeShapingSettings,
        });
    }

    if (data.palette && data.palette.length > 0) {
        projectData.palette = data.palette;
        try {
            const jascPal = serializePaletteToJasc(data.palette);
            zip.file("palette.pal", jascPal);
        } catch (e) {
            console.warn("Failed to serialize palette.pal:", e);
        }
    }

    zip.file("project.json", JSON.stringify(projectData, null, 2));
    return await zip.generateAsync({ type: "blob" });
};

export const loadProject = async (file: File) => {
    const zip = await JSZip.loadAsync(file);
    const projectJson = await zip.file("project.json")?.async("string");
    if (!projectJson) throw new Error("Invalid project file: project.json missing.");
    
    const project = JSON.parse(projectJson);

    const extractAsset = async (path: string | undefined) => {
        if (
            !path ||
            path.startsWith('http') ||
            path.startsWith('data:') ||
            path.startsWith('procedural://') ||
            path.startsWith('3d-obj:') ||
            path.startsWith('all-layers:')
        ) {
            return path;
        }
        const file = zip.file(path);
        if (!file) return path;
        const blob = await file.async("blob");
        return URL.createObjectURL(blob);
    };

    project.images = await Promise.all(project.images.map(async (img: any) => {
        const cleanImg = { ...img };
        if (img.tmpBufferPath) {
            const file = zip.file(img.tmpBufferPath);
            if (file) {
                cleanImg.tmpBuffer = await file.async("arraybuffer");
            }
        }
        delete cleanImg.tmpBufferPath;
        const extractedSrc = await extractAsset(img.src);
        return {
            ...cleanImg,
            src: extractedSrc,
            originalSrc: extractedSrc
        };
    }));

    project.overlays = await Promise.all(project.overlays.map(async (ov: any) => {
        const extractedSrc = await extractAsset(ov.src);
        let restoredFilters = ov.filters ? { ...ov.filters } : ov.filters;
        if (restoredFilters) {
            if (restoredFilters.additionalTextures && restoredFilters.additionalTextures.length > 0) {
                restoredFilters.additionalTextures = await Promise.all(
                    restoredFilters.additionalTextures.map(async (tex: any) => ({
                        ...tex,
                        src: await extractAsset(tex.src),
                    }))
                );
            }
            if (restoredFilters.brushes && restoredFilters.brushes.length > 0) {
                restoredFilters.brushes = await Promise.all(
                    restoredFilters.brushes.map(async (b: any) => ({
                        ...b,
                        src: await extractAsset(b.src),
                    }))
                );
            }
            if (restoredFilters.customStampSrc) {
                restoredFilters.customStampSrc = await extractAsset(restoredFilters.customStampSrc);
            }
        }
        let restoredBackup = ov.originalTiledBackup ? { ...ov.originalTiledBackup } : undefined;
        if (restoredBackup && restoredBackup.src) {
            restoredBackup.src = await extractAsset(restoredBackup.src);
        }
        return {
            ...ov,
            src: extractedSrc,
            filters: restoredFilters,
            originalTiledBackup: restoredBackup,
        };
    }));

    project.threeDObjects = await Promise.all((project.threeDObjects || []).map(async (obj: any) => {
        let cliffShapingSettings = obj.cliffShapingSettings ? { ...obj.cliffShapingSettings } : undefined;
        if (cliffShapingSettings) {
            cliffShapingSettings.wallTextureUrl = cliffShapingSettings.wallTextureUrl
                ? await extractAsset(cliffShapingSettings.wallTextureUrl)
                : undefined;
            cliffShapingSettings.wallNormalMapUrl = cliffShapingSettings.wallNormalMapUrl
                ? await extractAsset(cliffShapingSettings.wallNormalMapUrl)
                : undefined;
            cliffShapingSettings.wallRoughnessMapUrl = cliffShapingSettings.wallRoughnessMapUrl
                ? await extractAsset(cliffShapingSettings.wallRoughnessMapUrl)
                : undefined;
            cliffShapingSettings.wallDepthMapUrl = cliffShapingSettings.wallDepthMapUrl
                ? await extractAsset(cliffShapingSettings.wallDepthMapUrl)
                : undefined;
        }

        let slopeShapingSettings = obj.slopeShapingSettings ? { ...obj.slopeShapingSettings } : undefined;
        if (slopeShapingSettings) {
            slopeShapingSettings.slopeTextureUrl = slopeShapingSettings.slopeTextureUrl
                ? await extractAsset(slopeShapingSettings.slopeTextureUrl)
                : undefined;
            slopeShapingSettings.slopeNormalMapUrl = slopeShapingSettings.slopeNormalMapUrl
                ? await extractAsset(slopeShapingSettings.slopeNormalMapUrl)
                : undefined;
            slopeShapingSettings.slopeRoughnessMapUrl = slopeShapingSettings.slopeRoughnessMapUrl
                ? await extractAsset(slopeShapingSettings.slopeRoughnessMapUrl)
                : undefined;
            slopeShapingSettings.slopeDepthMapUrl = slopeShapingSettings.slopeDepthMapUrl
                ? await extractAsset(slopeShapingSettings.slopeDepthMapUrl)
                : undefined;
        }

        return {
            ...obj,
            glbUrl: await extractAsset(obj.glbUrl),
            textureUrl: obj.textureUrl ? await extractAsset(obj.textureUrl) : undefined,
            normalMapUrl: obj.normalMapUrl ? await extractAsset(obj.normalMapUrl) : undefined,
            metallicMapUrl: obj.metallicMapUrl ? await extractAsset(obj.metallicMapUrl) : undefined,
            roughnessMapUrl: obj.roughnessMapUrl ? await extractAsset(obj.roughnessMapUrl) : undefined,
            displacementMapUrl: obj.displacementMapUrl ? await extractAsset(obj.displacementMapUrl) : undefined,
            cliffShapingSettings,
            slopeShapingSettings,
        };
    }));

    // Extract palette if present in project.json or as .pal file in the zip
    if (!project.palette || project.palette.length === 0) {
        const palFile = zip.file("palette.pal") || Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.pal'));
        if (palFile) {
            try {
                const palBuf = await palFile.async("arraybuffer");
                project.palette = parsePalFile(palBuf);
            } catch (e) {
                console.warn("Failed to parse palette from zip:", e);
            }
        }
    }

    return project as ProjectData;
};

