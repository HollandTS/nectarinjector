import type { ThreeDObject } from '../types';

/**
 * Converts a blob: URL (or http URL) to a base64 Data URL so that
 * saved .3dnectar files are 100% self-contained across sessions.
 * Leaves procedural:// URLs and existing data: URLs untouched.
 */
async function ensurePersistableUrl(url: string | undefined): Promise<string | undefined> {
    if (!url) return undefined;
    if (url.startsWith('procedural://') || url.startsWith('data:')) {
        return url;
    }
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Failed to convert blob to DataURL'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('Could not convert 3D asset URL to data URL, keeping original:', url, err);
        return url;
    }
}

/**
 * Converts a base64 Data URL back to a fast Object URL (blob:) for runtime rendering,
 * or leaves procedural:// and standard URLs as-is.
 */
async function restoreRuntimeUrl(url: string | undefined, isGlb: boolean = false): Promise<string | undefined> {
    if (!url) return undefined;
    if (url.startsWith('procedural://') || url.startsWith('blob:')) {
        return url;
    }
    if (url.startsWith('data:') && isGlb) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch {
            return url;
        }
    }
    return url;
}

/**
 * Serializes and downloads a ThreeDObject as a `.3dnectar` file,
 * matching the naming convention of `.nectarlayer` (`<templateName>+<objectName>.3dnectar`).
 */
