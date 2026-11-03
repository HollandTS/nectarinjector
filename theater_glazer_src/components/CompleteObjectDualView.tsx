import React, { useRef, useEffect, useState } from 'react';
import { TmpParser, TmpFile, RGB } from '../lib/formats';
import { cn } from '../lib/utils';
import { Layers } from 'lucide-react';

interface CompleteObjectDualViewProps {
    tmpFile: TmpFile;
    palette: RGB[];
    zoom: number;
    isSelected: boolean;
    onSelectFullObject: () => void;
}

export const CompleteObjectDualView: React.FC<CompleteObjectDualViewProps> = React.memo(({
    tmpFile,
    palette,
    zoom,
    isSelected,
    onSelectFullObject
}) => {
    const colorCanvasRef = useRef<HTMLCanvasElement>(null);
    const zCanvasRef = useRef<HTMLCanvasElement>(null);
    
    const [colorDimensions, setColorDimensions] = useState({ w: 0, h: 0 });
    const [zDimensions, setZDimensions] = useState({ w: 0, h: 0 });

    // Render Color Composite
    useEffect(() => {
        if (colorCanvasRef.current && palette.length > 0) {
            TmpParser.renderCompleteToCanvas(colorCanvasRef.current, tmpFile, palette, false);
            setColorDimensions({
                w: colorCanvasRef.current.width,
                h: colorCanvasRef.current.height
            });
        }
    }, [tmpFile, palette]);

    // Render Z-Data Composite
    useEffect(() => {
        if (zCanvasRef.current && palette.length > 0) {
            TmpParser.renderCompleteToCanvas(zCanvasRef.current, tmpFile, palette, true);
            setZDimensions({
                w: zCanvasRef.current.width,
                h: zCanvasRef.current.height
            });
        }
    }, [tmpFile, palette]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (colorCanvasRef.current) {
                colorCanvasRef.current.width = 1;
                colorCanvasRef.current.height = 1;
            }
            if (zCanvasRef.current) {
                zCanvasRef.current.width = 1;
                zCanvasRef.current.height = 1;
            }
        };
    }, []);

    return (
        <div 
            onClick={onSelectFullObject}
            className={cn(
                "w-full bg-slate-950/80 p-4 rounded-xl border transition-all cursor-pointer select-none space-y-4 shadow-2xl relative",
                isSelected 
                    ? "border-emerald-500 bg-slate-900 shadow-emerald-500/10" 
                    : "border-slate-800 hover:border-slate-600 hover:bg-slate-900"
            )}
        >
            {/* Legend Tag */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                    <Layers className={cn("w-4 h-4", isSelected ? "text-emerald-400" : "text-slate-500")} />
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">
                        Entire Reconstructed Object
                    </span>
                </div>
                {isSelected && (
                    <span className="text-[7.5px] uppercase font-black bg-emerald-500/20 md:px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400">
                        Active Painting Focus
                    </span>
                )}
            </div>

            {/* Layout container for color object and z-data underneath */}
            <div className="flex flex-col items-center gap-4">
                {/* 1. Color Object View (Top) */}
                <div className="w-full flex flex-col items-center">
                    <span className="text-[7px] font-black tracking-widest text-slate-500 uppercase mb-1.5 self-start">
                        Layer 1: Object Image Representation
                    </span>
                    <div className="bg-checkered rounded-lg border border-slate-800 flex items-center justify-center p-3 overflow-auto max-w-full">
                        <div 
                            style={{
                                width: colorDimensions.w * zoom,
                                height: colorDimensions.h * zoom
                            }}
                            className="transition-all duration-100 shrink-0 select-none"
                        >
                            <canvas 
                                ref={colorCanvasRef}
                                className="image-pixelated w-full h-full hover:brightness-110 active:scale-[0.99] transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Z-Data Height View (Underneath) */}
                <div className="w-full flex flex-col items-center border-t border-slate-800/60 pt-3">
                    <span className="text-[7px] font-black tracking-widest text-slate-500 uppercase mb-1.5 self-start">
                        Layer 2: Object Z-Data Height values
                    </span>
                    <div className="bg-checkered rounded-lg border border-slate-800 flex items-center justify-center p-3 overflow-auto max-w-full">
                        <div 
                            style={{
                                width: zDimensions.w * zoom,
                                height: zDimensions.h * zoom
                            }}
                            className="transition-all duration-100 shrink-0 select-none hover:shadow-inner"
                        >
                            <canvas 
                                ref={zCanvasRef}
                                className="image-pixelated w-full h-full hover:brightness-110 active:scale-[0.99] transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
