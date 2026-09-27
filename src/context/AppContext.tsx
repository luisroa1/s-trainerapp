import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { ClientData, Program, NutritionPlan, AccentColor, TrainerProfile, UserRole } from '../types';
import { INITIAL_CLIENTS, INITIAL_PROGRAMS, INITIAL_NUTRITION_PLAN } from '../data/mockData';
import { supabase, supabaseDb } from '../lib/supabase';

const INITIAL_TRAINER: TrainerProfile = {
  id: '',
  name: '',
  email: '',
  initials: 'TR',
  role: 'Entrenador',
  avatarUrl: '',
  couponCode: 'STRAINER20'
};

export type SupabaseStatus = 'connected' | 'needs_tables' | 'error' | 'connecting';

interface AppContextType {
  appName: string;
  setAppName: (name: string) => void;
  trainer: TrainerProfile;
  updateTrainer: (partial: Partial<TrainerProfile>) => void;
  clients: ClientData[];
  activeClient: ClientData;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  programs: Program[];
  nutritionPlans: Record<string, NutritionPlan>;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  updateClient: (id: string, partial: Partial<ClientData>) => void;
  updateClientPhoto: (id: string, avatarUrl: string) => void;
  addClient: (client: Partial<ClientData>) => void;
  addTrainerNote: (clientId: string, content: string) => void;
  updateProgram: (program: Program) => void;
  addProgram: (program: Program) => void;
  updateNutritionPlan: (clientId: string, plan: NutritionPlan) => void;
  toggleMealCompleted: (clientId: string, mealId: string) => void;
  toggleShoppingItem: (clientId: string, category: string, itemName: string) => void;
  addFoodToLog: (clientId: string, foodName: string, kcal: number, protein?: number) => void;
  resetAllData: () => void;
  // Supabase Auth & Realtime
  supabaseUser: User | null;
  supabaseSession: Session | null;
  userRole: UserRole | null;
  authLoading: boolean;
  supabaseStatus: SupabaseStatus;
  isRealtimeActive: boolean;
  lastSyncTime: Date | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  signUp: (params: { 
    email: string; 
    password: string; 
    role: UserRole; 
    name?: string; 
    phone?: string; 
    avatarUrl?: string;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  syncAllToSupabase: () => Promise<{ success: boolean; error?: string }>;
  refreshFromSupabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appName, setAppNameState] = useState<string>(() => {
    const saved = localStorage.getItem('strainer_app_name');
    if (!saved || saved.toLowerCase().includes('roafit') || saved === 'S-Trainer app') {
      return 'S-Trainer app — Plataforma de Entrenamiento';
    }
    return saved;
  });

  const [trainer, setTrainer] = useState<TrainerProfile>(() => {
    const saved = localStorage.getItem('strainer_trainer');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.name?.includes('Jesús') || parsed?.email?.includes('soyroafit') || !parsed?.id) {
          localStorage.removeItem('strainer_trainer');
          return INITIAL_TRAINER;
        }
        return parsed;
      } catch {
        return INITIAL_TRAINER;
      }
    }
    return INITIAL_TRAINER;
  });

  const [clients, setClients] = useState<ClientData[]>(() => {
    const saved = localStorage.getItem('strainer_clients') || localStorage.getItem('roafit_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [activeClientId, setActiveClientId] = useState<string>('cli-juan');

  const [programs, setPrograms] = useState<Program[]>(() => {
    const saved = localStorage.getItem('strainer_programs') || localStorage.getItem('roafit_programs');
    return saved ? JSON.parse(saved) : INITIAL_PROGRAMS;
  });

  const [nutritionPlans, setNutritionPlans] = useState<Record<string, NutritionPlan>>(() => {
    const saved = localStorage.getItem('strainer_nutrition') || localStorage.getItem('roafit_nutrition');
    return saved ? JSON.parse(saved) : { 'cli-juan': INITIAL_NUTRITION_PLAN };
  });

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('strainer_accent') || localStorage.getItem('roafit_accent');
    return (saved as AccentColor) || '#CFFF5C';
  });

  // Supabase State
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem('strainer_user_role') as UserRole) || null;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>('connecting');
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const setAppName = (name: string) => {
    setAppNameState(name);
    localStorage.setItem('strainer_app_name', name);
  };

  const updateTrainer = (partial: Partial<TrainerProfile>) => {
    setTrainer(prev => {
      const updated = { ...prev, ...partial };
      if (partial.name && !partial.initials) {
        updated.initials = partial.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      }
      if (updated.id) {
        localStorage.setItem('strainer_trainer', JSON.stringify(updated));
        // Asynchronously sync to Supabase profiles
        supabase
          .from('profiles')
          .update({
            full_name: updated.name,
            avatar_url: updated.avatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', updated.id)
          .then(() => {});
      }
      return updated;
    });
  };

  const updateClientPhoto = (clientId: string, avatarUrl: string) => {
    updateClient(clientId, { avatarUrl });
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('strainer_app_name', appName);
  }, [appName]);

  useEffect(() => {
    if (trainer.id) {
      localStorage.setItem('strainer_trainer', JSON.stringify(trainer));
    } else {
      localStorage.removeItem('strainer_trainer');
    }
  }, [trainer]);

  useEffect(() => {
    localStorage.setItem('strainer_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('strainer_programs', JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    localStorage.setItem('strainer_nutrition', JSON.stringify(nutritionPlans));
  }, [nutritionPlans]);

  useEffect(() => {
    localStorage.setItem('strainer_accent', accentColor);
    document.documentElement.style.setProperty('--accent-color', accentColor);
    const darkText = accentColor === '#CFFF5C' || accentColor === '#FFD34D';
    document.documentElement.style.setProperty('--accent-text', darkText ? '#101012' : '#FFFFFF');
  }, [accentColor]);

  // Load and sync from Supabase
  const refreshFromSupabase = useCallback(async () => {
    try {
      const health = await supabaseDb.testConnection();
      if (!health.connected) {
        setSupabaseStatus('error');
        return;
      }
      if (!health.hasTables) {
        setSupabaseStatus('needs_tables');
        return;
      }

      setSupabaseStatus('connected');

      // Fetch Clients
      const clientsRes = await supabaseDb.getClients();
      if (clientsRes.data && clientsRes.data.length > 0) {
        setClients(clientsRes.data);
      } else if (clientsRes.data && clientsRes.data.length === 0) {
        // Table exists but is empty -> seed initial data
        await supabaseDb.bulkUpsertClients(clients);
      }

      // Fetch Programs
      const programsRes = await supabaseDb.getPrograms();
      if (programsRes.data && programsRes.data.length > 0) {
        setPrograms(programsRes.data);
      } else if (programsRes.data && programsRes.data.length === 0) {
        await supabaseDb.bulkUpsertPrograms(programs);
      }

      // Fetch Nutrition
      const nutritionRes = await supabaseDb.getNutritionPlans();
      if (nutritionRes.data && Object.keys(nutritionRes.data).length > 0) {
        setNutritionPlans(nutritionRes.data);
      }

      // Fetch Trainer Profile
      const trainerRes = await supabaseDb.getTrainerProfile();
      if (trainerRes.data) {
        setTrainer(trainerRes.data);
      }

      setLastSyncTime(new Date());
    } catch (e) {
      console.warn('Error refreshing from Supabase:', e);
    }
  }, [clients, programs]);

  // Push all local data to Supabase (manual full sync / seed)
  const syncAllToSupabase = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const clientsErr = await supabaseDb.bulkUpsertClients(clients);
      if (clientsErr.error) throw clientsErr.error;

      const programsErr = await supabaseDb.bulkUpsertPrograms(programs);
      if (programsErr.error) throw programsErr.error;

      for (const [cId, plan] of Object.entries(nutritionPlans)) {
        await supabaseDb.upsertNutritionPlan(cId, plan);
      }

      await supabaseDb.upsertTrainerProfile(trainer);
      setLastSyncTime(new Date());
      setSupabaseStatus('connected');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al sincronizar con Supabase' };
    }
  };

  // Setup Supabase Auth listener & Realtime channels on mount
  useEffect(() => {
    let isMounted = true;

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (session?.user) {
        setSupabaseSession(session);
        setSupabaseUser(session.user);
        supabase
          .from('profiles')
          .select('id, role, full_name, email, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (!isMounted) return;
            const role = (profile?.role as UserRole) || (session.user.user_metadata?.role as UserRole) || 'client';
            setUserRole(role);
            localStorage.setItem('strainer_user_role', role);

            if (role === 'trainer' && profile) {
              const fullName = profile.full_name || session.user.user_metadata?.full_name || profile.email?.split('@')[0] || 'Entrenador';
              const initials = fullName.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'TR';
              setTrainer({
                id: profile.id,
                name: fullName,
                email: profile.email || session.user.email || '',
                initials,
                role: 'Entrenador',
                avatarUrl: profile.avatar_url || '',
                couponCode: 'STRAINER20'
              });
            }
          });
      }
      setAuthLoading(false);
    });

    // 2. Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSupabaseSession(session);
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from('profiles')
          .select('id, role, full_name, email, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (!isMounted) return;
            const role = (profile?.role as UserRole) || (session.user.user_metadata?.role as UserRole) || 'client';
            setUserRole(role);
            localStorage.setItem('strainer_user_role', role);

            if (role === 'trainer' && profile) {
              const fullName = profile.full_name || session.user.user_metadata?.full_name || profile.email?.split('@')[0] || 'Entrenador';
              const initials = fullName.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'TR';
              setTrainer({
                id: profile.id,
                name: fullName,
                email: profile.email || session.user.email || '',
                initials,
                role: 'Entrenador',
                avatarUrl: profile.avatar_url || '',
                couponCode: 'STRAINER20'
              });
            }
          });
        
        // If client logs in, match active client by email if found
        const userEmail = session.user.email;
        if (userEmail) {
          const matched = clients.find(c => c.email.toLowerCase() === userEmail.toLowerCase());
          if (matched) {
            setActiveClientId(matched.id);
          }
        }
      } else {
        setUserRole(null);
        setTrainer(INITIAL_TRAINER);
        localStorage.removeItem('strainer_user_role');
        localStorage.removeItem('strainer_trainer');
      }
      setAuthLoading(false);
    });

    // 3. Initial health check & data fetch
    refreshFromSupabase();

    // 4. Setup Realtime Subscription
    const channel = supabase
      .channel('strainer-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const updated = payload.new?.data as ClientData;
          if (updated && updated.id) {
            setClients(prev => {
              const idx = prev.findIndex(c => c.id === updated.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [updated, ...prev];
            });
            setLastSyncTime(new Date());
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const updated = payload.new?.data as Program;
          if (updated && updated.id) {
            setPrograms(prev => {
              const idx = prev.findIndex(p => p.id === updated.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [updated, ...prev];
            });
            setLastSyncTime(new Date());
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nutrition_plans' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const client_id = payload.new?.client_id;
          const plan = payload.new?.data as NutritionPlan;
          if (client_id && plan) {
            setNutritionPlans(prev => ({ ...prev, [client_id]: plan }));
            setLastSyncTime(new Date());
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        } else {
          setIsRealtimeActive(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // Auth Operations
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; role?: UserRole }> => {
    try {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthLoading(false);
        return { success: false, error: error.message };
      }

      const role = (data.user?.user_metadata?.role as UserRole) || 'client';
      setUserRole(role);
      localStorage.setItem('strainer_user_role', role);

      // Link trainer or client
      if (role === 'trainer') {
        updateTrainer({
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || trainer.name
        });
      } else {
        const found = clients.find(c => c.email.toLowerCase() === data.user.email?.toLowerCase());
        if (found) {
          setActiveClientId(found.id);
        }
      }

      setAuthLoading(false);
      return { success: true, role };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, error: err.message || 'Error al iniciar sesión' };
    }
  };

  const signUp = async (params: {
    email: string;
    password: string;
    role: UserRole;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      setAuthLoading(true);
      const { email, password, role, name, phone, avatarUrl } = params;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role,
            full_name: name || '',
            phone: phone || '',
            avatar_url: avatarUrl || '',
          },
        },
      });

      if (error) {
        setAuthLoading(false);
        return { success: false, error: error.message };
      }

      const createdUser = data.user;
      setUserRole(role);
      localStorage.setItem('strainer_user_role', role);

      // If registered as trainer, update trainer profile
      if (role === 'trainer') {
        const updatedTrainer: TrainerProfile = {
          ...trainer,
          name: name || trainer.name,
          email: email.trim(),
          avatarUrl: avatarUrl || trainer.avatarUrl,
        };
        updateTrainer(updatedTrainer);
        supabaseDb.upsertTrainerProfile(updatedTrainer).catch(() => {});
      } else {
        // Registered as client: create client profile entry
        const initials = (name || 'NC')
          .split(' ')
          .map(w => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        const newClient: ClientData = {
          id: `cli-${Date.now()}`,
          name: name || 'Nuevo Cliente',
          initials,
          email: email.trim(),
          phone: phone || '',
          birthDate: '1995-01-01',
          sex: 'Hombre',
          height: '175 cm',
          objective: 'Hipertrofia',
          status: 'Activo',
          nextWorkout: 'Hoy · Sesión 1',
          adherencePercentage: 100,
          completedWorkoutsCount: 0,
          totalScheduledWorkoutsCount: 4,
          currentWeight: 75.0,
          initialWeight: 75.0,
          targetWeight: 72.0,
          weightWeeklyTrend: '→ 0,0 kg / semana',
          lastCheckIn: 'Hoy',
          avatarUrl: avatarUrl || '',
          pathologies: {
            hasLimitations: false,
            training: 'Sin limitaciones articulares.',
            nutrition: 'Sin restricciones.'
          },
          menstrualTracking: {
            enabled: false,
            sharedWithTrainer: false,
            day: 0,
            phase: 'Folicular',
            advice: ''
          },
          metrics: {
            stepsToday: 3500,
            stepsGoal: 9000,
            kcalToday: 1100,
            kcalGoal: 2200,
            sleepHours: '7h 30min',
            sleepQuality: 'Buena',
            waterLiters: 1.5,
            waterGoal: 2.5
          },
          assignedProgramId: 'prog-1',
          weeklySchedule: [
            { day: 'L', status: 'completed' },
            { day: 'M', status: 'pending' },
            { day: 'X', status: 'rest' },
            { day: 'J', status: 'pending' },
            { day: 'V', status: 'pending' },
            { day: 'S', status: 'rest' },
            { day: 'D', status: 'rest' },
          ],
          strengthProgression: [],
          bodyMeasurements: { cintura: 80, cadera: 95, pecho: 98, brazo: 34, lastUpdated: 'Hoy' },
          impedanceHistory: [{ date: 'HOY', weight: 75.0, fatPercentage: 18.0, muscleMassKg: 58.0, waterPercentage: 55 }],
          trainerNotes: [{ id: `tn-${Date.now()}`, date: 'Hoy', content: 'Cuenta de cliente registrada y activada en Supabase.' }]
        };

        setClients(prev => [newClient, ...prev]);
        setActiveClientId(newClient.id);
        supabaseDb.upsertClient(newClient).catch(() => {});
      }

      setAuthLoading(false);
      const isConfirmed = createdUser?.identities && createdUser.identities.length > 0;
      return { 
        success: true, 
        message: isConfirmed ? 'Cuenta creada y sesión iniciada con éxito en Supabase.' : 'Cuenta creada en Supabase. Si tienes confirmación de email activada, revisa tu bandeja de entrada.'
      };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, error: err.message || 'Error al registrarse' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setSupabaseUser(null);
    setSupabaseSession(null);
    setUserRole(null);
    setTrainer(INITIAL_TRAINER);
    localStorage.removeItem('strainer_user_role');
    localStorage.removeItem('strainer_trainer');
  };

  const activeClient = clients.find(c => c.id === activeClientId) || clients[0];

  const updateClient = (id: string, partial: Partial<ClientData>) => {
    setClients(prev => {
      const next = prev.map(c => {
        if (c.id === id) {
          const updated = { ...c, ...partial };
          // Async sync to Supabase
          supabaseDb.upsertClient(updated).catch(() => {});
          return updated;
        }
        return c;
      });
      return next;
    });
  };

  const addClient = (clientData: Partial<ClientData>) => {
    const newId = `cli-${Date.now()}`;
    const initials = (clientData.name || 'Nuevo')
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newClient: ClientData = {
      id: newId,
      name: clientData.name || 'Nuevo Cliente',
      initials: initials || 'NC',
      email: clientData.email || '',
      phone: clientData.phone || '',
      birthDate: clientData.birthDate || '1995-01-01',
      sex: clientData.sex || 'Hombre',
      height: clientData.height || '175 cm',
      objective: clientData.objective || 'Hipertrofia',
      status: clientData.status || 'Activo',
      nextWorkout: 'Hoy · Inicio',
      adherencePercentage: 100,
      completedWorkoutsCount: 0,
      totalScheduledWorkoutsCount: 4,
      currentWeight: clientData.currentWeight || 75.0,
      initialWeight: clientData.currentWeight || 75.0,
      targetWeight: clientData.targetWeight || 72.0,
      weightWeeklyTrend: '→ 0,0 kg / semana',
      lastCheckIn: 'Hoy',
      pathologies: clientData.pathologies || {
        hasLimitations: false,
        training: 'Sin limitaciones articulares.',
        nutrition: 'Sin restricciones.'
      },
      menstrualTracking: clientData.menstrualTracking || {
        enabled: false,
        sharedWithTrainer: false,
        day: 0,
        phase: 'Folicular',
        advice: ''
      },
      metrics: {
        stepsToday: 4500,
        stepsGoal: 9000,
        kcalToday: 1200,
        kcalGoal: 2200,
        sleepHours: '7h 30min',
        sleepQuality: 'Buena',
        waterLiters: 1.5,
        waterGoal: 2.5
      },
      assignedProgramId: clientData.assignedProgramId || 'prog-1',
      weeklySchedule: [
        { day: 'L', status: 'completed' },
        { day: 'M', status: 'pending' },
        { day: 'X', status: 'rest' },
        { day: 'J', status: 'pending' },
        { day: 'V', status: 'pending' },
        { day: 'S', status: 'rest' },
        { day: 'D', status: 'rest' },
      ],
      strengthProgression: [],
      bodyMeasurements: { cintura: 80, cadera: 95, pecho: 98, brazo: 34, lastUpdated: 'Reciente' },
      impedanceHistory: [{ date: 'HOY', weight: clientData.currentWeight || 75.0, fatPercentage: 18.0, muscleMassKg: 58.0, waterPercentage: 55 }],
      trainerNotes: [{ id: `tn-${Date.now()}`, date: 'Hoy', content: 'Alta creada por el entrenador.' }]
    };

    setClients(prev => [newClient, ...prev]);
    setActiveClientId(newId);
    supabaseDb.upsertClient(newClient).catch(() => {});
  };

  const addTrainerNote = (clientId: string, content: string) => {
    const newNote = {
      id: `tn-${Date.now()}`,
      date: 'Hoy',
      content
    };
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const updated = {
          ...c,
          trainerNotes: [newNote, ...c.trainerNotes]
        };
        supabaseDb.upsertClient(updated).catch(() => {});
        return updated;
      }
      return c;
    }));
  };

  const updateProgram = (program: Program) => {
    setPrograms(prev => {
      const next = prev.map(p => p.id === program.id ? program : p);
      supabaseDb.upsertProgram(program).catch(() => {});
      return next;
    });
  };

  const addProgram = (program: Program) => {
    setPrograms(prev => {
      const next = [program, ...prev];
      supabaseDb.upsertProgram(program).catch(() => {});
      return next;
    });
  };

  const updateNutritionPlan = (clientId: string, plan: NutritionPlan) => {
    setNutritionPlans(prev => {
      const next = { ...prev, [clientId]: plan };
      supabaseDb.upsertNutritionPlan(clientId, plan).catch(() => {});
      return next;
    });
  };

  const toggleMealCompleted = (clientId: string, mealId: string) => {
    setNutritionPlans(prev => {
      const plan = prev[clientId] || INITIAL_NUTRITION_PLAN;
      const updatedMeals = plan.meals.map(m => m.id === mealId ? { ...m, completed: !m.completed } : m);
      const updatedPlan = { ...plan, meals: updatedMeals };
      supabaseDb.upsertNutritionPlan(clientId, updatedPlan).catch(() => {});
      return { ...prev, [clientId]: updatedPlan };
    });
  };

  const toggleShoppingItem = (clientId: string, categoryName: string, itemName: string) => {
    setNutritionPlans(prev => {
      const plan = prev[clientId] || INITIAL_NUTRITION_PLAN;
      const updatedCategories = plan.shoppingList.map(cat => {
        if (cat.category === categoryName) {
          return {
            ...cat,
            items: cat.items.map(item => item.name === itemName ? { ...item, checked: !item.checked } : item)
          };
        }
        return cat;
      });
      const updatedPlan = { ...plan, shoppingList: updatedCategories };
      supabaseDb.upsertNutritionPlan(clientId, updatedPlan).catch(() => {});
      return { ...prev, [clientId]: updatedPlan };
    });
  };

  const addFoodToLog = (clientId: string, foodName: string, kcal: number) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const updated = {
          ...c,
          metrics: {
            ...c.metrics,
            kcalToday: c.metrics.kcalToday + kcal
          }
        };
        supabaseDb.upsertClient(updated).catch(() => {});
        return updated;
      }
      return c;
    }));
  };

  const resetAllData = () => {
    localStorage.removeItem('strainer_clients');
    localStorage.removeItem('strainer_programs');
    localStorage.removeItem('strainer_nutrition');
    localStorage.removeItem('strainer_accent');
    localStorage.removeItem('roafit_clients');
    localStorage.removeItem('roafit_programs');
    localStorage.removeItem('roafit_nutrition');
    localStorage.removeItem('roafit_accent');
    setClients(INITIAL_CLIENTS);
    setPrograms(INITIAL_PROGRAMS);
    setNutritionPlans({ 'cli-juan': INITIAL_NUTRITION_PLAN });
    setAccentColor('#CFFF5C');
    setActiveClientId('cli-juan');
  };

  return (
    <AppContext.Provider
      value={{
        appName,
        setAppName,
        trainer,
        updateTrainer,
        clients,
        activeClient,
        activeClientId,
        setActiveClientId,
        programs,
        nutritionPlans,
        accentColor,
        setAccentColor,
        updateClient,
        updateClientPhoto,
        addClient,
        addTrainerNote,
        updateProgram,
        addProgram,
        updateNutritionPlan,
        toggleMealCompleted,
        toggleShoppingItem,
        addFoodToLog,
        resetAllData,
        supabaseUser,
        supabaseSession,
        userRole,
        authLoading,
        supabaseStatus,
        isRealtimeActive,
        lastSyncTime,
        signIn,
        signUp,
        signOut,
        syncAllToSupabase,
        refreshFromSupabase
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
