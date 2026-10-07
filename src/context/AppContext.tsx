import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { ActiveProgramAssignment, ClientData, Program, NutritionPlan, AccentColor, TrainerProfile, UserRole } from '../types';
import { supabase, supabaseDb, deserializeClientFromDb } from '../lib/supabase';
import { resolveProfileRole } from '../lib/profileRole.mjs';
import { resolveAccountAccess } from '../lib/accountAccessState.mjs';

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
  loadRealClientForUser?: (userId: string) => Promise<ClientData | null>;
  programs: Program[];
  activeProgramAssignment: ActiveProgramAssignment | null;
  activeProgramAssignmentStatus: 'idle' | 'loading' | 'loaded' | 'error';
  activeProgramAssignmentError: string | null;
  nutritionPlans: Record<string, NutritionPlan>;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  updateClient: (id: string, partial: Partial<ClientData>) => void;
  updateClientPhoto: (id: string, avatarUrl: string) => void;
  addClient: (client: Partial<ClientData>) => void;
  addTrainerNote: (clientId: string, content: string) => void;
  saveProgram: (program: Program) => Promise<void>;
  applyProgramToClient: (clientId: string, programId: string | null) => Promise<any>;
  updateNutritionPlan: (clientId: string, plan: NutritionPlan) => Promise<void>;
  toggleMealCompleted: (clientId: string, mealId: string) => Promise<void>;
  toggleShoppingItem: (clientId: string, category: string, itemName: string) => Promise<void>;
  addFoodToLog: (clientId: string, foodName: string, kcal: number, protein?: number) => void;
  resetAllData: () => void;
  // Supabase Auth & Realtime
  supabaseUser: User | null;
  supabaseSession: Session | null;
  userRole: UserRole | null;
  isAdmin: boolean;
  authLoading: boolean;
  accountAccessStatus: 'idle' | 'loading' | 'enabled' | 'pending' | 'suspended' | 'error';
  accountAccessError: string | null;
  retryAccountAccessResolution: () => Promise<void>;
  profileRoleStatus: 'idle' | 'loading' | 'resolved' | 'error';
  profileRoleError: string | null;
  retryProfileRoleResolution: () => Promise<void>;
  supabaseStatus: SupabaseStatus;
  isRealtimeActive: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  signOut: () => Promise<void>;
  refreshFromSupabase: (authenticatedUserId?: string, authenticatedRole?: UserRole | null) => Promise<void>;
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
    const saved = localStorage.getItem('strainer_clients');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // Evitar que datos mock antiguos de 'cli-juan' u otros se tomen como datos reales
      if (Array.isArray(parsed) && parsed.some((c: any) => c?.id?.startsWith('cli-juan') || c?.id === 'cli-lucia')) {
        localStorage.removeItem('strainer_clients');
        return [];
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [activeClientId, setActiveClientId] = useState<string>('');
  const [realClient, setRealClient] = useState<ClientData | null>(null);
  const [activeProgramAssignment, setActiveProgramAssignment] = useState<ActiveProgramAssignment | null>(null);
  const [activeProgramAssignmentStatus, setActiveProgramAssignmentStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [activeProgramAssignmentError, setActiveProgramAssignmentError] = useState<string | null>(null);
  const activeAssignmentRequest = useRef(0);

  const [programs, setPrograms] = useState<Program[]>(() => {
    const saved = localStorage.getItem('strainer_programs');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.some((p: any) => p?.id === 'prog-1' && p?.autoGenerated)) {
        localStorage.removeItem('strainer_programs');
        return [];
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const activeProgramOwnerId = useRef<string | null>(null);

  const [nutritionPlans, setNutritionPlans] = useState<Record<string, NutritionPlan>>(() => {
    const saved = localStorage.getItem('strainer_nutrition');
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && ('cli-juan' in parsed || 'nut-juan' in parsed)) {
        localStorage.removeItem('strainer_nutrition');
        return {};
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = localStorage.getItem('strainer_accent') || localStorage.getItem('roafit_accent');
    return (saved as AccentColor) || '#CFFF5C';
  });

  // Supabase State
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [accountAccessStatus, setAccountAccessStatus] = useState<'idle' | 'loading' | 'enabled' | 'pending' | 'suspended' | 'error'>('loading');
  const [accountAccessError, setAccountAccessError] = useState<string | null>(null);
  const [profileRoleStatus, setProfileRoleStatus] = useState<'idle' | 'loading' | 'resolved' | 'error'>('loading');
  const [profileRoleError, setProfileRoleError] = useState<string | null>(null);
  const profileRoleRequest = useRef(0);
  const accountAccessRequest = useRef(0);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>('connecting');
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  // Derived Admin flag
  const isAdmin = userRole === 'admin';

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

  // Load real client for authenticated client user
  const loadRealClientForUser = useCallback(async (userId: string): Promise<ClientData | null> => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error loading real client for user:', error);
        return null;
      }

      if (!data) {
        setRealClient(null);
        return null;
      }

      const client = deserializeClientFromDb(data);
      if (!client.id && data.id) client.id = data.id;
      if (!client.email && data.email) client.email = data.email;
      if (!client.name && data.name) client.name = data.name;
      if (!client.trainerId && data.trainer_id) client.trainerId = data.trainer_id;
      if (!client.weeklySchedule) client.weeklySchedule = [];
      if (!client.metrics) {
        client.metrics = {
          stepsToday: 0,
          stepsGoal: 10000,
          kcalToday: 0,
          kcalGoal: 2000,
          sleepHours: '7.5',
          sleepQuality: 'Bueno',
          waterLiters: 2,
          waterGoal: 2.5
        };
      }

      setRealClient(client);
      setActiveClientId(client.id);
      setClients(prev => {
        const exists = prev.some(c => c.id === client.id);
        if (exists) {
          return prev.map(c => c.id === client.id ? client : c);
        }
        return [client, ...prev.filter(c => !c.id.startsWith('cli-mock'))];
      });
      return client;
    } catch (err) {
      console.warn('Unexpected error in loadRealClientForUser:', err);
      return null;
    }
  }, []);

  // Load and sync from Supabase
  const refreshFromSupabase = useCallback(async (
    authenticatedUserId = supabaseUser?.id,
    authenticatedRole = userRole
  ) => {
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
      if (clientsRes.data) {
        setClients(clientsRes.data);
        if (clientsRes.data.length > 0) {
          // Si el activeClientId no existe en la lista de clientes traída, tomar el primero
          setActiveClientId(prev => {
            const exists = clientsRes.data?.some(c => c.id === prev);
            return exists ? prev : (clientsRes.data?.[0]?.id || '');
          });
        } else {
          setActiveClientId('');
        }
      }

      // Client prescription data is loaded only through its active assignment
      // and immutable program-version snapshot, never through programs.data.
      const programOwnerId = authenticatedRole === 'trainer' ? authenticatedUserId || '' : '';

      activeProgramOwnerId.current = programOwnerId || null;
      if (programOwnerId) {
        const programsRes = await supabaseDb.getPrograms(programOwnerId);
        setPrograms(programsRes.data || []);
      } else {
        setPrograms([]);
      }

      // Fetch Nutrition
      const nutritionRes = await supabaseDb.getNutritionPlans();
      if (nutritionRes.data) {
        setNutritionPlans(nutritionRes.data);
      }

      // Fetch Trainer Profile (filtrado por el id del usuario autenticado si existe)
      const trainerRes = await supabaseDb.getTrainerProfile(supabaseUser?.id);
      if (trainerRes.data) {
        setTrainer(trainerRes.data);
      }

    } catch (e) {
      console.warn('Error refreshing from Supabase:', e);
    }
  }, [clients, programs, supabaseUser?.id]);

  useEffect(() => {
    const request = ++activeAssignmentRequest.current;
    if (userRole !== 'client' || !realClient?.id || accountAccessStatus !== 'enabled') {
      setActiveProgramAssignment(null);
      setActiveProgramAssignmentStatus('idle');
      setActiveProgramAssignmentError(null);
      return;
    }

    setActiveProgramAssignment(null);
    setActiveProgramAssignmentStatus('loading');
    setActiveProgramAssignmentError(null);
    supabaseDb.getActiveProgramAssignment(realClient.id).then(({ data, error }) => {
      if (request !== activeAssignmentRequest.current) return;
      if (error) {
        setActiveProgramAssignmentStatus('error');
        setActiveProgramAssignmentError('No se pudo cargar la prescripción asignada. Reintenta más tarde.');
        return;
      }
      setActiveProgramAssignment(data);
      setActiveProgramAssignmentStatus('loaded');
    }).catch(() => {
      if (request !== activeAssignmentRequest.current) return;
      setActiveProgramAssignmentStatus('error');
      setActiveProgramAssignmentError('No se pudo cargar la prescripción asignada. Reintenta más tarde.');
    });

    return () => { activeAssignmentRequest.current += 1; };
  }, [userRole, realClient?.id, accountAccessStatus]);

  const loadProfileRole = async (userId: string) => {
    const request = ++profileRoleRequest.current;
    setUserRole(null);
    setProfileRoleStatus('loading');
    setProfileRoleError(null);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      const role = resolveProfileRole({ profile, error }) as UserRole | null;
      if (request !== profileRoleRequest.current) return { profile: null, role: null };
      if (!role) {
        setProfileRoleStatus('error');
        setProfileRoleError('No se pudo validar el perfil y su rol. Reintenta o cierra sesión.');
        return { profile: null, role: null };
      }
      setUserRole(role);
      setProfileRoleStatus('resolved');
      return { profile, role };
    } catch {
      if (request === profileRoleRequest.current) {
        setProfileRoleStatus('error');
        setProfileRoleError('No se pudo validar el perfil y su rol. Reintenta o cierra sesión.');
      }
      return { profile: null, role: null };
    }
  };

  const loadAccountAccess = async (userId: string) => {
    const request = ++accountAccessRequest.current;
    setAccountAccessStatus('loading');
    setAccountAccessError(null);
    try {
      const { data, error } = await supabase
        .from('account_access')
        .select('state')
        .eq('user_id', userId)
        .maybeSingle();
      const state = resolveAccountAccess({ row: data, error });
      if (request !== accountAccessRequest.current) return 'error';
      setAccountAccessStatus(state);
      if (state === 'error') {
        setAccountAccessError('No se pudo verificar el acceso de esta cuenta. Reintenta o cierra sesión.');
      }
      if (state !== 'enabled') {
        profileRoleRequest.current += 1;
        setUserRole(null);
        setProfileRoleStatus('idle');
      }
      return state;
    } catch {
      if (request === accountAccessRequest.current) {
        setAccountAccessStatus('error');
        setAccountAccessError('No se pudo verificar el acceso de esta cuenta. Reintenta o cierra sesión.');
        setUserRole(null);
        setProfileRoleStatus('idle');
      }
      return 'error';
    }
  };

  const retryProfileRoleResolution = async () => {
    if (!supabaseUser?.id) return;
    const accessState = await loadAccountAccess(supabaseUser.id);
    if (accessState !== 'enabled') return;
    const { profile, role } = await loadProfileRole(supabaseUser.id);
    if (!role || !profile) return;
    if (role === 'client') await loadRealClientForUser(supabaseUser.id);
    await refreshFromSupabase(supabaseUser.id, role);
  };

  const retryAccountAccessResolution = async () => {
    if (!supabaseUser?.id) return;
    const accessState = await loadAccountAccess(supabaseUser.id);
    if (accessState !== 'enabled') return;
    const { profile, role } = await loadProfileRole(supabaseUser.id);
    if (!role || !profile) return;
    if (role === 'client') await loadRealClientForUser(supabaseUser.id);
    await refreshFromSupabase(supabaseUser.id, role);
  };

  // Setup Supabase Auth listener & Realtime channels on mount
  useEffect(() => {
    let isMounted = true;

    // 1. Explicitly process Auth callback tokens before reading the initial
    // session. Some callback URLs contain an app marker before the token
    // fragment (for example `#activate#access_token=...`).
    const callbackUrl = new URL(window.location.href);
    let callbackHash = callbackUrl.hash.startsWith('#')
      ? callbackUrl.hash.slice(1)
      : callbackUrl.hash;
    const accessTokenIndex = callbackHash.indexOf('access_token=');
    if (accessTokenIndex >= 0) callbackHash = callbackHash.slice(accessTokenIndex);
    const callbackParams = new URLSearchParams(callbackHash);
    const accessToken = callbackParams.get('access_token');
    const refreshToken = callbackParams.get('refresh_token');

    const requestedFlow = callbackUrl.searchParams.get('flow') ||
      (callbackParams.get('type') === 'recovery'
        ? 'recovery'
        : callbackParams.get('type') === 'invite' || callbackUrl.hash.includes('activate')
          ? 'activate'
          : null);

    const establishCallbackSession = async () => {
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          if (requestedFlow) callbackUrl.searchParams.set('flow', requestedFlow);
          callbackUrl.hash = '';
          window.history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}`);
        }
      }

      return supabase.auth.getSession();
    };

    // 2. Get initial session after processing a callback, if present.
    establishCallbackSession().then(async ({ data: { session }, error }) => {
      if (!isMounted) return;
      if (session?.user) {
        setSupabaseSession(session);
        setSupabaseUser(session.user);
        try {
          const accessState = await loadAccountAccess(session.user.id);
          const { profile, role } = accessState === 'enabled'
            ? await loadProfileRole(session.user.id)
            : { profile: null, role: null };

          if (isMounted && role && profile) {

            if ((role === 'trainer' || role === 'admin') && profile) {
              const isRoleAdmin = role === 'admin';
              const roleDisplay = isRoleAdmin ? 'Administrador' : 'Entrenador';
              const fullName = profile.full_name || session.user.user_metadata?.full_name || profile.email?.split('@')[0] || roleDisplay;
              const initials = fullName.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || (isRoleAdmin ? 'AD' : 'TR');
              setTrainer({
                id: profile.id,
                name: fullName,
                email: profile.email || session.user.email || '',
                initials,
                role: roleDisplay,
                avatarUrl: profile.avatar_url || '',
                couponCode: 'STRAINER20'
              });
            } else if (role === 'client') {
              await loadRealClientForUser(session.user.id);
            }
            await refreshFromSupabase(session.user.id, role);
          }
        } catch (e) {
          console.warn('Error fetching initial profile:', e);
        }
      } else {
        profileRoleRequest.current += 1;
        accountAccessRequest.current += 1;
        setUserRole(null);
        setAccountAccessStatus('idle');
        setAccountAccessError(null);
        setProfileRoleStatus('idle');
        setProfileRoleError(null);
      }
      if (isMounted) setAuthLoading(false);
    });

    // 3. Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSupabaseSession(session);
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        try {
          const accessState = await loadAccountAccess(session.user.id);
          const { profile, role } = accessState === 'enabled'
            ? await loadProfileRole(session.user.id)
            : { profile: null, role: null };

          if (isMounted && role && profile) {

            if ((role === 'trainer' || role === 'admin') && profile) {
              const isRoleAdmin = role === 'admin';
              const roleDisplay = isRoleAdmin ? 'Administrador' : 'Entrenador';
              const fullName = profile.full_name || session.user.user_metadata?.full_name || profile.email?.split('@')[0] || roleDisplay;
              const initials = fullName.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || (isRoleAdmin ? 'AD' : 'TR');
              setTrainer({
                id: profile.id,
                name: fullName,
                email: profile.email || session.user.email || '',
                initials,
                role: roleDisplay,
                avatarUrl: profile.avatar_url || '',
                couponCode: 'STRAINER20'
              });
            } else if (role === 'client') {
              await loadRealClientForUser(session.user.id);
            }
          }
        } catch (e) {
          console.warn('Error fetching profile onAuthStateChange:', e);
        }
        
        // If client logs in, match active client by email if found
        const userEmail = session.user.email;
        if (userEmail) {
          const matched = clients.find(c => c.email.toLowerCase() === userEmail.toLowerCase());
          if (matched) {
            setActiveClientId(matched.id);
          }
        }
      } else {
        profileRoleRequest.current += 1;
        accountAccessRequest.current += 1;
        setUserRole(null);
        setAccountAccessStatus('idle');
        setAccountAccessError(null);
        setProfileRoleStatus('idle');
        setProfileRoleError(null);
        setTrainer(INITIAL_TRAINER);
        setRealClient(null);
        activeProgramOwnerId.current = null;
        setPrograms([]);
        localStorage.removeItem('strainer_user_role');
        localStorage.removeItem('strainer_trainer');
      }
      if (isMounted) setAuthLoading(false);
    });

    // 4. Initial health check & data fetch
    refreshFromSupabase();

    // 5. Setup Realtime Subscription
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
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const rowOwnerId = payload.new?.trainer_id;
          if (!rowOwnerId || rowOwnerId !== activeProgramOwnerId.current) return;
          const updated = { ...(payload.new?.data as Program), trainerId: rowOwnerId };
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
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nutrition_plans' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const client_id = payload.new?.client_id;
          const plan = payload.new?.data as NutritionPlan;
          if (client_id && plan) {
            setNutritionPlans(prev => ({ ...prev, [client_id]: plan }));
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

      setSupabaseUser(data.user);
      setSupabaseSession(data.session);

      const accessState = await loadAccountAccess(data.user.id);
      if (accessState !== 'enabled') {
        setAuthLoading(false);
        return { success: false, error: accessState === 'error'
          ? 'No se pudo verificar el acceso de esta cuenta.'
          : 'Esta cuenta todavía no tiene acceso habilitado.' };
      }

      const { profile, role } = await loadProfileRole(data.user.id);
      if (!role || !profile) {
        setAuthLoading(false);
        return { success: false, error: 'No se pudo validar el perfil de esta cuenta. Reintenta o contacta con soporte.' };
      }

      // Link trainer or client
      if (role === 'trainer' || role === 'admin') {
        const fullName = profile?.full_name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || (role === 'admin' ? 'Administrador' : 'Entrenador');
        updateTrainer({
          id: data.user.id,
          email: data.user.email || '',
          name: fullName,
          role: role === 'admin' ? 'Administrador' : 'Entrenador'
        });
      } else {
        const found = clients.find(c => c.email.toLowerCase() === data.user.email?.toLowerCase());
        if (found) {
          setActiveClientId(found.id);
        }
      }

      await refreshFromSupabase(data.user.id, role);
      setAuthLoading(false);
      return { success: true, role };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, error: err.message || 'Error al iniciar sesión' };
    }
  };

  const signOut = async () => {
    profileRoleRequest.current += 1;
    accountAccessRequest.current += 1;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setSupabaseUser(null);
    setSupabaseSession(null);
    setUserRole(null);
    setAccountAccessStatus('idle');
    setAccountAccessError(null);
    setProfileRoleStatus('idle');
    setProfileRoleError(null);
    setRealClient(null);
    setActiveProgramAssignment(null);
    setActiveProgramAssignmentStatus('idle');
    setTrainer(INITIAL_TRAINER);
    localStorage.removeItem('strainer_user_role');
    localStorage.removeItem('strainer_trainer');
  };

  const activeClient: ClientData = (userRole === 'client')
    ? (realClient || (clients.find(c => c.id === activeClientId && !c.id.startsWith('cli-mock')) || null) as unknown as ClientData)
    : (clients.find(c => c.id === activeClientId) || clients[0]);

  const updateClient = (id: string, partial: Partial<ClientData>) => {
    if (realClient && realClient.id === id) {
      setRealClient(prev => prev ? { ...prev, ...partial } : null);
    }
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
      ...(clientData.pathologies ? { pathologies: clientData.pathologies } : {}),
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
      assignedProgramId: clientData.assignedProgramId || '',
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
    // Solo se envía ownerId (supabaseUser?.id) al crear el cliente, nunca al editarlo
    supabaseDb.upsertClient(newClient, supabaseUser?.id).catch(() => {});
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
          trainerNotes: [newNote, ...(c.trainerNotes ?? [])]
        };
        supabaseDb.upsertClient(updated).catch(() => {});
        return updated;
      }
      return c;
    }));
  };

  const saveProgram = async (program: Program) => {
    if (userRole !== 'trainer' || !supabaseUser?.id || accountAccessStatus !== 'enabled') {
      throw new Error('Solo un Trainer con acceso habilitado puede guardar programas.');
    }

    const isExistingProgram = programs.some(existing => existing.id === program.id);
    const { data, error } = await supabaseDb.upsertProgram(
      program,
      isExistingProgram ? undefined : supabaseUser.id
    );
    if (error) throw error;
    if (!data?.id) throw new Error('Supabase no confirmó el guardado del programa.');

    setPrograms(prev => prev.some(existing => existing.id === program.id)
      ? prev.map(existing => existing.id === program.id ? program : existing)
      : [program, ...prev]);
  };

  const applyProgramToClient = async (clientId: string, programId: string | null) => {
    if (userRole !== 'trainer' || accountAccessStatus !== 'enabled') {
      throw new Error('Solo un Trainer con acceso habilitado puede aplicar una prescripción.');
    }
    const { data, error } = await supabaseDb.applyProgramToClient(clientId, programId);
    if (error) throw error;
    if (!data || (programId && (!data.assignment?.id || !data.program_version?.id))) {
      throw new Error('Supabase no confirmó la prescripción del cliente.');
    }
    return data;
  };

  const updateNutritionPlan = async (clientId: string, plan: NutritionPlan) => {
    if (userRole !== 'trainer') {
      throw new Error('Solo una cuenta Trainer puede guardar planes nutricionales desde este flujo.');
    }
    const { error } = await supabaseDb.upsertNutritionPlan(clientId, plan);
    if (error) throw error;
    setNutritionPlans(prev => ({ ...prev, [clientId]: { ...plan, clientId } }));
  };

  const toggleMealCompleted = async (clientId: string, mealId: string) => {
    const plan = nutritionPlans[clientId];
    if (!plan) return;
    const updatedMeals = plan.meals.map(m => m.id === mealId ? { ...m, completed: !m.completed } : m);
    const updatedPlan = { ...plan, meals: updatedMeals };
    const { error } = await supabaseDb.upsertNutritionPlan(clientId, updatedPlan);
    if (error) throw error;
    setNutritionPlans(prev => ({ ...prev, [clientId]: updatedPlan }));
  };

  const toggleShoppingItem = async (clientId: string, categoryName: string, itemName: string) => {
    const plan = nutritionPlans[clientId];
    if (!plan) return;
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
    const { error } = await supabaseDb.upsertNutritionPlan(clientId, updatedPlan);
    if (error) throw error;
    setNutritionPlans(prev => ({ ...prev, [clientId]: updatedPlan }));
  };

  const addFoodToLog = (clientId: string, foodName: string, kcal: number) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        if (typeof c.metrics?.kcalToday !== 'number') return c;
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
    setClients([]);
    setPrograms([]);
    setNutritionPlans({});
    setAccentColor('#CFFF5C');
    setActiveClientId('');
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
        loadRealClientForUser,
        programs,
        activeProgramAssignment,
        activeProgramAssignmentStatus,
        activeProgramAssignmentError,
        nutritionPlans,
        accentColor,
        setAccentColor,
        updateClient,
        updateClientPhoto,
        addClient,
        addTrainerNote,
        saveProgram,
        applyProgramToClient,
        updateNutritionPlan,
        toggleMealCompleted,
        toggleShoppingItem,
        addFoodToLog,
        resetAllData,
        supabaseUser,
        supabaseSession,
        userRole,
        isAdmin,
        authLoading,
        accountAccessStatus,
        accountAccessError,
        retryAccountAccessResolution,
        profileRoleStatus,
        profileRoleError,
        retryProfileRoleResolution,
        supabaseStatus,
        isRealtimeActive,
        signIn,
        signOut,
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
