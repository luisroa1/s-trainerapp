/**
 * Runs the invitation writer and refreshes the existing client list after a
 * successful response. Client persistence belongs to invite-client only.
 */
export async function invokeInviteAndRefreshClients({ invoke, refreshClients }) {
  const result = await invoke();
  if (!result.error && !result.data?.error) {
    await refreshClients();
  }
  return result;
}
