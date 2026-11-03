import React, { useRef } from 'react';
import type { ThreeDObject } from '../../../types';
import { LucideBox, LucideCopy, LucideTrash2, LucideSave, LucideFolderOpen, LucidePalette } from 'lucide-react';

interface ThreeDObjectListSectionProps {
    objects: ThreeDObject[];
    selectedObjectId: string | null;
    selectedObjectIds?: Set<string>;
    onSelectObject: (id: string, toggleMulti?: boolean) => void;
    onDuplicateObject?: (id: string) => void;
    onRemoveObject: (id: string) => void;
    onSaveObject?: (obj: ThreeDObject) => void;
    onLoadObjectFile?: (file: File) => void;
    onTogglePaletteViewer?: (obj: ThreeDObject) => void;
}

export const ThreeDObjectListSection: React.FC<ThreeDObjectListSectionProps> = ({
    objects,
    selectedObjectId,
    selectedObjectIds,
    onSelectObject,
    onDuplicateObject,
    onRemoveObject,
    onSaveObject,
    onLoadObjectFile,
    onTogglePaletteViewer,
}) => {
    const loadInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onLoadObjectFile) return;
        onLoadObjectFile(file);
        e.target.value = '';
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Scene Objects ({objects.length})
                    {selectedObjectIds && selectedObjectIds.size > 1 ? ` · ${selectedObjectIds.size} Selected` : ''}
                </span>
                <div className="flex items-center space-x-2">
                    {onLoadObjectFile && (
                        <>
                            <button
                                type="button"
                                onClick={() => loadInputRef.current?.click()}
                                className="flex items-center space-x-1 text-[10px] bg-cyan-950/50 border border-cyan-500/30 hover:bg-cyan-900/50 px-2 py-0.5 rounded-md text-cyan-300 font-black uppercase transition-all cursor-pointer"
                                title="Load 3D Object (.3dnectar)"
                            >
                                <LucideFolderOpen className="w-3 h-3 text-cyan-400" />
                                <span>Load</span>
                            </button>
                            <input
                                type="file"
                                ref={loadInputRef}
                                onChange={handleFileChange}
                                accept=".3dnectar,application/json"
                                className="hidden"
                            />
                        </>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">
                        Shift+D
                    </span>
                </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {objects.map((obj) => {
                    const isSelected =
                        selectedObjectId === obj.id ||
                        (selectedObjectIds ? selectedObjectIds.has(obj.id) : false);
                    return (
                        <div
                            key={obj.id}
                            onClick={(e) => onSelectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                            className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                    ? 'bg-cyan-500/15 border-cyan-500/60 shadow-sm'
                                    : 'bg-black/30 border-slate-700/60 hover:border-slate-500 hover:bg-slate-800/40'
                            }`}
                        >
                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                <LucideBox
                                    className={`w-4 h-4 shrink-0 ${
                                        isSelected ? 'text-cyan-400' : 'text-slate-400'
                                    }`}
                                />
                                <span
                                    className={`text-xs font-bold truncate ${
                                        isSelected ? 'text-white' : 'text-slate-300'
                                    }`}
                                    title={obj.name}
                                >
                                    {obj.name}
                                </span>
                            </div>

                            <div
                                className="flex items-center space-x-1 shrink-0 ml-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {onTogglePaletteViewer && (
                                    <button
                                        type="button"
                                        onClick={() => onTogglePaletteViewer(obj)}
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            obj.paletteViewer
                                                ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-sm'
                                                : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800'
                                        }`}
                                        title={
                                            obj.paletteViewer
                                                ? 'Palette Viewer active (limited visibly to loaded .pal)'
                                                : 'Palette Viewer: limit 3D object visibly to loaded .pal'
                                        }
                                    >
                                        <LucidePalette className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onSaveObject && (
                                    <button
                                        type="button"
                                        onClick={() => onSaveObject(obj)}
                                        className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="Save 3D Object (.3dnectar)"
                                    >
                                        <LucideSave className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onDuplicateObject && (
                                    <button
                                        type="button"
                                        onClick={() => onDuplicateObject(obj.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="Duplicate 3D Object (Shift+D)"
                                    >
                                        <LucideCopy className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => onRemoveObject(obj.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Delete 3D Object"
                                >
                                    <LucideTrash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
                {objects.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-5 bg-black/20 rounded-xl border border-dashed border-slate-700/60">
                        No 3D objects imported yet. Click &ldquo;Import GLB&rdquo; or &ldquo;Load&rdquo; above to add a model.
                    </div>
                )}
            </div>
        </div>
    );
};
