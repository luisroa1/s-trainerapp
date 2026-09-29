import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import heroTrainingPhoto from '../../assets/hero-training.jpg';

/* Marca S-Trainer: cinta doblada en forma de "S", gradiente azul-cian,
   estilo original (no reproduce ningún logo de terceros). */
const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className}>
    <defs>
      <linearGradient id="authBrandGradient" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7DD8FF" />
        <stop offset="55%" stopColor="#22B4E8" />
        <stop offset="100%" stopColor="#1E6FE0" />
      </linearGradient>
    </defs>
    <path
      d="M50 8H31.5L14 24h18.5L14 40h18.5L14 56h18.5L50 40H31.5L50 24H31.5L50 8Z"
      fill="url(#authBrandGradient)"
    />
  </svg>
);

export const AuthScreen: React.FC = () => {
  const { appName, signIn, authLoading } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative min-h-screen w-full text-[#F5F4F0] overflow-hidden">
      {/* Foto de fondo a pantalla completa */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroTrainingPhoto})` }}
      />
      {/* Veladura oscura para legibilidad del texto sobre la foto */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05090B]/85 via-[#05090B]/55 to-[#05090B]/92" />

      <div className="relative flex min-h-screen w-full flex-col items-center px-6 pb-8 pt-14">
        {/* Marca */}
        <BrandMark className="w-16 h-16 drop-shadow-[0_0_18px_rgba(34,180,232,0.55)]" />
        <div className="mt-2 text-xl font-extrabold font-display tracking-[0.2em]">
          {appName?.toUpperCase() || 'S-TRAINER'}
        </div>

        <div className="flex-1" />

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3.5">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA0A6]" />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="Correo"
              className="w-full rounded-2xl bg-[#101418]/60 border border-cyan-400/30 backdrop-blur-sm py-3.5 pl-11 pr-4 text-sm text-[#F5F4F0] placeholder:text-[#9AA0A6] outline-none focus:border-cyan-400/70 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA0A6]" />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Contraseña"
              className="w-full rounded-2xl bg-[#101418]/60 border border-cyan-400/30 backdrop-blur-sm py-3.5 pl-11 pr-11 text-sm text-[#F5F4F0] placeholder:text-[#9AA0A6] outline-none focus:border-cyan-400/70 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9AA0A6] hover:text-[#F5F4F0] transition-colors"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-400/30 bg-[#101418]/60 backdrop-blur-sm px-4 py-3 text-sm text-[#FF9B8A]">
              {error}
            </div>
          )}

          <button
            disabled={authLoading}
            className="glow-cyan w-full rounded-2xl py-4 font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer bg-gradient-to-r from-cyan-300 to-cyan-500 text-[#05090B]"
          >
            {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                Entrar
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setRecoveryMode(v => !v)}
            className="w-full text-center text-xs text-[#C7CBD1] hover:text-[#F5F4F0] underline underline-offset-2 cursor-pointer"
          >
            ¿Olvidaste tu contraseña?
          </button>

          {recoveryMode && (
            <div className="rounded-2xl border border-cyan-400/20 bg-[#101418]/60 backdrop-blur-sm p-3.5 text-xs text-[#C7CBD1]">
              Usa el correo escrito arriba para recibir un enlace de recuperación.
              <button
                type="button"
                onClick={handleRecovery}
                disabled={recoveryLoading}
                className="mt-2.5 w-full rounded-xl py-2.5 font-bold text-[#05090B] bg-gradient-to-r from-cyan-300 to-cyan-500 disabled:opacity-60 cursor-pointer"
              >
                {recoveryLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
              {recoveryMessage && <p className="mt-2 text-cyan-300">{recoveryMessage}</p>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
