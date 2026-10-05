import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActorAccess, resolveActorRole } from '../supabase/functions/_shared/accountAccess.mjs';
import { runClientInvitation } from '../supabase/functions/_shared/clientInvitationFlow.mjs';

const user = { id: 'user-client-1' };

test('actor role authority requires matching verified profile role', () => {
  assert.deepEqual(resolveActorRole({ user, profile: { id: user.id, role: 'trainer' }, expectedRole: 'trainer' }), { ok: true });
  assert.equal(resolveActorRole({ user, profile: { id: user.id, role: 'client' }, expectedRole: 'trainer' }).status, 403);
  assert.equal(resolveActorRole({ user, profile: { id: 'other', role: 'trainer' }, expectedRole: 'trainer' }).status, 403);
  assert.equal(resolveActorRole({ user, profile: null, expectedRole: 'trainer' }).status, 403);
  assert.equal(resolveActorRole({ user, profileError: new Error('db'), expectedRole: 'trainer' }).status, 500);
});

test('actor account access fails closed for pending, suspended, missing, and query errors', () => {
  assert.deepEqual(resolveActorAccess({ access: { state: 'enabled' } }), { ok: true });
  for (const state of ['pending', 'suspended']) {
    assert.equal(resolveActorAccess({ access: { state } }).status, 403);
  }
  assert.equal(resolveActorAccess({ access: null }).status, 403);
  assert.equal(resolveActorAccess({ accessError: new Error('db') }).status, 500);
});

test('Client invitation lifecycle stays pending until relation persistence and ledger finalization succeed', async () => {
  const order = [];
  const result = await runClientInvitation({
    authorizeBeforeInvite: async () => { order.push('actor-check'); return { ok: true }; },
    inviteAuthUser: async () => { order.push('auth-invite'); return { user: { id: 'new-client' } }; },
    verifyPendingClient: async () => { order.push('trigger-check'); return { profile: { id: 'new-client', role: 'client' }, access: { state: 'pending' } }; },
    persistClientRelation: async () => { order.push('client-row'); return { data: { id: 'cli-new' } }; },
    finishOperation: async (args) => { order.push(`ledger-${args.state}`); return { data: { state: args.state } }; },
  });
  assert.deepEqual(order, ['actor-check', 'auth-invite', 'trigger-check', 'client-row', 'ledger-invited']);
  assert.equal(result.success, true);
});

test('Client invitation does not report success if trigger, relation write, or ledger finalization fails', async () => {
  const partialStates = [];
  const base = {
    authorizeBeforeInvite: async () => ({ ok: true }),
    inviteAuthUser: async () => ({ user: { id: 'new-client' } }),
    verifyPendingClient: async () => ({ profile: { id: 'new-client', role: 'client' }, access: { state: 'pending' } }),
    persistClientRelation: async () => ({ data: { id: 'cli-new' } }),
    finishOperation: async (args) => { partialStates.push(args.state); return { data: { state: args.state } }; },
  };
  const triggerFail = await runClientInvitation({ ...base, verifyPendingClient: async () => ({ profile: { id: 'new-client', role: 'client' }, access: { state: 'enabled' } }) });
  assert.equal(triggerFail.success, false);
  assert.equal(partialStates.pop(), 'partial');

  const relationFail = await runClientInvitation({ ...base, persistClientRelation: async () => ({ error: new Error('write') }) });
  assert.equal(relationFail.success, false);
  assert.equal(partialStates.pop(), 'partial');

  const ledgerFail = await runClientInvitation({ ...base, finishOperation: async (args) => { partialStates.push(args.state); return { error: new Error('write') }; } });
  assert.equal(ledgerFail.success, false);
  assert.equal(ledgerFail.stage, 'ledger_finalize');
  assert.equal(partialStates.at(-1), 'partial');
});

test('disabled Trainer is rejected before a privileged invitation is attempted', async () => {
  const calls = [];
  const result = await runClientInvitation({
    authorizeBeforeInvite: async () => ({ ok: false }),
    inviteAuthUser: async () => { calls.push('invite'); return { user: { id: 'must-not-exist' } }; },
    verifyPendingClient: async () => { calls.push('verify'); },
    persistClientRelation: async () => { calls.push('insert'); },
    finishOperation: async ({ state }) => { calls.push(`ledger-${state}`); return { data: { state } }; },
  });
  assert.equal(result.success, false);
  assert.equal(result.status, 403);
  assert.deepEqual(calls, ['ledger-failed']);
});

test('missing or failed authorization check never reaches Auth invite', async () => {
  let inviteCalled = false;
  const result = await runClientInvitation({
    authorizeBeforeInvite: async () => { throw new Error('lookup'); },
    inviteAuthUser: async () => { inviteCalled = true; return { user: { id: 'must-not-exist' } }; },
    verifyPendingClient: async () => null,
    persistClientRelation: async () => null,
    finishOperation: async ({ state }) => ({ data: { state } }),
  });
  assert.equal(result.success, false);
  assert.equal(inviteCalled, false);
});
