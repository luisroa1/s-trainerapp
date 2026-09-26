import React, { useState, useRef } from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  Check, 
  Camera, 
  Trash2, 
  ShieldCheck, 
  User, 
  Briefcase, 
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

interface ClientOnboardingProps {
  onFinishOnboarding: () => void;
  onNavigateToTrainer?: () => void;
}

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ 
  onFinishOnboarding,
  onNavigateToTrainer 
}) => {
  const { 
    appName, 
    trainer, 
    signIn, 
    signUp, 
    supabaseStatus 
  } = useApp();

  const [step, setStep] = useState<'welcome' | 'method' | 'activate' | 'login'>('welcome');
  
  // Form states
  const [selectedRole, setSelectedRole] = useState<UserRole>('client');
  const [fullName, setFullName] = useState('Juan Rodríguez');
  const [email, setEmail] = useState('juan.rodriguez@email.com');
  const [password, setPassword] = useState('Password123!');
  const [confirmPassword, setConfirmPassword] = useState('Password123!');
  const [phone, setPhone] = useState('+34 600 123 456');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Por favor introduce tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    const res = await signIn(email, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Credenciales incorrectas en Supabase.');
      return;
    }

    setSuccessMessage('¡Sesión iniciada con éxito!');
    setTimeout(() => {
      if (res.role === 'trainer' && onNavigateToTrainer) {
        onNavigateToTrainer();
      } else {
        onFinishOnboarding();
      }
    }, 600);
  };

  const handleRegisterSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Por favor completa todos los campos obligatorios.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Debes aceptar los términos y condiciones para continuar.');
      return;
    }

    setIsLoading(true);
    const res = await signUp({
      email,
      password,
      role: selectedRole,
      name: fullName,
      phone,
      avatarUrl: avatarPreview
    });
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Error al crear la cuenta en Supabase.');
      return;
    }

    setSuccessMessage(res.message || 'Cuenta registrada con éxito en Supabase.');
    setTimeout(() => {
      if (selectedRole === 'trainer' && onNavigateToTrainer) {
        onNavigateToTrainer();
      } else {
        onFinishOnboarding();
      }
    }, 1000);
  };

  // Quick switch role preset
  const handleSelectRolePreset = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'trainer') {
      setEmail('entrenador@strainer.com');
      setFullName('Jesús Entrenador');
    } else {
      setEmail('juan.rodriguez@email.com');
      setFullName('Juan Rodríguez');
    }
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-full flex flex-col justify-between items-center px-6 py-12 bg-[#101012] text-[#F5F4F0]">
        {/* Supabase status indicator */}
        <div className="w-full flex justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[10px] text-[#8E8E94]">
            <span className={`w-2 h-2 rounded-full ${supabaseStatus === 'connected' ? 'bg-[#CFFF5C] animate-pulse' : 'bg-[#FFD34D]'}`} />
            <span>Supabase Auth Activo</span>
          </div>
        </div>
        
        {/* Center brand */}
        <div className="flex flex-col items-center text-center my-auto">
          <BrandLogo size="xl" showSubtitle={true} />
          <p className="mt-8 text-sm text-[#8E8E94] max-w-[260px] leading-relaxed">
            Plataforma full-stack con autenticación y base de datos en tiempo real.
          </p>

          <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16161A] border border-[#2A2A2F] text-[11px] text-[#CFFF5C]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Conectado a tu proyecto Supabase</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => setStep('method')}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98] hover:opacity-95 cursor-pointer"
          >
            Empezar / Registrarse
          </button>
          <button
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
              setStep('login');
            }}
            className="w-full py-3 rounded-full font-medium text-sm text-[#F5F4F0] hover:text-[#CFFF5C] transition-colors cursor-pointer"
          >
            Ya tengo cuenta (Iniciar sesión)
          </button>
        </div>
      </div>
    );
  }

  if (step === 'method') {
    return (
      <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-[#101012] text-[#F5F4F0]">
        <div>
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setStep('welcome')}
              className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setStep('activate')}
              className="text-xs text-[#8E8E94] hover:text-[#F5F4F0] font-medium cursor-pointer"
            >
              Omitir
            </button>
          </div>

          <div className="mb-6">
            <span className="text-[11px] font-bold tracking-widest text-[#8E8E94] uppercase">
              MÉTODO DE ENTRENAMIENTO
            </span>
            <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] mt-1 leading-tight">
              Así funciona tu<br />entrenamiento
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(207, 255, 92, 0.1)', color: 'var(--accent-color, #CFFF5C)' }}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#F5F4F0]">Planificación</h3>
                <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                  Tu entrenador diseña cada sesión. Tú solo la sigues, paso a paso.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(207, 255, 92, 0.1)', color: 'var(--accent-color, #CFFF5C)' }}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#F5F4F0]">Adherencia</h3>
                <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                  La app registra lo que completas cada día y sincroniza con Supabase en tiempo real.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(207, 255, 92, 0.1)', color: 'var(--accent-color, #CFFF5C)' }}
              >
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#F5F4F0]">Progresión</h3>
                <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                  Tu entrenador ajusta pesos, descansos y series según tu evolución real.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-4 mt-8">
          <div className="flex gap-1.5">
            <span 
              className="w-6 h-1.5 rounded-full" 
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
            />
            <span className="w-2 h-1.5 rounded-full bg-[#2A2A2F]" />
          </div>

          <button
            onClick={() => setStep('activate')}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98] cursor-pointer"
          >
            Continuar al Registro
          </button>
        </div>
      </div>
    );
  }

  // step === 'activate' (Registro)
  if (step === 'activate') {
    return (
      <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-[#101012] text-[#F5F4F0] overflow-y-auto">
        <div>
          <button 
            onClick={() => setStep('method')}
            className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] mb-5 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="mb-4">
            <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              Crear cuenta en Supabase
            </h2>
            <p className="text-xs text-[#8E8E94] mt-1">
              Registro real con autenticación y diferenciación de rol.
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-2.5 text-green-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Role Selector: Trainer vs Client */}
          <div className="mb-4">
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1.5">
              SELECCIONA TU ROL
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectRolePreset('client')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-left cursor-pointer ${
                  selectedRole === 'client'
                    ? 'bg-[#1B1B1F] border-[var(--accent-color,#CFFF5C)] text-[#F5F4F0] ring-1 ring-[var(--accent-color,#CFFF5C)]'
                    : 'bg-[#16161A] border-[#2A2A2F] text-[#8E8E94] hover:border-[#3A3A40]'
                }`}
              >
                <User className={`w-5 h-5 ${selectedRole === 'client' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94]'}`} />
                <span className="text-xs font-bold text-center">Soy Cliente</span>
                <span className="text-[9px] text-[#8E8E94] text-center">Para entrenar y registrar</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRolePreset('trainer')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-left cursor-pointer ${
                  selectedRole === 'trainer'
                    ? 'bg-[#1B1B1F] border-[var(--accent-color,#CFFF5C)] text-[#F5F4F0] ring-1 ring-[var(--accent-color,#CFFF5C)]'
                    : 'bg-[#16161A] border-[#2A2A2F] text-[#8E8E94] hover:border-[#3A3A40]'
                }`}
              >
                <Briefcase className={`w-5 h-5 ${selectedRole === 'trainer' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94]'}`} />
                <span className="text-xs font-bold text-center">Soy Entrenador</span>
                <span className="text-[9px] text-[#8E8E94] text-center">Panel y gestión</span>
              </button>
            </div>
          </div>

          {/* Coach Invite pill (if client) */}
          {selectedRole === 'client' && (
            <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center gap-3 mb-4">
              {trainer.avatarUrl ? (
                <img src={trainer.avatarUrl} alt={trainer.name} className="w-8 h-8 rounded-full object-cover border border-[#3A3A40]" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#232328] border border-[#3A3A40] flex items-center justify-center font-bold text-xs text-[#F5F4F0]">
                  {trainer.initials}
                </div>
              )}
              <p className="text-[11px] text-[#F5F4F0]">
                Te vincularás con el entrenador <span className="font-bold">{trainer.name}</span>.
              </p>
            </div>
          )}

          {/* Photo upload profile section */}
          <div className="mb-4 p-3.5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex items-center gap-3.5">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="relative shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Foto de perfil"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[var(--accent-color,#CFFF5C)]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94]">
                  <Camera className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <span className="text-xs font-bold text-[#F5F4F0] block">
                Foto de perfil
              </span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#1B1B1F] border border-[#2A2A2F] text-[#F5F4F0] hover:border-[var(--accent-color,#CFFF5C)] cursor-pointer"
                >
                  {avatarPreview ? 'Cambiar' : 'Subir foto'}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => setAvatarPreview('')}
                    className="p-1 rounded-full text-[#8E8E94] hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                NOMBRE COMPLETO
              </label>
              <input
                type="text"
                value={fullName}
                required
                onChange={e => setFullName(e.target.value)}
                placeholder="Tu nombre y apellidos"
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                CORREO ELECTRÓNICO
              </label>
              <input
                type="email"
                value={email}
                required
                onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                  CONTRASEÑA
                </label>
                <input
                  type="password"
                  value={password}
                  required
                  placeholder="Mín. 6 car."
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                  CONFIRMAR
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  required
                  placeholder="Repite pass"
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
                />
              </div>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <div 
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                  acceptedTerms ? 'bg-[var(--accent-color,#CFFF5C)] border-[var(--accent-color,#CFFF5C)] text-[#101012]' : 'border-[#3A3A40] bg-[#1B1B1F]'
                }`}
              >
                {acceptedTerms && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span className="text-[10px] text-[#8E8E94] leading-tight">
                Acepto los términos de uso y la política de privacidad de {appName}.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="w-full mt-4 py-3.5 rounded-full font-bold text-xs shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registrando en Supabase...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Crear cuenta ({selectedRole === 'trainer' ? 'Entrenador' : 'Cliente'})</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setStep('login');
              }}
              className="text-xs text-[#8E8E94] hover:text-[#CFFF5C] cursor-pointer"
            >
              ¿Ya tienes cuenta? <span className="underline font-semibold">Iniciar sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'login'
  return (
    <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-[#101012] text-[#F5F4F0] overflow-y-auto">
      <div>
        <button 
          onClick={() => setStep('welcome')}
          className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
            Iniciar sesión
          </h2>
          <p className="text-xs text-[#8E8E94] mt-1">
            Autenticación con tu proyecto de Supabase.
          </p>
        </div>

        {/* Feedback alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-2 text-green-400 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1.5">
              CORREO ELECTRÓNICO
            </label>
            <input
              type="email"
              value={email}
              required
              placeholder="nombre@email.com"
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1.5">
              CONTRASEÑA
            </label>
            <input
              type="password"
              value={password}
              required
              placeholder="Tu contraseña"
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#8E8E94]">
            <span className="text-[11px]">Diferenciación automática por rol</span>
            <button 
              type="button" 
              onClick={() => alert('Para restablecer tu contraseña, utiliza el panel de Supabase Auth o crea una cuenta nueva.')}
              className="hover:text-[var(--accent-color,#CFFF5C)] cursor-pointer"
            >
              ¿Olvidaste tu clave?
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="w-full py-4 rounded-full font-bold text-sm shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando con Supabase...</span>
              </>
            ) : (
              <span>Entrar con Supabase</span>
            )}
          </button>
        </form>
      </div>

      <div className="w-full space-y-3 mt-6">
        <button
          onClick={() => {
            setErrorMessage(null);
            setSuccessMessage(null);
            setStep('activate');
          }}
          className="w-full text-center text-xs text-[#8E8E94] cursor-pointer"
        >
          ¿No tienes cuenta? <span className="text-[var(--accent-color,#CFFF5C)] font-semibold underline">Crear cuenta</span>
        </button>
      </div>
    </div>
  );
};
