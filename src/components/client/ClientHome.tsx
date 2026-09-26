import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Check, User, MessageSquare, Moon, Sparkles } from 'lucide-react';
import { ClientMotivationalModal, MotivationType } from './ClientMotivationalModal';

interface ClientHomeProps {
  onStartWorkout: () => void;
  onNavigateTab: (tab: 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil') => void;
}

export const ClientHome: React.FC<ClientHomeProps> = ({ onStartWorkout, onNavigateTab }) => {
  const { activeClient, appName } = useApp();
  const [activeModal, setActiveModal] = useState<MotivationType | null>(null);

  const firstName = activeClient.name.split(' ')[0] || 'Jesús';

  const completedCount = activeClient.weeklySchedule.filter(s => s.status === 'completed').length;
  const targetCount = activeClient.weeklySchedule.filter(s => s.status !== 'rest').length;

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
          Jueves, 24 sept
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
          {activeClient.weeklySchedule.map((dayItem, index) => {
            const isCompleted = dayItem.status === 'completed';
            const isPendingToday = dayItem.status === 'pending';
            const isProtected = dayItem.status === 'protected_streak';
            const isRest = dayItem.status === 'rest';

            return (
              <div key={index} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#8E8E94]">
                  {dayItem.day}
                </span>

                {isCompleted && (
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105"
                    style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                )}

                {isPendingToday && (
                  <div className="w-9 h-9 rounded-full bg-[#1B1B1F] border-2 border-[#FF6B4A] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B4A] animate-pulse" />
                  </div>
                )}

                {isProtected && (
                  <div 
                    onClick={() => setActiveModal('racha_protegida')}
                    className="w-9 h-9 rounded-full bg-[#1B1B1F] border-2 border-amber-400 flex items-center justify-center cursor-pointer"
                    title="Racha protegida"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  </div>
                )}

                {isRest && (
                  <div className="w-9 h-9 rounded-full bg-[#16161A] border border-[#2A2A2F] flex items-center justify-center">
                    <span className="text-sm font-bold text-[#3A3A40]">—</span>
                  </div>
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
      <div className="p-4 rounded-[16px] bg-[#1B1B1F] border border-[#2A2A2F] mb-5 shadow-lg">
        <span className="text-[9.5px] font-bold tracking-widest text-[#8E8E94] uppercase block mb-1">
          ENTRENAMIENTO DE HOY
        </span>
        <h3 className="text-2xl font-extrabold font-display text-[#F5F4F0] leading-tight">
          Pierna
        </h3>
        <p className="text-xs text-[#8E8E94] font-medium mt-0.5 mb-3.5">
          45–55 min · 7 ejercicios
        </p>

        {/* Coach tip note */}
        <div className="p-3 rounded-[12px] bg-[#16161A] border border-[#2A2A2F] flex items-start gap-2.5 mb-4">
          <MessageSquare className="w-4 h-4 text-[#8E8E94] shrink-0 mt-0.5" />
          <p className="text-xs text-[#8E8E94] leading-relaxed">
            <span className="font-semibold text-[#F5F4F0]">Tu entrenador:</span> hoy vamos a por más repeticiones que la semana pasada.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={onStartWorkout}
          style={{ backgroundColor: 'var(--accent-color, #CFFF5C)', color: 'var(--accent-text, #101012)' }}
          className="w-full py-3.5 rounded-full font-extrabold text-sm shadow-md transition-all active:scale-[0.98] hover:opacity-95 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          Empezar entrenamiento
        </button>
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

        {/* Sueño (#B388FF) */}
        <div className="p-3.5 rounded-[14px] bg-[#1B1B1F] border border-[#2A2A2F] flex flex-col justify-between">
          <span className="text-[9px] font-bold tracking-widest text-[#8E8E94] uppercase">
            SUEÑO
          </span>
          <div className="my-1.5">
            <span className="text-lg font-extrabold font-display text-[#F5F4F0]">
              {activeClient.metrics.sleepHours}
            </span>
          </div>
          <p className="text-[10px] text-[#B388FF] font-medium">
            {activeClient.metrics.sleepQuality}
          </p>
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
