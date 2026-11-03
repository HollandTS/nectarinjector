import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import DraggableContainer from '../DraggableContainer';
import type { GridType, ThreeDObject } from '../../types';
import {
    ParsedPbrBundle,
    parsePbrFilesOrZip,
    buildNewThreeDPlaneObject,
} from '../../utils/newThreeDPlaneHelper';
import {
    LucideGrid,
    LucideX,
    LucideMinus,
    LucideMaximize2,
    LucideUpload,
    LucideFolderArchive,
    LucideCheck,
    LucideTrash2,
    LucideLayers,
    LucideLoader2,
} from 'lucide-react';

interface NewThreeDPlaneModalProps {
    isOpen: boolean;
    onClose: () => void;
    gridType?: GridType;
    onCreatePlane: (newPlane: ThreeDObject) => void;
}

export const NewThreeDPlaneModal: React.FC<NewThreeDPlaneModalProps> = ({
    isOpen,
    onClose,
    gridType = 'ts_full',
    onCreatePlane,
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: 470, height: 540 });

    const [tilesX, setTilesX] = useState<number>(2);
    const [tilesZ, setTilesZ] = useState<number>(2);
    const [planeName, setPlaneName] = useState<string>('');
    const [loadPbr, setLoadPbr] = useState<boolean>(true);
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [pbrBundle, setPbrBundle] = useState<ParsedPbrBundle>({});

    const pbrFileInputRef = useRef<HTMLInputElement>(null);
    const singleSlotInputRefs = {
        albedo: useRef<HTMLInputElement>(null),
        height: useRef<HTMLInputElement>(null),
        normal: useRef<HTMLInputElement>(null),
        metallic: useRef<HTMLInputElement>(null),
        roughness: useRef<HTMLInputElement>(null),
    };

    if (!isOpen || typeof document === 'undefined') return null;

    const handleBrowseFilesOrZip = async (files: FileList | File[] | null) => {
        if (!files || files.length === 0) return;
        setIsParsing(true);
        try {
            const parsed = await parsePbrFilesOrZip(files);
            setPbrBundle((prev) => ({
                baseName: parsed.baseName || prev.baseName,
                textureUrl: parsed.textureUrl || prev.textureUrl,
                textureFileName: parsed.textureFileName || prev.textureFileName,
                displacementMapUrl: parsed.displacementMapUrl || prev.displacementMapUrl,
                displacementFileName: parsed.displacementFileName || prev.displacementFileName,
                normalMapUrl: parsed.normalMapUrl || prev.normalMapUrl,
                normalFileName: parsed.normalFileName || prev.normalFileName,
                metallicMapUrl: parsed.metallicMapUrl || prev.metallicMapUrl,
                metallicFileName: parsed.metallicFileName || prev.metallicFileName,
                roughnessMapUrl: parsed.roughnessMapUrl || prev.roughnessMapUrl,
                roughnessFileName: parsed.roughnessFileName || prev.roughnessFileName,
            }));
            if (parsed.baseName && !planeName.trim()) {
                setPlaneName(parsed.baseName);
            }
        } catch (err) {
            console.error('Failed parsing PBR files/zip:', err);
        } finally {
            setIsParsing(false);
        }
    };

    const handleSingleMapChange = (
        slot: 'albedo' | 'height' | 'normal' | 'metallic' | 'roughness',
        file: File | undefined
    ) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setPbrBundle((prev) => {
                if (slot === 'albedo') {
                    return { ...prev, textureUrl: dataUrl, textureFileName: file.name };
                }
                if (slot === 'height') {
                    return { ...prev, displacementMapUrl: dataUrl, displacementFileName: file.name };
                }
                if (slot === 'normal') {
                    return { ...prev, normalMapUrl: dataUrl, normalFileName: file.name };
                }
                if (slot === 'metallic') {
                    return { ...prev, metallicMapUrl: dataUrl, metallicFileName: file.name };
                }
                return { ...prev, roughnessMapUrl: dataUrl, roughnessFileName: file.name };
            });
        };
        reader.readAsDataURL(file);
    };

    const handleClearSlot = (slot: 'albedo' | 'height' | 'normal' | 'metallic' | 'roughness') => {
        setPbrBundle((prev) => {
            if (slot === 'albedo') {
                return { ...prev, textureUrl: undefined, textureFileName: undefined };
            }
            if (slot === 'height') {
                return { ...prev, displacementMapUrl: undefined, displacementFileName: undefined };
            }
            if (slot === 'normal') {
                return { ...prev, normalMapUrl: undefined, normalFileName: undefined };
            }
            if (slot === 'metallic') {
                return { ...prev, metallicMapUrl: undefined, metallicFileName: undefined };
            }
            return { ...prev, roughnessMapUrl: undefined, roughnessFileName: undefined };
        });
    };

    const handleCreate = () => {
        const newPlane = buildNewThreeDPlaneObject({
            name: planeName,
            tilesX,
            tilesZ,
            gridType,
            pbr: loadPbr ? pbrBundle : undefined,
        });
        onCreatePlane(newPlane);
        onClose();
    };

    const assignedCount = [
        pbrBundle.textureUrl,
        pbrBundle.displacementMapUrl,
        pbrBundle.normalMapUrl,
        pbrBundle.metallicMapUrl,
        pbrBundle.roughnessMapUrl,
    ].filter(Boolean).length;

    const slots: {
        id: 'albedo' | 'height' | 'normal' | 'metallic' | 'roughness';
        label: string;
        hint: string;
        url?: string;
        fileName?: string;
        colorClass: string;
    }[] = [
        {
            id: 'albedo',
            label: 'Albedo / Diffuse',
            hint: '_albedo, _diffuse, _color, _basecolor',
            url: pbrBundle.textureUrl,
            fileName: pbrBundle.textureFileName,
            colorClass: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20',
        },
        {
            id: 'height',
            label: 'Height / Displacement',
            hint: '_height, _disp, _displacement, _bump',
            url: pbrBundle.displacementMapUrl,
            fileName: pbrBundle.displacementFileName,
            colorClass: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/20',
        },
        {
            id: 'normal',
            label: 'Normal Map',
            hint: '_normal, _nor, _nrm, _norm',
            url: pbrBundle.normalMapUrl,
            fileName: pbrBundle.normalFileName,
            colorClass: 'border-blue-500/40 text-blue-300 bg-blue-950/20',
        },
        {
            id: 'metallic',
            label: 'Metallic Map',
            hint: '_metallic, _metalness, _metal, _met',
            url: pbrBundle.metallicMapUrl,
            fileName: pbrBundle.metallicFileName,
            colorClass: 'border-slate-500/40 text-slate-300 bg-slate-900/40',
        },
        {
            id: 'roughness',
            label: 'Roughness Map',
            hint: '_roughness, _rough, _rgh',
            url: pbrBundle.roughnessMapUrl,
            fileName: pbrBundle.roughnessFileName,
            colorClass: 'border-amber-500/40 text-amber-300 bg-amber-950/20',
        },
    ];

    return createPortal(
        <DraggableContainer
            initialPos={{ x: Math.max(40, Math.floor(window.innerWidth * 0.5 - 235)), y: 90 }}
            size={isMinimized ? { width: containerSize.width, height: 52 } : containerSize}
            onResize={(sz) => setContainerSize(sz)}
            resizable={!isMinimized}
            minWidth={390}
            minHeight={isMinimized ? 52 : 380}
            className="bg-[#12171f]/98 backdrop-blur-xl border border-indigo-500/50 rounded-2xl shadow-2xl z-[1260] overflow-hidden flex flex-col text-slate-200"
        >
            {/* Draggable Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-900/90 drag-handle cursor-move select-none shrink-0">
                <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                        <LucideGrid className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-white leading-tight">
                            New 3D Plane
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Grid Tile Size & Auto PBR Map Assignment (.zip or images)
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
                        {isMinimized ? <LucideMaximize2 className="w-4 h-4" /> : <LucideMinus className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close New Plane Window"
                    >
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <div className="p-4 space-y-3.5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {/* 1. How Big by How Big (Grid Tile Size) */}
                    <div className="bg-black/40 border border-slate-700/80 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                                1. Grid Tile Size (How Big × How Big)
                            </span>
                            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/30">
                                {tilesX} × {tilesZ} Tiles
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400 block">
                                    Width (Tiles X)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={64}
                                    step={1}
                                    value={tilesX}
                                    onChange={(e) => setTilesX(Math.max(1, Math.min(64, parseInt(e.target.value, 10) || 1)))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400 block">
                                    Depth (Tiles Y / Z)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={64}
                                    step={1}
                                    value={tilesZ}
                                    onChange={(e) => setTilesZ(Math.max(1, Math.min(64, parseInt(e.target.value, 10) || 1)))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Quick Tile Size Presets */}
                        <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                            {[
                                [1, 1],
                                [2, 2],
                                [3, 3],
                                [4, 4],
                                [6, 6],
                                [8, 8],
                                [2, 4],
                                [4, 2],
                            ].map(([x, z]) => (
                                <button
                                    key={`${x}x${z}`}
                                    type="button"
                                    onClick={() => {
                                        setTilesX(x);
                                        setTilesZ(z);
                                    }}
                                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                                        tilesX === x && tilesZ === z
                                            ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                                    }`}
                                >
                                    {x}×{z}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-1 pt-1">
                            <label className="text-[10px] font-bold uppercase text-slate-400 block">
                                Plane Name (Optional)
                            </label>
                            <input
                                type="text"
                                value={planeName}
                                onChange={(e) => setPlaneName(e.target.value)}
                                placeholder={`Plane ${tilesX}×${tilesZ}`}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* 2. Load PBR Toggle & Auto-Assign Dropzone / Browser */}
                    <div className="bg-black/40 border border-slate-700/80 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={loadPbr}
                                    onChange={(e) => setLoadPbr(e.target.checked)}
                                    className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                                />
                                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 flex items-center space-x-1.5">
                                    <LucideLayers className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>2. Load PBR? (Auto-Assign Maps)</span>
                                </span>
                            </label>
                            {loadPbr && (
                                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                                    {assignedCount}/5 Assigned
                                </span>
                            )}
                        </div>

                        {loadPbr && (
                            <div className="space-y-2.5 pt-1">
                                <div
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        handleBrowseFilesOrZip(e.dataTransfer.files);
                                    }}
                                    onClick={() => pbrFileInputRef.current?.click()}
                                    className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/15 hover:bg-cyan-950/30 rounded-xl p-3 text-center cursor-pointer transition-all space-y-1"
                                >
                                    <div className="flex items-center justify-center space-x-2 text-cyan-300 font-black text-xs uppercase">
                                        {isParsing ? (
                                            <LucideLoader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                        ) : (
                                            <>
                                                <LucideFolderArchive className="w-4 h-4 text-cyan-400" />
                                                <LucideUpload className="w-4 h-4 text-cyan-400" />
                                            </>
                                        )}
                                        <span>
                                            {isParsing
                                                ? 'Reading PBR Maps...'
                                                : 'Browse or Drop PBR .ZIP or Multiple Images'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Auto-detects <span className="text-cyan-300 font-mono">_albedo</span>,{' '}
                                        <span className="text-emerald-300 font-mono">_height</span>,{' '}
                                        <span className="text-blue-300 font-mono">_normal</span>,{' '}
                                        <span className="text-slate-200 font-mono">_metallic</span>,{' '}
                                        <span className="text-amber-300 font-mono">_roughness</span> (.png/.jpg/.webp)
                                    </p>
                                    <input
                                        type="file"
                                        ref={pbrFileInputRef}
                                        multiple
                                        accept=".zip,image/*"
                                        onChange={(e) => {
                                            handleBrowseFilesOrZip(e.target.files);
                                            e.target.value = '';
                                        }}
                                        className="hidden"
                                    />
                                </div>

                                {/* 5 Auto-Assigned PBR Slots with Thumbnails */}
                                <div className="space-y-1.5">
                                    {slots.map((slot) => (
                                        <div
                                            key={slot.id}
                                            className={`border ${slot.colorClass} rounded-lg p-2 flex items-center justify-between gap-2`}
                                        >
                                            <div className="flex items-center space-x-2.5 min-w-0">
                                                <div className="w-9 h-9 rounded bg-black/70 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                                                    {slot.url ? (
                                                        <img
                                                            src={slot.url}
                                                            alt={slot.label}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-[8px] text-slate-600 font-bold uppercase">
                                                            None
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[10px] font-black uppercase tracking-wide truncate">
                                                        {slot.label}
                                                    </div>
                                                    <div className="text-[9.5px] font-mono text-slate-400 truncate">
                                                        {slot.fileName || slot.hint}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-1 shrink-0">
                                                {slot.url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClearSlot(slot.id)}
                                                        className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-slate-800 cursor-pointer"
                                                        title={`Clear ${slot.label}`}
                                                    >
                                                        <LucideTrash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => singleSlotInputRefs[slot.id].current?.click()}
                                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[9.5px] font-bold uppercase text-white cursor-pointer"
                                                >
                                                    {slot.url ? 'Change' : 'Browse'}
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={singleSlotInputRefs[slot.id]}
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        handleSingleMapChange(slot.id, e.target.files?.[0]);
                                                        e.target.value = '';
                                                    }}
                                                    className="hidden"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Create Plane Button */}
                    <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isParsing}
                            onClick={handleCreate}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center space-x-1.5 transition-all cursor-pointer"
                        >
                            <LucideCheck className="w-4 h-4" />
                            <span>
                                Create {tilesX}×{tilesZ} Plane
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </DraggableContainer>,
        document.body
    );
};
