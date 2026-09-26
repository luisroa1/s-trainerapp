import React from 'react';
import { ArrowRight, AlertTriangle, Users, FileSpreadsheet } from 'lucide-react';

interface TrainerGuideProps {
  onNavigate: (section: string) => void;
}

export const TrainerGuide: React.FC<TrainerGuideProps> = ({ onNavigate }) => {
  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
          Guía rápida
        </h1>
        <p className="text-xs text-[#8E8E94] mt-1">
          Cuatro pasos para tener a un cliente entrenando hoy mismo.
        </p>
      </div>

      {/* 4 Steps Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Step 1 */}
        <div 
          onClick={() => onNavigate('invite')}
          className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span 
              className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            >
              1
            </span>
            <h3 className="text-sm font-bold text-[#F5F4F0] group-hover:text-[var(--accent-color,#CFFF5C)]">
              Añade un cliente
            </h3>
          </div>
          <p className="text-xs text-[#8E8E94] leading-relaxed pl-9">
            Clientes → Añadir cliente. Rellena sus datos y objetivo: recibe una invitación para activar su cuenta.
          </p>
        </div>

        {/* Step 2 */}
        <div 
          onClick={() => onNavigate('program_new')}
          className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span 
              className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            >
              2
            </span>
            <h3 className="text-sm font-bold text-[#F5F4F0] group-hover:text-[var(--accent-color,#CFFF5C)]">
              Crea un programa
            </h3>
          </div>
          <p className="text-xs text-[#8E8E94] leading-relaxed pl-9">
            Programas → Crear programa. Elige un perfil y el sistema genera el borrador de semanas ya relleno.
          </p>
        </div>

        {/* Step 3 */}
        <div 
          onClick={() => onNavigate('programs')}
          className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span 
              className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            >
              3
            </span>
            <h3 className="text-sm font-bold text-[#F5F4F0] group-hover:text-[var(--accent-color,#CFFF5C)]">
              Asigna el programa
            </h3>
          </div>
          <p className="text-xs text-[#8E8E94] leading-relaxed pl-9">
            Desde la ficha del programa, asigna a uno o varios clientes. Cada día verán su sesión en Hoy.
          </p>
        </div>

        {/* Step 4 */}
        <div 
          onClick={() => onNavigate('dashboard')}
          className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <span 
              className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            >
              4
            </span>
            <h3 className="text-sm font-bold text-[#F5F4F0] group-hover:text-[var(--accent-color,#CFFF5C)]">
              Haz seguimiento
            </h3>
          </div>
          <p className="text-xs text-[#8E8E94] leading-relaxed pl-9">
            En Clientes ves adherencia y alertas de un vistazo. Toca un cliente para su programado vs. realizado.
          </p>
        </div>
      </div>

      {/* TAMBIÉN TE INTERESA */}
      <div>
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3 px-1">
          TAMBIÉN TE INTERESA
        </span>

        <div className="rounded-[16px] bg-[#16161A] border border-[#2A2A2F] divide-y divide-[#2A2A2F]/50 overflow-hidden">
          <div
            onClick={() => onNavigate('export')}
            className="p-4 flex items-center justify-between hover:bg-[#1B1B1F] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-4 h-4 text-[#8E8E94]" />
              <span className="text-xs font-bold text-[#F5F4F0]">Exportar los datos de tus clientes a Excel</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#5C5C62]" />
          </div>

          <div
            onClick={() => onNavigate('dashboard')}
            className="p-4 flex items-center justify-between hover:bg-[#1B1B1F] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-[#FF6B4A]" />
              <span className="text-xs font-bold text-[#F5F4F0]">Qué significan las alertas de un cliente</span>
            </div>
            <span className="text-xs text-[#8E8E94]">Ver alerta en su ficha</span>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-[#1B1B1F] transition-colors">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#5CD6FF]" />
              <span className="text-xs font-bold text-[#F5F4F0]">Los estados de un cliente: Activo, Pausado, Pendiente</span>
            </div>
            <span className="text-xs text-[#8E8E94]">Configurable desde la tabla</span>
          </div>
        </div>
      </div>
    </div>
  );
};
