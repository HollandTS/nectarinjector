import React, { useState, useRef } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { CanvasImage, RgbaColor, ProjectOverlay, GridType } from '../../types';
import { TrashIcon } from '../icons';
import { ChangeGameFilesModal } from '../modals/ChangeGameFilesModal';
import { ExtraImageStudioModal } from '../modals/ExtraImageStudioModal';
import { IsotileHeightControls } from './IsotileHeightControls';
import { getTileRampSummary } from '../../utils/waeRampHelper';
import {
    LucideGrid,
    LucideMinus,
    LucideMaximize2,
    LucideX,
    LucideUpload,
    LucideCheckSquare,
    LucideSquare,
    LucideTrash2,
    LucideFlipHorizontal,
    LucideFlipVertical,
    LucideSearch,
    LucideSparkles,
    LucideLayoutGrid,
    LucideLayers,
    LucideRefreshCw,
} from 'lucide-react';

interface IsotilesPanelProps {
    isOpen: boolean;
    onClose: () => void;
    images: CanvasImage[];
    selectedImageIds: Set<string>;
    setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    onRemoveImage: (id: string) => void;
    onRemoveSelectedImages: () => void;
    onFilesChange?: (files: FileList) => void;
    onOpenLibrary?: () => void;
    onFlip?: (axis: 'h' | 'v') => void;
    onPackIsometric?: () => void;
    onColorPack?: () => void;
    onTurnToLayer?: () => void;
    onOpenSeamlessMaker?: () => void;
    onReplaceImages?: (updatedImages: CanvasImage[]) => void;
    overlays?: ProjectOverlay[];
    gridType?: GridType;
    transparencyColor?: RgbaColor | null;
    tolerance?: number;
    cellHeight?: number;
    autoSlopeSnap?: boolean;
    onToggleAutoSlopeSnap?: (enabled: boolean) => void;
    onAdjustHeightLevel?: (delta: number) => void;
    onResetHeightLevel?: () => void;
    onAutoMatchRampHeights?: () => void;
}

