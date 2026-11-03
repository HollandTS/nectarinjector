import React from 'react';
import type { ProjectOverlay, AdditionalTexture } from '../../../types';
import { FilterSlider } from '../../ui/FilterSlider';
import { CollapsibleSection } from './CollapsibleSection';
import {
    LucideSparkles,
    LucideImage,
    LucideLoader2,
    LucideDownload,
    LucideSettings,
    LucideTrash2,
    LucideGrid,
    LucidePalette,
} from 'lucide-react';
import { splitTextureInFour } from '../../../utils/textureSplitter';
import {
    splitAllTexturesInFour,
    autoMatchAllAdditionalTextures,
    applyCanvasZoomToAllTextures,
} from '../../../utils/additionalTexturesBatchHelper';

interface AdditionalTexturesControlsProps {
    ov: ProjectOverlay;
    updateFilter: (id: string, key: string, val: any) => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, shouldPushHistory?: boolean) => void;
    showAdditionalTextures: string | null;
    setShowAdditionalTextures: (id: string | null) => void;
    handleFileBrowse: (id: string) => void;
    onAiGenerateTexture: (id: string) => void;
    isAiGenerating: string | null;
    openTextureSettings: { overlayId: string; textureIdx: number } | null;
    setOpenTextureSettings: (v: { overlayId: string; textureIdx: number } | null) => void;
}

