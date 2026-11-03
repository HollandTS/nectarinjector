import React, { useState, useRef } from 'react';
import { X, Upload, ArrowLeftRight, Download, CheckCircle2, ChevronRight, Files } from 'lucide-react';
import { TmpParser, TmpFile, RGB } from '../lib/formats';
import { tryLoadStockFile, tryLoadStockRa2File, mergeResizedWithStock } from '../lib/stockConverter';
import { LoadedFile } from '../types';
import { cn } from '../lib/utils';
import JSZip from 'jszip';

interface ZFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFilesToWorkspace: (files: LoadedFile[]) => void;
  palette: RGB[] | null;
  imageFilter?: 'quadratic' | 'linear' | 'box' | 'nearest';
  zFilter?: 'quadratic' | 'linear' | 'box' | 'nearest';
  smartZData?: boolean;
}

interface TempTileRecord {
  name: string;
  baseName: string;
  size: number;
  content: TmpFile;
}

export const ZFilesModal: React.FC<ZFilesModalProps> = ({
  isOpen,
  onClose,
  onAddFilesToWorkspace,
  palette,
  imageFilter = 'quadratic',
  zFilter = 'quadratic',
  smartZData = false
}) => {
  const [tsFiles, setTsFiles] = useState<TempTileRecord[]>([]);
  const [ra2Files, setRa2Files] = useState<TempTileRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedStatus, setProcessedStatus] = useState<string | null>(null);

  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Strips extension & returns lowercase base name (e.g. slope01)
  const getBaseName = (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, "").toLowerCase();
  };

  // File parsers
  const handleTsFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const list: TempTileRecord[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const parsed = TmpParser.parseTmp(buffer);
        list.push({
          name: file.name,
          baseName: getBaseName(file.name),
          size: file.size,
          content: parsed
        });
      } catch (err) {
        console.error("Failed to parse TS Tmp file:", file.name, err);
      }
    }
    setTsFiles(prev => {
      // Avoid duplicate base names
      const existingBases = new Set(prev.map(f => f.baseName));
      const filtered = list.filter(f => !existingBases.has(f.baseName));
      return [...prev, ...filtered];
    });
  };

  const handleRa2FilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const list: TempTileRecord[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const buffer = await file.arrayBuffer();
        const parsed = TmpParser.parseTmp(buffer);
        list.push({
          name: file.name,
          baseName: getBaseName(file.name),
          size: file.size,
          content: parsed
        });
      } catch (err) {
        console.error("Failed to parse RA2 Tmp file:", file.name, err);
      }
    }
    setRa2Files(prev => {
      // Avoid duplicate base names
      const existingBases = new Set(prev.map(f => f.baseName));
      const filtered = list.filter(f => !existingBases.has(f.baseName));
      return [...prev, ...filtered];
    });
  };

  // Drag and drop event preventers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDropTs = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files) {
      handleTsFilesSelected(e.dataTransfer.files);
    }
  };

  const onDropRa2 = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files) {
      handleRa2FilesSelected(e.dataTransfer.files);
    }
  };

  // Matching logic
  const allBaseNames = Array.from(new Set([
    ...tsFiles.map(f => f.baseName),
    ...ra2Files.map(f => f.baseName)
  ]));

  const detectedTiles = allBaseNames.map(baseName => {
    const tsFile = tsFiles.find(f => f.baseName === baseName);
    const ra2File = ra2Files.find(f => f.baseName === baseName);
    return {
      baseName,
      tsFile,
      ra2File
    };
  });

  // Core Hybrid processing function
  const processAllFiles = async (action: 'workspace' | 'zip') => {
    if (allBaseNames.length === 0) return;
    setIsProcessing(true);
    setProcessedStatus(`Processing ${allBaseNames.length} custom tiles...`);

    // Give browser brief window to render loader
    await new Promise(r => setTimeout(r, 80));

    const hybridFiles: LoadedFile[] = [];
    const zip = new JSZip();

    try {
      for (const baseName of allBaseNames) {
        const customTs = tsFiles.find(f => f.baseName === baseName);
        const customRa2 = ra2Files.find(f => f.baseName === baseName);
        const isRamp = baseName.includes('slope') || baseName.includes('rmp');

        // Direction 1: Custom TS loaded -> convert to RA2 structure (size 60x30)
        if (customTs) {
          let ra2Tmp: TmpFile | null = null;
          if (customRa2) {
            ra2Tmp = customRa2.content;
          } else {
            ra2Tmp = await tryLoadStockRa2File(baseName);
          }

          const converted = TmpParser.convertEngine(customTs.content, 'RA2', { 
            isRamp, 
            imageFilter: imageFilter as 'quadratic' | 'linear' | 'box' | 'nearest', 
            zFilter: zFilter as 'quadratic' | 'linear' | 'box' | 'nearest',
            smartZData
          });

          // Merge colors into RA2 tile's Z-data and layout structure
          const merged = ra2Tmp ? mergeResizedWithStock(converted, ra2Tmp) : converted;

          const finalFile: LoadedFile = {
            name: `${customTs.name.replace(/\.[^/.]+$/, "")}.tem`, // output RA2 .tem file
            fileType: 'TMP',
            content: merged
          };
          hybridFiles.push(finalFile);

          if (action === 'zip') {
            const buffer = TmpParser.writeTmp(merged);
            zip.file(finalFile.name, buffer);
          }
        }

        // Direction 2: Custom RA2 loaded -> convert to TS structure (size 48x24)
        if (customRa2) {
          let tsTmp: TmpFile | null = null;
          if (customTs) {
            tsTmp = customTs.content;
          } else {
            tsTmp = await tryLoadStockFile(baseName);
          }

          const converted = TmpParser.convertEngine(customRa2.content, 'TS', { 
            isRamp, 
            imageFilter: imageFilter as 'quadratic' | 'linear' | 'box' | 'nearest', 
            zFilter: zFilter as 'quadratic' | 'linear' | 'box' | 'nearest',
            smartZData
          });

          // Merge colors into TS tile's Z-data and layout structure
          const merged = tsTmp ? mergeResizedWithStock(converted, tsTmp) : converted;

          const finalFile: LoadedFile = {
            name: `${customRa2.name.replace(/\.[^/.]+$/, "")}.tem`, // output TS .tem file
            fileType: 'TMP',
            content: merged
          };
          hybridFiles.push(finalFile);

          if (action === 'zip') {
            const buffer = TmpParser.writeTmp(merged);
            const zipName = customTs ? `${customRa2.baseName}_ts.tem` : finalFile.name;
            zip.file(zipName, buffer);
          }
        }
      }

      if (action === 'workspace') {
        onAddFilesToWorkspace(hybridFiles);
        setProcessedStatus(`Success! Added ${hybridFiles.length} hybrid tiles to workspace.`);
      } else {
        const blob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `z_hybrid_tiles_convert.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setProcessedStatus(`Success! Downloaded ZIP archive containing converts.`);
      }
    } catch (err) {
      console.error("Hybrid generation error:", err);
      setProcessedStatus(`Error during processing match tiles: ${String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAllUploaded = () => {
    setTsFiles([]);
    setRa2Files([]);
    setProcessedStatus(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0c1220] border border-slate-800/80 w-full max-w-4xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header section */}
        <header className="p-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <ArrowLeftRight className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                Z-Files Match Manager
              </h2>
              <p className="text-[11px] text-slate-400">
                Pair up custom TS &amp; RA2 terrain files to scale coordinates and transplant Z-data heights beautifully.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Workspace dropzone grids */}
        <section className="flex-1 overflow-y-auto p-5 grid grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-none gap-4 min-h-0 bg-slate-950/30">
          
          {/* Left Column - Tiberian Sun */}
          <div 
            onDragOver={onDragOver}
            onDrop={onDropTs}
            className="border border-dashed border-slate-800/90 rounded-lg p-3 bg-slate-900/30 flex flex-col h-full min-h-0"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-emerald-400"></span>
                Tiberian Sun (TS - 48×24)
              </span>
              <button
                type="button"
                onClick={() => leftInputRef.current?.click()}
                className="py-1 px-2 border border-slate-800/80 hover:bg-slate-800 rounded text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload TMPs
              </button>
              <input 
                ref={leftInputRef} 
                type="file" 
                multiple 
                accept="*" 
                className="hidden" 
                onChange={(e) => handleTsFilesSelected(e.target.files)} 
              />
            </div>

            {tsFiles.length === 0 ? (
              <div 
                onClick={() => leftInputRef.current?.click()}
                className="flex-1 border border-dashed border-slate-800/40 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] rounded-lg flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all"
              >
                <Upload className="w-8 h-8 text-emerald-400/20 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold text-slate-400">Drag &amp; Drop TS Files Here</p>
                <p className="text-[10px] text-slate-500 mt-1">Accepts raw map .tem files</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-800/40 bg-slate-950/40 rounded-lg p-2 space-y-1.5">
                {tsFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 bg-slate-900/50 rounded border border-slate-800/30">
                    <span className="text-[11px] font-mono font-medium text-slate-300 truncate w-[75%]">{f.name}</span>
                    <button
                      onClick={() => setTsFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-0.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded cursor-pointer text-[10px]"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-right">
              <span className="text-[9px] font-mono text-slate-500">{tsFiles.length} files loaded</span>
            </div>
          </div>

          {/* Right Column - Red Alert 2 */}
          <div 
            onDragOver={onDragOver}
            onDrop={onDropRa2}
            className="border border-dashed border-slate-800/90 rounded-lg p-3 bg-slate-900/30 flex flex-col h-full min-h-0"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-red-400"></span>
                Red Alert 2 (RA2 - 60×30)
              </span>
              <button
                type="button"
                onClick={() => rightInputRef.current?.click()}
                className="py-1 px-2 border border-slate-800/80 hover:bg-slate-800 rounded text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload TMPs
              </button>
              <input 
                ref={rightInputRef} 
                type="file" 
                multiple 
                accept="*" 
                className="hidden" 
                onChange={(e) => handleRa2FilesSelected(e.target.files)} 
              />
            </div>

            {ra2Files.length === 0 ? (
              <div 
                onClick={() => rightInputRef.current?.click()}
                className="flex-1 border border-dashed border-slate-800/40 hover:border-red-500/20 hover:bg-red-500/[0.01] rounded-lg flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all"
              >
                <Upload className="w-8 h-8 text-red-400/20 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-semibold text-slate-400">Drag &amp; Drop RA2 Files Here</p>
                <p className="text-[10px] text-slate-500 mt-1">Accepts raw map .tem files</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-800/40 bg-slate-950/40 rounded-lg p-2 space-y-1.5">
                {ra2Files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 bg-slate-900/50 rounded border border-slate-800/30">
                    <span className="text-[11px] font-mono font-medium text-slate-300 truncate w-[75%]">{f.name}</span>
                    <button
                      onClick={() => setRa2Files(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-0.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded cursor-pointer text-[10px]"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-right">
              <span className="text-[9px] font-mono text-slate-500">{ra2Files.length} files loaded</span>
            </div>
          </div>

        </section>

        {/* Pairing Summary Indicators */}
        <section className="bg-slate-950 border-t border-b border-slate-800/80 p-3 h-[24vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Files className="w-3.5 h-3.5" />
              Pairing Diagnostics ({allBaseNames.length} custom tiles)
            </h3>
            {allBaseNames.length > 0 && (
              <button 
                onClick={clearAllUploaded} 
                className="text-[9px] font-bold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-slate-900 border border-transparent hover:border-red-500/10 cursor-pointer"
              >
                Clear Grid
              </button>
            )}
          </div>

          {allBaseNames.length === 0 ? (
            <div className="h-full flex items-center justify-center pb-4 text-center">
              <p className="text-[11px] text-slate-500 italic">No custom files loaded. Drop TS tiles in the left and/or RA2 tiles in the right, then press Apply!</p>
            </div>
          ) : (
            <div className="space-y-1.5 text-[11px]">
              {detectedTiles.map((tile, index) => {
                const hasBoth = tile.tsFile && tile.ra2File;
                return (
                  <div 
                    key={index} 
                    className={cn(
                      "flex items-center justify-between p-1.5 border rounded-lg transition-colors",
                      hasBoth 
                        ? "bg-emerald-500/5 border-emerald-500/20" 
                        : "bg-sky-500/5 border-sky-500/15"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={cn("w-3.5 h-3.5", hasBoth ? "text-emerald-400" : "text-sky-400")} />
                      <span className={cn("font-bold uppercase text-[9px] tracking-wider font-mono", hasBoth ? "text-emerald-400" : "text-sky-300")}>
                        {tile.baseName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300 font-mono text-[10px]">
                      {tile.tsFile ? (
                        <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-emerald-300">
                          {tile.tsFile.name} (TS ➔ RA2)
                        </span>
                      ) : (
                        <span className="bg-slate-900/60 px-2 py-0.5 rounded border border-slate-900/80 text-slate-500 italic">
                          TS Stock Template
                        </span>
                      )}

                      <ArrowLeftRight className={cn("w-3 h-3 mx-1", hasBoth ? "text-emerald-500/60" : "text-sky-500/40")} />

                      {tile.ra2File ? (
                        <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-red-300">
                          {tile.ra2File.name} (RA2 ➔ TS)
                        </span>
                      ) : (
                        <span className="bg-slate-900/60 px-2 py-0.5 rounded border border-slate-900/80 text-slate-500 italic">
                          RA2 Stock Template
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Action Bottom Tray */}
        <footer className="p-4 bg-slate-950 border-t border-slate-800/80 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] font-semibold text-amber-400/90 max-w-[50%] truncate font-mono">
            {processedStatus || (allBaseNames.length > 0 ? "Ready to process & overwrite stock templates!" : "Load tiles above to configure hybrid converts.")}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-all"
            >
              Cancel
            </button>

            {/* ZIP Export Button */}
            <button
              type="button"
              disabled={allBaseNames.length === 0 || isProcessing}
              onClick={() => processAllFiles('zip')}
              className={cn(
                "px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all",
                allBaseNames.length > 0 && !isProcessing
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  : "opacity-40 cursor-not-allowed text-slate-500 bg-slate-900 border border-slate-800"
              )}
              title="Download all processed files in a single ZIP document"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ZIP</span>
            </button>

            {/* Primary Apply Button (OK) */}
            <button
              type="button"
              disabled={allBaseNames.length === 0 || isProcessing}
              onClick={() => processAllFiles('workspace')}
              className={cn(
                "px-5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md",
                allBaseNames.length > 0 && !isProcessing
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-emerald-500/10 cursor-pointer"
                  : "opacity-40 cursor-not-allowed text-slate-500 bg-slate-800"
              )}
              title="Convert loaded files, merge with template references, and write them directly into workspace"
            >
              <span>Apply to Workspace (OK)</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
