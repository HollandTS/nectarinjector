
import React, { useRef, useState, useEffect } from 'react';

interface DrawMaskModalProps {
    onClose: () => void;
    onSave: (src: string) => void;
}

export const DrawMaskModal: React.FC<DrawMaskModalProps> = ({ onClose, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 20;
            ctxRef.current = ctx;
        }
    }, []);

    const startDrawing = (e: React.MouseEvent) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        ctxRef.current?.beginPath();
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !ctxRef.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(x, y);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#1a1f26] p-6 rounded-3xl border border-slate-700 shadow-2xl flex flex-col space-y-4 max-w-lg w-full">
                <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Mask Painter</span>
                        <span className="text-[8px] text-slate-500 uppercase font-black">White = Active, Black = Hidden</span>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full">✕</button>
                </div>
                <div className="bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner group">
                    <canvas 
                        ref={canvasRef} 
                        onMouseDown={startDrawing} 
                        onMouseUp={stopDrawing} 
                        onMouseMove={draw} 
                        onMouseLeave={stopDrawing}
                        className="cursor-crosshair w-full aspect-square"
                    />
                </div>
                <div className="flex space-x-3 pt-2">
                    <button onClick={() => {
                        if (canvasRef.current) onSave(canvasRef.current.toDataURL('image/png'));
                    }} className="flex-grow bg-amber-600 hover:bg-amber-500 text-white font-black text-xs py-3 rounded-xl uppercase tracking-widest shadow-lg transition-all active:scale-95">Save Mask</button>
                    <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-xs py-3 rounded-xl uppercase tracking-widest transition-all">Cancel</button>
                </div>
            </div>
        </div>
    );
};
