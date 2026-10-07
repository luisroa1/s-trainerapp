import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NutritionAssignmentContext, NutritionItemSnapshot, NutritionLogEvent, NutritionLogEventInput, NutritionLogEventType, NutritionLogItemInput } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabaseDb } from '../../lib/supabase';
import { nutritionDateForInstant, nutritionDeclarationLabel } from '../../lib/nutritionLogModel.mjs';
import { reconstructNutritionDay } from '../../lib/nutritionPlannedLoggedModel';
import { prepareNutritionLogRequest } from '../../lib/nutritionLogRequest.mjs';

const show = (value: number | null | undefined, suffix: string) => value == null ? 'Sin dato' : `${value} ${suffix}`;
const timezoneId = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const asNullableNumber = (value: string) => value.trim() === '' ? null : Number(value);
const valueOrBlank = (value: number | null | undefined) => value == null ? '' : String(value);

type ChangeDraft = { operation: 'unchanged' | 'change_quantity' | 'removed' | 'substituted'; quantity: string; unit: string; label: string; nutrients: Record<string, string> };
const emptyNutrients = () => ({ energy_kcal: '', protein_g: '', carbohydrate_g: '', fat_g: '', fiber_g: '' });
const itemNutrientsInput = (nutrients: Record<string, string>) => ({
  energy_kcal: asNullableNumber(nutrients.energy_kcal), protein_g: asNullableNumber(nutrients.protein_g),
  carbohydrate_g: asNullableNumber(nutrients.carbohydrate_g), fat_g: asNullableNumber(nutrients.fat_g), fiber_g: asNullableNumber(nutrients.fiber_g),
});

const InputClass = 'w-full rounded-lg border border-[#34343A] bg-[#101012] px-3 py-2 text-xs text-[#F5F4F0]';

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

const NutrientFields: React.FC<{ values: Record<string, string>; onChange: (values: Record<string, string>) => void }> = ({ values, onChange }) => (
  <details className="mt-2 text-[11px] text-[#8E8E94]">
    <summary className="cursor-pointer">Añadir nutrientes conocidos (opcional)</summary>
    <div className="mt-2 grid grid-cols-2 gap-2">
      {([['energy_kcal', 'kcal'], ['protein_g', 'Proteína g'], ['carbohydrate_g', 'Carbohidratos g'], ['fat_g', 'Grasa g'], ['fiber_g', 'Fibra g']] as const).map(([key, label]) => (
        <label key={key}>{label}<input aria-label={label} className={`${InputClass} mt-1`} inputMode="decimal" value={values[key]} onChange={event => onChange({ ...values, [key]: event.target.value })} /></label>
      ))}
    </div>
    <p className="mt-1">Son contribuciones para la cantidad indicada. Deja vacío lo que no conozcas.</p>
  </details>
);

