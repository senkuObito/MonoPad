import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { storageService } from './services/storageService';
import { SaveStatus, Theme, AppMode } from './types';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';

const App: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [drawingData, setDrawingData] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<SaveStatus>(SaveStatus.SAVED);
  const [theme, setTheme] = useState<Theme>('dark-glass');
  const [isGlassMode, setIsGlassMode] = useState<boolean>(true);
  const [mode, setMode] = useState<AppMode>('text');
  const [appFont, setAppFont] = useState<string>("'JetBrains Mono', monospace");
  
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    let requestID: number;
    const scan = () => {
      if (isScanning && videoRef.current && scanCanvasRef.current) {
        const video = videoRef.current;
        const canvas = scanCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (code) {
            setIsScanning(false);
            const data = storageService.parseWirelessLink(`#share=${code.data}`);
            if (data) {
              setContent(data.content);
              setDrawingData(data.drawing);
              saveData(data.content, data.drawing);
              setShowSyncModal(false);
              showToast("Wireless Sync Complete");
            }
          }
        }
      }
      requestID = requestAnimationFrame(scan);
    };
    if (isScanning) requestID = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(requestID);
  }, [isScanning]);

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
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    setStatus(SaveStatus.UNSAVED);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setDrawingData(canvasRef.current?.toDataURL('image/png', 1.0));
      saveData(content, canvasRef.current?.toDataURL());
    }
  };

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      showToast("Camera permission required");
    }
  };

  const stopScanner = () => {
    setIsScanning(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  const isGlassTheme = theme === 'dark-glass' || theme === 'twilight-vibe';
  const wirelessPayload = storageService.generateWirelessLink(content, drawingData).split('#share=')[1];

  return (
    <div 
      ref={containerRef}
      className="main-card flex flex-col animate-fade relative"
      style={{ fontFamily: appFont }}
    >
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 px-8 py-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 z-[2000] shadow-2xl animate-bounce">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{toastMessage}</span>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sync-modal-bg animate-fade">
          <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-[3rem] p-10 flex flex-col items-center relative shadow-2xl overflow-hidden">
            <button onClick={() => { setShowSyncModal(false); stopScanner(); }} className="absolute top-8 right-8 p-2 opacity-40 hover:opacity-100 transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
            </button>
            <h2 className="text-sm font-black uppercase tracking-[0.5em] mb-12">Wireless Sync</h2>
            
            <div className="w-full grid grid-cols-2 gap-4 mb-10">
              <button onClick={() => { setIsScanning(false); stopScanner(); }} className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${!isScanning ? 'bg-white/10' : 'opacity-30'}`}>Display QR</button>
              <button onClick={startScanner} className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${isScanning ? 'bg-white/10' : 'opacity-30'}`}>Scan Code</button>
            </div>

            {!isScanning ? (
              <div className="bg-white p-6 rounded-3xl shadow-inner mb-8 animate-fade">
                <QRCodeSVG value={wirelessPayload || ""} size={240} level="L" />
              </div>
            ) : (
              <div className="w-full aspect-square bg-black rounded-3xl overflow-hidden relative mb-8 border border-white/10">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={scanCanvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-white/20 animate-pulse pointer-events-none" />
              </div>
            )}
            <p className="text-[9px] uppercase tracking-widest opacity-40 text-center leading-loose">
              {!isScanning ? "Point another device's camera here to instantly transfer data." : "Point your camera at a MonoPad QR code to sync."}
            </p>
          </div>
        </div>
      )}

      {/* Header with forced high z-index and explicit overflow-visible */}
      <header className="px-8 md:px-14 py-6 md:py-10 flex items-center justify-between shrink-0 relative z-[500]">
        <div className="flex items-center gap-6 md:gap-16">
          <h1 className="logo-font text-[12px] md:text-2xl">MONO<span className="logo-bold">PAD</span></h1>
          <div className="flex bg-white/5 rounded-full p-1 border border-white/5 shadow-inner">
            <button onClick={() => setMode('text')} className={`px-5 md:px-8 py-2 rounded-full text-[10px] md:text-[12px] font-bold uppercase tracking-widest transition-all ${mode === 'text' ? 'bg-white/10 opacity-100' : 'opacity-20'}`}>Notes</button>
            <button onClick={() => setMode('draw')} className={`px-5 md:px-8 py-2 rounded-full text-[10px] md:text-[12px] font-bold uppercase tracking-widest transition-all ${mode === 'draw' ? 'bg-white/10 opacity-100' : 'opacity-20'}`}>Canvas</button>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6 shrink-0">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowThemeMenu(!showThemeMenu); setShowSettingsMenu(false); }} className="text-[10px] md:text-[12px] uppercase font-bold tracking-widest py-2.5 px-6 rounded-full border border-white/10 hover:bg-white/5 transition-all flex items-center gap-2">
              <span className="hidden md:inline">{theme.replace('-', ' ')}</span>
              <svg className={`w-3 h-3 transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-4 w-60 themed-dropdown rounded-[2rem] overflow-hidden py-3 z-[600] shadow-2xl animate-fade">
                {['dark-glass', 'maroon-beige', 'olive-beige', 'twilight-vibe'].map(t => (
                  <button key={t} onClick={() => { setTheme(t as Theme); setAppFont(getThemeDefaultFont(t as Theme)); setShowThemeMenu(false); }} className={`w-full text-left px-8 py-4 text-[11px] font-bold uppercase tracking-widest transition-colors ${theme === t ? 'bg-white/10' : 'opacity-40 hover:bg-white/5'}`}>{t.replace('-', ' ')}</button>
                ))}
              </div>
            )}
          </div>

          <button onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); setShowThemeMenu(false); }} className={`p-3 transition-all rounded-full hover:bg-white/5 ${showSettingsMenu ? 'opacity-100' : 'opacity-40'}`}>
            <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeWidth={1.5}/></svg>
          </button>
          
          {showSettingsMenu && (
            <div className="absolute right-8 md:right-14 top-28 w-80 themed-dropdown rounded-[3rem] overflow-hidden py-8 z-[600] animate-fade shadow-2xl">
              <div className="px-10 pb-6 border-b border-white/5">
                 <p className="text-[10px] uppercase tracking-widest opacity-30 mb-5">Typography</p>
                 <div className="flex flex-col gap-1">
                   {fonts.map(f => (
                     <button key={f.value} onClick={() => { setAppFont(f.value); setShowSettingsMenu(false); }} className={`w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest rounded-2xl transition-all ${appFont === f.value ? 'bg-white/10 opacity-100' : 'opacity-40 hover:opacity-100 hover:bg-white/5'}`} style={{ fontFamily: f.value }}>{f.label}</button>
                   ))}
                 </div>
              </div>
              
              {isGlassTheme && (
                <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-widest">Glass Fidelity</span>
                  <button onClick={() => setIsGlassMode(!isGlassMode)} className={`w-16 h-8 rounded-full transition-all relative border border-white/10 ${isGlassMode ? 'bg-white/20' : 'bg-black/40'}`}>
                    <div className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-xl" style={{ left: isGlassMode ? '34px' : '6px' }} />
                  </button>
                </div>
              )}

              <div className="px-10 pt-6">
                 <p className="text-[10px] uppercase tracking-widest opacity-30 mb-5">Sync & Cloud</p>
                 <div className="flex flex-col gap-3">
                   <button onClick={() => { setShowSyncModal(true); setShowSettingsMenu(false); }} className="w-full py-4 bg-white/10 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-3">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9.5 9.5 0 0113.434 0m-17.678-4.243a15.5 15.5 0 0121.92 0" strokeWidth={2}/></svg>
                     Wireless Sync
                   </button>
                   <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => storageService.exportAsJson(content, drawingData)} className="py-4 bg-white/5 rounded-2xl text-[11px] font-bold uppercase hover:bg-white/10 transition-all">Export</button>
                     <button onClick={() => fileInputRef.current?.click()} className="py-4 bg-white/5 rounded-2xl text-[11px] font-bold uppercase hover:bg-white/10 transition-all">Import</button>
                   </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Input is moved out of header container to avoid z-index/click issues */}
      <input type="file" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file) try {
          const imported = await storageService.importFile(file);
          setContent(imported.content); setDrawingData(imported.drawing); saveData(imported.content, imported.drawing); showToast("Import Successful");
        } catch(err: any) { showToast(err.message); }
      }} className="hidden" accept=".json" />

      {/* Main and footer clip within the card but are below dropdowns */}
      <main className="flex-1 overflow-hidden relative z-[1]" onClick={() => {setShowSettingsMenu(false); setShowThemeMenu(false);}}>
        {mode === 'text' ? (
          <textarea 
            ref={textareaRef} 
            value={content} 
            onChange={(e) => { setContent(e.target.value); setStatus(SaveStatus.UNSAVED); }} 
            placeholder="Focus is clarity..." 
            className="w-full h-full p-10 md:p-32 text-2xl md:text-6xl font-light focus:outline-none resize-none hide-scrollbar leading-tight md:leading-[1.1] tracking-tight" 
            spellCheck={false}
          />
        ) : (
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-full block cursor-crosshair" />
            <button onClick={() => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); setDrawingData(undefined); saveData(content, undefined); }} className="absolute bottom-12 right-12 px-10 py-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-[11px] font-bold uppercase tracking-[0.4em] hover:bg-white/20 transition-all shadow-2xl">Clear Canvas</button>
          </div>
        )}
      </main>

      <footer className="px-10 md:px-14 py-8 md:py-10 flex items-center justify-between border-t border-white/5 shrink-0 z-[1]">
        <div className="flex gap-10 text-[11px] md:text-[14px] font-bold tracking-[0.3em] opacity-30 uppercase">
          <span>{content.trim() ? content.split(/\s+/).length : 0} Words</span>
          <span className={status === SaveStatus.SAVING ? 'animate-pulse' : ''}>{status}</span>
        </div>
        <div className="text-[11px] md:text-[14px] font-bold tracking-[0.8em] opacity-10 uppercase">MonoPad High Fidelity</div>
      </footer>
    </div>
  );
};

export default App;