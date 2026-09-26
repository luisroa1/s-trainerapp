import React, { useState } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface TrainerNutritionNewProps {
  clientId: string;
  onBack: () => void;
  onProceedToBuilder: (config: {
    objective: string;
    dietType: 'Omnívora' | 'Vegetariana' | 'Vegana';
    targetKcal: number;
    mealsCount: number;
  }) => void;
}

export const TrainerNutritionNew: React.FC<TrainerNutritionNewProps> = ({
  clientId,
  onBack,
  onProceedToBuilder
}) => {
  const { clients } = useApp();
  const client = clients.find(c => c.id === clientId) || clients[0];

  const [selectedObjective, setSelectedObjective] = useState('Pérdida de grasa');
  const [dietType, setDietType] = useState<'Omnívora' | 'Vegetariana' | 'Vegana'>('Omnívora');
  const [targetKcal, setTargetKcal] = useState(2200);
  const [mealsCount, setMealsCount] = useState(4);

  const handleGenerate = () => {
    onProceedToBuilder({
      objective: selectedObjective,
      dietType,
      targetKcal,
      mealsCount
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
            PASO 1 DE 2 · ELEGIR PLANTILLA
          </span>
          <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
            Nuevo plan nutricional — {client.name}
          </h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* OBJETIVO */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
            OBJETIVO
          </span>
          <div className="grid grid-cols-4 gap-3">
            {[
              { id: 'Pérdida de grasa', desc: 'Déficit moderado, proteína alta para preservar músculo.' },
              { id: 'Hipertrofia', desc: 'Superávit ligero, reparto de carbohidratos en torno al entreno.' },
              { id: 'Recomposición', desc: 'Mantenimiento calórico, proteína muy alta.' },
              { id: 'Mantenimiento', desc: 'Equilibrado, sin objetivo estético concreto.' },
            ].map(item => {
              const isSelected = selectedObjective === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedObjective(item.id)}
                  className={`p-4 rounded-[16px] bg-[#16161A] border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-2 border-[var(--accent-color,#CFFF5C)] shadow-md'
                      : 'border-[#2A2A2F] hover:border-[#3A3A40]'
                  }`}
                >
                  {isSelected && (
                    <div 
                      className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                  <h3 className="text-sm font-bold text-[#F5F4F0] mb-1">{item.id}</h3>
                  <p className="text-xs text-[#8E8E94] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* TIPO DE DIETA */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
            TIPO DE DIETA
          </span>
          <div className="flex items-center gap-2">
            {(['Omnívora', 'Vegetariana', 'Vegana'] as const).map(type => (
              <button
                key={type}
                onClick={() => setDietType(type)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  dietType === type
                    ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                    : 'bg-[#16161A] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* KCAL OBJETIVO & COMIDAS AL DÍA */}
        <div className="grid grid-cols-2 gap-6 p-6 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              KCAL OBJETIVO
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={targetKcal}
                onChange={e => setTargetKcal(Number(e.target.value))}
                className="w-36 px-4 py-2.5 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-base font-extrabold font-display text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
              <span className="text-xs font-semibold text-[#8E8E94]">kcal / día</span>
            </div>
            <p className="text-[11px] text-[#5C5C62] mt-1">
              Sugerido según su peso y objetivo — ajustable
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
              COMIDAS AL DÍA
            </label>
            <select
              value={mealsCount}
              onChange={e => setMealsCount(Number(e.target.value))}
              className="w-44 px-4 py-2.5 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
            >
              <option value={3}>3 comidas</option>
              <option value={4}>4 comidas</option>
              <option value={5}>5 comidas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleGenerate}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="px-8 py-3.5 rounded-full font-bold text-xs shadow-md flex items-center gap-2 transition-transform active:scale-95"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>Generar plan</span>
        </button>
      </div>
    </div>
  );
};
