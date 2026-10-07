import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const ClientShoppingList: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <main className="min-h-full bg-[#101012] px-5 pb-20 pt-5 text-[#F5F4F0]">
    <button onClick={onBack} aria-label="Volver" className="mb-5 rounded-full border border-[#2A2A2F] p-2 text-[#8E8E94]"><ArrowLeft className="h-4 w-4" /></button>
    <h2 className="text-xl font-bold">Lista de la compra</h2>
    <p className="mt-3 text-sm text-[#8E8E94]">No hay una lista de compra canónica disponible todavía.</p>
  </main>
);
