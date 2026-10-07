import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ClientData } from '../../types';

interface ClientPathologiesSummaryProps {
  pathologies: ClientData['pathologies'];
}

export const ClientPathologiesSummary: React.FC<ClientPathologiesSummaryProps> = ({ pathologies }) => {
  if (!pathologies) {
    return (
      <div className="mb-4 p-3.5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
        <h4 className="text-xs font-bold text-[#8E8E94]">Sin antecedentes previos registrados</h4>
      </div>
    );
  }

  if (pathologies.hasLimitations) {
    return (
      <div className="mb-4 p-4 rounded-[16px] bg-[#16161A] border border-[#FF6B4A]/40">
        <span className="text-[10px] font-bold tracking-widest text-[#FF6B4A] uppercase block mb-1.5 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          INFORMACIÓN PREVIA DEL PERFIL
        </span>
        <div className="text-xs text-[#F5F4F0] space-y-1 leading-relaxed">
          <p><b className="text-[#8E8E94]">Entrenamiento:</b> {pathologies.training}</p>
          <p><b className="text-[#8E8E94]">Alimentación:</b> {pathologies.nutrition}</p>
        </div>
        <p className="mt-2 text-[11px] text-[#8E8E94]">Dato heredado del perfil anterior; puede no estar actualizado.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 p-3.5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
      <h4 className="text-xs font-bold text-[#8E8E94]">Antecedente del perfil anterior</h4>
      <p className="mt-1 text-[11px] text-[#8E8E94]">El registro anterior indicaba que no había limitaciones. Puede no estar actualizado.</p>
    </div>
  );
};
