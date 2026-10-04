import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppView, resolveProfileRole } from '../src/lib/profileRole.mjs';

test('accepts only roles read from profiles', () => {
  for (const role of ['client', 'trainer', 'admin']) {
    assert.equal(resolveProfileRole({ profile: { role } }), role);
  }
});

test('fails closed for missing profile, query error, and invalid role', () => {
  assert.equal(resolveProfileRole({ profile: null }), null);
  assert.equal(resolveProfileRole({ profile: { role: 'admin' }, error: new Error('denied') }), null);
  assert.equal(resolveProfileRole({ profile: { role: 'owner' } }), null);
});

test('metadata and browser storage cannot override the profile role', () => {
  assert.equal(resolveProfileRole({ profile: { role: 'client' }, user: { user_metadata: { role: 'admin' } }, localStorageRole: 'admin' }), 'client');
  assert.equal(resolveProfileRole({ profile: null, user: { user_metadata: { role: 'admin' } }, localStorageRole: 'admin' }), null);
});

test('password recovery route does not depend on role resolution', () => {
  assert.equal(resolveAppView({ recoveryRequested: true, hasUser: true, roleStatus: 'error', role: null }), 'recovery');
  assert.equal(resolveAppView({ recoveryRequested: true, hasUser: true, roleStatus: 'loading', role: null }), 'recovery');
});

test('profile errors never select trainer or admin application', () => {
  assert.equal(resolveAppView({ hasUser: true, roleStatus: 'error', role: null }), 'profile-error');
  assert.equal(resolveAppView({ hasUser: true, roleStatus: 'error', role: 'admin' }), 'profile-error');
  assert.equal(resolveAppView({ hasUser: true, roleStatus: 'resolved', role: null }), 'profile-error');
});
