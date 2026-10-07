import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NutritionMealSnapshot, NutritionPlanSnapshot } from '../../types';

interface TrainerNutritionBuilderProps {
  clientId: string;
  onBack: () => void;
  onSave: () => void;
}

const newId = () => globalThis.crypto.randomUUID();
const emptySnapshot = (): NutritionPlanSnapshot => ({
  schema_version: 1,
  plan_name: '',
  objective: null,
  target_kcal: null,
  targets: { protein_g: null, carbohydrate_g: null, fat_g: null, fiber_g: null, water_l: null },
  meals: [],
  notes: null,
});

const numberOrNull = (value: string) => value.trim() === '' ? null : Number(value);
const numberInput = (value: number | null) => value === null ? '' : String(value);

export const TrainerNutritionBuilder: React.FC<TrainerNutritionBuilderProps> = ({ clientId, onBack, onSave }) => {
  const { clients, nutritionPlans, nutritionPlanStatus, saveNutritionPlanDraft, applyNutritionPlan } = useApp();
  const client = clients.find(candidate => candidate.id === clientId);
  const savedDraft = nutritionPlans[clientId];
  const [planId, setPlanId] = useState<string | null>(savedDraft?.id || null);
  const [snapshot, setSnapshot] = useState<NutritionPlanSnapshot>(() => savedDraft?.snapshot || emptySnapshot());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    if (savedDraft) {
      setPlanId(savedDraft.id);
      setSnapshot(savedDraft.snapshot);
    }
  }, [savedDraft?.id]);

  const updateSnapshot = (update: (previous: NutritionPlanSnapshot) => NutritionPlanSnapshot) => {
    requestKey.current = null;
    setSnapshot(update);
  };

  const updateTarget = (key: 'protein_g' | 'carbohydrate_g' | 'fat_g' | 'fiber_g' | 'water_l', value: string) => {
    updateSnapshot(previous => ({ ...previous, targets: { ...previous.targets, [key]: numberOrNull(value) } }));
  };

  const addMeal = () => {
    const meal: NutritionMealSnapshot = {
      id: newId(), name: '', order: snapshot.meals.length + 1,
      description: null, notes: null, items: [],
    };
    updateSnapshot(previous => ({ ...previous, meals: [...previous.meals, meal] }));
  };

  const addItem = (mealId: string) => updateSnapshot(previous => ({
    ...previous,
    meals: previous.meals.map(meal => meal.id !== mealId ? meal : {
      ...meal,
      items: [...meal.items, {
        id: newId(), label: '', description: null, quantity: null, unit: null,
        nutrients: null, notes: null, alternatives: [],
      }],
    }),
  }));

  const valid = useMemo(() => {
    if (!snapshot.plan_name.trim()) return false;
    const numbers = [snapshot.target_kcal, ...Object.values(snapshot.targets)];
    if (numbers.some(value => value !== null && (!Number.isFinite(value) || value < 0))) return false;
    return snapshot.meals.every(meal => meal.name.trim().length > 0 && meal.items.every(item =>
      item.label.trim().length > 0 && (item.quantity === null || (Number.isFinite(item.quantity) && item.quantity >= 0))
      && (!item.nutrients || Object.values(item.nutrients).every(value => value === null || (Number.isFinite(value) && value >= 0)))
    ));
  }, [snapshot]);

  const handleSave = async (assign: boolean) => {
    if (!client) {
      setSaveError('No se encontró el cliente seleccionado.');
      return;
    }
    if (!valid) {
      setSaveError('Completa el nombre del plan, de cada comida y de cada alimento; los valores numéricos deben ser válidos.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const savedId = await saveNutritionPlanDraft(client.id, planId, snapshot);
      setPlanId(savedId);
      if (assign) {
        requestKey.current ||= newId();
        await applyNutritionPlan(savedId, requestKey.current);
        requestKey.current = null;
        setNotice('Prescripción guardada y asignada.');
      } else {
        setNotice('Borrador guardado.');
      }
      onSave();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo confirmar la operación.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!client) return <div role="alert" className="p-8 text-sm text-red-300">No se encontró el cliente seleccionado.</div>;

  const inputClass = 'w-full rounded-lg border border-[#2A2A2F] bg-[#101012] px-3 py-2 text-sm text-[#F5F4F0]';
  const labelClass = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8E8E94]';

  return (
    <main className="mx-auto max-w-5xl p-6 pb-24 text-[#F5F4F0]">
      <header className="mb-6 flex items-center gap-4">
        <button onClick={onBack} aria-label="Volver" className="rounded-full border border-[#2A2A2F] p-2 text-[#8E8E94]"><ArrowLeft className="h-5 w-5" /></button>
        <div><h1 className="text-2xl font-bold">Prescripción nutricional — {client.name}</h1><p className="mt-1 text-xs text-[#8E8E94]">Los campos vacíos permanecen sin dato.</p></div>
      </header>

      {nutritionPlanStatus === 'loading' && <p className="mb-4 text-sm text-[#8E8E94]">Cargando borrador guardado…</p>}
      <section className="mb-6 grid gap-4 rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5 md:grid-cols-2">
        <label><span className={labelClass}>Nombre del plan</span><input className={inputClass} value={snapshot.plan_name} onChange={event => updateSnapshot(prev => ({ ...prev, plan_name: event.target.value }))} /></label>
        <label><span className={labelClass}>Objetivo (opcional)</span><input className={inputClass} value={snapshot.objective || ''} onChange={event => updateSnapshot(prev => ({ ...prev, objective: event.target.value || null }))} /></label>
        <label><span className={labelClass}>Energía objetivo · kcal (opcional)</span><input className={inputClass} type="number" min="0" value={numberInput(snapshot.target_kcal)} onChange={event => updateSnapshot(prev => ({ ...prev, target_kcal: numberOrNull(event.target.value) }))} /></label>
        {([
          ['protein_g', 'Proteína · g'], ['carbohydrate_g', 'Carbohidratos · g'], ['fat_g', 'Grasa · g'], ['fiber_g', 'Fibra · g'], ['water_l', 'Agua · l'],
        ] as const).map(([key, label]) => <label key={key}><span className={labelClass}>{label} (opcional)</span><input className={inputClass} type="number" min="0" value={numberInput(snapshot.targets[key])} onChange={event => updateTarget(key, event.target.value)} /></label>)}
        <label className="md:col-span-2"><span className={labelClass}>Notas del plan (opcional)</span><textarea className={inputClass} value={snapshot.notes || ''} onChange={event => updateSnapshot(prev => ({ ...prev, notes: event.target.value || null }))} /></label>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Comidas pautadas</h2><button onClick={addMeal} className="flex items-center gap-2 rounded-full border border-[#3A3A40] px-3 py-2 text-xs"><Plus className="h-4 w-4" /> Añadir comida</button></div>
        {snapshot.meals.length === 0 && <p className="rounded-xl border border-dashed border-[#3A3A40] p-5 text-sm text-[#8E8E94]">Sin comidas registradas todavía.</p>}
        {snapshot.meals.map((meal, mealIndex) => <article key={meal.id} className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5">
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_120px_auto]">
            <label><span className={labelClass}>Nombre</span><input className={inputClass} value={meal.name} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map((item, index) => index === mealIndex ? { ...item, name: event.target.value } : item) }))} /></label>
            <label><span className={labelClass}>Orden</span><input className={inputClass} type="number" min="1" value={meal.order} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map((item, index) => index === mealIndex ? { ...item, order: Number(event.target.value) } : item) }))} /></label>
            <button aria-label="Eliminar comida" onClick={() => updateSnapshot(prev => ({ ...prev, meals: prev.meals.filter(item => item.id !== meal.id).map((item, index) => ({ ...item, order: index + 1 })) }))} className="self-end rounded-lg p-2 text-[#8E8E94]"><Trash2 className="h-4 w-4" /></button>
          </div>
          <label className="mb-4 block"><span className={labelClass}>Descripción (opcional)</span><input className={inputClass} value={meal.description || ''} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(item => item.id === meal.id ? { ...item, description: event.target.value || null } : item) }))} /></label>
          <label className="mb-4 block"><span className={labelClass}>Notas (opcional)</span><input className={inputClass} value={meal.notes || ''} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(item => item.id === meal.id ? { ...item, notes: event.target.value || null } : item) }))} /></label>
          <div className="space-y-3">
            {meal.items.map(item => <div key={item.id} className="grid gap-2 rounded-xl bg-[#101012] p-3 md:grid-cols-[2fr_100px_110px_1fr_auto]">
              <label><span className={labelClass}>Alimento / ítem</span><input className={inputClass} value={item.label} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, label: event.target.value } : i) : m.items })) }))} /></label>
              <label><span className={labelClass}>Cantidad</span><input className={inputClass} type="number" min="0" value={numberInput(item.quantity)} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, quantity: numberOrNull(event.target.value) } : i) : m.items })) }))} /></label>
              <label><span className={labelClass}>Unidad</span><input className={inputClass} value={item.unit || ''} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, unit: event.target.value || null } : i) : m.items })) }))} /></label>
              <label><span className={labelClass}>Nota (opcional)</span><input className={inputClass} value={item.notes || ''} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, notes: event.target.value || null } : i) : m.items })) }))} /></label>
              <button aria-label="Eliminar alimento" onClick={() => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => m.id === meal.id ? { ...m, items: m.items.filter(i => i.id !== item.id) } : m) }))} className="self-end rounded-lg p-2 text-[#8E8E94]"><Trash2 className="h-4 w-4" /></button>
              <label className="md:col-span-2"><span className={labelClass}>Descripción (opcional)</span><input className={inputClass} value={item.description || ''} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, description: event.target.value || null } : i) : m.items })) }))} /></label>
              <label className="md:col-span-3"><span className={labelClass}>Alternativas (separadas por coma, opcional)</span><input className={inputClass} value={item.alternatives.join(', ')} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, alternatives: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } : i) : m.items })) }))} /></label>
              <div className="grid grid-cols-2 gap-2 md:col-span-5 lg:grid-cols-5">
                {([
                  ['energy_kcal', 'Kcal'], ['protein_g', 'Proteína · g'], ['carbohydrate_g', 'Carbohidratos · g'], ['fat_g', 'Grasa · g'], ['fiber_g', 'Fibra · g'],
                ] as const).map(([key, title]) => <label key={key}><span className={labelClass}>{title} (opcional)</span><input className={inputClass} type="number" min="0" value={numberInput(item.nutrients?.[key] ?? null)} onChange={event => updateSnapshot(prev => ({ ...prev, meals: prev.meals.map(m => ({ ...m, items: m.id === meal.id ? m.items.map(i => i.id === item.id ? { ...i, nutrients: { energy_kcal: null, protein_g: null, carbohydrate_g: null, fat_g: null, fiber_g: null, ...i.nutrients, [key]: numberOrNull(event.target.value) } } : i) : m.items })) }))} /></label>)}
              </div>
            </div>)}
            <button onClick={() => addItem(meal.id)} className="rounded-full border border-dashed border-[#3A3A40] px-3 py-2 text-xs text-[#CFFF5C]">Añadir alimento</button>
          </div>
        </article>)}
      </section>

      {saveError && <p role="alert" className="mt-5 rounded-lg bg-red-950 p-3 text-sm text-red-200">No se confirmó la operación: {saveError}</p>}
      {notice && <p role="status" className="mt-5 rounded-lg bg-[#CFFF5C]/10 p-3 text-sm text-[#CFFF5C]">{notice}</p>}
      <footer className="mt-7 flex justify-end gap-3">
        <button disabled={isSaving} onClick={() => void handleSave(false)} className="rounded-full border border-[#3A3A40] px-5 py-3 text-sm disabled:opacity-50">Guardar borrador</button>
        <button disabled={isSaving || !valid} onClick={() => void handleSave(true)} className="rounded-full bg-[#CFFF5C] px-5 py-3 text-sm font-bold text-[#101012] disabled:opacity-50">Guardar y asignar</button>
      </footer>
    </main>
  );
};
