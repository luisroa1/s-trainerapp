import { createClient } from '@supabase/supabase-js';
import { ClientData, Program, NutritionPlan, TrainerProfile, UserRole } from '../types';
import { validateSupabaseTarget } from './supabaseTarget.mjs';
import { persistNutritionPlanForCurrentUser } from './nutritionPlanPersistence.mjs';
import { clientDataWithoutLegacyAssignment, readAssignedProgramId } from './clientAssignment.mjs';

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
    adherence_percentage: client.adherencePercentage,
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
  if (row.data && typeof row.data === 'object' && row.data.name) {
    return {
      ...row.data,
      id: row.id,
      name: row.name || row.data.name,
      email: row.email || row.data.email,
      phone: row.phone || row.data.phone,
      objective: row.objective || row.data.objective,
      status: row.status || row.data.status,
      currentWeight: Number(row.current_weight || row.data.currentWeight || 70),
      adherencePercentage: Number(row.adherence_percentage || row.data.adherencePercentage || 100),
      assignedProgramId: readAssignedProgramId(row),
      trainerId: row.trainer_id || row.data.trainerId
    };
  }
  return {
    ...(row.data as ClientData),
    trainerId: row.trainer_id || (row.data as any)?.trainerId,
    assignedProgramId: readAssignedProgramId(row)
  };
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

  async applyProgramVersion(programId: string): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc('apply_program_version', {
        p_program_id: programId,
      });
      const version = Array.isArray(data) ? data[0] || null : data;
      return { data: version, error };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  // Nutrition Plans
  async getNutritionPlans(): Promise<{ data: Record<string, NutritionPlan> | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('nutrition_plans')
        .select('*');
      
      if (error) return { data: null, error };
      if (!data || data.length === 0) return { data: {}, error: null };

      const result: Record<string, NutritionPlan> = {};
      for (const row of data) {
        if (row.client_id && row.data) {
          result[row.client_id] = row.data as NutritionPlan;
        }
      }
      return { data: result, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async upsertNutritionPlan(clientId: string, plan: NutritionPlan): Promise<{ error: any }> {
    try {
      await persistNutritionPlanForCurrentUser(supabase, clientId, plan);
      return { error: null };
    } catch (err) {
      return { error: err };
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
