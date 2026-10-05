export async function runClientInvitation({
  authorizeBeforeInvite,
  inviteAuthUser,
  verifyPendingClient,
  persistClientRelation,
  finishOperation,
}) {
  const fail = async (stage, errorCode, targetUserId = null, status = 500) => {
    try {
      await finishOperation({ state: targetUserId ? 'partial' : 'failed', targetUserId, errorCode });
    } catch {
      // Preserve failure: a missing ledger finalization can never become success.
    }
    return { success: false, stage, errorCode, status };
  };

  try {
    const authorized = await authorizeBeforeInvite();
    if (!authorized?.ok) return await fail('actor_state', 'trainer_not_enabled', null, 403);
  } catch {
    return await fail('actor_state', 'trainer_state_unavailable', null, 500);
  }

  let invitation;
  try {
    invitation = await inviteAuthUser();
  } catch {
    return await fail('auth_invite', 'auth_invite_failed', null, 400);
  }
  const invitedUser = invitation?.user;
  if (invitation?.error || !invitedUser?.id) {
    return await fail('auth_invite', invitation?.errorCode || 'auth_invite_failed', null, 400);
  }

  let pending;
  try {
    pending = await verifyPendingClient(invitedUser);
  } catch {
    return await fail('trigger_verification', 'auth_profile_access_mismatch', invitedUser.id);
  }
  if (pending?.error || pending?.profile?.id !== invitedUser.id
    || pending?.profile?.role !== 'client' || pending?.access?.state !== 'pending') {
    return await fail('trigger_verification', 'auth_profile_access_mismatch', invitedUser.id);
  }

  let relation;
  try {
    relation = await persistClientRelation(invitedUser);
  } catch {
    return await fail('client_relation', 'client_relation_persist_failed', invitedUser.id);
  }
  if (relation?.error || !relation?.data) {
    return await fail('client_relation', 'client_relation_persist_failed', invitedUser.id);
  }

  let finalized;
  try {
    finalized = await finishOperation({ state: 'invited', targetUserId: invitedUser.id, errorCode: null });
  } catch {
    return { success: false, stage: 'ledger_finalize', errorCode: 'operation_finalize_failed' };
  }
  if (finalized?.error || finalized?.data?.state !== 'invited') {
    try {
      await finishOperation({ state: 'partial', targetUserId: invitedUser.id, errorCode: 'operation_finalize_failed' });
    } catch {
      // The ledger remains started and can be reconciled by a trusted operator.
    }
    return { success: false, stage: 'ledger_finalize', errorCode: 'operation_finalize_failed' };
  }
  return { success: true, user: invitedUser, client: relation.data };
}
