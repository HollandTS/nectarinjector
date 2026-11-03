import React, { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import { ShpFrame, ShpParser } from '../lib/shp';
import { RGB } from '../lib/formats';
import { cn } from '../lib/utils';

interface ShpFramePreviewProps {
    frame: ShpFrame;
    index: number;
    globalWidth: number;
    globalHeight: number;
    palette: RGB[];
    isSelected: boolean;
    onClick: () => void;
}

export const ShpFramePreview: React.FC<ShpFramePreviewProps> = React.memo(({
    frame,
    index,
    globalWidth,
    globalHeight,
    palette,
    isSelected,
    onClick
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                threshold: 0,
                rootMargin: '200px'
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!frame || !palette || palette.length === 0) return;

        if (isVisible && canvasRef.current) {
            const timer = setTimeout(() => {
                if (canvasRef.current && isVisible) {
                    ShpParser.renderFrameToCanvas(canvasRef.current, frame, globalWidth, globalHeight, palette);
                }
            }, 50);
            return () => clearTimeout(timer);
        } else if (!isVisible && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = 1;
            canvas.height = 1;
        }
    }, [frame, palette, isVisible, globalWidth, globalHeight]);

    return (
        <div
            ref={containerRef}
            onClick={onClick}
            className={cn(
                "aspect-[2/1] rounded-lg border transition-all cursor-pointer p-1 group relative overflow-hidden",
                isSelected
                    ? "bg-slate-500/10 border-sky-400 shadow-[0_0_20px_-5px_theme(colors.sky.400)]"
                    : "bg-slate-800/80 border-slate-800 hover:border-slate-600 hover:bg-slate-800"
            )}
        >
            <div className="w-full h-full rounded-[6px] bg-slate-900/50 flex flex-col items-center justify-center">
                {frame ? (
                    <canvas
                        ref={canvasRef}
                        className={cn(
                            "max-w-full max-h-full image-pixelated transition-opacity duration-300 bg-black/40",
                            isVisible ? "opacity-100" : "opacity-0"
                        )}
                    />
                ) : (
                    <Box className="w-4 h-4 text-slate-800" />
                )}
            </div>
            {frame.isShadow && (
                <div className="absolute top-1 left-1 bg-black/60 text-amber-500 text-[6px] font-black px-1 rounded uppercase tracking-widest border border-amber-500/20">
                    Shadow
                </div>
            )}
            <div className={cn(
                "absolute bottom-0.5 right-1 px-1 rounded text-[7px] font-black font-mono transition-all",
                isSelected ? "bg-sky-400 text-slate-950" : "bg-slate-800 text-slate-500 group-hover:text-slate-400"
            )}>
                F-{index}
            </div>
        </div>
    );
});
