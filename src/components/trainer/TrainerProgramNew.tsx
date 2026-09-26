import React, { useState } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';

interface TrainerProgramNewProps {
  onBack: () => void;
  onProceedToBuilder: (config: {
    name: string;
    objective: string;
    level: string;
    daysPerWeek: number;
    durationWeeks: number;
  }) => void;
}

export const TrainerProgramNew: React.FC<TrainerProgramNewProps> = ({
  onBack,
  onProceedToBuilder
}) => {
  const [selectedObjective, setSelectedObjective] = useState('Hipertrofia');
  const [selectedLevel, setSelectedLevel] = useState('Intermedio');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [durationWeeks, setDurationWeeks] = useState(8);

  const handleGenerate = () => {
    onProceedToBuilder({
      name: `${selectedObjective} — Bloque 1`,
      objective: selectedObjective,
      level: selectedLevel,
      daysPerWeek,
      durationWeeks
    });
  };

  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
            PASO 1 DE 2 · ELEGIR PERFIL
          </span>
          <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
            Nuevo programa
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* NIVEL DE PARTIDA */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
            NIVEL DE PARTIDA
          </span>
          <div className="grid grid-cols-3 gap-3">
            <div
              onClick={() => setSelectedLevel('Principiante')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-colors cursor-pointer ${
                selectedLevel === 'Principiante'
                  ? 'border-[var(--accent-color,#CFFF5C)] shadow-sm'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              <h3 className="text-sm font-bold text-[#F5F4F0]">Adaptación / Principiante</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Base técnica y neuromuscular, frecuencia moderada.
              </p>
            </div>
            <div
              onClick={() => setSelectedLevel('Intermedio')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-colors cursor-pointer ${
                selectedLevel === 'Intermedio'
                  ? 'border-[var(--accent-color,#CFFF5C)] shadow-sm'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              <h3 className="text-sm font-bold text-[#F5F4F0]">Intermedio</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Sobrecarga progresiva, volumen escalado y descansos planificados.
              </p>
            </div>
            <div
              onClick={() => setSelectedLevel('Avanzado')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-colors cursor-pointer ${
                selectedLevel === 'Avanzado'
                  ? 'border-[var(--accent-color,#CFFF5C)] shadow-sm'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              <h3 className="text-sm font-bold text-[#F5F4F0]">Avanzado</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Especialización, periodización por bloques y alta intensidad RIR 1-0.
              </p>
            </div>
          </div>
        </div>

        {/* SITUACIÓN ESPECÍFICA */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
            SITUACIÓN ESPECÍFICA
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer">
              <h3 className="text-sm font-bold text-[#F5F4F0]">Retorno a la actividad</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Post-lesión: carga conservadora, prioridad movilidad y control.
              </p>
            </div>
            <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer">
              <h3 className="text-sm font-bold text-[#F5F4F0]">Estancamiento / Ruptura de meseta</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Intermedio-avanzado sin progreso: autorregulación y rotación de ejercicios.
              </p>
            </div>
          </div>
        </div>

        {/* OBJETIVO FÍSICO */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
            OBJETIVO FÍSICO
          </span>
          <div className="grid grid-cols-3 gap-3">
            {/* Hipertrofia */}
            <div
              onClick={() => setSelectedObjective('Hipertrofia')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-all cursor-pointer relative ${
                selectedObjective === 'Hipertrofia'
                  ? 'border-2 border-[var(--accent-color,#CFFF5C)] shadow-md'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              {selectedObjective === 'Hipertrofia' && (
                <div 
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              <h3 className="text-sm font-bold text-[#F5F4F0]">Hipertrofia</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Volumen progresivo, foco en tensión mecánica.
              </p>
            </div>

            {/* Fuerza */}
            <div
              onClick={() => setSelectedObjective('Fuerza')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-all cursor-pointer relative ${
                selectedObjective === 'Fuerza'
                  ? 'border-2 border-[var(--accent-color,#CFFF5C)] shadow-md'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              {selectedObjective === 'Fuerza' && (
                <div 
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              <h3 className="text-sm font-bold text-[#F5F4F0]">Fuerza</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Progresión por %1RM en los levantamientos base.
              </p>
            </div>

            {/* Pérdida de grasa */}
            <div
              onClick={() => setSelectedObjective('Pérdida de grasa')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-all cursor-pointer relative ${
                selectedObjective === 'Pérdida de grasa'
                  ? 'border-2 border-[var(--accent-color,#CFFF5C)] shadow-md'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              {selectedObjective === 'Pérdida de grasa' && (
                <div 
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              <h3 className="text-sm font-bold text-[#F5F4F0]">Pérdida de grasa</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Densidad de entrenamiento alta, déficit controlado.
              </p>
            </div>

            {/* Recomposición corporal */}
            <div
              onClick={() => setSelectedObjective('Recomposición corporal')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-all cursor-pointer relative ${
                selectedObjective === 'Recomposición corporal'
                  ? 'border-2 border-[var(--accent-color,#CFFF5C)] shadow-md'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              {selectedObjective === 'Recomposición corporal' && (
                <div 
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              <h3 className="text-sm font-bold text-[#F5F4F0]">Recomposición corporal</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Mantener fuerza mientras baja el peso graso.
              </p>
            </div>

            {/* Funcional / Movilidad */}
            <div
              onClick={() => setSelectedObjective('Funcional / Movilidad')}
              className={`p-4 rounded-[16px] bg-[#16161A] border transition-all cursor-pointer relative ${
                selectedObjective === 'Funcional / Movilidad'
                  ? 'border-2 border-[var(--accent-color,#CFFF5C)] shadow-md'
                  : 'border-[#2A2A2F] hover:border-[#3A3A40]'
              }`}
            >
              {selectedObjective === 'Funcional / Movilidad' && (
                <div 
                  className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
              <h3 className="text-sm font-bold text-[#F5F4F0]">Funcional / Movilidad</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Rango de movimiento, control y patrones cotidianos.
              </p>
            </div>
          </div>
        </div>

        {/* RENDIMIENTO Y ESTILO DE VIDA */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
            RENDIMIENTO Y ESTILO DE VIDA
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer">
              <h3 className="text-sm font-bold text-[#F5F4F0]">Resistencia</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Rendimiento cardiovascular, series largas y circuitos.
              </p>
            </div>
            <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] hover:border-[#3A3A40] transition-colors cursor-pointer">
              <h3 className="text-sm font-bold text-[#F5F4F0]">Mantenimiento / Salud</h3>
              <p className="text-xs text-[#8E8E94] mt-1 leading-relaxed">
                Baja frecuencia, sin objetivo estético específico.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer controls & Generate button */}
      <div className="mt-10 p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              DÍAS DISPONIBLES POR SEMANA
            </label>
            <select
              value={daysPerWeek}
              onChange={e => setDaysPerWeek(Number(e.target.value))}
              className="px-4 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] focus:outline-none"
            >
              <option value={3}>3 días</option>
              <option value={4}>4 días</option>
              <option value={5}>5 días</option>
              <option value={6}>6 días</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              DURACIÓN TOTAL
            </label>
            <select
              value={durationWeeks}
              onChange={e => setDurationWeeks(Number(e.target.value))}
              className="px-4 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] focus:outline-none"
            >
              <option value={6}>6 semanas</option>
              <option value={8}>8 semanas</option>
              <option value={10}>10 semanas</option>
              <option value={12}>12 semanas</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="px-7 py-3 rounded-full font-bold text-xs shadow-md flex items-center gap-2 transition-transform active:scale-95"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>Generar programa</span>
        </button>
      </div>
    </div>
  );
};
