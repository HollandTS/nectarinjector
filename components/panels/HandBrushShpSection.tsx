import React, { useRef, useState } from 'react';
import type { HandBrushSettings } from '../../types';
import {
    loadFilesForShpHandBrush,
    buildShpBrushRenderUpdates,
    assignPaletteToMultipleShps,
} from '../../utils/shpBrushHelper';
import { FilterSlider } from '../ui/FilterSlider';
import { HandBrushShpLibraryList } from './HandBrushShpLibraryList';
import {
    LucideFileCode,
    LucidePalette,
    LucideChevronLeft,
    LucideChevronRight,
    LucideSunDim,
    LucideTrash2,
    LucideCheckCheck,
} from 'lucide-react';

interface HandBrushShpSectionProps {
    settings: HandBrushSettings;
    onUpdateSettings: (updates: Partial<HandBrushSettings>) => void;
}

export const HandBrushShpSection: React.FC<HandBrushShpSectionProps> = ({
    settings,
    onUpdateSettings,
}) => {
    const shpInputRef = useRef<HTMLInputElement>(null);
    const palInputRef = useRef<HTMLInputElement>(null);
    const [palTargetScope, setPalTargetScope] = useState<'selected' | 'all' | 'active'>('selected');
    const [statusError, setStatusError] = useState<string | null>(null);

    const handleShpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setStatusError(null);
        const res = await loadFilesForShpHandBrush(files, settings, palTargetScope);
        if (res.error) {
            setStatusError(res.error);
        } else if (Object.keys(res.updates).length > 0) {
            onUpdateSettings(res.updates);
        }
        if (shpInputRef.current) shpInputRef.current.value = '';
    };

    const handlePalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setStatusError(null);
        const res = await loadFilesForShpHandBrush(files, settings, palTargetScope);
        if (res.error) {
            setStatusError(res.error);
        } else if (Object.keys(res.updates).length > 0) {
            onUpdateSettings(res.updates);
        }
        if (palInputRef.current) palInputRef.current.value = '';
    };

    const handleOpenPalPickerForScope = (scope: 'selected' | 'all' | 'active') => {
        setPalTargetScope(scope);
        palInputRef.current?.click();
    };

    const handleApplyActivePalToMultiple = async (scope: 'selected' | 'all') => {
        if (!settings.shpCustomPalette) return;
        const res = await assignPaletteToMultipleShps(
            settings.shpCustomPalette,
            settings.shpCustomPaletteName ?? null,
            scope,
            settings
        );
        if (!res.error && Object.keys(res.updates).length > 0) {
            onUpdateSettings(res.updates);
        }
    };

    const handleChangeFrame = async (nextFrameIdx: number) => {
        if (!settings.shpBuffer || !settings.shpFileName) return;
        const maxFrames = Math.max(1, settings.shpNormalFrameCount || 1);
        const wrappedIdx = ((nextFrameIdx % maxFrames) + maxFrames) % maxFrames;
        const res = await buildShpBrushRenderUpdates(
            settings.shpBuffer,
            settings.shpFileName,
            wrappedIdx,
            settings.shpHasShadowHalf,
            settings.shpCustomPalette,
            settings.shpCustomPaletteName,
            {
                shadowEnabled: settings.shpShadowEnabled ?? true,
                shadowDarkness: settings.shpShadowDarkness ?? 55,
                shadowOffsetX: settings.shpShadowOffsetX ?? 0,
                shadowOffsetY: settings.shpShadowOffsetY ?? 0,
            },
            settings
        );
        if (!res.error) {
            onUpdateSettings(res.updates);
        }
    };

    const handleToggleShadowHalfMode = async (hasShadowHalf: boolean) => {
        if (!settings.shpBuffer || !settings.shpFileName) return;
        const res = await buildShpBrushRenderUpdates(
            settings.shpBuffer,
            settings.shpFileName,
            0,
            hasShadowHalf,
            settings.shpCustomPalette,
            settings.shpCustomPaletteName,
            {
                shadowEnabled: settings.shpShadowEnabled ?? true,
                shadowDarkness: settings.shpShadowDarkness ?? 55,
                shadowOffsetX: settings.shpShadowOffsetX ?? 0,
                shadowOffsetY: settings.shpShadowOffsetY ?? 0,
            },
            settings
        );
        if (!res.error) {
            onUpdateSettings(res.updates);
        }
    };

    const handleClearCustomShpPal = async () => {
        const res = await assignPaletteToMultipleShps(
            null,
            null,
            'active',
            settings
        );
        if (!res.error) {
            onUpdateSettings(res.updates);
        }
    };

    const normalFrameCount = settings.shpNormalFrameCount ?? 1;
    const totalFrames = settings.shpTotalFrames ?? 1;
    const currentFrameIndex = settings.shpFrameIndex ?? 0;
    const loadedCount = settings.loadedShpItems?.length ?? 0;
    const checkedCount = settings.selectedShpIds?.length ?? 0;

    return (
        <div className="bg-slate-900/80 rounded-xl border border-amber-500/30 p-2.5 space-y-2">
            {/* Hidden Inputs: allow ANY extension (.shp, .tem, .sno, .urb, .ubn, .des, .lun, etc.) + .pal */}
            <input
                type="file"
                ref={shpInputRef}
                multiple
                onChange={handleShpFileChange}
                className="hidden"
            />
            <input
                type="file"
                ref={palInputRef}
                accept=".pal"
                onChange={handlePalFileChange}
                className="hidden"
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                    <LucideFileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                        SHP Sprite Brush (Format 80)
                    </span>
                </div>
                {settings.isShpBrush && (
                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        {totalFrames} Frame{totalFrames === 1 ? '' : 's'}
                    </span>
                )}
            </div>

            {/* Load SHP & Multi-SHP .PAL Assignment Buttons */}
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => shpInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center space-x-1 bg-amber-600/80 hover:bg-amber-500 py-1.5 px-2 rounded-lg border border-amber-400/40 text-[10px] font-black uppercase text-white transition-all cursor-pointer shadow-sm"
                    title="Load one or more Format 80 .SHP files (any extension: .shp, .tem, .sno, .urb, .ubn, .des, .lun) and/or their .pal"
                >
                    <LucideFileCode className="w-3.5 h-3.5 shrink-0" />
                    <span>Load SHP (Any Ext)</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleOpenPalPickerForScope(loadedCount > 1 ? 'selected' : 'active')}
                    className="flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 py-1.5 px-2 rounded-lg border border-slate-700 text-[10px] font-black uppercase text-amber-200 hover:text-white transition-all cursor-pointer shrink-0"
                    title="Load a .pal file and assign it to all checked SHPs in the list (or the active SHP)"
                >
                    <LucidePalette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{loadedCount > 1 ? `PAL → Checked (${checkedCount || 1})` : 'Load .PAL'}</span>
                </button>

                {loadedCount > 1 && (
                    <button
                        type="button"
                        onClick={() => handleOpenPalPickerForScope('all')}
                        className="flex items-center justify-center space-x-1 bg-amber-950/70 hover:bg-amber-900 py-1.5 px-2 rounded-lg border border-amber-500/40 text-[9px] font-black uppercase text-amber-300 hover:text-white transition-all cursor-pointer shrink-0"
                        title="Load a .pal file and assign it to ALL loaded SHPs at once"
                    >
                        <LucideCheckCheck className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>PAL → All</span>
                    </button>
                )}
            </div>

            {/* Quick copy of already-loaded custom PAL to checked / all SHPs without re-picking file */}
            {loadedCount > 1 && settings.shpCustomPalette && settings.shpCustomPaletteName && (
                <div className="flex items-center justify-between gap-1.5 bg-amber-950/30 border border-amber-500/20 rounded-lg px-2 py-1">
                    <span className="text-[9px] text-amber-200 truncate font-mono">
                        Apply <strong>{settings.shpCustomPaletteName}</strong> to:
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleApplyActivePalToMultiple('selected')}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[8px] font-black uppercase text-cyan-300 cursor-pointer"
                            title="Assign this SHP's .pal to all checked SHPs in the list"
                        >
                            Checked ({checkedCount || 1})
                        </button>
                        <button
                            type="button"
                            onClick={() => handleApplyActivePalToMultiple('all')}
                            className="px-1.5 py-0.5 rounded bg-amber-700/70 hover:bg-amber-600 border border-amber-400/40 text-[8px] font-black uppercase text-white cursor-pointer"
                            title="Assign this SHP's .pal to every loaded SHP"
                        >
                            All ({loadedCount})
                        </button>
                    </div>
                </div>
            )}

            {statusError && (
                <div className="text-[9px] text-red-300 bg-red-950/60 border border-red-500/40 rounded px-2 py-1 font-bold">
                    {statusError}
                </div>
            )}

            {/* Remembered SHP Library + Random-Pick + Select All */}
            <HandBrushShpLibraryList
                settings={settings}
                onUpdateSettings={onUpdateSettings}
            />

            {settings.isShpBrush && (
                <div className="space-y-2 pt-1 border-t border-slate-800">
                    {/* Loaded SHP & Palette Info */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                        <span className="truncate font-mono text-slate-200" title={settings.shpFileName}>
                            Active: <strong>{settings.shpFileName}</strong>
                        </span>
                        <div className="flex items-center space-x-1 shrink-0">
                            <span className="text-amber-300 font-mono">
                                PAL: {settings.shpCustomPaletteName || 'Loaded Project PAL'}
                            </span>
                            {settings.shpCustomPaletteName && (
                                <button
                                    type="button"
                                    onClick={handleClearCustomShpPal}
                                    className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer"
                                    title="Revert this SHP to project's loaded palette"
                                >
                                    <LucideTrash2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Frame Selector (when SHP has > 2 total frames or multiple normal frames) */}
                    {totalFrames > 1 && (
                        <div className="bg-black/50 border border-slate-800 rounded-lg p-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase text-cyan-300">
                                    Frame Selector ({currentFrameIndex + 1} / {normalFrameCount})
                                </span>
                                {totalFrames >= 2 && totalFrames % 2 === 0 && (
                                    <label className="inline-flex items-center space-x-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.shpHasShadowHalf ?? true}
                                            onChange={(e) => handleToggleShadowHalfMode(e.target.checked)}
                                            className="w-3 h-3 rounded accent-amber-500 cursor-pointer"
                                        />
                                        <span className="text-[9px] text-slate-300 font-bold">
                                            2nd Half = Shadow
                                        </span>
                                    </label>
                                )}
                            </div>

                            {normalFrameCount > 1 && (
                                <div className="flex items-center space-x-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleChangeFrame(currentFrameIndex - 1)}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                        title="Previous Frame"
                                    >
                                        <LucideChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={normalFrameCount - 1}
                                        value={currentFrameIndex}
                                        onChange={(e) => handleChangeFrame(Number(e.target.value))}
                                        className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleChangeFrame(currentFrameIndex + 1)}
                                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                        title="Next Frame"
                                    >
                                        <LucideChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {(settings.shpHasShadowHalf ?? true) && totalFrames >= 2 && (
                                <div className="text-[8px] text-slate-400 font-mono">
                                    Sprite Frame #{currentFrameIndex + 1} + Paired Shadow Frame #{currentFrameIndex + 1 + normalFrameCount} (PAL Index #1)
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shadow Controls */}
                    <div className="bg-black/40 border border-slate-800 rounded-lg p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.shpShadowEnabled ?? true}
                                    onChange={(e) =>
                                        onUpdateSettings({ shpShadowEnabled: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                                    <LucideSunDim className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Stamp Shadow (Darken Tile)</span>
                                </span>
                            </label>
                            <span className="text-[8px] text-slate-500 font-mono">PAL #1</span>
                        </div>

                        {(settings.shpShadowEnabled ?? true) && (
                            <div className="space-y-1 pt-1">
                                <FilterSlider
                                    label="Shadow Darkness"
                                    min={0}
                                    max={100}
                                    value={settings.shpShadowDarkness ?? 55}
                                    defaultValue={55}
                                    onChange={(v) => onUpdateSettings({ shpShadowDarkness: v })}
                                />
                                <FilterSlider
                                    label="PAL #1 Color Tint"
                                    min={0}
                                    max={100}
                                    value={settings.shpShadowBlendPalIndex1 ?? 25}
                                    defaultValue={25}
                                    onChange={(v) => onUpdateSettings({ shpShadowBlendPalIndex1: v })}
                                />
                                <FilterSlider
                                    label="Shadow Softness"
                                    min={0}
                                    max={8}
                                    value={settings.shpShadowSoftness ?? 0}
                                    defaultValue={0}
                                    onChange={(v) => onUpdateSettings({ shpShadowSoftness: v })}
                                />
                                <div className="grid grid-cols-2 gap-1.5">
                                    <FilterSlider
                                        label="Shadow X"
                                        min={-48}
                                        max={48}
                                        value={settings.shpShadowOffsetX ?? 0}
                                        defaultValue={0}
                                        onChange={(v) => onUpdateSettings({ shpShadowOffsetX: v })}
                                    />
                                    <FilterSlider
                                        label="Shadow Y"
                                        min={-48}
                                        max={48}
                                        value={settings.shpShadowOffsetY ?? 0}
                                        defaultValue={0}
                                        onChange={(v) => onUpdateSettings({ shpShadowOffsetY: v })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