export const IsotilesPanel: React.FC<IsotilesPanelProps> = ({
    isOpen,
    onClose,
    images,
    selectedImageIds,
    setSelectedImageIds,
    onRemoveImage,
    onRemoveSelectedImages,
    onFilesChange,
    onOpenLibrary,
    onFlip,
    onPackIsometric,
    onColorPack,
    onTurnToLayer,
    onOpenSeamlessMaker,
    onReplaceImages,
    overlays = [],
    gridType = 'ts_full',
    transparencyColor = null,
    tolerance = 1,
    cellHeight = 24,
    autoSlopeSnap = true,
    onToggleAutoSlopeSnap,
    onAdjustHeightLevel,
    onResetHeightLevel,
    onAutoMatchRampHeights,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isChangeGameFilesOpen, setIsChangeGameFilesOpen] = useState(false);
    const [isExtraImageStudioOpen, setIsExtraImageStudioOpen] = useState(false);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
        width: 340,
        height: 480,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectAll = () => {
        if (selectedImageIds.size === images.length && images.length > 0) {
            setSelectedImageIds(new Set());
        } else {
            setSelectedImageIds(new Set(images.map(i => i.id)));
        }
    };

    const handleToggleTile = (id: string, e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
            setSelectedImageIds(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
            });
        } else {
            setSelectedImageIds(prev => {
                if (prev.size === 1 && prev.has(id)) return new Set();
                return new Set([id]);
            });
        }
    };

    return (
        <>
        <DraggableContainer
            initialPos={{ x: 90, y: 75 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={300}
            minHeight={isMinimized ? 52 : 300}
            className="bg-[#161b22]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-[1100] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Draggable Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 bg-slate-900/80 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <LucideGrid className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-white leading-tight">
                            Isotiles Studio
                        </h2>
                        <p className="text-[10px] text-slate-400 font-medium">
                            {images.length} Loaded · {selectedImageIds.size} Selected
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
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
                        title="Close Isotiles Window"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-3.5 space-y-3 overflow-y-auto flex-1 flex flex-col scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Top Action Row */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {onFilesChange && (
                            <>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pal,.tmp,.tem,.sno,.til,.des,.urb,.ubn,.lun"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={(e) => e.target.files && onFilesChange(e.target.files)}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 bg-amber-600 hover:bg-amber-500 py-2 px-2.5 rounded-xl text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
                                    title="Import Isotiles (.tmp, .tem, .sno, .png, etc.)"
                                >
                                    <LucideUpload className="w-3.5 h-3.5 shrink-0" />
                                    <span>Import Tiles</span>
                                </button>
                            </>
                        )}
                        {onOpenLibrary && (
                            <button
                                type="button"
                                onClick={onOpenLibrary}
                                className="bg-amber-950/70 hover:bg-amber-800/80 border border-amber-500/40 py-2 px-2.5 rounded-xl text-amber-300 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 shadow-md cursor-pointer shrink-0"
                                title="Open Tile Library"
                            >
                                <LucideSparkles className="w-3.5 h-3.5" />
                                <span>Library</span>
                            </button>
                        )}
                    </div>

                    {/* Quick Tile Tools Bar */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2 space-y-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Quick Tile Tools
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    disabled={images.length === 0}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[9px] font-bold uppercase text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                                    title={selectedImageIds.size === images.length ? 'Deselect All Tiles' : 'Select All Tiles'}
                                >
                                    {selectedImageIds.size === images.length && images.length > 0 ? (
                                        <LucideCheckSquare className="w-3 h-3 text-amber-400" />
                                    ) : (
                                        <LucideSquare className="w-3 h-3 text-slate-400" />
                                    )}
                                    <span>{selectedImageIds.size === images.length && images.length > 0 ? 'None' : 'All'}</span>
                                </button>
                                {selectedImageIds.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={onRemoveSelectedImages}
                                        className="px-2 py-1 rounded bg-red-950/50 hover:bg-red-800/60 border border-red-500/30 text-[9px] font-bold uppercase text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Delete Selected Tiles"
                                    >
                                        <LucideTrash2 className="w-3 h-3" />
                                        <span>Del ({selectedImageIds.size})</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1">
                            {onFlip && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => onFlip('h')}
                                        className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                        title="Flip Horizontal"
                                    >
                                        <LucideFlipHorizontal className="w-3 h-3 text-amber-400" />
                                        <span>Flip H</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onFlip('v')}
                                        className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                        title="Flip Vertical"
                                    >
                                        <LucideFlipVertical className="w-3 h-3 text-amber-400" />
                                        <span>Flip V</span>
                                    </button>
                                </>
                            )}
                            {onPackIsometric && (
                                <button
                                    type="button"
                                    onClick={onPackIsometric}
                                    className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                    title="Pack Isometric"
                                >
                                    <LucideLayoutGrid className="w-3 h-3 text-cyan-400" />
                                    <span>Iso Pack</span>
                                </button>
                            )}
                            {onColorPack && (
                                <button
                                    type="button"
                                    onClick={onColorPack}
                                    className="py-1.5 px-2 rounded-lg bg-[#1c2128] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                    title="Pack by Color"
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span>Color Pack</span>
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {onOpenSeamlessMaker && (
                                <button
                                    type="button"
                                    onClick={onOpenSeamlessMaker}
                                    disabled={images.length === 0}
                                    className="w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/40 text-emerald-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                    title="Open Seamless Maker (OpenTS Anti-Tessellation & Edge Transition Editor)"
                                >
                                    <LucideSparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>
                                        Seamless Maker {selectedImageIds.size > 0 ? `(${selectedImageIds.size} Selected)` : ''}
                                    </span>
                                </button>
                            )}

                            {onTurnToLayer && (
                                <button
                                    type="button"
                                    onClick={onTurnToLayer}
                                    disabled={selectedImageIds.size === 0}
                                    className="w-full py-2 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/35 disabled:opacity-40 disabled:cursor-not-allowed border border-cyan-500/40 text-cyan-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                    title="Un-transform selected isotiles into flat textures and create a tiled layer (with extra tiles as additional textures)"
                                >
                                    <LucideLayers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    <span>
                                        Turn to Layer {selectedImageIds.size > 0 ? `(${selectedImageIds.size} Selected)` : '(Select Tiles)'}
                                    </span>
                                </button>
                            )}

                            {onReplaceImages && (
                                <button
                                    type="button"
                                    onClick={() => setIsExtraImageStudioOpen(true)}
                                    disabled={images.length === 0}
                                    className="w-full py-2 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 disabled:opacity-40 disabled:cursor-not-allowed border border-purple-500/40 text-purple-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                    title="Smartly detect 3D scattered models or 2D layers around selected tiles and bake into Westwood ExtraImage & Z-Data"
                                >
                                    <LucideMaximize2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <span>
                                        Extra-Image &amp; Z-Data Baker {selectedImageIds.size > 0 ? `(${selectedImageIds.size})` : ''}
                                    </span>
                                </button>
                            )}

                            {onReplaceImages && (
                                <button
                                    type="button"
                                    onClick={() => setIsChangeGameFilesOpen(true)}
                                    disabled={images.length === 0}
                                    className="w-full py-2 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/40 text-amber-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                    title="Replace loaded isotiles with files of the same base name from another game (disregarding extension, e.g. .tem to .urb)"
                                >
                                    <LucideRefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>Change game-files TS/YR/OTS</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {onAdjustHeightLevel && onResetHeightLevel && onAutoMatchRampHeights && onToggleAutoSlopeSnap && (
                        <IsotileHeightControls
                            images={images}
                            selectedImageIds={selectedImageIds}
                            cellHeight={cellHeight}
                            autoSlopeSnap={autoSlopeSnap}
                            onToggleAutoSlopeSnap={onToggleAutoSlopeSnap}
                            onAdjustHeightLevel={onAdjustHeightLevel}
                            onResetHeightLevel={onResetHeightLevel}
                            onAutoMatchRampHeights={onAutoMatchRampHeights}
                        />
                    )}

                    {/* Search Filter */}
                    <div className="relative shrink-0">
                        <LucideSearch className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter loaded isotiles..."
                            className="w-full bg-black/40 border border-slate-700/70 rounded-lg pl-8 pr-6 py-1.5 text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-[10px]"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Loaded Isotiles List */}
                    <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin scrollbar-thumb-slate-700/60">
                        {filteredImages.map((image) => {
                            const isSelected = selectedImageIds.has(image.id);
                            const rampSummary = getTileRampSummary(image);
                            const lv = image.heightLevel ?? 0;
                            return (
                                <div
                                    key={image.id}
                                    onClick={(e) => handleToggleTile(image.id, e)}
                                    className={`p-1.5 rounded-lg flex items-center justify-between group border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-sm'
                                            : 'bg-[#1c2128]/90 border-slate-700/40 hover:border-slate-600/70 text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center min-w-0 flex-1 mr-2">
                                        <div className="w-7 h-7 rounded bg-black/40 border border-slate-700/50 flex items-center justify-center mr-2 shrink-0 overflow-hidden">
                                            <img
                                                src={image.src}
                                                alt={image.name}
                                                className="w-full h-full object-contain"
                                                style={{ imageRendering: 'pixelated' }}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] truncate font-mono font-bold">
                                                {image.name}
                                            </div>
                                            <div className="text-[8px] text-slate-500 font-mono tabular-nums truncate">
                                                {image.width}×{image.height}px · ({image.gridX}, {image.gridY})
                                                {lv !== 0 ? ` · Lv ${lv > 0 ? `+${lv}` : lv}` : ''}
                                                {rampSummary ? ` · ${rampSummary}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveImage(image.id);
                                        }}
                                        className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition-colors"
                                        title="Remove tile"
                                    >
                                        <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })}

                        {filteredImages.length === 0 && (
                            <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                                    {images.length === 0 ? 'No Isotiles Loaded' : 'No Matching Isotiles'}
                                </p>
                                <p className="text-[9px] text-slate-600 mt-1">
                                    {images.length === 0
                                        ? 'Import .tmp/.png files or drag & drop tiles onto canvas'
                                        : 'Try a different search filter'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DraggableContainer>

        <ChangeGameFilesModal
            isOpen={isChangeGameFilesOpen}
            onClose={() => setIsChangeGameFilesOpen(false)}
            images={images}
            transparencyColor={transparencyColor}
            tolerance={tolerance}
            onCommitReplacements={(updatedImages) => {
                if (onReplaceImages) onReplaceImages(updatedImages);
            }}
        />

        <ExtraImageStudioModal
            isOpen={isExtraImageStudioOpen}
            onClose={() => setIsExtraImageStudioOpen(false)}
            images={images}
            selectedImageIds={selectedImageIds}
            overlays={overlays}
            gridType={gridType}
            onCommitImages={(updatedImages) => {
                if (onReplaceImages) onReplaceImages(updatedImages);
            }}
        />
        </>
    );
};

