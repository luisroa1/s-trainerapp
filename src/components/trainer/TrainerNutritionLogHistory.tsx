import React, { useEffect, useMemo, useState } from 'react';
import { NutritionLogEvent, NutritionLogEventItem, TrainerNutritionLogEvent } from '../../types';
import { supabaseDb } from '../../lib/supabase';
import { nutritionDeclarationLabel } from '../../lib/nutritionLogModel.mjs';
import { formatQuantityDifference, reconstructNutritionDay } from '../../lib/nutritionPlannedLoggedModel';
import { deriveNutritionPeriodAnalysis, nutritionDateRange, type NutritionPeriodAnalysis } from '../../lib/nutritionDerivedAnalysis';
import type { NutritionAssignmentContext } from '../../types';

interface HistoryData {
  events: TrainerNutritionLogEvent[];
  assignments: NutritionAssignmentContext[];
}

const display = (value: number | null, unit: string) => value == null ? 'Sin dato' : `${value}${unit ? ` ${unit}` : ''}`;
const formatTime = (event: NutritionLogEvent) => {
  const date = new Date(event.occurred_at);
  return Number.isNaN(date.getTime()) ? event.occurred_at : new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone_id,
  }).format(date);
};

const ItemDetail: React.FC<{ item: NutritionLogEventItem }> = ({ item }) => (
  <li className="rounded-lg bg-[#101012] p-3 text-xs">
    <p className="font-semibold">{item.operation === 'removed' ? 'Retiró un elemento pautado' : item.operation === 'change_quantity' ? 'Cambió la cantidad pautada' : item.operation === 'substituted' ? `Sustituyó por ${item.label || 'un elemento'}` : item.label || 'Elemento añadido'}</p>
    {item.operation !== 'removed' && <p className="mt-1 text-[#C2C2C7]">Cantidad: {display(item.quantity, item.unit || '')}</p>}
    <p className="mt-1 text-[11px] text-[#8E8E94]">Contribuciones conocidas para la cantidad declarada: {display(item.energy_kcal, 'kcal')} · proteína {display(item.protein_g, 'g')} · carbohidratos {display(item.carbohydrate_g, 'g')} · grasa {display(item.fat_g, 'g')} · fibra {display(item.fiber_g, 'g')}</p>
    {item.note && <p className="mt-1 text-[#8E8E94]">{item.note}</p>}
  </li>
);

