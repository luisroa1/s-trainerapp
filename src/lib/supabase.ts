import { createClient } from '@supabase/supabase-js';
import { ActiveProgramAssignment, ActiveNutritionPlan, ClientData, NutritionAssignmentContext, NutritionLogEvent, NutritionLogEventInput, NutritionPlanDraftRecord, NutritionPlanSnapshot, Program, TrainerNutritionLogEvent, TrainerProfile, UserRole, WorkoutSessionView, WorkoutSetResult, TrainerWorkoutHistoryEntry } from '../types';
import { validateSupabaseTarget } from './supabaseTarget.mjs';
import { applyNutritionPlan as applyNutritionPlanRequest, getActiveNutritionPlan as readActiveNutritionPlan, getNutritionPlanDrafts as readNutritionPlanDrafts, saveNutritionPlanDraft as persistNutritionPlanDraft } from './nutritionPlanPersistence.mjs';
import { clientDataWithoutLegacyAssignment, readAssignedProgramId } from './clientAssignment.mjs';
import { clientFieldsFromPersistedData, readOptionalPersistedNumber } from './clientLegacyFields.mjs';
import { workoutSessionFromRpc } from './workoutExecution.mjs';
import { buildTrainerWorkoutHistory } from './trainerWorkoutHistory.mjs';

const appTarget = import.meta.env.VITE_APP_TARGET?.trim();
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredPublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const validatedTarget = validateSupabaseTarget({
  appTarget,
  supabaseUrl: configuredSupabaseUrl,
  publishableKey: configuredPublishableKey,
});

export const SUPABASE_URL = validatedTarget.supabaseUrl;
export const SUPABASE_PROJECT_REF = validatedTarget.projectRef;
export const SUPABASE_ANON_KEY = validatedTarget.publishableKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper: Format client for database storage
export const serializeClientToDb = (client: ClientData, ownerId?: string) => {
  const payload: any = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    sex: client.sex,
    height: client.height,
    objective: client.objective,
    status: client.status,
    current_weight: client.currentWeight,
    // Program assignment is written only by invite-client. Generic client
    // upserts must not create or restore it from React/localStorage state.
    data: clientDataWithoutLegacyAssignment(client), // Structured compatibility data
    updated_at: new Date().toISOString()
  };

  // Solo incluir trainer_id si se pasa explícitamente (ej. al crear cliente nuevo),
  // para no pisar el trainer_id existente en actualizaciones posteriores.
  if (ownerId) {
    payload.trainer_id = ownerId;
  }

  return payload;
};

export const deserializeClientFromDb = (row: any): ClientData => {
  const persistedFields = clientFieldsFromPersistedData(row.data);
  if (persistedFields.name) {
    const currentWeight = readCurrentWeight(row);
    const adherencePercentage = readOptionalPersistedNumber(row.adherence_percentage ?? row.data?.adherencePercentage);
    return {
      ...persistedFields,
      id: row.id,
      name: row.name || row.data.name,
      email: row.email || row.data.email,
      phone: row.phone || row.data.phone,
      objective: row.objective || row.data.objective,
      status: row.status || row.data.status,
      ...(currentWeight !== undefined ? { currentWeight } : {}),
      ...(adherencePercentage !== undefined ? { adherencePercentage } : {}),
      assignedProgramId: readAssignedProgramId(row),
      trainerId: row.trainer_id || row.data.trainerId
    };
  }
  return {
    ...persistedFields,
    trainerId: row.trainer_id || (row.data as any)?.trainerId,
    assignedProgramId: readAssignedProgramId(row)
  };
};

const readCurrentWeight = (row: any): number | undefined => {
  const value = row.current_weight ?? row.data?.currentWeight;
  return readOptionalPersistedNumber(value);
};

