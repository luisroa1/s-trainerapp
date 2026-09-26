import React, { useState } from 'react';
import { 
  X, 
  Database, 
  Check, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  User, 
  Briefcase, 
  AlertCircle, 
  CheckCircle2,
  Terminal,
  LogOut,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SCHEMA_SQL } from '../../lib/supabase';
import { UserRole } from '../../types';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({ isOpen, onClose }) => {
  const { 
    supabaseUser, 
    supabaseSession, 
    userRole, 
    supabaseStatus, 
    isRealtimeActive,
    lastSyncTime, 
    signIn, 
    signUp, 
    signOut, 
    syncAllToSupabase,
    refreshFromSupabase
  } = useApp();

  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'auth'>('status');
  const [copiedSql, setCopiedSql] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Quick auth states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<UserRole>('trainer');
  const [email, setEmail] = useState('entrenador@strainer.com');
  const [password, setPassword] = useState('Password123!');
  const [fullName, setFullName] = useState('Jesús Entrenador');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    const res = await syncAllToSupabase();
    setIsSyncing(false);
    if (res.success) {
      setSyncFeedback('¡Sincronización completada! Todos los clientes, programas y nutrición se han subido a Supabase.');
    } else {
      setSyncFeedback(`Error: ${res.error}`);
    }
  };

  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    if (authMode === 'login') {
      const res = await signIn(email, password);
      setAuthLoading(false);
      if (res.success) {
        setAuthSuccess(`Sesión iniciada con éxito como ${res.role === 'trainer' ? 'Entrenador' : 'Cliente'}.`);
      } else {
        setAuthError(res.error || 'Credenciales incorrectas');
      }
    } else {
      const res = await signUp({
        email,
        password,
        role: authRole,
        name: fullName,
      });
      setAuthLoading(false);
      if (res.success) {
        setAuthSuccess(res.message || 'Cuenta registrada en Supabase.');
      } else {
        setAuthError(res.error || 'Error al registrar');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[620px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-6 shadow-2xl flex flex-col text-[#F5F4F0] max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#8E8E94] hover:text-[#F5F4F0] p-1 rounded-lg hover:bg-[#232328] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#101012] shadow-md shrink-0"
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
          >
            <Database className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-[#F5F4F0] leading-tight flex items-center gap-2">
              <span>Supabase Backend & Tiempo Real</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                supabaseStatus === 'connected' ? 'bg-[#CFFF5C]/20 text-[#CFFF5C]' : 'bg-[#FFD34D]/20 text-[#FFD34D]'
              }`}>
                {supabaseStatus === 'connected' ? 'Conectado' : 'Conectado (Sin tablas)'}
              </span>
            </h2>
            <p className="text-xs text-[#8E8E94]">
              Proyecto: <span className="text-[#F5F4F0] font-mono font-medium">rfxyisqvrukslnlgzzek.supabase.co</span>
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 bg-[#1B1B1F] border border-[#2A2A2F] rounded-xl mb-5">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'status' ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            Estado & Sincronización
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'sql' ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            Script SQL (Tablas)
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'auth' ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            Autenticación Supabase
          </button>
        </div>

        {/* TAB 1: STATUS & SYNC */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Status card */}
            <div className="p-4 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8E8E94]">URL Supabase:</span>
                <span className="text-xs font-mono text-[#5CD6FF] truncate max-w-[280px]">{SUPABASE_URL}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8E8E94]">Publishable Key:</span>
                <span className="text-xs font-mono text-[#8E8E94]">{SUPABASE_ANON_KEY.slice(0, 15)}...{SUPABASE_ANON_KEY.slice(-8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8E8E94]">Canal en Tiempo Real:</span>
                <span className="text-xs font-semibold flex items-center gap-1.5 text-[#CFFF5C]">
                  <span className="w-2 h-2 rounded-full bg-[#CFFF5C] animate-pulse" />
                  {isRealtimeActive ? 'Suscrito a eventos postgres_changes' : 'Conectando WebSocket...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8E8E94]">Última sincronización:</span>
                <span className="text-xs text-[#F5F4F0]">
                  {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Al iniciar la app'}
                </span>
              </div>
            </div>

            {/* Current user card */}
            <div className="p-4 rounded-xl bg-[#101012] border border-[#2A2A2F] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block">
                  Usuario autenticado actualmente
                </span>
                <div className="text-sm font-bold text-[#F5F4F0] mt-0.5">
                  {supabaseUser ? supabaseUser.email : 'Ninguna sesión activa (modo anónimo/invitado)'}
                </div>
                {supabaseUser && (
                  <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1B1B1F] text-[#CFFF5C] border border-[#2A2A2F]">
                    Rol: {userRole || 'cliente'}
                  </span>
                )}
              </div>
              {supabaseUser && (
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Salir</span>
                </button>
              )}
            </div>

            {/* Sync feedback */}
            {syncFeedback && (
              <div className="p-3 rounded-xl bg-[#1B1B1F] border border-[var(--accent-color,#CFFF5C)] text-xs text-[#F5F4F0]">
                {syncFeedback}
              </div>
            )}

            {/* Sync actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-3 rounded-xl font-bold text-xs shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Subiendo datos a Supabase...' : 'Subir todos los datos locales a Supabase'}</span>
              </button>

              <button
                onClick={() => refreshFromSupabase()}
                className="px-4 py-3 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] flex items-center gap-2 cursor-pointer"
                title="Recargar desde Supabase"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recargar</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SQL SCHEMA SCRIPT */}
        {activeTab === 'sql' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#8E8E94]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[#F5F4F0]">¿Cómo crear las tablas en tu proyecto de Supabase?</span>
                <button
                  onClick={() => window.open('https://supabase.com/dashboard/project/rfxyisqvrukslnlgzzek/sql/new', '_blank')}
                  className="text-[10px] text-[var(--accent-color,#CFFF5C)] hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Abrir Supabase SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] leading-relaxed">
                1. Haz clic en "Copiar Script SQL" abajo.<br />
                2. En tu panel de Supabase ve a <strong>SQL Editor</strong> &gt; <strong>New Query</strong>.<br />
                3. Pega el script y pulsa <strong>RUN</strong>. ¡Creará las tablas <code className="text-[#CFFF5C]">clients</code>, <code className="text-[#CFFF5C]">programs</code>, <code className="text-[#CFFF5C]">nutrition_plans</code> y activará el Realtime!
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider">
                  Script SQL Completo (PostgreSQL + RLS + Realtime)
                </span>
                <button
                  onClick={handleCopySql}
                  className="text-xs font-bold text-[var(--accent-color,#CFFF5C)] flex items-center gap-1.5 hover:underline cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#CFFF5C]" />
                      <span>¡Copiado al portapapeles!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Script SQL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-[#101012] border border-[#2A2A2F] text-[11px] font-mono text-[#8E8E94] max-h-[220px] overflow-y-auto whitespace-pre-wrap selection:bg-[#CFFF5C] selection:text-[#101012]">
                {SUPABASE_SCHEMA_SQL}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: AUTH TEST */}
        {activeTab === 'auth' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-1 bg-[#1B1B1F] border border-[#2A2A2F] rounded-lg">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  authMode === 'login' ? 'bg-[#101012] text-[#F5F4F0]' : 'text-[#8E8E94]'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  authMode === 'register' ? 'bg-[#101012] text-[#F5F4F0]' : 'text-[#8E8E94]'
                }`}
              >
                Registrar Nuevo Usuario
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-2 text-green-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authSuccess}</span>
              </div>
            )}

            <form onSubmit={handleQuickAuth} className="space-y-3">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block mb-1">
                      Rol de usuario
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthRole('client');
                          setEmail('alumno@strainer.com');
                        }}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                          authRole === 'client' ? 'border-[var(--accent-color,#CFFF5C)] bg-[#1B1B1F] text-[#F5F4F0]' : 'border-[#2A2A2F] text-[#8E8E94]'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Cliente</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAuthRole('trainer');
                          setEmail('entrenador@strainer.com');
                        }}
                        className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                          authRole === 'trainer' ? 'border-[var(--accent-color,#CFFF5C)] bg-[#1B1B1F] text-[#F5F4F0]' : 'border-[#2A2A2F] text-[#8E8E94]'
                        }`}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>Entrenador</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0]"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider block mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="w-full py-2.5 rounded-full font-bold text-xs shadow-md transition-transform active:scale-95 cursor-pointer disabled:opacity-50 mt-2"
              >
                {authLoading ? 'Procesando en Supabase...' : authMode === 'login' ? 'Iniciar Sesión en Supabase' : 'Registrar en Supabase'}
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-5 border-t border-[#2A2A2F]">
          <span className="text-[10px] text-[#5C5C62]">
            Supabase SDK v2 · PostgreSQL · Realtime WebSockets
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
