import React, { useRef, useState } from 'react';
import DraggableContainer from '../DraggableContainer';
import type { ThreeDObject, ThreeDTextureSettings, ProjectOverlay, GridType, CanvasImage } from '../../types';
import { ThreeDShadowSection } from './ThreeDShadowSection';
import { ThreeDTransformSection } from './threeD/ThreeDTransformSection';
import { ThreeDObjectListSection } from './threeD/ThreeDObjectListSection';
import { ThreeDLayerToPlaneSection } from './threeD/ThreeDLayerToPlaneSection';
import { ThreeDHeightMeshSection } from './threeD/ThreeDHeightMeshSection';
import { ThreeDCliffShapingSection } from './threeD/ThreeDCliffShapingSection';
import { ThreeDSlopeShapingSection } from './threeD/ThreeDSlopeShapingSection';
import { ThreeDPbrMapsSection } from './threeD/ThreeDPbrMapsSection';
import { ThreeDUvSettingsSection } from './threeD/ThreeDUvSettingsSection';
import { ThreeDTextureTransformSection } from './threeD/ThreeDTextureTransformSection';
import { ThreeDDisplacementSection } from './threeD/ThreeDDisplacementSection';
import { ThreeDMaterialSlidersSection } from './threeD/ThreeDMaterialSlidersSection';
import { ThreeDSurfaceScatterSection } from './threeD/ThreeDSurfaceScatterSection';
import { saveThreeDObjectToFile, loadThreeDObjectFromFile } from '../../utils/threeDNectarStorage';
import { StockThreeDModal } from '../modals/StockThreeDModal';
import { NewThreeDPlaneModal } from '../modals/NewThreeDPlaneModal';
import { MaterialTransitionWindow } from '../modals/MaterialTransitionWindow';
import { ExtraImageStudioModal } from '../modals/ExtraImageStudioModal';
import type { MaterialTransitionPairKey } from '../../utils/threeDMaterialTransitionHelper';
import {
    LucideBox,
    LucideUpload,
    LucideCheckCircle2,
    LucideZap,
    LucideImage,
    LucideCopy,
    LucideSave,
    LucideMinus,
    LucideMaximize2,
    LucideX,
    LucidePalette,
    LucideGrid,
    LucideBlend,
} from 'lucide-react';

interface ThreeDPanelProps {
    objects: ThreeDObject[];
    selectedObjectId: string | null;
    selectedObjectIds?: Set<string>;
    onSelectObject?: (id: string, toggleMulti?: boolean) => void;
    overlays?: ProjectOverlay[];
    gridType?: GridType;
    templateName?: string;
    onAddObject: (glbUrl: string, name: string) => void;
    onAddLoadedObject?: (obj: ThreeDObject) => void;
    onRemoveObject: (id: string) => void;
    onDuplicateObject?: (id: string) => void;
    onUpdateObject: (id: string, updates: Partial<ThreeDObject>, shouldPushHistory?: boolean) => void;
    onBake: () => void;
    onSnapToTile: () => void;
    onClose: () => void;
    onOpenTextureSettings?: (id: string) => void;
    onConvertLayerToPlane?: (layerOrGroupId: string) => Promise<void> | void;
    images?: CanvasImage[];
    selectedImageIds?: Set<string>;
    onCommitExtraBakedImages?: (updatedImages: CanvasImage[]) => void;
}

