
import React, { useRef, useEffect } from 'react';

interface DraggableContainerProps {
    children: React.ReactNode;
    initialPos: { x: number; y: number };
    initialSize?: { width: number; height: number };
    size?: { width: number; height: number };
    className?: string;
    resizable?: boolean;
    minWidth?: number;
    minHeight?: number;
    onResize?: (size: { width: number; height: number }) => void;
}

const DraggableContainer: React.FC<DraggableContainerProps> = ({ 
    children, initialPos, initialSize = { width: 320, height: 480 }, size: controlledSize, className = '', resizable = false, minWidth = 100, minHeight = 100, onResize
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pos = useRef(initialPos);
    const size = useRef(controlledSize || initialSize);
    const dragging = useRef(false);
    const resizing = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const resizeOffset = useRef({ w: 0, h: 0 });
    const requestRef = useRef<number>(null);

    useEffect(() => {
        if (controlledSize && containerRef.current) {
            size.current = controlledSize;
            containerRef.current.style.width = `${controlledSize.width}px`;
            containerRef.current.style.height = `${controlledSize.height}px`;
        }
    }, [controlledSize]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const handle = target.closest('.drag-handle');
        const resizeHandle = target.closest('.resize-handle');

        if (resizeHandle && containerRef.current && resizable) {
            resizing.current = true;
            resizeOffset.current = {
                w: e.clientX - size.current.width,
                h: e.clientY - size.current.height
            };

            const updateSize = () => {
                if (!resizing.current || !containerRef.current) return;
                containerRef.current.style.width = `${size.current.width}px`;
                containerRef.current.style.height = `${size.current.height}px`;
                requestRef.current = requestAnimationFrame(updateSize);
            };

            const handleMouseMove = (moveEv: MouseEvent) => {
                if (!resizing.current) return;
                size.current = {
                    width: Math.max(minWidth, moveEv.clientX - resizeOffset.current.w),
                    height: Math.max(minHeight, moveEv.clientY - resizeOffset.current.h)
                };
            };

            const handleMouseUp = () => {
                resizing.current = false;
                if (requestRef.current) cancelAnimationFrame(requestRef.current);
                if (onResize) onResize(size.current);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };

            requestRef.current = requestAnimationFrame(updateSize);
            window.addEventListener('mousemove', handleMouseMove, { passive: true });
            window.addEventListener('mouseup', handleMouseUp);
            e.stopPropagation();
            return;
        }

        if (handle && containerRef.current) {
            dragging.current = true;
            offset.current = { 
                x: e.clientX - pos.current.x, 
                y: e.clientY - pos.current.y 
            };
            
            const updatePosition = () => {
                if (!dragging.current || !containerRef.current) return;
                containerRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
                requestRef.current = requestAnimationFrame(updatePosition);
            };

            const handleMouseMove = (moveEv: MouseEvent) => {
                if (!dragging.current) return;
                const newX = moveEv.clientX - offset.current.x;
                const newY = moveEv.clientY - offset.current.y;
                
                // Constrain to viewport so at least some part is always visible
                const minVisible = 40;
                const maxX = window.innerWidth - minVisible;
                const maxY = window.innerHeight - minVisible;
                const minX = -size.current.width + minVisible;
                const minY = 0; // Keep top bar visible
                
                pos.current = { 
                    x: Math.max(minX, Math.min(maxX, newX)), 
                    y: Math.max(minY, Math.min(maxY, newY)) 
                };
            };

            const handleMouseUp = () => {
                dragging.current = false;
                if (requestRef.current) cancelAnimationFrame(requestRef.current);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };

            requestRef.current = requestAnimationFrame(updatePosition);
            window.addEventListener('mousemove', handleMouseMove, { passive: true });
            window.addEventListener('mouseup', handleMouseUp);
            
            e.stopPropagation();
        }
    };

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
            containerRef.current.style.width = `${size.current.width}px`;
            containerRef.current.style.height = `${size.current.height}px`;
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <div 
            ref={containerRef}
            style={{ 
                position: 'fixed', 
                top: 0,
                left: 0,
                zIndex: 1000, 
                willChange: 'transform, width, height',
                transition: 'none',
                userSelect: 'none',
                display: 'flex',
                flexDirection: 'column'
            }} 
            onMouseDown={handleMouseDown} 
            className={className}
        >
            {children}
            {resizable && (
                <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center group">
                    <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-slate-600 group-hover:border-cyan-400 transition-colors" />
                </div>
            )}
        </div>
    );
};

export default DraggableContainer;
