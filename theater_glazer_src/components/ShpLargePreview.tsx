import React, { useEffect, useRef } from 'react';
import { ShpFrame, ShpParser } from '../lib/shp';
import { RGB } from '../lib/formats';

interface ShpLargePreviewProps {
    frame: ShpFrame;
    globalWidth: number;
    globalHeight: number;
    palette: RGB[];
}

export const ShpLargePreview: React.FC<ShpLargePreviewProps> = React.memo(({
    frame,
    globalWidth,
    globalHeight,
    palette
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current && frame && palette && palette.length > 0) {
            ShpParser.renderFrameToCanvas(canvasRef.current, frame, globalWidth, globalHeight, palette);
        }

        return () => {
            if (canvasRef.current) {
                canvasRef.current.width = 1;
                canvasRef.current.height = 1;
            }
        };
    }, [frame, palette, globalWidth, globalHeight]);

    return (
        <canvas 
            ref={canvasRef} 
            className="image-pixelated scale-[1.5] sm:scale-[2] origin-center shadow-2xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] bg-black/40" 
        />
    );
});
