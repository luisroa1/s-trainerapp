import React, { useState } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, GripVertical, Check } from 'lucide-react';
import { Program, ProgramDay, ExerciseItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { normalizeProgramIds } from '../../lib/programVersion.mjs';

interface TrainerProgramBuilderProps {
  program: Program;
  onBack: () => void;
  onSave: () => void;
}

export const TrainerProgramBuilder: React.FC<TrainerProgramBuilderProps> = ({
  program,
  onBack,
  onSave
}) => {
  const { saveProgram } = useApp();
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [programName, setProgramName] = useState(program.name);
  const [days, setDays] = useState<ProgramDay[]>(() => normalizeProgramIds(program).days as ProgramDay[]);

  const [editingExercise, setEditingExercise] = useState<ExerciseItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState<number | ''>('');
  const [newExReps, setNewExReps] = useState<number | ''>('');
  const [newExWeight, setNewExWeight] = useState('');
  const [newExRir, setNewExRir] = useState<number | ''>('');
  const [newExRestSeconds, setNewExRestSeconds] = useState<number | ''>('');
  const [toast, setToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeDay = days[activeDayIndex] || days[0];

  const handleSaveProgram = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    setToast(null);
    const normalized = normalizeProgramIds({ ...program, name: programName, days });
    try {
      await saveProgram(normalized);
      setToast('Cambios guardados.');
      window.setTimeout(() => {
        setToast(null);
        onSave();
      }, 900);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido.';
      setErrorMessage(`No se pudo guardar el programa. ${detail}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDay = () => {
    const dayNumber = days.length + 1;
    setDays(previous => [...previous, {
      id: globalThis.crypto.randomUUID(),
      dayNumber,
      title: `Día ${dayNumber}`,
      focusArea: '',
      exercises: [],
    }]);
    setActiveDayIndex(days.length);
  };

  const handleDeleteExercise = (exId: string) => {
    setDays(prev => prev.map((d, idx) => {
      if (idx === activeDayIndex) {
        return {
          ...d,
          exercises: d.exercises.filter(e => e.id !== exId)
        };
      }
      return d;
    }));
  };

  const handleAddExercise = () => {
    if (!activeDay || !newExName.trim() || newExSets === '' || newExReps === '' || newExRir === '' || newExRestSeconds === '') return;
    const newEx: ExerciseItem = {
      id: globalThis.crypto.randomUUID(),
      name: newExName.trim(),
      muscleGroup: activeDay.focusArea,
      sets: newExSets,
      reps: newExReps,
      weight: newExWeight,
      rir: newExRir,
      restSeconds: newExRestSeconds,
      order: activeDay.exercises.length + 1
    };

    setDays(prev => prev.map((d, idx) => {
      if (idx === activeDayIndex) {
        return {
          ...d,
          exercises: [...d.exercises, newEx]
        };
      }
      return d;
    }));

    setNewExName('');
    setNewExSets('');
    setNewExReps('');
    setNewExWeight('');
    setNewExRir('');
    setNewExRestSeconds('');
    setShowAddModal(false);
  };

  const handleSaveExerciseEdit = () => {
    if (!editingExercise) return;
    setDays(prev => prev.map((d, idx) => {
      if (idx === activeDayIndex) {
        return {
          ...d,
          exercises: d.exercises.map(e => e.id === editingExercise.id ? editingExercise : e)
        };
      }
      return d;
    }));
    setEditingExercise(null);
  };

  return (
    <div className="p-8 max-w-[1240px] mx-auto pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#8E8E94] hover:text-[#F5F4F0] hover:border-[#3A3A40]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={programName}
                onChange={e => setProgramName(e.target.value)}
                className="text-2xl font-extrabold font-display text-[#F5F4F0] bg-transparent border-b border-transparent hover:border-[#3A3A40] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none"
              />
              <Edit2 className="w-4 h-4 text-[#8E8E94]" />
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#F5F4F0] font-semibold">
                {program.type}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94]">
                {program.durationWeeks} semanas
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94]">
                {days.length} días/semana
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleSaveProgram()}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
          <Check className="w-4 h-4 stroke-[3]" />
          {toast}
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {/* Day Selector Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {days.map((day, idx) => (
          <button
            key={day.id}
            onClick={() => setActiveDayIndex(idx)}
            className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
              activeDayIndex === idx
                ? 'bg-[#16161A] border-2 border-[var(--accent-color,#CFFF5C)] text-[#F5F4F0]'
                : 'bg-[#16161A] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            {day.title}
          </button>
        ))}
        <button
          onClick={handleAddDay}
          className="px-4 py-2.5 rounded-full text-xs font-bold border border-dashed border-[#3A3A40] text-[#8E8E94] hover:text-[#F5F4F0]"
        >
          + Añadir día
        </button>
      </div>

      {activeDay ? <>
      {/* Exercise List */}
      <div className="rounded-[16px] bg-[#16161A] border border-[#2A2A2F] divide-y divide-[#2A2A2F]/50 overflow-hidden mb-5">
        {activeDay.exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="p-4 flex items-center justify-between hover:bg-[#1B1B1F] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-[#3A3A40] cursor-grab" />
              <div>
                <h4 className="text-sm font-bold text-[#F5F4F0]">{exercise.name}</h4>
                <p className="text-[10px] text-[#8E8E94]">{exercise.muscleGroup}</p>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <span className="text-xs font-semibold text-[#8E8E94]">{exercise.sets} × {exercise.reps}</span>
              <span className="text-xs font-bold text-[#F5F4F0] w-16 text-right">{exercise.weight}</span>
              <span className="text-xs font-bold text-[var(--accent-color,#CFFF5C)] w-14">RIR {exercise.rir}</span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingExercise(exercise)}
                  className="p-1.5 rounded-lg text-[#8E8E94] hover:text-[#F5F4F0] hover:bg-[#232328]"
                  title="Editar ejercicio"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteExercise(exercise.id)}
                  className="p-1.5 rounded-lg text-[#8E8E94] hover:text-red-400 hover:bg-[#232328]"
                  title="Eliminar ejercicio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add exercise button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3.5 rounded-[14px] bg-[#16161A] border-2 border-dashed border-[#2A2A2F] hover:border-[var(--accent-color,#CFFF5C)] text-xs font-bold text-[#8E8E94] hover:text-[#F5F4F0] flex items-center justify-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4 text-[var(--accent-color,#CFFF5C)]" />
        <span>Añadir ejercicio a {activeDay.title}</span>
      </button>
      </> : (
        <div className="rounded-[16px] bg-[#16161A] border border-dashed border-[#2A2A2F] p-10 text-center">
          <p className="text-sm text-[#8E8E94]">Este programa todavía no tiene días ni ejercicios.</p>
          <p className="mt-2 text-xs text-[#6E6E74]">Añade un día para empezar a definir la prescripción.</p>
        </div>
      )}

      {/* Edit Exercise Modal */}
      {editingExercise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-[380px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F4F0] mb-4">
              Editar ejercicio: {editingExercise.name}
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Nombre</label>
                <input
                  type="text"
                  value={editingExercise.name}
                  onChange={e => setEditingExercise({ ...editingExercise, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Series</label>
                  <input
                    type="number"
                    value={editingExercise.sets}
                    onChange={e => setEditingExercise({ ...editingExercise, sets: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Reps</label>
                  <input
                    type="number"
                    value={editingExercise.reps}
                    onChange={e => setEditingExercise({ ...editingExercise, reps: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Carga (kg)</label>
                  <input
                    type="text"
                    value={editingExercise.weight}
                    onChange={e => setEditingExercise({ ...editingExercise, weight: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">RIR</label>
                  <input
                    type="number"
                    value={editingExercise.rir}
                    onChange={e => setEditingExercise({ ...editingExercise, rir: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditingExercise(null)}
                className="flex-1 py-2 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#8E8E94]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveExerciseEdit}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-2 rounded-full font-bold text-xs"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAddModal && activeDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-[380px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-5 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F4F0] mb-4">
              Añadir ejercicio a {activeDay.title}
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Nombre del ejercicio</label>
                <input
                  type="text"
                  placeholder="Ej: Press Francés con mancuernas"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Series</label>
                  <input
                    type="number"
                    value={newExSets}
                    onChange={e => setNewExSets(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Reps</label>
                  <input
                    type="number"
                    value={newExReps}
                    onChange={e => setNewExReps(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Carga inicial</label>
                  <input
                    type="text"
                    value={newExWeight}
                    onChange={e => setNewExWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">RIR objetivo</label>
                  <input
                    type="number"
                    value={newExRir}
                    onChange={e => setNewExRir(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Descanso (segundos)</label>
                  <input
                    type="number"
                    min="0"
                    value={newExRestSeconds}
                    onChange={e => setNewExRestSeconds(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#8E8E94]"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExercise}
                disabled={!newExName.trim() || newExSets === '' || newExReps === '' || newExRir === '' || newExRestSeconds === ''}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="flex-1 py-2 rounded-full font-bold text-xs"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
