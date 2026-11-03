import React, { useRef, useState } from 'react';
import type { ThreeDSurfaceScatterItem, ThreeDSurfaceScatterSettings } from '../../../types';
import { STOCK_3D_OBJECTS } from '../../../utils/stockAssetsHelper';
import { StockThreeDModal } from '../../modals/StockThreeDModal';
import { ThreeDSurfaceScatterItemCardTextureControls } from './ThreeDSurfaceScatterItemCardTextureControls';
import {
    LucideUpload,
    LucidePlus,
    LucideTrash2,
    LucideBox,
    LucideEye,
    LucideEyeOff,
    LucideSparkles,
} from 'lucide-react';

interface ThreeDSurfaceScatterModelsSubpanelProps {
    scatter: ThreeDSurfaceScatterSettings;
    onAddScatterItem: (glbUrl: string, name: string) => void;
    onUpdateScatterItem: (
        itemId: string,
        updates: Partial<ThreeDSurfaceScatterItem>,
        pushHistory?: boolean
    ) => void;
    onRemoveScatterItem: (itemId: string) => void;
    onStartHistory: () => void;
}

export const ThreeDSurfaceScatterModelsSubpanel: React.FC<
    ThreeDSurfaceScatterModelsSubpanelProps
> = ({
    scatter,
    onAddScatterItem,
    onUpdateScatterItem,
    onRemoveScatterItem,
    onStartHistory,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const url = URL.createObjectURL(file);
            onAddScatterItem(url, file.name);
        }
        e.target.value = '';
    };

    const items = scatter.items || [];

    return (
        <div className="bg-slate-950/70 p-2.5 rounded-lg border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                    1. Scattered 3D Models (Grass, Rocks, Shrubs)
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                    {items.filter((i) => i.enabled).length} / {items.length} Active
                </span>
            </div>

            {/* Quick Stock Grass / Rock Buttons */}
            {STOCK_3D_OBJECTS.length > 0 && (
                <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        Quick Add from /3DOBJECTS:
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {STOCK_3D_OBJECTS.filter(
                            (st) => !st.fileName.toLowerCase().includes('slope')
                        ).map((st) => (
                            <button
                                key={st.fileName}
                                type="button"
                                onClick={() => onAddScatterItem(st.url, st.name)}
                                className="px-2 py-1 rounded-md bg-emerald-950/60 hover:bg-emerald-800/70 border border-emerald-500/40 text-[10px] font-black uppercase text-emerald-200 flex items-center space-x-1 transition-all cursor-pointer"
                                title={`Add ${st.fileName} to surface scatter`}
                            >
                                <LucidePlus className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{st.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Custom GLB or Browse Stock Modal */}
            <div className="grid grid-cols-2 gap-1.5">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                >
                    <LucideUpload className="w-3.5 h-3.5 shrink-0" />
                    <span>Load .GLB Model</span>
                </button>
                <button
                    type="button"
                    onClick={() => setIsStockModalOpen(true)}
                    className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-300 font-black text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                    <LucideSparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Browse Stock 3D</span>
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,.gltf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                />
            </div>

            {/* Loaded Scatter Items List */}
            {items.length === 0 ? (
                <div className="py-3 px-2 rounded-lg bg-slate-900/60 border border-dashed border-slate-700 text-center text-[10px] text-slate-400">
                    No 3D scatter model loaded yet. Click <b className="text-emerald-300">+ Grass 01</b>,{' '}
                    <b className="text-emerald-300">+ Rock 1</b>, or <b className="text-emerald-300">Load .GLB Model</b> above to spread it across the top surface!
                </div>
            ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-700">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={`p-2 rounded-lg border space-y-1.5 transition-all ${
                                item.enabled
                                    ? 'bg-slate-900/90 border-emerald-500/40'
                                    : 'bg-slate-900/40 border-slate-800 opacity-60'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center space-x-1.5 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onUpdateScatterItem(
                                                item.id,
                                                { enabled: !item.enabled },
                                                true
                                            )
                                        }
                                        className={`p-1 rounded transition-colors cursor-pointer ${
                                            item.enabled
                                                ? 'bg-emerald-500/20 text-emerald-300'
                                                : 'bg-slate-800 text-slate-500'
                                        }`}
                                        title={item.enabled ? 'Disable this model' : 'Enable this model'}
                                    >
                                        {item.enabled ? (
                                            <LucideEye className="w-3.5 h-3.5" />
                                        ) : (
                                            <LucideEyeOff className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    <LucideBox className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-200 truncate">
                                        {item.name}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemoveScatterItem(item.id)}
                                    className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                                    title="Remove from scatter list"
                                >
                                    <LucideTrash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {item.enabled && (
                                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                            <span>Mix Weight</span>
                                            <span className="text-emerald-300 font-mono">
                                                {item.weight}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={item.weight}
                                            onMouseDown={onStartHistory}
                                            onChange={(e) =>
                                                onUpdateScatterItem(item.id, {
                                                    weight: parseInt(e.target.value, 10),
                                                })
                                            }
                                            onDoubleClick={() =>
                                                onUpdateScatterItem(item.id, { weight: 100 }, true)
                                            }
                                            className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                            <span>Item Scale</span>
                                            <span className="text-emerald-300 font-mono">
                                                {item.scaleMultiplier.toFixed(2)}x
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="3.5"
                                            step="0.05"
                                            value={item.scaleMultiplier}
                                            onMouseDown={onStartHistory}
                                            onChange={(e) =>
                                                onUpdateScatterItem(item.id, {
                                                    scaleMultiplier: parseFloat(e.target.value),
                                                })
                                            }
                                            onDoubleClick={() =>
                                                onUpdateScatterItem(
                                                    item.id,
                                                    { scaleMultiplier: 1.0 },
                                                    true
                                                )
                                            }
                                            className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                                            <span>Y Offset</span>
                                            <span className="text-emerald-300 font-mono">
                                                {item.yOffset.toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="-1.5"
                                            max="1.5"
                                            step="0.02"
                                            value={item.yOffset}
                                            onMouseDown={onStartHistory}
                                            onChange={(e) =>
                                                onUpdateScatterItem(item.id, {
                                                    yOffset: parseFloat(e.target.value),
                                                })
                                            }
                                            onDoubleClick={() =>
                                                onUpdateScatterItem(item.id, { yOffset: 0 }, true)
                                            }
                                            className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <ThreeDSurfaceScatterItemCardTextureControls
                                            item={item}
                                            onUpdateScatterItem={onUpdateScatterItem}
                                            onStartHistory={onStartHistory}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <StockThreeDModal
                isOpen={isStockModalOpen}
                onClose={() => setIsStockModalOpen(false)}
                onSelectGlb={(glbUrl, name) => onAddScatterItem(glbUrl, name)}
            />
        </div>
    );
};
