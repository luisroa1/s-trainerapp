import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Plus, AlertTriangle, Clock } from 'lucide-react';
import { ClientData } from '../../types';

interface TrainerDashboardProps {
  onSelectClient: (client: ClientData) => void;
  onOpenInvite: () => void;
}

export const TrainerDashboard: React.FC<TrainerDashboardProps> = ({
  onSelectClient,
  onOpenInvite
}) => {
  const { clients } = useApp();
  const [search, setSearch] = useState('');

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.objective.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = clients.filter(c => c.status === 'Activo').length;
  const alertCount = clients.filter(c => c.alert).length;

  return (
    <div className="p-8 max-w-[1240px] mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
            Mis clientes
          </h1>
          <p className="text-xs text-[#8E8E94] mt-1">
            {activeCount} clientes activos · {alertCount} alertas pendientes
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8E8E94] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar cliente"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] w-56 focus:outline-none focus:border-[var(--accent-color,#CFFF5C)]"
            />
          </div>

          {/* Add client button */}
          <button
            onClick={onOpenInvite}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="px-5 py-2.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Añadir cliente</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[16px] bg-[#16161A] border border-[#2A2A2F] overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#2A2A2F] text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider">
              <th className="py-4 px-6">CLIENTE</th>
              <th className="py-4 px-4">ESTADO</th>
              <th className="py-4 px-4">PRÓXIMO ENTRENO</th>
              <th className="py-4 px-4">ADHERENCIA</th>
              <th className="py-4 px-4">PESO</th>
              <th className="py-4 px-4">CHECK-IN</th>
              <th className="py-4 px-6 text-center">ALERTA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2A2F]/50 text-xs">
            {filteredClients.map((client) => {
              const isActivo = client.status === 'Activo';
              const isPausado = client.status === 'Pausado';
              const isPendiente = client.status === 'Pendiente';

              return (
                <tr
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className="hover:bg-[#1B1B1F] cursor-pointer transition-colors group"
                >
                  {/* CLIENTE */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {client.avatarUrl ? (
                        <img
                          src={client.avatarUrl}
                          alt={client.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#2A2A2F] group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-bold text-xs text-[#F5F4F0] group-hover:border-[var(--accent-color,#CFFF5C)] transition-colors shrink-0">
                          {client.initials}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-[#F5F4F0] block leading-tight">
                          {client.name}
                        </span>
                        <span className="text-[11px] text-[#8E8E94]">
                          {client.objective}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* ESTADO */}
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        isActivo
                          ? 'bg-[#CFFF5C]/10 text-[#CFFF5C]'
                          : isPausado
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-[#2A2A2F] text-[#8E8E94]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActivo
                            ? 'bg-[#CFFF5C]'
                            : isPausado
                            ? 'bg-amber-400'
                            : 'bg-[#8E8E94]'
                        }`}
                      />
                      {client.status}
                    </span>
                  </td>

                  {/* PRÓXIMO ENTRENO */}
                  <td className="py-4 px-4 text-[#F5F4F0] font-medium">
                    {client.nextWorkout}
                  </td>

                  {/* ADHERENCIA */}
                  <td className="py-4 px-4">
                    {client.status !== 'Pendiente' ? (
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[#F5F4F0] w-9">
                          {client.adherencePercentage} %
                        </span>
                        <div className="w-20 h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              backgroundColor: 'var(--accent-color, #CFFF5C)',
                              width: `${client.adherencePercentage}%`
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#5C5C62]">—</span>
                    )}
                  </td>

                  {/* PESO */}
                  <td className="py-4 px-4 font-semibold text-[#5CD6FF]">
                    {client.status !== 'Pendiente' ? `${client.currentWeight.toFixed(1).replace('.', ',')} kg` : '—'}
                  </td>

                  {/* CHECK-IN */}
                  <td className="py-4 px-4 text-[#8E8E94]">
                    {client.lastCheckIn}
                  </td>

                  {/* ALERTA */}
                  <td className="py-4 px-6 text-center">
                    {client.alert ? (
                      <div
                        className="inline-flex items-center justify-center p-1 text-[#FF6B4A]"
                        title={client.alert.message}
                      >
                        <AlertTriangle className="w-4 h-4 fill-current/20" />
                      </div>
                    ) : isPendiente ? (
                      <div
                        className="inline-flex items-center justify-center p-1 text-[#8E8E94]"
                        title="Invitación pendiente"
                      >
                        <Clock className="w-4 h-4" />
                      </div>
                    ) : (
                      <span className="text-[#3A3A40]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
