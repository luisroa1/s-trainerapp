import React from 'react';
import { useApp } from '../../context/AppContext';
import { Plus, Edit2 } from 'lucide-react';
import { Program } from '../../types';

interface TrainerProgramsProps {
  onSelectProgram: (program: Program) => void;
  onCreateNewProgram: () => void;
}

export const TrainerPrograms: React.FC<TrainerProgramsProps> = ({
  onSelectProgram,
  onCreateNewProgram
}) => {
  const { programs } = useApp();

  const totalAssignedClients = programs.reduce((acc, p) => acc + p.assignedClientsCount, 0);

  return (
    <div className="p-8 max-w-[1240px] mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
            Programas
          </h1>
          <p className="text-xs text-[#8E8E94] mt-1">
            {programs.length} programas activos · {totalAssignedClients} clientes asignados
          </p>
        </div>

        <button
          onClick={onCreateNewProgram}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="px-5 py-2.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Crear programa</span>
        </button>
      </div>

      {/* Grid 2 Columns */}
      <div className="grid grid-cols-2 gap-4">
        {programs.map((program) => (
          <div
            key={program.id}
            onClick={() => onSelectProgram(program)}
            className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-base font-bold text-[#F5F4F0] group-hover:text-[var(--accent-color,#CFFF5C)] transition-colors">
                  {program.name}
                </h3>
                <span className="text-xs font-semibold text-[#8E8E94]">
                  {program.durationWeeks} semanas
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#8E8E94] mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color,#CFFF5C)]" />
                <span>{program.type}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#2A2A2F]/50">
              <span className="text-xs text-[#8E8E94]">
                {program.assignedClientsCount} clientes asignados
              </span>
              <button className="text-xs font-bold text-[#F5F4F0] group-hover:text-[var(--accent-color,#CFFF5C)] flex items-center gap-1">
                <span>Editar</span>
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
