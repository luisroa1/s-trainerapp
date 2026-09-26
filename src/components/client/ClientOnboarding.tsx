import React, { useState, useRef } from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { ArrowLeft, Calendar, CheckCircle2, TrendingUp, Check, Camera, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientOnboardingProps {
  onFinishOnboarding: () => void;
}

export const ClientOnboarding: React.FC<ClientOnboardingProps> = ({ onFinishOnboarding }) => {
  const { appName, trainer, activeClient, updateClientPhoto } = useApp();
  const [step, setStep] = useState<'welcome' | 'method' | 'activate' | 'login'>('welcome');
  const [email, setEmail] = useState('juan.rodriguez@email.com');
  const [password, setPassword] = useState('Password123!');
  const [confirmPassword, setConfirmPassword] = useState('Password123!');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
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

  const handleFinishActivation = () => {
    if (avatarPreview) {
      updateClientPhoto(activeClient.id, avatarPreview);
    }
    onFinishOnboarding();
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-full flex flex-col justify-between items-center px-6 py-12 bg-[#101012] text-[#F5F4F0]">
        <div className="w-full flex justify-end"></div>
        
        {/* Center brand */}
        <div className="flex flex-col items-center text-center my-auto">
          <BrandLogo size="xl" showSubtitle={true} />
          <p className="mt-8 text-sm text-[#8E8E94] max-w-[240px] leading-relaxed">
            La plataforma de entrenamiento de tu entrenador.
          </p>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => setStep('method')}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98] hover:opacity-95"
          >
            Empezar
          </button>
          <button
            onClick={() => setStep('login')}
            className="w-full py-3 rounded-full font-medium text-sm text-[#F5F4F0] hover:text-[#CFFF5C] transition-colors"
          >
            Ya tengo cuenta
          </button>
        </div>
      </div>
    );
  }

  if (step === 'method') {
    return (
      <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-[#101012] text-[#F5F4F0]">
        {/* Top bar */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setStep('welcome')}
              className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setStep('activate')}
              className="text-xs text-[#8E8E94] hover:text-[#F5F4F0] font-medium"
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

          {/* Cards */}
          <div className="flex flex-col gap-3">
            {/* Card 1 */}
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

            {/* Card 2 */}
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
                  La app registra lo que completas cada día, sin que tengas que anotarlo.
                </p>
              </div>
            </div>

            {/* Card 3 */}
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
                  Tu entrenador ajusta pesos y series según tu evolución real.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full flex flex-col items-center gap-4 mt-8">
          {/* Pagination dots */}
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
            className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98]"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  if (step === 'activate') {
    return (
      <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-[#101012] text-[#F5F4F0]">
        <div>
          {/* Back button */}
          <button 
            onClick={() => setStep('method')}
            className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="mb-5">
            <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              Activa tu cuenta
            </h2>
            <p className="text-xs text-[#8E8E94] mt-1">
              Crea tu perfil y contraseña para empezar a entrenar.
            </p>
          </div>

          {/* Coach Invite pill */}
          <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center gap-3 mb-5">
            {trainer.avatarUrl ? (
              <img src={trainer.avatarUrl} alt={trainer.name} className="w-9 h-9 rounded-full object-cover border border-[#3A3A40]" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#232328] border border-[#3A3A40] flex items-center justify-center font-bold text-xs text-[#F5F4F0]">
                {trainer.initials}
              </div>
            )}
            <p className="text-xs text-[#F5F4F0]">
              Tu entrenador <span className="font-bold">{trainer.name}</span> te ha invitado a <span className="font-bold text-[var(--accent-color,#CFFF5C)]">{appName}</span>.
            </p>
          </div>

          {/* Photo upload profile section */}
          <div className="mb-5 p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex items-center gap-4">
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
                  className="w-14 h-14 rounded-full object-cover border-2 border-[var(--accent-color,#CFFF5C)]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94]">
                  <Camera className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <span className="text-xs font-bold text-[#F5F4F0] block">
                Foto de perfil
              </span>
              <p className="text-[10px] text-[#8E8E94] mb-2">
                Sube tu foto ahora o cámbiala más tarde en tu perfil.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                  className="px-3 py-1 rounded-full text-[11px] font-bold shadow-sm"
                >
                  {avatarPreview ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={() => setAvatarPreview('')}
                    className="p-1 rounded-full text-[#8E8E94] hover:text-red-400"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                CORREO
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                CONTRASEÑA
              </label>
              <input
                type="password"
                value={password}
                placeholder="Mínimo 8 caracteres"
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                CONFIRMAR CONTRASEÑA
              </label>
              <input
                type="password"
                value={confirmPassword}
                placeholder="Repite tu contraseña"
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 pt-1 cursor-pointer">
              <div 
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  acceptedTerms ? 'bg-[var(--accent-color,#CFFF5C)] border-[var(--accent-color,#CFFF5C)] text-[#101012]' : 'border-[#3A3A40] bg-[#1B1B1F]'
                }`}
              >
                {acceptedTerms && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
              <span className="text-[11px] text-[#8E8E94] leading-normal">
                Acepto los términos de uso y la política de privacidad de {appName}.
              </span>
            </label>
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full mt-6">
          <button
            onClick={handleFinishActivation}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="w-full py-3.5 rounded-full font-bold text-sm shadow-lg transition-transform active:scale-[0.98]"
          >
            Crear contraseña y empezar
          </button>
        </div>
      </div>
    );
  }

  // step === 'login'
  return (
    <div className="min-h-full flex flex-col justify-between px-6 py-8 bg-[#101012] text-[#F5F4F0]">
      <div>
        <button 
          onClick={() => setStep('welcome')}
          className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
            Inicia sesión
          </h2>
          <p className="text-xs text-[#8E8E94] mt-1">
            Continúa donde lo dejaste en {appName}.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1.5">
              CORREO
            </label>
            <input
              type="email"
              value={email}
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
              placeholder="Tu contraseña"
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            />
          </div>

          <div className="text-right">
            <button className="text-xs text-[#8E8E94] hover:text-[var(--accent-color,#CFFF5C)]">
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
      </div>

      <div className="w-full space-y-3 mt-8">
        <button
          onClick={onFinishOnboarding}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98]"
        >
          Iniciar sesión
        </button>
        <button
          onClick={() => setStep('activate')}
          className="w-full text-center text-xs text-[#8E8E94]"
        >
          ¿Tu entrenador te ha invitado? <span className="text-[var(--accent-color,#CFFF5C)] font-semibold underline">Activa tu cuenta</span>
        </button>
      </div>
    </div>
  );
};
