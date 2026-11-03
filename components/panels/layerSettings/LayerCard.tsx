import React from 'react';
import { LucideChevronDown, LucideChevronRight, LucideCamera, LucidePalette, LucideLink2, LucideUnlink, LucideBox } from 'lucide-react';
import type { ProjectOverlay, OverlayFilters, CanvasImage } from '../../../types';
import { TilingSection } from './TilingSection';
import { AdditionalTexturesControls } from './AdditionalTexturesControls';
import { TiledBrushesSection } from './TiledBrushesSection';
import { ColorFiltersSection } from './ColorFiltersSection';
import { TransformSection } from './TransformSection';
import { AdvancedJitterSection } from './AdvancedJitterSection';
import { ColorSwapSection } from './ColorSwapSection';

interface LayerCardProps {
    ov: ProjectOverlay;
    idx: number;
    isSettingsOpen: boolean;
    isSelectedForMerge: boolean;
    onToggleExpand: () => void;
    onToggleSelection: () => void;
    onUnlinkLayer?: () => void;
    onUpdateOverlay: (id: string, updates: Partial<ProjectOverlay>, shouldPushHistory?: boolean) => void;
    onRemoveOverlay: (id: string) => void;
    onMoveLayer: (index: number, direction: 'up' | 'down') => void;
    onReplaceLayer: (id: string) => void;
    onCloneLayer: (ov: ProjectOverlay) => void;
    onSnapOverlayToTile: (id: string) => void;
    onConvertTo3DPlane?: (id: string) => void;
    onSaveLayer: (ov: ProjectOverlay) => void;
    onDownloadLayer: (ov: ProjectOverlay) => void;
    onDownloadViewedLayer: (ov: ProjectOverlay) => void;
    onSlice4InOne: (ov: ProjectOverlay) => void;
    onConfirmInject: (ov: ProjectOverlay) => void;
    updateFilter: (id: string, key: string, val: any) => void;
    handleBakeToSmart: (ov: ProjectOverlay) => void;
    handleRestoreTiled: (ov: ProjectOverlay) => void;
    showAdditionalTextures: string | null;
    setShowAdditionalTextures: (id: string | null) => void;
    handleFileBrowse: (id: string) => void;
    onAiGenerateTexture: (id: string) => void;
    isAiGenerating: string | null;
    openTextureSettings: any;
    setOpenTextureSettings: any;
    handleApplyColorFilters: (ov: ProjectOverlay) => void;
    handleUndoColorFilters: (id: string) => void;
    bakingOverlayId: string | null;
    filterUndoHistory: Record<string, any>;
    setShowDrawModal: (id: string | null) => void;
    activeLassoId?: string | null;
    setActiveLassoId?: (id: string | null) => void;
    activeInjectionEyedropperId: string | null;
    setActiveInjectionEyedropperId: (id: string | null) => void;
    activeInjectionTarget: string;
    setActiveInjectionTarget: (target: string) => void;
    handleApplyJitter: (ov: ProjectOverlay) => void;
    handleUndoJitter: (id: string) => void;
    jitterUndoHistory: Record<string, any>;
    showSmartColorSwap: string | null;
    setShowSmartColorSwap: (id: string | null) => void;
    handleApplyColorSwaps: (ov: ProjectOverlay, mode: 'normal' | 'smart' | 'tile' | 'all') => void;
    addColorSwap: (id: string) => void;
    updateColorSwap: (id: string, swapId: string, updates: any) => void;
    removeColorSwap: (id: string, swapId: string) => void;
    selectedImageIds: Set<string>;
    images: CanvasImage[];
}

