import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  MessageSquare, 
  Apple, 
  Dumbbell, 
  AlertTriangle, 
  CheckCircle2, 
  Moon, 
  Plus, 
  Check, 
  Send 
} from 'lucide-react';
import { ClientData } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabaseDb } from '../../lib/supabase';

interface TrainerClientDetailProps {
  client: ClientData;
  onBack: () => void;
  onEditProgram: (programId: string) => void;
  onEditNutrition: (clientId: string) => void;
}

export const TrainerClientDetail: React.FC<TrainerClientDetailProps> = ({
  client,
  onBack,
  onEditProgram,
  onEditNutrition
}) => {
  const { addTrainerNote, programs, applyProgramToClient } = useApp();
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<'Entrenamientos' | 'Peso' | 'Medidas' | 'Fuerza' | 'Nutrición' | 'Actividad' | 'Fotos' | 'Notas'>('Entrenamientos');
  const [newNoteText, setNewNoteText] = useState('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ sender: 'trainer' | 'client'; text: string; time: string }[]>([
    { sender: 'trainer', text: '¡Hola! ¿Cómo sentiste el press inclinado en la sesión de hoy?', time: 'Ayer 18:30' },
    { sender: 'client', text: 'Bastante bien, con el banco a 30º el hombro no molestó nada.', time: 'Ayer 19:15' }
  ]);

  const refreshAssignment = async () => {
    setAssignmentStatus('loading');
    setAssignmentError(null);
    const { data, error } = await supabaseDb.getActiveProgramAssignment(client.id);
    if (error) {
      setActiveAssignment(null);
      setAssignmentStatus('error');
      setAssignmentError('No se pudo consultar la prescripción actual.');
      return;
    }
    setActiveAssignment(data);
    setSelectedProgramId(data?.program_version.program_id || '');
    setAssignmentStatus('loaded');
  };

  useEffect(() => {
    void refreshAssignment();
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
      await refreshAssignment();
      setAssignmentMessage(selectedProgramId ? 'Prescripción aplicada al cliente.' : 'El cliente ya no tiene un programa asignado.');
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'No se pudo aplicar la prescripción.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    addTrainerNote(client.id, newNoteText.trim());
    setNewNoteText('');
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    setChatHistory(prev => [
      ...prev,
      { sender: 'trainer', text: chatMessage.trim(), time: 'Ahora' }
    ]);
    setChatMessage('');
  };

  const isFemaleWithCycle = client.sex === 'Mujer' && client.menstrualTracking?.sharedWithTrainer;

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

          {client.avatarUrl ? (
            <img
              src={client.avatarUrl}
              alt={client.name}
              className="w-11 h-11 rounded-full object-cover border border-[#2A2A2F] shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-bold text-sm text-[#F5F4F0] shrink-0">
              {client.initials}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold font-display text-[#F5F4F0]">
                {client.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#CFFF5C]/10 text-[#CFFF5C]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CFFF5C]" />
                Activo
              </span>
              {isFemaleWithCycle && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8A0C4]/15 text-[#E8A0C4] border border-[#E8A0C4]/30">
                  <Moon className="w-3 h-3" />
                  Fase {client.menstrualTracking.phase.toLowerCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8E8E94] mt-0.5">
              {client.objective || 'Sin objetivo registrado'} · {activeProgram?.name || 'Sin programa asignado'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowMessageModal(true)}
            className="px-4 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] flex items-center gap-2 transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-[#8E8E94]" />
            <span>Mensaje</span>
          </button>

          <button
            onClick={() => onEditNutrition(client.id)}
            className="px-4 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0] hover:border-[#3A3A40] flex items-center gap-2 transition-colors"
          >
            <Apple className="w-4 h-4 text-[#8E8E94]" />
            <span>Plan nutricional</span>
          </button>

          <div className="flex items-center gap-2">
            <select aria-label="Programa para aplicar a este cliente" value={selectedProgramId}
              onChange={event => setSelectedProgramId(event.target.value)}
              disabled={assignmentStatus !== 'loaded' || isApplying}
              className="max-w-56 px-3 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0]">
              <option value="">Sin programa asignado</option>
              {programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
            <button onClick={() => void handleApplyProgram()}
              disabled={assignmentStatus !== 'loaded' || isApplying || (!selectedProgramId && !activeProgramId)}
              style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
              className="px-4 py-2.5 rounded-full font-bold text-xs shadow-md flex items-center gap-2 disabled:opacity-50">
              <Dumbbell className="w-4 h-4 stroke-[2.5]" />
              <span>{isApplying ? 'Aplicando…' : selectedProgramId ? 'Aplicar a cliente' : 'Quitar programa'}</span>
            </button>
            {activeProgram && <button onClick={() => onEditProgram(activeProgram.id)}
              className="px-4 py-2.5 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] text-xs font-bold text-[#F5F4F0]">Editar programa</button>}
          </div>
        </div>
      </div>

      {assignmentStatus === 'loading' && <p role="status" className="mb-4 text-xs text-[#8E8E94]">Consultando la prescripción actual…</p>}
      {assignmentError && <p role="alert" className="mb-4 text-xs text-red-300">{assignmentError}</p>}
      {assignmentMessage && <p role="status" className="mb-4 text-xs text-emerald-300">{assignmentMessage}</p>}

      {/* PATOLOGÍAS Y LIMITACIONES (Apartado fijo) */}
      <div className="mb-4">
        {client.pathologies.hasLimitations ? (
          <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#FF6B4A]/40">
            <span className="text-[10px] font-bold tracking-widest text-[#FF6B4A] uppercase block mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              PATOLOGÍAS Y LIMITACIONES
            </span>
            <div className="text-xs text-[#F5F4F0] space-y-1 leading-relaxed">
              <p><b className="text-[#8E8E94]">Entrenamiento:</b> {client.pathologies.training}</p>
              <p><b className="text-[#8E8E94]">Alimentación:</b> {client.pathologies.nutrition}</p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-[16px] bg-[#16161A] border border-[#CFFF5C]/40 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#CFFF5C]/15 text-[#CFFF5C] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#CFFF5C]">
                Sin patologías ni limitaciones registradas
              </h4>
              <p className="text-[11px] text-[#8E8E94]">
                Confirmado — sin restricciones de entrenamiento ni de alimentación
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Alert banner if exists */}
      {client.alert && (
        <div className="mb-6 p-3.5 rounded-[16px] bg-red-950/20 border border-red-900/40 flex items-center gap-3 text-red-200">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs">
            {client.alert.message}
          </p>
        </div>
      )}

      {/* 5-Card Dashboard with exact Color-Coding */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {/* PESO (#5CD6FF) */}
        <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            PESO
          </span>
          <div className="my-2">
            <span className="text-xl font-extrabold font-display text-[#5CD6FF]">
              {client.currentWeight.toFixed(1).replace('.', ',')} kg
            </span>
          </div>
          <span className="text-[11px] text-[#5CD6FF] font-medium">
            ↓ 3,2 kg
          </span>
        </div>

        {/* ADHERENCIA (#CFFF5C) */}
        <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            ADHERENCIA
          </span>
          <div className="my-2">
            <span className="text-xl font-extrabold font-display text-[var(--accent-color,#CFFF5C)]">
              {client.adherencePercentage} %
            </span>
          </div>
          <span className="text-[11px] text-[#8E8E94]">
            {client.completedWorkoutsCount}/{client.totalScheduledWorkoutsCount} sesiones
          </span>
        </div>

        {/* PASOS (#FF6B4A) */}
        <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            PASOS
          </span>
          <div className="my-2">
            <span className="text-xl font-extrabold font-display text-[#FF6B4A]">
              {client.metrics.stepsToday.toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-[#8E8E94]">
            media diaria
          </span>
        </div>

        {/* SUEÑO (#B388FF) */}
        <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            SUEÑO
          </span>
          <div className="my-2">
            <span className="text-xl font-extrabold font-display text-[#B388FF]">
              {client.metrics.sleepHours}
            </span>
          </div>
          <span className="text-[11px] text-[#8E8E94]">
            media diaria
          </span>
        </div>

        {/* NUTRICIÓN (#CFFF5C) */}
        <div className="p-4 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            NUTRICIÓN
          </span>
          <div className="my-2">
            <span className="text-xl font-extrabold font-display text-[var(--accent-color,#CFFF5C)]">
              86 %
            </span>
          </div>
          <span className="text-[11px] text-[#8E8E94]">
            cumplimiento
          </span>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-6 border-b border-[#2A2A2F] mb-6 text-xs font-semibold">
        {(['Entrenamientos', 'Peso', 'Medidas', 'Fuerza', 'Nutrición', 'Actividad', 'Fotos', 'Notas'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 transition-colors relative ${
              activeTab === tab
                ? 'text-[#F5F4F0] font-bold'
                : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div 
                className="absolute bottom-0 inset-x-0 h-0.5 rounded-full" 
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content depending on tab */}
      {activeTab === 'Entrenamientos' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1 & 2: ÚLTIMA SESIÓN — PROGRAMADO VS REALIZADO & ESTA SEMANA */}
          <div className="col-span-2 space-y-6">
            <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase">
                  ÚLTIMA SESIÓN — PROGRAMADO VS REALIZADO
                </span>
                <span className="text-xs text-[#8E8E94]">Jueves · Empuje</span>
              </div>

              <h3 className="text-base font-bold text-[#F5F4F0] mb-4">
                Press banca
              </h3>

              <div className="grid grid-cols-2 gap-6 p-4 rounded-[12px] bg-[#1B1B1F] border border-[#2A2A2F]">
                {/* Programado */}
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-2">
                    PROGRAMADO
                  </span>
                  <span className="text-base font-extrabold font-display text-[#F5F4F0]">
                    80 kg × 10 × 4
                  </span>
                </div>

                {/* Realizado */}
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-[var(--accent-color,#CFFF5C)] uppercase block mb-2">
                    REALIZADO
                  </span>
                  <div className="space-y-1 text-xs font-semibold text-[#F5F4F0]">
                    <div>80 kg × 10</div>
                    <div>80 kg × 10</div>
                    <div>80 kg × 9</div>
                    <div>80 kg × 8</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ESTA SEMANA calendar */}
            <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F]">
              <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-3">
                ESTA SEMANA
              </span>
              <div className="flex items-center justify-between max-w-sm">
                {client.weeklySchedule.map((dayItem, index) => (
                  <div key={index} className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[#8E8E94]">{dayItem.day}</span>
                    {dayItem.status === 'completed' && (
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-color,#CFFF5C)] text-[#101012] flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                    {dayItem.status === 'pending' && (
                      <div className="w-8 h-8 rounded-full bg-[#1B1B1F] border-2 border-[#FF6B4A] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#FF6B4A]" />
                      </div>
                    )}
                    {dayItem.status === 'rest' && (
                      <div className="w-8 h-8 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center text-[#3A3A40] font-bold text-xs">
                        —
                      </div>
                    )}
                    {dayItem.status === 'protected_streak' && (
                      <div className="w-8 h-8 rounded-full bg-[#1B1B1F] border-2 border-amber-400 flex items-center justify-center text-amber-400">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: NOTAS DEL ENTRENADOR */}
          <div className="p-5 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-4">
                NOTAS DEL ENTRENADOR
              </span>

              {/* Note input */}
              <div className="mb-4">
                <textarea
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  placeholder="Añadir nota sobre esta sesión..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:border-[var(--accent-color,#CFFF5C)] focus:outline-none resize-none"
                />
                <button
                  onClick={handleAddNote}
                  style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                  className="mt-1.5 px-3 py-1.5 rounded-full font-bold text-[11px] shadow-sm flex items-center gap-1 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  Añadir nota
                </button>
              </div>

              {/* Notes list */}
              <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                {client.trainerNotes.map((note) => (
                  <div key={note.id} className="p-3 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F]/60">
                    <p className="text-xs text-[#F5F4F0] leading-relaxed">
                      {note.content}
                    </p>
                    <span className="text-[10px] text-[#8E8E94] mt-2 block font-medium">
                      {note.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'Entrenamientos' && (
        <div className="p-8 rounded-[16px] bg-[#16161A] border border-[#2A2A2F] text-center">
          <p className="text-xs text-[#8E8E94]">
            Datos históricos sincronizados para <span className="text-[#F5F4F0] font-bold">{client.name}</span> en pestaña {activeTab}.
          </p>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-[420px] bg-[#16161A] border border-[#2A2A2F] rounded-[24px] p-5 shadow-2xl flex flex-col h-[480px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2F]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1B1B1F] border border-[#2A2A2F] flex items-center justify-center font-bold text-xs text-[#F5F4F0]">
                  {client.initials}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#F5F4F0]">{client.name}</h3>
                  <span className="text-[10px] text-[#CFFF5C]">En línea</span>
                </div>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-xs text-[#8E8E94] hover:text-[#F5F4F0]"
              >
                Cerrar
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    msg.sender === 'trainer' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'trainer'
                        ? 'bg-[var(--accent-color,#CFFF5C)] text-[#101012] font-medium rounded-tr-xs'
                        : 'bg-[#1B1B1F] text-[#F5F4F0] border border-[#2A2A2F] rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-[#5C5C62] mt-1 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Send input */}
            <div className="pt-3 border-t border-[#2A2A2F] flex items-center gap-2">
              <input
                type="text"
                placeholder="Escribe un mensaje al cliente..."
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 px-3 py-2 rounded-xl bg-[#1B1B1F] border border-[#2A2A2F] text-xs text-[#F5F4F0] placeholder-[#5C5C62] focus:outline-none focus:border-[var(--accent-color,#CFFF5C)]"
              />
              <button
                onClick={handleSendMessage}
                style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
