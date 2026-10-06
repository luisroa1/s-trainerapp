import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, Play, MessageSquare, Check, Clock, Minus, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkoutSetRecord, ProgramDay } from '../../types';
import { programFromActiveAssignment } from '../../lib/clientProgramAssignment.mjs';

// Descanso estándar entre series (antes 120s / 2:00, ahora 90s / 1:30)
const STANDARD_REST_SECONDS = 90;

const formatRestTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, totalSeconds);
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Extrae el número objetivo (kg) del campo de texto libre del ejercicio
// ("80 kg" -> 80, "Peso corp." -> 0). No asume ningún ejercicio concreto.
const parseTargetWeight = (weight: string): number => {
    const match = weight.replace(',', '.').match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

// Progreso del entrenamiento en curso. Vive en ClientApp (que nunca se
// desmonta) para sobrevivir a la navegación WorkoutExercise -> WorkoutRest
// -> WorkoutExercise, sea cual sea el ejercicio o el número de series.
export interface WorkoutProgress {
  // Indica si hay una sesión de entrenamiento en curso (para distinguir
  // "Empezar" de "Continuar" en Hoy). No se toca al navegar con "←"/"X":
  // solo se pone a true al iniciar una sesión nueva y a false cuando se
  // completa el último ejercicio del día.
  sessionActive: boolean;
  currentExerciseIndex: number;
  activeSetIndex: number;
  completedSets: WorkoutSetRecord[];
}

export interface RecordedSetInfo {
  setNum: number;
  weight: number;
  reps: number;
  targetSets: number;
  targetWeight: number;
  targetReps: number;
  targetRir: number;
}

interface WorkoutExerciseProps {
  onBack: () => void;
  onClose: () => void;
  onGoToRest: (recordedSet: RecordedSetInfo) => void;
  progress: WorkoutProgress;
  onProgressChange: (progress: WorkoutProgress) => void;
}

export const WorkoutExercise: React.FC<WorkoutExerciseProps> = ({
  onBack,
  onClose,
  onGoToRest,
  progress,
  onProgressChange
}) => {
  const { activeClient, activeProgramAssignment, activeProgramAssignmentStatus, activeProgramAssignmentError, updateClient } = useApp();
  const { currentExerciseIndex, activeSetIndex, completedSets } = progress;

  // Resuelve el día de hoy con el mismo calendario semanal que ya usa
  // ClientHome: activeClient.weeklySchedule (L, M, X, J, V, S, D).
  // JS Date.getDay(): 0=domingo..6=sábado.
  const WEEKDAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;
  const todayLetter = WEEKDAY_LETTERS[new Date().getDay()];
  const todaySchedule = activeClient.weeklySchedule.find(s => s.day === todayLetter);
  const isRestDay = !todaySchedule || todaySchedule.status === 'rest';

  const assignedProgram = programFromActiveAssignment(activeProgramAssignment) as {
    id: string; versionId: string; versionNumber: number; days: ProgramDay[];
  } | null;

  // El nº de día de entrenamiento (excluyendo descansos) determina qué
  // ProgramDay corresponde a hoy: p.ej. si X es descanso, J es el tercer
  // día de entrenamiento de la semana -> days[2]. Sin fallback silencioso
  // a days[0]: si hoy no es un día de entrenamiento real, no hay ProgramDay.
  let todaysDay: ProgramDay | undefined;
  if (!isRestDay) {
    const trainingDaysInOrder = activeClient.weeklySchedule.filter(s => s.status !== 'rest');
    const trainingDayIndex = trainingDaysInOrder.findIndex(s => s.day === todayLetter);
    todaysDay = trainingDayIndex >= 0 ? assignedProgram?.days?.[trainingDayIndex] : undefined;
  }

  const exercises = todaysDay ? [...todaysDay.exercises].sort((a, b) => a.order - b.order) : [];
  const totalExercises = exercises.length;
  const currentExercise = exercises[currentExerciseIndex];

  const targetSets = currentExercise?.sets ?? 0;
  const targetReps = currentExercise?.reps ?? 0;
  const targetWeight = currentExercise ? parseTargetWeight(currentExercise.weight) : 0;
  const targetRir = currentExercise?.rir ?? 0;

  const [activeSetWeight, setActiveSetWeight] = useState(targetWeight);
  const [activeSetReps, setActiveSetReps] = useState(targetReps);
  const [pendingTransition, setPendingTransition] = useState<{
    name: string;
    muscleGroup: string;
    sets: number;
    reps: number;
    weight: string;
    rir: number;
  } | null>(null);
  const [workoutCompleteScreen, setWorkoutCompleteScreen] = useState(false);
  // Pantalla de resumen previa al primer ejercicio: solo se muestra al
  // arrancar una sesión nueva (nada registrado todavía). Es una capa
  // puramente visual, calculada una vez al montar; no altera
  // workoutProgress ni su lógica de arranque/reanudación.
  const [showIntro, setShowIntro] = useState(
    () => currentExerciseIndex === 0 && activeSetIndex === 0 && completedSets.length === 0
  );

  // Cuando cambia el ejercicio activo o la serie activa, los inputs se
  // rellenan con el objetivo correspondiente (genérico, no hardcodeado).
  useEffect(() => {
    setActiveSetWeight(targetWeight);
    setActiveSetReps(targetReps);
  }, [currentExercise?.id, activeSetIndex, targetWeight, targetReps]);
  // Auto-retorno a Hoy tras mostrar el estado final (cancelable si el
  // usuario pulsa "Volver a Hoy" antes, o si el componente se desmonta).
  useEffect(() => {
    if (!workoutCompleteScreen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2500);
    return () => clearTimeout(timer);
  }, [workoutCompleteScreen]);

  if (activeProgramAssignmentStatus === 'loading') {
    return <div role="status" className="min-h-full p-8 text-sm text-[#8E8E94]">Cargando tu prescripción…</div>;
  }
  if (activeProgramAssignmentStatus === 'error') {
    return <div role="alert" className="min-h-full p-8 text-sm text-red-300">{activeProgramAssignmentError || 'No se pudo cargar tu prescripción.'}</div>;
  }
  if (!activeProgramAssignment) {
    return <div className="min-h-full p-8 text-center text-sm text-[#8E8E94]">No tienes un programa asignado.</div>;
  }

  const allSetsCompleted = targetSets > 0 && completedSets.length >= targetSets;
  const hasNextExercise = currentExerciseIndex + 1 < totalExercises;

  const handleRegisterSet = () => {
    if (!currentExercise || allSetsCompleted) return;

    const record: WorkoutSetRecord = {
      setNumber: activeSetIndex + 1,
      weight: activeSetWeight,
      reps: activeSetReps,
      completed: true,
      rir: targetRir
    };

    const nextCompleted = [...completedSets, record];
    const hasMoreSets = nextCompleted.length < targetSets;

    if (hasMoreSets) {
      // Series intermedias: conserva el progreso en el padre (ClientApp) y
      // navega a la pantalla de descanso.
      onProgressChange({
        sessionActive: true,
        currentExerciseIndex,
        activeSetIndex: activeSetIndex + 1,
        completedSets: nextCompleted
      });

      onGoToRest({
        setNum: record.setNumber,
        weight: record.weight,
        reps: record.reps,
        targetSets,
        targetWeight,
        targetReps,
        targetRir
      });
      return;
    }

    // Última serie del ejercicio: nunca se inicia descanso.
    if (hasNextExercise) {
      // Pasa directo al siguiente ejercicio, reiniciando su progreso. La
      // sesión sigue activa: aún quedan ejercicios por completar hoy.
      onProgressChange({
        sessionActive: true,
        currentExerciseIndex: currentExerciseIndex + 1,
        activeSetIndex: 0,
        completedSets: []
      });
      // Capa visual de transición entre ejercicios: no altera
      // workoutProgress (ya actualizado arriba). currentExerciseIndex ya
      // apunta al siguiente ejercicio exactamente igual que antes.
      const nextEx = exercises[currentExerciseIndex + 1];
      if (nextEx) {
        setPendingTransition({
          name: nextEx.name,
          muscleGroup: nextEx.muscleGroup,
          sets: nextEx.sets,
          reps: nextEx.reps,
          weight: nextEx.weight,
          rir: nextEx.rir
        });
      }
    } else {
      // Era el último ejercicio del día: se marca esta última serie como
      // completada, se deja visible el estado "Entrenamiento completado" y
      // se cierra la sesión (Hoy volverá a mostrar "Empezar entrenamiento").
      onProgressChange({
        sessionActive: false,
        currentExerciseIndex,
        activeSetIndex: activeSetIndex + 1,
        completedSets: nextCompleted
      });

      // Persiste la finalización del entrenamiento en el calendario del cliente.
      // Se actualiza únicamente el día actual; los demás estados permanecen intactos.
      const completedWeeklySchedule = activeClient.weeklySchedule.map(day =>
        day.day === todayLetter ? { ...day, status: 'completed' as const } : day
      );
      updateClient(activeClient.id, { weeklySchedule: completedWeeklySchedule });

      setWorkoutCompleteScreen(true);
    }
  };

  // Resumen del entrenamiento de hoy, antes de entrar al primer ejercicio.
  if (showIntro && todaysDay && totalExercises > 0) {
    return (
      <div className="flex flex-col min-h-full pb-10 px-5 pt-3 bg-[#101012] text-[#F5F4F0]">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-bold tracking-widest text-[#8E8E94] uppercase">
            RESUMEN
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight mt-2">
          {todaysDay.focusArea || todaysDay.title}
        </h2>
        <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-4">
          {`${totalExercises} ejercicio${totalExercises === 1 ? '' : 's'} · ${todaysDay.title}`}
        </p>

        <div className="flex flex-col gap-2.5">
          {exercises.map((ex, idx) => (
            <div
              key={ex.id}
              className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-[#16161A] border border-[#2A2A2F] flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#8E8E94]">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#F5F4F0] truncate">{ex.name}</p>
                <p className="text-[11px] text-[#8E8E94] font-medium">
                  {`${ex.muscleGroup} · ${ex.sets} × ${ex.reps} · ${ex.weight} · RIR ${ex.rir}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowIntro(false)}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="glow-accent w-full py-4 rounded-full font-bold text-base transition-transform active:scale-[0.98] mt-6"
        >
          Comenzar
        </button>
      </div>
    );
  }

  // Sin programa asignado o sin ejercicios en el día: estado vacío real,
  // no un fallback con datos inventados.
  if (workoutCompleteScreen) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center pb-10 px-5 pt-3 bg-[#101012] text-[#F5F4F0] text-center gap-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-emerald-500">
          <Check className="w-10 h-10 stroke-[3] text-[#101012]" />
        </div>
        <span className="text-xl font-extrabold font-display text-emerald-500 tracking-wide uppercase">
          Entrenamiento completado
        </span>
        <p className="text-sm text-[#8E8E94] max-w-[260px]">
          Has completado los {totalExercises} ejercicios de hoy.
        </p>
        <p className="text-xs text-[#8E8E94]">
          Sesión registrada correctamente.
        </p>
        <button
          onClick={onClose}
          className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98] mt-auto bg-emerald-500 text-[#101012]"
        >
          Volver a Hoy
        </button>
      </div>
    );
  }

  if (pendingTransition) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center pb-10 px-5 pt-3 bg-[#101012] text-[#F5F4F0] text-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
        >
          <Check className="w-8 h-8 stroke-[3]" />
        </div>
        <span className="text-xs font-bold tracking-widest text-[#8E8E94] uppercase">
          Ejercicio completado
        </span>

        <div className="w-full mt-4 p-5 rounded-[20px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-bold tracking-widest text-[#8E8E94] uppercase">
            Siguiente ejercicio
          </span>
          <span className="text-xl font-extrabold font-display text-[#F5F4F0]">
            {pendingTransition.name}
          </span>
          <span className="text-xs font-medium text-[#8E8E94]">
            {pendingTransition.muscleGroup}
          </span>
          <span className="text-sm font-bold text-[#F5F4F0] mt-1">
            {pendingTransition.sets} × {pendingTransition.reps} · {pendingTransition.weight} · RIR {pendingTransition.rir}
          </span>
        </div>

        <button
          onClick={() => setPendingTransition(null)}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="glow-accent w-full py-4 rounded-full font-bold text-base transition-transform active:scale-[0.98] mt-auto"
        >
          Continuar
        </button>
      </div>
    );
  }
  if (!currentExercise) {
    const workoutFinished = totalExercises > 0 && currentExerciseIndex >= totalExercises;
    return (
      <div className="flex flex-col min-h-full pb-10 px-5 pt-3 bg-[#101012] text-[#F5F4F0]">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-bold tracking-widest text-[#8E8E94] uppercase">
            {workoutFinished ? 'ENTRENAMIENTO' : isRestDay ? 'DESCANSO' : 'HOY'}
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="text-lg font-bold text-[#F5F4F0]">
            {workoutFinished
              ? '¡Entrenamiento completado!'
              : isRestDay
                ? 'Hoy toca descanso'
                : 'No hay ejercicios programados para hoy'}
          </span>
          <p className="text-xs text-[#8E8E94] max-w-[240px]">
            {workoutFinished
              ? 'Has registrado todas las series de todos los ejercicios de hoy.'
              : isRestDay
                ? 'Tu calendario semanal marca hoy como día de descanso. No hay sesión que iniciar.'
                : 'Tu entrenador todavía no ha asignado un programa con ejercicios para hoy.'}
          </p>
          <button
            onClick={onClose}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="mt-2 px-6 py-3 rounded-full font-bold text-sm shadow-lg active:scale-95 transition-transform"
          >
            {workoutFinished ? 'Finalizar' : 'Volver'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-10 px-5 pt-3 bg-[#101012] text-[#F5F4F0]">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-bold tracking-widest text-[#8E8E94] uppercase">
          EJERCICIO {currentExerciseIndex + 1} DE {totalExercises}
        </span>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar — un segmento por ejercicio real del día, no fijo */}
      <div className="flex gap-1.5 mb-4">
        {exercises.map((ex, idx) => (
          <div
            key={ex.id}
            className={`h-1.5 flex-1 rounded-full ${
              idx === currentExerciseIndex
                ? 'bg-[var(--accent-color,#CFFF5C)]'
                : 'bg-[#2A2A2F]'
            }`}
          />
        ))}
      </div>

      {/* Trainer Tip Card */}
      {currentExercise.trainerTip && (
        <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5 mb-4">
          <MessageSquare className="w-4 h-4 text-[var(--accent-color,#CFFF5C)] shrink-0 mt-0.5" />
          <p className="text-xs text-[#8E8E94] leading-relaxed">
            <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {currentExercise.trainerTip}
          </p>
        </div>
      )}

      {/* Video Demonstration Card */}
      <div className="hero-abstract-bg relative w-full h-36 rounded-[16px] border border-[#2A2A2F] flex flex-col items-center justify-center overflow-hidden mb-4 group cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-[#101012]/80 border border-[#3A3A40] flex items-center justify-center text-[#F5F4F0] group-hover:scale-110 group-hover:text-[var(--accent-color,#CFFF5C)] transition-all">
          <Play className="w-5 h-5 ml-0.5 fill-current" />
        </div>
        <span className="text-[11px] text-[#8E8E94] mt-2 font-medium">
          Vídeo del ejercicio
        </span>
      </div>

      {/* Exercise Title */}
      <div className="mb-4">
        <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
          {currentExercise.name}
        </h2>
        <p className="text-xs text-[#8E8E94] font-medium mt-0.5">
          {currentExercise.muscleGroup}
        </p>
      </div>

      {/* Target specs */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider mb-2">
          <span>OBJETIVO DEL EJERCICIO</span>
          <span className="flex items-center gap-1 font-normal lowercase">
            <Clock className="w-3 h-3" /> Descanso {formatRestTime(currentExercise.restSeconds || STANDARD_REST_SECONDS)} entre series
          </span>
        </div>

        {/* 3 Pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center">
            <span className="text-sm font-bold text-[#F5F4F0]">{targetSets} × {targetReps}</span>
          </div>
          <div className="p-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center">
            <span className="text-sm font-bold text-[#F5F4F0]">{currentExercise.weight}</span>
          </div>
          <div className="p-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center">
            <span className="text-sm font-bold text-[#F5F4F0]">RIR {targetRir}</span>
          </div>
        </div>
      </div>

      {/* Series list — generada dinámicamente a partir de targetSets (que
          viene de currentExercise.sets): soporta cualquier número de series. */}
      <div className="flex flex-col gap-2 mb-6">
        {Array.from({ length: targetSets }).map((_, idx) => {
          const setNumber = idx + 1;
          const completedRecord = completedSets[idx];
          const isActive = !completedRecord && idx === activeSetIndex && !allSetsCompleted;

          if (completedRecord) {
            return (
              <div key={idx} className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className="text-xs font-semibold text-[#F5F4F0]">Serie {setNumber}</span>
                </div>
                <span className="text-xs font-bold text-[var(--accent-color,#CFFF5C)]">
                  {completedRecord.weight.toString().replace('.', ',')} kg × {completedRecord.reps}
                </span>
              </div>
            );
          }

          if (isActive) {
            return (
              <div key={idx} className="glow-accent p-3 rounded-[14px] bg-[#1B1B1F] border-2 border-[var(--accent-color,#CFFF5C)] flex items-center justify-between">
                <span className="text-xs font-bold text-[#F5F4F0]">Serie {setNumber}</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5 bg-[#101012] border border-[#2A2A2F] rounded-lg px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setActiveSetWeight(w => Math.max(0, w - 1))}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-[#F5F4F0] w-9 text-center leading-none">
                      {activeSetWeight}
                      <span className="text-[9px] text-[#8E8E94] font-medium ml-0.5">kg</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSetWeight(w => w + 1)}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5 bg-[#101012] border border-[#2A2A2F] rounded-lg px-1 py-1">
                    <button
                      type="button"
                      onClick={() => setActiveSetReps(r => Math.max(0, r - 1))}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-[#F5F4F0] w-7 text-center leading-none">
                      {activeSetReps}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSetReps(r => r + 1)}
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={handleRegisterSet}
                    disabled={allSetsCompleted}
                    style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shadow-md active:scale-90 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="p-3 rounded-[14px] bg-[#16161A] border border-[#2A2A2F]/50 flex items-center justify-between opacity-60">
              <span className="text-xs font-medium text-[#5C5C62]">Serie {setNumber}</span>
              <span className="text-xs text-[#5C5C62]">
                Objetivo: {currentExercise.weight} × {targetReps}
              </span>
            </div>
          );
        })}
      </div>

      {/* Estado completado / botón de registro. El descanso ya no es
          inline: navega a WorkoutRest vía onGoToRest (ver handleRegisterSet). */}
      {allSetsCompleted ? (
        <div className="mt-auto p-4 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-center">
          <span className="text-sm font-bold text-[#F5F4F0]">
            {hasNextExercise ? 'Ejercicio completado' : 'Entrenamiento completado'}
          </span>
        </div>
      ) : (
        <button
          onClick={handleRegisterSet}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="glow-accent w-full py-4 rounded-full font-bold text-base transition-transform active:scale-[0.98] mt-auto"
        >
          Registrar y descansar
        </button>
      )}
    </div>
  );
};
