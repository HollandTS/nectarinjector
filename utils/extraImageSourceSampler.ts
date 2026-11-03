import type { ProjectOverlay, GridType } from '../types';
import { renderThreeDObjectCrop, makeThreeDTargetId, renderIsolatedThreeDTileObjectsCrop } from './threeDInjectionUtils';
import { getFullOverlaySurface, getOverlayTileCrop } from './overlaySurfaceRenderer';
import { ExtraZMode } from './extraImageZHelper';
import type { TileDiamondSpec } from './threeDSceneCaptureHelper';
import { maskIsolated2DLayerObjects } from './twoDObjectIslandMasker';

export type ExtraBakeSourceMode = '3d_scene' | '2d_layers' | 'all_layers' | 'specific_layer';

export interface ExtraImageBakeOptions {
    sourceMode: ExtraBakeSourceMode;
    specificOverlayId?: string | null;
    searchRadiusPx: number;          // Object root scan radius around the 1x1 diamond
    alsoBakeBaseDiamond: boolean;    // Whether to also bake into the 1x1 base diamond
    preserveExistingExtra: boolean;  // Merge with existing cliff/slope extraImageData
    isolateObjectsPerTile?: boolean; // Scan & keep whole individual objects, mask out other objects & ground plane
    includeShadowsInBase?: boolean;  // Whether to blend 3D ground shadows onto the 1x1 base diamond
    zMode: ExtraZMode;
    customZValue?: number;
    alphaThreshold?: number;         // Default 140 for crisp, black-fringe-free silhouettes
}

async function sampleRaw2DLayersCanvas(
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
    options: ExtraImageBakeOptions,
    overlays: ProjectOverlay[],
    gridType: GridType
): Promise<HTMLCanvasElement | null> {
    if (options.sourceMode === 'specific_layer' && options.specificOverlayId) {
        const ov = overlays.find((o) => o.id === options.specificOverlayId);
        if (!ov) return null;
        const surface = await getFullOverlaySurface({ ...ov, isVisible: true }, gridType, overlays);
        if (!surface) return null;
        return getOverlayTileCrop(surface, cropX, cropY, cropW, cropH, ov.filters.renderMode);
    }

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cropW));
    out.height = Math.max(1, Math.round(cropH));
    const ctx = out.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;

    const visible2D = overlays.filter(
        (o) => o.isVisible && o.src && !o.id.startsWith('3d-obj:') && o.id !== 'all-layers:composite'
    );
    for (const ov of visible2D) {
        const surface = await getFullOverlaySurface(ov, gridType, overlays);
        if (!surface) continue;
        const crop = getOverlayTileCrop(surface, cropX, cropY, out.width, out.height, ov.filters.renderMode);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (ov.opacity ?? 100) / 100));
        ctx.drawImage(crop, 0, 0);
        ctx.restore();
    }
    return out;
}

/**
 * Samples the source region for either:
 * - `'base_diamond'`: Inside the 1x1 ground diamond (includes base terrain plane + matched objects)
 * - `'extra_objects_only'`: Outside the 1x1 diamond (isolates ONLY whole individual 3D/2D objects whose
 *   roots fall within `searchRadiusPx` of `targetDiamond`, masking out all other objects, flat ground planes,
 *   and black shadow planes).
 */
export async function sampleIsolatedSourceForTile(
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
    options: ExtraImageBakeOptions,
    overlays: ProjectOverlay[],
    gridType: GridType,
    targetDiamond: TileDiamondSpec,
    otherDiamonds: TileDiamondSpec[],
    passMode: 'base_diamond' | 'extra_objects_only'
): Promise<HTMLCanvasElement | null> {
    const isolate = options.isolateObjectsPerTile !== false;

    if (options.sourceMode === '3d_scene') {
        if (isolate) {
            const isolated = renderIsolatedThreeDTileObjectsCrop(
                {
                    targetDiamond,
                    otherDiamonds,
                    searchRadiusPx: options.searchRadiusPx,
                    mode: passMode,
                    includeShadowsInBase: options.includeShadowsInBase ?? false,
                },
                cropX,
                cropY,
                cropW,
                cropH
            );
            if (isolated) {
                return isolated.cropCanvas;
            }
        }
        return renderThreeDObjectCrop(makeThreeDTargetId('all'), cropX, cropY, cropW, cropH);
    }

    if (options.sourceMode === '2d_layers' || options.sourceMode === 'specific_layer') {
        const raw2D = await sampleRaw2DLayersCanvas(cropX, cropY, cropW, cropH, options, overlays, gridType);
        if (!raw2D) return null;
        if (!isolate || passMode === 'base_diamond') {
            return raw2D;
        }
        const ctx = raw2D.getContext('2d', { willReadFrequently: true })!;
        const imgData = ctx.getImageData(0, 0, raw2D.width, raw2D.height);
        const { maskedPixels } = maskIsolated2DLayerObjects(
            imgData.data,
            raw2D.width,
            raw2D.height,
            cropX,
            cropY,
            targetDiamond,
            otherDiamonds,
            options.searchRadiusPx,
            options.alphaThreshold ?? 120
        );
        const outData = new ImageData(new Uint8ClampedArray(maskedPixels), raw2D.width, raw2D.height);
        ctx.putImageData(outData, 0, 0);
        return raw2D;
    }

    // 'all_layers': combine isolated 2D layers + isolated 3D objects
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cropW));
    out.height = Math.max(1, Math.round(cropH));
    const outCtx = out.getContext('2d', { willReadFrequently: true })!;
    outCtx.imageSmoothingEnabled = false;

    const twoDPart = await sampleIsolatedSourceForTile(
        cropX,
        cropY,
        cropW,
        cropH,
        { ...options, sourceMode: '2d_layers' },
        overlays,
        gridType,
        targetDiamond,
        otherDiamonds,
        passMode
    );
    if (twoDPart) {
        outCtx.drawImage(twoDPart, 0, 0);
    }

    const threeDPart = await sampleIsolatedSourceForTile(
        cropX,
        cropY,
        cropW,
        cropH,
        { ...options, sourceMode: '3d_scene' },
        overlays,
        gridType,
        targetDiamond,
        otherDiamonds,
        passMode
    );
    if (threeDPart) {
        outCtx.drawImage(threeDPart, 0, 0);
    }

    return out;
}
