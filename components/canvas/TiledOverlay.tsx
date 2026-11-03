
import React, { useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectOverlay, GridType } from '../../types';
import { GRID_CONFIGS } from '../../constants';
import { isoToScreen, screenToIso } from '../../utils/geoUtils';
import { getFullOverlaySurface } from '../../utils/overlaySurfaceRenderer';
import { useLayerTransparencyHitTest, isPixelOpaque } from '../../utils/layerTransparencyHelper';
import { getOverlayZIndex } from '../../utils/sceneOrderHelper';

interface TiledOverlayProps {
    overlay: ProjectOverlay;
    gridType: GridType;
    onUpdate: (id: string, updates: Partial<ProjectOverlay>) => void;
    zoom: number;
    isEyedropperActive: boolean;
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

export const TiledOverlay: React.FC<TiledOverlayProps> = ({ overlay, gridType, onUpdate, zoom, isEyedropperActive, activeInjectionEyedropperId, activeLassoId, isAltHeld, isThreeDMode, isLayerControlDisabled, toolMode, allOverlays, isHoldingTiles, onDrop }) => {
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

    const config = GRID_CONFIGS[gridType] || { width: 48, height: 24 };
    const f = overlay.filters;
    const footprint = (f.staticScale || 100) / 100;
    const tileW = config.width * footprint;
    const tileH = config.height * footprint;
    const rx = Math.max(1, Number(overlay.repeatX) || 1);
    const ry = Math.max(1, Number(overlay.repeatY) || 1);
    const minX = -ry * (tileW / 2);
    const minY = -tileH; 

    const handleMouseDown = (e: React.MouseEvent) => { 
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
            
            const dX = (moveEv.clientX - startX) / zoom;
            const dY = (moveEv.clientY - startY) / zoom;
            
            const nextX = startOverlayX + dX;
            const nextY = startOverlayY + dY;
            
            currentPos.current = { x: nextX, y: nextY };
            canvasRef.current.style.left = `${Math.round(nextX + minX)}px`;
            canvasRef.current.style.top = `${Math.round(nextY + minY)}px`;

            if (overlay.linkGroupId) {
                const linkedEls = document.querySelectorAll<HTMLElement>(`[data-link-group-id="${overlay.linkGroupId}"]`);
                linkedEls.forEach(el => {
                    if (el === canvasRef.current) return;
                    const baseLeft = parseFloat(el.dataset.baseLeft || '0');
                    const baseTop = parseFloat(el.dataset.baseTop || '0');
                    el.style.left = `${Math.round(baseLeft + dX)}px`;
                    el.style.top = `${Math.round(baseTop + dY)}px`;
                });
            }

            if (overlay.sceneGroupId && overlay.sceneGroupMoveTogether !== false) {
                const groupEls = document.querySelectorAll<HTMLElement>(`[data-scene-group-id="${overlay.sceneGroupId}"]`);
                groupEls.forEach(el => {
                    if (el === canvasRef.current) return;
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

                const currentConfig = GRID_CONFIGS[gridType]; 
                let finalX = currentPos.current.x;
                let finalY = currentPos.current.y;

                if (currentConfig) { 
                    const { width: cW, height: cH } = currentConfig;
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
    }, [overlay.src, overlay.repeatX, overlay.repeatY, overlay.filters, overlay.isVisible, overlay.paletteViewer, gridType, allOverlays]);

    const mode = 'pixelated';
    const zIndex = getOverlayZIndex(overlay, allOverlays);

    const leftVal = isNaN(overlay.x + minX) ? 0 : Math.round(overlay.x + minX);
    const topVal = isNaN(overlay.y + minY) ? 0 : Math.round(overlay.y + minY);

    return ( 
        <canvas 
            ref={canvasRef} 
            data-overlay-id={overlay.id}
            data-link-group-id={overlay.linkGroupId || undefined}
            data-scene-group-id={overlay.sceneGroupMoveTogether !== false ? (overlay.sceneGroupId || undefined) : undefined}
            data-base-left={leftVal}
            data-base-top={topVal}
            onMouseDown={handleMouseDown} 
            onContextMenu={e => e.preventDefault()} 
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={onDrop}
            style={{ 
                position: 'absolute', 
                left: leftVal, 
                top: topVal, 
                opacity: overlay.isVisible ? overlay.opacity / 100 : 0, 
                zIndex: zIndex, 
                cursor: isToolActive ? 'crosshair' : 'default', 
                imageRendering: mode, 
                pointerEvents: 'none',
                willChange: 'left, top'
            }} 
        /> 
    );
};
