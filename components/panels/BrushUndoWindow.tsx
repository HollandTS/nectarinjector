import React, { useState } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { BrushHistoryEntry } from '../../types';
import {
    LucideHistory,
    LucideUndo2,
    LucideRedo2,
    LucideTrash2,
    LucideX,
    LucideChevronDown,
    LucideChevronUp,
} from 'lucide-react';

interface BrushUndoWindowProps {
    isOpen: boolean;
    onClose: () => void;
    entries: BrushHistoryEntry[];
    currentIndex: number; // -1 = all undone; entries.length - 1 = latest
    onUndoBrush: () => void;
    onRedoBrush: () => void;
    onJumpToIndex: (targetIndex: number) => void;
    onClearBrushHistory: () => void;
}

export const BrushUndoWindow: React.FC<BrushUndoWindowProps> = ({
    isOpen,
    onClose,
    entries,
    currentIndex,
    onUndoBrush,
    onRedoBrush,
    onJumpToIndex,
    onClearBrushHistory,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);

    if (!isOpen) return null;

    const canUndo = currentIndex >= 0;
    const canRedo = currentIndex < entries.length - 1;

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <DraggableContainer
            initialPos={{ x: 375, y: 75 }}
            size={isMinimized ? { width: 280, height: 44 } : { width: 280, height: 390 }}
            resizable={!isMinimized}
            minWidth={240}
            className="bg-[#161b22]/95 border border-cyan-500/40 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden text-slate-200 z-[4600]"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20 bg-slate-900/70 select-none">
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <LucideHistory className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                            Brush Undo List
                        </h3>
                        <span className="text-[8px] text-slate-400 font-mono block">
                            {entries.length === 0
                                ? 'Isolated from app Undo/Redo'
                                : `Step ${currentIndex + 1} of ${entries.length}`}
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-1">
                    <button
                        type="button"
                        onClick={() => setIsMinimized((p) => !p)}
                        className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title={isMinimized ? 'Expand' : 'Minimize'}
                    >
                        {isMinimized ? (
                            <LucideChevronDown className="w-3.5 h-3.5" />
                        ) : (
                            <LucideChevronUp className="w-3.5 h-3.5" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg bg-red-900/40 hover:bg-red-600 text-red-300 hover:text-white transition-all cursor-pointer"
                        title="Close Brush Undo Window"
                    >
                        <LucideX className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="flex-1 flex flex-col min-h-0 p-2.5 space-y-2">
                    {/* Quick Undo / Redo / Clear Toolbar */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onUndoBrush}
                            disabled={!canUndo}
                            className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg bg-cyan-700/70 hover:bg-cyan-600 disabled:bg-slate-800/60 disabled:text-slate-600 text-white text-[10px] font-black uppercase border border-cyan-500/40 disabled:border-slate-800 transition-all cursor-pointer disabled:cursor-not-allowed"
                            title="Undo last brush stroke (does not affect main app undo)"
                        >
                            <LucideUndo2 className="w-3.5 h-3.5" />
                            <span>Undo</span>
                        </button>

                        <button
                            type="button"
                            onClick={onRedoBrush}
                            disabled={!canRedo}
                            className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded-lg bg-cyan-700/70 hover:bg-cyan-600 disabled:bg-slate-800/60 disabled:text-slate-600 text-white text-[10px] font-black uppercase border border-cyan-500/40 disabled:border-slate-800 transition-all cursor-pointer disabled:cursor-not-allowed"
                            title="Redo brush stroke"
                        >
                            <LucideRedo2 className="w-3.5 h-3.5" />
                            <span>Redo</span>
                        </button>

                        <button
                            type="button"
                            onClick={onClearBrushHistory}
                            disabled={entries.length === 0}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 disabled:opacity-40 text-slate-400 hover:text-red-200 border border-slate-700 transition-all cursor-pointer"
                            title="Clear brush history list"
                        >
                            <LucideTrash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* History List */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 border-t border-slate-800 pt-2">
                        {entries.length === 0 ? (
                            <div className="text-center py-8 text-[10px] text-slate-500 italic px-2">
                                Brush strokes will appear here in their own isolated Undo/Redo stack.
                            </div>
                        ) : (
                            <>
                                {/* Base state item (before first brush stroke) */}
                                <div
                                    onClick={() => onJumpToIndex(-1)}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-all ${
                                        currentIndex === -1
                                            ? 'bg-amber-950/60 border-amber-500/70 text-amber-200 font-black'
                                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <span>0. Initial State (Before Brush)</span>
                                    {currentIndex === -1 && (
                                        <span className="text-[8px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                            Current
                                        </span>
                                    )}
                                </div>

                                {entries.map((entry, idx) => {
                                    const isCurrent = idx === currentIndex;
                                    const isUndone = idx > currentIndex;
                                    return (
                                        <div
                                            key={entry.id}
                                            onClick={() => onJumpToIndex(idx)}
                                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all ${
                                                isCurrent
                                                    ? 'bg-cyan-950/70 border-cyan-400 text-white shadow-sm'
                                                    : isUndone
                                                    ? 'bg-slate-900/30 border-slate-800/60 text-slate-500 opacity-60 hover:opacity-90'
                                                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="w-6 h-6 rounded bg-black/70 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                    {entry.brushThumbSrc && (
                                                        <img
                                                            src={entry.brushThumbSrc}
                                                            alt={entry.brushName}
                                                            className="w-full h-full object-contain"
                                                            style={{ imageRendering: 'pixelated' }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[10px] font-bold truncate">
                                                        {idx + 1}. {entry.brushName}
                                                    </div>
                                                    <div className="text-[8px] font-mono text-slate-400 truncate">
                                                        {entry.mode.toUpperCase()} • {entry.tileSnapshots.length} tile{entry.tileSnapshots.length === 1 ? '' : 's'} • {formatTime(entry.timestamp)}
                                                    </div>
                                                </div>
                                            </div>

                                            {isCurrent && (
                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}
        </DraggableContainer>
    );
};
