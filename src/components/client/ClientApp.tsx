import React, { useState } from 'react';
import { Home, Dumbbell, TrendingUp, Apple, User } from 'lucide-react';
import { ClientOnboarding } from './ClientOnboarding';
import { ClientHome } from './ClientHome';
import { WorkoutExercise } from './WorkoutExercise';
import { WorkoutRest } from './WorkoutRest';
import { ClientProgress } from './ClientProgress';
import { ClientMeasurements } from './ClientMeasurements';
import { ClientNutrition } from './ClientNutrition';
import { ClientCalculator } from './ClientCalculator';
import { ClientShoppingList } from './ClientShoppingList';
import { ClientSupplements } from './ClientSupplements';
import { ClientProfile } from './ClientProfile';
import { ClientDataForm } from './ClientDataForm';
import { ClientCycle } from './ClientCycle';
import { ClientReminders } from './ClientReminders';
import { ClientHelp } from './ClientHelp';

type Tab = 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil';
type Screen =
  | 'onboarding'
  | Tab
  | 'workout_exercise'
  | 'workout_rest'
  | 'medidas'
  | 'fotos'
  | 'calculadora'
  | 'lista_compra'
  | 'suplementos'
  | 'datos'
  | 'ciclo'
  | 'recordatorios'
  | 'guia';

export const ClientApp: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('hoy');
  const [activeTab, setActiveTab] = useState<Tab>('hoy');
  const [lastRestInfo, setLastRestInfo] = useState<{ setNum: number; weight: number; reps: number }>({
    setNum: 2,
    weight: 82.5,
    reps: 7
  });

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'entreno') {
      setCurrentScreen('workout_exercise');
    } else {
      setCurrentScreen(tab);
    }
  };

  const showBottomNav = [
    'hoy',
    'progreso',
    'nutricion',
    'perfil'
  ].includes(currentScreen);

  return (
    <div className="relative w-full h-full bg-[#101012] text-[#F5F4F0] flex flex-col overflow-hidden">
      {/* Screen View Container */}
      <div className="flex-1 overflow-y-auto">
        {currentScreen === 'onboarding' && (
          <ClientOnboarding onFinishOnboarding={() => setCurrentScreen('hoy')} />
        )}

        {currentScreen === 'hoy' && (
          <ClientHome
            onStartWorkout={() => {
              setActiveTab('entreno');
              setCurrentScreen('workout_exercise');
            }}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentScreen === 'workout_exercise' && (
          <WorkoutExercise
            onBack={() => setCurrentScreen('hoy')}
            onClose={() => setCurrentScreen('hoy')}
            onGoToRest={(info) => {
              setLastRestInfo(info);
              setCurrentScreen('workout_rest');
            }}
          />
        )}

        {currentScreen === 'workout_rest' && (
          <WorkoutRest
            recordedInfo={lastRestInfo}
            onBack={() => setCurrentScreen('workout_exercise')}
            onFinishRest={() => setCurrentScreen('workout_exercise')}
          />
        )}

        {currentScreen === 'progreso' && (
          <ClientProgress
            onOpenMeasurements={() => setCurrentScreen('medidas')}
            onOpenPhotos={() => setCurrentScreen('fotos')}
          />
        )}

        {(currentScreen === 'medidas' || currentScreen === 'fotos') && (
          <ClientMeasurements onBack={() => setCurrentScreen('progreso')} />
        )}

        {currentScreen === 'nutricion' && (
          <ClientNutrition
            onOpenShoppingList={() => setCurrentScreen('lista_compra')}
            onOpenSupplements={() => setCurrentScreen('suplementos')}
            onOpenCalculator={() => setCurrentScreen('calculadora')}
          />
        )}

        {currentScreen === 'calculadora' && (
          <ClientCalculator onBack={() => setCurrentScreen('nutricion')} />
        )}

        {currentScreen === 'lista_compra' && (
          <ClientShoppingList onBack={() => setCurrentScreen('nutricion')} />
        )}

        {currentScreen === 'suplementos' && (
          <ClientSupplements onBack={() => setCurrentScreen('nutricion')} />
        )}

        {currentScreen === 'perfil' && (
          <ClientProfile
            onNavigateSubscreen={(sub) => setCurrentScreen(sub as Screen)}
            onLogout={() => setCurrentScreen('onboarding')}
          />
        )}

        {currentScreen === 'datos' && (
          <ClientDataForm onBack={() => setCurrentScreen('perfil')} />
        )}

        {currentScreen === 'ciclo' && (
          <ClientCycle onBack={() => setCurrentScreen('perfil')} />
        )}

        {currentScreen === 'recordatorios' && (
          <ClientReminders onBack={() => setCurrentScreen('perfil')} />
        )}

        {currentScreen === 'guia' && (
          <ClientHelp onBack={() => setCurrentScreen('perfil')} />
        )}
      </div>

      {/* Persistent Mobile Bottom Navigation */}
      {showBottomNav && (
        <div className="absolute bottom-0 inset-x-0 h-16 bg-[#16161A]/95 backdrop-blur-md border-t border-[#2A2A2F] flex items-center justify-around px-2 z-40">
          <button
            onClick={() => handleTabChange('hoy')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
              activeTab === 'hoy' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Hoy</span>
          </button>

          <button
            onClick={() => handleTabChange('entreno')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
              activeTab === 'entreno' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <Dumbbell className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Entreno</span>
          </button>

          <button
            onClick={() => handleTabChange('progreso')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
              activeTab === 'progreso' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Progreso</span>
          </button>

          <button
            onClick={() => handleTabChange('nutricion')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
              activeTab === 'nutricion' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <Apple className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Nutrición</span>
          </button>

          <button
            onClick={() => handleTabChange('perfil')}
            className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
              activeTab === 'perfil' ? 'text-[var(--accent-color,#CFFF5C)]' : 'text-[#8E8E94] hover:text-[#F5F4F0]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Perfil</span>
          </button>
        </div>
      )}
    </div>
  );
};
