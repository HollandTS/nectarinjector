import React from 'react';
import type { HandBrushSettings, LoadedShpBrushItem } from '../../types';
import { applyLoadedShpItemToSettings } from '../../utils/shpBrushHelper';
import { LucideCheckSquare, LucideShuffle, LucideTrash2 } from 'lucide-react';

interface HandBrushShpLibraryListProps {
    settings: HandBrushSettings;
    onUpdateSettings: (updates: Partial<HandBrushSettings>) => void;
}

export const HandBrushShpLibraryList: React.FC<HandBrushShpLibraryListProps> = ({
    settings,
    onUpdateSettings,
}) => {
    const items = settings.loadedShpItems || [];
    const selectedIds = new Set(settings.selectedShpIds || []);

    if (items.length === 0) return null;

    const handleSelectActiveShp = (item: LoadedShpBrushItem) => {
        onUpdateSettings(applyLoadedShpItemToSettings(item));
    };

    const handleToggleCheck = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        onUpdateSettings({ selectedShpIds: Array.from(next) });
    };

    const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));

    const handleSelectAll = () => {
        if (allSelected) {
            onUpdateSettings({ selectedShpIds: [] });
        } else {
            onUpdateSettings({ selectedShpIds: items.map((i) => i.id) });
        }
    };

    const handleRemoveItem = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const nextList = items.filter((i) => i.id !== id);
        const nextSelected = Array.from(selectedIds).filter((sid) => sid !== id);
        if (settings.activeShpId === id) {
            if (nextList.length > 0) {
                onUpdateSettings(
                    applyLoadedShpItemToSettings(nextList[0], nextList, nextSelected)
                );
            } else {
                onUpdateSettings({
                    isShpBrush: false,
                    activeShpId: undefined,
                    shpBuffer: undefined,
                    shpFileName: undefined,
                    shpShadowSrc: null,
                    loadedShpItems: [],
                    selectedShpIds: [],
                });
            }
        } else {
            onUpdateSettings({
                loadedShpItems: nextList,
                selectedShpIds: nextSelected,
            });
        }
    };

    return (
        <div className="bg-black/60 border border-slate-800 rounded-lg p-2 space-y-1.5">
            {/* Header + Random-Pick + Select All */}
            <div className="flex items-center justify-between gap-1">
                <label
                    className="inline-flex items-center space-x-1.5 cursor-pointer"
                    title="When checked, each brush press rotates to the next checked SHP in the list"
                >
                    <input
                        type="checkbox"
                        checked={!!settings.shpRandomPick}
                        onChange={(e) => onUpdateSettings({ shpRandomPick: e.target.checked })}
                        className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                    />
                    <span className="text-[9px] font-black uppercase text-amber-300 flex items-center gap-1">
                        <LucideShuffle className="w-3 h-3 text-amber-400" />
                        <span>Random-Pick (Rotate on Press)</span>
                    </span>
                </label>

                <button
                    type="button"
                    onClick={handleSelectAll}
                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold text-cyan-300 cursor-pointer shrink-0"
                    title={allSelected ? 'Deselect all SHPs' : 'Select all loaded SHPs for rotation'}
                >
                    <LucideCheckSquare className="w-3 h-3" />
                    <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
            </div>

            {/* Loaded SHP List */}
            <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                {items.map((item, idx) => {
                    const isActive = settings.activeShpId === item.id && settings.isShpBrush;
                    const isChecked = selectedIds.has(item.id);
                    return (
                        <div
                            key={item.id}
                            onClick={() => handleSelectActiveShp(item)}
                            className={`flex items-center justify-between gap-1.5 px-1.5 py-1 rounded border cursor-pointer transition-all ${
                                isActive
                                    ? 'bg-amber-950/60 border-amber-500/80 text-white'
                                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    onClick={(e) => handleToggleCheck(item.id, e)}
                                    className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer shrink-0"
                                    title="Include this SHP in Random-Pick rotation"
                                />
                                <div className="w-6 h-6 rounded bg-black/70 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                    <img
                                        src={item.brushSrc}
                                        alt={item.fileName}
                                        className="w-full h-full object-contain"
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[9px] font-bold truncate">
                                        {idx + 1}. {item.fileName}
                                    </div>
                                    <div className="text-[8px] font-mono text-amber-300/90 truncate">
                                        PAL: {item.customPaletteName || 'Project PAL'} • F{item.frameIndex + 1}/{item.normalFrameCount}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={(e) => handleRemoveItem(item.id, e)}
                                className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer shrink-0"
                                title="Remove from loaded SHP list"
                            >
                                <LucideTrash2 className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
