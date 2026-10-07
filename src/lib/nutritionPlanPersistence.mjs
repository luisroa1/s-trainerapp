async function requireAuthenticatedTrainer(supabaseClient) {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('Se requiere una sesión autenticada para gestionar la prescripción.');
  return data.user.id;
}

export async function getNutritionPlanDrafts(supabaseClient) {
  const { error, data } = await supabaseClient
    .from('nutrition_plan_definitions')
    .select('id,client_id,draft_snapshot')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getActiveNutritionPlan(supabaseClient) {
  const { error: authError, data: authData } = await supabaseClient.auth.getUser();
  if (authError) throw authError;
  const clientUserId = authData?.user?.id;
  if (!clientUserId) return null;

  const { data: client, error: clientError } = await supabaseClient
    .from('clients')
    .select('id')
    .eq('user_id', clientUserId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client?.id) return null;

  const { data: assignment, error: assignmentError } = await supabaseClient
    .from('client_nutrition_assignments')
    .select('id,assigned_at,nutrition_plan_version_id')
    .eq('client_id', client.id)
    .is('ended_at', null)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) return null;

  const { data: version, error: versionError } = await supabaseClient
    .from('nutrition_plan_versions')
    .select('id,version_number,snapshot')
    .eq('id', assignment.nutrition_plan_version_id)
    .single();
  if (versionError) throw versionError;
  return {
    assignmentId: assignment.id,
    assignedAt: assignment.assigned_at,
    versionId: version.id,
    versionNumber: version.version_number,
    snapshot: version.snapshot,
  };
}

export async function saveNutritionPlanDraft(supabaseClient, clientId, planId, snapshot) {
  const trainerId = await requireAuthenticatedTrainer(supabaseClient);
  const draft = { client_id: clientId, trainer_id: trainerId, draft_snapshot: snapshot, updated_at: new Date().toISOString() };
  const query = planId
    ? supabaseClient.from('nutrition_plan_definitions').update({ draft_snapshot: snapshot, updated_at: draft.updated_at }).eq('id', planId).eq('client_id', clientId)
    : supabaseClient.from('nutrition_plan_definitions').insert(draft);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  if (!data?.id) throw new Error('Supabase no confirmó el guardado del borrador.');
  return data.id;
}

export async function applyNutritionPlan(supabaseClient, planId, requestKey) {
  await requireAuthenticatedTrainer(supabaseClient);
  const { data, error } = await supabaseClient.rpc('apply_nutrition_plan', {
    p_plan_id: planId,
    p_request_key: requestKey,
  });
  if (error) throw error;
  if (!data?.assignment_id || !data?.version_id) {
    throw new Error('Supabase no confirmó la asignación de la prescripción.');
  }
  return data;
}
