
import React, { useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectOverlay, GridType } from '../../types';
import { GRID_CONFIGS } from '../../constants';
import { isoToScreen, screenToIso } from '../../utils/geoUtils';
import { getFullOverlaySurface } from '../../utils/overlaySurfaceRenderer';
import { useLayerTransparencyHitTest, isPixelOpaque } from '../../utils/layerTransparencyHelper';
import { getOverlayZIndex } from '../../utils/sceneOrderHelper';

interface SmartOverlayProps {
    overlay: ProjectOverlay;
    onUpdate: (id: string, updates: Partial<ProjectOverlay>) => void;
    zoom: number;
    isEyedropperActive: boolean;
    gridType: GridType;
    activeInjectionEyedropperId?: string | null;
    activeLassoId?: string | null;
    isAltHeld: boolean;
    isThreeDMode?: boolean;
    isLayerControlDisabled?: boolean;
    toolMode?: string;
    allOverlays: ProjectOverlay[];
    isHoldingTiles?: boolean;
    onDrop?: (e: React.DragEvent) => void;
}

export const SmartOverlay: React.FC<SmartOverlayProps> = ({ overlay, onUpdate, zoom, isEyedropperActive, gridType, activeInjectionEyedropperId, activeLassoId, isAltHeld, isThreeDMode, isLayerControlDisabled, toolMode, allOverlays, isHoldingTiles, onDrop }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const draggingRef = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: overlay.x, y: overlay.y });
    
    const isToolActive = isEyedropperActive || activeInjectionEyedropperId || activeLassoId || isAltHeld || toolMode === 'TRANSITION_STAMP' || toolMode === 'HAND_BRUSH';

    useLayerTransparencyHitTest({
        canvasRef,
        isVisible: overlay.isVisible,
        isDragging: draggingRef.current,
        isHoldingTiles,
        isToolActive,
        isThreeDMode,
        isInteractionDisabled: isLayerControlDisabled,
    });

    const handleMouseDown = (e: ReactMouseEvent) => { 
        if (isThreeDMode || isLayerControlDisabled || isToolActive || isHoldingTiles || e.button !== 0) return; 
        if (!isPixelOpaque(canvasRef.current, e.clientX, e.clientY)) return;
        draggingRef.current = true;
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startOverlayX = overlay.x;
        const startOverlayY = overlay.y;
        
        e.preventDefault(); 
        e.stopPropagation(); 
        
        const onMouseMove = (moveEv: MouseEvent) => { 
            if (!draggingRef.current || !canvasRef.current) return; 
            const parentEl = canvasRef.current.parentElement;
            if (!parentEl) return;
            
            const dX = (moveEv.clientX - startX) / zoom;
            const dY = (moveEv.clientY - startY) / zoom;
            
            const nextX = startOverlayX + dX;
            const nextY = startOverlayY + dY;
            
            currentPos.current = { x: nextX, y: nextY };
            parentEl.style.left = `${Math.round(nextX)}px`;
            parentEl.style.top = `${Math.round(nextY)}px`;

            if (overlay.linkGroupId) {
                const linkedEls = document.querySelectorAll<HTMLElement>(`[data-link-group-id="${overlay.linkGroupId}"]`);
                linkedEls.forEach(el => {
                    if (el === parentEl) return;
                    const baseLeft = parseFloat(el.dataset.baseLeft || '0');
                    const baseTop = parseFloat(el.dataset.baseTop || '0');
                    el.style.left = `${Math.round(baseLeft + dX)}px`;
                    el.style.top = `${Math.round(baseTop + dY)}px`;
                });
            }

            if (overlay.sceneGroupId && overlay.sceneGroupMoveTogether !== false) {
                const groupEls = document.querySelectorAll<HTMLElement>(`[data-scene-group-id="${overlay.sceneGroupId}"]`);
                groupEls.forEach(el => {
                    if (el === parentEl) return;
                    const baseLeft = parseFloat(el.dataset.baseLeft || '0');
                    const baseTop = parseFloat(el.dataset.baseTop || '0');
                    if (!isNaN(baseLeft) && !isNaN(baseTop)) {
                        el.style.left = `${Math.round(baseLeft + dX)}px`;
                        el.style.top = `${Math.round(baseTop + dY)}px`;
                    }
                });
            }
        };

        const onMouseUp = () => { 
            if (draggingRef.current) { 
                draggingRef.current = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);

                const config = GRID_CONFIGS[gridType]; 
                let finalX = currentPos.current.x;
                let finalY = currentPos.current.y;

                if (config) {
                    const { width: cW, height: cH } = config;
                    const iso = screenToIso(finalX, finalY, cW, cH);
                    const snapped = isoToScreen(Math.round(iso.i), Math.round(iso.j), cW, cH);
                    finalX = snapped.x;
                    finalY = snapped.y;
                } 
                onUpdate(overlay.id, { x: finalX, y: finalY }); 
            } 
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startOverlayX = overlay.x;
        const startOverlayY = overlay.y;
        const startWidth = overlay.width || 100;
        const startHeight = overlay.height || 100;

        const f = overlay.filters;
        const footprint = (f.staticScale || 100) / 100;
        const individualZoom = (f.mainScale || 100) / 100;
        const scaleFactor = footprint * individualZoom;

        const onMouseMove = (moveEv: MouseEvent) => {
            const dX = (moveEv.clientX - startX) / zoom;
            const dY = (moveEv.clientY - startY) / zoom;
            
            // Scaled changes (for width & height which are affected by scale parameters)
            const logicalDX = dX / scaleFactor;
            const logicalDY = dY / scaleFactor;

            const minSize = 25;
            let nextWidth = startWidth;
            let nextHeight = startHeight;
            let nextX = startOverlayX;
            let nextY = startOverlayY;

            if (handle === 'R' || handle === 'TR' || handle === 'BR') {
                nextWidth = Math.max(minSize, startWidth + logicalDX);
            } else if (handle === 'L' || handle === 'TL' || handle === 'BL') {
                const computedWidth = startWidth - logicalDX;
                if (computedWidth >= minSize) {
                    nextWidth = computedWidth;
                    nextX = startOverlayX + dX;
                } else {
                    nextWidth = minSize;
                    nextX = startOverlayX + (startWidth - minSize) * scaleFactor;
                }
            }

            if (handle === 'B' || handle === 'BL' || handle === 'BR') {
                nextHeight = Math.max(minSize, startHeight + logicalDY);
            } else if (handle === 'T' || handle === 'TL' || handle === 'TR') {
                const computedHeight = startHeight - logicalDY;
                if (computedHeight >= minSize) {
                    nextHeight = computedHeight;
                    nextY = startOverlayY + dY;
                } else {
                    nextHeight = minSize;
                    nextY = startOverlayY + (startHeight - minSize) * scaleFactor;
                }
            }

            onUpdate(overlay.id, {
                x: Math.round(nextX),
                y: Math.round(nextY),
                width: Math.round(nextWidth),
                height: Math.round(nextHeight)
            });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    useEffect(() => {
        if (!overlay.src || !canvasRef.current || !overlay.isVisible) return;
        const canvas = canvasRef.current; 
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
        if (!ctx) return;

        let isAborted = false;
        let animationFrameId: number;

        const render = async () => {
            const surface = await getFullOverlaySurface(overlay, gridType, allOverlays);
            if (!surface || isAborted) return;

            animationFrameId = requestAnimationFrame(() => {
                if (isAborted || !canvasRef.current) return;
                if (canvas.width !== surface.width || canvas.height !== surface.height) {
                    canvas.width = surface.width;
                    canvas.height = surface.height;
                } else {
                    ctx.clearRect(0, 0, surface.width, surface.height);
                }

                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(surface.canvas, 0, 0);
            });
        };

        render();
        return () => {
            isAborted = true;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [overlay.src, overlay.width, overlay.height, overlay.filters, overlay.isVisible, overlay.paletteViewer, gridType, allOverlays]);

    const mode = 'pixelated';
    const zIndex = getOverlayZIndex(overlay, allOverlays);
    
    const f = overlay.filters;
    const footprint = (f.staticScale || 100) / 100;
    const individualZoom = (f.mainScale || 100) / 100;
    const drawW = Math.max(1, Math.round((overlay.width || 1) * footprint * individualZoom) || 1);
    const drawH = Math.max(1, Math.round((overlay.height || 1) * footprint * individualZoom) || 1);

    const leftVal = (isNaN(overlay.x) || overlay.x === null || overlay.x === undefined ? 0 : Math.round(overlay.x));
    const topVal = (isNaN(overlay.y) || overlay.y === null || overlay.y === undefined ? 0 : Math.round(overlay.y));

    return ( 
        <div
            data-overlay-id={overlay.id}
            data-link-group-id={overlay.linkGroupId || undefined}
            data-scene-group-id={overlay.sceneGroupMoveTogether !== false ? (overlay.sceneGroupId || undefined) : undefined}
            data-base-left={leftVal}
            data-base-top={topVal}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={onDrop}
            style={{ 
                position: 'absolute', 
                left: leftVal, 
                top: topVal, 
                width: drawW, 
                height: drawH, 
                zIndex: zIndex, 
                pointerEvents: 'none'
            }} 
        >
            <canvas 
                ref={canvasRef} 
                onMouseDown={handleMouseDown} 
                onContextMenu={e => e.preventDefault()} 
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={onDrop}
                style={{ 
                    position: 'absolute', 
                    inset: 0,
                    width: '100%', 
                    height: '100%', 
                    opacity: overlay.isVisible ? overlay.opacity / 100 : 0, 
                    cursor: isToolActive ? 'crosshair' : 'default', 
                    imageRendering: mode, 
                    filter: 'none', 
                    pointerEvents: 'none',
                    willChange: 'left, top'
                }} 
            /> 

            {/* Resize border and handles */}
            {overlay.isResizing && overlay.isVisible && (
                <div className="absolute inset-0 border-2 border-dashed border-cyan-400 pointer-events-none shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                    {/* Handles inside the container so mouse can always hover and drag */}
                    {/* Corners */}
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'TL')} 
                        className="absolute -top-2 -left-2 w-4 h-4 bg-cyan-400 border-2 border-slate-950 rounded pointer-events-auto hover:bg-white hover:scale-110 active:scale-95 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        style={{ cursor: 'nwse-resize' }}
                        title="Resize Top-Left"
                    />
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'TR')} 
                        className="absolute -top-2 -right-2 w-4 h-4 bg-cyan-400 border-2 border-slate-950 rounded pointer-events-auto hover:bg-white hover:scale-110 active:scale-95 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        style={{ cursor: 'nesw-resize' }}
                        title="Resize Top-Right"
                    />
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'BL')} 
                        className="absolute -bottom-2 -left-2 w-4 h-4 bg-cyan-400 border-2 border-slate-950 rounded pointer-events-auto hover:bg-white hover:scale-110 active:scale-95 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        style={{ cursor: 'nesw-resize' }}
                        title="Resize Bottom-Left"
                    />
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'BR')} 
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-cyan-400 border-2 border-slate-950 rounded pointer-events-auto hover:bg-white hover:scale-110 active:scale-95 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        style={{ cursor: 'nwse-resize' }}
                        title="Resize Bottom-Right"
                    />

                    {/* Edge bars */}
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'T')} 
                        className="absolute -top-2 left-2 right-2 h-3 hover:bg-cyan-400/25 pointer-events-auto transition-all"
                        style={{ cursor: 'ns-resize' }}
                        title="Resize Top"
                    />
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'B')} 
                        className="absolute -bottom-2 left-2 right-2 h-3 hover:bg-cyan-400/25 pointer-events-auto transition-all"
                        style={{ cursor: 'ns-resize' }}
                        title="Resize Bottom"
                    />
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'L')} 
                        className="absolute -left-2 top-2 bottom-2 w-3 hover:bg-cyan-400/25 pointer-events-auto transition-all"
                        style={{ cursor: 'ew-resize' }}
                        title="Resize Left"
                    />
                    <div 
                        onMouseDown={(e) => handleResizeMouseDown(e, 'R')} 
                        className="absolute -right-2 top-2 bottom-2 w-3 hover:bg-cyan-400/25 pointer-events-auto transition-all"
                        style={{ cursor: 'ew-resize' }}
                        title="Resize Right"
                    />
                </div>
            )}
        </div>
    );
};
