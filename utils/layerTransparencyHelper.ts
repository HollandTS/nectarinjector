import React, { useEffect, useRef } from 'react';

/**
 * Checks if a specific screen point (clientX, clientY) intersects an opaque pixel
 * on a given HTMLCanvasElement.
 */
export function isPixelOpaque(
    canvas: HTMLCanvasElement | null,
    clientX: number,
    clientY: number,
    alphaThreshold = 15
): boolean {
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return false;
    }
    if (rect.width <= 0 || rect.height <= 0 || canvas.width <= 0 || canvas.height <= 0) {
        return false;
    }
    const px = Math.floor((clientX - rect.left) * (canvas.width / rect.width));
    const py = Math.floor((clientY - rect.top) * (canvas.height / rect.height));
    if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) {
        return false;
    }
    try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return false;
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        return pixel[3] >= alphaThreshold;
    } catch {
        return true;
    }
}

interface UseLayerTransparencyHitTestOptions {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    isVisible: boolean;
    isDragging: boolean;
    isHoldingTiles?: boolean;
    isToolActive?: boolean;
    isThreeDMode?: boolean;
    isInteractionDisabled?: boolean;
}

/**
 * Hook to manage pointer-events and cursor on a layer canvas so that
 * transparency is not selectable or draggable in the viewport.
 */
export function useLayerTransparencyHitTest({
    canvasRef,
    isVisible,
    isDragging,
    isHoldingTiles,
    isToolActive,
    isThreeDMode,
    isInteractionDisabled,
}: UseLayerTransparencyHitTestOptions) {
    const isDraggingRef = useRef(isDragging);
    isDraggingRef.current = isDragging;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!isVisible || isThreeDMode || isToolActive || isHoldingTiles || isInteractionDisabled) {
            canvas.style.pointerEvents = 'none';
            canvas.style.cursor = isToolActive ? 'crosshair' : 'default';
            return;
        }

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current) return;
            const currentCanvas = canvasRef.current;
            if (!currentCanvas) return;

            const opaque = isPixelOpaque(currentCanvas, e.clientX, e.clientY);
            if (opaque) {
                currentCanvas.style.pointerEvents = 'auto';
                currentCanvas.style.cursor = 'move';
            } else {
                currentCanvas.style.pointerEvents = 'none';
                currentCanvas.style.cursor = 'default';
            }
        };

        window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [canvasRef, isVisible, isThreeDMode, isToolActive, isHoldingTiles, isInteractionDisabled]);
}
