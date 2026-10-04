function result(status, error) {
  return { status, body: { success: false, error } };
}

function rowsOrError(queryResult, errorMessage) {
  if (queryResult?.error) return { error: result(500, errorMessage) };
  return { rows: Array.isArray(queryResult?.data) ? queryResult.data : [] };
}

function clientConflict() {
  return result(409, 'La cuenta ya está vinculada a otro cliente o la coincidencia no es única.');
}

export function normalizeActivationEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export async function activateClientAccount({ user, profile, profileError, store, now = () => new Date().toISOString() }) {
  if (!user?.id) return result(401, 'La sesión no es válida. Vuelve a iniciar sesión.');
  if (!user.email_confirmed_at) return result(403, 'Debes confirmar tu correo antes de activar la cuenta.');
  if (profileError) return result(500, 'No se pudo verificar el perfil de la cuenta.');
  if (!profile || profile.id !== user.id || profile.role !== 'client') {
    return result(403, 'Solo una cuenta de cliente puede completar esta activación.');
  }

  const email = normalizeActivationEmail(user.email);
  if (!email) return result(403, 'La cuenta no tiene un correo confirmado válido.');

  const byUserIdResult = rowsOrError(
    await store.findByUserId(user.id),
    'No se pudo verificar la vinculación del cliente.',
  );
  if (byUserIdResult.error) return byUserIdResult.error;
  if (byUserIdResult.rows.length > 1) return clientConflict();

  if (byUserIdResult.rows.length === 1) {
    return activateAlreadyLinked(byUserIdResult.rows[0].id, user.id, store, now);
  }

  // Exact equality only. The Edge Function never treats an email as a LIKE pattern.
  const byEmailResult = rowsOrError(
    await store.findByExactEmail(email),
    'No se pudo buscar la invitación del cliente.',
  );
  if (byEmailResult.error) return byEmailResult.error;
  if (byEmailResult.rows.length > 1) return clientConflict();
  if (byEmailResult.rows.length === 0) return result(404, 'No existe una invitación pendiente para esta cuenta.');

  const client = byEmailResult.rows[0];
  if (client.user_id && client.user_id !== user.id) return clientConflict();
  if (client.user_id === user.id) return activateAlreadyLinked(client.id, user.id, store, now);

  const claim = await store.claimUnlinked(client.id, user.id, now());
  if (claim?.error) return result(500, 'No se pudo completar la activación del cliente.');
  if (claim?.data) return success(claim.data);

  // Another request may have claimed the row after the initial read. Accept only
  // the same auth.uid(); never overwrite a different user after a race.
  const latestResult = await store.findById(client.id);
  if (latestResult?.error) return result(500, 'No se pudo volver a verificar la vinculación del cliente.');
  if (!latestResult?.data) return result(404, 'La invitación ya no existe.');
  if (latestResult.data.user_id !== user.id) return clientConflict();

  return activateAlreadyLinked(client.id, user.id, store, now);
}

async function activateAlreadyLinked(clientId, userId, store, now) {
  const update = await store.activateLinked(clientId, userId, now());
  if (update?.error) return result(500, 'No se pudo completar la activación del cliente.');
  if (update?.data) return success(update.data);

  const latest = await store.findById(clientId);
  if (latest?.error) return result(500, 'No se pudo volver a verificar la vinculación del cliente.');
  if (!latest?.data) return result(404, 'La invitación ya no existe.');
  if (latest.data.user_id !== userId) return clientConflict();
  return result(409, 'La vinculación cambió durante la activación. Inténtalo de nuevo.');
}

function success(client) {
  return {
    status: 200,
    body: {
      success: true,
      client: { id: client.id, status: client.status },
    },
  };
}
