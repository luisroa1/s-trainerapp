import React, { useEffect, useState } from 'react';
import type { ActiveNutritionPlan, ClientData, TrainerProfile, TrainerWorkoutHistoryEntry, TrainerWorkoutSnapshotExercise } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabaseDb } from '../../lib/supabase';
import { formatPerformedLoad, formatPerformedMeasure, plannedPerformedRows } from '../../lib/trainerWorkoutHistory.mjs';
import { ClientPathologiesSummary } from './ClientPathologiesSummary';
import { TrainerClientProfilePanel } from './TrainerClientProfilePanel';
import { TrainerNutritionLogHistory } from './TrainerNutritionLogHistory';
import { TrainerBrandMark, TrainerIcon } from '../common/TrainerVisualSystem';

interface TrainerClientDetailProps {
  client: ClientData;
  onBack: () => void;
  trainer: TrainerProfile;
  onSignOut: () => void;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onEditNutrition: (clientId: string) => void;
  onOpenReports: () => void;
}

export type DetailTab = 'Entrenamiento' | 'Nutrición' | 'Progreso' | 'Seguimiento' | 'Informes';

const BLUE = '#00BCE8';

export const TrainerClientDetail: React.FC<TrainerClientDetailProps> = ({ client, onBack, trainer, onSignOut, activeTab, onTabChange, onEditNutrition, onOpenReports }) => {
  const { programs, applyProgramToClient } = useApp();
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [nutritionPlan, setNutritionPlan] = useState<ActiveNutritionPlan | null>(null);
  const [nutritionStatus, setNutritionStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [workoutHistory, setWorkoutHistory] = useState<TrainerWorkoutHistoryEntry[]>([]);
  const [workoutHistoryStatus, setWorkoutHistoryStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    let current = true;
    setAssignmentStatus('loading');
    setAssignmentError(null);
    supabaseDb.getActiveProgramAssignment(client.id).then(({ data, error }) => {
      if (!current) return;
      if (error) {
        setActiveAssignment(null);
        setAssignmentStatus('error');
        setAssignmentError('No se pudo consultar la prescripción de entrenamiento.');
        return;
      }
      setActiveAssignment(data);
      setSelectedProgramId(data?.program_version.program_id || '');
      setAssignmentStatus('loaded');
    });
    return () => { current = false; };
  }, [client.id]);

  useEffect(() => {
    let current = true;
    setNutritionStatus('loading');
    supabaseDb.getTrainerActiveNutritionPlan(client.id).then(({ data, error }) => {
      if (!current) return;
      setNutritionPlan(error ? null : data);
      setNutritionStatus(error ? 'error' : 'loaded');
    });
    return () => { current = false; };
  }, [client.id]);

  useEffect(() => {
    let current = true;
    setWorkoutHistoryStatus('loading');
    supabaseDb.getTrainerWorkoutHistory(client.id).then(({ data, error }) => {
      if (!current) return;
      setWorkoutHistory(error || !data ? [] : data);
      setWorkoutHistoryStatus(error || !data ? 'error' : 'loaded');
    });
    return () => { current = false; };
  }, [client.id]);

  const activeProgramId = activeAssignment?.program_version?.program_id || '';
  const activeProgram = programs.find(program => program.id === activeProgramId) || null;

  const handleApplyProgram = async () => {
    if (isApplying || assignmentStatus !== 'loaded') return;
    setIsApplying(true);
    setAssignmentMessage(null);
    setAssignmentError(null);
    try {
      await applyProgramToClient(client.id, selectedProgramId || null);
      const { data, error } = await supabaseDb.getActiveProgramAssignment(client.id);
      if (error) throw error;
      setActiveAssignment(data);
      setSelectedProgramId(data?.program_version.program_id || '');
      setAssignmentMessage(selectedProgramId ? 'Prescripción aplicada al cliente.' : 'El cliente ya no tiene un programa asignado.');
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'No se pudo aplicar la prescripción.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--trainer-bg)] text-[var(--trainer-text)]">
      <header className="trainer-workstation-header sticky top-0 z-30 grid h-auto min-h-20 grid-cols-1 border-b border-[var(--trainer-border)] bg-[var(--trainer-bg)] xl:h-20 xl:grid-cols-[25%_47.7%_27.3%]">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--trainer-border)] px-4 py-3 xl:border-b-0 xl:border-r xl:px-6 xl:py-0">
          <TrainerBrandMark className="h-10 w-[143px]" />
          <button type="button" onClick={onBack} className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-[var(--trainer-muted)] transition hover:text-[var(--trainer-text)]">‹&nbsp; Volver a clientes</button>
        </div>
        <div className="flex min-w-0 items-center justify-center overflow-x-auto px-3 sm:px-5">
          <nav aria-label="Secciones de la ficha" className="flex min-w-0 items-stretch justify-center gap-1 overflow-x-auto">
            {(['Entrenamiento', 'Nutrición', 'Progreso', 'Seguimiento', 'Informes'] as const).map(tab => {
              const icons = { Entrenamiento: 'training', Nutrición: 'nutrition', Progreso: 'progress', Seguimiento: 'followup', Informes: 'reports' } as const;
              return <button key={tab} type="button" onClick={() => onTabChange(tab)} aria-current={activeTab === tab ? 'page' : undefined} className={`relative flex h-full shrink-0 items-center gap-2 px-2 text-[12px] font-semibold transition sm:px-3 ${activeTab === tab ? 'bg-[var(--trainer-panel)] text-[var(--trainer-cyan)] after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:bg-[var(--trainer-cyan)]' : 'text-[var(--trainer-text)] hover:bg-white/[0.035]'}`}><TrainerIcon name={icons[tab]} size={23} /><span className="hidden lg:inline">{tab}</span></button>;
            })}
          </nav>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-3 border-t border-[#087CA8]/35 px-4 py-2 xl:border-l xl:border-t-0 xl:px-5 xl:py-0">
          {trainer.avatarUrl ? <img src={trainer.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-[var(--trainer-border)] object-cover" /> : <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--trainer-border)] text-xs font-bold text-[var(--trainer-neutral)]">{trainer.initials || ''}</span>}
          <span className="max-w-32 truncate text-xs font-semibold text-[var(--trainer-text)]">{trainer.name}</span>
          <button type="button" onClick={onSignOut} className="whitespace-nowrap text-[10px] font-medium text-[var(--trainer-muted)] hover:text-[var(--trainer-text)]">Cerrar sesión</button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-5rem)] items-stretch xl:grid-cols-[25%_47.7%_27.3%]">
        <aside aria-label="Datos esenciales del cliente" className="border-b border-[#087CA8]/55 bg-[#030F16] p-5 xl:sticky xl:top-20 xl:h-[calc(100vh-5rem)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div className="mb-4 flex items-center gap-3">
            {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="h-[76px] w-[76px] shrink-0 rounded-full border border-[#087CA8] object-cover" /> :
              <div aria-hidden="true" className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border border-[#087CA8] bg-[#0A2636] font-display text-xl font-bold text-white">{client.initials || 'CL'}</div>}
            <div className="min-w-0"><h1 className="truncate font-display text-xl font-semibold text-white">{client.name}</h1><span className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold ${client.status === 'Activo' ? 'bg-[#063C35] text-[#66E8BD]' : 'bg-[#183042] text-[#B9D3E4]'}`}><i aria-hidden="true" className={`h-2 w-2 rounded-full ${client.status === 'Activo' ? 'bg-[#32D5A1]' : 'bg-[#6A9BB5]'}`} />{client.status}</span></div>
          </div>
          <TrainerClientProfilePanel client={client} variant="rail" />
        </aside>

        <section aria-label={`Área de trabajo: ${activeTab}`} className="min-w-0 border-b border-[#087CA8]/55 bg-[#06141D] px-4 py-6 sm:px-6 xl:h-[calc(100vh-5rem)] xl:overflow-y-auto xl:border-b-0 xl:px-5">
          {(assignmentError || assignmentMessage) && <p role={assignmentError ? 'alert' : 'status'} className={`mb-4 rounded-md border px-3 py-2 text-xs ${assignmentError ? 'border-red-400/30 bg-red-950/30 text-red-200' : 'border-[#2D8EAF]/40 bg-[#0D2939] text-sky-100'}`}>{assignmentError || assignmentMessage}</p>}

      {activeTab === 'Entrenamiento' && <div className="space-y-5">
        <CurrentTrainingPlan
          status={assignmentStatus}
          error={assignmentError}
          assignment={activeAssignment}
          programName={activeProgram?.name || null}
          programs={programs}
          selectedProgramId={selectedProgramId}
          onSelectProgram={setSelectedProgramId}
          onApply={() => void handleApplyProgram()}
          applying={isApplying}
        />
        <WorkoutHistory status={workoutHistoryStatus} entries={workoutHistory} onRetry={() => {
        setWorkoutHistoryStatus('loading');
        void supabaseDb.getTrainerWorkoutHistory(client.id).then(({ data, error }) => {
          setWorkoutHistory(error || !data ? [] : data);
          setWorkoutHistoryStatus(error || !data ? 'error' : 'loaded');
        });
        }} />
      </div>}

      {activeTab === 'Nutrición' && <div className="space-y-6">
        <CurrentNutritionPlan status={nutritionStatus} plan={nutritionPlan} />
        <TrainerNutritionLogHistory clientId={client.id} />
      </div>}

      {activeTab === 'Progreso' && <div className="space-y-5">
        <TrainerClientProfilePanel client={client} variant="progress" />
        <WorkoutHistory status={workoutHistoryStatus} entries={workoutHistory} onRetry={() => {
          setWorkoutHistoryStatus('loading');
          void supabaseDb.getTrainerWorkoutHistory(client.id).then(({ data, error }) => {
            setWorkoutHistory(error || !data ? [] : data);
            setWorkoutHistoryStatus(error || !data ? 'error' : 'loaded');
          });
        }} />
      </div>}

      {activeTab === 'Seguimiento' && <div className="space-y-5">
        <TrainerClientProfilePanel client={client} variant="health" />
        <section className="rounded-md border border-[#24445D] bg-[#0B1928] p-4"><h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#99AFC0]">Información previa del perfil</h2><ClientPathologiesSummary pathologies={client.pathologies} /></section>
      </div>}

      {activeTab === 'Informes' && <section className="max-w-2xl border border-[#24445D] bg-[#0B1928] p-5 sm:p-7"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#48BDF2]">Exportación disponible</p><h2 className="mt-2 font-display text-xl font-semibold text-white">Informes y datos</h2><p className="mt-2 text-sm leading-relaxed text-[#A9BBC9]">La aplicación dispone de una exportación general de clientes y metadatos de programas. No existe todavía un informe profesional imprimible por cliente.</p></section>}
        </section>

        <aside aria-label="Herramientas contextuales" className="min-h-[16rem] bg-[#030F16] p-5 xl:sticky xl:top-20 xl:h-[calc(100vh-5rem)] xl:border-l xl:border-[#087CA8]/55">
          {activeTab === 'Nutrición' && <button type="button" onClick={() => onEditNutrition(client.id)} className="w-full border border-[#087CA8]/70 bg-[#082A3A] px-4 py-3 text-left text-xs font-semibold text-[#DDF8FF] transition hover:bg-[#0A354A]">Abrir planificación nutricional</button>}
          {activeTab === 'Informes' && <button type="button" onClick={onOpenReports} className="w-full border border-[#087CA8]/70 bg-[#082A3A] px-4 py-3 text-left text-xs font-semibold text-[#DDF8FF] transition hover:bg-[#0A354A]">Abrir exportación existente</button>}
        </aside>
      </div>
    </div>
  );
};

function CurrentTrainingPlan({ status, error, assignment, programName, programs, selectedProgramId, onSelectProgram, onApply, applying }: {
  status: 'loading' | 'loaded' | 'error'; error: string | null; assignment: any; programName: string | null;
  programs: { id: string; name: string }[]; selectedProgramId: string; onSelectProgram: (id: string) => void;
  onApply: () => void; applying: boolean;
}) {
  const version = assignment?.program_version;
  return <section aria-labelledby="current-training-plan-title" className="rounded-xl border border-[#1B3A4F] bg-[#07131A] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4 border-b border-[#303740] pb-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>Planificación actual</p><h2 id="current-training-plan-title" className="mt-1 font-display text-lg font-semibold text-white">Entrenamiento</h2></div>
    </div>
    {status === 'loading' && <p role="status" className="py-5 text-sm text-[#8E8E94]">Consultando asignación vigente…</p>}
    {status === 'error' && <p role="alert" className="py-5 text-sm text-red-300">{error || 'No se pudo consultar la asignación vigente.'}</p>}
    {status === 'loaded' && (version ? <>
      <div className="py-4">
        <p className="text-base font-semibold text-white">{programName || 'Programa asignado'}</p>
        <p className="mt-1 text-xs text-[#8E8E94]">Versión {version.version_number} · asignada {formatDate(version.created_at)}</p>
        <p className="mt-3 text-xs text-[#C2C2C7]">{Array.isArray(version.snapshot?.days) ? version.snapshot.days.length : 0} días pautados en esta versión</p>
      </div>
    </> : <p className="py-5 text-sm text-[#A0A0A8]">No hay una asignación de entrenamiento activa.</p>)}
    {status === 'loaded' && <div className="flex flex-wrap items-center gap-2 border-t border-[#303740] pt-4">
      <label className="sr-only" htmlFor="client-program-select">Programa para aplicar a este cliente</label>
      <select id="client-program-select" value={selectedProgramId} onChange={event => onSelectProgram(event.target.value)} disabled={applying} className="min-w-0 flex-1 rounded-full border border-[#343B43] bg-[#101418] px-3 py-2.5 text-xs text-white">
        <option value="">Sin programa asignado</option>{programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
      </select>
      <button type="button" onClick={onApply} disabled={applying || (!selectedProgramId && !assignment)} className="rounded-full px-4 py-2.5 text-xs font-bold text-[#07131A] disabled:opacity-50" style={{ backgroundColor: BLUE }}>{applying ? 'Aplicando…' : selectedProgramId ? 'Aplicar' : 'Quitar'}</button>
    </div>}
  </section>;
}

function CurrentNutritionPlan({ status, plan }: { status: 'loading' | 'loaded' | 'error'; plan: ActiveNutritionPlan | null }) {
  return <section aria-labelledby="current-nutrition-plan-title" className="rounded-xl border border-[#1B3A4F] bg-[#07131A] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-[#303740] pb-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>Planificación actual</p><h2 id="current-nutrition-plan-title" className="mt-1 font-display text-lg font-semibold text-white">Nutrición</h2></div>
    </div>
    {status === 'loading' && <p role="status" className="py-5 text-sm text-[#8E8E94]">Consultando asignación vigente…</p>}
    {status === 'error' && <p role="alert" className="py-5 text-sm text-red-300">No se pudo consultar la asignación nutricional vigente.</p>}
    {status === 'loaded' && !plan && <p className="py-5 text-sm text-[#A0A0A8]">No hay una prescripción nutricional activa.</p>}
    {status === 'loaded' && plan && <div className="py-4">
      <p className="text-base font-semibold text-white">{plan.snapshot.plan_name || 'Plan nutricional'}</p>
      <p className="mt-1 text-xs text-[#8E8E94]">Versión {plan.versionNumber} · asignada {formatDate(plan.assignedAt)}</p>
      {plan.snapshot.objective && <p className="mt-3 text-xs text-[#C2C2C7]">{plan.snapshot.objective}</p>}
      {plan.snapshot.meals.length === 0 ? <p className="mt-3 text-xs text-[#A0A0A8]">La prescripción activa todavía no contiene comidas pautadas.</p> : <ol className="mt-3 space-y-2">
        {plan.snapshot.meals.slice().sort((a, b) => a.order - b.order).map(meal => <li key={meal.id} className="border-t border-[#303740] pt-2.5">
          <p className="text-xs font-semibold text-white">{meal.name}</p>
          {meal.description && <p className="mt-1 text-xs text-[#A0A0A8]">{meal.description}</p>}
          {meal.items.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-[#C2C2C7]">{meal.items.map(item => <li key={item.id}>{item.label} · {item.quantity == null ? 'Sin cantidad indicada' : `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`}</li>)}</ul>}
        </li>)}
      </ol>}
    </div>}
  </section>;
}

function WorkoutHistory({ status, entries, onRetry }: { status: 'loading' | 'loaded' | 'error'; entries: TrainerWorkoutHistoryEntry[]; onRetry: () => void }) {
  return <section aria-labelledby="workout-history-title" className="rounded-xl border border-[#1B3A4F] bg-[#07131A] p-5 sm:p-7">
    <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>Actividad documentada</p>
    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><h2 id="workout-history-title" className="font-display text-xl font-semibold text-white">Sesiones y resultados</h2>{status === 'loaded' && <span className="text-xs text-[#8E8E94]">{entries.length} registros · últimas 20 sesiones</span>}</div>
    {status === 'loading' && <p role="status" className="py-8 text-sm text-[#8E8E94]">Consultando sesiones registradas…</p>}
    {status === 'error' && <div role="alert" className="py-8 text-sm text-red-300">No se pudo consultar el historial de entrenamientos.<button type="button" onClick={onRetry} className="ml-2 underline">Reintentar</button></div>}
    {status === 'loaded' && entries.length === 0 && <p className="py-8 text-sm text-[#A0A0A8]">Todavía no hay sesiones registradas.</p>}
    <div className="divide-y divide-[#303740]">
      {entries.map((entry, sessionIndex) => <details key={entry.session.id} open={sessionIndex === 0} className="py-4">
        <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{entry.day.title}</h3><p className="mt-1 text-xs text-[#8E8E94]">{formatDate(entry.session.started_at, true)}</p></div><span className="text-xs text-[#A0A0A8]">{entry.execution.sessionStatus === 'finished' ? 'Finalizada' : 'En curso'} · {entry.execution.recordedPlannedSetCount}/{entry.execution.plannedSetCount} series registradas</span></div></summary>
        <div className="mt-4 space-y-4">{entry.day.exercises.map((exercise: TrainerWorkoutSnapshotExercise) => {
          const counts = entry.execution.exercises.find(item => item.exercise_id === exercise.id);
          return <div key={exercise.id} className="border-l-2 border-[#263A46] pl-4">
            <h4 className="text-sm font-semibold text-white">{exercise.order}. {exercise.name}</h4>
            {exercise.instructions && <p className="mt-1 text-xs text-[#A0A0A8]">{exercise.instructions}</p>}
            {counts && <p className="mt-1 text-[11px] text-[#8E8E94]">Series registradas: {counts.recordedPlannedSetCount}/{counts.plannedSetCount}{counts.extraSetCount > 0 && ` · ${counts.extraSetCount} series extra`}</p>}
            <div className="mt-3 grid grid-cols-[minmax(48px,0.45fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase text-[#7D8791]">Serie</span><span className="text-[10px] font-bold uppercase text-[#7D8791]">Pautado</span><span className="text-[10px] font-bold uppercase text-[#7D8791]">Registrado</span>
              {plannedPerformedRows(entry, exercise.id).map(row => <React.Fragment key={row.set_number}>
                <span className="text-[#A0A0A8]">{row.set_number}</span>
                <span className="text-[#D7DADF]">{row.planned ? [row.planned.reps == null ? 'Reps sin pauta' : `${row.planned.reps} reps`, row.planned.load ?? 'Carga sin pauta', row.planned.rir == null ? 'RIR sin pauta' : `RIR ${row.planned.rir}`].join(' · ') : 'Sin serie pautada'}</span>
                <span className="text-[#D7DADF]">{row.performed ? `${formatPerformedMeasure(row.performed)} · ${formatPerformedLoad(row.performed)} · RIR ${row.performed.rir_performed ?? 'Sin dato'}` : 'Sin registro'}{row.performed?.note && <small className="mt-1 block text-[#8E8E94]">{row.performed.note}</small>}</span>
              </React.Fragment>)}
            </div>
            {(exercise.recentExposures?.length || 0) >= 2 && <div className="mt-3 border-t border-[#303740] pt-3"><h5 className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E94]">Exposiciones anteriores registradas</h5><ul className="mt-2 space-y-2">{exercise.recentExposures?.map(exposure => <li key={exposure.sessionId} className="text-[11px] text-[#A0A0A8]">{formatDate(exposure.startedAt)} · versión {exposure.versionNumber} · {exposure.recordedSetCount} series</li>)}</ul></div>}
          </div>;
        })}</div>
      </details>)}
    </div>
  </section>;
}

function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'fecha no disponible';
  return new Intl.DateTimeFormat('es-ES', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}
