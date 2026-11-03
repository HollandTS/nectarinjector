
import React, { useState, useRef } from 'react';
import { ToolbarButton } from '../ui/ToolbarButton';
import { LatsMenu } from './LatsMenu';
import { LatOption } from '../../services/latsService';
import { LucideBrush, LucideGrid, LucideLock, LucideUnlock, LucideArrowUpDown, LucideSparkles } from 'lucide-react';

export type ActiveControlType = '3d' | 'layers' | 'tiles';

interface MainToolbarProps {
    onFlip: (axis: 'h' | 'v') => void;
    handleNudge: (dx: number, dy: number) => void;
    onPackIsometric: () => void;
    onColorPack: () => void;
    setShowTextureInjection: (v: boolean) => void;
    showTextureInjection: boolean;
    customGrid: { width: number; height: number };
    onApplyCustomGrid: () => void;
    onGenerateTexture: (prompt: string, isFourInOne: boolean) => void;
    onLoadTexture: (src: string) => void;
    onLoadOverlay: (src: string) => void;
    isThreeDMode: boolean;
    setIsThreeDMode: (v: boolean) => void;
    showThreeDObjects: boolean;
    setShowThreeDObjects: (v: boolean) => void;
    isSnapEnabled: boolean;
    setIsSnapEnabled: (v: boolean) => void;
    onOpenStampTool: () => void;
    isStampToolOpen: boolean;
    previewMaskId: string | null;
    setPreviewMaskId: (id: string | null) => void;
    activeOverlayId: string | null;
    onOpenDepthToImage: () => void;
    selectedImageCount: number;
    showLayers: boolean;
    setShowLayers: (v: boolean) => void;
    showIsotilesWindow: boolean;
    setShowIsotilesWindow: (v: boolean) => void;
    showSceneOrganizer?: boolean;
    setShowSceneOrganizer?: (v: boolean) => void;
    showSeamlessMaker?: boolean;
    setShowSeamlessMaker?: (v: boolean) => void;
    activeControlType: ActiveControlType;
    setActiveControlType: (v: ActiveControlType) => void;
    isControlIsolated: boolean;
    setIsControlIsolated: (v: boolean) => void;
    onSelectLatOption?: (option: LatOption) => void;
    isLatLoading?: boolean;
    isHandBrushOpen?: boolean;
    onToggleHandBrush?: () => void;
}

