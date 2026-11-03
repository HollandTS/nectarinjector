import React, { useState, useRef } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { CanvasImage, RgbaColor } from '../../types';
import {
    getTileBaseKey,
    parseDroppedGameReplacementFiles,
    applyGameFileReplacementsToImages,
    ParsedReplacementTile,
} from '../../utils/changeGameFilesHelper';
import {
    LucideRefreshCw,
    LucideUpload,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideX,
    LucideMinus,
    LucideMaximize2,
} from 'lucide-react';

interface ChangeGameFilesModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: CanvasImage[];
    transparencyColor: RgbaColor | null;
    tolerance: number;
    onCommitReplacements: (updatedImages: CanvasImage[]) => void;
}

export const ChangeGameFilesModal: React.FC<ChangeGameFilesModalProps> = ({
    isOpen,
    onClose,
    images,
    transparencyColor,
    tolerance,
    onCommitReplacements,
}) => {
    const [replacementMap, setReplacementMap] = useState<Map<string, ParsedReplacementTile>>(
        new Map()
    );
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [loadedPalName, setLoadedPalName] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
        width: 500,
        height: 540,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // Group canvas isotiles by baseKey (extension-agnostic)
    const uniqueBaseEntries = new Map<
        string,
        { baseKey: string; originalNames: string[]; instanceCount: number }
    >();
    for (const img of images) {
        const key = getTileBaseKey(img.name);
        if (!key) continue;
        const existing = uniqueBaseEntries.get(key);
        if (existing) {
            existing.instanceCount++;
            if (!existing.originalNames.includes(img.name)) {
                existing.originalNames.push(img.name);
            }
        } else {
            uniqueBaseEntries.set(key, {
                baseKey: key,
                originalNames: [img.name],
                instanceCount: 1,
            });
        }
    }

    const allRequiredEntries = Array.from(uniqueBaseEntries.values());
    const matchedEntries = allRequiredEntries.filter((e) => replacementMap.has(e.baseKey));
    const missingEntries = allRequiredEntries.filter((e) => !replacementMap.has(e.baseKey));

    const totalCanvasTileInstances = images.length;
    const matchedCanvasTileInstances = images.filter((img) =>
        replacementMap.has(getTileBaseKey(img.name))
    ).length;
    const stillNeededCount = missingEntries.length;

    const handleFiles = async (files: FileList | File[]) => {
        if (!files || files.length === 0) return;
        setIsParsing(true);
        try {
            const { replacementMap: nextMap, detectedPaletteName } =
                await parseDroppedGameReplacementFiles(
                    files,
                    transparencyColor,
                    tolerance,
                    replacementMap
                );
            setReplacementMap(nextMap);
            if (detectedPaletteName) {
                setLoadedPalName(detectedPaletteName);
            }
        } finally {
            setIsParsing(false);
        }
    };

    const handleApplyAndClose = () => {
        if (replacementMap.size > 0) {
            const updatedImages = applyGameFileReplacementsToImages(images, replacementMap);
            onCommitReplacements(updatedImages);
        }
        setReplacementMap(new Map());
        setLoadedPalName(null);
        onClose();
    };

    return (
        <DraggableContainer
            initialPos={{ x: 450, y: 80 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={360}
            minHeight={isMinimized ? 52 : 340}
            className="bg-[#161b22]/98 backdrop-blur-xl border border-amber-500/50 rounded-2xl shadow-2xl z-[10050] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Draggable Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-900/90 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <LucideRefreshCw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
                            Change Game-Files TS/YR/OTS
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate">
                            {matchedEntries.length}/{allRequiredEntries.length} matched · {stillNeededCount} missing
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={handleApplyAndClose}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow transition-all cursor-pointer mr-1"
                        title="Apply Replacements & Close"
                    >
                        OK {matchedEntries.length > 0 ? `(${matchedEntries.length})` : ''}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isMinimized ? 'Expand Window' : 'Minimize Window'}
                    >
                        {isMinimized ? (
                            <LucideMaximize2 className="w-4 h-4" />
                        ) : (
                            <LucideMinus className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Scrollable Body */}
                    <div className="p-3.5 space-y-3 overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-700">
                        {/* Drop Zone */}
                        <input
                            type="file"
                            multiple
                            accept="image/*,.pal,.tmp,.tem,.sno,.til,.des,.urb,.ubn,.lun"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        />
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(false);
                                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                    handleFiles(e.dataTransfer.files);
                                }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5 shrink-0 ${
                                isDragging
                                    ? 'border-amber-400 bg-amber-500/15'
                                    : 'border-slate-700 hover:border-amber-500/60 bg-slate-900/60 hover:bg-slate-900'
                            }`}
                        >
                            <LucideUpload className="w-5 h-5 text-amber-400" />
                            <div className="text-[11px] font-black uppercase tracking-wider text-white">
                                {isParsing
                                    ? 'Reading & Matching Game Files...'
                                    : 'Drop Replacement Game Files Here (or Click to Browse)'}
                            </div>
                            <p className="text-[10px] text-slate-400 max-w-sm">
                                Drop tiles with matching names (e.g.{' '}
                                <span className="text-amber-300 font-mono">cliff01.urb</span> replaces{' '}
                                <span className="text-cyan-300 font-mono">cliff01.tem</span>). You can also include a{' '}
                                <span className="text-emerald-300 font-mono">.pal</span> file!
                            </p>
                            {loadedPalName && (
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                    Active Palette Updated: {loadedPalName}
                                </span>
                            )}
                        </div>

                        {/* Status Counters */}
                        <div className="grid grid-cols-3 gap-2 shrink-0">
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 text-center">
                                <div className="text-[9px] font-black uppercase text-slate-400">
                                    Total Unique Files
                                </div>
                                <div className="text-sm font-black text-white font-mono">
                                    {allRequiredEntries.length}
                                </div>
                                <div className="text-[8px] text-slate-500 font-bold">
                                    ({totalCanvasTileInstances} on canvas)
                                </div>
                            </div>
                            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2 text-center">
                                <div className="text-[9px] font-black uppercase text-emerald-400">
                                    Matched / Ready
                                </div>
                                <div className="text-sm font-black text-emerald-300 font-mono">
                                    {matchedEntries.length}
                                </div>
                                <div className="text-[8px] text-emerald-400/80 font-bold">
                                    ({matchedCanvasTileInstances} tile{matchedCanvasTileInstances === 1 ? '' : 's'} replaced)
                                </div>
                            </div>
                            <div
                                className={`rounded-xl p-2 text-center border ${
                                    stillNeededCount === 0
                                        ? 'bg-emerald-950/20 border-emerald-500/30'
                                        : 'bg-amber-950/30 border-amber-500/40'
                                }`}
                            >
                                <div
                                    className={`text-[9px] font-black uppercase ${
                                        stillNeededCount === 0 ? 'text-emerald-400' : 'text-amber-400'
                                    }`}
                                >
                                    Still Needed / Missing
                                </div>
                                <div
                                    className={`text-sm font-black font-mono ${
                                        stillNeededCount === 0 ? 'text-emerald-300' : 'text-amber-300'
                                    }`}
                                >
                                    {stillNeededCount}
                                </div>
                                <div className="text-[8px] text-slate-400 font-bold">
                                    {stillNeededCount === 0 ? 'All Found!' : 'Can still press OK'}
                                </div>
                            </div>
                        </div>

                        {/* File Checklist */}
                        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 px-1 pb-1 border-b border-slate-800">
                                <span>Required Tile Name (Any Extension)</span>
                                <span>Status</span>
                            </div>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                                {allRequiredEntries.map((entry) => {
                                    const matched = replacementMap.get(entry.baseKey);
                                    return (
                                        <div
                                            key={entry.baseKey}
                                            className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-mono border ${
                                                matched
                                                    ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                                                    : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-2 truncate">
                                                {matched ? (
                                                    <LucideCheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                ) : (
                                                    <LucideAlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                )}
                                                <span className="truncate font-bold">
                                                    {entry.originalNames.join(', ')}
                                                </span>
                                                {entry.instanceCount > 1 && (
                                                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                                        ×{entry.instanceCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="shrink-0 ml-2">
                                                {matched ? (
                                                    <span className="text-[9px] font-bold text-emerald-300">
                                                        → {matched.fileName} ({matched.width}×{matched.height})
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold uppercase text-amber-400">
                                                        Missing
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {allRequiredEntries.length === 0 && (
                                    <div className="text-center py-4 text-[10px] text-slate-500 font-bold uppercase">
                                        No Isotiles Currently Loaded on Canvas
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pinned Footer */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 bg-slate-900/95 shrink-0">
                        <div className="text-[10px] text-slate-400 font-medium truncate mr-2">
                            {stillNeededCount > 0 ? (
                                <span>
                                    <strong className="text-amber-300">{stillNeededCount}</strong> missing — press{' '}
                                    <strong className="text-white">OK</strong> to replace{' '}
                                    <strong className="text-emerald-300">{matchedEntries.length}</strong> matched.
                                </span>
                            ) : (
                                <span className="text-emerald-400 font-bold">
                                    All {allRequiredEntries.length} tile files matched!
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                            {replacementMap.size > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setReplacementMap(new Map())}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyAndClose}
                                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-950/50 transition-all cursor-pointer"
                            >
                                OK {matchedEntries.length > 0 ? `(Replace ${matchedEntries.length})` : ''}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </DraggableContainer>
    );
};
