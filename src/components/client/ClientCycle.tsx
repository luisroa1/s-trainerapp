import React from 'react';
import { ArrowLeft, Moon, Calendar, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientCycleProps {
  onBack: () => void;
}

export const ClientCycle: React.FC<ClientCycleProps> = ({ onBack }) => {
  const { activeClient, updateClient } = useApp();
  const tracking = activeClient.menstrualTracking || {
    enabled: true,
    sharedWithTrainer: true,
    day: 3,
    phase: 'Menstrual',
    advice: 'Es normal sentir menos energía estos días. Puedes bajar la intensidad si lo necesitas.'
  };

  const handleToggleEnabled = () => {
    updateClient(activeClient.id, {
      menstrualTracking: {
        ...tracking,
        enabled: !tracking.enabled
      }
    });
  };

  const handleToggleShared = () => {
    updateClient(activeClient.id, {
      menstrualTracking: {
        ...tracking,
        sharedWithTrainer: !tracking.sharedWithTrainer
      }
    });
  };

  const handleRegisterStart = () => {
    updateClient(activeClient.id, {
      menstrualTracking: {
        ...tracking,
        day: 1,
        phase: 'Menstrual',
        advice: 'Inicio de nuevo ciclo. Planifica entrenamientos con autorregulación.'
      }
    });
  };

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold font-display text-[#F5F4F0]">
            Ciclo menstrual
          </h2>
          <p className="text-[11px] text-[#8E8E94]">
            Opcional — te ayuda a entender tu energía en el mes
          </p>
        </div>
      </div>

      {/* Toggle Activar Seguimiento */}
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-bold text-[#F5F4F0]">Activar seguimiento</h4>
          <p className="text-[10px] text-[#8E8E94] mt-0.5">
            Solo tú lo ves, hasta que decidas compartirlo
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
            tracking.enabled ? 'bg-[#E8A0C4]' : 'bg-[#2A2A2F]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              tracking.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Main Circular Indicator */}
      {tracking.enabled && (
        <div className="p-5 rounded-[20px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col items-center text-center mb-4">
          <div className="relative w-40 h-40 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="64" stroke="#232328" strokeWidth="10" fill="none" />
              <circle
                cx="80"
                cy="80"
                r="64"
                stroke="#E8A0C4"
                strokeWidth="10"
                strokeDasharray="402"
                strokeDashoffset="260"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold text-[#8E8E94] tracking-widest uppercase">
                DÍA {tracking.day}
              </span>
              <span className="text-xl font-extrabold font-display text-[#E8A0C4]">
                {tracking.phase}
              </span>
            </div>
          </div>

          <p className="text-xs text-[#8E8E94] leading-relaxed max-w-[260px] mb-5">
            {tracking.advice}
          </p>

          <button
            onClick={handleRegisterStart}
            className="w-full py-3 rounded-full bg-[#16161A] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#E8A0C4]/60 transition-colors"
          >
            Registrar inicio de regla
          </button>
        </div>
      )}

      {/* Toggle Compartir con mi entrenador */}
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between mb-5">
        <div>
          <h4 className="text-xs font-bold text-[#F5F4F0]">Compartir con mi entrenador</h4>
          <p className="text-[10px] text-[#8E8E94] mt-0.5">
            Solo verá la fase general, nunca fechas exactas
          </p>
        </div>
        <button
          onClick={handleToggleShared}
          className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
            tracking.sharedWithTrainer ? 'bg-[#E8A0C4]' : 'bg-[#2A2A2F]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              tracking.sharedWithTrainer ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* ASÍ LO VERÁ TU ENTRENADOR preview */}
      <div>
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
          ASÍ LO VERÁ TU ENTRENADOR
        </span>
        <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E8A0C4]/15 text-[#E8A0C4] flex items-center justify-center shrink-0">
            <Moon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#F5F4F0]">
              {tracking.phase ? `Fase ${tracking.phase.toLowerCase()}` : 'Sin fase registrada'}
            </h4>
            <p className="text-[10px] text-[#8E8E94]">
              {tracking.phase
                ? tracking.phase === 'Menstrual' ? 'Considera bajar volumen si lo pide' : 'Energía alta para entrenar fuerza'
                : 'Sin información registrada'}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-[#5C5C62] mt-4 px-1 text-center">
          Puedes desactivar esto cuando quieras desde aquí mismo.
        </p>
      </div>
    </div>
  );
};
