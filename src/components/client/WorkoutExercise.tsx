import React, { useState } from 'react';
import { ArrowLeft, X, Play, MessageSquare, Check, Edit2, Clock } from 'lucide-react';
import { WorkoutSetRecord } from '../../types';

interface WorkoutExerciseProps {
  onBack: () => void;
  onClose: () => void;
  onGoToRest: (recordedSet: { setNum: number; weight: number; reps: number }) => void;
}

export const WorkoutExercise: React.FC<WorkoutExerciseProps> = ({
  onBack,
  onClose,
  onGoToRest
}) => {
  const [currentExerciseIndex] = useState(0); // Exercice 1 of 7: Sentadilla
  const [targetSets, setTargetSets] = useState(4);
  const [targetReps, setTargetReps] = useState(8);
  const [targetWeight, setTargetWeight] = useState(80);
  const [targetRir, setTargetRir] = useState(2);

  const [activeSetIndex, setActiveSetIndex] = useState(2); // Set 3 is active
  const [activeSetWeight, setActiveSetWeight] = useState(80);
  const [activeSetReps, setActiveSetReps] = useState(8);

  const [completedSets, setCompletedSets] = useState<WorkoutSetRecord[]>([
    { setNumber: 1, weight: 80, reps: 8, completed: true, rir: 2 },
    { setNumber: 2, weight: 82.5, reps: 7, completed: true, rir: 2 },
  ]);

  const handleRegisterSet = () => {
    const record = {
      setNumber: activeSetIndex + 1,
      weight: activeSetWeight,
      reps: activeSetReps,
      completed: true,
      rir: targetRir
    };

    setCompletedSets(prev => [...prev, record]);
    onGoToRest({
      setNum: activeSetIndex + 1,
      weight: activeSetWeight,
      reps: activeSetReps
    });
    setActiveSetIndex(prev => prev + 1);
  };

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
          EJERCICIO 1 DE 7
        </span>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 7-Segment Progress Bar */}
      <div className="flex gap-1.5 mb-4">
        {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full ${
              idx === currentExerciseIndex
                ? 'bg-[var(--accent-color,#CFFF5C)]'
                : 'bg-[#2A2A2F]'
            }`}
          />
        ))}
      </div>

      {/* Trainer Tip Card */}
      <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5 mb-4">
        <MessageSquare className="w-4 h-4 text-[var(--accent-color,#CFFF5C)] shrink-0 mt-0.5" />
        <p className="text-xs text-[#8E8E94] leading-relaxed">
          <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> mejora las repeticiones de la semana pasada.
        </p>
      </div>

      {/* Video Demonstration Card */}
      <div className="relative w-full h-36 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col items-center justify-center overflow-hidden mb-4 group cursor-pointer">
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
          Sentadilla
        </h2>
        <p className="text-xs text-[#8E8E94] font-medium mt-0.5">
          Pierna · Cuádriceps
        </p>
      </div>

      {/* Target specs */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] font-bold text-[#8E8E94] uppercase tracking-wider mb-2">
          <span>OBJETIVO DEL EJERCICIO</span>
          <span className="flex items-center gap-1 font-normal lowercase">
            <Clock className="w-3 h-3" /> Descanso 2:00 min entre series
          </span>
        </div>

        {/* 3 Pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-sm font-bold text-[#F5F4F0]">{targetSets} × {targetReps}</span>
            <Edit2 className="w-3 h-3 text-[#5C5C62]" />
          </div>
          <div className="p-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-sm font-bold text-[#F5F4F0]">{targetWeight} kg</span>
            <Edit2 className="w-3 h-3 text-[#5C5C62]" />
          </div>
          <div className="p-2.5 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center">
            <span className="text-sm font-bold text-[#F5F4F0]">RIR {targetRir}</span>
          </div>
        </div>

        <p className="text-[9.5px] text-[#5C5C62] mt-1.5">
          Toca cualquier valor para ajustarlo. Se aplica a las series pendientes.
        </p>
      </div>

      {/* Series list */}
      <div className="flex flex-col gap-2 mb-6">
        {/* Serie 1 (Completed) */}
        <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="text-xs font-semibold text-[#F5F4F0]">Serie 1</span>
          </div>
          <span className="text-xs font-bold text-[var(--accent-color,#CFFF5C)]">
            80 kg × 8
          </span>
        </div>

        {/* Serie 2 (Completed) */}
        <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="text-xs font-semibold text-[#F5F4F0]">Serie 2</span>
          </div>
          <span className="text-xs font-bold text-[var(--accent-color,#CFFF5C)]">
            82,5 kg × 7
          </span>
        </div>

        {/* Serie 3 (Active input) */}
        {activeSetIndex === 2 ? (
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border-2 border-[var(--accent-color,#CFFF5C)] flex items-center justify-between shadow-lg">
            <span className="text-xs font-bold text-[#F5F4F0]">Serie 3</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#101012] border border-[#2A2A2F] rounded-lg px-2 py-1">
                <input
                  type="number"
                  value={activeSetWeight}
                  onChange={e => setActiveSetWeight(Number(e.target.value))}
                  className="w-10 text-xs font-bold text-[#F5F4F0] bg-transparent text-center focus:outline-none"
                />
                <span className="text-[10px] text-[#8E8E94]">kg</span>
              </div>
              <div className="flex items-center bg-[#101012] border border-[#2A2A2F] rounded-lg px-2 py-1">
                <input
                  type="number"
                  value={activeSetReps}
                  onChange={e => setActiveSetReps(Number(e.target.value))}
                  className="w-7 text-xs font-bold text-[#F5F4F0] bg-transparent text-center focus:outline-none"
                />
                <span className="text-[10px] text-[#8E8E94]">reps</span>
              </div>
              <button
                onClick={handleRegisterSet}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="w-7 h-7 rounded-lg flex items-center justify-center shadow-md active:scale-90"
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8E8E94]">Serie 3</span>
            <span className="text-xs text-[#5C5C62]">Objetivo: 80 kg × 8</span>
          </div>
        )}

        {/* Serie 4 (Pending) */}
        <div className="p-3 rounded-[14px] bg-[#16161A] border border-[#2A2A2F]/50 flex items-center justify-between opacity-60">
          <span className="text-xs font-medium text-[#5C5C62]">Serie 4</span>
          <span className="text-xs text-[#5C5C62]">Objetivo: 80 kg × 8</span>
        </div>
      </div>

      {/* Main button */}
      <button
        onClick={handleRegisterSet}
        style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
        className="w-full py-4 rounded-full font-bold text-base shadow-lg transition-transform active:scale-[0.98] mt-auto"
      >
        Registrar y descansar
      </button>
    </div>
  );
};
