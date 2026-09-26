import React, { useState } from 'react';
import { ArrowLeft, Droplet, Clock, Bell } from 'lucide-react';

interface ClientRemindersProps {
  onBack: () => void;
}

export const ClientReminders: React.FC<ClientRemindersProps> = ({ onBack }) => {
  const [hydration, setHydration] = useState(true);
  const [breaks, setBreaks] = useState(true);
  const [sleep, setSleep] = useState(true);

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
          Recordatorios
        </h2>
      </div>

      <div className="space-y-3 mb-6">
        {/* Hidratación */}
        <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16161A] flex items-center justify-center text-[#5CD6FF]">
              <Droplet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Hidratación</h4>
              <p className="text-[11px] text-[#8E8E94]">Cada 2 horas</p>
            </div>
          </div>
          <button
            onClick={() => setHydration(!hydration)}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              hydration ? 'bg-[var(--accent-color,#CFFF5C)]' : 'bg-[#2A2A2F]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full transition-transform ${
                hydration ? 'translate-x-5 bg-[#101012]' : 'translate-x-0 bg-white'
              }`}
            />
          </button>
        </div>

        {/* Pausas activas */}
        <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16161A] flex items-center justify-center text-[#FFD34D]">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Pausas activas</h4>
              <p className="text-[11px] text-[#8E8E94]">Cada 45 minutos sentado</p>
            </div>
          </div>
          <button
            onClick={() => setBreaks(!breaks)}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              breaks ? 'bg-[var(--accent-color,#CFFF5C)]' : 'bg-[#2A2A2F]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full transition-transform ${
                breaks ? 'translate-x-5 bg-[#101012]' : 'translate-x-0 bg-white'
              }`}
            />
          </button>
        </div>

        {/* Hora de dormir */}
        <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16161A] flex items-center justify-center text-[#B388FF]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#F5F4F0]">Hora de dormir</h4>
              <p className="text-[11px] text-[#8E8E94]">Aviso a las 22:30</p>
            </div>
          </div>
          <button
            onClick={() => setSleep(!sleep)}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              sleep ? 'bg-[var(--accent-color,#CFFF5C)]' : 'bg-[#2A2A2F]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full transition-transform ${
                sleep ? 'translate-x-5 bg-[#101012]' : 'translate-x-0 bg-white'
              }`}
            />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#8E8E94] text-center">
        Ajusta la frecuencia y el horario desde cada tarjeta.
      </p>
    </div>
  );
};
