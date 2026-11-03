import React from 'react';
import { LucideLink2 } from 'lucide-react';

interface ThreeDMeshSeamWeldControlProps {
    weldVertices: boolean;
    weldTolerance: number;
    onChangeWeldVertices: (enabled: boolean) => void;
    onChangeWeldTolerance: (tolerance: number) => void;
    onStartHistory?: () => void;
    accentColor?: 'amber' | 'teal' | 'emerald';
}

export const ThreeDMeshSeamWeldControl: React.FC<ThreeDMeshSeamWeldControlProps> = ({
    weldVertices,
    weldTolerance,
    onChangeWeldVertices,
    onChangeWeldTolerance,
    onStartHistory,
    accentColor = 'teal',
}) => {
    const activeBtnClass =
        accentColor === 'amber'
            ? 'bg-amber-600/25 text-amber-300 border-amber-500/50'
            : accentColor === 'emerald'
            ? 'bg-emerald-600/25 text-emerald-300 border-emerald-500/50'
            : 'bg-teal-600/25 text-teal-300 border-teal-500/50';

    const sliderAccentClass =
        accentColor === 'amber'
            ? 'accent-amber-500'
            : accentColor === 'emerald'
            ? 'accent-emerald-500'
            : 'accent-teal-500';

    const textAccentClass =
        accentColor === 'amber'
            ? 'text-amber-300'
            : accentColor === 'emerald'
            ? 'text-emerald-300'
            : 'text-teal-300';

    return (
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                    <LucideLink2 className={`w-3.5 h-3.5 ${textAccentClass}`} />
                    <span className="text-[10px] font-bold uppercase text-slate-200">
                        Weld Mesh Seams (Keep Faces Connected)
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => onChangeWeldVertices(!weldVertices)}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border transition-colors cursor-pointer ${
                        weldVertices
                            ? activeBtnClass
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Locks shared vertices across adjacent faces and hard edges so the mesh never cracks or separates apart"
                >
                    {weldVertices ? 'CONNECTED' : 'UNWELDED'}
                </button>
            </div>

            {weldVertices && (
                <div>
                    <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                        <span title="Closes small modeling gaps between adjacent faces so they stay fused together">
                            Seam Snap Tolerance
                        </span>
                        <span className={`${textAccentClass} font-mono tabular-nums`}>
                            {weldTolerance}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={weldTolerance}
                        onMouseDown={onStartHistory}
                        onChange={(e) => onChangeWeldTolerance(parseInt(e.target.value, 10))}
                        onDoubleClick={() => onChangeWeldTolerance(35)}
                        title="Double-click to reset to 35%"
                        className={`w-full ${sliderAccentClass} cursor-pointer`}
                    />
                </div>
            )}
        </div>
    );
};
