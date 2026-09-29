import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Check, User, MessageSquare, Moon, Sparkles } from 'lucide-react';
import { ClientMotivationalModal, MotivationType } from './ClientMotivationalModal';

interface ClientHomeProps {
  onStartWorkout: () => void;
  onNavigateTab: (tab: 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil') => void;
  hasActiveSession?: boolean;
}

export const ClientHome: React.FC<ClientHomeProps> = ({ onStartWorkout, onNavigateTab, hasActiveSession = false }) => {
  const { activeClient, appName, programs } = useApp();
  const [activeModal, setActiveModal] = useState<MotivationType | null>(null);

  const firstName = activeClient?.name ? (activeClient.name.split(' ')[0] || 'Jesús') : 'Jesús';

  const weeklySchedule = activeClient?.weeklySchedule || [];
  const completedCount = weeklySchedule.filter(s => s.status === 'completed').length;
  const targetCount = weeklySchedule.filter(s => s.status !== 'rest').length;

  // Localizar el programa asignado al cliente
  const assignedProgram = programs.find(
    p => p.id === activeClient?.assignedProgramId
  );

  // Determinar día de la semana actual (D, L, M, X, J, V, S)
  const DAY_CODES: Array<'D' | 'L' | 'M' | 'X' | 'J' | 'V' | 'S'> = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const currentDayCode = DAY_CODES[new Date().getDay()];

  // Buscar el día actual en el calendario semanal del cliente
  const todaySchedule = weeklySchedule.find(s => s.day === currentDayCode);
  const isRestDay = todaySchedule ? todaySchedule.status === 'rest' : false;
  const isTodayCompleted = todaySchedule ? todaySchedule.status === 'completed' : false;

  // Determinar sesión del programa asignado
  const workoutDaysInSchedule = weeklySchedule.filter(s => s.status !== 'rest');
  const currentDayIndexInWorkouts = workoutDaysInSchedule.findIndex(s => s.day === currentDayCode);

  let currentWorkoutDayIndex = 0;
  if (currentDayIndexInWorkouts >= 0) {
    currentWorkoutDayIndex = currentDayIndexInWorkouts;
  } else {
    // Si hoy no está marcado o es descanso, buscar el primer día pendiente
    const pendingIndex = workoutDaysInSchedule.findIndex(s => s.status === 'pending');
    if (pendingIndex >= 0) {
      currentWorkoutDayIndex = pendingIndex;
    }
  }

  const currentDay = assignedProgram?.days?.[
    currentWorkoutDayIndex % (assignedProgram.days.length || 1)
  ] || assignedProgram?.days?.[0];

  // Cálculo de duración estimada real a partir de los ejercicios del currentDay
  const estimatedDurationText = useMemo(() => {
    const exercises = currentDay?.exercises || [];
    if (exercises.length === 0) return '30–40 min';

    // Estimación:
    // - Cada serie de trabajo: ~45 segundos
    // - Descanso entre series: restSeconds (o 90s por defecto si no está especificado) para cada serie excepto la última serie de cada ejercicio
    // - Transición entre ejercicios: ~90 segundos entre ejercicios distintos
    const WORK_SECONDS_PER_SET = 45;
    const DEFAULT_REST_SECONDS = 90;

    let totalSeconds = 0;
    exercises.forEach((ex, idx) => {
      const sets = Math.max(1, ex.sets || 3);
      const rest = ex.restSeconds > 0 ? ex.restSeconds : DEFAULT_REST_SECONDS;

      // Tiempo de trabajo de todas las series del ejercicio
      totalSeconds += sets * WORK_SECONDS_PER_SET;

      // Tiempo de descanso entre series del ejercicio (sets - 1 descansos)
      totalSeconds += Math.max(0, sets - 1) * rest;

      // Tiempo de transición al siguiente ejercicio (si no es el último)
      if (idx < exercises.length - 1) {
        totalSeconds += Math.max(rest, 90);
      }
    });

    const totalMinutes = Math.round(totalSeconds / 60);
    const minRange = Math.max(15, totalMinutes - 3);
    const maxRange = totalMinutes + 3;

    return `${minRange}–${maxRange} min`;
  }, [currentDay]);

  // Determinar mensaje del entrenador:
  // a) trainerTip de un ejercicio del currentDay
  const firstExerciseTip = currentDay?.exercises?.find(e => e.trainerTip)?.trainerTip;
  const cleanExerciseTip = firstExerciseTip ? firstExerciseTip.replace(/^Tu entrenador:\s*/i, '').trim() : null;

  // b) trainerNote explícitamente relacionada con entrenamiento (excluyendo notas administrativas como "Invitación enviada por email")
  const trainingRelatedNote = useMemo(() => {
    if (!activeClient?.trainerNotes || activeClient.trainerNotes.length === 0) return null;
    const administrativeKeywords = [
      'invitacion',
      'invitación',
      'email',
      'correo',
      'activar',
      'activación',
      'cuenta creada',
      'registro',
      'bienvenida',
      'alta',
      'enviada',
      'enviado'
    ];

    const validNote = activeClient.trainerNotes.find(note => {
      if (!note.content) return false;
      const lower = note.content.toLowerCase();
      const isAdministrative = administrativeKeywords.some(kw => lower.includes(kw));
      return !isAdministrative && lower.length > 5;
    });

    return validNote ? validNote.content.trim() : null;
  }, [activeClient?.trainerNotes]);

  // c) Mensaje técnico genérico apropiado
  const defaultMessage = isRestDay
    ? 'El descanso y la recuperación son fundamentales para asimilar el entrenamiento.'
    : 'Mantén una buena técnica y control en cada repetición.';

  const trainerMessage = cleanExerciseTip || trainingRelatedNote || defaultMessage;

  // Formato de fecha actual localizada
  const formattedToday = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });
  const capitalizedDate = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);

  return (
    <div className="flex flex-col min-h-full pb-20 px-5 pt-4 bg-[#101012] text-[#F5F4F0]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center p-1.5 shadow-sm"
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#101012" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
              <path d="M4 17 L10 11 L14 15 L20 7" />
              <path d="M14 7 H20 V13" />
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider text-[#F5F4F0] font-display leading-tight">
              {appName}
            </h1>
            <p className="text-[7.5px] tracking-[0.2em] text-[#8E8E94] font-semibold uppercase leading-none">
              ENTRENA · REPITE · PROGRESA
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigateTab('perfil')}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40] transition-colors overflow-hidden"
          title="Ver perfil"
        >
          {activeClient.avatarUrl ? (
            <img src={activeClient.avatarUrl} alt={activeClient.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Greeting */}
      <div className="mb-5">
        <span className="text-xs text-[#8E8E94] font-medium block">
          {capitalizedDate}
        </span>
        <h2 className="text-2xl font-extrabold font-display text-[#F5F4F0] tracking-tight">
          Hola, {firstName}
        </h2>
      </div>

      {/* Menstrual Phase Banner (if enabled and shared, as in page 35) */}
      {activeClient.menstrualTracking?.enabled && (
        <div 
          onClick={() => onNavigateTab('perfil')}
          className="mb-4 p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#E8A0C4]/30 flex items-start gap-3 cursor-pointer hover:border-[#E8A0C4]/60 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[#E8A0C4]/15 text-[#E8A0C4] flex items-center justify-center shrink-0 mt-0.5">
            <Moon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#E8A0C4]">
                Fase menstrual — día {activeClient.menstrualTracking.day || 3}
              </span>
            </div>
            <p className="text-[11px] text-[#8E8E94] mt-0.5 leading-snug">
              {activeClient.menstrualTracking.advice || 'Normal si hoy rindes algo menos. Baja intensidad si lo necesitas.'}
            </p>
          </div>
        </div>
      )}

      {/* ESTA SEMANA circles */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
            ESTA SEMANA
          </span>
          <div className="flex items-center gap-1.5">
            {/* Quick preview triggers for motivational popups */}
            <button
              onClick={() => setActiveModal('lunes')}
              className="text-[9px] px-2 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#CFFF5C] transition-colors"
              title="Ver popup Lunes"
            >
              Lunes
            </button>
            <button
              onClick={() => setActiveModal('miercoles')}
              className="text-[9px] px-2 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#CFFF5C] transition-colors"
              title="Ver popup Miércoles"
            >
              Miérc
            </button>
            <button
              onClick={() => setActiveModal('racha')}
              className="text-[9px] px-2 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#CFFF5C] transition-colors"
              title="Ver popup Racha completa"
            >
              Racha
            </button>
          </div>
        </div>

        {/* Days Circle Matrix */}
        <div className="flex items-center justify-between px-1">
          {weeklySchedule.map((dayItem, index) => {
            const isCompleted = dayItem.status === 'completed';
            const isPendingToday = dayItem.status === 'pending';
            const isProtected = dayItem.status === 'protected_streak';
            const isRest = dayItem.status === 'rest';
            const isTrainingDay = dayItem.status !== 'rest';

            return (
              <div key={index} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#8E8E94]">
                  {dayItem.day}
                </span>

                {isCompleted && (
                  <div
                    className="w-9 h-9 rounded-full bg-transparent border-2 border-cyan-400 transition-transform hover:scale-105"
                  />
                )}

                {isPendingToday && (
                  <div className="w-9 h-9 rounded-full bg-transparent border-2 border-red-500" />
                )}

                {isProtected && (
                  <div
                    onClick={() => setActiveModal('racha_protegida')}
                    className="w-9 h-9 rounded-full bg-transparent border-2 border-dashed border-cyan-400 cursor-pointer"
                    title="Racha protegida"
                  />
                )}

                {isRest && (
                  <div className="w-9 h-9 rounded-full bg-transparent border-2 border-[#2A2A2F]" />
                )}
                {isTrainingDay && !isCompleted && !isPendingToday && !isProtected && (
                  <div className="w-9 h-9 rounded-full bg-transparent border-2 border-[#2A2A2F]" />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-[#8E8E94] mt-2.5 text-center font-medium">
          {completedCount}/{targetCount} entrenamientos completados
        </p>
      </div>

      {/* ENTRENAMIENTO DE HOY */}
      <div className="hero-abstract-bg p-5 rounded-[20px] border border-[#2A2A2F] mb-5 shadow-lg">
        <span className="text-[9.5px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2">
          ENTRENAMIENTO DE HOY
        </span>

        {!activeClient?.assignedProgramId ? (
          <div>
            <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              Sin programa asignado
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-3.5">
              Contacta con tu entrenador para que te asigne una rutina personalizada
            </p>
            <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> pronto tendrás tu plan de entrenamiento asignado.
              </p>
            </div>
          </div>
        ) : !assignedProgram ? (
          <div>
            <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              Programa no disponible
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-3.5">
              Programa asignado: {activeClient.assignedProgramId}
            </p>
            <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> estamos preparando tu programa para que puedas comenzar.
              </p>
            </div>
          </div>
        ) : isRestDay ? (
          <div>
            <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              Día de descanso
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-3.5">
              Recuperación activa · Recarga energías para la próxima sesión
            </p>
            <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {trainerMessage}
              </p>
            </div>
          </div>
        ) : isTodayCompleted ? (
          <div>
            <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              {currentDay?.focusArea || currentDay?.title || 'Entrenamiento'}
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-3.5">
              {`Has completado ${currentDay?.exercises?.length || 0} ejercicio${(currentDay?.exercises?.length || 0) === 1 ? '' : 's'} hoy`}
            </p>
            <div className="p-3 rounded-[12px] bg-[#16161A]/80 border border-[#2A2A2F] flex items-start gap-2.5 mb-4">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {trainerMessage}
              </p>
            </div>
            {/* Estado final: sin onClick a propósito — no debe permitir
                reiniciar el entrenamiento ya completado hoy. */}
            <div className="glow-cyan w-full py-3.5 rounded-full border border-cyan-400/50 bg-[#101012] flex items-center justify-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#05090B] stroke-[3]" />
              </div>
              <span className="text-sm font-extrabold text-cyan-400">
                Entrenamiento finalizado
              </span>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
              {currentDay?.focusArea || currentDay?.title || 'Entrenamiento'}
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-3.5">
              {`${estimatedDurationText} · ${currentDay?.exercises?.length || 0} ejercicio${(currentDay?.exercises?.length || 0) === 1 ? '' : 's'}`}
            </p>

            {/* Coach tip note */}
            <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5 mb-4">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {trainerMessage}
              </p>
            </div>

            {/* Action Button — mismo onClick y mismo texto condicional que antes */}
            <button
              onClick={onStartWorkout}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="glow-accent w-full py-3.5 rounded-full font-extrabold text-sm transition-all active:scale-[0.98] hover:opacity-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              {hasActiveSession ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
            </button>
          </div>
        )}
      </div>

      {/* 2x2 Metric Grid with exact color coding */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pasos (#FF6B4A) */}
        <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            PASOS
          </span>
          <div className="my-2">
            <span className="text-lg font-extrabold font-display text-[#F5F4F0]">
              {activeClient.metrics.stepsToday.toLocaleString()}
            </span>
            <span className="text-xs text-[#8E8E94] font-medium ml-1">
              / {activeClient.metrics.stepsGoal.toLocaleString()}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                backgroundColor: '#FF6B4A', 
                width: `${Math.min(100, (activeClient.metrics.stepsToday / activeClient.metrics.stepsGoal) * 100)}%` 
              }}
            />
          </div>
        </div>

        {/* Entrenamientos (dato ya calculado arriba: completedCount/targetCount) */}
        <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            ENTRENAMIENTOS
          </span>
          <div className="my-2">
            <span className="text-lg font-extrabold font-display text-[#F5F4F0]">
              {completedCount}
            </span>
            <span className="text-xs text-[#8E8E94] font-medium ml-1">
              / {targetCount}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                backgroundColor: 'var(--accent-color, #CFFF5C)',
                width: `${targetCount > 0 ? Math.min(100, (completedCount / targetCount) * 100) : 0}%`
              }}
            />
          </div>
        </div>

        {/* Nutrición (#CFFF5C) */}
        <div 
          onClick={() => onNavigateTab('nutricion')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            NUTRICIÓN
          </span>
          <div className="my-2">
            <span className="text-lg font-extrabold font-display text-[#F5F4F0]">
              {activeClient.metrics.kcalToday.toLocaleString()}
            </span>
            <span className="text-xs text-[#8E8E94] font-medium ml-1">
              / {activeClient.metrics.kcalGoal.toLocaleString()} kcal
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#2A2A2F] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                backgroundColor: 'var(--accent-color, #CFFF5C)', 
                width: `${Math.min(100, (activeClient.metrics.kcalToday / activeClient.metrics.kcalGoal) * 100)}%` 
              }}
            />
          </div>
        </div>

        {/* Peso (#5CD6FF) */}
        <div 
          onClick={() => onNavigateTab('progreso')}
          className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            PESO
          </span>
          <div className="my-1.5">
            <span className="text-lg font-extrabold font-display text-[#F5F4F0]">
              {activeClient.currentWeight.toFixed(1).replace('.', ',')} kg
            </span>
          </div>
          <p className="text-[10px] text-[#5CD6FF] font-medium">
            {activeClient.weightWeeklyTrend}
          </p>
        </div>

        {/* Sueño (#B388FF) — ocupa el ancho completo (5º elemento en un grid de 2 columnas) */}
        <div className="col-span-2 p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            SUEÑO
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold font-display text-[#F5F4F0]">
              {activeClient.metrics.sleepHours}
            </span>
            <p className="text-[10px] text-[#B388FF] font-medium">
              {activeClient.metrics.sleepQuality}
            </p>
          </div>
        </div>
      </div>

      {/* Motivational Modal if open */}
      {activeModal && (
        <ClientMotivationalModal
          type={activeModal}
          clientName={activeClient.name}
          onClose={() => setActiveModal(null)}
          onAction={onStartWorkout}
        />
      )}
    </div>
  );
};
