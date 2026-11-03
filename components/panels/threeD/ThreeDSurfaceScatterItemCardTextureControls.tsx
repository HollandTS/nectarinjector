import React, { useRef } from 'react';
import type { ThreeDSurfaceScatterItem } from '../../../types';
import { LucideImage, LucideX, LucideRotateCcw } from 'lucide-react';

interface ThreeDSurfaceScatterItemCardTextureControlsProps {
    item: ThreeDSurfaceScatterItem;
    onUpdateScatterItem: (
        itemId: string,
        updates: Partial<ThreeDSurfaceScatterItem>,
        pushHistory?: boolean
    ) => void;
    onStartHistory: () => void;
}

export const ThreeDSurfaceScatterItemCardTextureControls: React.FC<
    ThreeDSurfaceScatterItemCardTextureControlsProps
> = ({ item, onUpdateScatterItem, onStartHistory }) => {
    const texInputRef = useRef<HTMLInputElement>(null);

    const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        onUpdateScatterItem(item.id, { textureUrl: url }, true);
        e.target.value = '';
    };

    const hueShift = item.hueShift ?? 0;
    const brightness = item.brightness ?? 100;
    const contrast = item.contrast ?? 100;
    const saturation = item.saturation ?? 100;

    const hasColorAdjustment =
        hueShift !== 0 ||
        brightness !== 100 ||
        contrast !== 100 ||
        saturation !== 100;

    return (
        <div className="pt-1.5 border-t border-slate-800/80 space-y-1.5">
            {/* Custom Texture Load / Clear Row */}
            <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center space-x-1.5 min-w-0">
                    <button
                        type="button"
                        onClick={() => texInputRef.current?.click()}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[9px] font-black uppercase text-emerald-300 flex items-center space-x-1 transition-all cursor-pointer shrink-0"
                        title="Load a custom texture image for this scattered 3D model"
                    >
                        <LucideImage className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{item.textureUrl ? 'Change Tex' : 'Load Texture'}</span>
                    </button>
                    <input
                        ref={texInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleTextureUpload}
                        className="hidden"
                    />
                    {item.textureUrl && (
                        <div className="flex items-center space-x-1 bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                            <img
                                src={item.textureUrl}
                                alt="Item Tex"
                                className="w-3.5 h-3.5 rounded-xs object-cover shrink-0"
                            />
                            <span className="text-[8px] font-bold uppercase text-emerald-300">
                                Custom
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    onUpdateScatterItem(
                                        item.id,
                                        { textureUrl: undefined },
                                        true
                                    )
                                }
                                className="text-slate-400 hover:text-red-400 cursor-pointer"
                                title="Clear custom texture and restore GLB original texture"
                            >
                                <LucideX className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                {hasColorAdjustment && (
                    <button
                        type="button"
                        onClick={() =>
                            onUpdateScatterItem(
                                item.id,
                                {
                                    hueShift: 0,
                                    brightness: 100,
                                    contrast: 100,
                                    saturation: 100,
                                },
                                true
                            )
                        }
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[8px] font-bold uppercase text-slate-300 flex items-center space-x-0.5 cursor-pointer shrink-0"
                        title="Reset item texture color sliders"
                    >
                        <LucideRotateCcw className="w-2.5 h-2.5" />
                        <span>Reset Color</span>
                    </button>
                )}
            </div>

            {/* Texture Color Sliders: Hue, Brightness, Contrast, Saturation */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Tex Hue</span>
                        <span className="text-emerald-300 font-mono">
                            {hueShift > 0 ? `+${hueShift}°` : `${hueShift}°`}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={hueShift}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            onUpdateScatterItem(item.id, {
                                hueShift: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            onUpdateScatterItem(item.id, { hueShift: 0 }, true)
                        }
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Tex Bright</span>
                        <span className="text-emerald-300 font-mono">
                            {brightness}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="250"
                        step="2"
                        value={brightness}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            onUpdateScatterItem(item.id, {
                                brightness: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            onUpdateScatterItem(item.id, { brightness: 100 }, true)
                        }
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Tex Contrast</span>
                        <span className="text-emerald-300 font-mono">
                            {contrast}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="20"
                        max="250"
                        step="2"
                        value={contrast}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            onUpdateScatterItem(item.id, {
                                contrast: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            onUpdateScatterItem(item.id, { contrast: 100 }, true)
                        }
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        <span>Tex Sat</span>
                        <span className="text-emerald-300 font-mono">
                            {saturation}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="250"
                        step="2"
                        value={saturation}
                        onMouseDown={onStartHistory}
                        onChange={(e) =>
                            onUpdateScatterItem(item.id, {
                                saturation: parseInt(e.target.value, 10),
                            })
                        }
                        onDoubleClick={() =>
                            onUpdateScatterItem(item.id, { saturation: 100 }, true)
                        }
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                    />
                </div>
            </div>
        </div>
    );
};
