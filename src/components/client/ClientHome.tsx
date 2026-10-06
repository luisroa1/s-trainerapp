import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { programFromActiveAssignment } from '../../lib/clientProgramAssignment.mjs';
import { ProgramDay } from '../../types';
import { Check, User, Bell, MessageSquare, Moon, MoonStar, Dumbbell, Salad, Flame, ChevronRight, MoreHorizontal } from 'lucide-react';
import { ClientMotivationalModal, MotivationType } from './ClientMotivationalModal';
import heroTrainingPhoto from '../../assets/hero-training.jpg';

/* Icono de zapatilla (no existe en lucide-react) — silueta de perfil,
   para el chip de "Pasos", igual estilo trazo que el resto de íconos. */
const ShoeIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M2.5 15.2c0-.9.6-1.6 1.4-1.9l3.1-1c.6-.2 1.1-.6 1.4-1.1l1.6-2.7c.3-.5.9-.8 1.5-.8.9 0 1.6.7 1.6 1.6v1.1c0 .5.2.9.6 1.2l3.4 2.7c.5.4 1.1.6 1.7.6h2.2c.7 0 1.3.6 1.3 1.3v1.2c0 .8-.6 1.4-1.4 1.5-3.3.3-10.2.9-14.6.9-1.6 0-2.8-1.1-2.8-2.6Z" />
    <path d="M3 16.4c1 .4 2.1.6 3.3.6h15.2" />
  </svg>
);