export const LayerCard: React.FC<LayerCardProps> = ({
    ov,
    idx,
    isSettingsOpen,
    isSelectedForMerge,
    onToggleExpand,
    onToggleSelection,
    onUnlinkLayer,
    onUpdateOverlay,
    onRemoveOverlay,
    onMoveLayer,
    onReplaceLayer,
    onCloneLayer,
    onSnapOverlayToTile,
    onConvertTo3DPlane,
    onSaveLayer,
    onDownloadLayer,
    onDownloadViewedLayer,
    onSlice4InOne,
    onConfirmInject,
    updateFilter,
    handleBakeToSmart,
    handleRestoreTiled,
    showAdditionalTextures,
    setShowAdditionalTextures,
    handleFileBrowse,
    onAiGenerateTexture,
    isAiGenerating,
    openTextureSettings,
    setOpenTextureSettings,
    handleApplyColorFilters,
    handleUndoColorFilters,
    bakingOverlayId,
    filterUndoHistory,
    setShowDrawModal,
    activeLassoId,
    setActiveLassoId,
    activeInjectionEyedropperId,
    setActiveInjectionEyedropperId,
    activeInjectionTarget,
    setActiveInjectionTarget,
    handleApplyJitter,
    handleUndoJitter,
    jitterUndoHistory,
    showSmartColorSwap,
    setShowSmartColorSwap,
    handleApplyColorSwaps,
    addColorSwap,
    updateColorSwap,
    removeColorSwap,
    selectedImageIds,
    images
}) => {
    const f = ov.filters;
    const isAiGenerated = ov.isFourInOne || ov.type === 'tiled';

    const filterStyle = `blur(${f.blur}px) brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hue}deg)`;

    return (
        <div 
            onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleSelection();
                }
            }}
            className={`p-3 rounded-xl flex flex-col space-y-3 group transition-all cursor-pointer ${
                isSelectedForMerge 
                    ? 'bg-purple-950/30 border-2 border-purple-500 shadow-lg shadow-purple-500/10' 
                    : isSettingsOpen
                        ? 'bg-black/60 border border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                        : 'bg-black/40 border border-slate-700/60 hover:border-cyan-500/30'
            }`}
        >
            <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 shrink-0">
                    <input 
                        type="checkbox" 
                        checked={isSelectedForMerge} 
                        onChange={(e) => { 
                            e.stopPropagation(); 
                            onToggleSelection(); 
                        }} 
                        className="w-3 h-3 rounded border-slate-700 bg-slate-900 accent-purple-500 cursor-pointer" 
                        title="Select layer (or hold Ctrl and click layer to select for merge)" 
                    />
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand();
                        }}
                        className="w-12 h-12 bg-[#0d1117] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center p-1 cursor-pointer hover:border-cyan-500/50 transition-colors"
                        title={isSettingsOpen ? "Click to collapse settings" : "Click to expand settings"}
                    >
                        {ov.src ? (
                            <img 
                                src={ov.src} 
                                className="max-w-full max-h-full object-contain" 
                                style={{ imageRendering: 'pixelated', filter: filterStyle }} 
                                alt={ov.name || 'Layer'}
                            />
                        ) : (
                            <span className="text-[10px] text-slate-700">?</span>
                        )}
                    </div>
                </div>

                <div className="flex-grow min-w-0">
                    <div className="flex flex-col space-y-1.5 mb-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 min-w-0 flex-grow">
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shrink-0 ${ov.type === 'tiled' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                    {ov.type}
                                </span>
                                {ov.linkGroupId && (
                                    <span 
                                        className="text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tight bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center space-x-1 shrink-0"
                                        title={`Linked in group: ${ov.linkGroupName || 'Linked Layer'}`}
                                    >
                                        <LucideLink2 className="w-2.5 h-2.5 text-sky-400" />
                                        <span className="max-w-[70px] truncate">{ov.linkGroupName || 'Linked'}</span>
                                        {onUnlinkLayer && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUnlinkLayer();
                                                }}
                                                className="ml-0.5 text-sky-300 hover:text-red-400 transition-colors cursor-pointer"
                                                title="Unlink this layer"
                                            >
                                                <LucideUnlink className="w-2.5 h-2.5" />
                                            </button>
                                        )}
                                    </span>
                                )}
                                <input 
                                    type="text" 
                                    value={ov.name} 
                                    onChange={(e) => onUpdateOverlay(ov.id, { name: e.target.value })} 
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-transparent border-none text-xs font-bold text-white outline-none flex-grow min-w-0" 
                                    placeholder="Layer name" 
                                />
                                <label 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="flex items-center space-x-1 cursor-pointer group/label shrink-0"
                                >
                                    <input 
                                        type="checkbox" 
                                        checked={ov.placement === 'back'} 
                                        onChange={e => {
                                            const isBack = e.target.checked;
                                            onUpdateOverlay(ov.id, {
                                                placement: isBack ? 'back' : 'front',
                                                stackOrder: undefined,
                                            });
                                        }} 
                                        className="w-2.5 h-2.5 rounded border-slate-700 bg-slate-900 accent-cyan-500" 
                                    />
                                    <span className="text-[7px] font-black uppercase text-slate-600 group-hover/label:text-cyan-400 transition-colors">
                                        Under
                                    </span>
                                </label>
                            </div>

                            <div className="flex items-center space-x-1">
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onMoveLayer(idx, 'up'); }} 
                                    className="text-slate-500 hover:text-white text-[10px] p-1"
                                    title="Move layer up"
                                >
                                    ▲
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onMoveLayer(idx, 'down'); }} 
                                    className="text-slate-500 hover:text-white text-[10px] p-1"
                                    title="Move layer down"
                                >
                                    ▼
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onRemoveOverlay(ov.id); }} 
                                    className="text-red-900/40 hover:text-red-500 p-1 ml-1"
                                    title="Delete layer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/40">
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onReplaceLayer(ov.id); }} 
                                className="text-cyan-400 hover:text-cyan-300 text-xs bg-slate-800/50 p-1 rounded" 
                                title="Replace Source"
                            >
                                🔄
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCloneLayer(ov); }} 
                                className="text-purple-400 hover:text-purple-300 text-xs bg-slate-800/50 p-1 rounded" 
                                title="Clone Layer"
                            >
                                👯
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onSnapOverlayToTile(ov.id); }} 
                                className="text-amber-400 hover:text-amber-300 text-xs bg-slate-800/50 p-1 rounded" 
                                title="Snap to Tile"
                            >
                                🎯
                            </button>
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onSaveLayer(ov); }} 
                                className="text-emerald-400 hover:text-emerald-300 text-xs bg-slate-800/50 p-1 rounded" 
                                title="Save Layer (.nectarlayer)"
                            >
                                💾
                            </button>

                            {(isAiGenerated || ov.type === 'smart') && (
                                <div className="flex items-center space-x-1">
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onDownloadLayer(ov); }} 
                                        className="text-emerald-500 hover:text-emerald-400 text-xs bg-slate-800/50 p-1 rounded" 
                                        title="Download Source Texture"
                                    >
                                        ↓
                                    </button>
                                    {ov.type === 'tiled' && (
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onDownloadViewedLayer(ov); }} 
                                            className="text-cyan-400 hover:text-cyan-300 text-xs bg-slate-800/50 p-1 rounded" 
                                            title="Download Tiled Result (As Viewed)"
                                        >
                                            <LucideCamera size={12} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {ov.isFourInOne && (
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onSlice4InOne(ov); }} 
                                    className="text-emerald-500 hover:text-emerald-400 text-xs bg-slate-800/50 p-1 rounded" 
                                    title="Slice 2x2"
                                >
                                    ◫
                                </button>
                            )}

                            {ov.type === 'smart' && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onConfirmInject(ov);
                                    }}
                                    className="text-[9px] bg-cyan-600/30 hover:bg-cyan-500/50 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-black uppercase transition-all flex items-center space-x-1"
                                    title="Inject layer into selected tiles"
                                >
                                    <span>Inject</span>
                                </button>
                            )}

                            {onConvertTo3DPlane && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onConvertTo3DPlane(ov.linkGroupId || ov.id);
                                    }}
                                    className="text-[8px] bg-indigo-600/30 hover:bg-indigo-500/50 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-black uppercase transition-all flex items-center space-x-1 cursor-pointer"
                                    title={ov.linkGroupId ? `Convert linked group '${ov.linkGroupName || 'Linked Layer'}' into a combined 3D Plane` : "Convert this layer into a 3D Plane with un-transformed UV texture"}
                                >
                                    <LucideBox className="w-2.5 h-2.5 text-indigo-400" />
                                    <span>3D Plane</span>
                                </button>
                            )}

                            {/* Intuitive Expand / Collapse Button */}
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand();
                                }} 
                                className={`text-xs flex items-center space-x-1 px-1.5 py-0.5 rounded font-black uppercase transition-all ${
                                    isSettingsOpen 
                                        ? 'text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 shadow-xs' 
                                        : 'text-slate-400 hover:text-cyan-300 bg-slate-800/50 border border-transparent'
                                }`}
                                title={isSettingsOpen ? "Collapse layer settings" : "Expand layer settings"}
                            >
                                {isSettingsOpen ? (
                                    <>
                                        <LucideChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                                        <span className="text-[8px]">Settings</span>
                                    </>
                                ) : (
                                    <>
                                        <LucideChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[8px]">Settings</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdateOverlay(ov.id, { isVisible: !ov.isVisible });
                            }} 
                            className={`transition-all ${ov.isVisible ? 'text-cyan-400' : 'text-slate-700'}`}
                            title={ov.isVisible ? "Hide layer" : "Show layer"}
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onUpdateOverlay(ov.id, { paletteViewer: !ov.paletteViewer });
                            }} 
                            className={`transition-all p-1 rounded-md cursor-pointer ${ov.paletteViewer ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40 shadow-sm' : 'text-slate-600 hover:text-slate-400'}`}
                            title={ov.paletteViewer ? "Palette Viewer active (limited visibly to loaded .pal)" : "Palette Viewer: limit layer visibly to loaded .pal"}
                        >
                            <LucidePalette className="w-3.5 h-3.5" />
                        </button>
                        <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex-grow flex items-center space-x-2"
                        >
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={ov.opacity} 
                                onChange={(e) => onUpdateOverlay(ov.id, { opacity: parseInt(e.target.value) })} 
                                className="flex-grow h-1 bg-slate-800 appearance-none accent-cyan-500 rounded-full" 
                            />
                            <span className="text-[9px] text-slate-500 font-mono w-6 text-right">{ov.opacity}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Layer Settings */}
            {isSettingsOpen && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className="space-y-3 pt-3 border-t border-slate-800/80 animate-in slide-in-from-top-1 duration-200"
                >
                    <div className="flex flex-col gap-2.5">
                        {/* Resampling Selector */}
                        <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-slate-700/80">
                            <p className="text-xs font-black text-slate-300 uppercase tracking-wider">Resampling</p>
                            <div className="flex bg-black/60 rounded-lg p-1 border border-slate-700">
                                <button 
                                    type="button"
                                    onClick={() => updateFilter(ov.id, 'renderMode', 'pixel')} 
                                    className={`text-xs px-2.5 py-1 rounded-md font-black uppercase transition-all ${ov.filters.renderMode === 'pixel' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Pixel
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => updateFilter(ov.id, 'renderMode', 'smooth')} 
                                    className={`text-xs px-2.5 py-1 rounded-md font-black uppercase transition-all ${ov.filters.renderMode === 'smooth' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Bilinear
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => updateFilter(ov.id, 'renderMode', 'crisp')} 
                                    className={`text-xs px-2.5 py-1 rounded-md font-black uppercase transition-all ${ov.filters.renderMode === 'crisp' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                    title="Advanced progressive downsampler with adaptive edge retention - not too smooth, not too pixellated"
                                >
                                    Crisp
                                </button>
                            </div>
                        </div>

                        {/* 1. Tiling Section */}
                        {(ov.type === 'tiled' || ov.type === 'smart') && (
                            <TilingSection 
                                ov={ov}
                                updateFilter={updateFilter}
                                onUpdateOverlay={onUpdateOverlay}
                                handleBakeToSmart={handleBakeToSmart}
                                handleRestoreTiled={handleRestoreTiled}
                            />
                        )}

                        {/* Add Additional Textures Section (between Tiling and Brushes) */}
                        {ov.type === 'tiled' && (
                            <AdditionalTexturesControls
                                ov={ov}
                                updateFilter={updateFilter}
                                onUpdateOverlay={onUpdateOverlay}
                                showAdditionalTextures={showAdditionalTextures}
                                setShowAdditionalTextures={setShowAdditionalTextures}
                                handleFileBrowse={handleFileBrowse}
                                onAiGenerateTexture={onAiGenerateTexture}
                                isAiGenerating={isAiGenerating}
                                openTextureSettings={openTextureSettings}
                                setOpenTextureSettings={setOpenTextureSettings}
                            />
                        )}

                        {/* Brushes Section */}
                        {(ov.type === 'tiled' || ov.type === 'smart') && (
                            <TiledBrushesSection 
                                ov={ov}
                                updateFilter={updateFilter}
                            />
                        )}

                        {/* 2. Colors & Filters Section */}
                        <ColorFiltersSection 
                            ov={ov}
                            updateFilter={updateFilter}
                            onUpdateOverlay={onUpdateOverlay}
                            handleApplyColorFilters={handleApplyColorFilters}
                            handleUndoColorFilters={handleUndoColorFilters}
                            bakingOverlayId={bakingOverlayId}
                            filterUndoHistory={filterUndoHistory}
                        />

                        {/* 3. Transform Section */}
                        <TransformSection 
                            ov={ov}
                            updateFilter={updateFilter}
                            onUpdateOverlay={onUpdateOverlay}
                        />

                        {/* 4. Advanced Jitter Section */}
                        <AdvancedJitterSection 
                            ov={ov}
                            updateFilter={updateFilter}
                            onUpdateOverlay={onUpdateOverlay}
                            setShowDrawModal={setShowDrawModal}
                            activeLassoId={activeLassoId}
                            setActiveLassoId={setActiveLassoId}
                            activeInjectionEyedropperId={activeInjectionEyedropperId}
                            setActiveInjectionEyedropperId={setActiveInjectionEyedropperId}
                            activeInjectionTarget={activeInjectionTarget}
                            setActiveInjectionTarget={setActiveInjectionTarget}
                            handleApplyJitter={handleApplyJitter}
                            handleUndoJitter={handleUndoJitter}
                            bakingOverlayId={bakingOverlayId}
                            jitterUndoHistory={jitterUndoHistory}
                        />

                        {/* 5. Color Swap Section */}
                        <ColorSwapSection 
                            ov={ov}
                            updateFilter={updateFilter}
                            onUpdateOverlay={onUpdateOverlay}
                            showSmartColorSwap={showSmartColorSwap}
                            setShowSmartColorSwap={setShowSmartColorSwap}
                            activeInjectionEyedropperId={activeInjectionEyedropperId}
                            setActiveInjectionEyedropperId={setActiveInjectionEyedropperId}
                            activeInjectionTarget={activeInjectionTarget}
                            setActiveInjectionTarget={setActiveInjectionTarget}
                            handleApplyColorSwaps={handleApplyColorSwaps}
                            handleUndoColorFilters={handleUndoColorFilters}
                            bakingOverlayId={bakingOverlayId}
                            filterUndoHistory={filterUndoHistory}
                            addColorSwap={addColorSwap}
                            updateColorSwap={updateColorSwap}
                            removeColorSwap={removeColorSwap}
                            selectedImageIds={selectedImageIds}
                            images={images}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
