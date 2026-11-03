import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pencil, Eraser, Pipette, Copy, HelpCircle, Play, Pause, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Undo2, Redo2, RefreshCw } from 'lucide-react';
import { RGB } from '../lib/formats';
import { cn } from '../lib/utils';
import { TmpParser } from '../lib/formats';

interface PixelEditorProps {
    data: Uint8Array; // Decoded uncompressed pixel byte data
    width: number;
    height: number;
    palette: RGB[];
    selectedColorIndex: number;
    onChangeSelectedColorIndex: (index: number) => void;
    onUpdatePixels: (newData: Uint8Array) => void;
    isTileBase?: boolean; // If it's a TMP Base tile (uses isInsideWestwoodDiamond boundaries)
    isShadowFrame?: boolean; // If it's a shadow frame (strictly index 1 vs 0)
    label: string;
    isZData?: boolean; // If it is editing Z-data height map directly

    // Optional undo / redo props
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;

    // Optional animation playback controller props
    frameCount?: number;
    currentFrameIndex?: number;
    onFrameIndexChange?: (index: number) => void;
}

export const PixelEditor: React.FC<PixelEditorProps> = ({
    data,
    width,
    height,
    palette,
    selectedColorIndex,
    onChangeSelectedColorIndex,
    onUpdatePixels,
    isTileBase = false,
    isShadowFrame = false,
    label,
    isZData = false,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    frameCount,
    currentFrameIndex,
    onFrameIndexChange
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Tools and states
    const [tool, setTool] = useState<'pencil' | 'eraser' | 'eyedropper' | 'stamp'>('pencil');
    const [thickness, setThickness] = useState<number>(1);
    const [isDrawing, setIsDrawing] = useState(false);
    const [editorZoom, setEditorZoom] = useState<number>(4);
    const [viewportHeight, setViewportHeight] = useState<number>(() => height > 80 ? 440 : 320);
    
    // Stamp clone states
    const [stampSource, setStampSource] = useState<{ x: number, y: number } | null>(null);
    const [strokeStart, setStrokeStart] = useState<{ x: number, y: number } | null>(null);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const [lockZero, setLockZero] = useState<boolean>(false);

    // Animation playback controls inside the editor (default is FALSE, never play automatically)
    const [isPlaying, setIsPlaying] = useState(false);
    const [fps, setFps] = useState(10);

    // Track cursor location (in pixels) for interactive box hover
    const [hoverCoord, setHoverCoord] = useState<{ x: number, y: number } | null>(null);

    // Keep a local draft array of pixels for instant drawing response
    const [currentPixels, setCurrentPixels] = useState<Uint8Array>(data);

    // Keep track of original loaded data to restore transparency (#0) when requested
    const originalDataRef = useRef<Uint8Array | null>(null);

    // Update originalDataRef when standard dimensions/length changes (or new tile is loaded)
    useEffect(() => {
        originalDataRef.current = new Uint8Array(data);
    }, [data.length, width, height]);

    const handleRefreshZero = () => {
        if (!originalDataRef.current) return;
        const newPixels = new Uint8Array(currentPixels);
        let changed = false;
        for (let i = 0; i < newPixels.length; i++) {
            if (originalDataRef.current[i] === 0 && newPixels[i] !== 0) {
                newPixels[i] = 0;
                changed = true;
            }
        }
        if (changed) {
            setCurrentPixels(newPixels);
            onUpdatePixels(newPixels);
        }
    };

    const activePalette = useMemo(() => {
        if (isZData) {
            return Array.from({ length: 256 }, (_, i) => ({
                r: Math.min(255, i * 8),
                g: Math.min(255, i * 8),
                b: Math.min(255, i * 8),
            }));
        }
        return palette;
    }, [isZData, palette]);

    // If source representation changes from parent, sync our local layout
    useEffect(() => {
        setCurrentPixels(data);
    }, [data]);

    // Redraw the canvas on pixel changes, palette changes or mode modifications
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;

        const imgData = ctx.createImageData(width, height);
        const data32 = new Uint32Array(imgData.data.buffer);

        // ABGR colors
        const p32 = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            const c = activePalette[i] || { r: 0, g: 0, b: 0 };
            p32[i] = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
        }

        for (let i = 0; i < currentPixels.length; i++) {
            const idx = currentPixels[i];
            
            // Mask out of Westwood diamond if it's a Tile Base
            if (isTileBase) {
                const pxX = i % width;
                const pxY = Math.floor(i / width);
                if (!TmpParser.isInsideWestwoodDiamond(pxX, pxY, width, height)) {
                    data32[i] = 0; // Completely transparent
                    continue;
                }
            }

            if (idx === 0) {
                data32[i] = 0;
            } else if (isShadowFrame) {
                data32[i] = p32[1]; // Strictly render as shadow representation
            } else {
                data32[i] = p32[idx];
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }, [currentPixels, width, height, activePalette, isTileBase, isShadowFrame]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // Animation playback effect (safe callback invocation outside rendering phase)
    useEffect(() => {
        if (!isPlaying || frameCount === undefined || !onFrameIndexChange || currentFrameIndex === undefined) {
            return;
        }

        const interval = setInterval(() => {
            const nextIdx = (currentFrameIndex + 1) % frameCount;
            onFrameIndexChange(nextIdx);
        }, 1000 / fps);

        return () => clearInterval(interval);
    }, [isPlaying, frameCount, currentFrameIndex, onFrameIndexChange, fps]);

    // Helper: translate mouse/touch events to pixel coordinates
    const getPixelCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        let clientX = 0;
        let clientY = 0;

        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = Math.floor((clientX - rect.left) * scaleX);
        const y = Math.floor((clientY - rect.top) * scaleY);

        if (x >= 0 && x < width && y >= 0 && y < height) {
            return { x, y };
        }
        return null;
    };

    // Track Alt Key State
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setIsAltPressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setIsAltPressed(false);
            }
        };
        const handleBlur = () => {
            setIsAltPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Main Draw Operation
    const paintAtPixel = useCallback((px: number, py: number, strokeAnchor?: { x: number, y: number }) => {
        if (tool === 'stamp') {
            if (!stampSource) {
                setStampSource({ x: px, y: py });
                return;
            }
            const anchor = strokeAnchor || { x: px, y: py };
            const brushSize = thickness;

            const left = px - Math.floor((brushSize - 1) / 2);
            const right = px + Math.ceil((brushSize - 1) / 2);
            const top = py - Math.floor((brushSize - 1) / 2);
            const bottom = py + Math.ceil((brushSize - 1) / 2);

            const newPixels = new Uint8Array(currentPixels);
            let changed = false;

            for (let sy = top; sy <= bottom; sy++) {
                for (let sx = left; sx <= right; sx++) {
                    if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                        if (isTileBase && !TmpParser.isInsideWestwoodDiamond(sx, sy, width, height)) {
                            continue;
                        }

                        const idx = sy * width + sx;

                        // Lock index #0 check
                        if (lockZero && currentPixels[idx] === 0) {
                            continue;
                        }

                        const dx = sx - anchor.x;
                        const dy = sy - anchor.y;
                        const srcX = stampSource.x + dx;
                        const srcY = stampSource.y + dy;

                        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                            const srcIdx = srcY * width + srcX;
                            const valueToPaint = currentPixels[srcIdx];

                            if (newPixels[idx] !== valueToPaint) {
                                newPixels[idx] = valueToPaint;
                                changed = true;
                            }
                        }
                    }
                }
            }

            if (changed) {
                setCurrentPixels(newPixels);
            }
            return;
        }

        const valueToPaint = tool === 'eraser' ? 0 : (isShadowFrame ? 1 : selectedColorIndex);
        const brushSize = tool === 'eyedropper' ? 1 : thickness;

        const left = px - Math.floor((brushSize - 1) / 2);
        const right = px + Math.ceil((brushSize - 1) / 2);
        const top = py - Math.floor((brushSize - 1) / 2);
        const bottom = py + Math.ceil((brushSize - 1) / 2);

        const newPixels = new Uint8Array(currentPixels);
        let changed = false;

        for (let sy = top; sy <= bottom; sy++) {
            for (let sx = left; sx <= right; sx++) {
                if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                    if (isTileBase && !TmpParser.isInsideWestwoodDiamond(sx, sy, width, height)) {
                        continue;
                    }

                    const idx = sy * width + sx;
                    if (tool === 'eyedropper') {
                        const pickedVal = currentPixels[idx];
                        onChangeSelectedColorIndex(pickedVal);
                        setTool('pencil');
                        return;
                    }

                    // Lock index #0 check
                    if (lockZero && currentPixels[idx] === 0) {
                        continue;
                    }

                    if (newPixels[idx] !== valueToPaint) {
                        newPixels[idx] = valueToPaint;
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            setCurrentPixels(newPixels);
        }
    }, [tool, thickness, currentPixels, width, height, selectedColorIndex, onChangeSelectedColorIndex, isTileBase, isShadowFrame, stampSource, lockZero]);

    // Save drawn stroke
    const commitChanges = () => {
        onUpdatePixels(currentPixels);
    };

    // Event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return; // Left click only
        if (isPlaying) {
            setIsPlaying(false);
        }
        const coord = getPixelCoords(e);
        if (coord) {
            if (tool === 'stamp' && (e.altKey || isAltPressed)) {
                e.preventDefault();
                setStampSource({ x: coord.x, y: coord.y });
                return;
            }
            setIsDrawing(true);
            if (tool === 'stamp') {
                setStrokeStart(coord);
            }
            paintAtPixel(coord.x, coord.y, coord);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const coord = getPixelCoords(e);
        if (coord) {
            setHoverCoord(coord);
            if (isDrawing) {
                if (tool === 'stamp' && (e.altKey || isAltPressed)) {
                    setStampSource({ x: coord.x, y: coord.y });
                    return;
                }
                paintAtPixel(coord.x, coord.y, strokeStart || coord);
            }
        } else {
            setHoverCoord(null);
        }
    };

    const handleMouseUpOrLeave = () => {
        if (isDrawing) {
            setIsDrawing(false);
            commitChanges();
        }
        if (!isDrawing) {
            setHoverCoord(null);
        }
    };

    // Touch support (e.g. tablet or mobile)
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (isPlaying) {
            setIsPlaying(false);
        }
        const coord = getPixelCoords(e);
        if (coord) {
            if (tool === 'stamp' && isAltPressed) {
                e.preventDefault();
                setStampSource({ x: coord.x, y: coord.y });
                return;
            }
            setIsDrawing(true);
            if (tool === 'stamp') {
                setStrokeStart(coord);
            }
            paintAtPixel(coord.x, coord.y, coord);
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        const coord = getPixelCoords(e);
        if (coord) {
            paintAtPixel(coord.x, coord.y, strokeStart || coord);
        }
    };

    const handleTouchEnd = () => {
        if (isDrawing) {
            setIsDrawing(false);
            commitChanges();
        }
    };

    // HOTKEYS: D (Draw), E (Erase), W (Eyedropper), S (Stamp)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();
            if (key === 'd') {
                setTool('pencil');
                e.preventDefault();
            } else if (key === 'e') {
                setTool('eraser');
                e.preventDefault();
            } else if (key === 'w') {
                setTool('eyedropper');
                e.preventDefault();
            } else if (key === 's') {
                setTool('stamp');
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Info for the hover coordinate colors
    const activeColorAtHover = hoverCoord 
        ? currentPixels[hoverCoord.y * width + hoverCoord.x]
        : null;

    const rgbAtHover = (activeColorAtHover !== null && activePalette[activeColorAtHover])
        ? activePalette[activeColorAtHover]
        : null;

    const brushSize = tool === 'eyedropper' ? 1 : thickness;

    return (
        <div ref={containerRef} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4 shadow-xl">
            {/* Header label and status */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="text-[10px] font-sans font-black uppercase text-slate-400 tracking-wider">
                    {label} ({width}x{height})
                </span>
                
                <div className="flex items-center gap-2">
                    {isShadowFrame && (
                        <span className="text-[8px] bg-amber-500/10 text-amber-500 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider border border-amber-500/20">
                            Shadow Mode
                        </span>
                    )}
                </div>
            </div>

            {/* Drawing Tools bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-2 rounded-lg border border-slate-800">
                {/* Pencil / Eraser / Eyedropper / Stamp Toggles */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex bg-slate-900 p-0.5 rounded-md border border-slate-800">
                        <button
                            type="button"
                            onClick={() => setTool('pencil')}
                            className={cn(
                                "p-1.5 rounded transition-all text-xs font-bold flex items-center gap-1 cursor-pointer",
                                tool === 'pencil' ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
                            )}
                            title="Pencil Tool [HotKey: D]"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="text-[9px] uppercase font-black px-0.5 hidden sm:inline">D</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTool('eraser')}
                            className={cn(
                                "p-1.5 rounded transition-all text-xs font-bold flex items-center gap-1 cursor-pointer",
                                tool === 'eraser' ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
                            )}
                            title="Eraser [HotKey: E]"
                        >
                            <Eraser className="w-3.5 h-3.5" />
                            <span className="text-[9px] uppercase font-black px-0.5 hidden sm:inline">E</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTool('eyedropper')}
                            className={cn(
                                "p-1.5 rounded transition-all text-xs font-bold flex items-center gap-1 cursor-pointer",
                                tool === 'eyedropper' ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
                            )}
                            title="Eyedropper [HotKey: W]"
                        >
                            <Pipette className="w-3.5 h-3.5" />
                            <span className="text-[9px] uppercase font-black px-0.5 hidden sm:inline">W</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTool('stamp')}
                            className={cn(
                                "p-1.5 rounded transition-all text-xs font-bold flex items-center gap-1 cursor-pointer",
                                tool === 'stamp' ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
                            )}
                            title="Clone Stamp Tool [HotKey: S]. Hold ALT + Click to set sample source coordinate."
                        >
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[9px] uppercase font-black px-0.5 hidden sm:inline">S</span>
                        </button>
                    </div>

                    {/* Lock #0 Checkbox */}
                    <label 
                        className="flex items-center gap-1.5 cursor-pointer select-none group border border-slate-800 bg-slate-900 rounded-md px-2 py-1.5 h-8 hover:bg-slate-850 transition-colors"
                        title="Lock element #0 so transparent backgrounds cannot be drawn over"
                    >
                        <input
                            type="checkbox"
                            checked={lockZero}
                            onChange={(e) => setLockZero(e.target.checked)}
                            className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer rounded bg-slate-950 border-slate-800"
                        />
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tight group-hover:text-slate-200">Lock #0</span>
                    </label>

                    {/* Refresh-icon #0 Button */}
                    <button
                        type="button"
                        onClick={handleRefreshZero}
                        className="flex items-center gap-1.5 cursor-pointer select-none border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-emerald-450 rounded-md px-2 py-1.5 h-8 transition-all active:scale-95"
                        title="Refresh original transparency (#0) inside the tile"
                    >
                        <RefreshCw className="w-3 h-3 text-emerald-550 animate-hover group-hover:rotate-180 transition-transform duration-500" />
                        <span className="text-[9px] font-extrabold uppercase tracking-tight">Refresh-icon #0</span>
                    </button>

                    {/* Integrated Undo / Redo in toolbar */}
                    {(onUndo || onRedo) && (
                        <div className="flex bg-slate-900 p-0.5 rounded-md border border-slate-800 ml-1">
                            {onUndo && (
                                <button
                                    type="button"
                                    onClick={onUndo}
                                    disabled={!canUndo}
                                    className={cn(
                                        "p-1.5 rounded transition-all cursor-pointer",
                                        canUndo ? "text-slate-200 hover:bg-slate-800 hover:text-white" : "text-slate-600 cursor-not-allowed"
                                    )}
                                    title="Undo action"
                                >
                                    <Undo2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {onRedo && (
                                <button
                                    type="button"
                                    onClick={onRedo}
                                    disabled={!canRedo}
                                    className={cn(
                                        "p-1.5 rounded transition-all cursor-pointer",
                                        canRedo ? "text-slate-200 hover:bg-slate-800 hover:text-white" : "text-slate-600 cursor-not-allowed"
                                    )}
                                    title="Redo action"
                                >
                                    <Redo2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Brush Thickness selector */}
                    {tool !== 'eyedropper' && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-bold text-slate-500 uppercase">Brush:</span>
                            <div className="flex bg-slate-900 p-0.5 rounded-md border border-slate-800 items-center">
                                {([1, 2, 3] as const).map(n => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setThickness(n)}
                                        className={cn(
                                            "px-2 py-0.5 text-[10px] font-mono leading-none rounded cursor-pointer font-bold",
                                            thickness === n ? "bg-slate-700 text-emerald-400 font-extrabold" : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        {n}px
                                    </button>
                                ))}
                                <select
                                    value={thickness > 3 ? thickness : ""}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        if (val >= 1 && val <= 10) setThickness(val);
                                    }}
                                    className="bg-slate-950 px-1 py-0.5 text-[9px] text-slate-400 font-mono font-bold hover:text-slate-250 outline-none border-l border-slate-800 h-4 min-w-[40px] cursor-pointer rounded-r"
                                >
                                    <option value="" disabled className="text-slate-500">...</option>
                                    {[4, 5, 6, 7, 8, 9, 10].map(v => (
                                        <option key={v} value={v} className="bg-slate-900 text-emerald-450 font-bold">{v}px</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Integrated Zoom Controls inside toolbar */}
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Zoom:</span>
                        <div className="flex bg-slate-900 p-0.5 rounded-md border border-slate-800 items-center">
                            <button
                                type="button"
                                onClick={() => setEditorZoom(prev => Math.max(1, prev - 1))}
                                className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] font-mono text-emerald-400 font-extrabold min-w-[24px] text-center">
                                {editorZoom}x
                            </span>
                            <button
                                type="button"
                                onClick={() => setEditorZoom(prev => Math.min(32, prev + 1))}
                                className="p-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    {/* Integrated Viewport Height Controls inside toolbar */}
                    <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">View-H:</span>
                        <div className="flex bg-slate-900 p-0.5 rounded-md border border-slate-800 items-center">
                            <button
                                type="button"
                                onClick={() => setViewportHeight(prev => Math.max(160, prev - 40))}
                                className="px-1.5 py-0.5 text-[9px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer hover:bg-slate-800 rounded font-black leading-none"
                                title="Shrink viewport height"
                            >
                                -
                            </button>
                            <span className="text-[10px] font-mono text-emerald-400 font-extrabold min-w-[36px] text-center">
                                {viewportHeight}px
                            </span>
                            <button
                                type="button"
                                onClick={() => setViewportHeight(prev => Math.min(1200, prev + 40))}
                                className="px-1.5 py-0.5 text-[9px] font-mono text-slate-400 hover:text-slate-250 cursor-pointer hover:bg-slate-800 rounded font-black leading-none"
                                title="Grow viewport height"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Interactive Paint Canvas Display */}
            <div 
                className="relative w-full bg-checkered rounded-xl border border-slate-800 flex items-center justify-center p-4 overflow-auto select-none group shadow-inner"
                style={{ height: `${viewportHeight}px` }}
            >
                {/* Isometric diamond border guide for tile base edits */}
                {isTileBase && (
                    <div className="absolute inset-0 border border-emerald-500/10 pointer-events-none rounded-lg flex items-center justify-center">
                        <span className="text-[7.5px] uppercase font-bold tracking-widest text-emerald-500/20 absolute bottom-1 right-2">
                            Base Diamond Boundary
                        </span>
                    </div>
                )}

                {/* Subcontainer keeping relative mouse footprint coordinates accurate */}
                <div 
                    className="relative cursor-none border border-white/5 shadow-2xl transition-all duration-100 flex-shrink-0"
                    style={{
                        width: width * editorZoom,
                        height: height * editorZoom
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUpOrLeave}
                        onMouseLeave={handleMouseUpOrLeave}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={cn(
                             "image-pixelated bg-black/40 w-full h-full",
                             isDrawing && "brightness-110"
                        )}
                    />

                    {/* Highly responsive custom brush indicator / pixel cursor that turns into the color selection */}
                    {hoverCoord && (
                        <div 
                            className="absolute pointer-events-none border border-white mix-blend-difference z-[99]"
                            style={{
                                left: `${((hoverCoord.x - Math.floor((brushSize - 1) / 2)) / width) * 100}%`,
                                top: `${((hoverCoord.y - Math.floor((brushSize - 1) / 2)) / height) * 100}%`,
                                width: `${(brushSize / width) * 100}%`,
                                height: `${(brushSize / height) * 100}%`,
                            }}
                        >
                            {tool === 'stamp' && stampSource && !isAltPressed ? (
                                <div className="grid w-full h-full gap-0" style={{ gridTemplateColumns: `repeat(${brushSize}, 1fr)` }}>
                                    {Array.from({ length: brushSize * brushSize }).map((_, i) => {
                                        const dx = (i % brushSize) - Math.floor((brushSize - 1) / 2);
                                        const dy = Math.floor(i / brushSize) - Math.floor((brushSize - 1) / 2);
                                        const sx = stampSource.x + dx;
                                        const sy = stampSource.y + dy;
                                        let colorStr = 'transparent';
                                        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                                            const val = currentPixels[sy * width + sx];
                                            if (val !== 0) {
                                                const c = activePalette[val];
                                                if (c) colorStr = `rgb(${c.r}, ${c.g}, ${c.b})`;
                                            }
                                        }
                                        return (
                                            <div 
                                                key={i} 
                                                style={{ backgroundColor: colorStr }} 
                                                className="w-full h-full border-[0.5px] border-white/20"
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div 
                                    className="w-full h-full"
                                    style={{
                                        backgroundColor: tool === 'eraser' 
                                            ? 'rgba(239, 68, 68, 0.4)' 
                                            : tool === 'eyedropper' 
                                                ? 'rgba(255, 255, 255, 0.2)' 
                                                : isShadowFrame 
                                                    ? 'rgba(245, 158, 11, 0.6)' 
                                                    : activePalette[selectedColorIndex]
                                                        ? `rgb(${activePalette[selectedColorIndex].r}, ${activePalette[selectedColorIndex].g}, ${activePalette[selectedColorIndex].b})`
                                                        : 'rgba(16, 185, 129, 0.5)',
                                    }}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Cursor coordinates overlay */}
                {hoverCoord && tool !== 'eyedropper' && (
                    <div className="absolute top-2 left-2 text-[8px] font-mono font-bold text-slate-400 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 pointer-events-none block z-10 shadow-lg">
                        X: {hoverCoord.x} Y: {hoverCoord.y}
                    </div>
                )}
            </div>

            {/* Optional Animation Controls panel placed below drawing canvas */}
            {frameCount !== undefined && currentFrameIndex !== undefined && onFrameIndexChange !== undefined && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                        <button 
                            type="button"
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={cn(
                                "p-2 rounded-md transition-all cursor-pointer font-bold uppercase text-[9px] flex items-center gap-1 px-3",
                                isPlaying ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-emerald-500 text-slate-950"
                            )}
                            title={isPlaying ? "Pause Animation" : "Play Animation"}
                        >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
                        </button>

                        <button 
                            type="button"
                            onClick={() => {
                                setIsPlaying(false);
                                const prev = (currentFrameIndex - 1 + frameCount) % frameCount;
                                onFrameIndexChange(prev);
                            }}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Previous Frame"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button 
                            type="button"
                            onClick={() => {
                                setIsPlaying(false);
                                const next = (currentFrameIndex + 1) % frameCount;
                                onFrameIndexChange(next);
                            }}
                            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Next Frame"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] bg-slate-900 border border-slate-800/80 px-3 py-1 rounded">
                        <span className="text-slate-500 font-sans uppercase font-black text-[8px]">Frame</span>
                        <span className="text-white font-black">{currentFrameIndex}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-slate-400">{frameCount - 1}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold uppercase text-[8px]">FPS:</span>
                        <input 
                            type="range" 
                            min="1" 
                            max="30" 
                            value={fps} 
                            onChange={(e) => setFps(Number(e.target.value))}
                            className="h-1 w-20 appearance-none bg-slate-900 border border-slate-800 rounded-lg outline-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-[10px] font-mono text-emerald-400 font-bold w-4 text-center">{fps}</span>
                    </div>
                </div>
            )}

            {/* Active Drawing index status */}
            <div className="flex items-center justify-between text-[10px] font-mono font-semibold bg-slate-950/60 p-2.5 rounded-lg border border-slate-900">
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-sans uppercase font-black text-[8px]">Active Index:</span>
                    {isShadowFrame ? (
                        <>
                            <div className="w-3.5 h-3.5 rounded border border-white/20 bg-amber-400 animate-pulse" />
                            <span className="text-white font-black">#1 (Preserved Shadow)</span>
                        </>
                    ) : (
                        <>
                            <div 
                                className="w-3.5 h-3.5 rounded border border-white/20 transition-all duration-200" 
                                style={{
                                    backgroundColor: activePalette[selectedColorIndex] 
                                        ? `rgb(${activePalette[selectedColorIndex].r},${activePalette[selectedColorIndex].g},${activePalette[selectedColorIndex].b})`
                                        : 'transparent'
                                }}
                            />
                            <span className="text-emerald-400 font-black">#{selectedColorIndex}</span>
                        </>
                    )}
                </div>

                {/* Eyedropper coordinates indicator */}
                {hoverCoord && rgbAtHover && (
                    <div className="text-slate-400 flex items-center gap-1.5">
                        <span className="text-slate-600 font-sans uppercase text-[8px]">Hovering:</span>
                        <div 
                            className="w-2.5 h-2.5 rounded-full border border-white/10" 
                            style={{ backgroundColor: `rgb(${rgbAtHover.r},${rgbAtHover.g},${rgbAtHover.b})` }} 
                        />
                        <span className="font-bold text-[9px]">#{activeColorAtHover}</span>
                    </div>
                )}
            </div>

            {/* Z-elevation picker inline swatches list */}
            {isZData && (
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-900/80 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-sky-450 uppercase tracking-widest block">
                            Z-Elevation Height Degrees (0-31)
                        </span>
                        <span className="text-[7px] text-slate-500 font-mono font-bold uppercase select-none">
                            Elevation val x 8 Grayscale Intensity
                        </span>
                    </div>
                    <div className="grid gap-1 bg-slate-950/40 p-1.5 rounded border border-slate-900" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                        {Array.from({ length: 32 }).map((_, i) => {
                            const gr = Math.min(255, i * 8);
                            const isSelected = selectedColorIndex === i;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onChangeSelectedColorIndex(i)}
                                    className={cn(
                                        "aspect-square w-full rounded border cursor-pointer transition-all hover:scale-125 hover:z-10",
                                        isSelected 
                                            ? "border-sky-400 scale-110 shadow-lg shadow-sky-500/25 ring-1 ring-sky-400" 
                                            : "border-slate-800 hover:border-slate-500"
                                    )}
                                    style={{ backgroundColor: `rgb(${gr},${gr},${gr})` }}
                                    title={`Z-Height Degree #${i} (val=${i}, grayscale=${gr})`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Hotkeys and support help summary */}
            <div className="text-[9px] text-slate-500 font-medium px-1 flex items-start gap-1 bg-slate-950/20 p-2 rounded border border-slate-900/50">
                <HelpCircle className="w-3 h-3 text-emerald-500/50 mt-0.5 shrink-0" />
                <p className="leading-normal">
                    <strong className="text-slate-400">Drawing Tips:</strong> Hotkeys <strong className="font-mono text-emerald-400 animate-pulse">D</strong> (Draw), <strong className="font-mono text-emerald-400">E</strong> (Erase), <strong className="font-mono text-emerald-400">W</strong> (Eyedropper), <strong className="font-mono text-emerald-400">S</strong> (Stamp) are active. {tool === 'stamp' ? <span className="text-amber-450 font-bold bg-amber-500/5 px-1 py-0.5 rounded border border-amber-500/10 ml-0.5">Hold ALT + click on any pixel to lock clone-stamping coordinates source.</span> : <span>Click palette swatches to set active index.</span>}
                </p>
            </div>
        </div>
    );
};