export const AdditionalTexturesControls: React.FC<AdditionalTexturesControlsProps> = ({
    ov,
    updateFilter,
    onUpdateOverlay,
    handleFileBrowse,
    onAiGenerateTexture,
    isAiGenerating,
    openTextureSettings,
    setOpenTextureSettings,
}) => {
    const f = ov.filters;
    const [isSplitting, setIsSplitting] = React.useState(false);
    const [isSplittingAll, setIsSplittingAll] = React.useState(false);
    const [isAutoMatchingAll, setIsAutoMatchingAll] = React.useState(false);
    const [localUndoStack, setLocalUndoStack] = React.useState<
        Array<{ src?: string; canvasZoom: number; additionalTextures: AdditionalTexture[] }>
    >([]);

    const hasAdditionalTextures = f.additionalTextures && f.additionalTextures.length > 0;

    const saveSnapshotForUndo = () => {
        setLocalUndoStack((prev) => [
            ...prev.slice(-14),
            {
                src: ov.src,
                canvasZoom: f.canvasZoom || 100,
                additionalTextures: (f.additionalTextures || []).map((t) => ({
                    ...t,
                    filters: t.filters ? { ...t.filters } : {},
                })),
            },
        ]);
    };

    const handleLocalUndo = () => {
        if (localUndoStack.length === 0) return;
        const last = localUndoStack[localUndoStack.length - 1];
        setLocalUndoStack((prev) => prev.slice(0, -1));
        onUpdateOverlay(
            ov.id,
            {
                ...(last.src !== undefined ? { src: last.src } : {}),
                filters: {
                    ...ov.filters,
                    canvasZoom: last.canvasZoom,
                    additionalTextures: last.additionalTextures,
                },
            },
            true
        );
    };

    const handleSplitInFour = async () => {
        if (!ov.src) return;
        setIsSplitting(true);
        try {
            const result = await splitTextureInFour(ov.src);
            if (!result) return;

            saveSnapshotForUndo();

            const newAdditionalTextures: AdditionalTexture[] = result.additionalCuts.map((cutSrc, idx) => ({
                id: `tex-${Date.now()}-${idx}`,
                src: cutSrc,
                weight: 50,
                canvasZoom: f.canvasZoom || 100,
                filters: {},
            }));

            const updatedList = [...(f.additionalTextures || []), ...newAdditionalTextures];

            onUpdateOverlay(
                ov.id,
                {
                    src: result.primaryCut,
                    filters: {
                        ...ov.filters,
                        additionalTextures: updatedList,
                    },
                },
                true
            );
        } catch (err) {
            console.error('Failed to split texture in 4:', err);
        } finally {
            setIsSplitting(false);
        }
    };

    const handleSplitAllInFour = async () => {
        if (!ov.src) return;
        setIsSplittingAll(true);
        try {
            const result = await splitAllTexturesInFour(ov);
            if (!result) return;

            saveSnapshotForUndo();

            onUpdateOverlay(
                ov.id,
                {
                    src: result.newMainSrc,
                    filters: {
                        ...ov.filters,
                        additionalTextures: result.newAdditionalTextures,
                    },
                },
                true
            );
        } catch (err) {
            console.error('Failed to split all textures in 4:', err);
        } finally {
            setIsSplittingAll(false);
        }
    };

    const handleAutoMatchAllColors = async () => {
        if (!hasAdditionalTextures || !ov.src) return;
        setIsAutoMatchingAll(true);
        try {
            const updatedList = await autoMatchAllAdditionalTextures(ov);
            if (updatedList) {
                saveSnapshotForUndo();
                onUpdateOverlay(
                    ov.id,
                    {
                        filters: {
                            ...ov.filters,
                            additionalTextures: updatedList,
                        },
                    },
                    true
                );
            }
        } catch (err) {
            console.error('Failed to auto-match all colors:', err);
        } finally {
            setIsAutoMatchingAll(false);
        }
    };

    const handleCanvasZoomAll = (zoomVal: number) => {
        const { canvasZoom, additionalTextures } = applyCanvasZoomToAllTextures(ov, zoomVal);
        onUpdateOverlay(ov.id, {
            filters: {
                ...ov.filters,
                canvasZoom,
                additionalTextures,
            },
        });
    };

    return (
        <CollapsibleSection
            title="Add Additional Textures"
            titleColorClass="text-purple-400"
            defaultExpanded={hasAdditionalTextures}
            badge={
                hasAdditionalTextures ? (
                    <span className="text-[10px] px-1.5 py-0.2 bg-purple-900/60 border border-purple-500/40 text-purple-300 rounded-full font-mono">
                        {f.additionalTextures.length}
                    </span>
                ) : undefined
            }
        >
            <div className="space-y-3 p-2 bg-black/40 rounded-xl border border-slate-700/60">
                    {/* Top Action Buttons */}
                    <div className="flex items-center flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleFileBrowse(ov.id)}
                            className="flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 py-1.5 px-2.5 rounded-lg border border-slate-700 text-[10px] font-black uppercase text-slate-300 transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Browse image files to add as additional textures"
                        >
                            <LucideImage className="w-3.5 h-3.5" />
                            <span>Browse</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSplitInFour}
                            disabled={isSplitting || isSplittingAll || !ov.src}
                            className="flex items-center justify-center space-x-1 bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-700/60 hover:border-indigo-500 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase text-indigo-300 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Cut main layer image in 4: replace layer image with 1st cut, and add other 3 to additional matching textures"
                        >
                            {isSplitting ? (
                                <LucideLoader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            ) : (
                                <LucideGrid className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                            <span>{isSplitting ? 'Splitting...' : 'Split in 4'}</span>
                        </button>
                        {hasAdditionalTextures && (
                            <button
                                type="button"
                                onClick={handleSplitAllInFour}
                                disabled={isSplittingAll || isSplitting || !ov.src}
                                className="flex items-center justify-center space-x-1 bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700/60 hover:border-purple-500 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase text-purple-300 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                                title="Split the main image AND all additional matching textures in 4 each"
                            >
                                {isSplittingAll ? (
                                    <LucideLoader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                                ) : (
                                    <LucideGrid className="w-3.5 h-3.5 text-purple-400" />
                                )}
                                <span>{isSplittingAll ? 'Splitting All...' : 'Split All in 4'}</span>
                            </button>
                        )}
                        {hasAdditionalTextures && (
                            <button
                                type="button"
                                onClick={handleAutoMatchAllColors}
                                disabled={isAutoMatchingAll || !ov.src}
                                className="flex items-center justify-center space-x-1 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/60 hover:border-emerald-500 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase text-emerald-300 transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
                                title="Auto-match the colors (Hue, Saturation, Brightness) of all additional textures to the main layer texture"
                            >
                                {isAutoMatchingAll ? (
                                    <LucideLoader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                    <LucidePalette className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                                <span>{isAutoMatchingAll ? 'Matching...' : 'Auto-Match All Colors'}</span>
                            </button>
                        )}
                        {localUndoStack.length > 0 && (
                            <button
                                type="button"
                                onClick={handleLocalUndo}
                                className="flex items-center justify-center space-x-1 bg-amber-950/70 hover:bg-amber-900/80 border border-amber-700/60 hover:border-amber-500 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase text-amber-300 transition-all shadow-xs active:scale-95 cursor-pointer"
                                title="Undo last additional texture change (Split / Auto-Match / Zoom All)"
                            >
                                <span>Undo ({localUndoStack.length})</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onAiGenerateTexture(ov.id)}
                            disabled={isAiGenerating === ov.id}
                            className="flex-1 min-w-[140px] flex items-center justify-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 py-1.5 px-2 rounded-lg border border-cyan-400/30 text-[10px] font-black uppercase text-white transition-all shadow-md cursor-pointer active:scale-95"
                        >
                            {isAiGenerating === ov.id ? (
                                <LucideLoader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <LucideSparkles className="w-3.5 h-3.5" />
                            )}
                            <span>AI generate similar texture</span>
                        </button>
                    </div>

                    {/* Global Canvas Zoom All Slider (appears when additional textures exist) */}
                    {hasAdditionalTextures && (
                        <div className="p-2 bg-slate-900/70 rounded-lg border border-cyan-500/30">
                            <FilterSlider
                                label="Canvas Zoom All"
                                min={10}
                                max={800}
                                value={f.canvasZoom || 100}
                                defaultValue={100}
                                onStartChange={() => {
                                    saveSnapshotForUndo();
                                    onUpdateOverlay(ov.id, {}, true);
                                }}
                                onChange={handleCanvasZoomAll}
                            />
                        </div>
                    )}

                    {/* Additional Textures Grid */}
                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-hide">
                        {f.additionalTextures.map((tex, tIdx) => (
                            <div
                                key={tex.id || tIdx}
                                className="relative group bg-black/40 rounded-lg border border-slate-700 p-1.5 flex flex-col space-y-1"
                            >
                                <div className="relative aspect-square rounded overflow-hidden border border-slate-800">
                                    <img
                                        src={tex.src}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1 p-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = tex.src;
                                                link.download = `texture_${tIdx}.png`;
                                                link.click();
                                            }}
                                            className="p-1.5 bg-slate-800 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 shadow-lg cursor-pointer"
                                        >
                                            <LucideDownload size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenTextureSettings(
                                                    openTextureSettings?.textureIdx === tIdx
                                                        ? null
                                                        : { overlayId: ov.id, textureIdx: tIdx }
                                                );
                                            }}
                                            className={`p-1.5 rounded-full transition-all shadow-lg cursor-pointer ${
                                                openTextureSettings?.textureIdx === tIdx
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                                            }`}
                                        >
                                            <LucideSettings size={12} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                saveSnapshotForUndo();
                                                const next = f.additionalTextures.filter((_, i) => i !== tIdx);
                                                onUpdateOverlay(
                                                    ov.id,
                                                    {
                                                        filters: {
                                                            ...ov.filters,
                                                            additionalTextures: next,
                                                        },
                                                    },
                                                    true
                                                );
                                            }}
                                            className="p-1.5 bg-red-900/40 rounded-full text-red-400 hover:text-red-300 hover:bg-red-900/60 shadow-lg cursor-pointer"
                                        >
                                            <LucideTrash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                <FilterSlider
                                    label="Freq"
                                    min={0}
                                    max={100}
                                    value={tex.weight}
                                    defaultValue={50}
                                    onStartChange={() => {
                                        saveSnapshotForUndo();
                                        onUpdateOverlay(ov.id, {}, true);
                                    }}
                                    onChange={(v) => {
                                        const next = f.additionalTextures.map((t, i) =>
                                            i === tIdx ? { ...t, weight: v } : t
                                        );
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }}
                                />
                                <FilterSlider
                                    label="C-Zoom"
                                    min={10}
                                    max={800}
                                    value={tex.canvasZoom || 100}
                                    defaultValue={100}
                                    onStartChange={() => {
                                        saveSnapshotForUndo();
                                        onUpdateOverlay(ov.id, {}, true);
                                    }}
                                    onChange={(v) => {
                                        const next = f.additionalTextures.map((t, i) =>
                                            i === tIdx ? { ...t, canvasZoom: v } : t
                                        );
                                        updateFilter(ov.id, 'additionalTextures', next);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
            </div>
        </CollapsibleSection>
    );
};
