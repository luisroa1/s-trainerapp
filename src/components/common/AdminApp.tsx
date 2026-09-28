import React from 'react';
import { LogOut, Shield, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminApp: React.FC = () => {
  const { trainer, clients, signOut } = useApp();

  return (
    <div className="min-h-screen bg-[#101012] text-[#F5F4F0] p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-[#FFD34D] text-xs font-extrabold uppercase tracking-widest">
              <Shield className="w-4 h-4" /> Administrador
            </div>
            <h1 className="text-3xl font-extrabold mt-2">S-TRAINER</h1>
            <p className="text-sm text-[#8E8E94] mt-1">Base administrativa del MVP.</p>
          </div>
          <button onClick={() => signOut()} className="px-4 py-2 rounded-xl border border-[#2A2A2F] text-sm font-bold flex items-center gap-2 cursor-pointer hover:bg-[#1B1B1F]">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5">
            <div className="text-xs uppercase tracking-widest text-[#8E8E94] font-bold mb-3">Entrenador</div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#1B1B1F] flex items-center justify-center">
                <UserRound className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold">{trainer.name || 'No cargado'}</div>
                <div className="text-xs text-[#8E8E94]">{trainer.email}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5">
            <div className="text-xs uppercase tracking-widest text-[#8E8E94] font-bold mb-3">Clientes visibles</div>
            <div className="text-3xl font-extrabold">{clients.length}</div>
            <div className="text-xs text-[#8E8E94] mt-1">Gestión administrativa del entrenador y sus clientes.</div>
          </section>
        </div>
      </div>
    </div>
  );
};
