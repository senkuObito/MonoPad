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
    // Safari 12 height fix
    const setHeight = () => {
      if (containerRef.current) {
        containerRef.current.style.height = `${window.innerHeight}px`;
      }
    };
    window.addEventListener('resize', setHeight);
    setHeight();

    const randomizeBackground = () => {
      document.documentElement.style.setProperty('--grad-pos-1', `${Math.floor(Math.random() * 40)}% ${Math.floor(Math.random() * 40)}%`);
      document.documentElement.style.setProperty('--grad-pos-2', `${Math.floor(Math.random() * 40 + 60)}% ${Math.floor(Math.random() * 40 + 60)}%`);
      document.documentElement.style.setProperty('--grad-pos-3', `${Math.floor(Math.random() * 40 + 30)}% ${Math.floor(Math.random() * 40 + 30)}%`);
    };
    randomizeBackground();

    const saved = storageService.loadLocal();
    if (saved) {
      setContent(saved.content || '');
      setDrawingData(saved.drawing);
    }

    const savedTheme = (localStorage.getItem('monopad_theme') as Theme) || 'dark-glass';
    setTheme(savedTheme);
    setIsGlassMode(localStorage.getItem('monopad_glass') !== 'false');
    
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
      document.documentElement.requestFullscreen().catch(() => {
        showToast("Error enabling full screen");
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full main-card border border-[var(--border-color)] shadow-2xl z-[1000] animate-slow-fade pointer-events-none">
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em]">{toastMessage}</span>
        </div>
      )}

      {showAiLoginPrompt && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 md:p-6 bg-black/90 backdrop-blur-xl">
          <div className="main-card w-full max-w-sm rounded-[2rem] p-8 md:p-12 text-center relative overflow-hidden border-white/20">
            <button onClick={() => setShowAiLoginPrompt(false)} className="absolute top-6 right-6 opacity-40 hover:opacity-100"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg></button>
            <div className="mb-6 flex justify-center">
               <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                 <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={1.5}/></svg>
               </div>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mb-3">AI Integration</h2>
            <p className="text-[9px] uppercase tracking-[0.2em] opacity-40 leading-loose mb-8">Enable smart grammar & formalizing tools.</p>
            <button onClick={handleAiLogin} className="w-full py-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.4em] rounded-xl transition-all shadow-xl">Connect AI</button>
          </div>
        </div>
      )}

      <header className="px-3 md:px-10 py-3 md:py-8 flex items-center justify-between glass-header shrink-0 relative z-[100]">
        <div className="flex items-center gap-2 md:gap-10 overflow-hidden">
          <h1 className="logo-font text-[9px] sm:text-base md:text-xl text-white truncate shrink-0">
            <span className="logo-thin">MONO</span><span className="logo-bold">PAD</span>
          </h1>
          <div className="hidden sm:flex bg-white/5 rounded-full p-1 border border-[var(--border-color)]">
            <button onClick={() => setMode('text')} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${mode === 'text' ? 'bg-white/10 text-white' : 'opacity-30'}`}>Notes</button>
            <button onClick={() => setMode('draw')} className={`px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${mode === 'draw' ? 'bg-white/10 text-white' : 'opacity-30'}`}>Canvas</button>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-4 header-controls shrink-0">
          <div className="relative">
            <button onClick={() => { closeMenus(); setShowThemeMenu(!showThemeMenu); }} className="text-[8px] md:text-[10px] uppercase font-bold tracking-[0.1em] py-1.5 md:py-2.5 px-2 md:px-6 rounded-full border border-[var(--border-color)] hover:bg-white/5 transition-all flex items-center gap-1 md:gap-3">
              {themesList.find(t => t.id === theme)?.icon}
              <span className="max-w-[50px] md:max-w-[100px] truncate hidden md:inline">{themesList.find(t => t.id === theme)?.label}</span>
              <svg className={`w-2 h-2 md:w-3 md:h-3 transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 md:w-56 themed-dropdown rounded-xl overflow-hidden py-2 animate-fade z-[110]">
                {themesList.map(t => (
                  <button key={t.id} onClick={() => { 
                    setTheme(t.id); 
                    setAppFont(getThemeDefaultFont(t.id));
                    setShowThemeMenu(false); 
                  }} className={`w-full text-left px-4 md:px-8 py-2.5 md:py-3.5 text-[9px] md:text-[11px] font-bold uppercase tracking-widest transition-colors dropdown-item flex items-center gap-3 md:gap-4 ${theme === t.id ? 'bg-white/10 opacity-100' : 'opacity-40'}`}>
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={async () => {
              // @ts-ignore
              const hasKey = window.aistudio ? await window.aistudio.hasSelectedApiKey() : false;
              if (!hasKey) { setShowAiLoginPrompt(true); return; }
              closeMenus(); setShowAiMenu(!showAiMenu);
            }} className={`p-1.5 md:p-3.5 transition-all rounded-full hover:bg-white/5 ${isAiEnabled ? 'opacity-100 text-blue-400' : 'opacity-40'}`}>
              <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={1.5}/></svg>
            </button>
            {showAiMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 md:w-64 themed-dropdown rounded-2xl md:rounded-[2.5rem] overflow-hidden py-3 md:py-5 px-2 md:px-3 animate-fade z-[110] flex flex-col gap-1 border-blue-500/20 shadow-2xl">
                <div className="px-3 md:px-5 py-2 md:py-3 flex items-center justify-between border-b border-white/5 mb-2">
                  <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">AI Suite</span>
                  <button onClick={() => { setIsAiEnabled(!isAiEnabled); if(isAiEnabled) setAiMode('none'); }} className={`w-8 h-4 md:w-11 md:h-6 rounded-full transition-all relative ${isAiEnabled ? 'bg-blue-500/40' : 'bg-white/10'}`}>
                    <div className="toggle-knob absolute top-0.5 md:top-1 w-3 md:w-4 h-3 md:h-4 rounded-full bg-white shadow-lg" style={{ left: isAiEnabled ? (window.innerWidth < 768 ? '18px' : '24px') : '4px' }} />
                  </button>
                </div>
                {isAiEnabled && (
                  <>
                    <button onClick={() => setAiMode(aiMode === 'grammar' ? 'none' : 'grammar')} className={`w-full text-left px-3 md:px-5 py-2 md:py-4 text-[8px] md:text-[11px] font-bold uppercase tracking-widest rounded-lg md:rounded-2xl transition-all ${aiMode === 'grammar' ? 'bg-blue-500/20 text-blue-300' : 'opacity-40 hover:opacity-100'}`}>Correct Grammar</button>
                    <button onClick={() => setAiMode(aiMode === 'email' ? 'none' : 'email')} className={`w-full text-left px-3 md:px-5 py-2 md:py-4 text-[8px] md:text-[11px] font-bold uppercase tracking-widest rounded-lg md:rounded-2xl transition-all ${aiMode === 'email' ? 'bg-blue-500/20 text-blue-300' : 'opacity-40 hover:opacity-100'}`}>Formal Email</button>
                    <button onClick={() => setAiMode(aiMode === 'message' ? 'none' : 'message')} className={`w-full text-left px-3 md:px-5 py-2 md:py-4 text-[8px] md:text-[11px] font-bold uppercase tracking-widest rounded-lg md:rounded-2xl transition-all ${aiMode === 'message' ? 'bg-blue-500/20 text-blue-300' : 'opacity-40 hover:opacity-100'}`}>Formal Message</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => { closeMenus(); setShowSettingsMenu(!showSettingsMenu); }} className={`p-1.5 md:p-3.5 transition-all rounded-full hover:bg-white/5 ${showSettingsMenu ? 'opacity-100' : 'opacity-40'}`}>
              <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={1.5}/><circle cx="12" cy="12" r="3" strokeWidth={1.5}/></svg>
            </button>
            {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 md:w-64 themed-dropdown rounded-xl md:rounded-3xl overflow-hidden py-3 animate-fade z-[110] flex flex-col">
                <div className="px-4 md:px-6 py-1.5 border-b border-white/5 mb-1.5">
                   <p className="text-[7px] md:text-[9px] uppercase tracking-[0.2em] opacity-30 mb-1.5">Typography</p>
                   <div className="flex flex-col gap-0.5">
                      {fonts.map(f => (
                        <button key={f.value} onClick={() => { setAppFont(f.value); setShowSettingsMenu(false); }} className={`w-full text-left px-3 py-2 text-[8px] md:text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${appFont === f.value ? 'bg-white/10 opacity-100' : 'opacity-40 hover:bg-white/5'}`} style={{ fontFamily: f.value }}>{f.label}</button>
                      ))}
                   </div>
                </div>

                <div className="px-4 md:px-6 py-1.5 border-b border-white/5 mb-1.5 sm:hidden">
                   <p className="text-[7px] md:text-[9px] uppercase tracking-[0.2em] opacity-30 mb-1.5">Navigation</p>
                   <div className="flex gap-1.5">
                     <button onClick={() => { setMode('text'); setShowSettingsMenu(false); }} className={`flex-1 px-2 py-1.5 text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all ${mode === 'text' ? 'bg-white/10' : 'opacity-40'}`}>Notes</button>
                     <button onClick={() => { setMode('draw'); setShowSettingsMenu(false); }} className={`flex-1 px-2 py-1.5 text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all ${mode === 'draw' ? 'bg-white/10' : 'opacity-40'}`}>Canvas</button>
                   </div>
                </div>

                <button onClick={() => { toggleFullscreen(); setShowSettingsMenu(false); }} className="w-full text-left px-4 md:px-8 py-2 md:py-4 text-[9px] md:text-[11px] font-bold uppercase tracking-widest dropdown-item flex items-center justify-between">
                  <span>{isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}</span>
                  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" strokeWidth={1.5}/>
                  </svg>
                </button>

                <button onClick={() => {setShowSettingsMenu(false); fileInputRef.current?.click();}} className="w-full text-left px-4 md:px-8 py-2 md:py-4 text-[9px] md:text-[11px] font-bold uppercase tracking-widest dropdown-item flex items-center justify-between">
                  <span>Import</span>
                  <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={1.5}/></svg>
                </button>
                <div className="px-4 md:px-8 py-2 md:py-4 mt-1 border-t border-white/5">
                   <p className="text-[7px] md:text-[9px] uppercase tracking-[0.2em] opacity-30 mb-2">Export</p>
                   <div className="flex flex-wrap gap-1.5">
                     <button onClick={() => storageService.exportAsDocx(content)} className="px-2 py-1 bg-white/5 rounded-md text-[7px] md:text-[9px] font-bold uppercase hover:bg-white/10">DOCX</button>
                     <button onClick={() => storageService.exportAsFile(content)} className="px-2 py-1 bg-white/5 rounded-md text-[7px] md:text-[9px] font-bold uppercase hover:bg-white/10">TXT</button>
                   </div>
                </div>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={async (e) => { const file = e.target.files?.[0]; if (file) { try { const res = await storageService.importFile(file); setContent(res.content); if(res.drawing) setDrawingData(res.drawing); setStatus(SaveStatus.SAVED); } catch (err) { alert(err); } } }} accept=".docx,.txt,.md,.json" className="hidden" />
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative z-10" onClick={closeMenus}>
        {mode === 'text' ? (
          <div className="w-full h-full relative">
            <textarea 
              ref={textareaRef} 
              value={content} 
              onChange={(e) => { setContent(e.target.value); setStatus(SaveStatus.UNSAVED); }} 
              placeholder="Write with purpose..." 
              className="p-6 md:p-28 text-lg md:text-4xl font-normal focus:outline-none resize-none hide-scrollbar leading-[1.6] md:leading-[1.7] tracking-normal" 
              spellCheck={false}
            />
            
            {aiSuggestion && isAiEnabled && (
              <div className="absolute bottom-16 md:bottom-24 left-1/2 -translate-x-1/2 w-[94%] max-w-2xl z-50 suggestion-card">
                <div className="main-card rounded-2xl md:rounded-[3rem] p-5 md:p-12 border border-blue-500/40 shadow-2xl bg-black/95 backdrop-blur-3xl">
                  <div className="flex items-center justify-between mb-4 md:mb-8">
                    <div className="flex items-center gap-2 md:gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">AI ENHANCEMENT</span>
                    </div>
                    <button onClick={() => setAiSuggestion(null)} className="opacity-30 hover:opacity-100 transition-all">
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
                    </button>
                  </div>
                  <div className="text-sm md:text-2xl font-light leading-relaxed mb-6 md:mb-10 opacity-90 max-h-40 md:max-h-56 overflow-y-auto hide-scrollbar whitespace-pre-wrap border-l-2 border-blue-500/20 pl-4 md:pl-8">
                    {aiSuggestion}
                  </div>
                  <div className="flex gap-2 md:gap-5">
                    <button onClick={() => { setContent(aiSuggestion); setAiSuggestion(null); setStatus(SaveStatus.UNSAVED); showToast("Refined"); }} className="flex-1 py-3 bg-white text-black text-[9px] md:text-[11px] font-bold uppercase tracking-[0.3em] rounded-xl hover:bg-blue-50 transition-all shadow-xl">Apply</button>
                    <button onClick={() => { navigator.clipboard.writeText(aiSuggestion); showToast("Copied"); }} className="px-5 py-3 bg-white/5 border border-white/10 text-[9px] md:text-[11px] font-bold uppercase tracking-[0.3em] rounded-xl hover:bg-white/10 transition-all">Copy</button>
                  </div>
                </div>
              </div>
            )}

            {isAiProcessing && (
              <div className="absolute bottom-4 right-4 md:bottom-12 md:right-12 flex items-center gap-2 opacity-40">
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-white animate-bounce"></div>
                  <div className="w-1 h-1 rounded-full bg-white animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1 h-1 rounded-full bg-white animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span className="text-[7px] md:text-[9px] font-bold uppercase tracking-[0.3em]">AI Thinking</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full relative">
            <canvas 
              ref={canvasRef} 
              onMouseDown={startDrawing} 
              onMouseMove={draw} 
              onMouseUp={stopDrawing} 
              onMouseLeave={stopDrawing} 
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-full block"
            />
            <button onClick={() => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); setDrawingData(undefined); saveData(content, undefined); }} className="absolute bottom-4 right-4 md:bottom-12 md:right-12 px-6 py-2.5 bg-white/5 rounded-full border border-[var(--border-color)] hover:bg-white/10 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-white">Reset Canvas</button>
          </div>
        )}
      </main>

      <footer className="px-3 md:px-12 py-3 md:py-8 flex items-center justify-between shrink-0 relative z-10 border-t border-white/5">
        <div className="flex gap-3 md:gap-12 text-[8px] md:text-[10px] font-bold tracking-[0.1em] md:tracking-[0.3em] opacity-40 uppercase">
          <span>{content.trim() ? content.split(/\s+/).length : 0} Words</span>
          <span className={status === SaveStatus.SAVING ? 'animate-pulse' : ''}>{status}</span>
        </div>
        <div className="text-[7px] md:text-[9px] font-bold tracking-[0.3em] md:tracking-[0.5em] opacity-10 uppercase">
           {isAiEnabled ? `AI Active: ${aiMode}` : 'Secure Vault'}
        </div>
      </footer>
    </div>
  );
};

export default App;