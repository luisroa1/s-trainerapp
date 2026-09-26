import React, { useState } from 'react';
import { ArrowLeft, Share2, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ClientShoppingListProps {
  onBack: () => void;
}

export const ClientShoppingList: React.FC<ClientShoppingListProps> = ({ onBack }) => {
  const { activeClient, nutritionPlans, toggleShoppingItem } = useApp();
  const currentPlan = nutritionPlans[activeClient.id] || nutritionPlans['cli-juan'];
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleShare = () => {
    const textToShare = currentPlan.shoppingList
      .map(cat => `${cat.category}:\n${cat.items.map(i => `• ${i.name}`).join('\n')}`)
      .join('\n\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToShare);
      setToastMessage('¡Lista copiada al portapapeles!');
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              Lista de la compra
            </h2>
            <p className="text-[11px] text-[#8E8E94]">
              Desde tu plan nutricional
            </p>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
          title="Compartir lista"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {toastMessage && (
        <div className="mb-4 p-2.5 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Categorized List */}
      <div className="space-y-5">
        {currentPlan.shoppingList.map((cat, catIdx) => (
          <div key={catIdx}>
            <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2 px-1">
              {cat.category}
            </span>

            <div className="rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] divide-y divide-[#2A2A2F]/50 overflow-hidden">
              {cat.items.map((item, itemIdx) => (
                <div
                  key={itemIdx}
                  onClick={() => toggleShoppingItem(activeClient.id, cat.category, item.name)}
                  className="px-4 py-3.5 flex items-center gap-3.5 cursor-pointer hover:bg-[#232328]/50 transition-colors"
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      item.checked
                        ? 'bg-[var(--accent-color,#CFFF5C)] border-[var(--accent-color,#CFFF5C)] text-[#101012]'
                        : 'border-[#3A3A40] bg-[#16161A]'
                    }`}
                  >
                    {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <span
                    className={`text-sm font-medium ${
                      item.checked ? 'line-through text-[#5C5C62]' : 'text-[#F5F4F0]'
                    }`}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
