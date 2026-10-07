import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Home, 
  Dumbbell, 
  TrendingUp, 
  Apple, 
  User, 
  ChevronDown 
} from 'lucide-react';

interface ClientHelpProps {
  onBack: () => void;
}

export const ClientHelp: React.FC<ClientHelpProps> = ({ onBack }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: '¿Qué significa el RIR en cada ejercicio?',
      a: 'RIR significa "Reps In Reserve" (repeticiones en reserva). Un RIR 2 significa que debes terminar la serie sintiendo que habrías podido realizar exactamente 2 repeticiones más antes del fallo muscular total.'
    },
    {
      q: '¿Puede mi entrenador ver mis fechas del ciclo menstrual?',
      a: 'No. Por privacidad absoluta, la plataforma únicamente transmite la fase fisiológica general (ej. Fase menstrual o lútea) para que el entrenador autorregule el volumen de trabajo, sin revelar jamás fechas exactas.'
    }
  ];

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-extrabold font-display text-[#F5F4F0]">
          Ayuda y soporte
        </h2>
      </div>

      {/* LA BARRA DE ABAJO */}
      <div className="mb-6">
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3 px-1">
          LA BARRA DE ABAJO
        </span>
        <div className="rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] divide-y divide-[#2A2A2F]/50 overflow-hidden">
          <div className="p-3.5 flex items-center gap-3">
            <Home className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Hoy</h4>
              <p className="text-[11px] text-[#8E8E94]">Tu entrenamiento del día, de un vistazo</p>
            </div>
          </div>

          <div className="p-3.5 flex items-center gap-3">
            <Dumbbell className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Entreno</h4>
              <p className="text-[11px] text-[#8E8E94]">Te guía ejercicio a ejercicio, serie a serie</p>
            </div>
          </div>

          <div className="p-3.5 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Progreso</h4>
              <p className="text-[11px] text-[#8E8E94]">Consulta la evolución cuando haya historial registrado suficiente</p>
            </div>
          </div>

          <div className="p-3.5 flex items-center gap-3">
            <Apple className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Nutrición</h4>
              <p className="text-[11px] text-[#8E8E94]">Consulta la información de nutrición disponible</p>
            </div>
          </div>

          <div className="p-3.5 flex items-center gap-3">
            <User className="w-5 h-5 text-[var(--accent-color,#CFFF5C)] shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Perfil</h4>
              <p className="text-[11px] text-[#8E8E94]">Tus datos y ajustes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendario de sesiones todavía no disponible */}
      <div className="mb-6">
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3 px-1">
          CALENDARIO DE SESIONES
        </span>
        <p className="p-3.5 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] text-[11px] text-[#8E8E94]">
          Aún no hay un calendario de sesiones esperadas. Las sesiones aparecen en Entreno cuando se inician y quedan registradas.
        </p>
      </div>

      {/* PREGUNTAS FRECUENTES */}
      <div>
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3 px-1">
          PREGUNTAS FRECUENTES
        </span>
        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] cursor-pointer"
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#F5F4F0] pr-2">{faq.q}</h4>
                <ChevronDown
                  className={`w-4 h-4 text-[#8E8E94] transition-transform ${
                    openFaq === idx ? 'rotate-180 text-[var(--accent-color,#CFFF5C)]' : ''
                  }`}
                />
              </div>
              {openFaq === idx && (
                <p className="text-[11px] text-[#8E8E94] mt-2.5 leading-relaxed pt-2 border-t border-[#2A2A2F]/50">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