export const MainToolbar: React.FC<MainToolbarProps> = ({
    onFlip, handleNudge, onPackIsometric, onColorPack, setShowTextureInjection, showTextureInjection, onGenerateTexture, onLoadTexture, onLoadOverlay, isThreeDMode, setIsThreeDMode, showThreeDObjects, setShowThreeDObjects, isSnapEnabled, setIsSnapEnabled, onOpenStampTool, isStampToolOpen, previewMaskId, setPreviewMaskId, activeOverlayId, onOpenDepthToImage, selectedImageCount, showLayers, setShowLayers, showIsotilesWindow, setShowIsotilesWindow, showSceneOrganizer = false, setShowSceneOrganizer, showSeamlessMaker = false, setShowSeamlessMaker, activeControlType, setActiveControlType, isControlIsolated, setIsControlIsolated, onSelectLatOption, isLatLoading, isHandBrushOpen = false, onToggleHandBrush
}) => {
    const [isAiGenOpen, setIsAiGenOpen] = useState(false);
    const [texPrompt, setTexPrompt] = useState('mossy stone');
    const [isFourInOne, setIsFourInOne] = useState(false);
    
    const texInputRef = useRef<HTMLInputElement>(null);
    const overlayInputRef = useRef<HTMLInputElement>(null);

    const handleTexFile = (f: File) => {
        const r = new FileReader();
        r.onload = (e) => onLoadTexture(e.target?.result as string);
        r.readAsDataURL(f);
    };

    const handleOverlayFile = (f: File) => {
        const r = new FileReader();
        r.onload = (e) => onLoadOverlay(e.target?.result as string);
        r.readAsDataURL(f);
    };

    const handleClickThreeDMode = () => {
        const next = !isThreeDMode;
        setIsThreeDMode(next);
        if (next) {
            setActiveControlType('3d');
        }
    };

    const handleClickLayersMode = () => {
        const next = !showLayers;
        setShowLayers(next);
        setActiveControlType('layers');
        if (isThreeDMode && isControlIsolated) {
            setIsThreeDMode(false);
        }
    };

    const handleClickTilesMode = () => {
        const next = !showIsotilesWindow;
        setShowIsotilesWindow(next);
        setActiveControlType('tiles');
        if (isThreeDMode && isControlIsolated) {
            setIsThreeDMode(false);
        }
    };

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#161b22]/95 backdrop-blur-lg border border-slate-700/60 p-2 px-4 rounded-full shadow-2xl flex items-center space-x-3 z-[500] transition-all">
            {/* Nudge Navigation Controls */}
            <div className="flex items-center space-x-1">
                <ToolbarButton onClick={() => handleNudge(0, -1)} title="Up"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth="3"/></svg></ToolbarButton>
                <ToolbarButton onClick={() => handleNudge(0, 1)} title="Down"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="3"/></svg></ToolbarButton>
                <ToolbarButton onClick={() => handleNudge(-1, 0)} title="Left"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="3"/></svg></ToolbarButton>
                <ToolbarButton onClick={() => handleNudge(1, 0)} title="Right"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="3"/></svg></ToolbarButton>
            </div>
            
            <div className="w-[1px] h-6 bg-slate-700/50"></div>
            
            {/* MAJOR MODES & WINDOWS SECTION */}
            <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-full border border-slate-700/60 shadow-inner">
                <ToolbarButton 
                    onClick={() => setShowTextureInjection(!showTextureInjection)} 
                    title="Texture Injection" 
                    className={`px-2 py-1 flex items-center ${
                        showTextureInjection 
                            ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-md' 
                            : 'text-slate-300 hover:text-white'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" strokeWidth="2"/>
                        <path d="M8 8h8v8H8z" strokeWidth="2"/>
                    </svg>
                </ToolbarButton>

                <ToolbarButton 
                    onClick={handleClickThreeDMode} 
                    title={`3D Mode${isControlIsolated && activeControlType === '3d' ? ' (Isolated Control)' : ''}`} 
                    className={`px-2 py-1 flex items-center relative ${
                        isThreeDMode || (isControlIsolated && activeControlType === '3d')
                            ? 'bg-purple-500/25 text-purple-300 border-purple-500/60 shadow-md' 
                            : 'text-slate-300 hover:text-white'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeWidth="2"/>
                        <path d="M3.27 6.96L12 12.01l8.73-5.05" strokeWidth="2"/>
                        <path d="M12 22.08V12" strokeWidth="2"/>
                    </svg>
                    {activeControlType === '3d' && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400" />
                    )}
                </ToolbarButton>

                <ToolbarButton 
                    onClick={handleClickLayersMode} 
                    title={`${showLayers ? "Hide Layers Window" : "Show Layers Window"} · Control Layers${isControlIsolated && activeControlType === 'layers' ? ' (Isolated)' : ''}`} 
                    className={`px-2 py-1 flex items-center relative ${
                        showLayers || (isControlIsolated && activeControlType === 'layers')
                            ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/60 shadow-md' 
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" />
                    </svg>
                    {activeControlType === 'layers' && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                </ToolbarButton>

                <ToolbarButton 
                    onClick={handleClickTilesMode} 
                    title={`${showIsotilesWindow ? "Hide Isotiles Window" : "Show Isotiles Window"} · Tile Mode${isControlIsolated && activeControlType === 'tiles' ? ' (Isolated)' : ''}`} 
                    className={`px-2 py-1 flex items-center relative ${
                        showIsotilesWindow || (isControlIsolated && activeControlType === 'tiles')
                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-md' 
                            : 'text-slate-400 hover:text-white'
                    }`}
                >
                    <LucideGrid className="w-5 h-5" />
                    {activeControlType === 'tiles' && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                </ToolbarButton>

                {/* Control Isolation Toggle */}
                <ToolbarButton 
                    onClick={() => setIsControlIsolated(!isControlIsolated)} 
                    title={
                        isControlIsolated 
                            ? `Isolate Mode Control: ON (Only moving ${activeControlType === '3d' ? '3D Objects' : activeControlType === 'layers' ? 'Layers' : 'Isotiles'})` 
                            : 'Isolate Mode Control: OFF (Click to isolate moving only the active mode type)'
                    } 
                    className={`px-2 py-1 flex items-center ${
                        isControlIsolated 
                            ? 'bg-rose-500/25 text-rose-300 border-rose-500/60 shadow-md' 
                            : 'text-slate-500 hover:text-slate-200'
                    }`}
                >
                    {isControlIsolated ? (
                        <LucideLock className="w-4 h-4" />
                    ) : (
                        <LucideUnlock className="w-4 h-4" />
                    )}
                </ToolbarButton>

                {/* Scene Order Organizer Button */}
                {setShowSceneOrganizer && (
                    <ToolbarButton
                        onClick={() => setShowSceneOrganizer(!showSceneOrganizer)}
                        title="Scene Order Organizer (Control stacking order of Tiles, 3D Objects & Layers)"
                        className={`px-2 py-1 flex items-center gap-1 ${
                            showSceneOrganizer
                                ? 'bg-teal-500/25 text-teal-300 border-teal-500/60 shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <LucideArrowUpDown className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-wider">Order</span>
                    </ToolbarButton>
                )}
            </div>

            <div className="w-[1px] h-6 bg-slate-700/50"></div>

            {/* DEDICATED HAND TOOLS SPACE */}
            <div className="flex items-center space-x-1.5 bg-slate-900/80 px-2.5 py-1 rounded-full border border-amber-500/30 shadow-inner">
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-400/80 select-none pl-0.5">
                    Hand
                </span>
                {onToggleHandBrush && (
                    <ToolbarButton 
                        onClick={onToggleHandBrush} 
                        title={isHandBrushOpen ? "Close Hand Brush" : "Hand Brush"} 
                        className={`px-2 py-1 flex items-center ${
                            isHandBrushOpen 
                                ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-md' 
                                : 'text-slate-300 hover:text-white'
                        }`}
                    >
                        <LucideBrush className="w-4 h-4" />
                    </ToolbarButton>
                )}
            </div>

            <div className="w-[1px] h-6 bg-slate-700/50"></div>

            {/* Utility & Overlay Tools */}
            <div className="flex items-center space-x-1">
                <ToolbarButton onClick={onPackIsometric} title="Iso Pack">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="2.5"/></svg>
                </ToolbarButton>
                <ToolbarButton onClick={onColorPack} title="Color Pack">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth="2"/></svg>
                </ToolbarButton>
                {setShowSeamlessMaker && (
                    <ToolbarButton
                        onClick={() => setShowSeamlessMaker(!showSeamlessMaker)}
                        title="Seamless Maker (Make Selected Isotiles Seamless & Remove Tessellation)"
                        className={`px-2 py-1 flex items-center gap-1 ${
                            showSeamlessMaker
                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-md'
                                : 'text-emerald-400/90 hover:text-white'
                        }`}
                    >
                        <LucideSparkles className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-wider">Seamless</span>
                    </ToolbarButton>
                )}
                <ToolbarButton onClick={() => setShowThreeDObjects(!showThreeDObjects)} title={showThreeDObjects ? "Hide 3D Objects" : "Show 3D Objects"} className={showThreeDObjects ? 'text-purple-400' : 'text-slate-500 opacity-50'}>
                    {showThreeDObjects ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                    )}
                </ToolbarButton>
                <ToolbarButton onClick={() => setIsSnapEnabled(!isSnapEnabled)} title={isSnapEnabled ? "Snap Enabled" : "No Snap"} className={!isSnapEnabled ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : ''}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10l5 5m0-5l-5 5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </ToolbarButton>
                {onSelectLatOption && (
                    <LatsMenu onSelectOption={onSelectLatOption} isLoading={isLatLoading} />
                )}
                
                <div className="w-[1px] h-6 bg-slate-700/50"></div>

                <button 
                    onClick={() => {
                        if (previewMaskId === activeOverlayId) setPreviewMaskId(null);
                        else if (activeOverlayId) setPreviewMaskId(activeOverlayId);
                    }}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${previewMaskId && previewMaskId === activeOverlayId ? 'bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-900/20' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                >
                    Preview
                </button>
            </div>

            <div className="w-[1px] h-6 bg-slate-700/50"></div>

            {/* Integrated Layer Lab Features */}
            <div className="flex items-center space-x-2 relative">
                <div className="flex items-center space-x-1">
                    <ToolbarButton 
                        onClick={() => setIsAiGenOpen(!isAiGenOpen)} 
                        title="AI Texture Generation"
                        className={isAiGenOpen ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : ''}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2"/></svg>
                    </ToolbarButton>

                    <ToolbarButton 
                        onClick={onOpenDepthToImage} 
                        title={`Depth to Image Overlay ${selectedImageCount > 0 ? `(${selectedImageCount} Selected)` : '(Select tiles first)'}`}
                        className={selectedImageCount > 0 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30' : 'text-slate-600 opacity-60 hover:text-slate-400'}
                    >
                        <div className="relative">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            {selectedImageCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-cyan-400 text-[#0f1115] font-black text-[7px] w-3 h-3 rounded-full flex items-center justify-center border border-[#161b22]">
                                    {selectedImageCount}
                                </span>
                            )}
                        </div>
                    </ToolbarButton>
                    
                    <input type="file" ref={texInputRef} onChange={e => e.currentTarget.files?.[0] && handleTexFile(e.currentTarget.files[0])} className="hidden" accept="image/*" />
                    <ToolbarButton onClick={() => texInputRef.current?.click()} title="Upload Tiling Layer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16m-7 6h7" strokeWidth="2.5"/></svg>
                    </ToolbarButton>

                    <input type="file" ref={overlayInputRef} onChange={e => e.currentTarget.files?.[0] && handleOverlayFile(e.currentTarget.files[0])} className="hidden" accept="image/*" />
                    <ToolbarButton onClick={() => overlayInputRef.current?.click()} title="Upload Overlay Layer">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2.5"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2.5"/></svg>
                    </ToolbarButton>
                </div>

                {isAiGenOpen && (
                    <div className="absolute top-12 left-0 bg-[#161b22] border border-slate-700 p-3 rounded-2xl shadow-2xl w-64 flex flex-col space-y-2 animate-in fade-in slide-in-from-top-2">
                        <textarea 
                            value={texPrompt} 
                            onChange={(e) => setTexPrompt(e.target.value)} 
                            placeholder="AI prompt..." 
                            className="w-full bg-black/40 border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none" 
                            rows={2} 
                        />
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => {
                                    const finalPrompt = isFourInOne ? `A 2x2 grid containing 4 different variations of ${texPrompt}` : texPrompt;
                                    onGenerateTexture(finalPrompt, isFourInOne);
                                    setIsAiGenOpen(false);
                                }} 
                                className="flex-grow bg-cyan-600 hover:bg-cyan-500 py-1.5 rounded-lg text-white font-bold text-[10px] uppercase tracking-wider transition-all"
                            >
                                Generate
                            </button>
                            <label className="flex items-center space-x-1 cursor-pointer">
                                <input type="checkbox" checked={isFourInOne} onChange={e => setIsFourInOne(e.target.checked)} className="w-3 h-3 accent-cyan-500 rounded border-slate-700" />
                                <span className="text-[8px] font-black uppercase text-slate-500">2x2</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
