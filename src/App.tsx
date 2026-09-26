import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClientApp } from './components/client/ClientApp';
import { TrainerApp } from './components/trainer/TrainerApp';
import { TechSpecView } from './components/spec/TechSpecView';
import { GitHubSyncModal } from './components/spec/GitHubSyncModal';
import { AccentColor } from './types';
import { 
  Smartphone, 
  Monitor, 
  FileCode, 
  RotateCcw, 
  UserCheck, 
  Maximize2, 
  Minimize2,
  FolderGit2
} from 'lucide-react';

const MainShell: React.FC = () => {
  const { 
    appName,
    setAppName,
    clients, 
    activeClientId, 
    setActiveClientId, 
    accentColor, 
    setAccentColor,
    resetAllData 
  } = useApp();

  const [activeView, setActiveView] = useState<'client' | 'trainer' | 'spec'>('client');
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(true);
  const [showGithubModal, setShowGithubModal] = useState<boolean>(false);
  const [showAppNameModal, setShowAppNameModal] = useState<boolean>(false);
  const [tempAppName, setTempAppName] = useState<string>(appName);

  const colors: { color: AccentColor; name: string }[] = [
    { color: '#CFFF5C', name: 'Lima Acento' },
    { color: '#FF6B4A', name: 'Coral Pasos' },
    { color: '#5CD6FF', name: 'Cian Peso' },
    { color: '#FFD34D', name: 'Oro Racha' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#101012] text-[#F5F4F0] antialiased">
      {/* Top Global Command Bar */}
      <header className="h-14 bg-[#16161A] border-b border-[#2A2A2F] px-4 flex items-center justify-between z-50 shrink-0 select-none">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center p-1.5 shadow-sm"
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#101012" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
              <path d="M4 17 L10 11 L14 15 L20 7" />
              <path d="M14 7 H20 V13" />
            </svg>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div>
              <span className="font-extrabold font-display text-sm tracking-wider text-[#F5F4F0] block leading-none">
                {appName}
              </span>
              <span className="text-[7.5px] tracking-widest text-[#8E8E94] font-bold uppercase leading-none">
                FULL-STACK PLATFORM
              </span>
            </div>
            <button
              onClick={() => {
                setTempAppName(appName);
                setShowAppNameModal(true);
              }}
              className="p-1 rounded-md text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#1B1B1F] transition-colors"
              title="Cambiar nombre de la aplicación"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Center View Switcher */}
        <div className="flex items-center p-1 rounded-full bg-[#1B1B1F] border border-[#2A2A2F]">
          <button
            onClick={() => setActiveView('client')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'client'
                ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>App Cliente (390×844)</span>
          </button>

          <button
            onClick={() => setActiveView('trainer')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'trainer'
                ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Panel Entrenador (1280px)</span>
          </button>

          <button
            onClick={() => setActiveView('spec')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeView === 'spec'
                ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Arquitectura & Docs</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* GitHub Action Button */}
          <button
            onClick={() => setShowGithubModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[var(--accent-color,#CFFF5C)] transition-all"
            title="Conectar y subir repositorio a GitHub"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
            <span className="hidden md:inline">GitHub</span>
          </button>

          {/* Active Client Selector */}
          <div className="flex items-center gap-1.5 bg-[#1B1B1F] border border-[#2A2A2F] rounded-full px-2.5 py-1 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
            <select
              value={activeClientId}
              onChange={e => setActiveClientId(e.target.value)}
              className="bg-transparent text-[#F5F4F0] font-semibold text-xs focus:outline-none cursor-pointer"
              title="Cambiar cliente activo para probar variaciones (ej: Lucía con ciclo)"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id} className="bg-[#1B1B1F] text-[#F5F4F0]">
                  {c.name} {c.sex === 'Mujer' ? '♀' : '♂'} ({c.objective})
                </option>
              ))}
            </select>
          </div>

          {/* Accent Color Picker */}
          <div className="flex items-center gap-1 bg-[#1B1B1F] border border-[#2A2A2F] rounded-full p-1">
            {colors.map(c => (
              <button
                key={c.color}
                onClick={() => setAccentColor(c.color)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  accentColor === c.color ? 'scale-125 ring-1 ring-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: c.color }}
                title={`Acento: ${c.name}`}
              />
            ))}
          </div>

          {/* Device Frame Toggle (in client view) */}
          {activeView === 'client' && (
            <button
              onClick={() => setDeviceFrameMode(!deviceFrameMode)}
              className="p-1.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0] transition-colors"
              title={deviceFrameMode ? 'Ver en pantalla completa' : 'Ver en marco de móvil (390×844)'}
            >
              {deviceFrameMode ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Reset Mock Data */}
          <button
            onClick={() => {
              if (window.confirm('¿Deseas reiniciar los datos de ejemplo a su estado original?')) {
                resetAllData();
              }
            }}
            className="p-1.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0] transition-colors"
            title="Restablecer datos originales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col items-center justify-start min-h-0 bg-[#0C0C0E]">
        {activeView === 'client' && (
          <div className={`w-full flex-1 flex flex-col items-center justify-center p-0 md:p-6 ${deviceFrameMode ? 'overflow-y-auto' : ''}`}>
            {deviceFrameMode ? (
              /* Simulated iPhone 390px × 844px Frame */
              <div className="relative w-[390px] h-[844px] bg-[#101012] border-[10px] border-[#232328] rounded-[48px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col shrink-0">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-0 inset-x-0 h-6 flex justify-center items-center z-50 pointer-events-none">
                  <div className="w-24 h-4 bg-black rounded-full" />
                </div>
                {/* Screen Content */}
                <div className="flex-1 pt-4 overflow-hidden flex flex-col">
                  <ClientApp />
                </div>
              </div>
            ) : (
              /* Full Responsive Width */
              <div className="w-full max-w-[440px] flex-1 bg-[#101012] border-x border-[#2A2A2F] min-h-[844px] flex flex-col">
                <ClientApp />
              </div>
            )}
          </div>
        )}

        {activeView === 'trainer' && (
          <div className="w-full flex-1">
            <TrainerApp />
          </div>
        )}

        {activeView === 'spec' && (
          <div className="w-full flex-1">
            <TechSpecView />
          </div>
        )}
      </div>

      {/* Global GitHub Sync Modal */}
      <GitHubSyncModal
        isOpen={showGithubModal}
        onClose={() => setShowGithubModal(false)}
      />

      {/* App Name Editor Modal */}
      {showAppNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-[360px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-5 shadow-2xl">
            <h3 className="text-base font-bold font-display text-[#F5F4F0] mb-2">
              Nombre de la aplicación
            </h3>
            <p className="text-xs text-[#8E8E94] mb-4">
              Puedes cambiar el nombre provisional a cualquier otro nombre en cualquier momento.
            </p>
            <input
              type="text"
              value={tempAppName}
              onChange={e => setTempAppName(e.target.value)}
              placeholder="Ej: S-Trainer app — Plataforma de Entrenamiento"
              className="w-full px-3 py-2.5 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAppNameModal(false)}
                className="flex-1 py-2 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#8E8E94]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tempAppName.trim()) {
                    setAppName(tempAppName.trim());
                  }
                  setShowAppNameModal(false);
                }}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-2 rounded-full font-bold text-xs shadow-md"
              >
                Guardar nombre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
