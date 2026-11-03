import React, { useRef, useState } from 'react';
import type { HandBrushSettings, ProjectOverlay, CanvasImage, GridType, BrushResizeSampling } from '../../types';
import { PRESET_BRUSHES, BrushPreset } from '../../utils/brushPresets';
import { BRUSH_RESIZE_SAMPLING_OPTIONS } from '../../utils/brushResizeSampling';
import { FilterSlider } from '../ui/FilterSlider';
import DraggableContainer from '../DraggableContainer';
import { HandBrushShpSection } from './HandBrushShpSection';
import { HandBrushNormalColoringSection } from './HandBrushNormalColoringSection';
import { 
    LucideBrush, LucideFolderOpen, LucideLayers, 
    LucidePlus, LucideSparkles, LucideX, 
    LucideChevronDown, LucideChevronUp, LucideMaximize2, LucideMinimize2,
    LucideShuffle, LucideFlipHorizontal, LucideFlipVertical,
    LucidePalette, LucideHistory
} from 'lucide-react';

interface HandBrushPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: HandBrushSettings;
    onUpdateSettings: (updates: Partial<HandBrushSettings>) => void;
    overlays: ProjectOverlay[];
    threeDObjectsCount?: number;
    images: CanvasImage[];
    selectedImageIds: Set<string>;
    gridType: GridType;
    onBakeUnderneath: () => void;
    isBakingUnderneath?: boolean;
    isUndoWindowOpen?: boolean;
    onToggleUndoWindow?: () => void;
    brushHistoryCount?: number;
}

