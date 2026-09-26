import React, { useState } from 'react';
import { ArrowLeft, Search, Barcode, Plus, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FREQUENT_FOODS } from '../../data/mockData';

interface ClientCalculatorProps {
  onBack: () => void;
}

export const ClientCalculator: React.FC<ClientCalculatorProps> = ({ onBack }) => {
  const { activeClient, addFoodToLog } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItem, setAddedItem] = useState<string | null>(null);

  const filteredFoods = FREQUENT_FOODS.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = (food: typeof FREQUENT_FOODS[0]) => {
    addFoodToLog(activeClient.id, food.name, food.kcal);
    setAddedItem(food.name);
    setTimeout(() => setAddedItem(null), 1800);
  };

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-extrabold font-display text-[#F5F4F0]">
          Calculadora
        </h2>
      </div>

      {/* Main Kcal display */}
      <div className="text-center my-4">
        <span className="text-3xl font-extrabold font-display text-[#F5F4F0]">
          {activeClient.metrics.kcalToday.toLocaleString()}
        </span>
        <span className="text-sm font-semibold text-[#8E8E94] ml-2">
          kcal hoy
        </span>
      </div>

      {/* Search Bar with Barcode Scanner */}
      <div className="relative mb-6">
        <Search className="w-4 h-4 text-[#8E8E94] absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Buscar alimento"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-12 py-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] text-sm text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
        />
        <button
          onClick={() => alert('Escáner de código de barras activado')}
          className="absolute right-3.5 top-3 text-[var(--accent-color,#CFFF5C)] hover:opacity-80"
          title="Escanear código de barras"
        >
          <Barcode className="w-5 h-5" />
        </button>
      </div>

      {/* Toast */}
      {addedItem && (
        <div className="mb-4 p-2 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4 stroke-[3]" />
          Añadido: {addedItem}
        </div>
      )}

      {/* Frecuentes Section */}
      <div>
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3">
          FRECUENTES
        </span>

        <div className="space-y-2">
          {filteredFoods.map(food => (
            <div
              key={food.id}
              className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-[#F5F4F0]">{food.name}</h4>
                <p className="text-[11px] text-[#8E8E94] mt-0.5">{food.kcal} kcal</p>
              </div>

              <button
                onClick={() => handleAdd(food)}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform"
                title="Añadir a ingesta de hoy"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
