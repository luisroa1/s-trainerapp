import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { normalizeAuthorizedBaseUrl, resolveAuthorizedRedirect } from '../_shared/authorizedRedirect.mjs';
import { resolveActorAccess, resolveActorRole } from '../_shared/accountAccess.mjs';
import { runClientInvitation } from '../_shared/clientInvitationFlow.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const normalizeEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const authorization = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'No se pudo validar la sesión del entrenador.' }, 401);
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
    const roleResult = resolveActorRole({ user, profile, profileError, expectedRole: 'trainer' });
    if (!roleResult.ok) {
      if (roleResult.status === 500) console.error('invite-client profile lookup failed');
      return json({ error: 'Solo un entrenador autorizado puede invitar clientes.' }, roleResult.status);
    }
    const accessResult = resolveActorAccess({ access, accessError });
    if (!accessResult.ok) {
      if (accessResult.status === 500) console.error('invite-client access lookup failed');
      return json({ error: 'La cuenta del entrenador no tiene acceso habilitado.' }, accessResult.status);
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = normalizeEmail(body.email);
    const objective = typeof body.objective === 'string' && body.objective.trim() ? body.objective.trim() : null;
    const assignedProgramId = typeof body.assignedProgramId === 'string' && body.assignedProgramId.trim()
      ? body.assignedProgramId.trim()
      : null;
    if (!name) return json({ error: 'El nombre del cliente es obligatorio.' }, 400);
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Introduce un correo electrónico válido.' }, 400);
    }
    if (assignedProgramId) {
      const { data: program, error: programError } = await adminClient
        .from('programs').select('id').eq('id', assignedProgramId).eq('trainer_id', user.id).maybeSingle();
      if (programError) {
        console.error('invite-client program ownership lookup failed');
        return json({ error: 'No se pudo verificar el programa seleccionado.' }, 500);
      }
      if (!program) return json({ error: 'El programa seleccionado no está disponible para esta cuenta.' }, 403);
    }

    const [{ data: existingClient, error: existingClientError }, { data: existingProfile, error: existingProfileError }] = await Promise.all([
      adminClient.from('clients').select('id').eq('email', email).limit(2),
      adminClient.from('profiles').select('id').eq('email', email).limit(2),
    ]);
    if (existingClientError || existingProfileError) {
      console.error('invite-client duplicate lookup failed');
      return json({ error: 'No se pudo comprobar si el correo ya está registrado.' }, 500);
    }
    if ((existingClient?.length || 0) > 1 || (existingProfile?.length || 0) > 1) {
      return json({ error: 'La cuenta requiere revisión antes de invitarla.' }, 409);
    }
    if (existingClient?.length || existingProfile?.length) {
      return json({ error: 'Ya existe una cuenta o ficha con ese correo.' }, 409);
    }

    const baseUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL');
    if (!baseUrl) return json({ error: 'La aplicación no tiene una URL de invitación configurada.' }, 500);
    let redirectTo: string;
    try {
      redirectTo = resolveAuthorizedRedirect(normalizeAuthorizedBaseUrl(baseUrl), body.redirectTo);
    } catch {
      return json({ error: 'La URL de redirección no está autorizada.' }, 400);
    }

    const correlationId = crypto.randomUUID();
    const idempotencyKey = await sha256(JSON.stringify({ actor: user.id, email, name, objective, assignedProgramId }));
    const { data: operation, error: operationError } = await adminClient.rpc('begin_client_invitation', {
      p_actor_user_id: user.id,
      p_target_email: email,
      p_idempotency_key: idempotencyKey,
      p_correlation_id: correlationId,
    });
    if (operationError || !operation?.operation_id) {
      console.error('invite-client operation could not be recorded', operationError?.code || 'ledger_start_failed');
      return json({ error: 'No se pudo iniciar la invitación de forma segura.' }, 409);
    }
    if (operation.replayed) {
      if (['invited', 'accepted'].includes(operation.state) && operation.target_user_id) {
        const { data: client, error: relationError } = await adminClient.from('clients')
          .select('id,name,email,status,assigned_program_id,data').eq('user_id', operation.target_user_id).eq('trainer_id', user.id).maybeSingle();
        if (!relationError && client) return json({ success: true, message: 'La invitación ya fue registrada.', client: client.data || client });
      }
      return json({ error: 'Esta invitación ya está en curso o requiere revisión; no se ha reenviado.' }, 409);
    }

    const finishOperation = async ({ state, targetUserId, errorCode }: { state: string; targetUserId: string | null; errorCode: string | null }) => {
      const { data, error } = await adminClient.rpc('finish_client_invitation', {
        p_operation_id: operation.operation_id,
        p_target_user_id: targetUserId,
        p_state: state,
        p_safe_error_code: errorCode,
        p_correlation_id: correlationId,
      });
      return { data, error };
    };

    const result = await runClientInvitation({
      authorizeBeforeInvite: async () => {
        const [{ data: currentProfile, error: currentProfileError }, { data: currentAccess, error: currentAccessError }] = await Promise.all([
          adminClient.from('profiles').select('id,role').eq('id', user.id).maybeSingle(),
          adminClient.from('account_access').select('state').eq('user_id', user.id).maybeSingle(),
        ]);
        if (currentProfileError || currentAccessError) return { ok: false };
        return currentProfile?.role === 'trainer' && currentAccess?.state === 'enabled'
          ? { ok: true }
          : { ok: false };
      },
      inviteAuthUser: async () => {
        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { full_name: name },
        });
        if (error) return { error, errorCode: 'auth_invite_failed' };
        return { user: data.user };
      },
      verifyPendingClient: async invitedUser => {
        const { data: invitedProfile, error: invitedProfileError } = await adminClient.from('profiles')
          .select('id,role').eq('id', invitedUser.id).maybeSingle();
        const { data: invitedAccess, error: invitedAccessError } = await adminClient.from('account_access')
          .select('state').eq('user_id', invitedUser.id).maybeSingle();
        if (invitedProfileError || invitedAccessError) return { error: true };
        return { profile: invitedProfile, access: invitedAccess };
      },
      persistClientRelation: async invitedUser => {
        // Recheck the actor immediately before the privileged relation write.
        const { data: latestActorAccess, error: latestAccessError } = await adminClient.from('account_access')
          .select('state').eq('user_id', user.id).maybeSingle();
        const { data: latestActorProfile, error: latestProfileError } = await adminClient.from('profiles')
          .select('id,role').eq('id', user.id).maybeSingle();
        if (latestAccessError || latestProfileError
          || latestActorAccess?.state !== 'enabled'
          || latestActorProfile?.role !== 'trainer') return { error: true };

        const { data, error } = await userClient.rpc('complete_invited_client', {
          p_operation_id: operation.operation_id,
          p_target_user_id: invitedUser.id,
          p_client_id: `cli-${crypto.randomUUID()}`,
          p_name: name,
          p_email: email,
          p_objective: objective,
          p_program_id: assignedProgramId,
          p_assignment_id: assignedProgramId ? crypto.randomUUID() : null,
        });
        if (error) return { error };
        const relation = data?.client;
        if (!relation?.id || (assignedProgramId && (!data?.assignment?.id || !data?.program_version?.id))) {
          return { error: new Error('La relación o asignación no quedó confirmada.') };
        }
        return { data: relation, error: null };
      },
      finishOperation,
    });

    if (!result.success) {
      return json({ error: 'No se pudo completar la invitación. El estado quedó registrado para revisión.' }, result.status || 500);
    }
    return json({
      success: true,
      message: 'Invitación enviada correctamente.',
      client: result.client,
    });
  } catch {
    console.error('invite-client unexpected failure');
    return json({ error: 'No se pudo completar la invitación. Inténtalo de nuevo más tarde.' }, 500);
  }
});
