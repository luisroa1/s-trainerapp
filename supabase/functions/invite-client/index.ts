import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Encabezados CORS para permitir llamadas desde el cliente web
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Manejo de petición preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Obtener variables de entorno inyectadas por Supabase
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

    // 2. Verificar que el usuario que llama está autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado: falta el encabezado de autenticación.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente con contexto del usuario para validar su token
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

    // Cliente administrador con service_role (permisos totales para auth.admin y bypass de RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // 3. Verificar que quien llama tiene role = 'trainer' en la tabla profiles
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error al consultar perfil del entrenador:', profileError);
    }

    const isTrainer = callerProfile?.role === 'trainer';
    if (!isTrainer) {
      return new Response(
        JSON.stringify({
          error: 'Acceso denegado (403): Solo los usuarios con rol de entrenador pueden invitar clientes.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Leer los campos enviados desde el formulario
    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      objective = 'Pérdida de grasa',
      startDate,
      assignedProgramId: rawAssignedProgramId,
      redirectTo: customRedirectTo,
    } = body;
    const assignedProgramId = rawAssignedProgramId || 'prog-1';

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ error: 'El nombre del cliente es obligatorio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return new Response(
        JSON.stringify({ error: 'El correo electrónico es obligatorio.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    // 5b. Verificar que el programa asignado pertenece al entrenador autenticado
    if (assignedProgramId) {
      const { data: programRow, error: programErr } = await adminClient
        .from('programs')
        .select('id, trainer_id')
        .eq('id', assignedProgramId)
        .maybeSingle();

      if (programErr) {
        console.error('Error al verificar ownership del programa:', programErr);
        return new Response(
          JSON.stringify({ error: 'No se pudo verificar el programa asignado.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!programRow || programRow.trainer_id !== callerUser.id) {
        return new Response(
          JSON.stringify({
            error: 'Acceso denegado (403): el programa asignado no pertenece al entrenador autenticado.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Verificar si el email ya existe como cliente o como usuario
    // A) En la tabla clients
    const { data: existingClient } = await adminClient
      .from('clients')
      .select('id, email, name, status')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingClient) {
      return new Response(
        JSON.stringify({
          error: `El email ${cleanEmail} ya está registrado como cliente (${existingClient.name}, Estado: ${existingClient.status}).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // B) En la tabla profiles / auth
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email, role')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({
          error: `Ya existe un usuario en el sistema con el email ${cleanEmail} (Rol: ${existingProfile.role}).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Configurar la URL de redirección a la página de activación
    const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL');
    if (!customRedirectTo && !appUrl) {
      console.error('Faltan APP_URL o SITE_URL para construir el redirect de invitación');
      return new Response(
        JSON.stringify({ error: 'Configuración incompleta: falta APP_URL o SITE_URL.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const finalRedirectTo = customRedirectTo || new URL('/?flow=activate', appUrl).toString();

    // 7. Enviar la invitación mediante supabase.auth.admin.inviteUserByEmail
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        redirectTo: finalRedirectTo,
        data: {
          full_name: cleanName,
          role: 'client',
          trainer_id: callerUser.id,
        },
      }
    );

    if (inviteError) {
      console.error('Error en inviteUserByEmail:', inviteError);
      return new Response(
        JSON.stringify({ error: `Error al enviar la invitación: ${inviteError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invitedUserId = inviteData?.user?.id;
    if (!invitedUserId) {
      return new Response(
        JSON.stringify({ error: 'No se pudo obtener el identificador del usuario invitado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Crear / Actualizar perfil en profiles
    await adminClient.from('profiles').upsert(
      {
        id: invitedUserId,
        email: cleanEmail,
        full_name: cleanName,
        role: 'client',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    // 9. Insertar la fila en la tabla clients
    const clientId = `cli-${invitedUserId.substring(0, 8)}`;
    const initials = cleanName
      .split(' ')
      .map((w: string) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'CL';

    const fullClientPayload = {
      id: clientId,
      user_id: invitedUserId,
      trainer_id: callerUser.id,
      name: cleanName,
      initials,
      email: cleanEmail,
      phone: '',
      birthDate: '1995-01-01',
      sex: 'Hombre',
      height: '175 cm',
      objective,
      status: 'Pendiente',
      startDate: startDate || new Date().toISOString().split('T')[0],
      nextWorkout: 'Pendiente de activación',
      adherencePercentage: 100,
      completedWorkoutsCount: 0,
      totalScheduledWorkoutsCount: 4,
      currentWeight: 70.0,
      initialWeight: 70.0,
      targetWeight: 68.0,
      weightWeeklyTrend: '→ 0,0 kg / semana',
      lastCheckIn: 'Pendiente',
      assignedProgramId,
      metrics: {
        stepsToday: 0,
        stepsGoal: 9000,
        kcalToday: 0,
        kcalGoal: 2000,
        sleepHours: '8h 00min',
        sleepQuality: 'Buena',
        waterLiters: 0,
        waterGoal: 2.5,
      },
      weeklySchedule: [
        { day: 'L', status: 'pending' },
        { day: 'M', status: 'pending' },
        { day: 'X', status: 'rest' },
        { day: 'J', status: 'pending' },
        { day: 'V', status: 'pending' },
        { day: 'S', status: 'rest' },
        { day: 'D', status: 'rest' },
      ],
      strengthProgression: [],
      bodyMeasurements: { cintura: 80, cadera: 95, pecho: 98, brazo: 34, lastUpdated: 'Pendiente' },
      impedanceHistory: [{ date: 'HOY', weight: 70.0, fatPercentage: 18.0, muscleMassKg: 55.0, waterPercentage: 55 }],
      trainerNotes: [{ id: `tn-${Date.now()}`, date: 'Hoy', content: 'Invitación enviada por email.' }],
    };

    const clientDbRow = {
      id: clientId,
      user_id: invitedUserId,
      trainer_id: callerUser.id,
      name: cleanName,
      email: cleanEmail,
      phone: '',
      sex: 'Hombre',
      height: '175 cm',
      objective,
      status: 'Pendiente',
      current_weight: 70.0,
      adherence_percentage: 100,
      assigned_program_id: assignedProgramId,
      data: fullClientPayload,
      updated_at: new Date().toISOString(),
    };

    const { data: insertedClient, error: clientInsertError } = await adminClient
      .from('clients')
      .upsert(clientDbRow, { onConflict: 'email' })
      .select()
      .single();

    if (clientInsertError) {
      console.error('Error insertando en clients:', clientInsertError);
      return new Response(
        JSON.stringify({
          error: `Invitación enviada en Auth, pero falló el registro en la tabla clients: ${clientInsertError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Devolver respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitación enviada con éxito a ${cleanEmail}`,
        userId: invitedUserId,
        client: insertedClient?.data || fullClientPayload,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error inesperado en invite-client:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Error interno del servidor en Edge Function' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
