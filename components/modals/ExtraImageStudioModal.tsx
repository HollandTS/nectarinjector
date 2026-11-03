import React, { useState, useMemo } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { CanvasImage, ProjectOverlay, GridType } from '../../types';
import {
    bakeSmartExtraImageToTile,
    modifyTileExtraState,
    collectTileDiamondSpecs,
    ExtraBakeSourceMode,
} from '../../utils/extraImageBaker';
import { ExtraTemplatePreset } from '../../utils/extraImageTemplates';
import { ExtraZMode } from '../../utils/extraImageZHelper';
import { parseTmpFile } from '../../utils/westwoodTmpParser';
import { clearImageCache } from '../../utils/textureInjection';
import {
    OutsidePixelPreset,
    OutsidePixelPresetId,
} from '../../utils/extraOutsidePixelPresets';
import {
    applyOutsidePixelPresetToTile,
    OutsidePixelColorSource,
} from '../../utils/extraOutsidePixelBaker';
import { ExtraStudioSourceSection } from './extraStudio/ExtraStudioSourceSection';
import { ExtraStudioRadiusTemplatesSection } from './extraStudio/ExtraStudioRadiusTemplatesSection';
import { ExtraStudioOutsidePresetsSection } from './extraStudio/ExtraStudioOutsidePresetsSection';
import { ExtraStudioZOptionsSection } from './extraStudio/ExtraStudioZOptionsSection';
import {
    LucideX,
    LucideSparkles,
    LucideShieldCheck,
    LucideTrash2,
    LucideMaximize2,
} from 'lucide-react';

interface ExtraImageStudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: CanvasImage[];
    selectedImageIds: Set<string>;
    overlays: ProjectOverlay[];
    gridType: GridType;
    onCommitImages: (updatedImages: CanvasImage[]) => void;
}

