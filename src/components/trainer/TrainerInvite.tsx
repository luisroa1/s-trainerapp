import React, { useState } from 'react';
import { ArrowLeft, Send, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface TrainerInviteProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const TrainerInvite: React.FC<TrainerInviteProps> = ({ onBack, onSuccess }) => {
  const { programs, addClient, appName } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [objective, setObjective] = useState('Pérdida de grasa');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [assignedProgram, setAssignedProgram] = useState(programs[0]?.id || 'prog-1');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addClient({
      name: name.trim(),
      email: email.trim(),
      objective,
      status: 'Pendiente',
      assignedProgramId: assignedProgram
    });

    setSent(true);
    setTimeout(() => {
      onSuccess();
    }, 1200);
  };

  return (
    <div className="p-8 max-w-[800px] mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
          Añadir cliente
        </h1>
      </div>

      {sent ? (
        <div className="p-8 rounded-[20px] bg-[#16161A] border border-[var(--accent-color,#CFFF5C)] text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-color,#CFFF5C)] text-[#101012] flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <h3 className="text-lg font-bold text-[#F5F4F0]">¡Invitación enviada!</h3>
          <p className="text-xs text-[#8E8E94] mt-1">
            Se ha enviado el enlace de activación a {email || name}.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 rounded-[20px] bg-[#16161A] border border-[#2A2A2F] space-y-4">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              NOMBRE
            </label>
            <input
              type="text"
              required
              placeholder="Nombre y apellidos"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              EMAIL O TELÉFONO
            </label>
            <input
              type="text"
              required
              placeholder="nombre@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                OBJETIVO
              </label>
              <select
                value={objective}
                onChange={e => setObjective(e.target.value)}
                className="w-full px-3 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              >
                <option value="Pérdida de grasa">Pérdida de grasa</option>
                <option value="Hipertrofia">Hipertrofia</option>
                <option value="Fuerza">Fuerza</option>
                <option value="Recomposición corporal">Recomposición corporal</option>
                <option value="Funcional / Movilidad">Funcional / Movilidad</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                FECHA DE INICIO
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              PROGRAMA ASIGNADO
            </label>
            <select
              value={assignedProgram}
              onChange={e => setAssignedProgram(e.target.value)}
              className="w-full px-4 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            >
              {programs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.durationWeeks} semanas)
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#8E8E94]">
            Tu cliente recibirá una invitación para acceder a {appName} y activar su cuenta con estos datos.
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#8E8E94] hover:text-[#F5F4F0]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="px-7 py-3 rounded-full font-bold text-xs shadow-md flex items-center gap-2 transition-transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar invitación</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
