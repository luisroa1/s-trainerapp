import React from 'react';

export const TrainerAssistant: React.FC = () => (
  <div className="p-8 max-w-[1240px] mx-auto">
    <header className="mb-8 border-b border-[#2A2A2F] pb-6">
      <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
        Asistente
      </h1>
    </header>
    <section className="rounded-[16px] bg-[#16161A] border border-[#2A2A2F] p-6">
      <p className="text-sm font-semibold text-[#F5F4F0]">
        El asistente analítico aún no está disponible.
      </p>
      <p className="text-xs text-[#8E8E94] mt-2">
        Puedes revisar las sesiones registradas y su prescripción en la ficha de cada cliente.
      </p>
    </section>
  </div>
);
