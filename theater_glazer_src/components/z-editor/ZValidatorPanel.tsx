import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  Wrench, 
  Activity 
} from 'lucide-react';
import { ZValidationReport, ZTargetLayer } from './types';
import { cn } from '../../lib/utils';

interface ZValidatorPanelProps {
  report: ZValidationReport;
  engine: string;
  width: number;
  height: number;
  targetLayer: ZTargetLayer;
  onAutoFix: () => void;
}

export const ZValidatorPanel: React.FC<ZValidatorPanelProps> = ({
  report,
  engine,
  width,
  height,
  targetLayer,
  onAutoFix
}) => {
  const hasErrors = report.issues.some((i) => i.type === 'error');
  const hasWarnings = report.issues.some((i) => i.type === 'warning');

  return (
    <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Depth Inspector</h3>
        </div>
        <span className={cn(
          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
          engine === 'OpenTS' ? 'bg-amber-500/20 text-amber-400' :
          engine === 'RA2' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
        )}>
          {engine}
        </span>
      </div>

      {/* Metrics Summary */}
      <div className="p-3 space-y-2 border-b border-slate-800 bg-slate-950/40">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Dimensions:</span>
          <span className="font-mono font-bold text-white">{width}×{height}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Layer:</span>
          <span className="font-mono font-bold capitalize text-sky-400">{targetLayer}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Z-Range:</span>
          <span className="font-mono font-bold text-white">
            {report.minZ} → {report.maxZ} <span className="text-slate-500 font-normal">/ {report.expectedMaxZ}</span>
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Active Z Pixels:</span>
          <span className="font-mono font-bold text-slate-200">{report.totalPixels}</span>
        </div>
      </div>

      {/* Validation Status */}
      <div className="p-3 flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Engine Health</span>
          {hasErrors ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <AlertTriangle className="w-3 h-3" /> Issues Found
            </span>
          ) : hasWarnings ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
              <AlertTriangle className="w-3 h-3" /> Warnings
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> Verified
            </span>
          )}
        </div>

        {/* Issue list */}
        <div className="space-y-2">
          {report.issues.map((issue, idx) => (
            <div
              key={idx}
              className={cn(
                "p-2.5 rounded-lg border text-xs leading-relaxed",
                issue.type === 'error'
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : issue.type === 'warning'
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : "bg-slate-800/60 border-slate-700 text-slate-300"
              )}
            >
              <div className="flex items-start gap-1.5">
                {issue.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                {issue.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                {issue.type === 'info' && <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />}
                <span>{issue.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Auto Fix Button */}
        {(hasErrors || hasWarnings) && (
          <button
            type="button"
            onClick={onAutoFix}
            className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm active:scale-95"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Auto-Repair Issues</span>
          </button>
        )}
      </div>

      {/* Quick Guide Tips */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/20 text-[10px] text-slate-500 space-y-1">
        <p>• <strong>Pencil</strong>: stamp discrete depth integers.</p>
        <p>• <strong>Column</strong>: keeps cliff columns vertically uniform.</p>
        <p>• <strong>Standard</strong>: fills Westwood <code className="text-slate-400">cy - 1 - y</code>.</p>
      </div>
    </div>
  );
};
