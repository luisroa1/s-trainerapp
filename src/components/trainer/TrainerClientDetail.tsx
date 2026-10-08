import React, { useEffect, useState } from 'react';
import { ArrowLeft, Apple, Dumbbell } from 'lucide-react';
import type { ActiveNutritionPlan, ClientData, TrainerWorkoutHistoryEntry, TrainerWorkoutSnapshotExercise } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabaseDb } from '../../lib/supabase';
import { formatPerformedLoad, formatPerformedMeasure, plannedPerformedRows } from '../../lib/trainerWorkoutHistory.mjs';
import { ClientPathologiesSummary } from './ClientPathologiesSummary';
import { TrainerClientProfilePanel } from './TrainerClientProfilePanel';
import { TrainerNutritionLogHistory } from './TrainerNutritionLogHistory';

interface TrainerClientDetailProps {
  client: ClientData;
  onBack: () => void;
  onEditProgram: (programId: string) => void;
  onEditNutrition: (clientId: string) => void;
}

type DetailTab = 'Resumen' | 'Entrenamiento' | 'Nutrición' | 'Progreso';

const BLUE = '#5CD6FF';

export const TrainerClientDetail: React.FC<TrainerClientDetailProps> = ({ client, onBack, onEditProgram, onEditNutrition }) => {
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
  const [activeTab, setActiveTab] = useState<DetailTab>('Resumen');

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
    <main className="mx-auto max-w-[1440px] px-4 pb-20 pt-5 sm:px-7 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#303740] pb-5">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={onBack} aria-label="Volver a clientes" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#303740] text-[#A0A0A8] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> :
            <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#20262D] font-display font-bold text-white">{client.initials || 'CL'}</div>}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>Ficha deportiva</p>
            <h1 className="truncate font-display text-2xl font-bold text-[#F5F4F0] sm:text-3xl">{client.name}</h1>
          </div>
        </div>
        <span className="hidden text-xs text-[#7D8791] sm:block">Información de consulta · fuentes canónicas</span>
      </div>

      {(assignmentError || assignmentMessage) && <p role={assignmentError ? 'alert' : 'status'} className={`mb-4 text-xs ${assignmentError ? 'text-red-300' : 'text-sky-200'}`}>{assignmentError || assignmentMessage}</p>}

      <nav aria-label="Secciones de la ficha" className="mb-6 flex gap-5 overflow-x-auto border-b border-[#303740] text-xs font-semibold sm:gap-8">
        {(['Resumen', 'Entrenamiento', 'Nutrición', 'Progreso'] as const).map(tab => <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-current={activeTab === tab ? 'page' : undefined} className={`relative shrink-0 pb-3 ${activeTab === tab ? 'text-white' : 'text-[#8E8E94] hover:text-white'}`}>
          {tab}{activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: BLUE }} />}
        </button>)}
      </nav>

      {activeTab === 'Resumen' && <>
        <TrainerClientProfilePanel client={client} />
        <ClientPathologiesSummary pathologies={client.pathologies} />
        <div className="mt-7 grid gap-7 xl:grid-cols-2">
          <CurrentTrainingPlan
            status={assignmentStatus}
            error={assignmentError}
            assignment={activeAssignment}
            programName={activeProgram?.name || null}
            programs={programs}
            selectedProgramId={selectedProgramId}
            onSelectProgram={setSelectedProgramId}
            onApply={() => void handleApplyProgram()}
            onEdit={activeProgram ? () => onEditProgram(activeProgram.id) : undefined}
            applying={isApplying}
          />
          <CurrentNutritionPlan status={nutritionStatus} plan={nutritionPlan} onEdit={() => onEditNutrition(client.id)} />
        </div>
      </>}

      {activeTab === 'Entrenamiento' && <WorkoutHistory status={workoutHistoryStatus} entries={workoutHistory} onRetry={() => {
        setWorkoutHistoryStatus('loading');
        void supabaseDb.getTrainerWorkoutHistory(client.id).then(({ data, error }) => {
          setWorkoutHistory(error || !data ? [] : data);
          setWorkoutHistoryStatus(error || !data ? 'error' : 'loaded');
        });
      }} />}

      {activeTab === 'Nutrición' && <div className="space-y-6">
        <CurrentNutritionPlan status={nutritionStatus} plan={nutritionPlan} onEdit={() => onEditNutrition(client.id)} />
        <TrainerNutritionLogHistory clientId={client.id} />
      </div>}

      {activeTab === 'Progreso' && <section className="rounded-[20px] border border-[#303740] bg-[#15191E] p-6 sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: BLUE }}>Evolución documentada</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-white">Datos reales, sin métricas estimadas</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#A0A0A8]">Los registros de peso disponibles aparecen en el perfil. Las sesiones y exposiciones de fuerza registradas se consultan en Entrenamiento. Esta fase no calcula tendencias ni resultados agregados.</p>
      </section>}
    </main>
  );
};

function CurrentTrainingPlan({ status, error, assignment, programName, programs, selectedProgramId, onSelectProgram, onApply, onEdit, applying }: {
  status: 'loading' | 'loaded' | 'error'; error: string | null; assignment: any; programName: string | null;
  programs: { id: string; name: string }[]; selectedProgramId: string; onSelectProgram: (id: string) => void;
  onApply: () => void; onEdit?: () => void; applying: boolean;
}) {
  const version = assignment?.program_version;
  return <section aria-labelledby="current-training-plan-title" className="rounded-[20px] border border-[#303740] bg-[#15191E] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4 border-b border-[#303740] pb-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>Planificación actual</p><h2 id="current-training-plan-title" className="mt-1 font-display text-lg font-semibold text-white">Entrenamiento</h2></div>
      <Dumbbell className="h-5 w-5" style={{ color: BLUE }} />
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
      {onEdit && <button type="button" onClick={onEdit} className="rounded-full border border-[#343B43] px-4 py-2.5 text-xs font-semibold text-white">Editar programa</button>}
    </div>}
  </section>;
}

function CurrentNutritionPlan({ status, plan, onEdit }: { status: 'loading' | 'loaded' | 'error'; plan: ActiveNutritionPlan | null; onEdit: () => void }) {
  return <section aria-labelledby="current-nutrition-plan-title" className="rounded-[20px] border border-[#303740] bg-[#15191E] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4 border-b border-[#303740] pb-4">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>Planificación actual</p><h2 id="current-nutrition-plan-title" className="mt-1 font-display text-lg font-semibold text-white">Nutrición</h2></div><Apple className="h-5 w-5" style={{ color: BLUE }} />
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
    <div className="border-t border-[#303740] pt-4"><button type="button" onClick={onEdit} className="rounded-full border border-[#343B43] px-4 py-2.5 text-xs font-semibold text-white">Abrir planificación nutricional</button></div>
  </section>;
}

function WorkoutHistory({ status, entries, onRetry }: { status: 'loading' | 'loaded' | 'error'; entries: TrainerWorkoutHistoryEntry[]; onRetry: () => void }) {
  return <section aria-labelledby="workout-history-title" className="rounded-[20px] border border-[#303740] bg-[#15191E] p-5 sm:p-7">
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
