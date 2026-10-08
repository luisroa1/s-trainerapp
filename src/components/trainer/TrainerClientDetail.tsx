import React, { useEffect, useState } from 'react';
import { ArrowLeft, Apple, ChartNoAxesCombined, ClipboardList, Dumbbell, FileText } from 'lucide-react';
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
  onOpenReports: () => void;
}

type DetailTab = 'Entrenamiento' | 'Nutrición' | 'Progreso' | 'Seguimiento' | 'Informes';

const BLUE = '#5CD6FF';

export const TrainerClientDetail: React.FC<TrainerClientDetailProps> = ({ client, onBack, onEditProgram, onEditNutrition, onOpenReports }) => {
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
  const [activeTab, setActiveTab] = useState<DetailTab>('Entrenamiento');

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
    <div className="min-h-[calc(100vh-4rem)] bg-[#08121E] text-[#E8F1F8]">
      <div className="flex items-center justify-between gap-4 border-b border-[#147BC1]/50 bg-[#0B1928] px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <button type="button" onClick={onBack} aria-label="Volver a clientes" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#24516D] text-[#B3C4D2] transition hover:border-[#5CD6FF] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#48BDF2]">S-TRAINER · ESTACIÓN DE TRABAJO</p>
            <h1 className="truncate font-display text-xl font-semibold text-white sm:text-2xl">Ficha de {client.name}</h1>
          </div>
        </div>
        <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-[#93A8B9] lg:block">Panel Trainer</span>
      </div>

      <div className="grid items-start xl:grid-cols-[250px_minmax(0,1fr)_220px]">
        <aside aria-label="Datos esenciales del cliente" className="border-b border-[#147BC1]/50 bg-[#0A1725] p-4 xl:sticky xl:top-0 xl:h-[calc(100vh-4rem)] xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div className="mb-4 flex items-center gap-3">
            {client.avatarUrl ? <img src={client.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-[#24516D] object-cover" /> :
              <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#24516D] bg-[#10263A] font-display font-bold text-white">{client.initials || 'CL'}</div>}
            <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#7893A7]">Cliente</p><h2 className="truncate text-sm font-semibold text-white">{client.name}</h2></div>
          </div>
          <TrainerClientProfilePanel client={client} variant="rail" />
          <p className="mt-3 border-t border-[#183B55] pt-3 text-[10px] leading-relaxed text-[#7893A7]">La información personal procede del perfil canónico y respeta el acceso autorizado.</p>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 xl:px-7">
          <nav aria-label="Secciones de la ficha" className="mb-5 flex gap-1 overflow-x-auto border-b border-[#147BC1]/50 pb-2">
            {([
              ['Entrenamiento', Dumbbell], ['Nutrición', Apple], ['Progreso', ChartNoAxesCombined], ['Seguimiento', ClipboardList], ['Informes', FileText],
            ] as const).map(([tab, Icon]) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-current={activeTab === tab ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-[11px] font-semibold transition ${activeTab === tab ? 'border-[#28B9FF] bg-[#10263A] text-white' : 'border-transparent text-[#8EA5B7] hover:text-white'}`}>
              <Icon className="h-3.5 w-3.5" />{tab}
            </button>)}
          </nav>
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
          onEdit={activeProgram ? () => onEditProgram(activeProgram.id) : undefined}
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
        <CurrentNutritionPlan status={nutritionStatus} plan={nutritionPlan} onEdit={() => onEditNutrition(client.id)} />
        <TrainerNutritionLogHistory clientId={client.id} />
      </div>}

      {activeTab === 'Progreso' && <div className="space-y-5">
        <section className="border-l-2 border-[#28B9FF] bg-[#0B1928] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#48BDF2]">Progreso documentado</p><p className="mt-1 text-xs text-[#B2C3D1]">Se muestran únicamente registros disponibles; no se estiman tendencias ni resultados.</p></section>
        <TrainerClientProfilePanel client={client} variant="full" />
        <WorkoutHistory status={workoutHistoryStatus} entries={workoutHistory} onRetry={() => {
          setWorkoutHistoryStatus('loading');
          void supabaseDb.getTrainerWorkoutHistory(client.id).then(({ data, error }) => {
            setWorkoutHistory(error || !data ? [] : data);
            setWorkoutHistoryStatus(error || !data ? 'error' : 'loaded');
          });
        }} />
      </div>}

      {activeTab === 'Seguimiento' && <div className="space-y-5">
        <section className="border-l-2 border-[#28B9FF] bg-[#0B1928] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#48BDF2]">Contexto del cliente</p><p className="mt-1 text-xs text-[#B2C3D1]">Declaraciones disponibles en el perfil, sin interpretación clínica.</p></section>
        <TrainerClientProfilePanel client={client} variant="full" />
        <section className="rounded-md border border-[#24445D] bg-[#0B1928] p-4"><h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#99AFC0]">Información previa del perfil</h2><ClientPathologiesSummary pathologies={client.pathologies} /></section>
      </div>}

      {activeTab === 'Informes' && <section className="max-w-2xl border border-[#24445D] bg-[#0B1928] p-5 sm:p-7"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#48BDF2]">Exportación disponible</p><h2 className="mt-2 font-display text-xl font-semibold text-white">Informes y datos</h2><p className="mt-2 text-sm leading-relaxed text-[#A9BBC9]">La aplicación dispone de una exportación general de clientes y metadatos de programas. No existe todavía un informe profesional imprimible por cliente.</p><button type="button" onClick={onOpenReports} className="mt-5 rounded-md border border-[#2A9BCE] bg-[#0C2B40] px-4 py-2.5 text-xs font-semibold text-[#DFF6FF] transition hover:bg-[#10405D]">Abrir exportación existente</button></section>}
        </section>

        <aside aria-label="Herramientas de la sección" className="border-t border-[#147BC1]/50 bg-[#0A1725] p-4 xl:sticky xl:top-0 xl:h-[calc(100vh-4rem)] xl:border-l xl:border-t-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#7893A7]">Herramientas</p>
          <h2 className="mt-1 text-sm font-semibold text-white">{activeTab}</h2>
          <div className="mt-4 space-y-3">
            {activeTab === 'Entrenamiento' && <>
              <ContextAction title="Programa vigente" detail={assignmentStatus === 'loading' ? 'Consultando asignación…' : assignmentStatus === 'error' ? 'No se pudo consultar la asignación.' : activeAssignment ? (activeProgram?.name || 'Programa asignado') : 'Sin asignación activa'} />
              {activeProgram && <button type="button" onClick={() => onEditProgram(activeProgram.id)} className="w-full rounded-md border border-[#24516D] px-3 py-2 text-left text-xs font-semibold text-[#D7E8F4] hover:border-[#45BFFF]">Editar programa</button>}
            </>}
            {activeTab === 'Nutrición' && <>
              <ContextAction title="Prescripción vigente" detail={nutritionStatus === 'loading' ? 'Consultando asignación…' : nutritionStatus === 'error' ? 'No se pudo consultar la asignación.' : nutritionPlan?.snapshot.plan_name || 'Sin prescripción activa'} />
              <button type="button" onClick={() => onEditNutrition(client.id)} className="w-full rounded-md border border-[#24516D] px-3 py-2 text-left text-xs font-semibold text-[#D7E8F4] hover:border-[#45BFFF]">Abrir planificación nutricional</button>
            </>}
            {activeTab === 'Progreso' && <ContextAction title="Fuentes" detail="Registros de peso y sesiones guardadas." />}
            {activeTab === 'Seguimiento' && <ContextAction title="Lectura" detail="Perfil canónico y antecedente legacy identificado como potencialmente desactualizado." />}
            {activeTab === 'Informes' && <ContextAction title="Disponible" detail="Exportación general existente. Informe individual imprimible todavía no disponible." />}
          </div>
          <div className="mt-6 border-t border-[#183B55] pt-4"><p className="text-[10px] leading-relaxed text-[#7893A7]">Sin catálogos ni métricas simuladas. Las acciones se limitan a las capacidades existentes.</p></div>
        </aside>
      </div>
    </div>
  );
};

function ContextAction({ title, detail }: { title: string; detail: string }) {
  return <div className="border-l-2 border-[#1D8FC4] bg-[#0D2031] px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wider text-[#7893A7]">{title}</p><p className="mt-1 text-xs leading-relaxed text-[#D5E2EC]">{detail}</p></div>;
}

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
