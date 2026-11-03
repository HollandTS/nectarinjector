import React, { useState, useRef } from 'react';
import type { CanvasImage, RgbaColor, GridType, OverlayLayer, ProjectOverlay } from '../types';
import { UploadIcon, EyedropperIcon, DownloadIcon, TrashIcon } from './icons';
import { 
    Save as LucideSave, 
    FolderOpen as LucideFolderOpen, 
    RotateCcw as LucideRotateCcw, 
    RotateCw as LucideRotateCw,
    Layers as LucideLayers, 
    Sliders as LucideSliders,
    Files as LucideFiles,
    Settings as LucideSettings
} from 'lucide-react';

interface ControlPanelProps {
    onFilesChange: (files: FileList) => void;
    onClearCanvas: () => void;
    onExecuteCommand: (prompt: string) => void;
    onApplyChanges: () => void;
    onDownloadAll: () => void;
    transparencyColor: RgbaColor | null;
    setTransparencyColor: (color: RgbaColor | null) => void;
    tolerance: number;
    setTolerance: (v: number) => void;
    isEyedropperActive: boolean;
    setIsEyedropperActive: (isActive: boolean) => void;
    images: CanvasImage[];
    setImages: React.Dispatch<React.SetStateAction<CanvasImage[]>>;
    gridType: GridType;
    setGridType: (type: GridType) => void;
    overlayOpacity: number;
    setOverlayOpacity: (opacity: number) => void;
    overlayLayer: OverlayLayer;
    setOverlayLayer: (layer: OverlayLayer) => void;
    zoom: number;
    setZoom: (v: number) => void;
    setOverlays: React.Dispatch<React.SetStateAction<ProjectOverlay[]>>;
    onUndo: () => void;
    canUndo: boolean;
    onRedo: () => void;
    canRedo: boolean;
    onSaveTemplate: () => void;
    onLoadTemplate: (file: File) => void;
    onLoadLegacyJson: (file: File) => void;
    saveIsotilesAsPng: boolean;
    setSaveIsotilesAsPng: (v: boolean) => void;
    includeThreeDInTemplate?: boolean;
    setIncludeThreeDInTemplate?: (v: boolean) => void;
    useTransparencyToDrag?: boolean;
    setUseTransparencyToDrag?: (v: boolean) => void;
    templateName: string;
    setTemplateName: (name: string) => void;
    onOpenLibrary?: () => void;
    onOpenStampTool?: () => void;
    isStampToolOpen?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
    const [isDragOverImages, setIsDragOverImages] = useState(false);
    const [showToleranceSlider, setShowToleranceSlider] = useState(false);
    const [showExportSettings, setShowExportSettings] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const templateInputRef = useRef<HTMLInputElement>(null);
    const legacyInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => fileInputRef.current?.click();
    const handleTemplateClick = () => templateInputRef.current?.click();
    const handleLegacyClick = () => legacyInputRef.current?.click();

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOverImages(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            props.onFilesChange(e.dataTransfer.files);
        }
    };

    const colorStyle = props.transparencyColor
        ? { backgroundColor: `rgba(${props.transparencyColor.r}, ${props.transparencyColor.g}, ${props.transparencyColor.b}, ${props.transparencyColor.a})` }
        : {};

    return (
        <>
            {/* FLOATING HEADER (Top Left) */}
            <div className="fixed top-4 left-4 z-[490] flex items-center space-x-2 bg-[#161b22]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-705/60 shadow-xl">
                <img 
                    src="https://raw.githubusercontent.com/HollandTS/retro_building_generator/refs/heads/main/logo/sugarkane_logo.png" 
                    alt="Sugarkane Logo" 
                    className="h-5 w-auto object-contain" 
                />
                <span className="text-[11px] font-black uppercase text-cyan-400 tracking-tighter">Nectar Injector</span>
            </div>

            {/* FLOATING VIEWPORT ZOOM STATUS (Bottom Left) */}
            <div className="fixed bottom-4 left-4 z-[490] bg-[#161b22]/95 backdrop-blur-md border border-slate-700/60 p-2 rounded-xl flex flex-col items-center shadow-lg">
                <span className="text-[9px] font-black uppercase text-slate-500 mb-1 tracking-wider">Viewport</span>
                <div className="flex items-center space-x-1">
                    <button 
                        onClick={() => props.setZoom(Math.max(props.zoom - 0.2, 0.2))} 
                        className="w-6 h-6 flex items-center justify-center bg-[#30363d] hover:bg-[#3b424b] text-slate-200 border border-slate-700 rounded text-xs font-bold transition-all focus:outline-none"
                        title="Zoom Out"
                    >
                        -
                    </button>
                    <button 
                        onClick={() => props.setZoom(1)} 
                        className="px-1.5 min-w-[34px] h-6 flex items-center justify-center bg-[#30363d] hover:bg-[#3b424b] text-cyan-400 border border-slate-700 rounded text-[9px] font-black transition-all focus:outline-none"
                        title="Reset Zoom"
                    >
                        {Math.round(props.zoom * 100)}%
                    </button>
                    <button 
                        onClick={() => props.setZoom(Math.min(props.zoom + 0.2, 8))} 
                        className="w-6 h-6 flex items-center justify-center bg-[#30363d] hover:bg-[#3b424b] text-slate-200 border border-slate-700 rounded text-xs font-bold transition-all focus:outline-none"
                        title="Zoom In"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* MAIN PORTABLE VERTICAL BAR (Left Center Floating) */}
            <aside className="fixed left-4 top-20 z-[490] bg-[#161b22]/95 backdrop-blur-lg border border-slate-700/60 p-2 rounded-2xl shadow-2xl flex flex-col items-center space-y-3.5 text-slate-300 w-16">
                
                {/* 1. PROJECT FILES & WIPE (Import files and .pal) */}
                <div className="flex flex-col items-center space-y-2">
                    <input
                        type="file"
                        multiple
                        accept="image/*,.pal,.tmp,.tem,.sno,.til,.des,.urb,.ubn,.lun"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                props.onFilesChange(e.target.files);
                            }
                            e.target.value = '';
                        }}
                    />
                    <div 
                        onDragOver={(e) => { e.preventDefault(); setIsDragOverImages(true); }}
                        onDragLeave={() => setIsDragOverImages(false)}
                        onDrop={handleDrop}
                        className={`transition-all duration-200 border border-dashed rounded-lg p-0.5 ${isDragOverImages ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700/60'}`}
                    >
                        <button 
                            onClick={handleUploadClick} 
                            className="w-10 h-10 flex items-center justify-center rounded bg-[#30363d] text-slate-200 hover:bg-[#3b424b] border border-slate-700 transition-all focus:outline-none"
                            title="Import tiles (and .pal)"
                        >
                            <UploadIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <button 
                        onClick={props.onClearCanvas} 
                        className="w-10 h-10 flex items-center justify-center rounded bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/30 transition-all focus:outline-none"
                        title="Wipe Project"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="w-8 h-[1px] bg-slate-700/50"></div>

                {/* 2. SAVED TEMPLATES (Compact with Icons and Underneath Legacy Button) */}
                <div className="flex flex-col items-center space-y-2">
                    <input
                        type="file"
                        accept=".tileproject,application/json"
                        ref={templateInputRef}
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files?.[0]) {
                                props.onLoadTemplate(e.target.files[0]);
                            }
                            e.target.value = '';
                        }}
                    />
                    <input
                        type="file"
                        accept="application/json"
                        ref={legacyInputRef}
                        className="hidden"
                        onChange={(e) => {
                            if (e.target.files?.[0]) {
                                props.onLoadLegacyJson(e.target.files[0]);
                            }
                            e.target.value = '';
                        }}
                    />
                    {/* Tiny Template Name (truncates to 4 letters, click to edit) */}
                    <div className="flex items-center justify-center pb-0.5">
                        {isEditingName ? (
                            <input
                                type="text"
                                value={props.templateName}
                                onChange={(e) => props.setTemplateName(e.target.value)}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false); }}
                                className="w-11 bg-[#161b22] text-[#c9d1d9] border border-[#30363d] rounded text-[8px] font-bold text-center focus:outline-none"
                                autoFocus
                            />
                        ) : (
                            <button
                                onClick={() => setIsEditingName(true)}
                                className="text-[7.5px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/20 border border-cyan-500/20 rounded px-1 py-0.5 hover:bg-cyan-900/30 hover:text-cyan-300 transition-all cursor-pointer select-none text-center truncate max-w-[45px]"
                                title={`Click to rename template: ${props.templateName}`}
                            >
                                {(props.templateName || 'PROJ').substring(0, 4)}
                            </button>
                        )}
                    </div>

                    <div className="flex space-x-1.5">
                        <button 
                            onClick={props.onSaveTemplate} 
                            className="w-6 h-6 flex items-center justify-center rounded bg-[#30363d] text-slate-200 border border-slate-700 hover:bg-[#3b424b] focus:outline-none transition-all"
                            title="Save Template"
                        >
                            <LucideSave className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handleTemplateClick} 
                            className="w-6 h-6 flex items-center justify-center rounded bg-[#30363d] text-slate-200 border border-slate-700 hover:bg-[#3b424b] focus:outline-none transition-all"
                            title="Load Template"
                        >
                            <LucideFolderOpen className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    
                    {/* Tiny Legacy underneath */}
                    <button 
                        onClick={handleLegacyClick} 
                        className="text-[7.5px] font-black uppercase tracking-tight bg-amber-950/20 hover:bg-amber-800/40 text-amber-500 border border-amber-500/30 px-1 py-0.5 rounded focus:outline-none transition-all w-11 text-center truncate"
                        title="Load legacy Westwood project files"
                    >
                        LGCY
                    </button>
                </div>

                <div className="w-8 h-[1px] bg-slate-700/50"></div>

                {/* 3. GRID SETTINGS (Compact label + dropdown) */}
                <div className="bg-[#0c1015] border border-slate-700/60 rounded p-1 w-14 flex flex-col items-center">
                    <span className="text-[8px] text-slate-500 block font-black uppercase tracking-wider mb-0.5">grid</span>
                    <select 
                        value={props.gridType}
                        onChange={(e) => props.setGridType(e.target.value as GridType)}
                        className="w-full bg-transparent border-none p-0 text-[9px] font-black text-cyan-400 text-center appearance-none cursor-pointer focus:outline-none"
                    >
                        <option value="none" className="bg-[#161b22] text-xs">OFF</option>
                        <option value="ts_full" className="bg-[#161b22] text-xs">TS</option>
                        <option value="ra2_full" className="bg-[#161b22] text-xs">RA2</option>
                        <option value="opents_full" className="bg-[#161b22] text-xs">OPENTS</option>
                    </select>
                </div>

                <div className="w-8 h-[1px] bg-slate-700/50"></div>

                {/* 5. TRANSPARENCY KEY & SENSITIVITY POPUP */}
                <div className="flex flex-col items-center space-y-1 relative">
                    <span className="text-[8px] text-slate-500 font-extrabold uppercase tracking-widest mb-0.5">key</span>
                    <button
                        onClick={() => props.setIsEyedropperActive(!props.isEyedropperActive)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${props.isEyedropperActive ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-[#30363d] border-slate-700 text-slate-400 hover:text-slate-200'}`}
                        title="Pick transparency key color from canvas"
                    >
                        <EyedropperIcon className="w-4 h-4" />
                    </button>

                    {/* Color Display Rectangle */}
                    <div className="w-8 h-4 rounded border border-slate-600/80 shadow-md" style={colorStyle} title="Active Transparency Key Color"></div>

                    {/* Sensitivity toggle */}
                    <button
                        onClick={() => setShowToleranceSlider(!showToleranceSlider)}
                        className={`w-6 h-6 rounded flex items-center justify-center border transition-all mt-1 ${showToleranceSlider ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-[#30363d] border-slate-700 text-slate-400 hover:bg-[#3b424b]'}`}
                        title="Adjust Sensitivity"
                    >
                        <LucideSliders className="w-3.5 h-3.5" />
                    </button>

                    {showToleranceSlider && (
                        <div className="absolute left-14 bottom-0 bg-[#161b22]/95 border border-slate-700/60 p-2 px-2.5 rounded-xl shadow-2xl w-36 z-[480] text-left animate-in slide-in-from-left-2 duration-150 space-y-2">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] uppercase font-black text-slate-400">Tolerance</span>
                                    <span className="text-[9px] text-cyan-400 font-mono font-bold">{props.tolerance}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="255" value={props.tolerance} 
                                    onChange={(e) => props.setTolerance(parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
                                />
                            </div>
                            {props.transparencyColor && (
                                <button
                                    onClick={() => props.setTransparencyColor(null)}
                                    className="w-full text-center text-[8.5px] font-black uppercase tracking-tight bg-red-950/20 hover:bg-red-800/40 text-red-400 border border-red-500/30 py-1 rounded focus:outline-none transition-all cursor-pointer"
                                    title="Disable transparency color keying"
                                >
                                    Remove Key
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="w-8 h-[1px] bg-slate-700/50"></div>

                {/* 6. SYSTEM LEVEL ACTIONS (Undo, Redo, Bake, ZIP Export) */}
                <div className="mt-auto flex flex-col items-center space-y-2.5 w-full">
                    {/* Undo / Redo Row */}
                    <div className="flex items-center justify-between w-full gap-1 px-1">
                        <button 
                            onClick={props.onUndo} 
                            disabled={!props.canUndo}
                            className={`flex-1 h-8 flex items-center justify-center rounded border transition-all ${props.canUndo ? 'bg-orange-950/20 text-orange-400 border-orange-500/30 hover:bg-orange-600/20' : 'text-slate-600 border-slate-850 opacity-30 cursor-not-allowed'}`}
                            title="Undo (Ctrl+Z)"
                        >
                            <LucideRotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={props.onRedo} 
                            disabled={!props.canRedo}
                            className={`flex-1 h-8 flex items-center justify-center rounded border transition-all ${props.canRedo ? 'bg-orange-950/20 text-orange-400 border-orange-500/30 hover:bg-orange-600/20' : 'text-slate-600 border-slate-850 opacity-30 cursor-not-allowed'}`}
                            title="Redo (Ctrl+Y)"
                        >
                            <LucideRotateCw className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Export as ZIP package and Settings Gear */}
                    <div className="flex items-center space-x-1.5 w-full justify-center relative">
                        <button 
                            onClick={props.onDownloadAll} 
                            className="flex-grow max-w-[48px] h-10 flex items-center justify-center rounded bg-emerald-700 hover:bg-emerald-600 text-white shadow-md border border-emerald-500/30 transition-all focus:outline-none"
                            title="Download package as ZIP archive"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setShowExportSettings(!showExportSettings)} 
                            className={`w-8 h-10 flex items-center justify-center rounded border transition-all focus:outline-none ${showExportSettings ? 'bg-cyan-950/40 border-cyan-500 text-cyan-400 shadow-cyan-900/10' : 'bg-[#3b424b]/40 hover:bg-[#3b424b]/85 text-slate-400 hover:text-slate-200 border-slate-700'}`}
                            title="Export Settings"
                        >
                            <LucideSettings className="w-4 h-4 text-slate-300" />
                        </button>

                        {showExportSettings && (
                            <div className="absolute left-14 bottom-0 bg-[#161b22]/95 border border-slate-700 p-3 rounded-xl shadow-2xl w-56 z-[480] text-left animate-in slide-in-from-left-2 duration-150 space-y-3">
                                <div className="space-y-1.5">
                                    <span className="text-[9px] uppercase font-black text-slate-400 block border-b border-slate-800 pb-1.5">Main Settings</span>
                                    <label className="flex items-start space-x-2 cursor-pointer group text-slate-300 hover:text-slate-100 py-0.5">
                                        <input 
                                            type="checkbox" 
                                            checked={props.useTransparencyToDrag ?? true} 
                                            onChange={(e) => props.setUseTransparencyToDrag?.(e.target.checked)}
                                            className="mt-0.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30 accent-cyan-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] leading-tight select-none font-semibold">Use transparency to drag</span>
                                    </label>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[9px] uppercase font-black text-slate-400 block border-b border-slate-800 pb-1.5">Template Settings</span>
                                    <label className="flex items-start space-x-2 cursor-pointer group text-slate-300 hover:text-slate-100 py-0.5">
                                        <input 
                                            type="checkbox" 
                                            checked={props.includeThreeDInTemplate ?? true} 
                                            onChange={(e) => props.setIncludeThreeDInTemplate?.(e.target.checked)}
                                            className="mt-0.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30 accent-cyan-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] leading-tight select-none font-semibold">Include 3D files in saved template</span>
                                    </label>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[9px] uppercase font-black text-slate-400 block border-b border-slate-800 pb-1.5">Export Settings</span>
                                    <label className="flex items-start space-x-2 cursor-pointer group text-slate-300 hover:text-slate-100 py-0.5">
                                        <input 
                                            type="checkbox" 
                                            checked={props.saveIsotilesAsPng} 
                                            onChange={(e) => props.setSaveIsotilesAsPng(e.target.checked)}
                                            className="mt-0.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30 accent-cyan-500 cursor-pointer"
                                        />
                                        <span className="text-[10px] leading-tight select-none font-semibold">Save isotiles as png instead</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default ControlPanel;
