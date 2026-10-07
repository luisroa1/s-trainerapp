import React from 'react';
import { useApp } from '../../context/AppContext';
import { programFromActiveAssignment } from '../../lib/clientProgramAssignment.mjs';
import { ProgramDay, WorkoutSessionView } from '../../types';
import { User, Bell, MessageSquare, Dumbbell, ChevronRight } from 'lucide-react';
import heroTrainingPhoto from '../../assets/hero-training.jpg';

interface ClientHomeProps {
  onStartWorkout: (programDayId: string) => void;
  onContinueWorkout: () => void;
  onRetryWorkoutSession: () => void;
  onNavigateTab: (tab: 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil') => void;
  openWorkoutSession: WorkoutSessionView | null;
  workoutSessionStatus: 'loading' | 'loaded' | 'error';
  workoutSessionError: string | null;
  displayName?: string | null;
}

export const ClientHome: React.FC<ClientHomeProps> = ({ onStartWorkout, onContinueWorkout, onRetryWorkoutSession, onNavigateTab, openWorkoutSession, workoutSessionStatus, workoutSessionError, displayName }) => {
  const { activeClient, appName, activeProgramAssignment, activeProgramAssignmentStatus, activeProgramAssignmentError } = useApp();

  const firstName = (displayName?.trim() || activeClient?.name?.trim() || '').split(/\s+/)[0];

  // The active immutable snapshot is the sole Client prescription source.
  const assignedProgram = programFromActiveAssignment(activeProgramAssignment) as {
    id: string; versionId: string; versionNumber: number; days: ProgramDay[];
  } | null;

  // CORE 1D never selects or records execution from the legacy schedule data.
  const programDays = assignedProgram?.days || [];
  const firstExerciseTip = programDays.flatMap(day => day.exercises).find(exercise => exercise.trainerTip)?.trainerTip;
  const cleanExerciseTip = firstExerciseTip ? firstExerciseTip.replace(/^Tu entrenador:\s*/i, '').trim() : null;
  const trainerMessage = cleanExerciseTip;

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
          Hola{firstName ? `, ${firstName}` : ''}
        </h2>
      </div>

      {/* CORE 1D: el Client elige explícitamente un día del snapshot; el calendario no registra sesiones. */}
      <div className="relative rounded-[24px] border border-[#2A2A2F] mb-3 shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroTrainingPhoto})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/85 to-[#0B0B0D]/50" />
        <div className="relative p-5">
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2.5">ENTRENAMIENTO</span>
          {workoutSessionStatus === 'loading' ? (
            <p role="status" className="text-sm text-[#8E8E94]">Comprobando si tienes una sesión en curso…</p>
          ) : workoutSessionStatus === 'error' ? (
            <div role="alert" className="text-sm text-red-300">
              <p>{workoutSessionError || 'No se pudo comprobar la sesión en curso.'}</p>
              <button type="button" onClick={onRetryWorkoutSession} className="mt-3 rounded-full border border-red-300/40 px-4 py-2 text-xs font-bold">Reintentar</button>
            </div>
          ) : openWorkoutSession ? (
            <div>
              <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
                {openWorkoutSession.day.focusArea || openWorkoutSession.day.title}
              </h3>
              <p className="text-xs text-[#8E8E94] mt-1 mb-3">Tienes una sesión en curso. Puedes continuar donde la dejaste.</p>
              <button onClick={onContinueWorkout} className="glow-cyan w-full py-3 px-5 rounded-2xl border border-cyan-300/70 bg-cyan-400/20 flex items-center justify-between gap-3">
                <span className="text-base font-extrabold text-[#F5F4F0]">Continuar entrenamiento</span>
                <ChevronRight className="w-5 h-5 text-cyan-300" strokeWidth={3} />
              </button>
            </div>
          ) : activeProgramAssignmentStatus === 'loading' ? (
            <p role="status" className="text-sm text-[#8E8E94]">Cargando tu prescripción…</p>
          ) : activeProgramAssignmentStatus === 'error' ? (
            <p role="alert" className="text-sm text-red-300">{activeProgramAssignmentError || 'No se pudo cargar tu prescripción.'}</p>
          ) : !activeProgramAssignment ? (
            <div>
              <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">Tu entrenador está preparando tu planificación</h3>
              <p className="text-xs text-[#8E8E94] mt-1">Cuando esté lista, aparecerá aquí.</p>
            </div>
          ) : programDays.length === 0 ? (
            <div>
              <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">Tu prescripción aún no contiene sesiones</h3>
              <p className="text-xs text-[#8E8E94] mt-1">Tu entrenador podrá completarla cuando esté lista.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-[#8E8E94] mb-1">Elige la sesión prescrita que vas a realizar.</p>
              {programDays.map(day => (
                <div key={day.id} className="p-3 rounded-[14px] bg-[#16161A]/90 border border-[#2A2A2F] flex items-center gap-3">
                  <Dumbbell className="w-5 h-5 text-cyan-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#F5F4F0] truncate">{day.focusArea || day.title}</p>
                    <p className="text-[11px] text-[#8E8E94]">{day.exercises.length} ejercicios · {day.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartWorkout(day.id)}
                    disabled={day.exercises.length === 0}
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-cyan-400 text-[#05090B] disabled:opacity-40 disabled:pointer-events-none"
                    aria-label={`Comenzar ${day.title}`}
                  >
                    <ChevronRight className="w-5 h-5" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {workoutSessionStatus === 'loaded' && openWorkoutSession && (
            <p className="text-[11px] text-[#8E8E94] mt-2">{openWorkoutSession.results.length} series guardadas en esta sesión</p>
          )}
          {trainerMessage && !openWorkoutSession && (
            <div className="p-3 mt-3 rounded-[12px] bg-[#16161A]/90 border border-[#2A2A2F] flex items-start gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
              <p className="text-xs text-[#8E8E94] leading-relaxed"><span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> {trainerMessage}</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
