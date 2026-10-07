import React from 'react';
import { useApp } from '../../context/AppContext';
import { NutritionItemSnapshot } from '../../types';

const show = (value: number | null | undefined, suffix: string) => value == null ? 'Sin dato' : `${value} ${suffix}`;

const NutritionItem: React.FC<{ item: NutritionItemSnapshot }> = ({ item }) => (
  <li className="rounded-xl bg-[#101012] p-3">
    <p className="text-sm font-semibold">{item.label}</p>
    {(item.quantity !== null || item.unit) && <p className="mt-1 text-xs text-[#CFFF5C]">{item.quantity === null ? 'Cantidad sin dato' : item.quantity}{item.unit ? ` ${item.unit}` : ''}</p>}
    {item.description && <p className="mt-1 text-xs text-[#8E8E94]">{item.description}</p>}
    {item.notes && <p className="mt-1 text-xs text-[#8E8E94]">{item.notes}</p>}
    {item.nutrients && <p className="mt-2 text-[11px] text-[#8E8E94]">Pautado: {show(item.nutrients.energy_kcal, 'kcal')} · proteína {show(item.nutrients.protein_g, 'g')} · carbohidratos {show(item.nutrients.carbohydrate_g, 'g')} · grasa {show(item.nutrients.fat_g, 'g')} · fibra {show(item.nutrients.fiber_g, 'g')}</p>}
    {item.alternatives.length > 0 && <p className="mt-2 text-xs text-[#8E8E94]">Alternativas pautadas: {item.alternatives.join(', ')}</p>}
  </li>
);

export const ClientNutrition: React.FC = () => {
  const { activeNutritionPlan, nutritionPlanStatus, nutritionPlanError } = useApp();
  const snapshot = activeNutritionPlan?.snapshot;

  return (
    <main className="min-h-full bg-[#101012] px-5 pb-20 pt-5 text-[#F5F4F0]">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold">Mi prescripción nutricional</h2>
        <p className="mt-1 text-xs text-[#8E8E94]">Información pautada por tu entrenador.</p>
      </header>
      {nutritionPlanStatus === 'loading' && <p role="status" className="text-sm text-[#8E8E94]">Cargando prescripción…</p>}
      {nutritionPlanStatus === 'error' && <p role="alert" className="rounded-xl bg-red-950 p-4 text-sm text-red-200">{nutritionPlanError || 'No se pudo cargar la prescripción.'}</p>}
      {nutritionPlanStatus === 'loaded' && !snapshot && <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5 text-sm text-[#8E8E94]">No tienes una prescripción nutricional activa.</section>}
      {snapshot && <>
        <section className="mb-4 rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5">
          <h3 className="text-lg font-bold">{snapshot.plan_name}</h3>
          {snapshot.objective && <p className="mt-1 text-sm text-[#8E8E94]">{snapshot.objective}</p>}
          <p className="mt-4 text-sm">Energía pautada: {show(snapshot.target_kcal, 'kcal')}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8E8E94]">
            <span>Proteína: {show(snapshot.targets.protein_g, 'g')}</span>
            <span>Carbohidratos: {show(snapshot.targets.carbohydrate_g, 'g')}</span>
            <span>Grasa: {show(snapshot.targets.fat_g, 'g')}</span>
            <span>Fibra: {show(snapshot.targets.fiber_g, 'g')}</span>
            <span>Agua: {show(snapshot.targets.water_l, 'l')}</span>
          </div>
          {snapshot.notes && <p className="mt-3 text-xs text-[#8E8E94]">{snapshot.notes}</p>}
        </section>
        <section className="space-y-4">
          {snapshot.meals.slice().sort((a, b) => a.order - b.order).map(meal => <article key={meal.id} className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-4">
            <h3 className="font-bold">{meal.name}</h3>
            {meal.description && <p className="mt-1 text-xs text-[#8E8E94]">{meal.description}</p>}
            {meal.notes && <p className="mt-1 text-xs text-[#8E8E94]">{meal.notes}</p>}
            {meal.items.length === 0 ? <p className="mt-3 text-xs text-[#8E8E94]">Sin alimentos pautados.</p> : <ul className="mt-3 space-y-2">{meal.items.map(item => <NutritionItem key={item.id} item={item} />)}</ul>}
          </article>)}
        </section>
      </>}
    </main>
  );
};
