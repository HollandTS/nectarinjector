import React, { useState, useEffect, useRef } from 'react';
import { Bot, Sparkles, Check, RefreshCw, X, Send, ImageIcon, AlertCircle, Copy, Clipboard, Upload, Paperclip } from 'lucide-react';
import { generateDepthToImageOverlay } from '../../services/geminiService';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    imageUrl?: string;
    timestamp: Date;
}

interface DepthToImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    screenshotData: string | null;
    screenshotPosition: { x: number; y: number; width: number; height: number } | null;
    onPlaceLayer: (src: string, position: { x: number; y: number; width: number; height: number }) => void;
}

export const DepthToImageModal: React.FC<DepthToImageModalProps> = ({
    isOpen,
    onClose,
    screenshotData,
    screenshotPosition,
    onPlaceLayer
}) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [latestResult, setLatestResult] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    
    // Copy/paste states
    const [copySuccess, setCopySuccess] = useState(false);
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isDraggingRef, setIsDraggingRef] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const pasteFileInputRef = useRef<HTMLInputElement>(null);
    const refFileInputRef = useRef<HTMLInputElement>(null);

    // Reset state and set initial message when modal opens
    useEffect(() => {
        if (isOpen) {
            setLatestResult(null);
            setError(null);
            setPrompt('');
            setReferenceImage(null);
            setCopySuccess(false);
            setMessages([
                {
                    id: 'init',
                    role: 'assistant',
                    text: "Hello! I am your AI Depth-to-Image assistant. I have captured a screenshot of your selected tiles. What material, style, or details would you like to turn this layout into while preserving the exact layout structure? (e.g., 'turn the cliffs into rocky lava cliffs' or 'change the grass to a clean marble tiled floor')",
                    timestamp: new Date()
                }
            ]);
        }
    }, [isOpen]);

    // Scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    if (!isOpen) return null;

    const handleCopyOriginal = async () => {
        if (!screenshotData) return;
        try {
            const res = await fetch(screenshotData);
            const blob = await res.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.warn("Clipboard API image write failed. Falling back to text-copy of data URL.", err);
            try {
                await navigator.clipboard.writeText(screenshotData);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            } catch (e) {
                setError("Failed to copy image. Clipboard block detected in this browser sandbox.");
            }
        }
    };

    const handlePasteResult = async () => {
        try {
            const items = await navigator.clipboard.read();
            let pasted = false;
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (e.target?.result && typeof e.target.result === 'string') {
                            setLatestResult(e.target.result);
                            setMessages(prev => [
                                ...prev,
                                {
                                    id: `paste-${Date.now()}`,
                                    role: 'system',
                                    text: "Injected a custom design from clipboard as your active overlay target.",
                                    imageUrl: e.target.result as string,
                                    timestamp: new Date()
                                }
                            ]);
                        }
                    };
                    reader.readAsDataURL(blob);
                    pasted = true;
                    break;
                }
            }
            if (!pasted) {
                pasteFileInputRef.current?.click();
            }
        } catch (err) {
            console.warn("Direct clipboard read blocked. Opening file dialog fallback.", err);
            pasteFileInputRef.current?.click();
        }
    };

    const handlePasteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
                setLatestResult(event.target.result);
                setMessages(prev => [
                    ...prev,
                    {
                        id: `paste-file-${Date.now()}`,
                        role: 'system',
                        text: `Loaded custom design "${file.name}" as your active target.`,
                        imageUrl: event.target.result,
                        timestamp: new Date()
                    }
                ]);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        loadReferenceImage(file);
    };

    const loadReferenceImage = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError("Please select a valid image file as a style reference.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
                setReferenceImage(event.target.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDragOverRef = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingRef(true);
    };

    const handleDragLeaveRef = () => {
        setIsDraggingRef(false);
    };

    const handleDropRef = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingRef(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            loadReferenceImage(file);
        }
    };

    const handleSendPrompt = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!prompt.trim() || isLoading || !screenshotData) return;

        const currentPrompt = prompt.trim();
        const currentRefImage = referenceImage;
        setPrompt('');
        setReferenceImage(null); // Clear reference image ready for next prompt
        setError(null);
        setIsLoading(true);

        // Add user prompt to messages
        const userMsgId = `user-${Date.now()}`;
        setMessages(prev => [
            ...prev,
            {
                id: userMsgId,
                role: 'user',
                text: currentPrompt,
                imageUrl: currentRefImage || undefined,
                timestamp: new Date()
            }
        ]);

        try {
            // Call Gemini service with reference image
            const resultBase64 = await generateDepthToImageOverlay(currentPrompt, screenshotData, currentRefImage || undefined);
            
            setLatestResult(resultBase64);
            
            // Add AI response to messages
            setMessages(prev => [
                ...prev,
                {
                    id: `ai-${Date.now()}`,
                    role: 'assistant',
                    text: `Successfully re-imagined the layout according to: "${currentPrompt}"${currentRefImage ? " matching the reference style image" : ""}. All layout and perspective coordinates are preserved perfectly!`,
                    imageUrl: resultBase64,
                    timestamp: new Date()
                }
            ]);
        } catch (err: any) {
            console.error("AI Generation Error:", err);
            setError(err.message || "Failed to generate AI overlay. Please try again.");
            
            setMessages(prev => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: 'system',
                    text: `Error: ${err.message || "Failed to generate image. Please check API key/prompt configuration."}`,
                    timestamp: new Date()
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlace = () => {
        if (!latestResult || !screenshotPosition) return;
        onPlaceLayer(latestResult, screenshotPosition);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            {/* Hidden fallback/uploader helper inputs */}
            <input 
                type="file" 
                ref={pasteFileInputRef} 
                onChange={handlePasteFileChange} 
                accept="image/*" 
                className="hidden" 
            />
            <input 
                type="file" 
                ref={refFileInputRef} 
                onChange={handleRefFileChange} 
                accept="image/*" 
                className="hidden" 
            />

            <div className="bg-[#11141a] border border-slate-700/80 rounded-2xl shadow-3xl w-full max-w-5xl flex flex-col md:flex-row h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Left Side: Images Preview Section */}
                <div className="w-full md:w-1/2 bg-black/30 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-2">
                            <ImageIcon className="w-4 h-4 text-cyan-400" />
                            <h3 className="text-sm font-black uppercase text-slate-300 tracking-wider">Depth Preview Panels</h3>
                        </div>
                        {screenshotPosition && (
                            <span className="text-[10px] bg-cyan-950/40 text-cyan-400 px-2.5 py-1 rounded-full border border-cyan-800/40 font-mono font-medium">
                                Size: {screenshotPosition.width}×{screenshotPosition.height}px (X: {screenshotPosition.x}, Y: {screenshotPosition.y})
                            </span>
                        )}
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-4 h-full min-h-[250px] items-center">
                        {/* Original Screenshot */}
                        <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-xl p-3 justify-center items-center relative overflow-hidden group">
                            <div className="absolute top-2 left-2 z-10 flex items-center justify-between w-[calc(100%-16px)]">
                                <span className="text-[8px] bg-slate-950 text-slate-400 font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-slate-800/80">
                                    Original Layout
                                </span>
                                {screenshotData && (
                                    <button
                                        onClick={handleCopyOriginal}
                                        className={`flex items-center space-x-1 py-1 px-2.5 rounded text-[9px] font-bold uppercase transition-all duration-250 border select-none cursor-pointer ${
                                            copySuccess 
                                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60' 
                                                : 'bg-slate-950/80 text-slate-300 hover:text-white border-slate-800/80 hover:bg-slate-900'
                                        }`}
                                    >
                                        {copySuccess ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                        <span>{copySuccess ? "Copied Layout" : "Copy to Clipboard"}</span>
                                    </button>
                                )}
                            </div>
                            {screenshotData ? (
                                <img 
                                    src={screenshotData} 
                                    alt="Original captured layout" 
                                    className="max-h-[30vh] md:max-h-[45vh] object-contain transition-transform group-hover:scale-105"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="text-slate-500 text-xs text-center flex flex-col items-center space-y-2">
                                    <AlertCircle className="w-5 h-5 text-red-400" />
                                    <span>Failed to capture screenshot data.</span>
                                </div>
                            )}
                        </div>

                        {/* Generated Result */}
                        <div className="flex flex-col h-full bg-slate-900/40 border border-slate-800 rounded-xl p-3 justify-center items-center relative overflow-hidden group">
                            <div className="absolute top-2 left-2 z-10 flex items-center justify-between w-[calc(100%-16px)]">
                                <span className="text-[8px] bg-cyan-950 text-cyan-300 font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-cyan-800/50">
                                    AI Smart Layer Result
                                </span>
                                <button
                                    onClick={handlePasteResult}
                                    className="flex items-center space-x-1 py-1 px-2.5 rounded text-[9px] font-bold uppercase transition-all duration-250 border bg-cyan-950/80 text-cyan-400 hover:text-cyan-300 border-cyan-805/50 hover:bg-cyan-900 cursor-pointer"
                                    title="Paste an edited version of the layout from clipboard or select file fallback"
                                >
                                    <Clipboard className="w-2.5 h-2.5" />
                                    <span>Paste / Load Custom</span>
                                </button>
                            </div>
                            {latestResult ? (
                                <img 
                                    src={latestResult} 
                                    alt="Generated smart layer" 
                                    className="max-h-[30vh] md:max-h-[45vh] object-contain transition-transform group-hover:scale-105"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="text-slate-500 text-xs text-center px-4 max-w-xs flex flex-col items-center space-y-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-850 flex items-center justify-center border border-slate-800 text-slate-400">
                                        <Bot className="w-5 h-5" />
                                    </div>
                                    <span>State will update once you enter a prompt and generate a depth-infused overlay, or paste/load your own layout edit.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Placement Actions */}
                    <div className="mt-4 pt-4 border-t border-slate-800/80 flex justify-end space-x-3">
                        <button 
                            onClick={onClose} 
                            className="bg-slate-900 hover:bg-slate-850 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors border border-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePlace}
                            disabled={!latestResult}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-center flex items-center justify-center space-x-1.5 shadow-lg ${
                                latestResult 
                                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer hover:shadow-cyan-900/20 active:scale-95' 
                                    : 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed'
                            }`}
                        >
                            <Check className="w-4 h-4" />
                            <span>Place Layer</span>
                        </button>
                    </div>
                </div>

                {/* Right Side: Chatbox Interface */}
                <div 
                    className="w-full md:w-1/2 flex flex-col justify-between bg-[#151a22] relative"
                    onDragOver={handleDragOverRef}
                    onDragLeave={handleDragLeaveRef}
                    onDrop={handleDropRef}
                >
                    {/* Style reference drag & drop overlay */}
                    {isDraggingRef && (
                        <div className="absolute inset-0 z-50 bg-cyan-950/90 backdrop-blur-sm border-2 border-dashed border-cyan-500 flex flex-col justify-center items-center space-y-3 pointer-events-none animate-in fade-in duration-150">
                            <Upload className="w-10 h-10 text-cyan-400 animate-bounce" />
                            <span className="text-sm font-black text-white uppercase tracking-wider">Drop Reference Image Here</span>
                            <span className="text-xs text-slate-400">AI will adopt this reference image's color style and patterns</span>
                        </div>
                    )}

                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#11141a]/90">
                        <div className="flex items-center space-x-2">
                            <Bot className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-sm font-black text-white uppercase tracking-wider">Depth-To-Image Intelligence</h2>
                        </div>
                        <button onClick={onClose} className="p-1 px-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-white rounded-lg transition-colors cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages Panel */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
                        {messages.map((msg) => (
                            <div 
                                key={msg.id} 
                                className={`flex flex-col space-y-1.5 ${
                                    msg.role === 'user' ? 'items-end' : 'items-start'
                                }`}
                            >
                                <div className="flex items-center space-x-1.5 text-[9px] text-slate-500 uppercase tracking-widest px-1 font-bold">
                                    {msg.role === 'assistant' && (
                                        <Bot className="w-3 h-3 text-cyan-400" />
                                    )}
                                    <span>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'AI Companion'}</span>
                                </div>

                                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed border ${
                                    msg.role === 'user'
                                        ? 'bg-cyan-950/20 border-cyan-850 text-cyan-100 rounded-tr-none'
                                        : msg.role === 'system'
                                        ? 'bg-red-950/20 border-red-900/40 text-red-300'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-300 rounded-tl-none'
                                }`}>
                                    <div>{msg.text}</div>
                                    
                                    {/* Embedded prompt results or style references inside chat context */}
                                    {msg.imageUrl && (
                                        <div className="mt-3 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950 p-2 flex flex-col items-center">
                                            <span className="text-[7px] text-slate-500 font-mono tracking-widest uppercase block mb-1">
                                                {msg.role === 'user' ? "Style Reference Reference" : "Generated Output"}
                                            </span>
                                            <img 
                                                src={msg.imageUrl} 
                                                alt="Chat visual attachment" 
                                                className="max-h-[150px] object-contain rounded border border-slate-800"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Rendering loader inside chat history */}
                        {isLoading && (
                            <div className="flex flex-col items-start space-y-1.5 animate-pulse">
                                <div className="flex items-center space-x-1.5 text-[9px] text-cyan-400 uppercase tracking-widest px-1 font-bold">
                                    <Bot className="w-3 h-3 text-cyan-400 animate-spin" />
                                    <span>AI Companion is generating...</span>
                                </div>
                                <div className="bg-cyan-950/10 border border-cyan-900/30 text-cyan-400/80 rounded-2xl rounded-tl-none p-4 text-xs font-mono max-w-xs flex items-center space-x-2.5">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                    <span>Applying image-to-depth parameters...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input Area */}
                    <form onSubmit={handleSendPrompt} className="p-4 border-t border-slate-805 bg-[#11141a]/95 space-y-2.5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2 px-3 rounded-lg flex items-center space-x-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Thumbnail overlay for Loaded Style Reference Image */}
                        {referenceImage && (
                            <div className="flex items-center space-x-3 bg-cyan-950/30 border border-cyan-900/50 p-2 rounded-xl max-w-sm relative group animate-in slide-in-from-bottom-2 duration-200">
                                <img 
                                    src={referenceImage} 
                                    alt="Reference style context thumbnail" 
                                    className="w-10 h-10 object-cover rounded-lg border border-cyan-800" 
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider block">Style Reference Image</span>
                                    <span className="text-[8px] text-slate-500 block truncate font-mono">Will influence textures & palette</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => setReferenceImage(null)} 
                                    className="p-1 px-2 rounded bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-red-400 transition-colors cursor-pointer text-[10px]"
                                    title="Remove Reference Image"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center space-x-2 bg-black/40 border border-slate-700/50 rounded-xl px-2.5 py-1.5 focus-within:border-cyan-500/60 transition-all">
                            {/* Paperclip reference image uploader */}
                            <button
                                type="button"
                                onClick={() => refFileInputRef.current?.click()}
                                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Attach Style Reference Image (Drag and drop is also supported)"
                            >
                                <Paperclip className="w-3.5 h-3.5" />
                            </button>

                            <input 
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isLoading || !screenshotData}
                                placeholder={screenshotData ? "Type prompt... Drag reference image or click clip to attach style style reference." : "Select tiles first..."}
                                className="flex-grow bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-600 font-sans"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !prompt.trim() || !screenshotData}
                                className={`p-2 rounded-lg transition-all ${
                                    prompt.trim() && !isLoading && screenshotData
                                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer active:scale-95'
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                }`}
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
};
