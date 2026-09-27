import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

interface TrainerLoginProps {
  onLoginSuccess: () => void;
  initialError?: string | null;
}

export const TrainerLogin: React.FC<TrainerLoginProps> = ({ 
  onLoginSuccess,
  initialError 
}) => {
  const { appName, updateTrainer } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Por favor introduce tu correo y contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Iniciar sesión en Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !data.user) {
        setIsLoading(false);
        setErrorMessage('Correo o contraseña incorrectos');
        return;
      }

      // 2. Verificar rol en la tabla profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, avatar_url')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile || profile.role !== 'trainer') {
        // El usuario no tiene rol trainer: cerrar sesión inmediatamente
        await supabase.auth.signOut();
        setIsLoading(false);
        setErrorMessage('Acceso denegado: Esta cuenta no tiene permisos de entrenador.');
        return;
      }

      // 3. Sincronizar datos reales del entrenador
      const fullName = profile.full_name || data.user.user_metadata?.full_name || profile.email?.split('@')[0] || 'Entrenador';
      const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'TR';

      updateTrainer({
        id: profile.id,
        name: fullName,
        email: profile.email || data.user.email || '',
        initials,
        role: 'Entrenador',
        avatarUrl: profile.avatar_url || '',
      });

      setIsLoading(false);
      onLoginSuccess();
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Correo o contraseña incorrectos');
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] w-full flex items-center justify-center p-4 bg-[#101012] text-[#F5F4F0]">
      <div className="w-full max-w-[420px] bg-[#16161A] border border-[#2A2A2F] rounded-[28px] p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Brand & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center p-2.5 shadow-lg mb-4"
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#101012" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
              <path d="M4 17 L10 11 L14 15 L20 7" />
              <path d="M14 7 H20 V13" />
            </svg>
          </div>

          <span className="text-[10px] tracking-widest text-[#8E8E94] font-bold uppercase mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-color,#CFFF5C)]" />
            <span>ACCESO DE ENTRENADOR</span>
          </span>

          <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
            Panel Entrenador
          </h2>
          <p className="text-xs text-[#8E8E94] mt-2 leading-relaxed">
            Inicia sesión con tu cuenta de Supabase Auth para acceder a la gestión de clientes y entrenamientos.
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1.5">
              CORREO ELECTRÓNICO
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8E8E94] absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="entrenador@strainerapp.dev"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1.5">
              CONTRASEÑA
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8E8E94] absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Introduce tu contraseña"
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#8E8E94] hover:text-[#F5F4F0] p-0.5 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="w-full mt-2 py-3.5 rounded-full font-bold text-xs shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <span>Entrar al Panel</span>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-5 border-t border-[#2A2A2F] text-center">
          <p className="text-[11px] text-[#8E8E94]">
            Solo cuentas con rol <span className="text-[#F5F4F0] font-semibold">trainer</span> en Supabase pueden acceder a este panel.
          </p>
        </div>
      </div>
    </div>
  );
};