// Database Read/Write Operations with graceful fallback
export const supabaseDb = {
  // Clients
  async getClients(): Promise<{ data: ClientData[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) return { data: null, error };
      if (!data || data.length === 0) return { data: [], error: null };
      
      const mapped = data.map(deserializeClientFromDb).filter(Boolean);
      return { data: mapped, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async upsertClient(client: ClientData, ownerId?: string): Promise<{ error: any }> {
    try {
      const payload = serializeClientToDb(client, ownerId);
      const { error } = await supabase
        .from('clients')
        .upsert(payload, { onConflict: 'id' });
      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  // Programs
  async getPrograms(trainerId: string): Promise<{ data: Program[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('trainer_id', trainerId);
      
      if (error) return { data: null, error };
      if (!data || data.length === 0) return { data: [], error: null };

      const programs = data.map(r => ({
        ...(r.data?.id ? r.data : { ...r, id: r.id }),
        trainerId: r.trainer_id,
      })) as Program[];
      return { data: programs, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async upsertProgram(program: Program, ownerId?: string): Promise<{ data: { id: string } | null; error: any }> {
    try {
      const payload: any = {
        id: program.id,
        name: program.name,
        type: program.type,
        level: program.level,
        duration_weeks: program.durationWeeks,
        days_per_week: program.daysPerWeek,
        data: program,
        updated_at: new Date().toISOString()
      };
      // Solo incluir trainer_id si se pasa explícitamente (al crear nuevo programa)
      if (ownerId) {
        payload.trainer_id = ownerId;
      }

      const { data, error } = await supabase
        .from('programs')
        .upsert(payload, { onConflict: 'id' })
        .select('id')
        .single();
      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async getActiveProgramAssignment(clientId: string): Promise<{ data: ActiveProgramAssignment | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('client_program_assignments')
        .select('id,client_id,program_version_id,assigned_by,assigned_at,ended_at,program_version:program_versions(id,program_id,version_number,snapshot,created_at)')
        .eq('client_id', clientId)
        .is('ended_at', null)
        .maybeSingle();
      if (error) return { data: null, error };
      if (!data) return { data: null, error: null };

      const version = Array.isArray(data.program_version) ? data.program_version[0] : data.program_version;
      if (!version?.id || !version.snapshot || !Array.isArray(version.snapshot.days)) {
        return { data: null, error: new Error('La prescripción asignada no tiene un snapshot válido.') };
      }
      return { data: { ...data, program_version: version } as ActiveProgramAssignment, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTrainerWorkoutHistory(
    clientId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {},
  ): Promise<{ data: TrainerWorkoutHistoryEntry[] | null; error: any }> {
    try {
      const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 20;
      const safeOffset = Number.isInteger(offset) ? Math.max(0, offset) : 0;
      const { data: sessionRows, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('id,client_program_assignment_id,program_day_id,started_at,completed_at,assignment:client_program_assignments!inner(id,client_id,program_version_id,assigned_at,ended_at,program_version:program_versions!inner(id,program_id,version_number,snapshot))')
        .eq('assignment.client_id', clientId)
        .order('started_at', { ascending: false })
        .order('id', { ascending: true })
        .range(safeOffset, safeOffset + safeLimit - 1);
      if (sessionError) return { data: null, error: sessionError };

      if (!sessionRows?.length) return { data: [], error: null };

      const sessionIds = sessionRows.map(row => row.id);
      const resultRows: WorkoutSetResult[] = [];
      const resultPageSize = 1000;
      for (let resultOffset = 0; ; resultOffset += resultPageSize) {
        const { data, error } = await supabase
          .from('workout_set_results')
          .select('id,workout_session_id,exercise_id,set_number,reps_performed,duration_seconds,load_kind,load_kg,rir_performed,note,created_at,updated_at')
          .in('workout_session_id', sessionIds)
          .order('exercise_id', { ascending: true })
          .order('set_number', { ascending: true })
          .range(resultOffset, resultOffset + resultPageSize - 1);
        if (error) return { data: null, error };
        resultRows.push(...((data || []) as WorkoutSetResult[]));
        if (!data || data.length < resultPageSize) break;
      }

      const model = buildTrainerWorkoutHistory(sessionRows, resultRows, clientId);
      return { data: model as TrainerWorkoutHistoryEntry[], error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async applyProgramToClient(clientId: string, programId: string | null): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('apply_program_to_client', {
        p_assignment_id: globalThis.crypto.randomUUID(),
        p_client_id: clientId,
        p_program_id: programId,
      });
      if (error) return { data: null, error };
      if (!data || typeof data !== 'object' || !Object.hasOwn(data, 'assignment')) {
        return { data: null, error: new Error('Supabase no confirmó la asignación.') };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getOpenWorkoutSession(): Promise<{ data: WorkoutSessionView | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('get_open_workout_session');
      if (error) return { data: null, error };
      if (data === null) return { data: null, error: null };
      const session = workoutSessionFromRpc(data) as WorkoutSessionView | null;
      if (!session) return { data: null, error: new Error('Supabase devolvió una sesión incompleta.') };
      return { data: session, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async startWorkoutSession(programDayId: string): Promise<{ data: WorkoutSessionView | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('start_workout_session', { p_program_day_id: programDayId });
      if (error) return { data: null, error };
      const session = workoutSessionFromRpc(data) as WorkoutSessionView | null;
      if (!session) return { data: null, error: new Error('Supabase no confirmó el inicio de la sesión.') };
      return { data: session, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async saveWorkoutSetResult(input: Omit<WorkoutSetResult, 'id' | 'workout_session_id' | 'created_at' | 'updated_at'> & { workout_session_id: string }): Promise<{ data: WorkoutSetResult | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('save_workout_set_result', {
        p_workout_session_id: input.workout_session_id,
        p_exercise_id: input.exercise_id,
        p_set_number: input.set_number,
        p_reps_performed: input.reps_performed,
        p_duration_seconds: input.duration_seconds,
        p_load_kind: input.load_kind,
        p_load_kg: input.load_kg,
        p_rir_performed: input.rir_performed,
        p_note: input.note,
      });
      if (error) return { data: null, error };
      if (!data?.id || data.workout_session_id !== input.workout_session_id) {
        return { data: null, error: new Error('Supabase no confirmó la serie guardada.') };
      }
      return { data: data as WorkoutSetResult, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async finishWorkoutSession(sessionId: string): Promise<{ data: WorkoutSessionView | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('finish_workout_session', { p_workout_session_id: sessionId });
      if (error) return { data: null, error };
      const session = workoutSessionFromRpc(data) as WorkoutSessionView | null;
      if (!session?.session.completed_at) {
        return { data: null, error: new Error('Supabase no confirmó la finalización de la sesión.') };
      }
      return { data: session, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Canonical Nutrition Planned read/write paths.
  async getNutritionPlanDrafts(): Promise<{ data: Record<string, NutritionPlanDraftRecord> | null; error: any }> {
    try {
      const data = await readNutritionPlanDrafts(supabase);
      const result: Record<string, NutritionPlanDraftRecord> = {};
      for (const row of data) {
        if (row.client_id && row.id && row.draft_snapshot) {
          result[row.client_id] = { id: row.id, clientId: row.client_id, snapshot: row.draft_snapshot };
        }
      }
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getActiveNutritionPlan(): Promise<{ data: ActiveNutritionPlan | null; error: any }> {
    try {
      return { data: await readActiveNutritionPlan(supabase), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async saveNutritionPlanDraft(clientId: string, planId: string | null, snapshot: NutritionPlanSnapshot): Promise<{ data: { id: string } | null; error: any }> {
    try {
      const id = await persistNutritionPlanDraft(supabase, clientId, planId, snapshot);
      return { data: { id }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async applyNutritionPlan(planId: string, requestKey: string): Promise<{ data: any | null; error: any }> {
    try {
      return { data: await applyNutritionPlanRequest(supabase, planId, requestKey), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getClientNutritionLogDay(nutritionDate: string): Promise<{ data: { events: NutritionLogEvent[]; assignments: NutritionAssignmentContext[] } | null; error: any }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) return { data: null, error: authError };
      if (!authData?.user?.id) return { data: { events: [], assignments: [] }, error: null };
      const { data: client, error: clientError } = await supabase.from('clients').select('id').eq('user_id', authData.user.id).maybeSingle();
      if (clientError) return { data: null, error: clientError };
      if (!client?.id) return { data: { events: [], assignments: [] }, error: null };
      const { data: events, error } = await supabase.from('nutrition_log_events').select('*')
        .eq('client_id', client.id).eq('nutrition_date', nutritionDate).order('occurred_at', { ascending: true });
      if (error) return { data: null, error };
      const rows = events || [];
      const itemsResult = rows.length
        ? await supabase.from('nutrition_log_event_items').select('*').in('event_id', rows.map((event: any) => event.id))
        : { data: [], error: null };
      if (itemsResult.error) return { data: null, error: itemsResult.error };
      const assignmentsResult = await supabase.from('client_nutrition_assignments')
        .select('id,client_id,nutrition_plan_version_id,assigned_at,ended_at').eq('client_id', client.id)
        .order('assigned_at', { ascending: true });
      if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
      const versionIds = [...new Set((assignmentsResult.data || []).map((assignment: any) => assignment.nutrition_plan_version_id))] as string[];
      const versionsResult = versionIds.length
        ? await supabase.from('nutrition_plan_versions').select('id,snapshot').eq('client_id', client.id).in('id', versionIds)
        : { data: [], error: null };
      if (versionsResult.error) return { data: null, error: versionsResult.error };
      const snapshots = new Map((versionsResult.data || []).map((version: any) => [version.id, version.snapshot]));
      const assignments: NutritionAssignmentContext[] = (assignmentsResult.data || []).map((assignment: any) => ({
        ...assignment, snapshot: snapshots.get(assignment.nutrition_plan_version_id) || null,
      }));
      const byEvent = new Map<string, any[]>();
      for (const item of itemsResult.data || []) byEvent.set(item.event_id, [...(byEvent.get(item.event_id) || []), item]);
      return { data: { events: rows.map((event: any) => ({ ...event, items: byEvent.get(event.id) || [] } as NutritionLogEvent)), assignments }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async recordNutritionLogEvent(input: NutritionLogEventInput): Promise<{ data: { event: NutritionLogEvent; replayed?: boolean; coalesced?: boolean } | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('record_nutrition_log_event', {
        p_request_key: input.request_key,
        p_event_type: input.event_type,
        p_assignment_id: input.assignment_id,
        p_prescribed_meal_id: input.prescribed_meal_id,
        p_occurred_at: input.occurred_at,
        p_timezone_id: input.timezone_id,
        p_nutrition_date: input.nutrition_date,
        p_note: input.note ?? null,
        p_supersedes_event_id: input.supersedes_event_id ?? null,
        p_items: input.items ?? [],
      });
      if (error) return { data: null, error };
      if (!data?.event?.id || data.event.event_type !== input.event_type) {
        return { data: null, error: new Error('Supabase no confirmó el registro nutricional.') };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async getTrainerNutritionLogHistory(clientId: string, limit = 100, nutritionDate?: string, dateRange?: { startDate: string; endDate: string }): Promise<{ data: { events: TrainerNutritionLogEvent[]; assignments: NutritionAssignmentContext[] } | null; error: any }> {
    try {
      const pageSize = nutritionDate || dateRange ? 500 : limit;
      const rows: any[] = [];
      for (let from = 0; ; from += pageSize) {
        let eventQuery = supabase.from('nutrition_log_events').select('*').eq('client_id', clientId);
        if (nutritionDate) eventQuery = eventQuery.eq('nutrition_date', nutritionDate);
        if (dateRange) eventQuery = eventQuery.gte('nutrition_date', dateRange.startDate).lte('nutrition_date', dateRange.endDate);
        const { data: events, error } = await eventQuery.order('occurred_at', { ascending: false }).range(from, from + pageSize - 1);
        if (error) return { data: null, error };
        const page = events || [];
        rows.push(...page);
        if ((!nutritionDate && !dateRange) || page.length < pageSize) break;
      }
      // Complete correction chains for the visible page in bounded batches so a
      // page boundary cannot make a valid current head look like a broken chain.
      const allRows = new Map<string, any>(rows.map((event: any) => [event.id, event]));
      let predecessorIds = [...new Set(rows.map((event: any) => event.supersedes_event_id).filter(Boolean))] as string[];
      while (predecessorIds.length) {
        const missing = predecessorIds.filter(id => !allRows.has(id));
        if (!missing.length) break;
        const { data: predecessors, error: predecessorError } = await supabase.from('nutrition_log_events').select('*')
          .eq('client_id', clientId).in('id', missing);
        if (predecessorError) return { data: null, error: predecessorError };
        const fetched = predecessors || [];
        for (const event of fetched) allRows.set(event.id, event);
        predecessorIds = [...new Set(fetched.map((event: any) => event.supersedes_event_id).filter(Boolean))] as string[];
      }
      const completeRows = [...allRows.values()];
      const eventIds = completeRows.map((event: any) => event.id);
      const itemsResult = eventIds.length
        ? await supabase.from('nutrition_log_event_items').select('*').in('event_id', eventIds)
        : { data: [], error: null };
      if (itemsResult.error) return { data: null, error: itemsResult.error };
      let assignmentQuery = supabase.from('client_nutrition_assignments')
        .select('id,client_id,nutrition_plan_version_id,assigned_at,ended_at').eq('client_id', clientId);
      if (dateRange) {
        // Include assignments that could overlap any Client-local date in the
        // requested range (IANA offsets are bounded to ±14 hours), plus any
        // boundary transition needed by the shared 1C day resolver.
        const startEnvelope = new Date(Date.parse(`${dateRange.startDate}T00:00:00.000Z`) - 14 * 60 * 60 * 1000);
        const endEnvelope = new Date(Date.parse(`${dateRange.endDate}T00:00:00.000Z`) + 38 * 60 * 60 * 1000);
        assignmentQuery = assignmentQuery.lte('assigned_at', endEnvelope.toISOString())
          .or(`ended_at.is.null,ended_at.gte.${startEnvelope.toISOString()}`);
      }
      const assignmentsResult = await assignmentQuery.order('assigned_at', { ascending: true });
      if (assignmentsResult.error) return { data: null, error: assignmentsResult.error };
      const versionIds = [...new Set((assignmentsResult.data || []).map((assignment: any) => assignment.nutrition_plan_version_id))] as string[];
      const versionsResult = versionIds.length
        ? await supabase.from('nutrition_plan_versions').select('id,snapshot').eq('client_id', clientId).in('id', versionIds)
        : { data: [], error: null };
      if (versionsResult.error) return { data: null, error: versionsResult.error };
      const assignmentVersion = new Map((assignmentsResult.data || []).map((assignment: any) => [assignment.id, assignment.nutrition_plan_version_id]));
      const snapshots = new Map((versionsResult.data || []).map((version: any) => [version.id, version.snapshot]));
      const assignments: NutritionAssignmentContext[] = (assignmentsResult.data || []).map((assignment: any) => ({
        ...assignment,
        snapshot: snapshots.get(assignment.nutrition_plan_version_id) || null,
      }));
      const itemsByEvent = new Map<string, any[]>();
      for (const item of itemsResult.data || []) itemsByEvent.set(item.event_id, [...(itemsByEvent.get(item.event_id) || []), item]);
      return {
        data: { events: completeRows.map((event: any) => {
          const versionId = assignmentVersion.get(event.assignment_id);
          const snapshot = versionId ? snapshots.get(versionId) : null;
          const meal = snapshot?.meals?.find((candidate: any) => candidate.id === event.prescribed_meal_id) || null;
          return { ...event, items: itemsByEvent.get(event.id) || [], meal_name: meal?.name || null, plan_name: snapshot?.plan_name || null, meal_snapshot: meal } as TrainerNutritionLogEvent;
        }), assignments },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Trainer Profile
  async getTrainerProfile(supabaseUserId?: string): Promise<{ data: TrainerProfile | null; error: any }> {
    try {
      let query = supabase.from('trainer_profiles').select('*');
      if (supabaseUserId) {
        query = query.eq('id', supabaseUserId);
      } else {
        query = query.limit(1);
      }
      const { data, error } = await query.maybeSingle();

      if (error) return { data: null, error };
      if (!data) return { data: null, error: null };

      const trainer: TrainerProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
        initials: data.initials || 'TR',
        role: data.role || 'Entrenador',
        avatarUrl: data.avatar_url || '',
        couponCode: data.coupon_code || 'STRAINER20'
      };
      return { data: trainer, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async upsertTrainerProfile(trainer: TrainerProfile): Promise<{ error: any }> {
    try {
      const trainerId = trainer.id;
      if (!trainerId) {
        return { error: new Error('No se puede actualizar el perfil del entrenador sin un ID válido') };
      }

      const { error } = await supabase
        .from('trainer_profiles')
        .upsert({
          id: trainerId,
          name: trainer.name,
          email: trainer.email,
          initials: trainer.initials,
          role: trainer.role,
          avatar_url: trainer.avatarUrl || '',
          coupon_code: trainer.couponCode || 'STRAINER20',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  // Health / Connection status check
  async testConnection(): Promise<{ connected: boolean; hasTables: boolean; message: string }> {
    try {
      const { error: authError } = await supabase.auth.getSession();
      if (authError) {
        return { connected: false, hasTables: false, message: authError.message };
      }

      const { data, error: tableError } = await supabase.from('clients').select('id').limit(1);
      if (tableError) {
        // Connected to Supabase, but schema not yet migrated
        return { 
          connected: true, 
          hasTables: false, 
          message: 'Conectado a Supabase. Las tablas aún no están creadas en la base de datos.' 
        };
      }

      return { 
        connected: true, 
        hasTables: true, 
        message: 'Conectado y sincronizado en tiempo real con Supabase.' 
      };
    } catch (err: any) {
      return { connected: false, hasTables: false, message: err.message || 'Error de conexión' };
    }
  }
};
