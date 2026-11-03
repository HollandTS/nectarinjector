import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface MissingFilesAlertProps {
  missingFiles: string[];
  onDismiss: () => void;
}

export const MissingFilesAlert: React.FC<MissingFilesAlertProps> = ({
  missingFiles,
  onDismiss
}) => {
  if (missingFiles.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-6 right-6 z-40 bg-slate-950/95 backdrop-blur-md rounded-2xl border border-red-500/30 p-4 shadow-[0_12px_40px_-12px_rgba(239,68,68,0.3)] animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-400 shrink-0 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">
              Missing map companion assets
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal max-w-xl">
              This `.sugarmap` layout was reconstructed, but the following {missingFiles.length} file(s) are not present in your Palette workspace assets sidebar. Loaded elements might appear incomplete or invisible until the assets below are uploaded.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-24 overflow-y-auto">
              {missingFiles.map((fn, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-red-950/40 text-rose-300 border border-rose-500/10 rounded text-[9px] font-mono leading-none flex items-center"
                >
                  {fn}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 px-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-800"
          title="Dismiss missing files warning header"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
