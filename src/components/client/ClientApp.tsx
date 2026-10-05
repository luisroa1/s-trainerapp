import React, { useState } from 'react';
import { Home, Dumbbell, TrendingUp, Apple, User } from 'lucide-react';
import { ClientOnboarding } from './ClientOnboarding';
import { ClientHome } from './ClientHome';
import { WorkoutExercise } from './WorkoutExercise';
import type { WorkoutProgress, RecordedSetInfo } from './WorkoutExercise';
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
import { ClientActivate } from './ClientActivate';
import { useApp } from '../../context/AppContext';

type Tab = 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil';
type Screen =
  | 'onboarding'
  | 'activate'
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
  const { activeClient, signOut, supabaseUser, loadRealClientForUser } = useApp();
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (
        hash.includes('activate') ||
        hash.includes('type=invite') ||
        hash.includes('type=recovery') ||
        search.includes('activate') ||
        search.includes('type=invite')
      ) {
        return 'activate';
      }
    }
    return 'hoy';
  });
  const [activeTab, setActiveTab] = useState<Tab>('hoy');

  // Fuente de verdad del progreso del entrenamiento en curso. Vive aquí (en
  // ClientApp, que nunca se desmonta) precisamente para sobrevivir a la
  // navegación WorkoutExercise -> WorkoutRest -> WorkoutExercise, sea cual
  // sea el ejercicio, el número de series o el entrenamiento.
  const [workoutProgress, setWorkoutProgress] = useState<WorkoutProgress>({
    sessionActive: false,
    currentExerciseIndex: 0,
    activeSetIndex: 0,
    completedSets: []
  });

  // Solo para mostrar en WorkoutRest qué serie se acaba de completar y cuál
  // es el objetivo de la siguiente. NO es el estado fuente de verdad del
  // entrenamiento (ese es workoutProgress, arriba).
  const [lastRestInfo, setLastRestInfo] = useState<RecordedSetInfo>({
    setNum: 0,
    weight: 0,
    reps: 0,
    targetSets: 0,
    targetWeight: 0,
    targetReps: 0,
    targetRir: 0
  });

  // Listen to hash changes if an invite link is clicked or updated
  React.useEffect(() => {
    const handleHashCheck = () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (
        hash.includes('activate') ||
        hash.includes('type=invite') ||
        hash.includes('type=recovery') ||
        search.includes('activate') ||
        search.includes('type=invite')
      ) {
        setCurrentScreen('activate');
      }
    };

    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, []);

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

  // Fail closed for an authenticated client identity that is not linked to a public.clients row.
  // Do not synthesize or write a client record; expose only logout so AuthScreen recovery remains available.
  if (!activeClient && currentScreen !== 'activate') {
    return (
      <main role="alert" aria-live="polite" className="min-h-screen bg-[#101012] text-[#F5F4F0] flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1B1B1F] p-6 text-center">
          <h1 className="text-xl font-bold">Cuenta pendiente de vinculación</h1>
          <p className="mt-3 text-sm text-[#A0A0A8]">
            Tu sesión está autenticada, pero todavía no hay una ficha de cliente asociada. No se mostrarán ni crearán datos hasta que tu entrenador complete la vinculación.
          </p>
          <button type="button" onClick={() => void signOut()} className="mt-6 w-full rounded-xl bg-[#D6FF5F] px-4 py-3 font-semibold text-[#101012]">
            Cerrar sesión y volver al acceso
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="relative w-full h-full max-w-[430px] mx-auto bg-[#101012] text-[#F5F4F0] flex flex-col overflow-hidden">
      {/* Screen View Container */}
      <div className="flex-1 overflow-y-auto">
        {currentScreen === 'activate' && (
          <ClientActivate
            onFinishActivation={() => {
              void (async () => {
                if (supabaseUser?.id && loadRealClientForUser) {
                  await loadRealClientForUser(supabaseUser.id);
                }
                setActiveTab('hoy');
                setCurrentScreen('hoy');
              })();
            }}
            onGoToLogin={() => setCurrentScreen('onboarding')}
          />
        )}

        {currentScreen === 'onboarding' && (
          <ClientOnboarding 
            onFinishOnboarding={() => setCurrentScreen('hoy')}
          />
        )}

        {currentScreen === 'hoy' && (
          <ClientHome
            hasActiveSession={workoutProgress.sessionActive}
            onStartWorkout={() => {
              // Si ya hay una sesión activa (p.ej. el usuario volvió con
              // "←" desde WorkoutExercise), "Continuar entrenamiento" debe
              // retomar exactamente donde se quedó: no se reinicia el
              // progreso. Solo se reinicia cuando no hay sesión en curso
              // (entrenamiento nuevo o el anterior ya se completó).
              setWorkoutProgress(prev =>
                prev.sessionActive
                  ? prev
                  : {
                      sessionActive: true,
                      currentExerciseIndex: 0,
                      activeSetIndex: 0,
                      completedSets: []
                    }
              );
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
            progress={workoutProgress}
            onProgressChange={setWorkoutProgress}
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
        <div className="absolute bottom-0 inset-x-0 h-[68px] w-full max-w-full bg-[#16161A]/95 backdrop-blur-md border-t border-[#2A2A2F] flex items-stretch z-40 overflow-hidden box-border px-1.5 pb-1">
          <button
            onClick={() => handleTabChange('hoy')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 mx-0.5 my-1.5 rounded-2xl transition-colors ${
              activeTab === 'hoy' ? 'text-cyan-400 bg-cyan-400/10' : 'text-[#5C5C62] hover:text-[#8E8E94]'
            }`}
          >
            <Home className={`shrink-0 ${activeTab === 'hoy' ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={activeTab === 'hoy' ? 2.5 : 1.75} />
            <span className={`text-[10px] truncate w-full text-center ${activeTab === 'hoy' ? 'font-bold' : 'font-medium'}`}>Hoy</span>
          </button>

          <button
            onClick={() => handleTabChange('entreno')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 mx-0.5 my-1.5 rounded-2xl transition-colors ${
              activeTab === 'entreno' ? 'text-cyan-400 bg-cyan-400/10' : 'text-[#5C5C62] hover:text-[#8E8E94]'
            }`}
          >
            <Dumbbell className={`shrink-0 ${activeTab === 'entreno' ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={activeTab === 'entreno' ? 2.5 : 1.75} />
            <span className={`text-[10px] truncate w-full text-center ${activeTab === 'entreno' ? 'font-bold' : 'font-medium'}`}>Entreno</span>
          </button>

          <button
            onClick={() => handleTabChange('progreso')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 mx-0.5 my-1.5 rounded-2xl transition-colors ${
              activeTab === 'progreso' ? 'text-cyan-400 bg-cyan-400/10' : 'text-[#5C5C62] hover:text-[#8E8E94]'
            }`}
          >
            <TrendingUp className={`shrink-0 ${activeTab === 'progreso' ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={activeTab === 'progreso' ? 2.5 : 1.75} />
            <span className={`text-[10px] truncate w-full text-center ${activeTab === 'progreso' ? 'font-bold' : 'font-medium'}`}>Progreso</span>
          </button>

          <button
            onClick={() => handleTabChange('nutricion')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 mx-0.5 my-1.5 rounded-2xl transition-colors ${
              activeTab === 'nutricion' ? 'text-cyan-400 bg-cyan-400/10' : 'text-[#5C5C62] hover:text-[#8E8E94]'
            }`}
          >
            <Apple className={`shrink-0 ${activeTab === 'nutricion' ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={activeTab === 'nutricion' ? 2.5 : 1.75} />
            <span className={`text-[10px] truncate w-full text-center ${activeTab === 'nutricion' ? 'font-bold' : 'font-medium'}`}>Nutrición</span>
          </button>

          <button
            onClick={() => handleTabChange('perfil')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 mx-0.5 my-1.5 rounded-2xl transition-colors ${
              activeTab === 'perfil' ? 'text-cyan-400 bg-cyan-400/10' : 'text-[#5C5C62] hover:text-[#8E8E94]'
            }`}
          >
            <User className={`shrink-0 ${activeTab === 'perfil' ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={activeTab === 'perfil' ? 2.5 : 1.75} />
            <span className={`text-[10px] truncate w-full text-center ${activeTab === 'perfil' ? 'font-bold' : 'font-medium'}`}>Perfil</span>
          </button>
        </div>
      )}
    </div>
  );
};
