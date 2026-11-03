import React from 'react';
import type { ProjectOverlay } from '../../../types';
import { resolveShuffleFlags } from '../../../utils/tileShuffleHelper';
import { LucideZap } from 'lucide-react';

interface ShuffleModeControlProps {
    ov: ProjectOverlay;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, shouldPushHistory?: boolean) => void;
}

export const ShuffleModeControl: React.FC<ShuffleModeControlProps> = ({
    ov,
    onUpdateOverlay,
}) => {
    const f = ov.filters;
    const flags = resolveShuffleFlags(f);

    const isChaos = flags.standard && flags.mirrorH && flags.mirrorV && flags.rotate;

    const updateShuffleFlags = (nextFlags: {
        standard: boolean;
        mirrorH: boolean;
        mirrorV: boolean;
        rotate: boolean;
    }) => {
        // Keep legacy shuffleMode in sync for backwards compatibility
        let legacyMode = f.shuffleMode;
        if (nextFlags.standard && nextFlags.mirrorH && nextFlags.mirrorV && nextFlags.rotate) {
            legacyMode = 'default';
        } else if (!nextFlags.mirrorH && !nextFlags.mirrorV && !nextFlags.rotate) {
            legacyMode = 'none';
        } else if (nextFlags.mirrorH && nextFlags.mirrorV && !nextFlags.rotate) {
            legacyMode = 'mirror_both';
        } else if (nextFlags.mirrorH && !nextFlags.mirrorV && !nextFlags.rotate) {
            legacyMode = 'mirror_h';
        } else if (!nextFlags.mirrorH && nextFlags.mirrorV && !nextFlags.rotate) {
            legacyMode = 'mirror_v';
        }

        onUpdateOverlay(
            ov.id,
            {
                filters: {
                    ...f,
                    shuffleMode: legacyMode,
                    shuffleStandard: nextFlags.standard,
                    shuffleMirrorH: nextFlags.mirrorH,
                    shuffleMirrorV: nextFlags.mirrorV,
                    shuffleRotate: nextFlags.rotate,
                },
            },
            true
        );
    };

    const toggleFlag = (key: keyof typeof flags) => {
        const nextFlags = {
            ...flags,
            [key]: !flags[key],
        };
        updateShuffleFlags(nextFlags);
    };

    const handleEnableChaos = () => {
        updateShuffleFlags({
            standard: true,
            mirrorH: true,
            mirrorV: true,
            rotate: true,
        });
    };

    return (
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 font-bold uppercase">
                    Shuffle Mode
                </label>
                <button
                    type="button"
                    onClick={handleEnableChaos}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider transition-all border cursor-pointer active:scale-95 ${
                        isChaos
                            ? 'bg-cyan-600/40 border-cyan-400 text-cyan-200 shadow-xs'
                            : 'bg-slate-800/80 hover:bg-cyan-950/60 border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300'
                    }`}
                    title="Enable all shuffle options (Chaos)"
                >
                    <LucideZap className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Chaos (All)</span>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-2 rounded-lg border border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-800/40 transition-colors">
                    <input
                        type="checkbox"
                        checked={flags.standard}
                        onChange={() => toggleFlag('standard')}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold uppercase text-slate-300">
                        Standard
                    </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-800/40 transition-colors">
                    <input
                        type="checkbox"
                        checked={flags.mirrorH}
                        onChange={() => toggleFlag('mirrorH')}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold uppercase text-slate-300">
                        Mirror H
                    </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-800/40 transition-colors">
                    <input
                        type="checkbox"
                        checked={flags.mirrorV}
                        onChange={() => toggleFlag('mirrorV')}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold uppercase text-slate-300">
                        Mirror V
                    </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-800/40 transition-colors">
                    <input
                        type="checkbox"
                        checked={flags.rotate}
                        onChange={() => toggleFlag('rotate')}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold uppercase text-slate-300">
                        Rotate
                    </span>
                </label>
            </div>
        </div>
    );
};
