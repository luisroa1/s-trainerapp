import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccountAccess } from '../src/lib/accountAccessState.mjs';
import { resolveAppView, resolveProfileRole } from '../src/lib/profileRole.mjs';

test('account access resolution fails closed for missing/error/invalid state', () => {
  assert.equal(resolveAccountAccess({ row: { state: 'enabled' } }), 'enabled');
  assert.equal(resolveAccountAccess({ row: { state: 'pending' } }), 'pending');
  assert.equal(resolveAccountAccess({ row: { state: 'suspended' } }), 'suspended');
  assert.equal(resolveAccountAccess({ row: null }), 'pending');
  assert.equal(resolveAccountAccess({ error: new Error('offline') }), 'error');
  assert.equal(resolveAccountAccess({ row: { state: 'unknown' } }), 'error');
});

test('no Admin or Trainer UI mounts unless access is enabled and profile role is verified', () => {
  const common = { hasUser: true, roleStatus: 'resolved' };
  for (const accessStatus of ['pending', 'suspended', 'error', 'loading', 'idle']) {
    assert.notEqual(resolveAppView({ ...common, accessStatus, role: 'admin' }), 'admin');
    assert.notEqual(resolveAppView({ ...common, accessStatus, role: 'trainer' }), 'trainer');
  }
  assert.equal(resolveAppView({ ...common, accessStatus: 'enabled', role: 'admin' }), 'admin');
  assert.equal(resolveAppView({ ...common, accessStatus: 'enabled', role: 'trainer' }), 'trainer');
});

test('metadata cannot override profiles role, while recovery and activation routes retain precedence', () => {
  const user = { id: 'u1', user_metadata: { role: 'admin' } };
  assert.equal(resolveProfileRole({ profile: { id: user.id, role: 'client' } }), 'client');
  assert.equal(resolveProfileRole({ profile: null }), null);
  assert.equal(resolveAppView({ recoveryRequested: true, hasUser: true, accessStatus: 'pending', roleStatus: 'idle' }), 'recovery');
  assert.equal(resolveAppView({ activationRequested: true, hasUser: false }), 'activation');
});
