import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completePasswordRecovery,
  getPasswordRecoveryLoginPath,
  signOutRecoverySession,
} from '../src/lib/passwordRecoveryCompletion.mjs';

test('login destination clears only recovery callback state and keeps unrelated query state', () => {
  assert.equal(
    getPasswordRecoveryLoginPath('https://app.strainerapp.com/?flow=recovery&keep=1&code=consumed#access_token=secret&type=recovery'),
    '/?keep=1',
  );
  assert.equal(
    getPasswordRecoveryLoginPath('https://app.strainerapp.com/?flow=activate&keep=1'),
    '/?flow=activate&keep=1',
  );
});

test('successful recovery updates password, signs out locally, then returns to login', async () => {
  const calls = [];
  const auth = {
    async updateUser(input) {
      calls.push(['updateUser', input]);
      return { error: null };
    },
    async signOut(options) {
      calls.push(['signOut', options]);
      return { error: null };
    },
  };
  const redirectToLogin = () => calls.push(['redirectToLogin']);

  const result = await completePasswordRecovery(auth, 'test-password', redirectToLogin);

  assert.deepEqual(result, { passwordUpdated: true, signedOut: true, error: undefined });
  assert.deepEqual(calls, [
    ['updateUser', { password: 'test-password' }],
    ['signOut', { scope: 'local' }],
    ['redirectToLogin'],
  ]);
});

test('sign-out errors remain visible to the caller and do not redirect to login', async () => {
  const signOutError = new Error('local sign-out failed');
  const calls = [];
  const auth = {
    async updateUser() {
      calls.push('updateUser');
      return { error: null };
    },
    async signOut(options) {
      calls.push(['signOut', options]);
      return { error: signOutError };
    },
  };
  const redirectToLogin = () => calls.push('redirectToLogin');

  const result = await completePasswordRecovery(auth, 'test-password', redirectToLogin);

  assert.equal(result.passwordUpdated, true);
  assert.equal(result.signedOut, false);
  assert.equal(result.error, signOutError);
  assert.deepEqual(calls, ['updateUser', ['signOut', { scope: 'local' }]]);
});

test('password update errors do not sign out or redirect', async () => {
  const updateError = new Error('password update failed');
  const calls = [];
  const auth = {
    async updateUser() {
      calls.push('updateUser');
      return { error: updateError };
    },
    async signOut() {
      calls.push('signOut');
      return { error: null };
    },
  };

  const result = await completePasswordRecovery(auth, 'test-password', () => calls.push('redirectToLogin'));

  assert.equal(result.passwordUpdated, false);
  assert.equal(result.signedOut, false);
  assert.equal(result.error, updateError);
  assert.deepEqual(calls, ['updateUser']);
});

test('a sign-out retry redirects only after local sign-out succeeds', async () => {
  const calls = [];
  const result = await signOutRecoverySession({
    async signOut(options) {
      calls.push(['signOut', options]);
      return { error: null };
    },
  }, () => calls.push('redirectToLogin'));

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [['signOut', { scope: 'local' }], 'redirectToLogin']);
});
