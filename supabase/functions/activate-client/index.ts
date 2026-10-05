import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { resolveActivationPrincipal } from '../_shared/activation.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const authorization = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'No se pudo validar la sesión de activación.' }, 401);
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'La sesión no es válida o ha caducado.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: profile, error: profileError }, { data: access, error: accessError }] = await Promise.all([
      adminClient.from('profiles').select('id,role').eq('id', user.id).maybeSingle(),
      adminClient.from('account_access').select('state').eq('user_id', user.id).maybeSingle(),
    ]);
    const principal = resolveActivationPrincipal({
      user,
      profile,
      profileError,
      access,
      accessError,
    });
    if (!principal.ok) {
      if (principal.status === 500) console.error('activate-client identity state lookup failed');
      return json({ error: principal.reason === 'identity_state_unavailable'
        ? 'No se pudo verificar el estado de la cuenta. Inténtalo de nuevo.'
        : 'Esta cuenta no puede completar la activación.' }, principal.status);
    }

    const { data, error } = await adminClient.rpc('activate_client_account', {
      p_user_id: principal.userId,
      p_correlation_id: crypto.randomUUID(),
    });
    if (error || !data?.id || data?.status !== 'Activo') {
      console.error('activate-client transaction failed', error?.code || 'invalid_rpc_result');
      return json({ error: 'No se pudo completar la activación. Contacta con tu entrenador antes de volver a intentarlo.' }, 409);
    }

    return json({ success: true, client: { id: data.id, status: data.status } });
  } catch {
    console.error('activate-client unexpected failure');
    return json({ error: 'No se pudo completar la activación. Inténtalo de nuevo.' }, 500);
  }
});
