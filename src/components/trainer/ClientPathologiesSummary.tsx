import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ClientData } from '../../types';

interface ClientPathologiesSummaryProps {
  pathologies: ClientData['pathologies'];
}

export const ClientPathologiesSummary: React.FC<ClientPathologiesSummaryProps> = ({ pathologies }) => {
  if (!pathologies) {
    return (
      <div className="mb-4 p-3.5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
        <h4 className="text-xs font-bold text-[#8E8E94]">Sin información registrada</h4>
      </div>
    );
  }

  if (pathologies.hasLimitations) {
    return (
      <div className="mb-4 p-4 rounded-[16px] bg-[#16161A] border border-[#FF6B4A]/40">
        <span className="text-[10px] font-bold tracking-widest text-[#FF6B4A] uppercase block mb-1.5 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          PATOLOGÍAS Y LIMITACIONES
        </span>
        <div className="text-xs text-[#F5F4F0] space-y-1 leading-relaxed">
          <p><b className="text-[#8E8E94]">Entrenamiento:</b> {pathologies.training}</p>
          <p><b className="text-[#8E8E94]">Alimentación:</b> {pathologies.nutrition}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 p-3.5 rounded-[16px] bg-[#16161A] border border-[#CFFF5C]/40 flex items-center gap-3">
      <div className="w-7 h-7 rounded-full bg-[#CFFF5C]/15 text-[#CFFF5C] flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-4 h-4" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-[#CFFF5C]">Sin patologías ni limitaciones registradas</h4>
        <p className="text-[11px] text-[#8E8E94]">Confirmado — sin restricciones de entrenamiento ni de alimentación</p>
      </div>
    </div>
  );
};