export async function saveThreeDObjectToFile(
    obj: ThreeDObject,
    templateName?: string
): Promise<void> {
    const cliff = obj.cliffShapingSettings;
    const slope = obj.slopeShapingSettings;
    const [
        glbUrl,
        textureUrl,
        normalMapUrl,
        metallicMapUrl,
        roughnessMapUrl,
        displacementMapUrl,
        wallTextureUrl,
        wallNormalMapUrl,
        wallRoughnessMapUrl,
        wallDepthMapUrl,
        slopeTextureUrl,
        slopeNormalMapUrl,
        slopeRoughnessMapUrl,
        slopeDepthMapUrl,
    ] = await Promise.all([
        ensurePersistableUrl(obj.glbUrl),
        ensurePersistableUrl(obj.textureUrl),
        ensurePersistableUrl(obj.normalMapUrl),
        ensurePersistableUrl(obj.metallicMapUrl),
        ensurePersistableUrl(obj.roughnessMapUrl),
        ensurePersistableUrl(obj.displacementMapUrl),
        ensurePersistableUrl(cliff?.wallTextureUrl),
        ensurePersistableUrl(cliff?.wallNormalMapUrl),
        ensurePersistableUrl(cliff?.wallRoughnessMapUrl),
        ensurePersistableUrl(cliff?.wallDepthMapUrl),
        ensurePersistableUrl(slope?.slopeTextureUrl),
        ensurePersistableUrl(slope?.slopeNormalMapUrl),
        ensurePersistableUrl(slope?.slopeRoughnessMapUrl),
        ensurePersistableUrl(slope?.slopeDepthMapUrl),
    ]);

    const scatter = obj.surfaceScatterSettings;
    const persistedScatterItems = scatter?.items
        ? await Promise.all(
              scatter.items.map(async (it) => ({
                  ...it,
                  glbUrl: (await ensurePersistableUrl(it.glbUrl)) || it.glbUrl,
                  textureUrl: await ensurePersistableUrl(it.textureUrl),
              }))
          )
        : [];

    const exportObj: ThreeDObject = {
        ...obj,
        glbUrl: glbUrl || obj.glbUrl,
        textureUrl,
        normalMapUrl,
        metallicMapUrl,
        roughnessMapUrl,
        displacementMapUrl,
        position: { ...obj.position },
        rotation: { ...obj.rotation },
        scale: { ...obj.scale },
        textureSettings: obj.textureSettings ? { ...obj.textureSettings } : undefined,
        displacementSettings: obj.displacementSettings ? { ...obj.displacementSettings } : undefined,
        cliffShapingSettings: cliff
            ? {
                  ...cliff,
                  wallTextureUrl,
                  wallNormalMapUrl,
                  wallRoughnessMapUrl,
                  wallDepthMapUrl,
              }
            : undefined,
        slopeShapingSettings: slope
            ? {
                  ...slope,
                  slopeTextureUrl,
                  slopeNormalMapUrl,
                  slopeRoughnessMapUrl,
                  slopeDepthMapUrl,
              }
            : undefined,
        transitionSettings: obj.transitionSettings
            ? {
                  mainCliff: { ...obj.transitionSettings.mainCliff },
                  mainSlope: { ...obj.transitionSettings.mainSlope },
                  cliffSlope: { ...obj.transitionSettings.cliffSlope },
              }
            : undefined,
        surfaceScatterSettings: scatter
            ? {
                  ...scatter,
                  items: persistedScatterItems,
              }
            : undefined,
        shadowSettings: obj.shadowSettings ? { ...obj.shadowSettings } : undefined,
    };

    const json = JSON.stringify(exportObj, null, 2);
    const templateTitle = templateName && templateName.trim() ? templateName.trim() : 'project';
    const objNameSanitized = obj.name && obj.name.trim() ? obj.name.trim() : '3dobject';
    const fileName = `${templateTitle}+${objNameSanitized}.3dnectar`;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Parses a `.3dnectar` file and returns a ready-to-insert ThreeDObject with a fresh unique ID.
 */
export async function loadThreeDObjectFromFile(file: File): Promise<ThreeDObject> {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || !parsed.glbUrl || !parsed.name) {
        throw new Error('Invalid .3dnectar file structure.');
    }

    const cliff = parsed.cliffShapingSettings;
    const slope = parsed.slopeShapingSettings;
    const [
        glbUrl,
        textureUrl,
        normalMapUrl,
        metallicMapUrl,
        roughnessMapUrl,
        displacementMapUrl,
        wallTextureUrl,
        wallNormalMapUrl,
        wallRoughnessMapUrl,
        wallDepthMapUrl,
        slopeTextureUrl,
        slopeNormalMapUrl,
        slopeRoughnessMapUrl,
        slopeDepthMapUrl,
    ] = await Promise.all([
        restoreRuntimeUrl(parsed.glbUrl, true),
        restoreRuntimeUrl(parsed.textureUrl, false),
        restoreRuntimeUrl(parsed.normalMapUrl, false),
        restoreRuntimeUrl(parsed.metallicMapUrl, false),
        restoreRuntimeUrl(parsed.roughnessMapUrl, false),
        restoreRuntimeUrl(parsed.displacementMapUrl, false),
        restoreRuntimeUrl(cliff?.wallTextureUrl, false),
        restoreRuntimeUrl(cliff?.wallNormalMapUrl, false),
        restoreRuntimeUrl(cliff?.wallRoughnessMapUrl, false),
        restoreRuntimeUrl(cliff?.wallDepthMapUrl, false),
        restoreRuntimeUrl(slope?.slopeTextureUrl, false),
        restoreRuntimeUrl(slope?.slopeNormalMapUrl, false),
        restoreRuntimeUrl(slope?.slopeRoughnessMapUrl, false),
        restoreRuntimeUrl(slope?.slopeDepthMapUrl, false),
    ]);

    const parsedScatter = parsed.surfaceScatterSettings;
    const restoredScatterItems = parsedScatter?.items
        ? await Promise.all(
              parsedScatter.items.map(async (it: any) => ({
                  ...it,
                  glbUrl: (await restoreRuntimeUrl(it.glbUrl, true)) || it.glbUrl,
                  textureUrl: await restoreRuntimeUrl(it.textureUrl, false),
              }))
          )
        : [];

    const newId = `3d-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
        ...parsed,
        id: newId,
        glbUrl: glbUrl || parsed.glbUrl,
        textureUrl,
        normalMapUrl,
        metallicMapUrl,
        roughnessMapUrl,
        displacementMapUrl,
        position: parsed.position ? { ...parsed.position } : { x: 0, y: 0, z: 0 },
        rotation: parsed.rotation ? { ...parsed.rotation } : { x: 0, y: 0, z: 0 },
        scale: parsed.scale ? { ...parsed.scale } : { x: 1, y: 1, z: 1 },
        textureSettings: parsed.textureSettings ? { ...parsed.textureSettings } : undefined,
        displacementSettings: parsed.displacementSettings ? { ...parsed.displacementSettings } : undefined,
        cliffShapingSettings: cliff
            ? {
                  ...cliff,
                  wallTextureUrl,
                  wallNormalMapUrl,
                  wallRoughnessMapUrl,
                  wallDepthMapUrl,
              }
            : undefined,
        slopeShapingSettings: slope
            ? {
                  ...slope,
                  slopeTextureUrl,
                  slopeNormalMapUrl,
                  slopeRoughnessMapUrl,
                  slopeDepthMapUrl,
              }
            : undefined,
        transitionSettings: parsed.transitionSettings
            ? {
                  mainCliff: { ...parsed.transitionSettings.mainCliff },
                  mainSlope: { ...parsed.transitionSettings.mainSlope },
                  cliffSlope: { ...parsed.transitionSettings.cliffSlope },
              }
            : undefined,
        surfaceScatterSettings: parsedScatter
            ? {
                  ...parsedScatter,
                  items: restoredScatterItems,
              }
            : undefined,
        shadowSettings: parsed.shadowSettings ? { ...parsed.shadowSettings } : undefined,
    };
}

/**
 * Builds the partial ThreeDObject update payload to copy all PBR material maps,
 * texture settings, UV mapping, and optional displacement/cliff/slope settings from a source 3D object to a target 3D object.
 */
export function buildMaterialCopyPayload(
    sourceObj: ThreeDObject,
    includeDisplacement: boolean = true
): Partial<ThreeDObject> {
    const payload: Partial<ThreeDObject> = {
        textureUrl: sourceObj.textureUrl,
        normalMapUrl: sourceObj.normalMapUrl,
        metallicMapUrl: sourceObj.metallicMapUrl,
        roughnessMapUrl: sourceObj.roughnessMapUrl,
        textureOverlayId: sourceObj.textureOverlayId,
        uvMapping: sourceObj.uvMapping,
        textureSettings: sourceObj.textureSettings
            ? { ...sourceObj.textureSettings }
            : undefined,
        transitionSettings: sourceObj.transitionSettings
            ? {
                  mainCliff: { ...sourceObj.transitionSettings.mainCliff },
                  mainSlope: { ...sourceObj.transitionSettings.mainSlope },
                  cliffSlope: { ...sourceObj.transitionSettings.cliffSlope },
              }
            : undefined,
    };

    if (includeDisplacement) {
        payload.displacementMapUrl = sourceObj.displacementMapUrl;
        payload.displacementSettings = sourceObj.displacementSettings
            ? { ...sourceObj.displacementSettings }
            : undefined;
        payload.cliffShapingSettings = sourceObj.cliffShapingSettings
            ? { ...sourceObj.cliffShapingSettings }
            : undefined;
        payload.slopeShapingSettings = sourceObj.slopeShapingSettings
            ? { ...sourceObj.slopeShapingSettings }
            : undefined;
    }

    return payload;
}
