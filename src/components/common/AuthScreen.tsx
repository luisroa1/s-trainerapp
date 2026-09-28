import React, { useState } from 'react';
import { Loader2, Lock, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

export const AuthScreen: React.FC = () => {
  const { appName, signIn, authLoading } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const handleRecovery = async () => {
    setError(null);
    setRecoveryMessage(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Introduce primero tu correo electrónico.');
      return;
    }
    setRecoveryLoading(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin,
    });
    setRecoveryLoading(false);
    if (recoveryError) {
      setError(recoveryError.message || 'No se pudo enviar el correo de recuperación.');
      return;
    }
    setRecoveryMessage('Si el correo existe, recibirás un enlace para establecer una nueva contraseña.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Introduce correo y contraseña.');
      return;
    }
    const result = await signIn(email, password);
    if (!result.success) setError(result.error || 'No se pudo iniciar sesión.');
  };

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F4F0] flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-[28px] border border-[#2A2A2F] bg-[#16161A] p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center p-2.5" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#101012" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17 L10 11 L14 15 L20 7" />
              <path d="M14 7 H20 V13" />
            </svg>
          </div>
          <div>
            <div className="font-extrabold font-display text-lg">{appName}</div>
            <div className="text-[10px] uppercase tracking-widest text-[#8E8E94] font-bold">Acceso</div>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-[#8E8E94] mb-6">Accede con una cuenta de S-TRAINER.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold text-[#B8B8BE] mb-2">Correo</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77777E]" />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" className="w-full rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--accent-color,#CFFF5C)]" />
            </div>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-[#B8B8BE] mb-2">Contraseña</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77777E]" />
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" className="w-full rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--accent-color,#CFFF5C)]" />
            </div>
          </label>

          {error && <div className="rounded-xl border border-[#5A3030] bg-[#24191B] px-3 py-2.5 text-sm text-[#FF9B8A]">{error}</div>}

          <button disabled={authLoading} className="w-full rounded-xl py-3 font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)', color: 'var(--accent-text,#101012)' }}>
            {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>

          <button
            type="button"
            onClick={() => setRecoveryMode(v => !v)}
            className="w-full text-center text-xs text-[#B8B8BE] hover:text-[#F5F4F0] underline underline-offset-2 cursor-pointer"
          >
            ¿Olvidaste tu contraseña?
          </button>

          {recoveryMode && (
            <div className="rounded-xl border border-[#2A2A2F] bg-[#1B1B1F] p-3 text-xs text-[#B8B8BE]">
              Usa el correo escrito arriba para recibir un enlace de recuperación.
              <button type="button" onClick={handleRecovery} disabled={recoveryLoading} className="mt-2 w-full rounded-lg py-2 font-bold text-[#101012] disabled:opacity-60 cursor-pointer" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)' }}>
                {recoveryLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
              {recoveryMessage && <p className="mt-2 text-[#9ED65A]">{recoveryMessage}</p>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
