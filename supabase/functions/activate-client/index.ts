import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta (service_role no configurada)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado: falta el encabezado de autenticación.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await userClient.auth.getUser();

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Sesión inválida o expirada. Por favor, vuelve a iniciar sesión.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const callerEmail = (callerUser.email || '').toLowerCase().trim();

    let existingRow = null;

    const byUserId = await adminClient
      .from('clients')
      .select('id, email, status')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (byUserId.data) {
      existingRow = byUserId.data;
    } else if (callerEmail) {
      const byEmail = await adminClient
        .from('clients')
        .select('id, email, status')
        .ilike('email', callerEmail)
        .maybeSingle();
      if (byEmail.data) {
        existingRow = byEmail.data;
      }
    }

    if (!existingRow) {
      return new Response(
        JSON.stringify({
          error: `No se encontró ninguna fila en la tabla clients para el usuario ${callerEmail || callerUser.id}.`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: updatedRow, error: updateError } = await adminClient
      .from('clients')
      .update({
        status: 'Activo',
        user_id: callerUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando status a Activo en clients:', updateError);
      return new Response(
        JSON.stringify({ error: `No se pudo activar el cliente en la tabla clients: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (updatedRow?.data && typeof updatedRow.data === 'object') {
      const mergedData = { ...updatedRow.data, status: 'Activo' };
      await adminClient.from('clients').update({ data: mergedData }).eq('id', existingRow.id);
    }

    return new Response(
      JSON.stringify({ success: true, client: updatedRow }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error && err.message
      ? err.message
      : 'Error interno del servidor en Edge Function';
    console.error('Error inesperado en activate-client:', err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
