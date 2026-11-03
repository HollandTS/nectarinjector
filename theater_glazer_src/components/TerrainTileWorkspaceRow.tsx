import React, { useRef, useEffect, useState } from 'react';
import { TmpParser, Tile, RGB } from '../lib/formats';
import { cn } from '../lib/utils';

interface TerrainTileWorkspaceRowProps {
    tile: Tile | null;
    index: number;
    palette: RGB[];
    selectedTileSlot: number | null;
    selectedComponent: 'base' | 'extra' | null;
    onSelectSegment: (tile: Tile, componentType: 'base' | 'extra') => void;
}

export const TerrainTileWorkspaceRow: React.FC<TerrainTileWorkspaceRowProps> = React.memo(({
    tile,
    index,
    palette,
    selectedTileSlot,
    selectedComponent,
    onSelectSegment
}) => {
    const baseCanvasRef = useRef<HTMLCanvasElement>(null);
    const baseZCanvasRef = useRef<HTMLCanvasElement>(null);
    const extraCanvasRef = useRef<HTMLCanvasElement>(null);
    const extraZCanvasRef = useRef<HTMLCanvasElement>(null);

    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                threshold: 0,
                rootMargin: '150px'
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    // Render hook
    useEffect(() => {
        if (!tile || !palette || !isVisible) return;

        const timer = setTimeout(() => {
            if (baseCanvasRef.current && isVisible) {
                TmpParser.renderTileToCanvas(baseCanvasRef.current, tile, palette, false);
            }
            if (baseZCanvasRef.current && isVisible) {
                TmpParser.renderTileToCanvas(baseZCanvasRef.current, tile, palette, true);
            }
            if (tile.header.has_extra_data && extraCanvasRef.current && isVisible) {
                TmpParser.renderExtraToCanvas(extraCanvasRef.current, tile, palette, false);
            }
            if (tile.header.has_extra_data && extraZCanvasRef.current && isVisible) {
                TmpParser.renderExtraToCanvas(extraZCanvasRef.current, tile, palette, true);
            }
        }, 30);

        return () => clearTimeout(timer);
    }, [tile, palette, isVisible]);

    if (!tile) return null;

    const isBaseSelected = selectedTileSlot === tile.slot && selectedComponent === 'base';
    const isExtraSelected = selectedTileSlot === tile.slot && selectedComponent === 'extra';

    return (
        <div 
            ref={containerRef}
            className="flex items-stretch gap-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl p-3 select-none transition-all"
        >
            {/* Index label column */}
            <div className="flex flex-col items-center justify-center bg-slate-950 px-2.5 py-2 rounded-lg border border-slate-800/50 min-w-[36px]">
                <span className="text-[10px] font-black text-slate-500 font-mono leading-none">#{index}</span>
                <span className="text-[7.5px] font-black text-emerald-500/60 uppercase tracking-widest mt-1">SLOT</span>
            </div>

            {/* Thumbnails row / columns */}
            <div className="flex-1 flex flex-col gap-2.5">
                {/* Row 1: Base + Base Z */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Base Color Image */}
                    <div 
                        onClick={() => onSelectSegment(tile, 'base')}
                        className={cn(
                            "flex flex-col items-center justify-center p-1.5 rounded-lg border cursor-pointer group transition-all h-[56px] bg-slate-950 relative overflow-hidden",
                            isBaseSelected 
                                ? "border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10" 
                                : "border-slate-800/80 hover:border-slate-600 hover:bg-slate-900"
                        )}
                        title="Click to draw on this Base Tile Image in editor"
                    >
                        <canvas ref={baseCanvasRef} className="max-w-full max-h-full image-pixelated bg-blue-900/40 relative z-10" />
                        <span className="absolute bottom-0.5 right-1.5 text-[6.5px] font-mono uppercase text-slate-500 font-extrabold tracking-wider bg-slate-950/80 px-1 rounded">
                            Color
                        </span>
                    </div>

                    {/* Base Z-Data Image */}
                    <div 
                        onClick={() => onSelectSegment(tile, 'base')}
                        className={cn(
                            "flex flex-col items-center justify-center p-1.5 rounded-lg border cursor-pointer group transition-all h-[56px] bg-slate-950 relative overflow-hidden",
                            isBaseSelected 
                                ? "border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10" 
                                : "border-slate-800/80 hover:border-slate-600 hover:bg-slate-900"
                        )}
                        title="Click to draw on this Base Tile Z-Data in editor"
                    >
                        <canvas ref={baseZCanvasRef} className="max-w-full max-h-full image-pixelated bg-rose-950/20 relative z-10" />
                        <span className="absolute bottom-0.5 right-1.5 text-[6.5px] font-mono uppercase text-slate-500 font-extrabold tracking-wider bg-slate-950/80 px-1 rounded">
                            Z-Data
                        </span>
                    </div>
                </div>

                {/* Row 2: Extra Data (Only if present) */}
                {tile.header.has_extra_data ? (
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-800/40 pt-2 animate-in fade-in duration-150">
                        {/* Extra Layout image */}
                        <div 
                            onClick={() => onSelectSegment(tile, 'extra')}
                            className={cn(
                                "flex flex-col items-center justify-center p-1.5 rounded-lg border cursor-pointer group transition-all h-[56px] bg-slate-950 relative overflow-hidden",
                                isExtraSelected 
                                    ? "border-sky-500 bg-sky-950/20 shadow-md shadow-sky-500/10" 
                                    : "border-slate-800/80 hover:border-slate-600 hover:bg-slate-900"
                            )}
                            title="Click to draw on this Extra Layout segment in editor"
                        >
                            <canvas ref={extraCanvasRef} className="max-w-full max-h-full image-pixelated bg-slate-900 relative z-10" />
                            <span className="absolute bottom-0.5 right-1.5 text-[6.5px] font-mono uppercase text-slate-500 font-extrabold tracking-wider bg-slate-950/80 px-1 rounded">
                                Extra
                            </span>
                        </div>

                        {/* Extra Layout Z-data image */}
                        <div 
                            onClick={() => onSelectSegment(tile, 'extra')}
                            className={cn(
                                "flex flex-col items-center justify-center p-1.5 rounded-lg border cursor-pointer group transition-all h-[56px] bg-slate-950 relative overflow-hidden",
                                isExtraSelected 
                                    ? "border-sky-500 bg-sky-950/20 shadow-md shadow-sky-500/10" 
                                    : "border-slate-800/80 hover:border-slate-600 hover:bg-slate-900"
                            )}
                            title="Click to draw on this Extra Layout Z-Data in editor"
                        >
                            <canvas ref={extraZCanvasRef} className="max-w-full max-h-full image-pixelated bg-slate-900 relative z-10" />
                            <span className="absolute bottom-0.5 right-1.5 text-[6.5px] font-mono uppercase text-slate-500 font-extrabold tracking-wider bg-slate-950/80 px-1 rounded">
                                Extra-Z
                            </span>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
});
