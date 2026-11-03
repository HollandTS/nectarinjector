import React from 'react';
import type { ProjectOverlay } from '../../types';

interface ConfirmInjectModalProps {
    overlay: ProjectOverlay | null;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmInjectModal: React.FC<ConfirmInjectModalProps> = ({
    overlay,
    onConfirm,
    onCancel,
}) => {
    if (!overlay) return null;

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="bg-[#1a1f26] border border-cyan-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-sm">
                        💉
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">
                            Confirm Injection
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold">
                            {overlay.name || 'SMART Layer'}
                        </p>
                    </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Inject this layer into selected tiles?
                </p>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 uppercase transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-cyan-600 hover:bg-cyan-500 text-white uppercase shadow-lg shadow-cyan-600/30 transition-all flex items-center space-x-1"
                    >
                        <span>Inject</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
