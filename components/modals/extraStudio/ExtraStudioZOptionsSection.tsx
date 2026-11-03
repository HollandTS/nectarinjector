import React from 'react';
import { ExtraZMode } from '../../../utils/extraImageZHelper';
import { LucideShieldCheck } from 'lucide-react';

interface ExtraStudioZOptionsSectionProps {
    zMode: ExtraZMode;
    setZMode: (mode: ExtraZMode) => void;
    customZValue: number;
    setCustomZValue: (val: number) => void;
    isolateObjectsPerTile: boolean;
    setIsolateObjectsPerTile: (val: boolean) => void;
    alsoBakeBaseDiamond: boolean;
    setAlsoBakeBaseDiamond: (val: boolean) => void;
    includeShadowsInBase: boolean;
    setIncludeShadowsInBase: (val: boolean) => void;
    preserveExistingExtra: boolean;
    setPreserveExistingExtra: (val: boolean) => void;
}

export const ExtraStudioZOptionsSection: React.FC<ExtraStudioZOptionsSectionProps> = ({
    zMode,
    setZMode,
    customZValue,
    setCustomZValue,
    isolateObjectsPerTile,
    setIsolateObjectsPerTile,
    alsoBakeBaseDiamond,
    setAlsoBakeBaseDiamond,
    includeShadowsInBase,
    setIncludeShadowsInBase,
    preserveExistingExtra,
    setPreserveExistingExtra,
}) => {
    return (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <LucideShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Westwood Z-Data (blit.cpp) &amp; Masking</span>
            </span>

            <div className="grid grid-cols-2 gap-1.5">
                <button
                    type="button"
                    onClick={() => setZMode('blit_cpp_gradient')}
                    className={`py-1.5 px-2 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${
                        zMode === 'blit_cpp_gradient'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-black/30 border-slate-700/70 text-slate-400'
                    }`}
                    title="Exact Westwood blit.cpp bottom-up fractional scanline Z interpolation"
                >
                    ⚡ blit.cpp Gradient
                </button>
                <button
                    type="button"
                    onClick={() => setZMode('smart_column')}
                    className={`py-1.5 px-2 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${
                        zMode === 'smart_column'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-black/30 border-slate-700/70 text-slate-400'
                    }`}
                    title="Continuous isometric X-column gradient"
                >
                    Smart Column
                </button>
                <button
                    type="button"
                    onClick={() => setZMode('flat_top')}
                    className={`py-1.5 px-2 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${
                        zMode === 'flat_top'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-black/30 border-slate-700/70 text-slate-400'
                    }`}
                    title="Max engine ceiling (cy - 1) so tree canopies render in front of ground units"
                >
                    Canopy Top
                </button>
                <button
                    type="button"
                    onClick={() => setZMode('uniform')}
                    className={`py-1.5 px-2 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${
                        zMode === 'uniform'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-black/30 border-slate-700/70 text-slate-400'
                    }`}
                    title="Custom uniform Z depth value"
                >
                    Custom Z
                </button>
            </div>

            {zMode === 'uniform' && (
                <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Custom Z Depth:</span>
                    <input
                        type="number"
                        min={1}
                        max={59}
                        value={customZValue}
                        onChange={(e) => setCustomZValue(parseInt(e.target.value, 10) || 1)}
                        className="w-20 bg-black/50 border border-slate-700 rounded px-2 py-1 text-right font-mono text-xs text-white"
                    />
                </div>
            )}

            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                <label className="flex items-center space-x-2 text-[10px] font-bold text-emerald-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isolateObjectsPerTile}
                        onChange={(e) => setIsolateObjectsPerTile(e.target.checked)}
                        className="rounded accent-emerald-500"
                    />
                    <span>Isolate Whole Objects &amp; Mask Out Other Objects</span>
                </label>
                <label className="flex items-center space-x-2 text-[10px] font-bold text-slate-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={alsoBakeBaseDiamond}
                        onChange={(e) => setAlsoBakeBaseDiamond(e.target.checked)}
                        className="rounded accent-emerald-500"
                    />
                    <span>Also bake inside 1×1 Base Diamond footprint</span>
                </label>
                {alsoBakeBaseDiamond && (
                    <label className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 cursor-pointer pl-4">
                        <input
                            type="checkbox"
                            checked={includeShadowsInBase}
                            onChange={(e) => setIncludeShadowsInBase(e.target.checked)}
                            className="rounded accent-emerald-500"
                        />
                        <span>Blend 3D ground shadows onto Base Diamond</span>
                    </label>
                )}
                <label className="flex items-center space-x-2 text-[10px] font-bold text-slate-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={preserveExistingExtra}
                        onChange={(e) => setPreserveExistingExtra(e.target.checked)}
                        className="rounded accent-emerald-500"
                    />
                    <span>Keep previous Extra Image pixels (e.g. Cliff wall)</span>
                </label>
            </div>
        </div>
    );
};
