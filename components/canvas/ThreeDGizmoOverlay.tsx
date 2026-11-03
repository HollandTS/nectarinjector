import React from 'react';
import { createPortal } from 'react-dom';

interface ThreeDGizmoOverlayProps {
    selectedObjectId: string | null;
    selectedCount?: number;
    transformMode: 'translate' | 'rotate' | 'scale' | null;
    transformAxis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';
    onStartTransform?: (mode: 'translate' | 'rotate' | 'scale') => void;
    onSetAxis?: (axis: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz') => void;
    onConfirmTransform?: () => void;
    onCancelTransform?: () => void;
}

export const ThreeDGizmoOverlay: React.FC<ThreeDGizmoOverlayProps> = ({
    selectedObjectId,
    selectedCount = 0,
    transformMode,
    transformAxis,
    onStartTransform,
    onSetAxis,
    onConfirmTransform,
    onCancelTransform,
}) => {
    const hasSelection = !!selectedObjectId || selectedCount > 0;
    const bar = (
        <div
            className="gizmo-ui fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#161b22]/95 backdrop-blur-lg border border-slate-700/60 p-2 px-4 rounded-full text-xs text-white pointer-events-auto z-[10000] shadow-2xl flex items-center space-x-3 select-none"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Brand / Status Pill */}
            <div className="flex items-center space-x-2 pr-3 border-r border-slate-700/60">
                <div
                    className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                        transformMode === 'translate'
                            ? 'bg-green-500 shadow-[0_0_8px_#22c55e]'
                            : transformMode === 'rotate'
                            ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                            : transformMode === 'scale'
                            ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]'
                            : 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]'
                    }`}
                />
                <span className="font-black uppercase tracking-wider text-xs text-slate-200 whitespace-nowrap">
                    3D Gizmo
                </span>
                {selectedCount > 1 && (
                    <span className="text-[10px] bg-indigo-500/25 border border-indigo-400/40 px-2 py-0.5 rounded-full font-bold text-indigo-300 uppercase whitespace-nowrap">
                        {selectedCount} Selected
                    </span>
                )}
                {transformMode && (
                    <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold text-cyan-300 uppercase">
                        {transformMode}
                    </span>
                )}
            </div>

            {!hasSelection ? (
                <div className="text-slate-400 italic text-xs py-0.5 pr-1">
                    Click or Left-Drag box to select 3D objects · Right-Drag to rotate view
                </div>
            ) : (
                <>
                    {/* Mode Buttons: G / R / S */}
                    <div className="flex items-center space-x-2 pr-3 border-r border-slate-700/60">
                        <span className="text-slate-400 uppercase font-bold text-[10px]">Mode</span>
                        <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-full border border-slate-700/60">
                            {[
                                { m: 'translate' as const, k: 'G', label: 'Move', c: 'bg-green-600 border-green-400' },
                                { m: 'rotate' as const, k: 'R', label: 'Rotate', c: 'bg-red-600 border-red-400' },
                                { m: 'scale' as const, k: 'S', label: 'Scale', c: 'bg-blue-600 border-blue-400' },
                            ].map((item) => (
                                <button
                                    key={item.m}
                                    type="button"
                                    onClick={() => onStartTransform?.(item.m)}
                                    title={`${item.label} (${item.k})`}
                                    className={`px-2.5 h-6 flex items-center space-x-1 rounded-full text-[11px] font-black transition-all border ${
                                        transformMode === item.m
                                            ? `${item.c} text-white shadow-md`
                                            : 'bg-transparent hover:bg-slate-800 text-slate-300 border-transparent'
                                    }`}
                                >
                                    <span>{item.k}</span>
                                    <span className="text-[9px] font-bold opacity-80 hidden sm:inline">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Axis Buttons: X / Y / Z / XYZ */}
                    <div className="flex items-center space-x-2 pr-3 border-r border-slate-700/60">
                        <span className="text-slate-400 uppercase font-bold text-[10px]">Axis</span>
                        <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-full border border-slate-700/60">
                            {(['x', 'y', 'z'] as const).map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    onClick={() => onSetAxis?.(transformAxis === a ? 'xyz' : a)}
                                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-black transition-all border ${
                                        transformAxis.includes(a)
                                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                                            : 'bg-transparent hover:bg-slate-800 text-slate-400 border-transparent'
                                    }`}
                                >
                                    {a.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <span className="text-[10px] text-cyan-400 font-bold uppercase whitespace-nowrap">
                            {transformAxis === 'xyz'
                                ? 'Free (XYZ)'
                                : transformAxis.length > 1
                                ? `Plane ${transformAxis.toUpperCase()}`
                                : `Axis ${transformAxis.toUpperCase()}`}
                        </span>
                    </div>

                    {/* Active Transform Confirm / Cancel Controls or Shortcuts */}
                    {transformMode ? (
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={onConfirmTransform}
                                className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center space-x-1.5 shadow-md transition-all"
                            >
                                <span className="font-mono bg-black/25 px-1.5 py-0.5 rounded-full">L-Click</span>
                                <span>Confirm</span>
                            </button>
                            <button
                                type="button"
                                onClick={onCancelTransform}
                                className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center space-x-1.5 shadow-md transition-all"
                            >
                                <span className="font-mono bg-black/25 px-1.5 py-0.5 rounded-full">R-Click / ESC</span>
                                <span>Cancel</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-3 text-[11px] text-slate-400 pr-1">
                            <div className="flex items-center space-x-1">
                                <span className="text-emerald-400 font-bold font-mono">L-CLICK</span>
                                <span>Confirm</span>
                            </div>
                            <span className="text-slate-700">•</span>
                            <div className="flex items-center space-x-1">
                                <span className="text-rose-400 font-bold font-mono">R-CLICK / ESC</span>
                                <span>Cancel</span>
                            </div>
                            <span className="text-slate-700 hidden md:inline">•</span>
                            <div className="hidden md:flex items-center space-x-1">
                                <span className="text-cyan-300 font-bold font-mono">SHIFT+D</span>
                                <span>Duplicate</span>
                            </div>
                            <span className="text-slate-700 hidden md:inline">•</span>
                            <div className="hidden md:flex items-center space-x-1">
                                <span className="text-slate-200 font-bold font-mono">C</span>
                                <span>Snap 2D</span>
                            </div>
                            <span className="text-slate-700 hidden lg:inline">•</span>
                            <div className="hidden lg:flex items-center space-x-1">
                                <span className="text-slate-200 font-bold font-mono">ARROWS</span>
                                <span>Nudge</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(bar, document.body);
    }
    return bar;
};


