import React from 'react';

interface ClientProgressProps {
  onOpenMeasurements: () => void;
}

export const ClientProgress: React.FC<ClientProgressProps> = ({ onOpenMeasurements }) => (
  <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
    <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] mb-5">
      Mi progreso
    </h2>
    <section className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F]">
      <p className="text-sm font-semibold text-[#F5F4F0]">
        Aún no hay suficientes datos registrados para mostrar evolución.
      </p>
    </section>
    <button
      onClick={onOpenMeasurements}
      className="mt-4 self-start px-4 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0]"
    >
      Abrir medidas
    </button>
  </div>
);
