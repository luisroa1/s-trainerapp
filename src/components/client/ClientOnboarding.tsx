import React, { useState } from 'react';
import { ArrowLeft, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { useApp } from '../../context/AppContext';

interface ClientOnboardingProps {
  onFinishOnboarding: () => void;
}

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ onFinishOnboarding }) => {
  const { appName, signIn, supabaseStatus } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'No se pudo iniciar sesión.');
      return;
    }
    onFinishOnboarding();
  };

  if (showLogin) {
    return (
      <div className="min-h-full flex flex-col px-6 py-8 bg-[#101012] text-[#F5F4F0]">
        <button type="button" onClick={() => setShowLogin(false)} className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] mb-6">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-extrabold">Iniciar sesión</h2>
        <p className="text-xs text-[#8E8E94] mt-1">Accede con la cuenta que activaste mediante la invitación de tu entrenador.</p>
        <form onSubmit={handleLogin} className="space-y-3 mt-6">
          <label className="block">
            <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">Correo electrónico</span>
            <span className="relative block mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77777E]" />
              <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--accent-color,#CFFF5C)]" />
            </span>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">Contraseña</span>
            <span className="relative block mt-1">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#77777E]" />
              <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--accent-color,#CFFF5C)]" />
            </span>
          </label>
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)', color: 'var(--accent-text,#101012)' }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Comprobando acceso...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col justify-between items-center px-6 py-12 bg-[#101012] text-[#F5F4F0]">
      <div className="w-full flex justify-end text-[10px] text-[#8E8E94]">{supabaseStatus === 'connected' ? 'Servicio disponible' : 'Conectando...'}</div>
      <div className="flex flex-col items-center text-center my-auto">
        <BrandLogo size="xl" showSubtitle />
        <p className="mt-8 text-sm text-[#8E8E94] max-w-[290px] leading-relaxed">
          {appName} funciona mediante invitación de un entrenador. No hay registro público de cuentas.
        </p>
        <p className="mt-4 text-xs text-[#8E8E94] max-w-[290px] leading-relaxed">
          Si ya recibiste una invitación, abre su enlace para activar tu cuenta. Después podrás iniciar sesión.
        </p>
      </div>
      <div className="w-full flex flex-col gap-3">
        <button type="button" onClick={() => setShowLogin(true)} className="w-full py-4 rounded-full font-bold text-base" style={{ backgroundColor: 'var(--accent-color,#CFFF5C)', color: 'var(--accent-text,#101012)' }}>
          Iniciar sesión
        </button>
        <p className="text-center text-[11px] text-[#8E8E94]">¿Necesitas acceso? Solicita una invitación a tu entrenador.</p>
      </div>
    </div>
  );
};
