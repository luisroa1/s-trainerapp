import React, { useState } from 'react';
import { Home, Dumbbell, TrendingUp, Apple, User } from 'lucide-react';
import { ClientOnboarding } from './ClientOnboarding';
import { ClientHome } from './ClientHome';
import { WorkoutExercise } from './WorkoutExercise';
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
import { supabaseDb } from '../../lib/supabase';
import type { WorkoutSessionView } from '../../types';

type Tab = 'hoy' | 'entreno' | 'progreso' | 'nutricion' | 'perfil';
type Screen =
  | 'onboarding'
  | 'activate'
  | Tab
  | 'workout_exercise'
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
  const [workoutSession, setWorkoutSession] = useState<WorkoutSessionView | null>(null);
  const [workoutSessionStatus, setWorkoutSessionStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [workoutSessionError, setWorkoutSessionError] = useState<string | null>(null);
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


  React.useEffect(() => {
    if (!supabaseUser?.id || !activeClient?.id) {
      setWorkoutSession(null);
      setWorkoutSessionStatus('loaded');
      return;
    }
    let current = true;
    setWorkoutSessionStatus('loading');
    setWorkoutSessionError(null);
    supabaseDb.getOpenWorkoutSession().then(({ data, error }) => {
      if (!current) return;
      if (error) {
        setWorkoutSessionStatus('error');
        setWorkoutSessionError('No se pudo recuperar la sesión. Reintenta más tarde.');
        return;
      }
      setWorkoutSession(data);
      setWorkoutSessionStatus('loaded');
    });
    return () => { current = false; };
  }, [supabaseUser?.id, activeClient?.id]);

  const startWorkout = async (programDayId: string) => {
    setWorkoutSessionStatus('loading');
    setWorkoutSessionError(null);
    const { data, error } = await supabaseDb.startWorkoutSession(programDayId);
    if (error || !data) {
      setWorkoutSessionStatus('error');
      setWorkoutSessionError('No se pudo iniciar el entrenamiento. No se ha confirmado ningún cambio. Reintenta.');
      return;
    }
    setWorkoutSession(data);
    setWorkoutSessionStatus('loaded');
    setActiveTab('entreno');
    setCurrentScreen('workout_exercise');
  };

  const continueWorkout = () => {
    if (!workoutSession || workoutSession.session.completed_at) return;
    setActiveTab('entreno');
    setCurrentScreen('workout_exercise');
  };

  const retryOpenWorkoutSession = async () => {
    setWorkoutSessionStatus('loading');
    setWorkoutSessionError(null);
    const { data, error } = await supabaseDb.getOpenWorkoutSession();
    if (error) {
      setWorkoutSessionStatus('error');
      setWorkoutSessionError('No se pudo recuperar la sesión. Reintenta más tarde.');
      return;
    }
    setWorkoutSession(data);
    setWorkoutSessionStatus('loaded');
  };

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
    if (tab === 'entreno') {
      if (workoutSession && !workoutSession.session.completed_at) {
        setActiveTab('entreno');
        setCurrentScreen('workout_exercise');
      } else {
        // The workout picker lives on Hoy; never route to an empty execution screen.
        setActiveTab('hoy');
        setCurrentScreen('hoy');
      }
    } else {
      setActiveTab(tab);
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
            openWorkoutSession={workoutSession?.session.completed_at ? null : workoutSession}
            workoutSessionStatus={workoutSessionStatus}
            workoutSessionError={workoutSessionError}
            onStartWorkout={(programDayId) => void startWorkout(programDayId)}
            onContinueWorkout={continueWorkout}
            onRetryWorkoutSession={() => void retryOpenWorkoutSession()}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentScreen === 'workout_exercise' && workoutSession && (
          <WorkoutExercise
            onBack={() => setCurrentScreen('hoy')}
            onClose={() => setCurrentScreen('hoy')}
            session={workoutSession}
            onSessionChange={setWorkoutSession}
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
