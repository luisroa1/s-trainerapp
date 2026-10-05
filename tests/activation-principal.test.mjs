import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActivationPrincipal } from '../supabase/functions/_shared/activation.mjs';

const valid = {
  user: { id: 'client-1', email: 'Client@Example.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
  profile: { id: 'client-1', role: 'client' },
  access: { state: 'pending' },
};

test('activation requires a verified Client identity and normalizes exact email', () => {
  assert.deepEqual(resolveActivationPrincipal(valid), {
    ok: true,
    userId: 'client-1',
    email: 'client@example.com',
  });
});

test('activation rejects invalid session, wrong role, missing state, and unconfirmed email', () => {
  assert.equal(resolveActivationPrincipal({ ...valid, user: null }).status, 401);
  assert.equal(resolveActivationPrincipal({ ...valid, profile: { id: 'client-1', role: 'trainer' } }).status, 403);
  assert.equal(resolveActivationPrincipal({ ...valid, access: null }).status, 403);
  assert.equal(resolveActivationPrincipal({ ...valid, access: { state: 'suspended' } }).status, 403);
  assert.equal(resolveActivationPrincipal({ ...valid, user: { ...valid.user, email_confirmed_at: null } }).status, 403);
  assert.equal(resolveActivationPrincipal({ ...valid, accessError: new Error('db') }).status, 500);
});
