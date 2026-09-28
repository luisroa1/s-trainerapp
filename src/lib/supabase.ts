import { createClient } from '@supabase/supabase-js';
import { ClientData, Program, NutritionPlan, TrainerProfile, UserRole } from '../types';

export const SUPABASE_URL = 
  import.meta.env.VITE_SUPABASE_URL || 'https://rfxyisqvrukslnlgzzek.supabase.co';

export const SUPABASE_ANON_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2V9OnpXFWsG7LSenErU0Zg_BuwhehAD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * SQL script for Supabase SQL Editor to create tables with Realtime enabled.
 */
export const SUPABASE_SCHEMA_SQL = `-- S-TRAINER APP: Esquema oficial de base de datos para Supabase
-- Ejecuta este script en Supabase > SQL Editor > New Query > Run

-- 1. Tabla de Perfiles vinculada a Auth
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('trainer', 'client', 'admin')),
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trainer_id TEXT DEFAULT 'trn-1',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  sex TEXT DEFAULT 'Hombre',
  height TEXT,
  objective TEXT,
  status TEXT DEFAULT 'Activo',
  current_weight NUMERIC,
  adherence_percentage NUMERIC DEFAULT 100,
  assigned_program_id TEXT DEFAULT 'prog-1',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Programas de Entrenamiento
CREATE TABLE IF NOT EXISTS public.programs (
  id TEXT PRIMARY KEY,
  trainer_id TEXT DEFAULT 'trn-1',
  name TEXT NOT NULL,
  type TEXT,
  level TEXT,
  duration_weeks INT DEFAULT 4,
  days_per_week INT DEFAULT 4,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Planes de Nutrición
CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  trainer_id TEXT DEFAULT 'trn-1',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Perfil del Entrenador
CREATE TABLE IF NOT EXISTS public.trainer_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  initials TEXT,
  role TEXT DEFAULT 'Entrenador',
  avatar_url TEXT,
  coupon_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo y funcionamiento continuo
DROP POLICY IF EXISTS "Permitir lectura y escritura general a profiles" ON public.profiles;
CREATE POLICY "Permitir lectura y escritura general a profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y escritura general a clients" ON public.clients;
CREATE POLICY "Permitir lectura y escritura general a clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y escritura general a programs" ON public.programs;
CREATE POLICY "Permitir lectura y escritura general a programs" ON public.programs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y escritura general a nutrition_plans" ON public.nutrition_plans;
CREATE POLICY "Permitir lectura y escritura general a nutrition_plans" ON public.nutrition_plans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura y escritura general a trainer_profiles" ON public.trainer_profiles;
CREATE POLICY "Permitir lectura y escritura general a trainer_profiles" ON public.trainer_profiles FOR ALL USING (true) WITH CHECK (true);

-- Activar publicación en tiempo real (Supabase Realtime)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.profiles, 
    public.clients, 
    public.programs, 
    public.nutrition_plans, 
    public.trainer_profiles;
COMMIT;
`;

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
    assigned_program_id: client.assignedProgramId,
    data: client, // Full structured json
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
      assignedProgramId: row.assigned_program_id || row.data.assignedProgramId || '',
      trainerId: row.trainer_id || row.data.trainerId
    };
  }
  return {
    ...(row.data as ClientData),
    trainerId: row.trainer_id || (row.data as any)?.trainerId
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

  async bulkUpsertClients(clientsList: ClientData[], ownerId?: string): Promise<{ error: any }> {
    try {
      const payloads = clientsList.map(c => serializeClientToDb(c, ownerId));
      const { error } = await supabase
        .from('clients')
        .upsert(payloads, { onConflict: 'id' });
      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  // Programs
  async getPrograms(): Promise<{ data: Program[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*');
      
      if (error) return { data: null, error };
      if (!data || data.length === 0) return { data: [], error: null };

      const programs = data.map(r => (r.data?.id ? r.data : { ...r, id: r.id })) as Program[];
      return { data: programs, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async upsertProgram(program: Program, ownerId?: string): Promise<{ error: any }> {
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

      const { error } = await supabase
        .from('programs')
        .upsert(payload, { onConflict: 'id' });
      return { error };
    } catch (err) {
      return { error: err };
    }
  },

  async bulkUpsertPrograms(programsList: Program[], ownerId?: string): Promise<{ error: any }> {
    try {
      const payloads = programsList.map(p => {
        const payload: any = {
          id: p.id,
          name: p.name,
          type: p.type,
          level: p.level,
          duration_weeks: p.durationWeeks,
          days_per_week: p.daysPerWeek,
          data: p,
          updated_at: new Date().toISOString()
        };
        if (ownerId) {
          payload.trainer_id = ownerId;
        }
        return payload;
      });
      const { error } = await supabase
        .from('programs')
        .upsert(payloads, { onConflict: 'id' });
      return { error };
    } catch (err) {
      return { error: err };
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

  async upsertNutritionPlan(clientId: string, plan: NutritionPlan, ownerId?: string): Promise<{ error: any }> {
    try {
      const payload: any = {
        id: plan.id || `nut-${clientId}`,
        client_id: clientId,
        data: plan,
        updated_at: new Date().toISOString()
      };
      // Solo incluir trainer_id si se pasa explícitamente (al crear nuevo plan)
      if (ownerId) {
        payload.trainer_id = ownerId;
      }

      const { error } = await supabase
        .from('nutrition_plans')
        .upsert(payload, { onConflict: 'id' });
      return { error };
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
