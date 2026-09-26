import React from 'react';
import { X, Flag, Trophy, ShieldAlert } from 'lucide-react';

export type MotivationType = 'lunes' | 'miercoles' | 'racha' | 'racha_protegida';

interface ClientMotivationalModalProps {
  type: MotivationType;
  clientName: string;
  onClose: () => void;
  onAction: () => void;
}

export const ClientMotivationalModal: React.FC<ClientMotivationalModalProps> = ({
  type,
  clientName,
  onClose,
  onAction
}) => {
  const firstName = clientName.split(' ')[0] || 'Jesús';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-[340px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-6 text-center shadow-2xl flex flex-col items-center">
        {/* Close X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8E8E94] hover:text-[#F5F4F0] p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {type === 'lunes' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-[#232328] border border-[#3A3A40] flex items-center justify-center text-[#CFFF5C] mb-4">
              <Flag className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold font-display text-[#F5F4F0]">
              Nueva semana, {firstName}
            </h3>
            <p className="text-xs text-[#8E8E94] mt-2 mb-6 leading-relaxed max-w-[260px]">
              Vamos a por otra semana de progreso. Hoy toca el primer entrenamiento.
            </p>
            <button
              onClick={() => { onAction(); onClose(); }}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="w-full py-3.5 rounded-full font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              Empezar la semana
            </button>
            <button
              onClick={onClose}
              className="mt-3 text-xs text-[#8E8E94] hover:text-[#F5F4F0]"
            >
              Ahora no
            </button>
          </>
        )}

        {type === 'miercoles' && (
          <>
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="26" stroke="#232328" strokeWidth="5" fill="none" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="var(--accent-color, #CFFF5C)"
                  strokeWidth="5"
                  strokeDasharray="163"
                  strokeDashoffset="40"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className="absolute text-sm font-extrabold font-display text-[#F5F4F0]">
                3/4
              </span>
            </div>
            <h3 className="text-xl font-bold font-display text-[#F5F4F0]">
              Vas por la mitad
            </h3>
            <p className="text-xs text-[#8E8E94] mt-2 mb-6 leading-relaxed max-w-[260px]">
              3 de 4 entrenamientos completados esta semana. No aflojes ahora.
            </p>
            <button
              onClick={() => { onAction(); onClose(); }}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="w-full py-3.5 rounded-full font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              Seguir entrenando
            </button>
            <button
              onClick={onClose}
              className="mt-3 text-xs text-[#8E8E94] hover:text-[#F5F4F0]"
            >
              Ahora no
            </button>
          </>
        )}

        {type === 'racha' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-display text-[#F5F4F0]">
              ¡Semana completada!
            </h3>
            <p className="text-xs text-[#8E8E94] mt-2 leading-relaxed">
              4 de 4 entrenamientos. Buen trabajo, {firstName}.
            </p>
            <div className="mt-4 mb-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#232328] border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <span>🔥</span> Racha de 3 semanas seguidas
            </div>
            <button
              onClick={onClose}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="w-full py-3.5 rounded-full font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              Genial, gracias
            </button>
          </>
        )}

        {type === 'racha_protegida' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-display text-[#F5F4F0]">
              Tu racha sigue viva
            </h3>
            <p className="text-xs text-[#8E8E94] mt-2 mb-6 leading-relaxed max-w-[260px]">
              Se te pasó el entrenamiento de ayer. Puedes recuperarlo esta semana sin perder tu racha.
            </p>
            <button
              onClick={() => { onAction(); onClose(); }}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="w-full py-3.5 rounded-full font-bold text-sm shadow-md transition-transform active:scale-95"
            >
              Recuperar entrenamiento
            </button>
            <button
              onClick={onClose}
              className="mt-3 text-xs text-[#8E8E94] hover:text-[#F5F4F0]"
            >
              Entendido
            </button>
          </>
        )}
      </div>
    </div>
  );
};
