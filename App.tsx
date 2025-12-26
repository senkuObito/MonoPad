import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { storageService } from './services/storageService';
import { SaveStatus, Theme, AppMode } from './types';
import { QRCodeSVG } from 'qrcode.react';

const App: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [drawingData, setDrawingData] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SaveStatus>(SaveStatus.SAVED);
  const [theme, setTheme] = useState<Theme>('dark-glass');
  const [isGlassMode, setIsGlassMode] = useState<boolean>(true);
  const [mode, setMode] = useState<AppMode>('text');
  const [appFont, setAppFont] = useState<string>("'JetBrains Mono', monospace");
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [activeSyncPayload, setActiveSyncPayload] = useState<string>('');
  const [syncFileName, setSyncFileName] = useState<string>('Current Session');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncFileInputRef = useRef<HTMLInputElement>(null);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        showToast("Fullscreen restricted");
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const sharedData = storageService.parseWirelessLink(window.location.hash);
      if (sharedData) {
        if (confirm("Import shared note from wireless link? Current data will be replaced.")) {
          setContent(sharedData.content);
          setDrawingData(sharedData.drawing);
          saveData(sharedData.content, sharedData.drawing);
          showToast("Wireless Import Success");
        }
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const supportsGlass = theme === 'dark-glass' || theme === 'twilight-vibe';
      if (!isGlassMode || !supportsGlass) return;
      const x = e.beta ? (e.beta / 90) * 15 : 0;
      const y = e.gamma ? (e.gamma / 90) * 15 : 0;
      document.documentElement.style.setProperty('--parallax-x', `${50 + y}%`);
      document.documentElement.style.setProperty('--parallax-y', `${50 + x}%`);
      if (containerRef.current) containerRef.current.style.transform = `translate(${y * 0.4}px, ${x * 0.4}px)`;
    };
    const requestGyro = async () => {
      if (window.DeviceOrientationEvent && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try { await (DeviceOrientationEvent as any).requestPermission(); } catch (err) {}
      }
      window.addEventListener('deviceorientation', handleOrientation);
    };
    window.addEventListener('click', requestGyro, { once: true });
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isGlassMode, theme]);

  useEffect(() => {
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
    if (savedFont) setAppFont(savedFont);
    else setAppFont(getThemeDefaultFont(savedTheme));
  }, []);

  useEffect(() => {
    document.body.className = `theme-${theme} ${isGlassMode ? 'glass-enabled' : 'glass-disabled'}`;
    localStorage.setItem('monopad_theme', theme);
    localStorage.setItem('monopad_glass', isGlassMode.toString());
    localStorage.setItem('monopad_font', appFont);
  }, [theme, isGlassMode, appFont]);

  useLayoutEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text-primary');
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (drawingData) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
            img.src = drawingData;
          }
        }
      }
    }
  }, [mode, drawingData]);

  const saveData = (c: string, d?: string) => {
    setStatus(SaveStatus.SAVING);
    storageService.saveLocal(c, d);
    setTimeout(() => setStatus(SaveStatus.SAVED), 600);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === SaveStatus.UNSAVED) saveData(content, drawingData);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [content, drawingData, status]);

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setStatus(SaveStatus.UNSAVED);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const data = canvasRef.current?.toDataURL('image/png', 1.0);
      setDrawingData(data);
      saveData(content, data);
    }
  };

  const handleSyncFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imported = await storageService.importFile(file);
        const link = storageService.generateWirelessLink(imported.content, imported.drawing);
        setActiveSyncPayload(link);
        setSyncFileName(file.name);
        showToast("QR Generated for " + file.name);
      } catch (err: any) {
        showToast(err.message);
      }
    }
  };

  const isGlassTheme = theme === 'dark-glass' || theme === 'twilight-vibe';
  
  useEffect(() => {
    if (showSyncModal) {
      const link = storageService.generateWirelessLink(content, drawingData);
      setActiveSyncPayload(link);
      setSyncFileName('Current Note');
    }
  }, [showSyncModal]);

  return (
    <div 
      ref={containerRef}
      className="main-card animate-fade relative"
      style={{ fontFamily: appFont }}
    >
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 z-[2000] shadow-2xl animate-bounce">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{toastMessage}</span>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sync-modal-bg animate-fade">
          <div className="w-full max-w-lg sync-modal-content relative animate-scale">
            <button onClick={() => setShowSyncModal(false)} className="absolute top-6 right-6 p-2 opacity-40 hover:opacity-100 transition-all z-20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
            </button>
            
            <div className="sync-modal-inner">
              <h2 className="text-xs md:text-sm font-black uppercase tracking-[0.5em] mb-8 md:mb-12 text-center">Wireless Portal</h2>
              
              <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-2xl mb-6 md:mb-8 flex flex-col items-center">
                <QRCodeSVG value={activeSyncPayload} size={window.innerWidth < 768 ? 160 : 220} level="L" />
              </div>

              <div className="text-center mb-8 md:mb-10">
                 <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">{syncFileName}</p>
                 <p className="text-[8px] md:text-[9px] uppercase tracking-widest opacity-40">Scan to wirelessly transfer this note</p>
              </div>

              <div className="w-full border-t border-white/10 pt-6 md:pt-8 flex flex-col gap-3 md:gap-4">
                <p className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-40 text-center mb-1">Sync a different backup?</p>
                <button 
                  onClick={() => syncFileInputRef.current?.click()} 
                  className="w-full py-3 md:py-4 bg-white/10 rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-2 md:gap-3 border border-white/5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2}/></svg>
                  Upload JSON
                </button>
                <input type="file" ref={syncFileInputRef} onChange={handleSyncFileSelect} className="hidden" accept=".json" />
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="px-4 md:px-14 py-4 md:py-10 flex items-center justify-between shrink-0 relative z-[500] gap-2">
        <div className="flex items-center gap-2 md:gap-16">
          <h1 className="logo-font text-[8px] md:text-2xl whitespace-nowrap">MONO<span className="logo-bold">PAD</span></h1>
          <div className="flex bg-white/5 rounded-full p-0.5 md:p-1 border border-white/5 shadow-inner scale-90 md:scale-100 origin-left">
            <button onClick={() => setMode('text')} className={`px-2.5 md:px-8 py-1.5 md:py-2 rounded-full text-[7px] md:text-[12px] font-bold uppercase tracking-widest transition-all ${mode === 'text' ? 'bg-white/10 opacity-100' : 'opacity-20'}`}>Notes</button>
            <button onClick={() => setMode('draw')} className={`px-2.5 md:px-8 py-1.5 md:py-2 rounded-full text-[7px] md:text-[12px] font-bold uppercase tracking-widest transition-all ${mode === 'draw' ? 'bg-white/10 opacity-100' : 'opacity-20'}`}>Canvas</button>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-6 shrink-0">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowThemeMenu(!showThemeMenu); setShowSettingsMenu(false); }} className="text-[7px] md:text-[12px] uppercase font-bold tracking-widest py-1.5 md:py-2.5 px-2 md:px-6 rounded-full border border-white/10 hover:bg-white/5 transition-all flex items-center gap-1 md:gap-2">
              <span className="hidden md:inline">{theme.replace('-', ' ')}</span>
              <svg className={`w-2 h-2 md:w-3 md:h-3 transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-2 w-36 md:w-60 themed-dropdown rounded-[1rem] md:rounded-[2rem] overflow-hidden py-2 md:py-3 z-[600] shadow-2xl animate-fade">
                {['dark-glass', 'maroon-beige', 'olive-beige', 'twilight-vibe'].map(t => (
                  <button key={t} onClick={() => { setTheme(t as Theme); setAppFont(getThemeDefaultFont(t as Theme)); setShowThemeMenu(false); }} className={`w-full text-left px-4 md:px-8 py-2 md:py-4 text-[8px] md:text-[11px] font-bold uppercase tracking-widest transition-colors ${theme === t ? 'bg-white/10' : 'opacity-40 hover:bg-white/5'}`}>{t.replace('-', ' ')}</button>
                ))}
              </div>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); setShowThemeMenu(false); }} className={`p-1 md:p-3 transition-all rounded-full hover:bg-white/5 ${showSettingsMenu ? 'opacity-100' : 'opacity-40'}`}>
            <svg className="w-5 h-5 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeWidth={1.5}/></svg>
          </button>
          
          {showSettingsMenu && (
            <div className="absolute right-0 md:right-14 top-14 md:top-28 w-[calc(90vw-1rem)] md:w-80 themed-dropdown rounded-[1.5rem] md:rounded-[3rem] overflow-hidden py-4 md:py-8 z-[600] animate-fade shadow-2xl">
              <div className="px-5 md:px-10 pb-4 md:pb-6 border-b border-white/5">
                 <p className="text-[7px] md:text-[10px] uppercase tracking-widest opacity-30 mb-3 md:mb-5">Typography</p>
                 <div className="flex flex-col gap-0.5 md:gap-1">
                   {fonts.map(f => (
                     <button key={f.value} onClick={() => { setAppFont(f.value); setShowSettingsMenu(false); }} className={`w-full text-left px-3 md:px-4 py-1.5 md:py-3 text-[8px] md:text-[11px] font-bold uppercase tracking-widest rounded-lg md:rounded-2xl transition-all ${appFont === f.value ? 'bg-white/10 opacity-100' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`} style={{ fontFamily: f.value }}>{f.label}</button>
                   ))}
                 </div>
              </div>

              <div className="px-5 md:px-10 py-3 md:py-6 border-b border-white/5">
                 <div className="flex items-center justify-between mb-2 md:mb-4">
                    <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-widest">Fullscreen</span>
                    <button onClick={toggleFullscreen} className={`w-9 md:w-16 h-5 md:h-8 rounded-full transition-all relative border border-white/10 ${isFullscreen ? 'bg-white/20' : 'bg-black/40'}`}>
                      <div className="absolute top-0.5 md:top-1 w-4 md:w-6 h-4 md:h-6 rounded-full bg-white transition-all shadow-xl" style={{ left: isFullscreen ? (window.innerWidth < 768 ? '19px' : '34px') : '3px' }} />
                    </button>
                 </div>
                 {isGlassTheme && (
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] md:text-[11px] font-bold uppercase tracking-widest">Glass UI</span>
                    <button onClick={() => setIsGlassMode(!isGlassMode)} className={`w-9 md:w-16 h-5 md:h-8 rounded-full transition-all relative border border-white/10 ${isGlassMode ? 'bg-white/20' : 'bg-black/40'}`}>
                      <div className="absolute top-0.5 md:top-1 w-4 md:w-6 h-4 md:h-6 rounded-full bg-white transition-all shadow-xl" style={{ left: isGlassMode ? (window.innerWidth < 768 ? '19px' : '34px') : '3px' }} />
                    </button>
                  </div>
                 )}
              </div>

              <div className="px-5 md:px-10 pt-3 md:pt-6">
                 <p className="text-[7px] md:text-[10px] uppercase tracking-widest opacity-30 mb-3 md:mb-5">Sync & Cloud</p>
                 <div className="flex flex-col gap-2 md:gap-3">
                   <button onClick={() => { setShowSyncModal(true); setShowSettingsMenu(false); }} className="w-full py-2 md:py-4 bg-white/10 rounded-lg md:rounded-2xl text-[8px] md:text-[11px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-2 md:gap-3">
                     <svg className="w-3.5 h-3.5 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9.5 9.5 0 0113.434 0m-17.678-4.243a15.5 15.5 0 0121.92 0" strokeWidth={2}/></svg>
                     Wireless Sync
                   </button>
                   <div className="grid grid-cols-2 gap-2 md:gap-3">
                     <button onClick={() => storageService.exportAsJson(content, drawingData)} className="py-2 md:py-4 bg-white/5 rounded-lg md:rounded-2xl text-[7px] md:text-[11px] font-bold uppercase hover:bg-white/10 transition-all">Export</button>
                     <button onClick={() => fileInputRef.current?.click()} className="py-2 md:py-4 bg-white/5 rounded-lg md:rounded-2xl text-[7px] md:text-[11px] font-bold uppercase hover:bg-white/10 transition-all">Import</button>
                   </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <input type="file" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file) try {
          const imported = await storageService.importFile(file);
          setContent(imported.content); setDrawingData(imported.drawing); saveData(imported.content, imported.drawing); showToast("Import Successful");
        } catch(err: any) { showToast(err.message); }
      }} className="hidden" accept=".json" />

      <main className="flex-1 overflow-hidden relative z-[1]" onClick={() => {setShowSettingsMenu(false); setShowThemeMenu(false);}}>
        {mode === 'text' ? (
          <textarea 
            ref={textareaRef} 
            value={content} 
            onChange={(e) => { setContent(e.target.value); setStatus(SaveStatus.UNSAVED); }} 
            placeholder="Focus is clarity..." 
            className="w-full h-full p-6 md:p-32 text-base md:text-6xl font-light focus:outline-none resize-none hide-scrollbar leading-relaxed md:leading-[1.1] tracking-tight" 
            spellCheck={false}
          />
        ) : (
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-full block cursor-crosshair" />
            <button onClick={() => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); setDrawingData(undefined); saveData(content, undefined); }} className="absolute bottom-4 md:bottom-12 right-4 md:right-12 px-4 md:px-10 py-2 md:py-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-[7px] md:text-[11px] font-bold uppercase tracking-[0.1em] md:tracking-[0.4em] hover:bg-white/20 transition-all shadow-2xl">Clear</button>
          </div>
        )}
      </main>

      <footer className="px-4 md:px-14 py-4 md:py-10 flex items-center justify-between border-t border-white/5 shrink-0 z-[1]">
        <div className="flex gap-4 md:gap-10 text-[7px] md:text-[14px] font-bold tracking-[0.1em] md:tracking-[0.3em] opacity-30 uppercase">
          <span>{content.trim() ? content.split(/\s+/).length : 0} Words</span>
          <span className={status === SaveStatus.SAVING ? 'animate-pulse' : ''}>{status}</span>
        </div>
        <div className="text-[7px] md:text-[14px] font-bold tracking-[0.2em] md:tracking-[0.8em] opacity-10 uppercase">MonoPad AirSync</div>
      </footer>
    </div>
  );
};

export default App;