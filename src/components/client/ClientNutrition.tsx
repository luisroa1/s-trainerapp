import React, { useState } from 'react';
import { ShoppingCart, Pill, Calculator, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientNutritionProps {
  onOpenShoppingList: () => void;
  onOpenSupplements: () => void;
  onOpenCalculator: () => void;
}

export const ClientNutrition: React.FC<ClientNutritionProps> = ({
  onOpenShoppingList,
  onOpenSupplements,
  onOpenCalculator
}) => {
  const { activeClient, nutritionPlans, toggleMealCompleted } = useApp();
  const currentPlan = activeClient ? nutritionPlans[activeClient.id] : undefined;
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const handleMealToggle = async (mealId: string) => {
    if (!activeClient) return;
    setPersistenceError(null);
    try {
      await toggleMealCompleted(activeClient.id, mealId);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : 'No se pudo guardar el cambio.');
    }
  };

  const consumedKcal = activeClient?.metrics?.kcalToday || 0;
  const targetKcal = currentPlan?.targetKcal || activeClient?.metrics?.kcalGoal || 2000;
  const remainingKcal = Math.max(0, targetKcal - consumedKcal);

  // Circular SVG ring calculation
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = targetKcal > 0 ? Math.min(1, consumedKcal / targetKcal) : 0;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
            Mi plan<br />nutricional
          </h2>
          <p className="text-xs text-[#8E8E94] mt-1 font-medium">
            Asignado por tu entrenador
          </p>
        </div>

        {/* 3 Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenShoppingList}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
            title="Lista de la compra"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSupplements}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
            title="Suplementación"
          >
            <Pill className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCalculator}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
            title="Calculadora"
          >
            <Calculator className="w-4 h-4" />
          </button>
        </div>
      </div>

      {persistenceError && (
        <p role="alert" className="mb-3 rounded-lg bg-red-950 p-2 text-xs text-red-200">
          No se guardó el cambio: {persistenceError}
        </p>
      )}

      {/* Circular Kcal Ring */}
      <div className="flex flex-col items-center justify-center my-3">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke="#232328"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke="var(--accent-color, #CFFF5C)"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold font-display text-[#F5F4F0]">
              {consumedKcal.toLocaleString()}
            </span>
            <span className="text-[11px] text-[#8E8E94] font-medium mt-0.5">
              de {targetKcal.toLocaleString()} kcal
            </span>
          </div>
        </div>

        <p className="text-xs font-semibold text-[var(--accent-color,#CFFF5C)] mt-2">
          {remainingKcal} kcal restantes
        </p>
      </div>

      {/* 5 Macro Progress Bars */}
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] space-y-3.5 mb-5 shadow-sm">
        {/* Proteínas */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#F5F4F0]">Proteínas</span>
            <span className="text-[#8E8E94]">132 / {currentPlan?.macros.protein || 160} g</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '82%' }} />
          </div>
        </div>

        {/* Carbohidratos */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#F5F4F0]">Carbohidratos</span>
            <span className="text-[#8E8E94]">198 / {currentPlan?.macros.carbs || 230} g</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '86%' }} />
          </div>
        </div>

        {/* Grasas */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#F5F4F0]">Grasas</span>
            <span className="text-[#8E8E94]">58 / {currentPlan?.macros.fat || 70} g</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '82%' }} />
          </div>
        </div>

        {/* Fibra */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#F5F4F0]">Fibra</span>
            <span className="text-[#8E8E94]">22 / {currentPlan?.macros.fiber || 30} g</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '73%' }} />
          </div>
        </div>

        {/* Agua */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#F5F4F0]">Agua</span>
            <span className="text-[#8E8E94]">1,8 / {currentPlan?.macros.water || 2.5} L</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '72%' }} />
          </div>
        </div>
      </div>

      {/* CUMPLIMIENTO DE HOY */}
      <div>
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2.5">
          CUMPLIMIENTO DE HOY
        </span>
        {(!currentPlan || !currentPlan.meals || currentPlan.meals.length === 0) ? (
          <div className="p-6 rounded-[14px] bg-[#16161A] border border-[#2A2A2F] text-center">
            <p className="text-xs text-[#8E8E94]">
              Tu entrenador aún no ha configurado las comidas de tu plan nutricional.
            </p>
          </div>
        ) : (
        <div className="space-y-2">
          {currentPlan.meals.map((meal) => (
            <div
              key={meal.id}
              onClick={() => void handleMealToggle(meal.id)}
              className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
            >
              <div>
                <h4 className="text-sm font-semibold text-[#F5F4F0]">{meal.name}</h4>
                <p className="text-[11px] text-[#8E8E94] mt-0.5">
                  {meal.ingredients.join(' · ')}
                </p>
              </div>

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  meal.completed
                    ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                    : 'bg-[#16161A] border-2 border-[#2A2A2F]'
                }`}
              >
                {meal.completed && <Check className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};
