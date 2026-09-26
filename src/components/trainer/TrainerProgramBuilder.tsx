import React, { useState } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, GripVertical, Check, Sparkles } from 'lucide-react';
import { Program, ExerciseItem } from '../../types';
import { useApp } from '../../context/AppContext';

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
  const { updateProgram } = useApp();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [programName, setProgramName] = useState(program.name);
  const [days, setDays] = useState(program.days.length > 0 ? program.days : [
    {
      id: 'd-1',
      dayNumber: 1,
      title: 'Día 1 · Empuje',
      focusArea: 'Empuje',
      exercises: [
        { id: 'ex-1', name: 'Press banca', muscleGroup: 'Pecho', sets: 4, reps: 8, weight: '80 kg', rir: 2, restSeconds: 120, order: 1 },
        { id: 'ex-2', name: 'Press militar', muscleGroup: 'Hombro', sets: 3, reps: 10, weight: '45 kg', rir: 2, restSeconds: 90, order: 2 },
        { id: 'ex-3', name: 'Fondos en paralelas', muscleGroup: 'Tríceps', sets: 3, reps: 12, weight: 'Peso corp.', rir: 3, restSeconds: 90, order: 3 },
        { id: 'ex-4', name: 'Elevaciones laterales', muscleGroup: 'Deltoides', sets: 3, reps: 15, weight: '10 kg', rir: 3, restSeconds: 60, order: 4 },
        { id: 'ex-5', name: 'Extensión tríceps en polea', muscleGroup: 'Tríceps', sets: 3, reps: 12, weight: '25 kg', rir: 2, restSeconds: 60, order: 5 },
      ]
    },
    {
      id: 'd-2',
      dayNumber: 2,
      title: 'Día 2 · Tirón',
      focusArea: 'Tirón',
      exercises: [
        { id: 'ex-6', name: 'Dominadas neutras', muscleGroup: 'Espalda', sets: 4, reps: 8, weight: 'Peso corp.', rir: 2, restSeconds: 120, order: 1 },
        { id: 'ex-7', name: 'Remo con barra', muscleGroup: 'Espalda media', sets: 4, reps: 10, weight: '65 kg', rir: 2, restSeconds: 90, order: 2 },
      ]
    },
    {
      id: 'd-3',
      dayNumber: 3,
      title: 'Día 3 · Pierna',
      focusArea: 'Pierna',
      exercises: [
        { id: 'ex-10', name: 'Sentadilla', muscleGroup: 'Cuádriceps', sets: 4, reps: 8, weight: '80 kg', rir: 2, restSeconds: 120, order: 1 },
        { id: 'ex-11', name: 'Peso muerto rumano', muscleGroup: 'Isquios', sets: 4, reps: 10, weight: '85 kg', rir: 2, restSeconds: 120, order: 2 },
      ]
    },
    {
      id: 'd-4',
      dayNumber: 4,
      title: 'Día 4 · Full body',
      focusArea: 'Full body',
      exercises: [
        { id: 'ex-14', name: 'Press inclinado', muscleGroup: 'Pecho sup.', sets: 3, reps: 10, weight: '26 kg', rir: 2, restSeconds: 90, order: 1 },
      ]
    }
  ]);

  const [editingExercise, setEditingExercise] = useState<ExerciseItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(3);
  const [newExReps, setNewExReps] = useState(10);
  const [newExWeight, setNewExWeight] = useState('20 kg');
  const [newExRir, setNewExRir] = useState(2);
  const [toast, setToast] = useState<string | null>(null);

  const activeDay = days[activeDayIndex] || days[0];

  const handleSaveProgram = (andAssign: boolean = false) => {
    updateProgram({
      ...program,
      name: programName,
      days
    });
    setToast(andAssign ? '¡Programa guardado y asignado a clientes!' : 'Borrador de programa guardado');
    setTimeout(() => {
      setToast(null);
      onSave();
    }, 1200);
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
    if (!newExName.trim()) return;
    const newEx: ExerciseItem = {
      id: `ex-${Date.now()}`,
      name: newExName.trim(),
      muscleGroup: activeDay.focusArea,
      sets: newExSets,
      reps: newExReps,
      weight: newExWeight,
      rir: newExRir,
      restSeconds: 90,
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
              <span className="px-2.5 py-0.5 rounded-full bg-[#CFFF5C]/10 border border-[#CFFF5C]/20 text-[#CFFF5C] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Generado automáticamente
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSaveProgram(false)}
            className="px-5 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] transition-colors"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => handleSaveProgram(true)}
            style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
            className="px-6 py-2.5 rounded-full font-bold text-xs shadow-md transition-all active:scale-95"
          >
            Guardar y asignar
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--accent-color,#CFFF5C)] text-[#101012] text-xs font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
          <Check className="w-4 h-4 stroke-[3]" />
          {toast}
        </div>
      )}

      {/* Info notice */}
      <div className="p-3.5 rounded-[14px] bg-[#16161A] border border-[#2A2A2F] text-xs text-[#8E8E94] mb-6 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[var(--accent-color,#CFFF5C)]" />
        <span>Generado con la plantilla {program.type}. Ajusta lo que necesites: ejercicios, cargas o notas.</span>
      </div>

      {/* VOLUMEN POR SEMANA (Progression Chart) */}
      <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
            VOLUMEN POR SEMANA
          </span>
          <span className="text-xs text-[#8E8E94]">
            Semana 4 y 8 · descarga automática
          </span>
        </div>

        {/* 8-Bar Visualization */}
        <div className="grid grid-cols-8 gap-3 items-end h-20 mb-4 px-2">
          {[
            { w: 1, val: 80, deload: false },
            { w: 2, val: 85, deload: false },
            { w: 3, val: 90, deload: false },
            { w: 4, val: 55, deload: true },
            { w: 5, val: 92, deload: false },
            { w: 6, val: 96, deload: false },
            { w: 7, val: 100, deload: false },
            { w: 8, val: 60, deload: true },
          ].map((bar) => (
            <div key={bar.w} className="flex flex-col items-center gap-1.5 h-full justify-end">
              <div
                className="w-full rounded-md transition-all duration-300 relative group cursor-pointer"
                style={{
                  height: `${bar.val}%`,
                  backgroundColor: bar.deload
                    ? '#2A2A2F'
                    : currentWeek === bar.w
                    ? 'var(--accent-color, #CFFF5C)'
                    : 'rgba(207, 255, 92, 0.45)'
                }}
                onClick={() => setCurrentWeek(bar.w)}
              >
                {bar.deload && (
                  <span className="absolute -top-5 inset-x-0 text-[8px] text-center text-[#8E8E94] font-semibold">
                    descarga
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Week Buttons */}
        <div className="grid grid-cols-8 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => {
            const isDeload = w === 4 || w === 8;
            const isSelected = currentWeek === w;
            return (
              <button
                key={w}
                onClick={() => setCurrentWeek(w)}
                className={`py-2 px-1 rounded-xl text-xs font-bold text-center transition-all ${
                  isSelected
                    ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] shadow-sm'
                    : 'bg-[#1B1B1F] border border-[#2A2A2F] text-[#8E8E94] hover:text-[#F5F4F0]'
                }`}
              >
                S{w}
                {isDeload && <span className="block text-[8px] font-normal lowercase leading-none mt-0.5">descarga</span>}
              </button>
            );
          })}
        </div>
      </div>

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
      </div>

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
      {showAddModal && (
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
                    onChange={e => setNewExSets(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E94] uppercase font-bold block mb-1">Reps</label>
                  <input
                    type="number"
                    value={newExReps}
                    onChange={e => setNewExReps(Number(e.target.value))}
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
                    onChange={e => setNewExRir(Number(e.target.value))}
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
