import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShpFile, ShpParser } from '../lib/shp';
import { RGB } from '../lib/formats';

interface ShpObjectViewProps {
    shpFile: ShpFile;
    palette: RGB[];
    zoom: number;
    initialFrameIndex: number;
    onFrameChange?: (index: number) => void;
}

export const ShpObjectView: React.FC<ShpObjectViewProps> = React.memo(({
    shpFile,
    palette,
    zoom,
    initialFrameIndex,
    onFrameChange
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentIndex, setCurrentIndex] = useState(initialFrameIndex);
    const [isPlaying, setIsPlaying] = useState(true);
    const [fps, setFps] = useState(10); // Standard C&C TS/RA2 frame rate defaults around 10-15fps

    // Sync state if selected frame changes out-of-band
    useEffect(() => {
        setCurrentIndex(initialFrameIndex);
    }, [initialFrameIndex]);

    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                const next = (prev + 1) % shpFile.frames.length;
                if (onFrameChange) {
                    onFrameChange(next);
                }
                return next;
            });
        }, 1000 / fps);

        return () => clearInterval(interval);
    }, [isPlaying, shpFile, fps, onFrameChange]);

    useEffect(() => {
        if (canvasRef.current && palette && palette.length > 0) {
            ShpParser.renderShpCompleteToCanvas(canvasRef.current, shpFile, currentIndex, palette);
        }

        return () => {
            if (canvasRef.current) {
                canvasRef.current.width = 1;
                canvasRef.current.height = 1;
            }
        };
    }, [shpFile, currentIndex, palette]);

    const handlePrev = () => {
        setIsPlaying(false);
        const prev = (currentIndex - 1 + shpFile.frames.length) % shpFile.frames.length;
        setCurrentIndex(prev);
        if (onFrameChange) onFrameChange(prev);
    };

    const handleNext = () => {
        setIsPlaying(false);
        const next = (currentIndex + 1) % shpFile.frames.length;
        setCurrentIndex(next);
        if (onFrameChange) onFrameChange(next);
    };

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Stage Container */}
            <div 
                className="shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 bg-black/40 flex items-center justify-center overflow-hidden"
                style={{ 
                    width: shpFile.width * zoom, 
                    height: shpFile.height * zoom 
                }}
            >
                <canvas 
                    ref={canvasRef} 
                    className="image-pixelated w-full h-full"
                />
            </div>

            {/* Animation and Playback Controls (pinned at bottom of view panel) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-4 text-xs font-semibold shadow-2xl backdrop-blur-sm select-none z-10">
                <div className="flex items-center gap-1.5 border-r border-slate-800 pr-4">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-1.5 hover:bg-slate-800 rounded transition-colors text-emerald-400 hover:text-emerald-300"
                        title={isPlaying ? "Pause" : "Play Animation"}
                    >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button 
                        onClick={handlePrev}
                        className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                        title="Previous Frame"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={handleNext}
                        className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                        title="Next Frame"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2 border-r border-slate-800 pr-4 font-mono text-[11px]">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Frame</span>
                    <span className="text-white font-black">{currentIndex}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-400">{shpFile.frames.length - 1}</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">FPS</span>
                    <input 
                        type="range" 
                        min="1" 
                        max="30" 
                        value={fps} 
                        onChange={(e) => setFps(Number(e.target.value))}
                        className="h-1 w-16 appearance-none bg-slate-800 rounded-lg outline-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-[10px] font-mono text-emerald-500 font-bold">{fps}</span>
                </div>
            </div>
        </div>
    );
});