interface ClientHomeProps {
  onStartWorkout: () => void;
  onNavigateTab: (tab: 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil') => void;
  hasActiveSession?: boolean;
}

export const ClientHome: React.FC<ClientHomeProps> = ({ onStartWorkout, onNavigateTab, hasActiveSession = false }) => {
  const { activeClient, appName, activeProgramAssignment, activeProgramAssignmentStatus, activeProgramAssignmentError } = useApp();
  const [activeModal, setActiveModal] = useState<MotivationType | null>(null);

  const firstName = activeClient?.name ? (activeClient.name.split(' ')[0] || 'Jesús') : 'Jesús';

  const weeklySchedule = activeClient?.weeklySchedule || [];
  const completedCount = weeklySchedule.filter(s => s.status === 'completed').length;
  const targetCount = weeklySchedule.filter(s => s.status !== 'rest').length;

  // The active immutable snapshot is the sole Client prescription source.
  const assignedProgram = programFromActiveAssignment(activeProgramAssignment) as {
    id: string; versionId: string; versionNumber: number; days: ProgramDay[];
  } | null;

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

  return (
    <div className="flex flex-col min-h-full pb-[76px] px-5 pt-3 bg-[#101012] text-[#F5F4F0]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 32" fill="none" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-9 shrink-0">
            <path d="M17 2c-6 0-6 6 0 6s6 6 0 6-6 6 0 6" />
            <path d="M7 2c6 0 6 6 0 6s-6 6 0 6 6 6 0 6" />
          </svg>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[#F5F4F0] font-display leading-none">
              {appName}
            </h1>
            <p className="text-[8px] tracking-[0.25em] text-[#8E8E94] font-bold uppercase leading-none mt-1">
              ENTRENA · REPITE · PROGRESA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Notificaciones — decorativo, sin acción todavía (igual que la fila "Notificaciones" en Perfil) */}
          <Bell className="w-5 h-5 text-[#F5F4F0]" strokeWidth={1.75} />

          <button
            onClick={() => onNavigateTab('perfil')}
            className="glow-cyan w-11 h-11 rounded-full bg-[#1B1B1F] border-2 border-cyan-400 flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] transition-colors overflow-hidden shrink-0"
            title="Ver perfil"
          >
            {activeClient.avatarUrl ? (
              <img src={activeClient.avatarUrl} alt={activeClient.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-4">
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
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
            ESTA SEMANA
          </span>
        </div>

        {/* Days Circle Matrix */}
        <div className="flex items-center justify-between">
          {weeklySchedule.map((dayItem, index) => {
            const isCompleted = dayItem.status === 'completed';
            const isPendingToday = dayItem.status === 'pending';
            const isProtected = dayItem.status === 'protected_streak';
            const isRest = dayItem.status === 'rest';
            const isTrainingDay = dayItem.status !== 'rest';

            return (
              <div key={index} className="flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-medium text-[#8E8E94]">
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

        <p className="text-[11px] text-[#8E8E94] mt-2 text-center font-medium">
          {completedCount}/{targetCount} entrenamientos completados
        </p>
      </div>

      {/* ENTRENAMIENTO DE HOY */}
      <div className="relative rounded-[24px] border border-[#2A2A2F] mb-3 shadow-2xl overflow-hidden">
        {/* Foto de fondo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroTrainingPhoto})` }}
        />
        {/* Veladura oscura para legibilidad del texto sobre la foto */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/75 to-[#0B0B0D]/25" />
        {/* Acentos de esquina en cian, estilo referencia */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-[24px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-cyan-400/70 rounded-br-[24px] pointer-events-none" />

        <div className="relative p-5">
        <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2.5">
          ENTRENAMIENTO DE HOY
        </span>

        {activeProgramAssignmentStatus === 'loading' ? (
          <p role="status" className="text-sm text-[#8E8E94]">Cargando tu prescripción…</p>
        ) : activeProgramAssignmentStatus === 'error' ? (
          <p role="alert" className="text-sm text-red-300">{activeProgramAssignmentError || 'No se pudo cargar tu prescripción.'}</p>
        ) : !activeProgramAssignment ? (
          <div>
            <h3 className="text-[28px] font-extrabold font-display text-[#F5F4F0] leading-tight">
              Sin programa asignado
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-2.5">
              Contacta con tu entrenador para que te asigne una rutina personalizada
            </p>
            <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> pronto tendrás tu plan de entrenamiento asignado.
              </p>
            </div>
          </div>
        ) : !assignedProgram || assignedProgram.days.length === 0 ? (
          <div>
            <h3 className="text-[28px] font-extrabold font-display text-[#F5F4F0] leading-tight">Tu prescripción aún no contiene sesiones</h3>
            <p className="text-xs text-[#8E8E94] mt-1">Tu entrenador podrá completar el programa cuando esté listo.</p>
          </div>
        ) : isRestDay ? (
          <div>
            <h3 className="text-[28px] font-extrabold font-display text-[#F5F4F0] leading-tight">
              Día de descanso
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-2.5">
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
            <h3 className="text-[28px] font-extrabold font-display text-[#F5F4F0] leading-tight">
              {currentDay?.focusArea || currentDay?.title || 'Entrenamiento'}
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-2.5">
              {`Has completado ${currentDay?.exercises?.length || 0} ejercicio${(currentDay?.exercises?.length || 0) === 1 ? '' : 's'} hoy`}
            </p>
            <div className="p-3 rounded-[12px] bg-[#16161A]/80 border border-[#2A2A2F] flex items-start gap-2.5 mb-3">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {trainerMessage}
              </p>
            </div>
            {/* Estado final: sin onClick a propósito — no debe permitir
                reiniciar el entrenamiento ya completado hoy. */}
            <div className="glow-cyan w-full py-3.5 px-5 rounded-2xl border border-cyan-400/60 bg-[#101012]/90 flex items-center gap-3">
              <Dumbbell className="w-7 h-7 text-[#F5F4F0] shrink-0" strokeWidth={2} />
              <span className="flex-1 leading-tight">
                <span className="block text-base font-extrabold text-[#F5F4F0]">Entrenamiento</span>
                <span className="block text-base font-extrabold text-cyan-400">finalizado</span>
              </span>
              <div className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-[#05090B] stroke-[3]" />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-[28px] font-extrabold font-display text-[#F5F4F0] leading-tight">
              {currentDay?.focusArea || currentDay?.title || 'Entrenamiento'}
            </h3>
            <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-2.5">
              {`${estimatedDurationText} · ${currentDay?.exercises?.length || 0} ejercicio${(currentDay?.exercises?.length || 0) === 1 ? '' : 's'}`}
            </p>

            {/* Coach tip note */}
            <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5 mb-3">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed">
                <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {trainerMessage}
              </p>
            </div>

            {/* Action Button — mismo onClick y mismo texto condicional que antes, solo cambia el formato visual */}
            <button
              onClick={onStartWorkout}
              className="glow-cyan w-full py-3 pl-5 pr-3 rounded-2xl border border-cyan-300/70 bg-gradient-to-r from-cyan-400/30 via-cyan-400/15 to-transparent backdrop-blur-sm transition-all active:scale-[0.98] hover:opacity-95 flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-3 min-w-0">
                <Dumbbell className="w-6 h-6 text-[#F5F4F0] shrink-0" strokeWidth={2} />
                <span className="text-base font-extrabold text-[#F5F4F0] text-left leading-tight">
                  {(() => {
                    const label = hasActiveSession ? 'Continuar entrenamiento' : 'Empezar entrenamiento';
                    const [firstWord, ...rest] = label.split(' ');
                    return (
                      <>
                        <span className="block">{firstWord}</span>
                        <span className="block">{rest.join(' ')}</span>
                      </>
                    );
                  })()}
                </span>
              </span>
              <span className="w-9 h-9 rounded-full bg-cyan-400 flex items-center justify-center shrink-0">
                <ChevronRight className="w-5 h-5 text-[#05090B]" strokeWidth={3} />
              </span>
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Metric chips — icono con glow + número + etiqueta, misma fila (mismos 5 datos reales que antes) */}
      <div className="flex items-stretch justify-between gap-1.5">
        {/* Pasos (#FF6B4A) */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F]">
          <ShoeIcon className="w-5 h-5 shrink-0" style={{ color: '#5CD6FF', filter: 'drop-shadow(0 0 5px rgba(92,214,255,0.75))' }} />
          <span className="text-[14px] font-extrabold font-display text-[#F5F4F0] leading-tight text-center break-words w-full">
            {activeClient.metrics.stepsToday.toLocaleString()}
          </span>
          <span className="text-[7.5px] font-bold tracking-tight text-[#8E8E94] uppercase leading-tight break-words w-full text-center">
            Pasos
          </span>
        </div>

        {/* Entrenamientos (dato ya calculado arriba: completedCount/targetCount) */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F]">
          <Dumbbell className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-color, #CFFF5C)', filter: 'drop-shadow(0 0 5px rgba(207,255,92,0.75))' }} />
          <span className="text-[14px] font-extrabold font-display text-[#F5F4F0] leading-tight text-center break-words w-full">
            {completedCount}/{targetCount}
          </span>
          <span className="text-[7.5px] font-bold tracking-tight text-[#8E8E94] uppercase leading-tight break-words w-full text-center">
            Entren.
          </span>
        </div>

        {/* Kcal (mismo dato real de kcal de hoy) */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F]">
          <Flame className="w-5 h-5 shrink-0" style={{ color: '#FF6B4A', filter: 'drop-shadow(0 0 5px rgba(255,107,74,0.75))' }} />
          <span className="text-[14px] font-extrabold font-display text-[#F5F4F0] leading-tight text-center break-words w-full">
            {activeClient.metrics.kcalToday.toLocaleString()}
          </span>
          <span className="text-[7.5px] font-bold tracking-tight text-[#8E8E94] uppercase leading-tight break-words w-full text-center">
            Kcal
          </span>
        </div>

        {/* Nutrición (mismo dato real de kcal de hoy — enlaza a la pestaña Nutrición) */}
        <div
          onClick={() => onNavigateTab('nutricion')}
          className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] cursor-pointer hover:border-[#3A3A40] transition-colors"
        >
          <Salad className="w-5 h-5 shrink-0" style={{ color: '#5CFFC4', filter: 'drop-shadow(0 0 5px rgba(92,255,196,0.75))' }} />
          <span className="text-[14px] font-extrabold font-display text-[#F5F4F0] leading-tight text-center break-words w-full">
            {activeClient.metrics.kcalToday.toLocaleString()}
          </span>
          <span className="text-[7.5px] font-bold tracking-tight text-[#8E8E94] uppercase leading-tight break-words w-full text-center">
            Nutrición
          </span>
        </div>

        {/* Sueño (#B388FF) */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F]">
          <MoonStar className="w-5 h-5 shrink-0" style={{ color: '#B388FF', filter: 'drop-shadow(0 0 5px rgba(179,136,255,0.75))' }} />
          <span className="text-[14px] font-extrabold font-display text-[#F5F4F0] leading-tight text-center break-words w-full">
            {activeClient.metrics.sleepHours}
          </span>
          <span className="text-[7.5px] font-bold tracking-tight text-[#8E8E94] uppercase leading-tight break-words w-full text-center">
            Sueño
          </span>
        </div>
      </div>

      {/* Entrenamiento de hoy — tarjeta con miniatura, mismos datos reales que el hero de arriba */}
      {assignedProgram && currentDay && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-base font-extrabold font-display text-[#F5F4F0]">
              Entrenamiento de hoy
            </h3>
            <button
              onClick={() => onNavigateTab('entreno')}
              className="text-xs font-bold text-cyan-400"
            >
              Ver todo
            </button>
          </div>

          <div className="p-2 rounded-[18px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-[12px] bg-cover bg-center shrink-0"
              style={{ backgroundImage: `url(${heroTrainingPhoto})` }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-extrabold font-display text-[#F5F4F0] leading-tight truncate">
                {currentDay?.focusArea || currentDay?.title || 'Entrenamiento'}
              </h4>
              <p className="text-[11px] text-[#8E8E94] font-medium mt-0.5 mb-1.5">
                {`${estimatedDurationText}  |  ${currentDay?.exercises?.length || 0} ejercicio${(currentDay?.exercises?.length || 0) === 1 ? '' : 's'}`}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-[#232328] flex items-center justify-center">
                  <Dumbbell className="w-3 h-3 text-[#8E8E94]" />
                </span>
                <span className="w-6 h-6 rounded-full bg-[#232328] flex items-center justify-center text-[9px] font-bold text-[#8E8E94]">
                  {currentDay?.exercises?.length || 0}
                </span>
                <span className="w-6 h-6 rounded-full bg-[#232328] flex items-center justify-center text-[#8E8E94]">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
            <button
              onClick={isTodayCompleted ? undefined : onStartWorkout}
              disabled={isTodayCompleted}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-[0.95] ${
                isTodayCompleted ? 'bg-[#232328] text-[#5C5C62]' : 'glow-cyan bg-cyan-400 text-[#05090B]'
              }`}
            >
              <ChevronRight className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

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