export const ThreeDPanel: React.FC<ThreeDPanelProps> = ({
    objects,
    selectedObjectId,
    selectedObjectIds,
    onSelectObject,
    overlays = [],
    gridType = 'ts_full',
    templateName,
    onAddObject,
    onAddLoadedObject,
    onRemoveObject,
    onDuplicateObject,
    onUpdateObject,
    onBake,
    onSnapToTile,
    onClose,
    onConvertLayerToPlane,
    images = [],
    selectedImageIds = new Set(),
    onCommitExtraBakedImages,
}) => {
    const glbInputRef = useRef<HTMLInputElement>(null);
    const texInputRef = useRef<HTMLInputElement>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [isNewPlaneModalOpen, setIsNewPlaneModalOpen] = useState(false);
    const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
    const [isExtraImageStudioOpen, setIsExtraImageStudioOpen] = useState(false);
    const [transitionInitialPair, setTransitionInitialPair] = useState<MaterialTransitionPairKey>('mainCliff');
    const [containerSize, setContainerSize] = useState({ width: 390, height: 700 });

    const handleSaveThreeDObject = async (obj: ThreeDObject) => {
        try {
            await saveThreeDObjectToFile(obj, templateName);
        } catch (err) {
            console.error('Failed to save .3dnectar file:', err);
        }
    };

    const handleLoadThreeDObjectFile = async (file: File) => {
        try {
            const loadedObj = await loadThreeDObjectFromFile(file);
            if (onAddLoadedObject) {
                onAddLoadedObject(loadedObj);
            }
        } catch (err) {
            console.error('Failed to load .3dnectar file:', err);
        }
    };

    const handleGlbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        onAddObject(url, file.name);
        e.target.value = '';
    };

    const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedObjectId) return;
        const url = URL.createObjectURL(file);
        onUpdateObject(selectedObjectId, { textureUrl: url }, true);
        e.target.value = '';
    };

    const selectedObject = objects.find((o) => o.id === selectedObjectId);

    const rawSettings = selectedObject?.textureSettings || {
        sharpness: 0,
        scale: 1,
        contrast: 100,
        brightness: 100,
        hue: 0,
        saturation: 100,
        metallic: 0,
        roughness: 1,
        magFilter: 'linear' as const,
        minFilter: 'linear' as const,
        anisotropy: 1,
        repeatX: 1,
        repeatY: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
    };

    const textureSettings: ThreeDTextureSettings = {
        ...rawSettings,
        normalScale: rawSettings.normalScale !== undefined ? rawSettings.normalScale : 1.0,
    };

    const updateTextureSetting = (
        key: keyof ThreeDTextureSettings,
        val: any,
        pushHistory: boolean = false
    ) => {
        if (!selectedObject) return;
        onUpdateObject(
            selectedObject.id,
            {
                textureSettings: { ...textureSettings, [key]: val },
            },
            pushHistory
        );
    };

    return (
        <DraggableContainer
            initialPos={{ x: Math.max(20, window.innerWidth - 410), y: 65 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={340}
            minHeight={isMinimized ? 52 : 360}
            className="bg-[#161b22]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl z-[1100] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Draggable Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/70 bg-slate-900/80 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                        <LucideBox className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-wider text-white leading-tight">
                            3D Studio
                        </h2>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Drag header to move · Shift+D duplicate
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
                        title="Close 3D Studio"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-4 space-y-3.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {/* Top Action Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => glbInputRef.current?.click()}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-2.5 px-2 rounded-xl text-white font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 shadow-md cursor-pointer"
                        >
                            <LucideUpload className="w-3.5 h-3.5 shrink-0" />
                            <span>Import GLB</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsNewPlaneModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 py-2.5 px-2.5 rounded-xl text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 shadow-md cursor-pointer shrink-0"
                            title="Create a New 3D Plane (Choose Grid Tile Size & Auto-Load PBR Maps)"
                        >
                            <LucideGrid className="w-3.5 h-3.5 shrink-0" />
                            <span>New Plane</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsStockModalOpen(true)}
                            className="bg-cyan-950/70 hover:bg-cyan-800/80 border border-cyan-500/40 py-2.5 px-2 rounded-xl text-cyan-300 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center shadow-md cursor-pointer shrink-0"
                            title="Open Stock 3D Objects (/3DOBJECTS)"
                        >
                            STOCK
                        </button>
                        <button
                            type="button"
                            onClick={onBake}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2.5 px-2 rounded-xl text-white font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 shadow-md cursor-pointer"
                        >
                            <LucideCheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Bake Tiles</span>
                        </button>
                        {onCommitExtraBakedImages && (
                            <button
                                type="button"
                                onClick={() => setIsExtraImageStudioOpen(true)}
                                className="bg-purple-600 hover:bg-purple-500 border border-purple-400/40 py-2.5 px-2 rounded-xl text-white font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center space-x-1 shadow-md cursor-pointer shrink-0"
                                title="Bake protruding 3D scattered trees/rocks into Westwood TMP ExtraImage & Z-Data"
                            >
                                <LucideMaximize2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Extra Img</span>
                            </button>
                        )}
                    </div>
                    <input
                        type="file"
                        ref={glbInputRef}
                        onChange={handleGlbUpload}
                        accept=".glb"
                        className="hidden"
                    />

                    {/* Convert 2D Layer to 3D Plane */}
                    {onConvertLayerToPlane && overlays.length > 0 && (
                        <ThreeDLayerToPlaneSection
                            overlays={overlays}
                            onConvertLayerToPlane={onConvertLayerToPlane}
                        />
                    )}

                    {/* Object List */}
                    <ThreeDObjectListSection
                        objects={objects}
                        selectedObjectId={selectedObjectId}
                        selectedObjectIds={selectedObjectIds}
                        onSelectObject={(id, toggleMulti) => {
                            if (onSelectObject) {
                                onSelectObject(id, toggleMulti);
                            } else {
                                onUpdateObject(id, {});
                            }
                        }}
                        onDuplicateObject={onDuplicateObject}
                        onRemoveObject={onRemoveObject}
                        onSaveObject={handleSaveThreeDObject}
                        onLoadObjectFile={onAddLoadedObject ? handleLoadThreeDObjectFile : undefined}
                        onTogglePaletteViewer={(obj) =>
                            onUpdateObject(obj.id, { paletteViewer: !obj.paletteViewer }, true)
                        }
                    />

                    {selectedObject && (
                        <div className="pt-3 border-t border-slate-700/70 space-y-2.5">
                            {/* Quick Object Toolbar */}
                            <div className="bg-black/40 p-2.5 rounded-xl border border-slate-700/70 space-y-2">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-black text-cyan-400 uppercase tracking-wider truncate max-w-[140px]">
                                        Active: {selectedObject.name}
                                    </span>
                                    <div className="flex items-center space-x-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onUpdateObject(
                                                    selectedObject.id,
                                                    { paletteViewer: !selectedObject.paletteViewer },
                                                    true
                                                )
                                            }
                                            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                                selectedObject.paletteViewer
                                                    ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-sm'
                                                    : 'bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border-slate-700/60'
                                            }`}
                                            title={
                                                selectedObject.paletteViewer
                                                    ? 'Palette Viewer active (limited visibly to loaded .pal)'
                                                    : 'Palette Viewer: limit 3D object visibly to loaded .pal'
                                            }
                                        >
                                            <LucidePalette className="w-3.5 h-3.5" />
                                            <span>Pal</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSaveThreeDObject(selectedObject)}
                                            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-700/50 text-xs font-bold transition-colors cursor-pointer"
                                            title="Save Selected 3D Object (.3dnectar)"
                                        >
                                            <LucideSave className="w-3.5 h-3.5" />
                                            <span>Save</span>
                                        </button>
                                        {onDuplicateObject && (
                                            <button
                                                type="button"
                                                onClick={() => onDuplicateObject(selectedObject.id)}
                                                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-700/50 text-xs font-bold transition-colors cursor-pointer"
                                                title="Duplicate Selected 3D Object (Hotkey: Shift+D)"
                                            >
                                                <LucideCopy className="w-3.5 h-3.5" />
                                                <span>Duplicate</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={onSnapToTile}
                                        className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 py-1.5 px-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-white transition-all border border-indigo-400/30 shadow-md cursor-pointer"
                                        title="Snap to selected 2D tile (Hotkey: C)"
                                    >
                                        <LucideZap className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">Snap Tile (C)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => texInputRef.current?.click()}
                                        className="flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 py-1.5 px-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-slate-200 transition-all border border-slate-600 cursor-pointer"
                                    >
                                        <LucideImage className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                        <span className="truncate">Load Texture</span>
                                    </button>
                                    <input
                                        type="file"
                                        ref={texInputRef}
                                        onChange={handleTextureUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>

                                {/* Object Transparency / Opacity Slider */}
                                <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                                            Opacity / Transparency
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-cyan-400">
                                            {Math.round(selectedObject.opacity ?? 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={selectedObject.opacity ?? 100}
                                        onMouseDown={() => onUpdateObject(selectedObject.id, {}, true)}
                                        onChange={(e) =>
                                            onUpdateObject(selectedObject.id, {
                                                opacity: parseFloat(e.target.value),
                                            })
                                        }
                                        onDoubleClick={() =>
                                            onUpdateObject(selectedObject.id, { opacity: 100 }, true)
                                        }
                                        title="Double-click to reset to 100% opaque"
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                    />
                                </div>
                            </div>

                            {/* 1. Object Transform */}
                            <ThreeDTransformSection
                                object={selectedObject}
                                onUpdateObject={onUpdateObject}
                            />

                            {/* 2. Height & Mesh Controls */}
                            <ThreeDHeightMeshSection
                                object={selectedObject}
                                onUpdateObject={onUpdateObject}
                            />

                            {/* 2b. 3D Surface Scatter (Spread Grass, Rocks & Models on Top Mesh) */}
                            <ThreeDSurfaceScatterSection
                                object={selectedObject}
                                onUpdateObject={onUpdateObject}
                            />

                            {/* 3. Cliff Shaping (Dual Slope Texture, Angle Depth & Rock Sculpting) */}
                            <ThreeDCliffShapingSection
                                object={selectedObject}
                                overlays={overlays}
                                onUpdateObject={onUpdateObject}
                                onOpenTransitionMixer={() => {
                                    setTransitionInitialPair('mainCliff');
                                    setIsTransitionModalOpen(true);
                                }}
                            />

                            {/* 3b. Slope Shaping (Ramps, Terrain Dips, Gullies & Darker Spots) */}
                            <ThreeDSlopeShapingSection
                                object={selectedObject}
                                overlays={overlays}
                                onUpdateObject={onUpdateObject}
                                onOpenTransitionMixer={() => {
                                    setTransitionInitialPair('mainSlope');
                                    setIsTransitionModalOpen(true);
                                }}
                            />

                            {/* 3c. Material Transition Mixer Window Button */}
                            <button
                                type="button"
                                onClick={() => setIsTransitionModalOpen(true)}
                                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-fuchsia-950/60 via-slate-900/80 to-amber-950/50 hover:from-fuchsia-900/70 hover:to-amber-900/60 border border-fuchsia-500/40 flex items-center justify-between text-left transition-all shadow-sm cursor-pointer"
                                title="Open Material Transition Mixer Window (Control seam colors, stroke lines, brightness, thickness & mix between Main, Cliff & Slope textures)"
                            >
                                <div className="flex items-center space-x-2 min-w-0">
                                    <LucideBlend className="w-4 h-4 text-fuchsia-400 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-xs font-black uppercase tracking-wider text-fuchsia-300 truncate">
                                            Material Transition Mixer
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">
                                            Main ↔ Cliff · Main ↔ Slope · Cliff ↔ Slope
                                        </div>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-fuchsia-600/30 border border-fuchsia-400/40 text-[10px] font-black uppercase text-fuchsia-200 shrink-0">
                                    Open Window
                                </span>
                            </button>

                            {/* 4. PBR Texture */}
                            <ThreeDPbrMapsSection
                                object={selectedObject}
                                allObjects={objects}
                                onUpdateObject={onUpdateObject}
                            />

                            {/* 4. UV Settings */}
                            <ThreeDUvSettingsSection
                                object={selectedObject}
                                overlays={overlays}
                                onUpdateObject={onUpdateObject}
                            />

                            {/* 5. Texture Transform (+ Filter & Sharpness) */}
                            <ThreeDTextureTransformSection
                                settings={textureSettings}
                                updateSetting={updateTextureSetting}
                                onStartHistory={() => onUpdateObject(selectedObject.id, {}, true)}
                            />

                            {/* 6. Displacement & Terrain */}
                            <ThreeDDisplacementSection
                                object={selectedObject}
                                onUpdateObject={onUpdateObject}
                            />

                            {/* 7. Surface & Color */}
                            <ThreeDMaterialSlidersSection
                                settings={textureSettings}
                                updateSetting={updateTextureSetting}
                                onStartHistory={() => onUpdateObject(selectedObject.id, {}, true)}
                            />

                            {/* 8. 3D Shadow Settings */}
                            <ThreeDShadowSection
                                object={selectedObject}
                                overlays={overlays}
                                onUpdateObject={onUpdateObject}
                            />
                        </div>
                    )}
                </div>
            )}
            <StockThreeDModal
                isOpen={isStockModalOpen}
                onClose={() => setIsStockModalOpen(false)}
                onSelectGlb={(glbUrl, name) => onAddObject(glbUrl, name)}
            />
            <NewThreeDPlaneModal
                isOpen={isNewPlaneModalOpen}
                onClose={() => setIsNewPlaneModalOpen(false)}
                gridType={gridType}
                onCreatePlane={(newPlane) => {
                    if (onAddLoadedObject) {
                        onAddLoadedObject(newPlane);
                    } else {
                        onAddObject(newPlane.glbUrl, newPlane.name);
                    }
                }}
            />
            {selectedObject && (
                <MaterialTransitionWindow
                    isOpen={isTransitionModalOpen}
                    onClose={() => setIsTransitionModalOpen(false)}
                    object={selectedObject}
                    initialPair={transitionInitialPair}
                    onUpdateObject={onUpdateObject}
                />
            )}
            {onCommitExtraBakedImages && (
                <ExtraImageStudioModal
                    isOpen={isExtraImageStudioOpen}
                    onClose={() => setIsExtraImageStudioOpen(false)}
                    images={images}
                    selectedImageIds={selectedImageIds}
                    overlays={overlays}
                    gridType={gridType}
                    onCommitImages={onCommitExtraBakedImages}
                />
            )}
        </DraggableContainer>
    );
};
