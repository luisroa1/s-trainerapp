import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { activateClientAccount } from './activation.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, body: unknown) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método no permitido.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse(500, { error: 'Configuración del servidor incompleta.' });
    }

    const authorization = req.headers.get('Authorization');
    if (!authorization) return jsonResponse(401, { error: 'Falta la sesión de autenticación.' });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse(401, { error: 'La sesión no es válida. Vuelve a iniciar sesión.' });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    const store = {
      async findByUserId(userId: string) {
        const { data, error } = await adminClient
          .from('clients')
          .select('id, user_id')
          .eq('user_id', userId)
          .limit(2);
        return { data: data || [], error };
      },
      async findByExactEmail(email: string) {
        const { data, error } = await adminClient
          .from('clients')
          .select('id, user_id')
          .eq('email', email)
          .limit(2);
        return { data: data || [], error };
      },
      async claimUnlinked(clientId: string, userId: string, timestamp: string) {
        const { data, error } = await adminClient
          .from('clients')
          .update({ status: 'Activo', user_id: userId, updated_at: timestamp })
          .eq('id', clientId)
          .is('user_id', null)
          .select('id, status')
          .maybeSingle();
        return { data, error };
      },
      async activateLinked(clientId: string, userId: string, timestamp: string) {
        const { data, error } = await adminClient
          .from('clients')
          .update({ status: 'Activo', updated_at: timestamp })
          .eq('id', clientId)
          .eq('user_id', userId)
          .select('id, status')
          .maybeSingle();
        return { data, error };
      },
      async findById(clientId: string) {
        const { data, error } = await adminClient
          .from('clients')
          .select('id, user_id')
          .eq('id', clientId)
          .maybeSingle();
        return { data, error };
      },
    };

    const outcome = await activateClientAccount({ user, profile, profileError, store });
    return jsonResponse(outcome.status, outcome.body);
  } catch (error) {
    console.error('Error inesperado en activate-client:', error);
    return jsonResponse(500, { error: 'Error interno al activar el cliente.' });
  }
});
