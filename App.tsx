import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { storageService } from './services/storageService';
import { getAiSuggestion, AiMode } from './services/geminiService';
import { SaveStatus, Theme, AppMode } from './types';

const App: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [drawingData, setDrawingData] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SaveStatus>(SaveStatus.SAVED);
  const [theme, setTheme] = useState<Theme>('dark-glass');
  const [isGlassMode, setIsGlassMode] = useState<boolean>(true);
  const [mode, setMode] = useState<AppMode>('text');
  const [appFont, setAppFont] = useState<string>("'JetBrains Mono', monospace");
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // AI State
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('none');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // UI State
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [showAiLoginPrompt, setShowAiLoginPrompt] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fonts = [
    { label: 'Versace Luxury', value: "'Bodoni Moda', serif" },
    { label: 'Classic Serif', value: "'Playfair Display', serif" },
    { label: 'Modern Sans', value: "'Inter', sans-serif" },
    { label: 'Technical Mono', value: "'JetBrains Mono', monospace" }
  ];

  const getThemeDefaultFont = (themeId: Theme): string => {
    switch (themeId) {
      case 'dark-glass':
      case 'twilight-vibe':
        return "'JetBrains Mono', monospace";
      case 'maroon-beige':
      case 'olive-beige':
        return "'Bodoni Moda', serif";
      default:
        return "'Inter', sans-serif";
    }
  };

  useEffect(() => {
    // Robust height sync for mobile browsers (Safari/iPhone 6)
    const setHeight = () => {
      if (containerRef.current) {
        const vh = window.innerHeight;
        containerRef.current.style.height = window.innerWidth <= 768 ? `${vh}px` : `94vh`;
      }
    };
    window.addEventListener('resize', setHeight);
    setHeight();

    const saved = storageService.loadLocal();
    if (saved) {
      setContent(saved.content || '');
      setDrawingData(saved.drawing);
    }

    const savedTheme = (localStorage.getItem('monopad_theme') as Theme) || 'dark-glass';
    setTheme(savedTheme);
    const glassPref = localStorage.getItem('monopad_glass');
    setIsGlassMode(glassPref !== 'false');
    
    const savedFont = localStorage.getItem('monopad_font');
    if (savedFont) {
      setAppFont(savedFont);
    } else {
      setAppFont(getThemeDefaultFont(savedTheme));
    }

    const fsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fsChange);
    return () => {
      window.removeEventListener('resize', setHeight);
      document.removeEventListener('fullscreenchange', fsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const el = document.documentElement as any;
      const requestMethod = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (requestMethod) requestMethod.call(el).catch(() => showToast("Error enabling full screen"));
    } else {
      const el = document as any;
      const exitMethod = el.exitFullscreen || el.webkitExitFullscreen || el.mozCancelFullScreen || el.msExitFullscreen;
      if (exitMethod) exitMethod.call(el);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(null);
    setTimeout(() => setToastMessage(msg), 10);
    setTimeout(() => setToastMessage(null), 3100);
  };

  useEffect(() => {
    document.body.className = `theme-${theme} ${isGlassMode ? 'glass-enabled' : 'glass-disabled'}`;
    localStorage.setItem('monopad_theme', theme);
    localStorage.setItem('monopad_glass', isGlassMode.toString());
    localStorage.setItem('monopad_font', appFont);
    
    if (canvasRef.current) {
      updateCanvasSettings();
    }
  }, [theme, isGlassMode, appFont]);

  useLayoutEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        updateCanvasSettings();
        
        if (drawingData) {
          const img = new Image();
          img.onload = () => {
            canvas.getContext('2d')?.drawImage(img, 0, 0);
          };
          img.src = drawingData;
        }
      }
    }
  }, [mode, isFullscreen]);

  const updateCanvasSettings = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const textColor = getComputedStyle(document.body).getPropertyValue('--text-primary').trim();
    ctx.strokeStyle = textColor || '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    if (!isAiEnabled || aiMode === 'none' || !content.trim()) {
      setAiSuggestion(null);
      return;
    }

    const timer = setTimeout(async () => {
      // @ts-ignore
      const hasKey = window.aistudio ? await window.aistudio.hasSelectedApiKey() : false;
      if (!hasKey) return;

      setIsAiProcessing(true);
      const suggestion = await getAiSuggestion(content, aiMode);
      setAiSuggestion(suggestion);
      setIsAiProcessing(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [content, aiMode, isAiEnabled]);

  const handleAiLogin = async () => {
    // @ts-ignore
    if (window.aistudio) await window.aistudio.openSelectKey();
    setShowAiLoginPrompt(false);
    showToast("Login Success");
  };

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    };
  };

  const saveData = (c: string, d?: string) => {
    setStatus(SaveStatus.SAVING);
    storageService.saveLocal(c, d);
    setTimeout(() => setStatus(SaveStatus.SAVED), 500);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === SaveStatus.UNSAVED) saveData(content, drawingData);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [content, drawingData, status]);

  const themesList: {id: Theme, label: string, icon: React.ReactNode}[] = [
    { id: 'dark-glass', label: 'Deep Space', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" strokeWidth={1.5}/></svg> },
    { id: 'maroon-beige', label: 'Maroon Night', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 8V4m0 4l-4-4m4 4l4-4" strokeWidth={1.5}/></svg> },
    { id: 'olive-beige', label: 'Forest Moss', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" strokeWidth={1.5}/></svg> },
    { id: 'twilight-vibe', label: 'Twilight Vibe', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" strokeWidth={1.5}/></svg> }
  ];

  const closeMenus = () => {
    setShowThemeMenu(false);
    setShowAiMenu(false);
    setShowSettingsMenu(false);
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    updateCanvasSettings();
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setStatus(SaveStatus.UNSAVED);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const dataUrl = canvasRef.current?.toDataURL();
      setDrawingData(dataUrl);
      saveData(content, dataUrl);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full max-w-5xl h-full main-card md:rounded-[2.5rem] flex flex-col overflow-hidden animate-fade relative z-10`}
      style={{ fontFamily: appFont }}
    >
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full themed-dropdown border border-[var(--border-color)] shadow-2xl z-[1000] animate-slow-fade pointer-events-none">
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">{toastMessage}</span>
        </div>
      )}

      {showAiLoginPrompt && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="themed-dropdown w-full max-w-sm rounded-[2rem] p-8 text-center border-white/20">
            <h2 className="text-lg font-bold tracking-tight mb-3">AI Access Required</h2>
            <p className="text-[9px] uppercase tracking-[0.2em] opacity-40 mb-8">Login to enable smart grammar & rephrasing.</p>
            <button onClick={handleAiLogin} className="w-full py-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.4em] rounded-xl hover:bg-gray-100 transition-all">Connect</button>
            <button onClick={() => setShowAiLoginPrompt(false)} className="mt-4 text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100">Dismiss</button>
          </div>
        </div>
      )}

      <header className="px-3 md:px-10 py-3 md:py-6 flex items-center justify-between glass-header shrink-0 relative z-[100]">
        <div className="flex items-center gap-2 md:gap-10">
          <h1 className="logo-font text-[10px] sm:text-base md:text-xl text-white truncate shrink-0">
            MONO<span className="logo-bold">PAD</span>
          </h1>
          <div className="hidden sm:flex bg-white/5 rounded-full p-1 border border-[var(--border-color)]">
            <button onClick={() => setMode('text')} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${mode === 'text' ? 'bg-white/10 text-white' : 'opacity-30'}`}>Notes</button>
            <button onClick={() => setMode('draw')} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${mode === 'draw' ? 'bg-white/10 text-white' : 'opacity-30'}`}>Canvas</button>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-4 header-controls shrink-0">
          <div className="relative">
            <button onClick={() => { closeMenus(); setShowThemeMenu(!showThemeMenu); }} className="text-[8px] md:text-[10px] uppercase font-bold tracking-[0.1em] py-1.5 md:py-2.5 px-2 md:px-6 rounded-full border border-[var(--border-color)] hover:bg-white/5 transition-all flex items-center gap-1">
              <span className="max-w-[50px] md:max-w-[100px] truncate">{themesList.find(t => t.id === theme)?.label}</span>
              <svg className={`w-2 h-2 transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 md:w-56 themed-dropdown rounded-xl overflow-hidden py-2 animate-fade z-[110]">
                {themesList.map(t => (
                  <button key={t.id} onClick={() => { 
                    setTheme(t.id); 
                    setAppFont(getThemeDefaultFont(t.id));
                    setShowThemeMenu(false); 
                  }} className={`w-full text-left px-4 py-2.5 text-[9px] md:text-[11px] font-bold uppercase tracking-widest transition-colors dropdown-item flex items-center gap-3 ${theme === t.id ? 'bg-white/10' : 'opacity-40'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => { closeMenus(); setShowSettingsMenu(!showSettingsMenu); }} className={`p-1.5 md:p-3 transition-all rounded-full hover:bg-white/5 ${showSettingsMenu ? 'opacity-100' : 'opacity-40'}`}>
              <svg className="w-4 h-4 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={1.5}/></svg>
            </button>
            {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 md:w-64 themed-dropdown rounded-2xl overflow-hidden py-3 animate-fade z-[110] flex flex-col">
                <div className="px-5 py-2 border-b border-white/5 mb-2">
                   <p className="text-[7px] uppercase tracking-widest opacity-30 mb-2">Typography</p>
                   {fonts.map(f => (
                     <button key={f.value} onClick={() => { setAppFont(f.value); setShowSettingsMenu(false); }} className={`w-full text-left px-3 py-2 text-[9px] font-bold uppercase tracking-widest rounded hover:bg-white/10 ${appFont === f.value ? 'opacity-100 bg-white/5' : 'opacity-40'}`} style={{ fontFamily: f.value }}>{f.label}</button>
                   ))}
                </div>
                
                <div className="px-5 py-3 border-b border-white/5 mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Glass Effect</span>
                  <button onClick={() => setIsGlassMode(!isGlassMode)} className={`w-10 h-5 rounded-full transition-all relative ${isGlassMode ? 'bg-white/30' : 'bg-white/5'}`}>
                    <div className="absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow" style={{ left: isGlassMode ? '24px' : '4px' }} />
                  </button>
                </div>

                <button onClick={() => { toggleFullscreen(); setShowSettingsMenu(false); }} className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5">Toggle Fullscreen</button>
                
                <div className="px-5 py-2 border-t border-white/5 mt-2">
                   <p className="text-[7px] uppercase tracking-widest opacity-30 mb-2">Export</p>
                   <div className="flex gap-2">
                     <button onClick={() => storageService.exportAsDocx(content)} className="px-3 py-1.5 bg-white/5 rounded text-[8px] font-bold uppercase tracking-widest hover:bg-white/10">Docx</button>
                     <button onClick={() => storageService.exportAsFile(content)} className="px-3 py-1.5 bg-white/5 rounded text-[8px] font-bold uppercase tracking-widest hover:bg-white/10">Txt</button>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative" onClick={closeMenus}>
        {mode === 'text' ? (
          <textarea 
            ref={textareaRef} 
            value={content} 
            onChange={(e) => { setContent(e.target.value); setStatus(SaveStatus.UNSAVED); }} 
            placeholder="Capture your thoughts..." 
            className="w-full h-full p-6 md:p-24 text-lg md:text-3xl font-normal focus:outline-none resize-none hide-scrollbar leading-relaxed" 
            spellCheck={false}
          />
        ) : (
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-full block" />
            <button onClick={() => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); setDrawingData(undefined); saveData(content, undefined); }} className="absolute bottom-6 right-6 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-bold uppercase tracking-widest">Clear</button>
          </div>
        )}
      </main>

      <footer className="px-4 md:px-12 py-3 md:py-6 flex items-center justify-between border-t border-white/5">
        <div className="flex gap-4 text-[8px] md:text-[10px] font-bold tracking-widest opacity-40 uppercase">
          <span>{content.trim() ? content.split(/\s+/).length : 0} Words</span>
          <span>{status}</span>
        </div>
        <div className="text-[8px] md:text-[10px] font-bold tracking-widest opacity-10 uppercase">MonoPad v2.0</div>
      </footer>
    </div>
  );
};

export default App;