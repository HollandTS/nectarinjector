import React from 'react';
import type { ProjectOverlay } from '../../../types';
import type { ExtraBakeSourceMode } from '../../../utils/extraImageBaker';
import { LucideBox } from 'lucide-react';

interface ExtraStudioSourceSectionProps {
    sourceMode: ExtraBakeSourceMode;
    setSourceMode: (mode: ExtraBakeSourceMode) => void;
    specificOverlayId: string;
    setSpecificOverlayId: (id: string) => void;
    visible2DLayers: ProjectOverlay[];
}

export const ExtraStudioSourceSection: React.FC<ExtraStudioSourceSectionProps> = ({
    sourceMode,
    setSourceMode,
    specificOverlayId,
    setSpecificOverlayId,
    visible2DLayers,
}) => {
    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <LucideBox className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Source to Detect &amp; Bake Around Tile</span>
            </span>
            <div className="grid grid-cols-2 gap-1.5">
                <button
                    type="button"
                    onClick={() => setSourceMode('3d_scene')}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-black uppercase text-left transition-all cursor-pointer ${
                        sourceMode === '3d_scene'
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-black/30 border-slate-700/70 text-slate-400 hover:text-white'
                    }`}
                >
                    🧊 3D Scene &amp; Scatter
                </button>
                <button
                    type="button"
                    onClick={() => setSourceMode('all_layers')}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-black uppercase text-left transition-all cursor-pointer ${
                        sourceMode === 'all_layers'
                            ? 'bg-emerald-500/20 border-emerald-400 text-white'
                            : 'bg-black/30 border-slate-700/70 text-slate-400 hover:text-white'
                    }`}
                >
                    ✨ All (3D + 2D Stack)
                </button>
                <button
                    type="button"
                    onClick={() => setSourceMode('2d_layers')}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-black uppercase text-left transition-all cursor-pointer ${
                        sourceMode === '2d_layers'
                            ? 'bg-amber-500/20 border-amber-400 text-white'
                            : 'bg-black/30 border-slate-700/70 text-slate-400 hover:text-white'
                    }`}
                >
                    🖼️ Visible 2D Layers
                </button>
                <button
                    type="button"
                    onClick={() => setSourceMode('specific_layer')}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-black uppercase text-left transition-all cursor-pointer ${
                        sourceMode === 'specific_layer'
                            ? 'bg-purple-500/20 border-purple-400 text-white'
                            : 'bg-black/30 border-slate-700/70 text-slate-400 hover:text-white'
                    }`}
                >
                    🎯 Specific 2D Layer
                </button>
            </div>

            {sourceMode === 'specific_layer' && (
                <select
                    value={specificOverlayId}
                    onChange={(e) => setSpecificOverlayId(e.target.value)}
                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase text-white outline-none"
                >
                    {visible2DLayers.length === 0 && <option value="">No 2D Layers Available</option>}
                    {visible2DLayers.map((ov) => (
                        <option key={ov.id} value={ov.id}>
                            {ov.name} ({ov.type})
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
};
