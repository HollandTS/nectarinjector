import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TransitionStamp, RgbaColor } from '../types';
import DraggableContainer from './DraggableContainer';
import { FilterSlider } from './ui/FilterSlider';
import { LucideMousePointer2, LucidePencil, LucideEraser, LucidePipette, LucidePlus, LucideCamera, LucideUndo, LucideChevronDown, LucideMaximize2, LucideMinimize2, LucideWaves } from 'lucide-react';

interface TransitionStampToolProps {
    stamps: TransitionStamp[];
    activeStampId: string | null;
    onAddStamp: (stamp: TransitionStamp) => void;
    onUpdateStamp: (id: string, updates: Partial<TransitionStamp>) => void;
    onSelectStamp: (id: string | null) => void;
    onCaptureRequest: () => void;
    onUndo: () => void;
    onUseStamp: () => void;
    toolMode: string;
    isOpen: boolean;
    onClose: () => void;
}

const TransitionStampTool: React.FC<TransitionStampToolProps> = ({
    stamps,
    activeStampId,
    onAddStamp,
    onUpdateStamp,
    onSelectStamp,
    onCaptureRequest,
    onUndo,
    onUseStamp,
    toolMode,
    isOpen,
    onClose
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [editorTool, setEditorTool] = useState<'pencil' | 'eraser' | 'picker'>('pencil');
    const [editorColor, setEditorColor] = useState<RgbaColor>({ r: 255, g: 255, b: 255, a: 1 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastDrawnDataUrl = useRef<string | null>(null);
    const activeStamp = stamps.find(s => s.id === activeStampId);

    const applyPixelDissolve = useCallback(() => {
        if (!canvasRef.current || !activeStamp) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const { width, height } = activeStamp;
        const idata = ctx.getImageData(0, 0, width, height);
        const data = idata.data;
        const mid = width / 2;

        for (let x = 0; x < width; x++) {
            const distFromMid = Math.abs(x - mid);
            const normalizedDist = distFromMid / mid; // 0 at mid, 1 at edges
            
            for (let y = 0; y < height; y++) {
                const idx = (y * width + x) * 4;
                if (data[idx + 3] === 0) continue;

                // Probability of keeping the pixel decreases as we move away from mid
                if (Math.random() < normalizedDist) {
                    data[idx + 3] = 0;
                }
            }
        }
        ctx.putImageData(idata, 0, 0);
        const newDataUrl = canvasRef.current.toDataURL();
        lastDrawnDataUrl.current = newDataUrl;
        onUpdateStamp(activeStamp.id, { dataUrl: newDataUrl });
    }, [activeStamp, onUpdateStamp]);

    // Pixel Editor Logic
    const drawOnCanvas = useCallback((x: number, y: number, isDrawing: boolean) => {
        if (!canvasRef.current || !activeStamp) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const px = Math.floor((x - rect.left) * scaleX);
        const py = Math.floor((y - rect.top) * scaleY);

        if (editorTool === 'picker') {
            const data = ctx.getImageData(px, py, 1, 1).data;
            setEditorColor({ r: data[0], g: data[1], b: data[2], a: data[3] / 255 });
            return;
        }

        if (!isDrawing) return;

        if (editorTool === 'pencil') {
            ctx.fillStyle = `rgba(${editorColor.r}, ${editorColor.g}, ${editorColor.b}, ${editorColor.a})`;
            ctx.fillRect(px, py, 1, 1);
        } else if (editorTool === 'eraser') {
            ctx.clearRect(px, py, 1, 1);
        }

        // Update stamp dataUrl and track it to avoid redraw loop
        const newDataUrl = canvasRef.current.toDataURL();
        lastDrawnDataUrl.current = newDataUrl;
        onUpdateStamp(activeStamp.id, { dataUrl: newDataUrl });
    }, [activeStamp, editorTool, editorColor, onUpdateStamp]);

    useEffect(() => {
        if (activeStamp && canvasRef.current) {
            // Only redraw if the dataUrl has changed from an external source
            if (activeStamp.dataUrl === lastDrawnDataUrl.current) return;

            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => {
                    if (!canvasRef.current) return;
                    // Update canvas size if it changed
                    if (canvasRef.current.width !== activeStamp.width || canvasRef.current.height !== activeStamp.height) {
                        canvasRef.current.width = activeStamp.width;
                        canvasRef.current.height = activeStamp.height;
                    }
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    ctx.drawImage(img, 0, 0);
                    lastDrawnDataUrl.current = activeStamp.dataUrl;
                };
                img.src = activeStamp.dataUrl;
            }
        }
    }, [activeStampId, activeStamp?.dataUrl, activeStamp?.width, activeStamp?.height]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen || isMinimized) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.key.toLowerCase() === 'd') setEditorTool('pencil');
            if (e.key.toLowerCase() === 'c') setEditorTool('picker');
            if (e.key.toLowerCase() === 'e') setEditorTool('eraser');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isMinimized]);

    if (!isOpen) return null;

    return (
        <DraggableContainer 
            initialPos={{ x: 100, y: 100 }} 
            title="Transition Stamp Tool"
            onClose={onClose}
        >
            <div className={`w-[320px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${isMinimized ? 'h-[40px]' : 'h-auto'}`}>
                {/* Header Controls */}
                <div className="drag-handle flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 cursor-move">
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => {
                                const id = `stamp-${Date.now()}`;
                                onAddStamp({
                                    id,
                                    name: `Stamp ${stamps.length + 1}`,
                                    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAySURBVHgB7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4G8atwAB69C9YQAAAABJRU5ErkJggg==',
                                    width: 32,
                                    height: 32,
                                    skewX: 0,
                                    skewY: 0,
                                    falloffEnabled: false,
                                    falloffWidth: 50,
                                    autoSnap: true
                                });
                                onSelectStamp(id);
                            }}
                            className="p-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors"
                            title="Create New Stamp"
                        >
                            <LucidePlus size={14} />
                        </button>
                        <select 
                            value={activeStampId || ''} 
                            onChange={(e) => onSelectStamp(e.target.value || null)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-cyan-500 min-w-[120px]"
                        >
                            <option value="">Select Stamp...</option>
                            {stamps.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button onClick={onUndo} className="p-1.5 hover:bg-slate-700 rounded text-slate-400" title="Undo Stamp Draw">
                            <LucideUndo size={14} />
                        </button>
                        <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400">
                            {isMinimized ? <LucideMaximize2 size={14} /> : <LucideMinimize2 size={14} />}
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-red-900/50 hover:text-red-400 rounded text-slate-400 transition-colors">
                            <LucidePlus size={14} className="rotate-45" />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <div className="p-4 space-y-4">
                        {/* Capture Button */}
                        <button 
                            onClick={onCaptureRequest}
                            className="w-full flex items-center justify-center space-x-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95"
                        >
                            <LucideCamera size={14} />
                            <span>Capture Stamp from Canvas</span>
                        </button>

                        {activeStamp ? (
                            <>
                                {/* Mini Pixel Editor */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-slate-500 uppercase font-black">Pixel Editor</span>
                                        <div className="flex space-x-1">
                                            <button 
                                                onClick={() => setEditorTool('pencil')}
                                                className={`p-1.5 rounded ${editorTool === 'pencil' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                                                title="Pencil (D)"
                                            >
                                                <LucidePencil size={12} />
                                            </button>
                                            <button 
                                                onClick={() => setEditorTool('eraser')}
                                                className={`p-1.5 rounded ${editorTool === 'eraser' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                                                title="Eraser"
                                            >
                                                <LucideEraser size={12} />
                                            </button>
                                            <button 
                                                onClick={() => setEditorTool('picker')}
                                                className={`p-1.5 rounded ${editorTool === 'picker' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                                                title="Color Picker (C)"
                                            >
                                                <LucidePipette size={12} />
                                            </button>
                                            <button 
                                                onClick={applyPixelDissolve}
                                                className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-indigo-600 transition-all"
                                                title="Pixel Dissolve (L/R to Mid)"
                                            >
                                                <LucideWaves size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative group flex items-center justify-center bg-slate-950 rounded-lg border border-slate-700 overflow-hidden" style={{ aspectRatio: '1/1' }}>
                                        <canvas 
                                            key={activeStamp.id}
                                            ref={canvasRef}
                                            width={activeStamp.width}
                                            height={activeStamp.height}
                                            className="max-w-full max-h-full image-pixelated object-contain"
                                            onMouseDown={(e) => drawOnCanvas(e.clientX, e.clientY, true)}
                                            onMouseMove={(e) => e.buttons === 1 && drawOnCanvas(e.clientX, e.clientY, true)}
                                        />
                                        {activeStamp.falloffEnabled && (
                                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                <div 
                                                    className="h-full border-x border-cyan-500/30 bg-cyan-500/5"
                                                    style={{ width: `${activeStamp.falloffWidth}%` }}
                                                />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex items-center space-x-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-4 h-4 rounded border border-white/20 shadow-sm" style={{ backgroundColor: `rgba(${editorColor.r},${editorColor.g},${editorColor.b},${editorColor.a})` }} />
                                            <span className="text-[8px] text-white font-mono bg-black/50 px-1 rounded">
                                                {activeStamp.width}x{activeStamp.height}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Alpha Fall-off */}
                                <div className="space-y-2 pt-2 border-t border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-slate-500 uppercase font-black">Alpha Fall-off</span>
                                        <button 
                                            onClick={() => onUpdateStamp(activeStamp.id, { falloffEnabled: !activeStamp.falloffEnabled })}
                                            className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${activeStamp.falloffEnabled ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                                        >
                                            {activeStamp.falloffEnabled ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    {activeStamp.falloffEnabled && (
                                        <FilterSlider 
                                            label="Solid Middle Width" 
                                            min={0} max={100} 
                                            value={activeStamp.falloffWidth} 
                                            onChange={(v) => onUpdateStamp(activeStamp.id, { falloffWidth: v })} 
                                        />
                                    )}
                                </div>

                                {/* Skewing */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                                    <FilterSlider label="Skew X" min={-45} max={45} value={activeStamp.skewX} onChange={(v) => onUpdateStamp(activeStamp.id, { skewX: v })} />
                                    <FilterSlider label="Skew Y" min={-45} max={45} value={activeStamp.skewY} onChange={(v) => onUpdateStamp(activeStamp.id, { skewY: v })} />
                                </div>

                                {/* Auto Snap */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                    <span className="text-[9px] text-slate-500 uppercase font-black">Auto-Snap to Edges</span>
                                    <input 
                                        type="checkbox" 
                                        checked={activeStamp.autoSnap} 
                                        onChange={(e) => onUpdateStamp(activeStamp.id, { autoSnap: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                                    />
                                </div>

                                {/* Use Stamp Button */}
                                <button 
                                    onClick={onUseStamp}
                                    className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 border ${toolMode === 'TRANSITION_STAMP' ? 'bg-cyan-500 border-cyan-400 ring-2 ring-cyan-500/50' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                                >
                                    <LucideMousePointer2 size={16} />
                                    <span>{toolMode === 'TRANSITION_STAMP' ? 'Stamp Tool Active' : 'Activate Stamp Tool'}</span>
                                </button>
                            </>
                        ) : (
                            <div className="py-8 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                <p className="text-[10px] text-slate-500 font-medium">Create or select a stamp to begin</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DraggableContainer>
    );
};

export default TransitionStampTool;
