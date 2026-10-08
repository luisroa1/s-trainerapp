import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { ActiveProgramAssignment, ActiveNutritionPlan, ClientData, Program, NutritionPlanDraftRecord, NutritionPlanSnapshot, AccentColor, TrainerProfile, UserRole } from '../types';
import { supabase, supabaseDb, deserializeClientFromDb, IS_READ_ONLY_PREVIEW } from '../lib/supabase';
import { resolveProfileRole } from '../lib/profileRole.mjs';
import { resolveAccountAccess } from '../lib/accountAccessState.mjs';
import { resolveInitialSession } from '../lib/initialSessionResolution.mjs';
import { assertPreviewWritesAllowed } from '../lib/supabaseReadOnlyGuard.mjs';

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
  nutritionPlans: Record<string, NutritionPlanDraftRecord>;
  activeNutritionPlan: ActiveNutritionPlan | null;
  nutritionPlanStatus: 'idle' | 'loading' | 'loaded' | 'error';
  nutritionPlanError: string | null;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
  updateClient: (id: string, partial: Partial<ClientData>) => void;
  updateClientPhoto: (id: string, avatarUrl: string) => void;
  addClient: (client: Partial<ClientData>) => void;
  addTrainerNote: (clientId: string, content: string) => void;
  saveProgram: (program: Program) => Promise<void>;
  applyProgramToClient: (clientId: string, programId: string | null) => Promise<any>;
  saveNutritionPlanDraft: (clientId: string, planId: string | null, snapshot: NutritionPlanSnapshot) => Promise<string>;
  applyNutritionPlan: (planId: string, requestKey: string) => Promise<any>;
  resetAllData: () => void;
  // Supabase Auth & Realtime
  supabaseUser: User | null;
  supabaseSession: Session | null;
  userRole: UserRole | null;
  isAdmin: boolean;
  authLoading: boolean;
  authInitializationError: string | null;
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
  const assertWritable = (operation: string) => {
    assertPreviewWritesAllowed(IS_READ_ONLY_PREVIEW, operation);
  };
  const [appName, setAppNameState] = useState<string>(() => {
    if (IS_READ_ONLY_PREVIEW) return 'S-Trainer app — Plataforma de Entrenamiento';
    const saved = localStorage.getItem('strainer_app_name');
    if (!saved || saved.toLowerCase().includes('roafit') || saved === 'S-Trainer app') {
      return 'S-Trainer app — Plataforma de Entrenamiento';
    }
    return saved;
  });

  const [trainer, setTrainer] = useState<TrainerProfile>(() => {
    if (IS_READ_ONLY_PREVIEW) return INITIAL_TRAINER;
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
    if (IS_READ_ONLY_PREVIEW) return [];
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
    if (IS_READ_ONLY_PREVIEW) return [];
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

  const [nutritionPlans, setNutritionPlans] = useState<Record<string, NutritionPlanDraftRecord>>({});
  const [activeNutritionPlan, setActiveNutritionPlan] = useState<ActiveNutritionPlan | null>(null);
  const [nutritionPlanStatus, setNutritionPlanStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [nutritionPlanError, setNutritionPlanError] = useState<string | null>(null);

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (IS_READ_ONLY_PREVIEW) return '#CFFF5C';
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
  const authEventGeneration = useRef(0);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authInitializationError, setAuthInitializationError] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>('connecting');
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  // Derived Admin flag
  const isAdmin = userRole === 'admin';

  const setAppName = (name: string) => {
    assertWritable('Cambiar el nombre de la aplicación');
    setAppNameState(name);
    localStorage.setItem('strainer_app_name', name);
  };

  const setAccentColor = (color: AccentColor) => {
    assertWritable('Cambiar el tema de la aplicación');
    setAccentColorState(color);
  };

  const updateTrainer = (partial: Partial<TrainerProfile>) => {
    setTrainer(prev => {
      const updated = { ...prev, ...partial };
      if (partial.name && !partial.initials) {
        updated.initials = partial.name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      }
      if (updated.id && !IS_READ_ONLY_PREVIEW) {
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
    if (IS_READ_ONLY_PREVIEW) return;
    localStorage.setItem('strainer_app_name', appName);
  }, [appName]);

  useEffect(() => {
    if (IS_READ_ONLY_PREVIEW) return;
    if (trainer.id) {
      localStorage.setItem('strainer_trainer', JSON.stringify(trainer));
    } else {
      localStorage.removeItem('strainer_trainer');
    }
  }, [trainer]);

  useEffect(() => {
    if (IS_READ_ONLY_PREVIEW) return;
    localStorage.setItem('strainer_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    if (IS_READ_ONLY_PREVIEW) return;
    localStorage.setItem('strainer_programs', JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    if (!IS_READ_ONLY_PREVIEW) localStorage.setItem('strainer_accent', accentColor);
    document.documentElement.style.setProperty('--accent-color', accentColor);
    const darkText = accentColor === '#CFFF5C' || accentColor === '#FFD34D';
    document.documentElement.style.setProperty('--accent-text', darkText ? '#101012' : '#FFFFFF');
  }, [accentColor]);

  // Load real client for authenticated client user
  const loadRealClientForUser = useCallback(async (
    userId: string,
    isCurrentAuthState: () => boolean = () => true
  ): Promise<ClientData | null> => {
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
        if (!isCurrentAuthState()) return null;
        setRealClient(null);
        return null;
      }

      if (!isCurrentAuthState()) return null;

      const client = deserializeClientFromDb(data);
      if (!client.id && data.id) client.id = data.id;
      if (!client.email && data.email) client.email = data.email;
      if (!client.name && data.name) client.name = data.name;
      if (!client.trainerId && data.trainer_id) client.trainerId = data.trainer_id;
      if (!client.weeklySchedule) client.weeklySchedule = [];

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
    authenticatedRole = userRole,
    isCurrentAuthState: () => boolean = () => true
  ) => {
    try {
      const health = await supabaseDb.testConnection();
      if (!isCurrentAuthState()) return;
      if (!health.connected) {
        setSupabaseStatus('error');
        return;
      }
      if (!health.hasTables) {
        setSupabaseStatus('needs_tables');
        return;
      }

      setSupabaseStatus('connected');
      setNutritionPlans({});
      setActiveNutritionPlan(null);
      setNutritionPlanStatus('loading');
      setNutritionPlanError(null);

      // Fetch Clients
      const clientsRes = await supabaseDb.getClients();
      if (!isCurrentAuthState()) return;
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
        if (!isCurrentAuthState()) return;
        setPrograms(programsRes.data || []);
      } else {
        setPrograms([]);
      }

      // Nutrition Planned comes only from trainer-owned draft identities or the
      // Client's active assignment -> immutable version. Legacy localStorage
      // and nutrition_plans.data are not read as a fallback.
      setNutritionPlanStatus('loading');
      setNutritionPlanError(null);
      if (authenticatedRole === 'trainer' || authenticatedRole === 'admin') {
        const nutritionRes = await supabaseDb.getNutritionPlanDrafts();
        if (!isCurrentAuthState()) return;
        if (nutritionRes.error) {
          setNutritionPlanStatus('error');
          setNutritionPlanError('No se pudieron cargar los borradores nutricionales.');
        } else {
          setNutritionPlans(nutritionRes.data || {});
          setActiveNutritionPlan(null);
          setNutritionPlanStatus('loaded');
        }
      } else if (authenticatedRole === 'client') {
        const nutritionRes = await supabaseDb.getActiveNutritionPlan();
        if (!isCurrentAuthState()) return;
        if (nutritionRes.error) {
          setNutritionPlanStatus('error');
          setNutritionPlanError('No se pudo cargar la prescripción nutricional.');
        } else {
          setActiveNutritionPlan(nutritionRes.data);
          setNutritionPlans({});
          setNutritionPlanStatus('loaded');
        }
      } else {
        setNutritionPlans({});
        setActiveNutritionPlan(null);
        setNutritionPlanStatus('loaded');
      }

      // Fetch Trainer Profile (filtrado por el id del usuario autenticado si existe)
      const trainerRes = await supabaseDb.getTrainerProfile(supabaseUser?.id);
      if (!isCurrentAuthState()) return;
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
    void resolveInitialSession(establishCallbackSession, () => authEventGeneration.current, {
      onSession: async (session, isCurrent) => {
        if (!isMounted || !isCurrent()) return;
        setAuthInitializationError(null);
        setSupabaseSession(session);
        setSupabaseUser(session.user);
        try {
          const accessState = await loadAccountAccess(session.user.id);
          if (!isMounted || !isCurrent()) return;
          const { profile, role } = accessState === 'enabled'
            ? await loadProfileRole(session.user.id)
            : { profile: null, role: null };

          if (!isMounted || !isCurrent()) return;
          if (role && profile) {
            if (role === 'trainer' || role === 'admin') {
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
              await loadRealClientForUser(session.user.id, isCurrent);
              if (!isMounted || !isCurrent()) return;
            }
            await refreshFromSupabase(session.user.id, role, isCurrent);
          }
        } catch (e) {
          console.warn('Error fetching initial profile:', e);
        }
      },
      onNoSession: isCurrent => {
        if (!isMounted || !isCurrent()) return;
        setAuthInitializationError(null);
        profileRoleRequest.current += 1;
        accountAccessRequest.current += 1;
        setSupabaseSession(null);
        setSupabaseUser(null);
        setUserRole(null);
        setAccountAccessStatus('idle');
        setAccountAccessError(null);
        setProfileRoleStatus('idle');
        setProfileRoleError(null);
      },
      onError: (error, isCurrent) => {
        if (!isMounted || !isCurrent()) return;
        console.error('Unable to establish the initial auth session:', error);
        setAuthInitializationError('No se pudo verificar tu sesión. Recarga para intentarlo de nuevo.');
        setSupabaseSession(null);
        setSupabaseUser(null);
        setUserRole(null);
        setAccountAccessStatus('idle');
        setAccountAccessError(null);
        setProfileRoleStatus('idle');
        setProfileRoleError(null);
      },
      onSettled: () => {
        if (isMounted) setAuthLoading(false);
      }
    });

    // 3. Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      const eventGeneration = ++authEventGeneration.current;
      const isCurrentAuthEvent = () => isMounted && authEventGeneration.current === eventGeneration;
      if (session?.user) setAuthInitializationError(null);
      setSupabaseSession(session);
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        try {
          const accessState = await loadAccountAccess(session.user.id);
          if (!isCurrentAuthEvent()) return;
          const { profile, role } = accessState === 'enabled'
            ? await loadProfileRole(session.user.id)
            : { profile: null, role: null };

          if (!isCurrentAuthEvent()) return;
          if (role && profile) {

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
              await loadRealClientForUser(session.user.id, isCurrentAuthEvent);
              if (!isCurrentAuthEvent()) return;
            }
          }
        } catch (e) {
          console.warn('Error fetching profile onAuthStateChange:', e);
        }
        
        // If client logs in, match active client by email if found
        const userEmail = session.user.email;
        if (isCurrentAuthEvent() && userEmail) {
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
        setNutritionPlans({});
        setActiveNutritionPlan(null);
        setNutritionPlanStatus('idle');
        setNutritionPlanError(null);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nutrition_plan_definitions' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (row?.client_id && row?.id && row?.draft_snapshot && row?.trainer_id === activeProgramOwnerId.current) {
            setNutritionPlans(prev => ({ ...prev, [row.client_id]: { id: row.id, clientId: row.client_id, snapshot: row.draft_snapshot } }));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_nutrition_assignments' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          void supabaseDb.getActiveNutritionPlan().then(({ data, error }) => {
            if (!error) setActiveNutritionPlan(data);
          });
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
    assertWritable('Editar datos del cliente');
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
    assertWritable('Crear un cliente');
    const newId = `cli-${Date.now()}`;
    const name = clientData.name?.trim() ?? '';
    const initials = name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const newClient: ClientData = {
      ...clientData,
      id: newId,
      name,
      initials,
      email: clientData.email ?? '',
      phone: clientData.phone ?? '',
      birthDate: clientData.birthDate ?? '',
      sex: clientData.sex ?? 'Otro',
      height: clientData.height ?? '',
      objective: clientData.objective ?? '',
      status: clientData.status ?? 'Pendiente',
      assignedProgramId: clientData.assignedProgramId ?? '',
      weeklySchedule: clientData.weeklySchedule ?? []
    };

    setClients(prev => [newClient, ...prev]);
    setActiveClientId(newId);
    // Solo se envía ownerId (supabaseUser?.id) al crear el cliente, nunca al editarlo
    supabaseDb.upsertClient(newClient, supabaseUser?.id).catch(() => {});
  };

  const addTrainerNote = (clientId: string, content: string) => {
    assertWritable('Crear una nota');
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
    assertWritable('Guardar un programa');
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
    assertWritable('Aplicar o retirar un programa');
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

  const saveNutritionPlanDraft = async (clientId: string, planId: string | null, snapshot: NutritionPlanSnapshot) => {
    assertWritable('Guardar un plan nutricional');
    if (userRole !== 'trainer' || accountAccessStatus !== 'enabled') {
      throw new Error('Solo un Trainer habilitado puede guardar un borrador nutricional.');
    }
    const { data, error } = await supabaseDb.saveNutritionPlanDraft(clientId, planId, snapshot);
    if (error) throw error;
    if (!data?.id) throw new Error('Supabase no confirmó el borrador.');
    setNutritionPlans(prev => ({ ...prev, [clientId]: { id: data.id, clientId, snapshot } }));
    setNutritionPlanStatus('loaded');
    return data.id;
  };

  const applyNutritionPlan = async (planId: string, requestKey: string) => {
    assertWritable('Aplicar un plan nutricional');
    if (userRole !== 'trainer' || accountAccessStatus !== 'enabled') {
      throw new Error('Solo un Trainer habilitado puede asignar una prescripción nutricional.');
    }
    const { data, error } = await supabaseDb.applyNutritionPlan(planId, requestKey);
    if (error) throw error;
    if (!data?.assignment_id || !data?.version_id) throw new Error('Supabase no confirmó la asignación.');
    return data;
  };

  const resetAllData = () => {
    assertWritable('Restablecer datos locales');
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
    setActiveNutritionPlan(null);
    setNutritionPlanStatus('idle');
    setNutritionPlanError(null);
    setAccentColorState('#CFFF5C');
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
        activeNutritionPlan,
        nutritionPlanStatus,
        nutritionPlanError,
        accentColor,
        setAccentColor,
        updateClient,
        updateClientPhoto,
        addClient,
        addTrainerNote,
        saveProgram,
        applyProgramToClient,
        saveNutritionPlanDraft,
        applyNutritionPlan,
        resetAllData,
        supabaseUser,
        supabaseSession,
        userRole,
        isAdmin,
        authLoading,
        authInitializationError,
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
