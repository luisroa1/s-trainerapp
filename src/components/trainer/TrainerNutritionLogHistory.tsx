import React, { useEffect, useState } from 'react';
import { NutritionLogEventItem, TrainerNutritionLogEvent } from '../../types';
import { supabaseDb } from '../../lib/supabase';
import { nutritionDeclarationLabel } from '../../lib/nutritionLogModel.mjs';

const display = (value: number | null, unit: string) => value == null ? 'Sin dato' : `${value}${unit ? ` ${unit}` : ''}`;

const formatTime = (event: TrainerNutritionLogEvent) => {
  const date = new Date(event.occurred_at);
  return Number.isNaN(date.getTime()) ? event.occurred_at : new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone_id,
  }).format(date);
};

const ItemDetail: React.FC<{ item: NutritionLogEventItem; plannedLabel?: string | null }> = ({ item, plannedLabel }) => (
  <li className="rounded-lg bg-[#101012] p-3 text-xs">
    {plannedLabel && <p className="text-[11px] text-[#8E8E94]">Elemento pautado: {plannedLabel}</p>}
    <p className="font-semibold">{item.operation === 'removed' ? 'Retiró un elemento pautado' : item.operation === 'change_quantity' ? 'Cambió la cantidad pautada' : item.operation === 'substituted' ? `Sustituyó por ${item.label}` : item.label || 'Elemento añadido'}</p>
    {item.operation !== 'removed' && <p className="mt-1 text-[#C2C2C7]">Cantidad: {display(item.quantity, item.unit || '')}</p>}
    <p className="mt-1 text-[11px] text-[#8E8E94]">Contribuciones conocidas para la cantidad declarada: {display(item.energy_kcal, 'kcal')} · proteína {display(item.protein_g, 'g')} · carbohidratos {display(item.carbohydrate_g, 'g')} · grasa {display(item.fat_g, 'g')} · fibra {display(item.fiber_g, 'g')}</p>
    {item.note && <p className="mt-1 text-[#8E8E94]">{item.note}</p>}
  </li>
);

export const TrainerNutritionLogHistory: React.FC<{ clientId: string }> = ({ clientId }) => {
  const [events, setEvents] = useState<TrainerNutritionLogEvent[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    let current = true;
    setStatus('loading');
    supabaseDb.getTrainerNutritionLogHistory(clientId).then(({ data, error }) => {
      if (!current) return;
      if (error || !data) { setEvents([]); setStatus('error'); return; }
      setEvents(data); setStatus('loaded');
    });
    return () => { current = false; };
  }, [clientId]);

  const superseded = new Set(events.map(event => event.supersedes_event_id).filter((id): id is string => Boolean(id)));
  return <section className="rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-5">
    <h2 className="text-base font-bold">Declaraciones nutricionales</h2>
    <p className="mt-1 text-xs text-[#8E8E94]">Registros declarados por el Client; no son una verificación objetiva de ingesta.</p>
    {status === 'loading' && <p role="status" className="mt-4 text-sm text-[#8E8E94]">Cargando declaraciones…</p>}
    {status === 'error' && <p role="alert" className="mt-4 text-sm text-red-300">No se pudieron cargar las declaraciones.</p>}
    {status === 'loaded' && events.length === 0 && <p className="mt-4 text-sm text-[#8E8E94]">Aún no hay declaraciones registradas.</p>}
    <div className="mt-4 space-y-3">
      {events.map(event => {
        const isCurrent = !superseded.has(event.id);
        const meal = event.assignment_id && event.prescribed_meal_id
          ? event.plan_name && event.meal_name ? `${event.plan_name} · ${event.meal_name}` : 'Comida pautada (sin detalle disponible)'
          : null;
        return <article key={event.id} className="rounded-xl border border-[#2A2A2F] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{meal || (event.event_type === 'VOID' ? 'Extra anulado' : 'Algo extra')}</p>
            <span className="rounded-full bg-[#101012] px-2.5 py-1 text-[10px] text-[#C2C2C7]">{isCurrent ? 'Actual' : 'Corregida'}</span>
          </div>
          <p className="mt-1 text-xs text-[#CFFF5C]">{nutritionDeclarationLabel(event.event_type)} · {formatTime(event)}</p>
          {event.note && <p className="mt-2 text-xs text-[#C2C2C7]">{event.note}</p>}
          {event.meal_snapshot && <div className="mt-3 rounded-lg bg-[#101012] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E94]">Prescrito en la versión asignada</p>
            <ul className="mt-2 space-y-1 text-xs text-[#C2C2C7]">{event.meal_snapshot.items.map(item => <li key={item.id}>{item.label} · {item.quantity == null ? 'cantidad sin dato' : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`}</li>)}</ul>
          </div>}
          {event.event_type === 'AS_PLANNED' && event.assignment_id && event.prescribed_meal_id && <p className="mt-2 text-xs text-[#8E8E94]">Declaró la comida de la versión histórica según el plan.</p>}
          {event.event_type === 'SKIPPED' && <p className="mt-2 text-xs text-[#8E8E94]">Declaró explícitamente que no realizó esta comida pautada.</p>}
          {event.event_type === 'MODIFIED' && event.items.length > 0 && <ul className="mt-3 space-y-2">{event.items.map(item => <ItemDetail key={item.id} item={item} plannedLabel={event.meal_snapshot?.items.find(planned => planned.id === item.planned_item_id)?.label || null} />)}</ul>}
          {event.event_type === 'EXTRA' && event.items.length > 0 && <ul className="mt-3 space-y-2">{event.items.map(item => <ItemDetail key={item.id} item={item} />)}</ul>}
          {event.supersedes_event_id && <p className="mt-2 text-[11px] text-[#8E8E94]">Corrige la declaración anterior {event.supersedes_event_id.slice(0, 8)}.</p>}
          {event.event_type === 'VOID' && <p className="mt-2 text-xs text-[#8E8E94]">Anulación conservada como historial; no representa un resultado de comida.</p>}
        </article>;
      })}
    </div>
  </section>;
};