export const ExtraImageStudioModal: React.FC<ExtraImageStudioModalProps> = ({
    isOpen,
    onClose,
    images,
    selectedImageIds,
    overlays,
    gridType,
    onCommitImages,
}) => {
    const [sourceMode, setSourceMode] = useState<ExtraBakeSourceMode>('3d_scene');
    const [specificOverlayId, setSpecificOverlayId] = useState<string>('');
    const [searchRadiusPx, setSearchRadiusPx] = useState<number>(12);
    const [isolateObjectsPerTile, setIsolateObjectsPerTile] = useState<boolean>(true);
    const [alsoBakeBaseDiamond, setAlsoBakeBaseDiamond] = useState<boolean>(true);
    const [includeShadowsInBase, setIncludeShadowsInBase] = useState<boolean>(false);
    const [preserveExistingExtra, setPreserveExistingExtra] = useState<boolean>(true);
    const [zMode, setZMode] = useState<ExtraZMode>('blit_cpp_gradient');
    const [customZValue, setCustomZValue] = useState<number>(23);
    const [onlySelected, setOnlySelected] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Outside Pixel Presets state
    const [outsideSpreadPx, setOutsideSpreadPx] = useState<number>(8);
    const [outsideColorSource, setOutsideColorSource] = useState<OutsidePixelColorSource>('tile_edge');
    const [outsideSeedOffset, setOutsideSeedOffset] = useState<number>(0);
    const [activeOutsidePresetId, setActiveOutsidePresetId] = useState<OutsidePixelPresetId | null>(null);
    const [selectedPoolIds, setSelectedPoolIds] = useState<Set<OutsidePixelPresetId>>(
        () => new Set<OutsidePixelPresetId>(['oval_spray_classic', 'oval_wide_cushion', 'oval_dense_core', 'oval_feathered_mist'])
    );

    const handleTogglePresetInPool = (id: OutsidePixelPresetId) => {
        setSelectedPoolIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectCategoryPresets = (categoryPresets: OutsidePixelPreset[]) => {
        setSelectedPoolIds((prev) => {
            const next = new Set(prev);
            const allIn = categoryPresets.every((p) => next.has(p.id));
            if (allIn) {
                for (const p of categoryPresets) next.delete(p.id);
            } else {
                for (const p of categoryPresets) next.add(p.id);
            }
            return next;
        });
    };

    const targetImages = useMemo(() => {
        if (onlySelected && selectedImageIds.size > 0) {
            return images.filter((img) => selectedImageIds.has(img.id));
        }
        return images;
    }, [images, selectedImageIds, onlySelected]);

    const tileStats = useMemo(() => {
        let withExtraCount = 0;
        let withZCount = 0;
        let sampleExtraDims = '';

        for (const img of targetImages) {
            if (img.tmpBuffer && img.tmpBuffer.byteLength >= 16) {
                try {
                    const parsed = parseTmpFile(img.tmpBuffer);
                    for (const t of parsed.tiles) {
                        if (!t) continue;
                        if (t.header.has_extra_data && t.header.cx_extra > 0 && t.header.cy_extra > 0) {
                            withExtraCount++;
                            if (!sampleExtraDims) {
                                sampleExtraDims = `${t.header.cx_extra}×${t.header.cy_extra}px @ (${t.header.x_extra}, ${t.header.y_extra})`;
                            }
                        }
                        if (t.header.has_z_data && t.zData) {
                            withZCount++;
                        }
                    }
                } catch {
                    // ignore
                }
            }
        }
        return { withExtraCount, withZCount, sampleExtraDims };
    }, [targetImages]);

    if (!isOpen) return null;

    const visible2DLayers = overlays.filter(
        (o) => !o.id.startsWith('3d-obj:') && o.id !== 'all-layers:composite'
    );

    const runBakeWithRadius = async (radius: number, labelPrefix?: string) => {
        if (targetImages.length === 0) return;
        setIsProcessing(true);
        setStatusMessage(null);
        clearImageCache();
        try {
            const targetIdSet = new Set(targetImages.map((i) => i.id));
            const allCanvasDiamonds = collectTileDiamondSpecs(images, gridType);
            const nextImages: CanvasImage[] = [];

            for (const img of images) {
                if (!targetIdSet.has(img.id)) {
                    nextImages.push(img);
                    continue;
                }
                const updated = await bakeSmartExtraImageToTile(
                    img,
                    {
                        sourceMode,
                        specificOverlayId: specificOverlayId || (visible2DLayers[0]?.id ?? null),
                        searchRadiusPx: radius,
                        isolateObjectsPerTile,
                        alsoBakeBaseDiamond,
                        includeShadowsInBase,
                        preserveExistingExtra,
                        zMode,
                        customZValue,
                    },
                    overlays,
                    gridType,
                    allCanvasDiamonds
                );
                nextImages.push(updated);
            }

            clearImageCache();
            onCommitImages(nextImages);
            setStatusMessage(
                labelPrefix
                    ? `${labelPrefix} (${radius}px scan) on ${targetImages.length} tile(s).`
                    : `Baked isolated objects & blit.cpp Z-Data onto ${targetImages.length} tile${targetImages.length > 1 ? 's' : ''}!`
            );
        } catch (err: any) {
            setStatusMessage(`Error: ${err?.message || 'Failed to bake extra image'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApplyPresetBake = async (preset: ExtraTemplatePreset) => {
        const scanRad = Math.min(48, Math.max(4, Math.round((preset.padLeft + preset.padRight) / 2)));
        setSearchRadiusPx(scanRad);
        await runBakeWithRadius(scanRad, `Applied "${preset.name}"`);
    };

    const runOutsidePresetOrPool = async (
        presetOrPool: OutsidePixelPresetId | OutsidePixelPresetId[],
        statusLabel: string
    ) => {
        if (targetImages.length === 0) return;
        setIsProcessing(true);
        setStatusMessage(null);
        clearImageCache();
        try {
            const targetIdSet = new Set(targetImages.map((i) => i.id));
            const nextImages: CanvasImage[] = [];

            for (const img of images) {
                if (!targetIdSet.has(img.id)) {
                    nextImages.push(img);
                    continue;
                }
                const updated = await applyOutsidePixelPresetToTile(
                    img,
                    presetOrPool,
                    outsideSpreadPx,
                    outsideColorSource,
                    {
                        sourceMode,
                        specificOverlayId: specificOverlayId || (visible2DLayers[0]?.id ?? null),
                        searchRadiusPx,
                        isolateObjectsPerTile,
                        alsoBakeBaseDiamond,
                        includeShadowsInBase,
                        preserveExistingExtra,
                        zMode,
                        customZValue,
                    },
                    overlays,
                    gridType,
                    outsideSeedOffset,
                    false
                );
                nextImages.push(updated);
            }

            clearImageCache();
            onCommitImages(nextImages);
            setStatusMessage(statusLabel);
        } catch (err: any) {
            setStatusMessage(`Error: ${err?.message || 'Failed to apply outside pixel preset'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApplyOutsidePreset = async (preset: OutsidePixelPreset) => {
        setActiveOutsidePresetId(preset.id);
        await runOutsidePresetOrPool(
            preset.id,
            `Applied "${preset.name}" (${outsideSpreadPx}px spread) onto ${targetImages.length} tile(s).`
        );
    };

    const handleApplyRandomizedPool = async () => {
        const poolArray = Array.from(selectedPoolIds);
        if (poolArray.length === 0) return;
        await runOutsidePresetOrPool(
            poolArray,
            `Randomized ${poolArray.length} picked preset(s) (${outsideSpreadPx}px spread) across ${targetImages.length} tile(s)!`
        );
    };

    const handleModifyZOrExtra = async (action: 'repair_z' | 'remove_extra') => {
        if (targetImages.length === 0) return;
        setIsProcessing(true);
        setStatusMessage(null);
        clearImageCache();
        try {
            const targetIdSet = new Set(targetImages.map((i) => i.id));
            const nextImages: CanvasImage[] = [];

            for (const img of images) {
                if (!targetIdSet.has(img.id)) {
                    nextImages.push(img);
                    continue;
                }
                const updated = await modifyTileExtraState(img, action, gridType);
                nextImages.push(updated);
            }

            clearImageCache();
            onCommitImages(nextImages);
            if (action === 'remove_extra') {
                setActiveOutsidePresetId(null);
            }
            setStatusMessage(
                action === 'repair_z'
                    ? `Repaired Z-Data using blit.cpp gradient on ${targetImages.length} tile(s).`
                    : `Removed Extra Image data from ${targetImages.length} tile(s).`
            );
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <DraggableContainer
            initialPos={{ x: Math.max(120, Math.round(window.innerWidth / 2 - 230)), y: 60 }}
            className="w-[460px] bg-[#141921]/98 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl z-[2600] overflow-hidden flex flex-col text-slate-200"
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-900/90 drag-handle cursor-move select-none">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <LucideMaximize2 className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-white">
                            Extra-Image &amp; Z-Data Baker
                        </h2>
                        <p className="text-[10px] text-slate-400">
                            Per-Object Isolation, Outside Pixel Presets &amp; blit.cpp Z-Buffer
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                    <LucideX className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 text-xs">
                <div className="bg-black/40 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                            Target Tiles: {targetImages.length} {onlySelected && selectedImageIds.size > 0 ? '(Selected)' : '(All Loaded)'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                            ExtraData: {tileStats.withExtraCount} · Z-Buffer: {tileStats.withZCount}
                            {tileStats.sampleExtraDims ? ` · [${tileStats.sampleExtraDims}]` : ''}
                        </div>
                    </div>
                    <label className="flex items-center space-x-1.5 text-[10px] font-bold uppercase text-slate-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={onlySelected}
                            onChange={(e) => setOnlySelected(e.target.checked)}
                            className="rounded accent-emerald-500"
                        />
                        <span>Selected Only</span>
                    </label>
                </div>

                {/* Outside Pixel Presets */}
                <ExtraStudioOutsidePresetsSection
                    spreadPx={outsideSpreadPx}
                    setSpreadPx={setOutsideSpreadPx}
                    colorSource={outsideColorSource}
                    setColorSource={setOutsideColorSource}
                    seedOffset={outsideSeedOffset}
                    setSeedOffset={setOutsideSeedOffset}
                    activePresetId={activeOutsidePresetId}
                    selectedPoolIds={selectedPoolIds}
                    onTogglePresetInPool={handleTogglePresetInPool}
                    onSelectCategoryPresets={handleSelectCategoryPresets}
                    onClearPool={() => setSelectedPoolIds(new Set())}
                    disabled={isProcessing || targetImages.length === 0}
                    onApplyOutsidePreset={handleApplyOutsidePreset}
                    onApplyRandomizedPool={handleApplyRandomizedPool}
                />

                <ExtraStudioSourceSection
                    sourceMode={sourceMode}
                    setSourceMode={setSourceMode}
                    specificOverlayId={specificOverlayId}
                    setSpecificOverlayId={setSpecificOverlayId}
                    visible2DLayers={visible2DLayers}
                />

                <ExtraStudioRadiusTemplatesSection
                    searchRadiusPx={searchRadiusPx}
                    setSearchRadiusPx={setSearchRadiusPx}
                    disabled={isProcessing || targetImages.length === 0}
                    onApplyPresetBake={handleApplyPresetBake}
                />

                <ExtraStudioZOptionsSection
                    zMode={zMode}
                    setZMode={setZMode}
                    customZValue={customZValue}
                    setCustomZValue={setCustomZValue}
                    isolateObjectsPerTile={isolateObjectsPerTile}
                    setIsolateObjectsPerTile={setIsolateObjectsPerTile}
                    alsoBakeBaseDiamond={alsoBakeBaseDiamond}
                    setAlsoBakeBaseDiamond={setAlsoBakeBaseDiamond}
                    includeShadowsInBase={includeShadowsInBase}
                    setIncludeShadowsInBase={setIncludeShadowsInBase}
                    preserveExistingExtra={preserveExistingExtra}
                    setPreserveExistingExtra={setPreserveExistingExtra}
                />

                <div className="space-y-2 pt-1">
                    <button
                        type="button"
                        disabled={isProcessing || targetImages.length === 0}
                        onClick={() => runBakeWithRadius(searchRadiusPx)}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                        <LucideSparkles className="w-4 h-4" />
                        <span>
                            {isProcessing
                                ? 'Isolating Objects & Baking Extra Image...'
                                : `Smart Bake into Extra Image (${targetImages.length} Tile${targetImages.length === 1 ? '' : 's'})`}
                        </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={isProcessing || targetImages.length === 0}
                            onClick={() => handleModifyZOrExtra('repair_z')}
                            className="py-2 px-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/40 text-amber-300 hover:text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                            title="Repairs base ZData & ExtraZData using blit.cpp bottom-up fractional Z gradient"
                        >
                            <LucideShieldCheck className="w-3.5 h-3.5" />
                            <span>Auto-Fix Z-Data</span>
                        </button>
                        <button
                            type="button"
                            disabled={isProcessing || targetImages.length === 0}
                            onClick={() => handleModifyZOrExtra('remove_extra')}
                            className="py-2 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-red-300 hover:text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                            title="Strips ExtraImageData & ExtraZData back to just the 1x1 base diamond"
                        >
                            <LucideTrash2 className="w-3.5 h-3.5" />
                            <span>Clear Extra Image</span>
                        </button>
                    </div>
                </div>

                {statusMessage && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[10px] font-bold text-center">
                        {statusMessage}
                    </div>
                )}
            </div>
        </DraggableContainer>
    );
};
