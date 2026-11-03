import React, { useRef, useEffect, useState } from 'react';
import type { HandBrushSettings } from '../../types';
import { renderHandBrushStamp, renderHandBrushCursor } from '../../utils/handBrushHelper';
import { loadImage } from '../../utils/textureInjection';

interface HandBrushCursorProps {
    cursorPos: { x: number; y: number } | null;
    settings: HandBrushSettings;
    config: { width: number; height: number };
    zoom: number;
}

export const HandBrushCursor: React.FC<HandBrushCursorProps> = ({
    cursorPos,
    settings,
    config,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const brushImgRef = useRef<HTMLImageElement | null>(null);
    const shadowImgRef = useRef<HTMLImageElement | null>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
        width: 64,
        height: 64,
    });

    const updateCursorCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !brushImgRef.current) return;

        const stamp = renderHandBrushStamp(brushImgRef.current, settings, config);
        const shadowStamp =
            settings.isShpBrush &&
            (settings.shpShadowEnabled ?? true) &&
            shadowImgRef.current
                ? renderHandBrushStamp(
                      shadowImgRef.current,
                      { ...settings, invert: false },
                      config,
                      undefined,
                      true
                  )
                : null;

        const cursorCanvas = renderHandBrushCursor(stamp, shadowStamp, settings);

        canvas.width = cursorCanvas.width;
        canvas.height = cursorCanvas.height;
        setDimensions((prev) =>
            prev.width === cursorCanvas.width && prev.height === cursorCanvas.height
                ? prev
                : { width: cursorCanvas.width, height: cursorCanvas.height }
        );

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(cursorCanvas, 0, 0);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (!settings.brushSrc) return;
            const img = await loadImage(settings.brushSrc);
            let sImg: HTMLImageElement | null = null;
            if (settings.isShpBrush && settings.shpShadowSrc) {
                sImg = await loadImage(settings.shpShadowSrc);
            }
            if (isMounted) {
                brushImgRef.current = img;
                shadowImgRef.current = sImg;
                updateCursorCanvas();
            }
        };
        load();
        return () => {
            isMounted = false;
        };
    }, [settings.brushSrc, settings.isShpBrush, settings.shpShadowSrc]);

    useEffect(() => {
        updateCursorCanvas();
    }, [
        cursorPos !== null,
        settings.mode,
        settings.footprint,
        settings.mainScale,
        settings.canvasZoom,
        settings.rotation,
        settings.mirrorH,
        settings.mirrorV,
        settings.invert,
        settings.tilingMode,
        settings.resizeSampling,
        settings.normalHue,
        settings.normalSaturation,
        settings.normalBrightness,
        settings.normalTransparency,
        settings.isShpBrush,
        settings.shpShadowEnabled,
        settings.shpShadowDarkness,
        settings.shpShadowOffsetX,
        settings.shpShadowOffsetY,
        config.width,
        config.height,
    ]);

    return (
        <div
            className="absolute pointer-events-none z-[12000] select-none"
            style={{
                display: cursorPos ? 'block' : 'none',
                left: cursorPos ? cursorPos.x - dimensions.width / 2 : 0,
                top: cursorPos ? cursorPos.y - dimensions.height / 2 : 0,
                width: dimensions.width,
                height: dimensions.height,
                willChange: 'left, top',
            }}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full drop-shadow-[0_0_8px_rgba(6,182,212,0.65)]"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
};