export const TrainerNutritionLogHistory: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [data, setData] = useState<HistoryData>({ events: [], assignments: [] });
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [dateQuery, setDateQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<HistoryData & { date: string } | null>(null);
  const [dayStatus, setDayStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [period, setPeriod] = useState<{ status: 'loading' | 'error' | 'loaded'; analysis?: NutritionPeriodAnalysis }>({ status: 'loading' });

  useEffect(() => {
    let current = true;
    const endDate = new Date().toISOString().slice(0, 10);
    const start = new Date(`${endDate}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 6);
    const startDate = start.toISOString().slice(0, 10);
    setPeriod({ status: 'loading' });
    supabaseDb.getTrainerNutritionLogHistory(clientId, 100, undefined, { startDate, endDate }).then(result => {
      if (!current) return;
      if (result.error || !result.data) { setPeriod({ status: 'error' }); return; }
      const days = nutritionDateRange(startDate, endDate).map(nutritionDate => reconstructNutritionDay({
        nutritionDate,
        assignments: result.data!.assignments,
        events: result.data!.events,
        // The range adapter loads every assignment that could overlap this
        // window; an empty overlap is therefore a known no-assignment date.
        historical: false,
      }));
      setPeriod({ status: 'loaded', analysis: deriveNutritionPeriodAnalysis({ startDate, endDate, days }) });
    });
    return () => { current = false; };
  }, [clientId]);

  useEffect(() => {
    let current = true;
    setStatus('loading');
    supabaseDb.getTrainerNutritionLogHistory(clientId).then(result => {
      if (!current) return;
      if (result.error || !result.data) { setData({ events: [], assignments: [] }); setStatus('error'); return; }
      setData(result.data); setStatus('loaded');
    });
    return () => { current = false; };
  }, [clientId]);

  const loadSelectedDay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dateQuery) return;
    setDayStatus('loading');
    const result = await supabaseDb.getTrainerNutritionLogHistory(clientId, 100, dateQuery);
    if (result.error || !result.data) { setSelectedDay(null); setDayStatus('error'); return; }
    setSelectedDay({ ...result.data, date: dateQuery });
    setDayStatus('idle');
  };

  const days = useMemo(() => {
    const dates = [...new Set([...data.events.map(event => event.nutrition_date), ...(selectedDay ? [selectedDay.date] : [])])].sort((a, b) => b.localeCompare(a));
    return dates.map(nutritionDate => {
      const daySource = selectedDay?.date === nutritionDate ? selectedDay : data;
      return ({
      nutritionDate,
      reconstruction: reconstructNutritionDay({ nutritionDate, assignments: daySource.assignments, events: daySource.events, historical: true }),
      events: daySource.events.filter(event => event.nutrition_date === nutritionDate),
    });
    });
  }, [data, selectedDay]);

  return <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5">
    <h2 className="text-base font-bold">Nutrición: pautado y declarado</h2>
    <p className="mt-1 text-xs text-[#8E8E94]">Registros declarados por el Client; no constituyen verificación objetiva de ingesta.</p>
    <section aria-label="Resumen de registro nutricional" className="mt-4 rounded-xl border border-[#2A2A2F] bg-[#101012] p-4">
      <h3 className="text-sm font-semibold">Últimas 7 fechas nutricionales</h3>
      {period.status === 'loading' && <p role="status" className="mt-2 text-xs text-[#8E8E94]">Calculando resumen…</p>}
      {period.status === 'error' && <p role="alert" className="mt-2 text-xs text-red-300">No se pudo cargar el resumen de registro.</p>}
      {period.status === 'loaded' && period.analysis && <>
        <p className="mt-1 text-[10px] text-[#8E8E94]">{period.analysis.startDate} – {period.analysis.endDate}</p>
        {period.analysis.completeness === 'PARTIAL' && <p className="mt-2 text-xs text-amber-200">Datos parciales · contexto histórico no disponible en {period.analysis.unavailableContextDates.length} día(s).</p>}
        {period.analysis.completeness === 'INSUFFICIENT_DATA' && <p className="mt-2 text-xs text-[#8E8E94]">Datos insuficientes para resumir comidas pautadas en este período.</p>}
        {period.analysis.counts.reconstructablePrescribedMealSlots > 0 ? <ul className="mt-2 grid gap-1 text-xs text-[#C2C2C7] sm:grid-cols-2">
          <li>{period.analysis.counts.explicitDeclarations} de {period.analysis.counts.reconstructablePrescribedMealSlots} comidas con declaración</li>
          <li>{period.analysis.counts.unloggedPrescribedMealSlots} comidas sin registrar</li>
          <li>{period.analysis.counts.asPlanned} declaradas según el plan</li>
          <li>{period.analysis.counts.modified} modificaciones declaradas</li>
          <li>{period.analysis.counts.skipped} no realizadas — declarado por el cliente</li>
          {period.analysis.counts.effectiveExtras > 0 && <li>{period.analysis.counts.effectiveExtras} extras registrados</li>}
        </ul> : period.analysis.counts.effectiveExtras > 0 ? <p className="mt-2 text-xs text-[#C2C2C7]">{period.analysis.counts.effectiveExtras} extras registrados</p> : null}
        {period.analysis.completeness === 'PARTIAL' && <p className="mt-2 text-[10px] text-[#8E8E94]">Los recuentos reflejan solo las fechas y comidas con datos disponibles.</p>}
      </>}
    </section>
    <form onSubmit={event => void loadSelectedDay(event)} className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs text-[#8E8E94]">Consultar fecha nutricional
        <input type="date" value={dateQuery} onChange={event => setDateQuery(event.target.value)} className="mt-1 block rounded-lg border border-[#34343A] bg-[#101012] px-2 py-1.5 text-xs text-[#F5F4F0]" />
      </label>
      <button disabled={!dateQuery || dayStatus === 'loading'} className="rounded-full border border-[#34343A] px-3 py-2 text-xs disabled:opacity-50">Consultar día</button>
      {dayStatus === 'loading' && <span role="status" className="text-xs text-[#8E8E94]">Cargando día…</span>}
      {dayStatus === 'error' && <span role="alert" className="text-xs text-red-300">No se pudo cargar ese día.</span>}
    </form>
    {status === 'loading' && <p role="status" className="mt-4 text-sm text-[#8E8E94]">Cargando historial nutricional…</p>}
    {status === 'error' && <p role="alert" className="mt-4 text-sm text-red-300">No se pudo cargar el historial nutricional.</p>}
    {status === 'loaded' && days.length === 0 && <p className="mt-4 text-sm text-[#8E8E94]">Aún no hay declaraciones registradas.</p>}
    <div className="mt-4 space-y-4">
      {days.map(({ nutritionDate, reconstruction, events }) => {
        const supersededIds = new Set(events.map(event => event.supersedes_event_id).filter((id): id is string => Boolean(id)));
        const correctionHistory = events.filter(event => supersededIds.has(event.id));
        const voidEvents = events.filter(event => event.event_type === 'VOID');
        return <article key={nutritionDate} className="rounded-xl border border-[#2A2A2F] p-4">
          <h3 className="text-sm font-bold">{nutritionDate}</h3>
          {reconstruction.contextStatus === 'unavailable' && <p className="mt-2 text-xs text-amber-200">Contexto histórico no disponible</p>}
          {reconstruction.issues.map((issue, index) => <p key={index} role="status" className="mt-2 text-xs text-amber-200">No se puede reconstruir con seguridad una parte del historial.</p>)}
          <div className="mt-3 space-y-3">
            {reconstruction.meals.map((row, index) => {
              const title = row.meal ? `${row.planName ? `${row.planName} · ` : ''}${row.meal.name}` : 'Comida prescrita';
              const event = row.declaration as TrainerNutritionLogEvent | null;
              const state = row.state === 'AS_PLANNED' ? 'Hecho según el plan — declarado por el Client'
                : row.state === 'MODIFIED' ? 'Modificado — declarado por el Client'
                  : row.state === 'SKIPPED' ? 'No realizada — declarado por el Client'
                    : row.state === 'UNLOGGED' ? 'Sin registro' : 'Contexto histórico no disponible';
              return <section key={`${row.assignmentId || 'unknown'}-${row.mealId || index}`} className="rounded-lg bg-[#101012] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold">{title}</h4><span className="text-[11px] text-[#C2C2C7]">{state}</span></div>
                {row.meal && <><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8E8E94]">Prescrito en la versión asignada · Pautado</p>
                  <ul className="mt-1 space-y-1 text-xs text-[#C2C2C7]">{row.meal.items.map(item => <li key={item.id}>{item.label} · {display(item.quantity, item.unit || '')}</li>)}</ul></>}
                {event && <p className="mt-2 text-[11px] text-[#8E8E94]">{formatTime(event)}{event.note ? ` · ${event.note}` : ''}</p>}
                {row.state === 'AS_PLANNED' && <p className="mt-2 text-xs text-[#C2C2C7]">El Client declaró la comida según el plan.</p>}
                {row.state === 'MODIFIED' && <><p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8E8E94]">Declarado</p><ul className="mt-1 space-y-1 text-xs text-[#C2C2C7]">{row.items.map((item, itemIndex) => {
                  if (item.kind === 'unchanged') return <li key={item.planned?.id || itemIndex}>{item.planned?.label}: según lo pautado</li>;
                  if (item.kind === 'removed') return <li key={item.planned?.id || itemIndex}>Retiró {item.planned?.label}</li>;
                  if (item.kind === 'added') return <li key={item.logged?.id || itemIndex}>Añadió {item.logged?.label || 'un elemento'} · {display(item.logged?.quantity ?? null, item.logged?.unit || '')}</li>;
                  if (item.kind === 'substituted') return <li key={item.planned?.id || itemIndex}>Sustituyó {item.planned?.label} por {item.logged?.label || 'un elemento'} · {display(item.logged?.quantity ?? null, item.logged?.unit || '')}</li>;
                  const difference = formatQuantityDifference(item.quantityDifference, item.planned?.unit || null);
                  return <li key={item.planned?.id || itemIndex}>{item.planned?.label}: {display(item.planned?.quantity ?? null, item.planned?.unit || '')} → {display(item.logged?.quantity ?? null, item.logged?.unit || '')}{difference ? ` (${difference})` : ''}</li>;
                })}</ul></>}
                {row.state === 'SKIPPED' && <p className="mt-2 text-xs text-[#C2C2C7]">El Client declaró que no realizó esta comida.</p>}
              </section>;
            })}
            {reconstruction.extras.map(({ event, items }) => <section key={event.id} className="rounded-lg border border-[#34343A] p-3">
              <h4 className="text-xs font-semibold">Algo extra — declarado por el Client</h4><p className="mt-1 text-[11px] text-[#8E8E94]">{formatTime(event)} · {event.timezone_id}</p>
              <ul className="mt-2 space-y-2">{items.map(item => <ItemDetail key={item.id} item={item} />)}</ul>
            </section>)}
          </div>
          {(correctionHistory.length > 0 || voidEvents.length > 0) && <details className="mt-3 text-xs text-[#8E8E94]"><summary className="cursor-pointer">Historial de correcciones ({correctionHistory.length + voidEvents.length})</summary>
            <ul className="mt-2 space-y-1">{correctionHistory.map(event => <li key={event.id}>{nutritionDeclarationLabel(event.event_type)} · {formatTime(event)} · Corregida por una declaración posterior</li>)}
              {voidEvents.map(event => <li key={event.id}>{nutritionDeclarationLabel(event.event_type)} · {formatTime(event)} · Anulación conservada como historial; no representa una comida realizada.</li>)}</ul>
          </details>}
        </article>;
      })}
    </div>
  </section>;
};
