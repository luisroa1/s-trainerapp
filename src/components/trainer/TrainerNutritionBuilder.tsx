import React, { useState } from 'react';
import { ArrowLeft, Edit2, Plus, Sparkles, Check, ShoppingCart, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NutritionPlan } from '../../types';

interface TrainerNutritionBuilderProps {
  clientId: string;
  onBack: () => void;
  onSave: () => void;
}

export const TrainerNutritionBuilder: React.FC<TrainerNutritionBuilderProps> = ({
  clientId,
  onBack,
  onSave
}) => {
  const { clients, nutritionPlans, updateNutritionPlan } = useApp();
  const client = clients.find(c => c.id === clientId) || clients[0];
  const initialPlan = nutritionPlans[clientId] || {
    id: `nut-${clientId || 'nuevo'}`,
    clientId: clientId || '',
    clientName: client?.name || 'Cliente',
    objective: client?.objective || 'Pérdida de grasa',
    dietType: 'Omnívora',
    targetKcal: 2000,
    macros: { protein: 140, carbs: 200, fat: 65, fiber: 25, water: 2.5 },
    meals: [],
    shoppingList: []
  };

  const [plan, setPlan] = useState<NutritionPlan>(initialPlan);
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  const [editingIngredientsText, setEditingIngredientsText] = useState('');
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [newMealIngredients, setNewMealIngredients] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Helper to re-derive shopping list items from meals
  const deriveShoppingList = (meals: typeof plan.meals) => {
    const allIngredients = Array.from(
      new Set(meals.flatMap(m => m.ingredients))
    );

    const proteinMatches = ['pollo', 'pavo', 'huevo', 'huevos', 'atún', 'salmón', 'ternera', 'tofu', 'proteína', 'queso fresco'];
    const veggieFruitMatches = ['aguacate', 'espinacas', 'tomate', 'plátano', 'manzana', 'frutos', 'verdura', 'brócoli', 'lechuga'];
    const cerealMatches = ['arroz', 'avena', 'garbanzos', 'lentejas', 'pan', 'pasta', 'quinoa'];
    const fatMatches = ['aceite', 'almendras', 'nueces', 'cacahuete'];
    const dairyMatches = ['yogur', 'leche', 'kéfir', 'queso'];

    const categorized: typeof plan.shoppingList = [
      { category: 'PROTEÍNAS', items: [] },
      { category: 'VERDURA Y FRUTA', items: [] },
      { category: 'CEREALES Y LEGUMBRES', items: [] },
      { category: 'GRASAS SALUDABLES', items: [] },
      { category: 'LÁCTEOS', items: [] }
    ];

    allIngredients.forEach(item => {
      const lower = item.toLowerCase();
      if (proteinMatches.some(p => lower.includes(p))) {
        categorized[0].items.push({ name: item, checked: false });
      } else if (veggieFruitMatches.some(v => lower.includes(v))) {
        categorized[1].items.push({ name: item, checked: false });
      } else if (cerealMatches.some(c => lower.includes(c))) {
        categorized[2].items.push({ name: item, checked: false });
      } else if (fatMatches.some(f => lower.includes(f))) {
        categorized[3].items.push({ name: item, checked: false });
      } else if (dairyMatches.some(d => lower.includes(d))) {
        categorized[4].items.push({ name: item, checked: false });
      } else {
        categorized[0].items.push({ name: item, checked: false });
      }
    });

    return categorized.filter(c => c.items.length > 0);
  };

  const handleSaveMealEdit = (idx: number) => {
    const newIngredients = editingIngredientsText
      .split(/[·,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const updatedMeals = plan.meals.map((m, i) =>
      i === idx ? { ...m, ingredients: newIngredients } : m
    );

    const updatedShopping = deriveShoppingList(updatedMeals);

    setPlan(prev => ({
      ...prev,
      meals: updatedMeals,
      shoppingList: updatedShopping
    }));

    setEditingMealIndex(null);
  };

  const handleAddMeal = () => {
    if (!newMealName.trim()) return;
    const ingredients = newMealIngredients
      .split(/[·,]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const newMeal = {
      id: `m-${Date.now()}`,
      name: newMealName.trim(),
      completed: false,
      ingredients,
      kcalApprox: 400
    };

    const updatedMeals = [...plan.meals, newMeal];
    const updatedShopping = deriveShoppingList(updatedMeals);

    setPlan(prev => ({
      ...prev,
      meals: updatedMeals,
      shoppingList: updatedShopping
    }));

    setNewMealName('');
    setNewMealIngredients('');
    setShowAddMealModal(false);
  };

  const handleDeleteMeal = (idx: number) => {
    const updatedMeals = plan.meals.filter((_, i) => i !== idx);
    const updatedShopping = deriveShoppingList(updatedMeals);
    setPlan(prev => ({
      ...prev,
      meals: updatedMeals,
      shoppingList: updatedShopping
    }));
  };

  const handleSavePlan = (andAssign: boolean) => {
    updateNutritionPlan(client.id, plan);
    setToast(andAssign ? `¡Plan asignado y visible para ${client.name}!` : 'Borrador guardado');
    setTimeout(() => {
      setToast(null);
      onSave();
    }, 1200);
  };

  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
              Plan nutricional — {client.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#F5F4F0] font-semibold">
                {plan.objective}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94]">
                {plan.dietType}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94]">
                {plan.meals.length} comidas
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#CFFF5C]/10 border border-[#CFFF5C]/20 text-[#CFFF5C] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Generado automáticamente
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSavePlan(false)}
            className="px-5 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => handleSavePlan(true)}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="px-6 py-2.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95"
          >
            Guardar y asignar
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
          <Check className="w-4 h-4 stroke-[3]" />
          {toast}
        </div>
      )}

      {/* 2-Column Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: KCAL & Meals */}
        <div className="col-span-2 space-y-6">
          {/* KCAL OBJETIVO & Macros */}
          <div className="p-6 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex items-center gap-8">
            <div className="shrink-0">
              <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
                KCAL OBJETIVO
              </span>
              <span className="text-3xl font-extrabold font-display text-[#F5F4F0]">
                {plan.targetKcal.toLocaleString()} kcal
              </span>
            </div>

            <div className="flex-1 space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8E8E94]">Proteínas</span>
                  <span className="font-bold text-[#F5F4F0]">{plan.macros.protein} g</span>
                </div>
                <div className="w-full h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '80%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8E8E94]">Carbohidratos</span>
                  <span className="font-bold text-[#F5F4F0]">{plan.macros.carbs} g</span>
                </div>
                <div className="w-full h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8E8E94]">Grasas</span>
                  <span className="font-bold text-[#F5F4F0]">{plan.macros.fat} g</span>
                </div>
                <div className="w-full h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent-color,#CFFF5C)] rounded-full" style={{ width: '70%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* COMIDAS DEL DÍA */}
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3 px-1">
              COMIDAS DEL DÍA
            </span>

            <div className="rounded-[16px] bg-[#16161A] border border-[#2A2A2F] divide-y divide-[#2A2A2F]/50 overflow-hidden mb-4">
              {plan.meals.map((meal, idx) => (
                <div key={meal.id} className="p-4 hover:bg-[#1B1B1F] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-[#F5F4F0]">{meal.name}</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMealIndex(idx);
                          setEditingIngredientsText(meal.ingredients.join(' · '));
                        }}
                        className="p-1.5 rounded-lg text-[#8E8E94] hover:text-[#F5F4F0]"
                        title="Editar ingredientes"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {plan.meals.length > 1 && (
                        <button
                          onClick={() => handleDeleteMeal(idx)}
                          className="p-1.5 rounded-lg text-[#8E8E94] hover:text-red-400"
                          title="Eliminar comida"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {editingMealIndex === idx ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingIngredientsText}
                        onChange={e => setEditingIngredientsText(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#101012] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveMealEdit(idx)}
                        style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[#8E8E94]">
                      {meal.ingredients.join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAddMealModal(true)}
              className="w-full py-3.5 rounded-[14px] bg-[#16161A] border-2 border-dashed border-[#2A2A2F] hover:border-[var(--accent-color,#CFFF5C)] text-xs font-bold text-[#8E8E94] hover:text-[#F5F4F0] flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4 text-[var(--accent-color,#CFFF5C)]" />
              <span>Añadir comida</span>
            </button>
          </div>
        </div>

        {/* Right Column: LISTA DE LA COMPRA GENERADA */}
        <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-4 h-4 text-[var(--accent-color,#CFFF5C)]" />
              <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
                LISTA DE LA COMPRA GENERADA
              </span>
            </div>

            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {plan.shoppingList.map((category, catIdx) => (
                <div key={catIdx}>
                  <span className="text-[9.5px] font-bold text-[var(--accent-color,#CFFF5C)] uppercase tracking-wider block mb-1">
                    {category.category}
                  </span>
                  <p className="text-xs text-[#F5F4F0] leading-relaxed">
                    {category.items.map(i => i.name).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-[#5C5C62] pt-4 border-t border-[#2A2A2F]/50 leading-normal">
            Se actualiza sola al editar las comidas. {client.name.split(' ')[0]} la verá en su app, solo con nombres — sin cantidades.
          </p>
        </div>
      </div>

      {/* Add Meal Modal */}
      {showAddMealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-[380px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F4F0] mb-4">
              Añadir nueva comida
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Nombre (ej: Merienda, Pre-entreno)</label>
                <input
                  type="text"
                  value={newMealName}
                  onChange={e => setNewMealName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Ingredientes (separados por punto o coma)</label>
                <input
                  type="text"
                  placeholder="Batido de proteína · Frutos secos"
                  value={newMealIngredients}
                  onChange={e => setNewMealIngredients(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddMealModal(false)}
                className="flex-1 py-2 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#8E8E94]"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMeal}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-2 rounded-full font-bold text-xs"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