export const ClientNutrition: React.FC = () => {
  const { activeNutritionPlan, nutritionPlanStatus, nutritionPlanError } = useApp();
  const snapshot = activeNutritionPlan?.snapshot;
  const tz = useMemo(timezoneId, []);
  const [today, setToday] = useState(() => nutritionDateForInstant(new Date(), tz));
  const [events, setEvents] = useState<NutritionLogEvent[]>([]);
  const [assignments, setAssignments] = useState<NutritionAssignmentContext[]>([]);
  const [logStatus, setLogStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [logError, setLogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [editMealId, setEditMealId] = useState<string | null>(null);
  const [changesByMeal, setChangesByMeal] = useState<Record<string, Record<string, ChangeDraft>>>({});
  const [newItemsByMeal, setNewItemsByMeal] = useState<Record<string, Array<{ label: string; quantity: string; unit: string; nutrients: Record<string, string>; note: string }>>>({});
  const [mealNotes, setMealNotes] = useState<Record<string, string>>({});
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraLabel, setExtraLabel] = useState('');
  const [extraQuantity, setExtraQuantity] = useState('');
  const [extraUnit, setExtraUnit] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [extraNutrients, setExtraNutrients] = useState(emptyNutrients());
  const pendingRequest = useRef<{ request_key: string; fingerprint: string; occurred_at: string; nutrition_date: string; timezone_id: string } | null>(null);

  const refreshLogs = useCallback(async (date = today) => {
    setLogStatus('loading');
    setLogError(null);
    const { data, error } = await supabaseDb.getClientNutritionLogDay(date);
    if (error || !data) {
      setEvents([]);
      setAssignments([]);
      setLogStatus('error');
      setLogError('No se pudieron cargar tus declaraciones nutricionales.');
      return false;
    }
    setEvents(data.events);
    setAssignments(data.assignments);
    setLogStatus('loaded');
    return true;
  }, [today]);

  useEffect(() => { void refreshLogs(); }, [refreshLogs]);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(nutritionDateForInstant(new Date(), tz)), 60_000);
    return () => window.clearInterval(timer);
  }, [tz]);

  const submit = async (eventType: NutritionLogEventType, assignmentId: string | null, mealId: string | null, supersedesId: string | null, items: NutritionLogItemInput[] = [], note: string | null = null) => {
    const prepared = prepareNutritionLogRequest({ pending: pendingRequest.current, createKey: () => crypto.randomUUID(), eventType, assignmentId, mealId, supersedesId, items, note, today, timezoneId: tz });
    const input: NutritionLogEventInput = prepared.request;
    const nutritionDate = input.nutrition_date;
    pendingRequest.current = prepared.pending;
    setSaving(true);
    setLogError(null);
    setSuccess(null);
    try {
      const { data, error } = await supabaseDb.recordNutritionLogEvent(input);
      if (error || !data?.event?.id) throw error || new Error('Supabase no confirmó la declaración.');
      pendingRequest.current = null;
      // The RPC response confirms persistence; refresh rehydrates item details and correction chains.
      setSuccess('Declaración guardada. Es tu registro y no una verificación objetiva de ingesta.');
      await refreshLogs(nutritionDate);
      setEditMealId(null);
      setExtraOpen(false);
      if (eventType === 'EXTRA') { setExtraLabel(''); setExtraQuantity(''); setExtraUnit(''); setExtraNote(''); setExtraNutrients(emptyNutrients()); }
    } catch (error) {
      console.warn('Nutrition declaration could not be confirmed:', error);
      setLogError('No se pudo confirmar el guardado. Conservamos lo que has introducido para que puedas reintentar.');
    } finally {
      setSaving(false);
    }
  };

  const reconstruction = useMemo(() => reconstructNutritionDay({
    nutritionDate: today,
    assignments,
    events,
  }), [assignments, events, today]);
  const sortedMeals = reconstruction.meals.filter(row => row.meal).sort((a, b) => a.meal!.order - b.meal!.order);

  return (
    <main className="min-h-full bg-[#101012] px-5 pb-20 pt-5 text-[#F5F4F0]">
      <header className="mb-5">
        <h2 className="text-2xl font-extrabold">Mi prescripción nutricional</h2>
        <p className="mt-1 text-xs text-[#8E8E94]">Información pautada por tu entrenador.</p>
        <p className="mt-1 text-[11px] text-[#8E8E94]">Los registros son declaraciones tuyas; la aplicación no verifica objetivamente lo ingerido.</p>
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
            <span>Proteína: {show(snapshot.targets.protein_g, 'g')}</span><span>Carbohidratos: {show(snapshot.targets.carbohydrate_g, 'g')}</span>
            <span>Grasa: {show(snapshot.targets.fat_g, 'g')}</span><span>Fibra: {show(snapshot.targets.fiber_g, 'g')}</span><span>Agua: {show(snapshot.targets.water_l, 'l')}</span>
          </div>
          {snapshot.notes && <p className="mt-3 text-xs text-[#8E8E94]">{snapshot.notes}</p>}
        </section>
        <section className="space-y-4">
          {sortedMeals.map(reconstructed => {
            const meal = reconstructed.meal!;
            const declaration = reconstructed?.declaration || null;
            const isEditing = editMealId === meal.id;
            const baseChanges: Record<string, ChangeDraft> = Object.fromEntries(meal.items.map(item => [item.id, { operation: 'unchanged', quantity: valueOrBlank(item.quantity), unit: item.unit || '', label: '', nutrients: emptyNutrients() }]));
            const changes = { ...baseChanges, ...(changesByMeal[meal.id] || {}) };
            const newItems = newItemsByMeal[meal.id] || [];
            const mealNote = mealNotes[meal.id] || '';
            const setNewItems = (update: (items: Array<{ label: string; quantity: string; unit: string; nutrients: Record<string, string>; note: string }>) => Array<{ label: string; quantity: string; unit: string; nutrients: Record<string, string>; note: string }>) => setNewItemsByMeal(prev => ({ ...prev, [meal.id]: update(prev[meal.id] || []) }));
            const itemInputs: NutritionLogItemInput[] = [];
            for (const item of meal.items) {
                const change = changes[item.id];
                if (!change || change.operation === 'unchanged') continue;
                if (change.operation === 'removed') itemInputs.push({ operation: 'removed', planned_item_id: item.id });
                else if (change.operation === 'change_quantity') itemInputs.push({ operation: 'change_quantity', planned_item_id: item.id, quantity: asNullableNumber(change.quantity), unit: change.unit || null, ...itemNutrientsInput(change.nutrients) });
                else itemInputs.push({ operation: 'substituted', planned_item_id: item.id, label: change.label.trim(), quantity: asNullableNumber(change.quantity), unit: change.unit || null, ...itemNutrientsInput(change.nutrients) });
            }
            itemInputs.push(...newItems.filter(item => item.label.trim()).map(item => ({ operation: 'added' as const, label: item.label.trim(), quantity: asNullableNumber(item.quantity), unit: item.unit || null, ...itemNutrientsInput(item.nutrients), note: item.note || null })));
            const setChange = (itemId: string, partial: Partial<ChangeDraft>) => setChangesByMeal(prev => ({ ...prev, [meal.id]: { ...(prev[meal.id] || baseChanges), [itemId]: { ...((prev[meal.id] || baseChanges)[itemId] || baseChanges[itemId]), ...partial } } }));
            const openEditor = () => {
              const nextChanges = { ...baseChanges };
              const nextAdded: Array<{ label: string; quantity: string; unit: string; nutrients: Record<string, string>; note: string }> = [];
              for (const row of reconstructed?.items || []) {
                const item = row.logged;
                if (!item) continue;
                const nutrients = Object.fromEntries(['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g'].map(key => [key, valueOrBlank(item[key as keyof typeof item] as number | null)]));
                if (row.kind === 'added') {
                  nextAdded.push({ label: item.label || '', quantity: valueOrBlank(item.quantity), unit: item.unit || '', nutrients, note: item.note || '' });
                } else if (item.planned_item_id && nextChanges[item.planned_item_id]) {
                  const operation: ChangeDraft['operation'] = row.kind === 'quantity_changed' ? 'change_quantity' : row.kind;
                  nextChanges[item.planned_item_id] = {
                    operation,
                    quantity: valueOrBlank(item.quantity),
                    unit: item.unit || '',
                    label: item.label || '',
                    nutrients,
                  };
                }
              }
              setChangesByMeal(prev => ({ ...prev, [meal.id]: nextChanges }));
              setNewItemsByMeal(prev => ({ ...prev, [meal.id]: nextAdded }));
              setMealNotes(prev => ({ ...prev, [meal.id]: declaration?.note || '' }));
              setEditMealId(meal.id);
            };
            return <article key={`${reconstructed.assignmentId || 'unknown'}-${meal.id}`} className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-4">
              <h3 className="font-bold">{meal.name}</h3>
              {reconstructed?.assignmentId !== activeNutritionPlan?.assignmentId && reconstructed?.planName && <p className="mt-1 text-[11px] text-[#8E8E94]">Prescripción histórica: {reconstructed.planName}</p>}
              {meal.description && <p className="mt-1 text-xs text-[#8E8E94]">{meal.description}</p>}
              {meal.notes && <p className="mt-1 text-xs text-[#8E8E94]">{meal.notes}</p>}
              {meal.items.length === 0 ? <p className="mt-3 text-xs text-[#8E8E94]">Sin alimentos pautados.</p> : <ul className="mt-3 space-y-2">{meal.items.map(item => <NutritionItem key={item.id} item={item} />)}</ul>}
              <p className="mt-3 text-xs text-[#8E8E94]">{reconstructed?.state === 'HISTORICAL_CONTEXT_UNAVAILABLE' ? 'Contexto histórico no disponible' : declaration ? nutritionDeclarationLabel(declaration.event_type) : reconstructed?.state === 'UNLOGGED' ? 'Sin registro' : 'Contexto histórico no disponible'}</p>
              {reconstructed?.state === 'MODIFIED' && <ul className="mt-2 space-y-1 text-xs text-[#C2C2C7]">{reconstructed.items.map((row, index) => {
                if (row.kind === 'unchanged') return <li key={row.planned?.id || index}>{row.planned?.label}: según lo pautado</li>;
                if (row.kind === 'removed') return <li key={row.planned?.id || index}>Retiró {row.planned?.label}</li>;
                if (row.kind === 'substituted') return <li key={row.planned?.id || index}>Sustituyó {row.planned?.label} por {row.logged?.label || 'un alimento'}</li>;
                if (row.kind === 'added') return <li key={row.logged?.id || index}>Añadió {row.logged?.label || 'un alimento'} · {row.logged?.quantity == null ? 'cantidad sin dato' : `${row.logged.quantity}${row.logged.unit ? ` ${row.logged.unit}` : ''}`}</li>;
                return <li key={row.planned?.id || index}>Cambió {row.planned?.label} de {row.planned?.quantity == null ? 'cantidad sin dato' : `${row.planned.quantity}${row.planned.unit ? ` ${row.planned.unit}` : ''}`} a {row.logged?.quantity == null ? 'cantidad sin dato' : `${row.logged.quantity}${row.logged.unit ? ` ${row.logged.unit}` : ''}`}</li>;
              })}</ul>}
              {!declaration && reconstructed?.state !== 'HISTORICAL_CONTEXT_UNAVAILABLE' && <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={saving || !reconstructed.assignmentId || logStatus !== 'loaded'} onClick={() => reconstructed.assignmentId && void submit('AS_PLANNED', reconstructed.assignmentId, meal.id, null)} className="rounded-full bg-[#CFFF5C] px-3 py-2 text-xs font-bold text-[#101012] disabled:opacity-50">Hecho según el plan</button>
                <button disabled={saving || !activeNutritionPlan || logStatus !== 'loaded'} onClick={openEditor} className="rounded-full border border-[#34343A] px-3 py-2 text-xs disabled:opacity-50">Registrar cambios</button>
                <button disabled={saving || !reconstructed.assignmentId || logStatus !== 'loaded'} onClick={() => reconstructed.assignmentId && void submit('SKIPPED', reconstructed.assignmentId, meal.id, null)} className="rounded-full border border-[#34343A] px-3 py-2 text-xs text-[#C2C2C7] disabled:opacity-50">No la hice</button>
              </div>}
              {declaration && <button disabled={saving || logStatus !== 'loaded'} onClick={openEditor} className="mt-2 rounded-full border border-[#34343A] px-3 py-2 text-xs disabled:opacity-50">Corregir declaración</button>}
              {isEditing && <div className="mt-4 space-y-3 rounded-xl border border-[#34343A] p-3">
                <p className="text-xs text-[#C2C2C7]">Registra solo los cambios. Los elementos que no modifiques quedarán declarados como realizados según el plan.</p>
                <div className="flex flex-wrap gap-2">
                  {(['AS_PLANNED', 'MODIFIED', 'SKIPPED'] as const).map(type => <button key={type} disabled={saving} onClick={() => {
                    if (!reconstructed.assignmentId) return;
                    if (type === 'MODIFIED') return;
                    void submit(type, reconstructed.assignmentId, meal.id, declaration?.id || null);
                  }} className="rounded-full border border-[#34343A] px-3 py-2 text-xs">{type === 'AS_PLANNED' ? 'Hecho según el plan' : type === 'SKIPPED' ? 'No la hice' : 'Registrar cambios'}</button>)}
                </div>
                {meal.items.map(item => {
                  const change = changes[item.id] || baseChanges[item.id];
                  return <div key={item.id} className="rounded-lg bg-[#101012] p-3">
                    <p className="text-xs font-semibold">{item.label}</p>
                    <select aria-label={`Cambio para ${item.label}`} className={`${InputClass} mt-2`} value={change.operation} onChange={event => setChange(item.id, { operation: event.target.value as ChangeDraft['operation'] })}>
                      <option value="unchanged">Sin cambios</option><option value="change_quantity">Cambiar cantidad</option><option value="removed">Retirar</option><option value="substituted">Sustituir</option>
                    </select>
                    {['change_quantity', 'substituted'].includes(change.operation) && <div className="mt-2 grid grid-cols-2 gap-2">
                      {change.operation === 'substituted' && <input aria-label={`Sustituto para ${item.label}`} className={InputClass} placeholder="Alimento sustituto" value={change.label} onChange={event => setChange(item.id, { label: event.target.value })} />}
                      <input aria-label={`Cantidad para ${item.label}`} className={InputClass} inputMode="decimal" placeholder="Cantidad (opcional)" value={change.quantity} onChange={event => setChange(item.id, { quantity: event.target.value })} />
                      <input aria-label={`Unidad para ${item.label}`} className={InputClass} placeholder="Unidad (opcional)" value={change.unit} onChange={event => setChange(item.id, { unit: event.target.value })} />
                    </div>}
                    {['change_quantity', 'substituted'].includes(change.operation) && <NutrientFields values={change.nutrients} onChange={nutrients => setChange(item.id, { nutrients })} />}
                  </div>;
                })}
                {newItems.map((item, index) => <div key={index} className="rounded-lg bg-[#101012] p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <input className={`${InputClass} col-span-3`} aria-label="Alimento añadido" placeholder="Alimento añadido" value={item.label} onChange={event => setNewItems(prev => prev.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} />
                    <input className={InputClass} aria-label="Cantidad del alimento añadido" placeholder="Cantidad" inputMode="decimal" value={item.quantity} onChange={event => setNewItems(prev => prev.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} />
                    <input className={InputClass} aria-label="Unidad del alimento añadido" placeholder="Unidad" value={item.unit} onChange={event => setNewItems(prev => prev.map((row, i) => i === index ? { ...row, unit: event.target.value } : row))} />
                    <input className={InputClass} aria-label="Nota del alimento añadido" placeholder="Nota" value={item.note} onChange={event => setNewItems(prev => prev.map((row, i) => i === index ? { ...row, note: event.target.value } : row))} />
                  </div>
                  <NutrientFields values={item.nutrients} onChange={nutrients => setNewItems(prev => prev.map((row, i) => i === index ? { ...row, nutrients } : row))} />
                </div>)}
                <button onClick={() => setNewItems(prev => [...prev, { label: '', quantity: '', unit: '', nutrients: emptyNutrients(), note: '' }])} className="rounded-full border border-[#34343A] px-3 py-2 text-xs">Añadir alimento</button>
                <input className={InputClass} aria-label="Nota de la declaración" placeholder="Nota opcional" value={mealNote} onChange={event => setMealNotes(prev => ({ ...prev, [meal.id]: event.target.value }))} />
                <div className="flex gap-2">
                  <button disabled={saving || !reconstructed.assignmentId || itemInputs.length === 0 || itemInputs.some(item => (item.operation === 'substituted' || item.operation === 'added') && !item.label?.trim()) || itemInputs.some(item => item.operation === 'change_quantity' && item.quantity == null)} onClick={() => reconstructed.assignmentId && void submit('MODIFIED', reconstructed.assignmentId, meal.id, declaration?.id || null, itemInputs, mealNote || null)} className="rounded-full bg-[#CFFF5C] px-3 py-2 text-xs font-bold text-[#101012] disabled:opacity-40">Guardar cambios</button>
                  <button onClick={() => setEditMealId(null)} className="rounded-full border border-[#34343A] px-3 py-2 text-xs">Cancelar</button>
                </div>
              </div>}
            </article>;
          })}
        </section>
      </>}
      {!snapshot && reconstruction.meals.length > 0 && <section className="space-y-3">
        <h3 className="text-base font-bold">Declaraciones vinculadas a la prescripción histórica</h3>
        {reconstruction.meals.map((row, index) => <article key={`${row.assignmentId || 'unknown'}-${row.mealId || index}`} className="rounded-xl border border-[#2A2A2F] bg-[#16161A] p-4">
          <h4 className="text-sm font-semibold">{row.planName ? `${row.planName} · ` : ''}{row.meal?.name || 'Comida pautada'}</h4>
          <p className="mt-1 text-xs text-[#8E8E94]">{row.state === 'AS_PLANNED' ? 'Hecho según el plan — declarado por ti' : row.state === 'MODIFIED' ? 'Modificado — declarado por ti' : row.state === 'SKIPPED' ? 'No realizada — declarado por ti' : row.state === 'UNLOGGED' ? 'Sin registro' : 'Contexto histórico no disponible'}</p>
          {row.meal && <ul className="mt-2 space-y-1 text-xs text-[#C2C2C7]">{row.meal.items.map(item => <li key={item.id}>{item.label} · {item.quantity == null ? 'cantidad sin dato' : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`}</li>)}</ul>}
          {row.state === 'MODIFIED' && <ul className="mt-2 space-y-1 text-xs text-[#C2C2C7]">{row.items.map((item, itemIndex) => <li key={item.planned?.id || item.logged?.id || itemIndex}>{item.kind === 'unchanged' ? `${item.planned?.label}: según lo pautado` : item.kind === 'removed' ? `Retiró ${item.planned?.label}` : item.kind === 'substituted' ? `Sustituyó ${item.planned?.label} por ${item.logged?.label || 'un elemento'}` : item.kind === 'added' ? `Añadió ${item.logged?.label || 'un elemento'}` : `Cambió ${item.planned?.label} a ${item.logged?.quantity == null ? 'cantidad sin dato' : `${item.logged.quantity}${item.logged.unit ? ` ${item.logged.unit}` : ''}`}`}</li>)}</ul>}
        </article>)}
      </section>}
      <section className="mt-5 rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-4">
        <h3 className="font-bold">Algo fuera del plan</h3>
        <p className="mt-1 text-xs text-[#8E8E94]">Registra lo que declaras haber añadido. No inferimos nutrientes por el nombre.</p>
        {!extraOpen ? <button onClick={() => setExtraOpen(true)} className="mt-3 rounded-full border border-[#34343A] px-3 py-2 text-xs">Añadir algo extra</button> : <div className="mt-3 space-y-2">
          <input className={InputClass} aria-label="Descripción del extra" placeholder="¿Qué añadiste?" value={extraLabel} onChange={event => setExtraLabel(event.target.value)} />
          <div className="grid grid-cols-2 gap-2"><input className={InputClass} aria-label="Cantidad del extra" placeholder="Cantidad (opcional)" inputMode="decimal" value={extraQuantity} onChange={event => setExtraQuantity(event.target.value)} /><input className={InputClass} aria-label="Unidad del extra" placeholder="Unidad (opcional)" value={extraUnit} onChange={event => setExtraUnit(event.target.value)} /></div>
          <NutrientFields values={extraNutrients} onChange={values => setExtraNutrients({ ...emptyNutrients(), ...values })} />
          <input className={InputClass} aria-label="Nota del extra" placeholder="Nota opcional" value={extraNote} onChange={event => setExtraNote(event.target.value)} />
          <div className="flex gap-2"><button disabled={saving || !extraLabel.trim()} onClick={() => void submit('EXTRA', null, null, null, [{ operation: 'added', label: extraLabel.trim(), quantity: asNullableNumber(extraQuantity), unit: extraUnit || null, ...itemNutrientsInput(extraNutrients), note: extraNote || null }], extraNote || null)} className="rounded-full bg-[#CFFF5C] px-3 py-2 text-xs font-bold text-[#101012] disabled:opacity-40">Guardar declaración extra</button><button onClick={() => setExtraOpen(false)} className="rounded-full border border-[#34343A] px-3 py-2 text-xs">Cancelar</button></div>
        </div>}
      </section>
      {logStatus === 'loading' && <p role="status" className="mt-3 text-xs text-[#8E8E94]">Cargando declaraciones de hoy…</p>}
      {logStatus === 'error' && <p role="alert" className="mt-3 text-xs text-red-300">{logError || 'No se pudieron cargar los registros.'}</p>}
      {reconstruction.extras.map(({ event }) => <div key={event.id} className="mt-2 flex items-center gap-3 text-xs text-[#8E8E94]">
        <span>{nutritionDeclarationLabel(event.event_type)}{event.event_type === 'EXTRA' ? ` · ${event.items.map(item => item.label || 'Alimento').join(', ')}` : ''}</span>
        {event.event_type === 'EXTRA' && <button disabled={saving} onClick={() => void submit('VOID', null, null, event.id)} className="rounded-full border border-[#34343A] px-2 py-1 disabled:opacity-50">Anular declaración extra</button>}
      </div>)}
      {logError && logStatus !== 'error' && <p role="alert" className="mt-3 text-xs text-red-300">{logError}</p>}
      {success && <p role="status" className="mt-3 text-xs text-emerald-300">{success}</p>}
      {saving && <p role="status" className="mt-3 text-xs text-[#8E8E94]">Guardando declaración…</p>}
    </main>
  );
};
