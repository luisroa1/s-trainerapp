import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock, Dumbbell, X } from 'lucide-react';
import { supabaseDb } from '../../lib/supabase';
import { WorkoutSessionView, WorkoutSetResult } from '../../types';

type MeasureKind = 'reps' | 'duration';
type LoadKind = NonNullable<WorkoutSetResult['load_kind']> | '';

interface WorkoutExerciseProps {
  session: WorkoutSessionView;
  onBack: () => void;
  onClose: () => void;
  onSessionChange: (session: WorkoutSessionView) => void;
}

const resultValue = (result: WorkoutSetResult) => result.reps_performed !== null
  ? `${result.reps_performed} repeticiones`
  : `${result.duration_seconds} s`;

const loadLabel = (result: WorkoutSetResult) => {
  if (result.load_kind === 'bodyweight') return 'Peso corporal';
  if (result.load_kind === 'none') return 'Sin carga';
  if (result.load_kind === 'external_kg') return `${result.load_kg} kg`;
  if (result.load_kind === 'external_kg_per_dumbbell') return `${result.load_kg} kg/mancuerna`;
  return 'Carga no informada';
};

export const WorkoutExercise: React.FC<WorkoutExerciseProps> = ({ session, onBack, onClose, onSessionChange }) => {
  const exercises = useMemo(() => [...session.day.exercises].sort((a, b) => a.order - b.order), [session.day.exercises]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [editingResult, setEditingResult] = useState<WorkoutSetResult | null>(null);
  const [measureKind, setMeasureKind] = useState<MeasureKind>('reps');
  const [repsValue, setRepsValue] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [loadKind, setLoadKind] = useState<LoadKind>('');
  const [loadValue, setLoadValue] = useState('');
  const [rirValue, setRirValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const incompleteExercise = exercises.find(exercise => {
    const count = session.results.filter(result => result.exercise_id === exercise.id).length;
    return count < exercise.sets;
  });
  const currentExercise = exercises.find(exercise => exercise.id === selectedExerciseId) || incompleteExercise || exercises.at(-1);
  const exerciseResults = currentExercise
    ? session.results.filter(result => result.exercise_id === currentExercise.id).sort((a, b) => a.set_number - b.set_number)
    : [];
  const nextSetNumber = exerciseResults.reduce((max, result) => Math.max(max, result.set_number), 0) + 1;
  const canSaveCurrentSet = Boolean(currentExercise && (editingResult || nextSetNumber <= currentExercise.sets));
  const allPlannedSetsRecorded = exercises.length > 0 && exercises.every(exercise =>
    session.results.filter(result => result.exercise_id === exercise.id).length >= exercise.sets
  );
  const finalized = session.session.completed_at !== null;
  const hasUnsubmittedInput = Boolean(
    editingResult || repsValue.trim() || durationValue.trim() || loadValue.trim() || rirValue.trim() || note.trim()
  );

  const leaveWorkout = (callback: () => void) => {
    if (saving || finishing) return;
    if (hasUnsubmittedInput && !window.confirm('Hay datos de una serie sin guardar. ¿Quieres salir y descartarlos?')) return;
    callback();
  };

  const resetForm = () => {
    setMeasureKind('reps');
    setRepsValue('');
    setDurationValue('');
    setLoadKind('');
    setLoadValue('');
    setRirValue('');
    setNote('');
    setEditingResult(null);
  };

  const beginEdit = (result: WorkoutSetResult) => {
    setSelectedExerciseId(result.exercise_id);
    setEditingResult(result);
    setMeasureKind(result.reps_performed !== null ? 'reps' : 'duration');
    setRepsValue(result.reps_performed?.toString() || '');
    setDurationValue(result.duration_seconds?.toString() || '');
    setLoadKind(result.load_kind || '');
    setLoadValue(result.load_kg?.toString() || '');
    setRirValue(result.rir_performed?.toString() || '');
    setNote(result.note || '');
    setError(null);
  };

  const handleSaveSet = async () => {
    if (!currentExercise || finalized || saving || !canSaveCurrentSet) return;
    const performedReps = measureKind === 'reps' && repsValue.trim() ? Number(repsValue) : null;
    const performedSeconds = measureKind === 'duration' && durationValue.trim() ? Number(durationValue) : null;
    const parsedLoad = loadValue.trim() ? Number(loadValue) : null;
    const externalLoad = loadKind === 'external_kg' || loadKind === 'external_kg_per_dumbbell';
    if ((performedReps === null && performedSeconds === null)
      || (performedReps !== null && (!Number.isInteger(performedReps) || performedReps <= 0))
      || (performedSeconds !== null && (!Number.isInteger(performedSeconds) || performedSeconds <= 0))
      || (externalLoad && (parsedLoad === null || !Number.isFinite(parsedLoad) || parsedLoad < 0))) {
      setError('Introduce el resultado realizado antes de guardarlo.');
      return;
    }
    const parsedRir = rirValue.trim() ? Number(rirValue) : null;
    if (parsedRir !== null && (!Number.isFinite(parsedRir) || parsedRir < 0)) {
      setError('El RIR debe ser un número igual o superior a cero.');
      return;
    }

    setSaving(true);
    setError(null);
    const { data, error: saveError } = await supabaseDb.saveWorkoutSetResult({
      workout_session_id: session.session.id,
      exercise_id: currentExercise.id,
      set_number: editingResult?.set_number || nextSetNumber,
      reps_performed: performedReps,
      duration_seconds: performedSeconds,
      load_kind: loadKind || null,
      load_kg: externalLoad ? parsedLoad : null,
      rir_performed: parsedRir,
      note: note.trim() || null,
    });
    setSaving(false);
    if (saveError || !data) {
      setError('No se confirmó el guardado. Los datos siguen en pantalla; puedes reintentar.');
      return;
    }

    const results = [...session.results.filter(result =>
      !(result.exercise_id === data.exercise_id && result.set_number === data.set_number)
    ), data];
    onSessionChange({ ...session, results });
    resetForm();
    setSelectedExerciseId(null);
  };

  const handleFinish = async () => {
    if (finishing || finalized) return;
    setFinishing(true);
    setError(null);
    const { data, error: finishError } = await supabaseDb.finishWorkoutSession(session.session.id);
    setFinishing(false);
    if (finishError || !data) {
      setError('No se confirmó el cierre de la sesión. Puedes reintentar.');
      return;
    }
    onSessionChange(data);
  };

  if (finalized) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#101012] px-5 py-10 text-center text-[#F5F4F0]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-[#101012]"><Check className="h-8 w-8 stroke-[3]" /></div>
        <h2 className="text-xl font-extrabold">Sesión finalizada</h2>
        <p className="text-sm text-[#8E8E94]">La ejecución quedó guardada.</p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-emerald-500 py-4 font-bold text-[#101012]">Volver</button>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div role="alert" className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#101012] p-6 text-center text-[#F5F4F0]">
        <p>Esta sesión no contiene ejercicios ejecutables.</p>
        <button type="button" onClick={onBack} className="rounded-full bg-[#25252A] px-6 py-3">Volver</button>
      </div>
    );
  }

  const exerciseIndex = currentExercise ? exercises.findIndex(exercise => exercise.id === currentExercise.id) : -1;
  const allResults = [...session.results].sort((a, b) => {
    const exerciseOrder = exercises.findIndex(exercise => exercise.id === a.exercise_id) - exercises.findIndex(exercise => exercise.id === b.exercise_id);
    return exerciseOrder || a.set_number - b.set_number;
  });

  return (
    <div className="flex min-h-full flex-col bg-[#101012] px-5 pb-10 pt-3 text-[#F5F4F0]">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={() => leaveWorkout(onBack)} aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1B1F] text-[#8E8E94]"><ArrowLeft className="h-4 w-4" /></button>
        <span className="text-center text-[11px] font-bold uppercase tracking-widest text-[#8E8E94]">{session.day.title}</span>
        <button type="button" onClick={() => leaveWorkout(onClose)} aria-label="Salir" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1B1F] text-[#8E8E94]"><X className="h-4 w-4" /></button>
      </div>

      {currentExercise && (
        <>
          <div className="mb-4 flex gap-1.5">{exercises.map((exercise, index) => <div key={exercise.id} className={`h-1.5 flex-1 rounded-full ${index <= exerciseIndex ? 'bg-[var(--accent-color,#CFFF5C)]' : 'bg-[#2A2A2F]'}`} />)}</div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#8E8E94]">Ejercicio {exerciseIndex + 1} de {exercises.length}</p>
          <h1 className="text-2xl font-extrabold">{currentExercise.name}</h1>
          <p className="mt-1 text-xs text-[#8E8E94]">{currentExercise.muscleGroup}</p>

          <section className="my-4 rounded-2xl border border-[#2A2A2F] bg-[#1B1B1F] p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#8E8E94]"><Dumbbell className="h-3.5 w-3.5" /> Prescripción</div>
            <p className="text-sm font-semibold">{currentExercise.sets} × {currentExercise.reps} · {currentExercise.weight || 'Carga no especificada'} · RIR objetivo {currentExercise.rir}</p>
            {currentExercise.trainerTip && <p className="mt-2 text-xs text-[#A0A0A8]">{currentExercise.trainerTip}</p>}
            <p className="mt-2 flex items-center gap-1 text-[11px] text-[#8E8E94]"><Clock className="h-3 w-3" /> Descanso {currentExercise.restSeconds || 90} s</p>
          </section>

          <section className="mb-5 space-y-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E94]">Series registradas</h2>
            {exerciseResults.length === 0 && <p className="text-xs text-[#8E8E94]">Todavía no hay series guardadas para este ejercicio.</p>}
            {exerciseResults.map(result => (
              <div key={result.id} className="flex items-center justify-between rounded-xl border border-[#2A2A2F] bg-[#1B1B1F] p-3">
                <span className="text-sm">Serie {result.set_number}: {resultValue(result)} · {loadLabel(result)}{result.rir_performed !== null ? ` · RIR ${result.rir_performed}` : ''}</span>
                <button type="button" onClick={() => beginEdit(result)} className="ml-3 text-xs font-bold text-cyan-300">Editar</button>
              </div>
            ))}
          </section>

          <section className="mb-5 rounded-2xl border border-[#2A2A2F] bg-[#16161A] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{editingResult ? `Editar serie ${editingResult.set_number}` : `Registrar serie ${nextSetNumber}`}</h2><span className="text-xs text-[#8E8E94]">Solo valores realizados</span></div>
            <label className="mb-2 block text-xs text-[#A0A0A8]">Magnitud realizada</label>
            <select value={measureKind} onChange={event => setMeasureKind(event.target.value as MeasureKind)} className="mb-3 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-sm">
              <option value="reps">Repeticiones</option><option value="duration">Duración en segundos</option>
            </select>
            {measureKind === 'reps' ? (
              <label className="mb-3 block text-xs text-[#A0A0A8]">Repeticiones realizadas<input type="number" min="1" step="1" value={repsValue} onChange={event => setRepsValue(event.target.value)} className="mt-1 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-base text-white" placeholder="Sin dato" /></label>
            ) : (
              <label className="mb-3 block text-xs text-[#A0A0A8]">Segundos realizados<input type="number" min="1" step="1" value={durationValue} onChange={event => setDurationValue(event.target.value)} className="mt-1 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-base text-white" placeholder="Sin dato" /></label>
            )}
            <label className="mb-2 block text-xs text-[#A0A0A8]">Carga realizada</label>
            <select value={loadKind} onChange={event => setLoadKind(event.target.value as LoadKind)} className="mb-3 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-sm">
              <option value="">No informar carga</option><option value="external_kg">Carga externa (kg)</option><option value="external_kg_per_dumbbell">Carga por mancuerna (kg)</option><option value="bodyweight">Peso corporal</option><option value="none">Sin carga</option>
            </select>
            {(loadKind === 'external_kg' || loadKind === 'external_kg_per_dumbbell') && <label className="mb-3 block text-xs text-[#A0A0A8]">{loadKind === 'external_kg' ? 'Kilogramos realizados' : 'Kilogramos por mancuerna'}<input type="number" min="0" step="0.1" value={loadValue} onChange={event => setLoadValue(event.target.value)} className="mt-1 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-base text-white" placeholder="Sin dato" /></label>}
            <label className="mb-3 block text-xs text-[#A0A0A8]">RIR realizado (opcional)<input type="number" min="0" step="0.5" value={rirValue} onChange={event => setRirValue(event.target.value)} className="mt-1 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-base text-white" placeholder="Sin dato" /></label>
            <label className="mb-3 block text-xs text-[#A0A0A8]">Observación (opcional)<textarea maxLength={500} value={note} onChange={event => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-[#303036] bg-[#101012] p-3 text-sm text-white" rows={2} /></label>
            {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
            <div className="flex gap-2">
              {editingResult && <button type="button" onClick={resetForm} className="rounded-full border border-[#3A3A40] px-4 py-3 text-sm">Cancelar</button>}
              <button type="button" onClick={() => void handleSaveSet()} disabled={saving || finalized || !canSaveCurrentSet} className="flex-1 rounded-full bg-[var(--accent-color,#CFFF5C)] py-3 font-bold text-[#101012] disabled:opacity-50">{saving ? 'Guardando…' : editingResult ? 'Guardar cambios' : canSaveCurrentSet ? 'Guardar serie' : 'Series del ejercicio guardadas'}</button>
            </div>
          </section>

          {allResults.length > 0 && (
            <section className="mb-5 space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E94]">Ejecución guardada</h2>
              {allResults.map(result => {
                const exercise = exercises.find(item => item.id === result.exercise_id);
                return <button key={result.id} type="button" onClick={() => beginEdit(result)} className="flex w-full items-center justify-between rounded-xl border border-[#2A2A2F] bg-[#1B1B1F] p-3 text-left text-xs"><span>{exercise?.name || 'Ejercicio'} · serie {result.set_number}</span><span>{resultValue(result)} · Editar</span></button>;
              })}
            </section>
          )}

          {allPlannedSetsRecorded && <p className="mb-3 text-sm text-emerald-300">Todas las series prescritas tienen un resultado guardado.</p>}
          {error && !currentExercise && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
          <button type="button" onClick={() => leaveWorkout(() => void handleFinish())} disabled={finishing || saving} className="mt-auto w-full rounded-full border border-[#3A3A40] bg-[#1B1B1F] py-4 font-bold disabled:opacity-50">{finishing ? 'Finalizando…' : 'Finalizar sesión'}</button>
        </>
      )}
    </div>
  );
};