export const HandBrushPanel: React.FC<HandBrushPanelProps> = ({
    isOpen,
    onClose,
    settings,
    onUpdateSettings,
    overlays,
    threeDObjectsCount = 0,
    images,
    selectedImageIds,
    onBakeUnderneath,
    isBakingUnderneath = false,
    isUndoWindowOpen = false,
    onToggleUndoWindow,
    brushHistoryCount = 0
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [isWide, setIsWide] = useState(false);
    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // Collect all brushes configured on any layer in overlays
    const layerBrushes: Array<{ layerName: string; layerId: string; brush: any }> = [];
    overlays.forEach(ov => {
        if (ov.filters.brushes && ov.filters.brushes.length > 0) {
            ov.filters.brushes.forEach(b => {
                layerBrushes.push({ layerName: ov.name, layerId: ov.id, brush: b });
            });
        }
    });

    const handleApplyPreset = (preset: BrushPreset) => {
        onUpdateSettings({
            brushSrc: preset.path,
            brushName: preset.name,
            isShpBrush: false,
            shpShadowSrc: null,
        });
        setShowPresetPicker(false);
    };

    const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                onUpdateSettings({
                    brushSrc: reader.result,
                    brushName: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                    isShpBrush: false,
                    shpShadowSrc: null,
                });
            }
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCopyLayerBrush = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) return;
        const [layerId, brushId] = val.split('::');
        const foundLayer = overlays.find(o => o.id === layerId);
        const foundBrush = foundLayer?.filters.brushes?.find(b => b.id === brushId);
        if (foundBrush) {
            onUpdateSettings({
                brushSrc: foundBrush.src,
                brushName: `${foundBrush.name} (${foundLayer?.name})`,
                isShpBrush: false,
                shpShadowSrc: null,
                mode: foundBrush.mode === 'coloring' ? 'coloring' : (foundBrush.mode === 'normal' ? 'normal' : 'transparency'),
                footprint: foundBrush.footprint ?? 1,
                mainScale: foundBrush.mainScale ?? 100,
                canvasZoom: foundBrush.canvasZoom ?? 100,
                rotation: foundBrush.rotation ?? 0,
                strength: foundBrush.hardness ?? 100,
                invert: !!foundBrush.invert,
                tilingMode: (foundBrush.untransformed || foundBrush.tilingMode === 'untransformed') ? 'untransformed' : 'tiled',
                resizeSampling: foundBrush.resizeSampling ?? 'bicubic',
                hue: foundBrush.hue ?? 0,
                contrast: foundBrush.contrast ?? 100,
                brightness: foundBrush.brightness ?? 100,
                saturation: foundBrush.saturation ?? 100
            });
        }
    };

    const selectedCount = selectedImageIds.size > 0 ? selectedImageIds.size : 0;
    const underOverlaysCount = overlays.filter(ov => ov.placement === 'back' && ov.isVisible && ov.src).length;

    return (
        <DraggableContainer
            initialPos={{ x: 20, y: 75 }}
            size={isMinimized ? { width: isWide ? 440 : 340, height: 46 } : { width: isWide ? 440 : 340, height: 640 }}
            resizable={!isMinimized}
            minWidth={310}
            className="bg-[#1a1f26]/95 border border-cyan-500/40 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden text-slate-200 z-[4500]"
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleCustomFileUpload} 
                accept="image/png,image/jpeg,image/webp" 
                className="hidden" 
            />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20 bg-slate-900/60 select-none">
                <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <LucideBrush className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-cyan-300">Hand Brush</h2>
                        <span className="text-[9px] text-slate-400 font-medium">
                            {settings.onlySelectedTiles
                                ? (selectedCount > 0 ? `${selectedCount} Selected Tile${selectedCount > 1 ? 's' : ''}` : 'Select tiles to brush')
                                : `Brushing All Tiles (${images.length})`}
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-1">
                    {onToggleUndoWindow && (
                        <button
                            type="button"
                            onClick={onToggleUndoWindow}
                            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase transition-all cursor-pointer ${
                                isUndoWindowOpen
                                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-sm'
                                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-cyan-300'
                            }`}
                            title="Open dedicated Brush Undo List window (isolated from app Undo/Redo)"
                        >
                            <LucideHistory size={12} />
                            <span>Undo List{brushHistoryCount > 0 ? ` (${brushHistoryCount})` : ''}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsWide(!isWide)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title={isWide ? "Narrow Window" : "Widen Window"}
                    >
                        {isWide ? <LucideMinimize2 size={13} /> : <LucideMaximize2 size={13} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title={isMinimized ? "Restore" : "Minimize"}
                    >
                        {isMinimized ? <LucideChevronDown size={13} /> : <LucideChevronUp size={13} />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                        title="Close Hand Brush"
                    >
                        <LucideX size={13} />
                    </button>
                </div>
            </div>

            {/* Body */}
            {!isMinimized && (
                <div className="p-3 space-y-2.5 overflow-y-auto flex-1 text-xs scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Selection Scope & Selection Outline Toggles */}
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-slate-700/80">
                        <label
                            className="inline-flex items-center space-x-1.5 cursor-pointer select-none"
                            title="When disabled (default), the hand brush paints across all loaded tiles. Enable to restrict brushing only to selected tiles."
                        >
                            <input
                                type="checkbox"
                                checked={!!settings.onlySelectedTiles}
                                onChange={(e) =>
                                    onUpdateSettings({ onlySelectedTiles: e.target.checked })
                                }
                                className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                            />
                            <span className="text-[10px] font-bold text-slate-200 leading-tight">
                                Only to Selected Tiles
                            </span>
                        </label>

                        <label
                            className="inline-flex items-center space-x-1.5 cursor-pointer select-none"
                            title="Toggle the cyan selection border around selected tiles while brushing"
                        >
                            <input
                                type="checkbox"
                                checked={!!settings.showSelectionBox}
                                onChange={(e) =>
                                    onUpdateSettings({ showSelectionBox: e.target.checked })
                                }
                                className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                            />
                            <span className="text-[10px] font-bold text-slate-200 leading-tight">
                                Show Selection Box
                            </span>
                        </label>
                    </div>

                    {/* Active Brush Card */}
                    <div className="bg-slate-900/80 rounded-xl border border-slate-700/80 p-2.5 space-y-2">
                        <div className="flex items-center space-x-2.5">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-12 h-12 rounded-lg bg-black/70 border border-slate-700 hover:border-cyan-400 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer group/stamp transition-all"
                                title="Click to replace brush image"
                            >
                                <img
                                    src={settings.brushSrc}
                                    alt={settings.brushName}
                                    className={`w-full h-full object-contain p-0.5 group-hover/stamp:scale-105 transition-transform ${settings.invert ? 'filter invert' : ''}`}
                                    style={{ imageRendering: settings.isShpBrush ? 'pixelated' : undefined }}
                                />
                            </button>
                            <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-slate-100 truncate block" title={settings.brushName}>
                                    {settings.brushName}
                                </span>
                                <span className="text-[9px] text-cyan-400 uppercase font-black tracking-wider">
                                    {settings.isShpBrush ? 'Active SHP Sprite Stamp' : 'Active Stamp'}
                                </span>
                            </div>
                        </div>

                        {/* Presets and Upload Buttons */}
                        <div className="flex items-center space-x-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowPresetPicker(!showPresetPicker)}
                                className="flex-1 flex items-center justify-center space-x-1 bg-cyan-700/60 hover:bg-cyan-600 py-1.5 rounded-lg border border-cyan-500/50 text-[10px] font-black uppercase text-white transition-all shadow-sm cursor-pointer"
                            >
                                <LucidePlus className="w-3.5 h-3.5" />
                                <span>Preset</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg border border-slate-700 text-[10px] font-black uppercase text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                                <LucideFolderOpen className="w-3.5 h-3.5" />
                                <span>Load PNG</span>
                            </button>
                        </div>

                        {/* Presets Grid Drawer */}
                        {showPresetPicker && (
                            <div className="p-2 bg-black/80 rounded-lg border border-cyan-500/30 space-y-2 animate-in fade-in duration-150">
                                <div className="flex justify-between items-center text-[10px] font-bold text-cyan-300 uppercase tracking-wide">
                                    <span>Choose Preset Brush</span>
                                    <button 
                                        type="button"
                                        onClick={() => setShowPresetPicker(false)}
                                        className="text-slate-400 hover:text-white text-xs px-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                                    {PRESET_BRUSHES.map(preset => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => handleApplyPreset(preset)}
                                            className="flex flex-col items-center bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-400 rounded-lg p-1 transition-all text-center group"
                                        >
                                            <div className="w-10 h-10 rounded bg-black/60 border border-slate-800 overflow-hidden flex items-center justify-center mb-1">
                                                <img
                                                    src={preset.path}
                                                    alt={preset.name}
                                                    className="w-full h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
                                                />
                                            </div>
                                            <span className="text-[8px] font-medium text-slate-300 group-hover:text-cyan-300 truncate w-full">
                                                {preset.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Option: Use a layer's brush */}
                        <div className="pt-1 border-t border-slate-800">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide flex items-center space-x-1 mb-1">
                                <LucideLayers className="w-3 h-3 text-cyan-400" />
                                <span>Use a Layer's Brush</span>
                            </label>
                            <select
                                onChange={handleCopyLayerBrush}
                                defaultValue=""
                                className="w-full bg-black/70 border border-slate-700 rounded px-2 py-1 text-[10px] text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                            >
                                <option value="" disabled>
                                    {layerBrushes.length > 0 ? "Select brush from existing layers..." : "(No layers have brushes configured)"}
                                </option>
                                {layerBrushes.map((item, idx) => (
                                    <option key={`${item.layerId}::${item.brush.id}::${idx}`} value={`${item.layerId}::${item.brush.id}`}>
                                        {item.layerName} - {item.brush.name} ({item.brush.mode})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* SHP Sprite & Shadow Section */}
                    <HandBrushShpSection
                        settings={settings}
                        onUpdateSettings={onUpdateSettings}
                    />

                    {/* Mode Selector Tabs */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Brush Mode</label>
                        <div className="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-slate-800">
                            {(['transparency', 'coloring', 'normal'] as const).map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => onUpdateSettings({ mode: m })}
                                    className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                                        settings.mode === m 
                                            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30' 
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {m === 'transparency' ? 'Transparency' : (m === 'coloring' ? 'Color' : 'Normal')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Transform, Resize Sampling & Invert Controls */}
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            {/* Projection */}
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Projection</span>
                                <select
                                    value={settings.tilingMode}
                                    onChange={e => onUpdateSettings({ tilingMode: e.target.value as 'tiled' | 'untransformed' })}
                                    className="w-full bg-black/70 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                                >
                                    <option value="tiled">Isometric (2:1 Diamond)</option>
                                    <option value="untransformed">Untransformed (Flat 1:1)</option>
                                </select>
                            </div>

                            {/* Invert */}
                            <div className="flex flex-col justify-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Invert Brush</span>
                                <label className="inline-flex items-center space-x-2 cursor-pointer mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={!!settings.invert}
                                        onChange={e => onUpdateSettings({ invert: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                                    />
                                    <span className="text-[10px] font-bold text-slate-300">Invert White/Black</span>
                                </label>
                            </div>
                        </div>

                        {/* Resize Sampling Method */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Resize Sampling Method</span>
                                <span className="text-[8px] text-slate-500 font-mono">Downscale / Rotate Quality</span>
                            </div>
                            <select
                                value={settings.resizeSampling ?? (settings.isShpBrush ? 'pixel_art' : 'bicubic')}
                                onChange={e => onUpdateSettings({ resizeSampling: e.target.value as BrushResizeSampling })}
                                className="w-full bg-black/70 border border-slate-700 rounded px-2 py-1 text-[10px] text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                            >
                                {BRUSH_RESIZE_SAMPLING_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value} title={opt.description}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Mirror & Randomize Toggles */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            onClick={() => onUpdateSettings({ mirrorH: !settings.mirrorH })}
                            className={`flex items-center justify-center space-x-1 py-1 rounded-lg border text-[9px] font-bold transition-all ${
                                settings.mirrorH 
                                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300' 
                                    : 'bg-black/40 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideFlipHorizontal className="w-3 h-3" />
                            <span>Mirror H</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onUpdateSettings({ mirrorV: !settings.mirrorV })}
                            className={`flex items-center justify-center space-x-1 py-1 rounded-lg border text-[9px] font-bold transition-all ${
                                settings.mirrorV 
                                    ? 'bg-cyan-950 border-cyan-500 text-cyan-300' 
                                    : 'bg-black/40 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                        >
                            <LucideFlipVertical className="w-3 h-3" />
                            <span>Mirror V</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => onUpdateSettings({ randomizeRotation: !settings.randomizeRotation })}
                            className={`flex items-center justify-center space-x-1 py-1 rounded-lg border text-[9px] font-bold transition-all ${
                                settings.randomizeRotation 
                                    ? 'bg-purple-950 border-purple-500 text-purple-300' 
                                    : 'bg-black/40 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title="Randomize rotation upon each press"
                        >
                            <LucideShuffle className="w-3 h-3" />
                            <span>Randomize</span>
                        </button>
                    </div>

                    {/* Core Sliders */}
                    <div className="space-y-1.5 bg-slate-900/40 p-2 rounded-xl border border-slate-800/80">
                        <FilterSlider
                            label="Footprint (Tiles)"
                            min={1}
                            max={20}
                            value={settings.footprint}
                            defaultValue={1}
                            onChange={v => onUpdateSettings({ footprint: v })}
                        />
                        <FilterSlider
                            label="Main Scale"
                            min={10}
                            max={500}
                            value={settings.mainScale}
                            defaultValue={100}
                            onChange={v => onUpdateSettings({ mainScale: v })}
                        />
                        <FilterSlider
                            label="Canvas Zoom"
                            min={50}
                            max={800}
                            value={settings.canvasZoom}
                            defaultValue={100}
                            onChange={v => onUpdateSettings({ canvasZoom: v })}
                        />
                        <FilterSlider
                            label="Rotation"
                            min={0}
                            max={360}
                            value={settings.rotation}
                            defaultValue={0}
                            onChange={v => onUpdateSettings({ rotation: v })}
                        />
                        <FilterSlider
                            label="Strength / Hardness"
                            min={1}
                            max={200}
                            value={settings.strength}
                            defaultValue={100}
                            onChange={v => onUpdateSettings({ strength: v })}
                        />
                    </div>

                    {/* Coloring Controls (when mode === 'coloring') */}
                    {settings.mode === 'coloring' && (
                        <div className="space-y-1.5 p-2 bg-cyan-950/20 border border-cyan-800/50 rounded-xl">
                            <div className="flex items-center space-x-1 text-[10px] font-bold text-cyan-300 uppercase tracking-wide mb-1">
                                <LucidePalette className="w-3 h-3 text-cyan-400" />
                                <span>Coloring Settings</span>
                            </div>
                            <FilterSlider
                                label="Hue"
                                min={-180}
                                max={180}
                                value={settings.hue}
                                defaultValue={0}
                                onChange={v => onUpdateSettings({ hue: v })}
                            />
                            <FilterSlider
                                label="Contrast"
                                min={0}
                                max={200}
                                value={settings.contrast}
                                defaultValue={100}
                                onChange={v => onUpdateSettings({ contrast: v })}
                            />
                            <FilterSlider
                                label="Brightness"
                                min={0}
                                max={200}
                                value={settings.brightness}
                                defaultValue={100}
                                onChange={v => onUpdateSettings({ brightness: v })}
                            />
                            <FilterSlider
                                label="Saturation"
                                min={0}
                                max={200}
                                value={settings.saturation}
                                defaultValue={100}
                                onChange={v => onUpdateSettings({ saturation: v })}
                            />
                        </div>
                    )}

                    {/* Collapsible Coloring & Transparency Controls (when mode === 'normal', collapsed by default) */}
                    {settings.mode === 'normal' && (
                        <HandBrushNormalColoringSection
                            settings={settings}
                            onUpdateSettings={onUpdateSettings}
                        />
                    )}

                    {/* Transparency & Underneath Baking Area */}
                    {settings.mode === 'transparency' && (
                        <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5 text-[10px] font-black uppercase text-amber-300">
                                    <LucideSparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Bake Underneath</span>
                                </div>
                                <span className="text-[9px] text-slate-400">
                                    {underOverlaysCount} Under-Layer{underOverlaysCount !== 1 ? 's' : ''}
                                    {threeDObjectsCount > 0 ? ` • ${threeDObjectsCount} 3D` : ''}
                                </span>
                            </div>

                            <p className="text-[9px] text-slate-400 leading-relaxed">
                                Fills carved transparent areas with whatever shows underneath from background layers and 3D objects.
                            </p>

                            <div className="flex items-center justify-between pt-1">
                                <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!settings.autoBakeUnderneath}
                                        onChange={e => onUpdateSettings({ autoBakeUnderneath: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded bg-black/60 border border-slate-700 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                                    />
                                    <span className="text-[10px] font-bold text-amber-200">Auto-Bake on Release</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={onBakeUnderneath}
                                    disabled={isBakingUnderneath}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase shadow-md shadow-amber-900/30 transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                >
                                    <LucideSparkles className="w-3 h-3" />
                                    <span>{isBakingUnderneath ? "Baking..." : "Bake Underneath"}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DraggableContainer>
    );
};
