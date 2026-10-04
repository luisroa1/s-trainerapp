export async function persistNutritionPlanForCurrentUser(supabaseClient, selectedClientId, plan) {
  const { data, error: authError } = await supabaseClient.auth.getUser();
  if (authError) throw authError;

  const authenticatedUserId = data?.user?.id;
  if (!authenticatedUserId) {
    throw new Error('Se requiere una sesión autenticada para guardar el plan nutricional.');
  }

  const { trainer_id: _untrustedTrainerId, trainerId: _untrustedCamelTrainerId, ...planData } = plan;
  const row = {
    id: plan.id || `nut-${selectedClientId}`,
    client_id: selectedClientId,
    trainer_id: authenticatedUserId,
    data: { ...planData, clientId: selectedClientId },
    updated_at: new Date().toISOString(),
  };

  const { data: savedRow, error: upsertError } = await supabaseClient
    .from('nutrition_plans')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .single();

  if (upsertError) throw upsertError;
  if (!savedRow?.id) throw new Error('Supabase no confirmó el guardado del plan nutricional.');
}
