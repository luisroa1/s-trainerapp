import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const PasswordRecovery: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    if (window.history.replaceState) window.history.replaceState({}, document.title, cleanUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'No se pudo actualizar la contraseña.');
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen w-full bg-[#101012] text-[#F5F4F0] flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-[28px] border border-[#2A2A2F] bg-[#16161A] p-8 shadow-2xl text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-[var(--accent-color,#CFFF5C)]" />
          <h1 className="text-2xl font-extrabold mb-2">Contraseña actualizada</h1>
          <p className="text-sm text-[#8E8E94] mb-6">Ya puedes entrar en S-TRAINER con tu nueva contraseña.</p>
          <button
            onClick={() => { window.history.replaceState({}, document.title, window.location.pathname); window.location.reload(); }}
            className="w-full rounded-full py-3 font-extrabold text-sm cursor-pointer"
            style={{ backgroundColor: 'var(--accent-color,#CFFF5C)', color: 'var(--accent-text,#101012)' }}
          >
            Volver al acceso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#101012] text-[#F5F4F0] flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-[28px] border border-[#2A2A2F] bg-[#16161A] p-8 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)' }}>
          <KeyRound className="w-6 h-6" style={{ color: 'var(--accent-text,#101012)' }} />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">Nueva contraseña</h1>
        <p className="text-sm text-[#8E8E94] mb-6">Introduce una nueva contraseña para tu cuenta de S-TRAINER.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77777E]" />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              className="w-full rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] py-3 pl-10 pr-10 text-sm outline-none focus:border-[var(--accent-color,#CFFF5C)]"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77777E] cursor-pointer">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77777E]" />
            <input
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              className="w-full rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] py-3 pl-10 pr-10 text-sm outline-none focus:border-[var(--accent-color,#CFFF5C)]"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77777E] cursor-pointer">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && <div className="rounded-xl border border-[#5A3030] bg-[#24191B] px-3 py-2.5 text-sm text-[#FF9B8A]">{error}</div>}

          <button disabled={loading} className="w-full rounded-full py-3 font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)', color: 'var(--accent-text,#101012)' }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Actualizar contraseña
          </button>
        </form>
      </div>
    </div>
  );
};
