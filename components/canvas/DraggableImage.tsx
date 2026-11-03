
import React, { useRef, useState, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import type { CanvasImage, RgbaColor, GridType, ProjectOverlay, ContourSettings, MaskGroup } from '../../types';
import { GRID_CONFIGS } from '../../constants';
import { isoToScreen, screenToIso, getImageDrawPos } from '../../utils/geoUtils';
import { colorDistance } from '../../utils/colorUtils';
import { applyContourEffect, applyContourInjection } from '../../utils/imageEffects';
import { renderOverlayToCanvas, bakeOverlaysToTile } from '../../utils/textureInjection';
import { getInitialDraggablePositions, getSnappedOffsets } from '../../utils/snapDragHelper';
import { applyKeyColorToCanvas } from '../../utils/transparencyKeyHelper';
import { getTileZIndex } from '../../utils/sceneOrderHelper';
import { computeSmartTileHeightLevel } from '../../utils/waeRampHelper';

interface DraggableImageProps {
    image: CanvasImage;
    allImages?: CanvasImage[];
    autoSlopeSnap?: boolean;
    onUpdateImagePos: (ids: string[], dgx: number, dgy: number, snapGrid: boolean) => void;
    isEyedropperActive: boolean;
    transparencyColor: RgbaColor | null;
    tolerance: number;
    gridType: GridType;
    lastActiveGrid: 'ts_full' | 'ra2_full' | 'opents_full';
    isSelected: boolean;
    onSelect: (e: ReactMouseEvent) => void;
    zoom: number;
    selectedImageIds: Set<string>;
    previewContour?: ContourSettings | null;
    previewMaskOverlay?: ProjectOverlay | null;
    previewGroupIds?: string[];
    previewBakedSrc?: string | null;
    activeInjectionEyedropperId?: string | null;
    activeLassoId?: string | null;
    isContourPickerActive?: boolean;
    isContourLassoActive?: boolean;
    onSampleColor: (color: RgbaColor) => void;
    isAltHeld: boolean;
    onGlobalTransparencyPick?: (color: RgbaColor) => void;
    isThreeDMode?: boolean;
    isTileControlDisabled?: boolean;
    isSnapEnabled: boolean;
    useTransparencyToDrag?: boolean;
    overlays: ProjectOverlay[];
    toolMode?: string;
    hideSelectionOutline?: boolean;
    isCapturingStamp?: boolean;
    isHoldingTiles?: boolean;
    onDrop?: (e: React.DragEvent) => void;
}

export const DraggableImage: React.FC<DraggableImageProps> = ({ 
    image, allImages = [], autoSlopeSnap = true, onUpdateImagePos, isEyedropperActive, transparencyColor, tolerance, gridType, lastActiveGrid, isSelected, onSelect, zoom, selectedImageIds, previewContour, previewMaskOverlay, previewGroupIds = [], previewBakedSrc, activeInjectionEyedropperId, activeLassoId, isContourPickerActive, isContourLassoActive, onSampleColor, isAltHeld, onSampleColor: onSampleColorProp, onGlobalTransparencyPick, isThreeDMode, isTileControlDisabled, isSnapEnabled, useTransparencyToDrag = true, overlays, toolMode, hideSelectionOutline = false, isCapturingStamp, isHoldingTiles, onDrop
}) => {
    const draggingRef = useRef(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });
    
    const activeGrid = gridType === 'none' ? lastActiveGrid : gridType;
    const config = GRID_CONFIGS[activeGrid] || { width: 48, height: 24 };
    const drawPos = getImageDrawPos(image, config.width, config.height);
    const initialLeft = Math.round(drawPos.x) + image.offsetX;
    const initialTop = Math.round(drawPos.y) + image.offsetY;

    const zIndex = getTileZIndex(image, isSelected);

    const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => { 
        if (isThreeDMode) return;
        if (isHoldingTiles) return;
        // Important: Yield to active drawing/picking tools
        if (activeLassoId || isContourLassoActive || isAltHeld || toolMode === 'TRANSITION_STAMP' || toolMode === 'HAND_BRUSH') return;
        
        if (activeInjectionEyedropperId || isContourPickerActive || isEyedropperActive) {
            if (e.button === 2) return; 
            
            const c = e.currentTarget; 
            const rect = c.getBoundingClientRect(); 
            const x = (e.clientX - rect.left) / zoom; 
            const y = (e.clientY - rect.top) / zoom; 
            const ctx = (c as HTMLCanvasElement).getContext('2d', { willReadFrequently: true }); 
            if (ctx) { 
                const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data; 
                if (pixel[3] < 10) return;
                const sampledColor = { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] / 255 };
                if (activeInjectionEyedropperId || isContourPickerActive) onSampleColor(sampledColor);
                else if (isEyedropperActive && onGlobalTransparencyPick) onGlobalTransparencyPick(sampledColor);
            }
            return;
        }

        if (isTileControlDisabled) return;

        if (!useTransparencyToDrag) {
            const c = e.currentTarget; 
            const rect = c.getBoundingClientRect(); 
            const x = (e.clientX - rect.left) / zoom; 
            const y = (e.clientY - rect.top) / zoom; 
            const ctx = (c as HTMLCanvasElement).getContext('2d', { willReadFrequently: true }); 
            if (ctx) { 
                const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data; 
                if (pixel[3] < 10) return;
            }
        }

        onSelect(e); 
        if (e.button !== 0) return; 
        
        draggingRef.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY }; 
        
        e.preventDefault(); 
        e.stopPropagation(); 

        const idsToMove = isSelected ? Array.from(selectedImageIds) : [image.id];
        const movingIdSet = new Set(idsToMove);
        const stationaryImages = allImages.filter(img => !movingIdSet.has(img.id));
        const initialPositions = getInitialDraggablePositions(idsToMove);

        const onMouseMove = (moveEv: MouseEvent) => { 
            if (!draggingRef.current) return; 
            const offsets = getSnappedOffsets(
                moveEv.clientX,
                moveEv.clientY,
                e.clientX,
                e.clientY,
                zoom,
                config.width,
                config.height
            );

            const dx = isSnapEnabled ? offsets.snappedDx : offsets.dxTotal;
            let dy = isSnapEnabled ? offsets.snappedDy : offsets.dyTotal;

            if (isSnapEnabled && autoSlopeSnap && stationaryImages.length > 0) {
                const targetGx = Math.round(image.gridX + offsets.dgxSnapped);
                const targetGy = Math.round(image.gridY + offsets.dgySnapped);
                const nextLevel = computeSmartTileHeightLevel(
                    image,
                    targetGx,
                    targetGy,
                    stationaryImages,
                    config.width,
                    config.height
                );
                const levelDelta = nextLevel - (image.heightLevel ?? 0);
                dy -= levelDelta * (config.height / 2);
            }

            initialPositions.forEach(item => {
                item.el.style.left = `${item.left + dx}px`;
                item.el.style.top = `${item.top + dy}px`;
                item.el.style.zIndex = '5000';
            });

            if (image.sceneGroupId && image.sceneGroupMoveTogether !== false) {
                const movingElSet = new Set(initialPositions.map(p => p.el));
                const groupEls = document.querySelectorAll<HTMLElement>(`[data-scene-group-id="${image.sceneGroupId}"]`);
                groupEls.forEach(el => {
                    if (movingElSet.has(el)) return;
                    const baseLeft = parseFloat(el.dataset.baseLeft || '0');
                    const baseTop = parseFloat(el.dataset.baseTop || '0');
                    if (!isNaN(baseLeft) && !isNaN(baseTop)) {
                        el.style.left = `${Math.round(baseLeft + dx)}px`;
                        el.style.top = `${Math.round(baseTop + dy)}px`;
                    }
                });
            }
        };

        const onMouseUp = (upEv: MouseEvent) => { 
            if (draggingRef.current) { 
                draggingRef.current = false;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);

                const offsets = getSnappedOffsets(
                    upEv.clientX,
                    upEv.clientY,
                    e.clientX,
                    e.clientY,
                    zoom,
                    config.width,
                    config.height
                );

                const finalDgx = isSnapEnabled ? offsets.dgxSnapped : offsets.dgx;
                const finalDgy = isSnapEnabled ? offsets.dgySnapped : offsets.dgy;
                onUpdateImagePos(idsToMove, finalDgx, finalDgy, isSnapEnabled); 
            } 
        };

        window.addEventListener('mousemove', onMouseMove); 
        window.addEventListener('mouseup', onMouseUp);
    };

    useEffect(() => {
        let isMounted = true;
        let timeoutId: any = null;

        const runEffect = async () => {
            const canvas = canvasRef.current; 
            const ctx = canvas?.getContext('2d', { willReadFrequently: true }); 
            if (!ctx || !canvas || !isMounted) return;

            const img = new Image(); 
            const srcToLoad = previewBakedSrc || image.src;
            if (srcToLoad && !srcToLoad.startsWith('data:')) {
                img.crossOrigin = "Anonymous";
            }
            
            const loadPromise = new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = srcToLoad;
            });

            try {
                await loadPromise;
                if (!isMounted) return;

                canvas.width = image.width; 
                canvas.height = image.height; 
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, canvas.width, canvas.height); 
                ctx.save();
                if (image.flipH || image.flipV) { 
                    ctx.translate(image.flipH ? canvas.width : 0, image.flipV ? canvas.height : 0); 
                    ctx.scale(image.flipH ? -1 : 1, image.flipV ? -1 : 1); 
                }
                ctx.drawImage(img, 0, 0); ctx.restore();

                // Apply key color transparency for PNG files loaded as tiles
                if (transparencyColor && !image.tmpBuffer) {
                    applyKeyColorToCanvas(ctx, transparencyColor, tolerance);
                }
                
                if (previewContour && isSelected) applyContourEffect(ctx, previewContour, image.tmpBuffer ? null : transparencyColor, tolerance);
            } catch (err) {
                console.warn("DraggableImage effect failed", err);
            } finally {
                img.src = ""; // Help GC
            }
        };

        timeoutId = setTimeout(runEffect, isSelected ? 0 : 50);

        return () => { 
            isMounted = false; 
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [image.src, image.width, image.height, image.renderMode, previewMaskOverlay?.filters.renderMode, transparencyColor, tolerance, image.flipH, image.flipV, previewContour, previewBakedSrc, isSelected, gridType, initialLeft, initialTop]);
    
    const isPickingToolActive = !!(activeInjectionEyedropperId || activeLassoId || isContourPickerActive || isContourLassoActive);
    const isHandBrushMode = toolMode === 'HAND_BRUSH';
    const cursorType = isHandBrushMode ? 'none' : ((isPickingToolActive || isEyedropperActive) ? 'crosshair' : (isAltHeld ? 'crosshair' : 'grab'));
    const isStampMode = toolMode === 'TRANSITION_STAMP';
    const showOutline = (isSelected && !hideSelectionOutline && !isPickingToolActive && !previewContour && !previewBakedSrc) || isStampMode;

    return ( 
        <canvas 
            ref={canvasRef} 
            data-image-id={image.id} 
            data-scene-group-id={image.sceneGroupMoveTogether !== false ? (image.sceneGroupId || undefined) : undefined}
            data-base-left={initialLeft}
            data-base-top={initialTop}
            onMouseDown={onMouseDown} 
            onContextMenu={e => e.preventDefault()} 
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={onDrop}
            style={{ 
                position: 'absolute', 
                left: initialLeft, 
                top: initialTop, 
                width: image.width, 
                height: image.height, 
                cursor: cursorType, 
                userSelect: 'none', 
                zIndex: zIndex, 
                outline: showOutline ? (isStampMode ? '1px solid #7dd3fc' : '2px solid #22d3ee') : 'none', 
                boxShadow: showOutline ? (isStampMode ? 'none' : '0 0 15px rgba(34, 211, 238, 0.6)') : 'none', 
                imageRendering: 'pixelated',
                pointerEvents: isHoldingTiles ? 'none' : 'auto',
                willChange: 'left, top'
            }} 
        /> 
    );
};
