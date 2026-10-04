import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { activateClientAccount } from '../supabase/functions/activate-client/activation.mjs';

function makeStore(initialRows = [], overrides = {}) {
  const rows = structuredClone(initialRows);
  const store = {
    rows,
    async findByUserId(userId) {
      return { data: rows.filter(row => row.user_id === userId) };
    },
    async findByExactEmail(email) {
      return { data: rows.filter(row => row.email === email) };
    },
    async claimUnlinked(clientId, userId, timestamp) {
      const row = rows.find(item => item.id === clientId && item.user_id === null);
      if (!row) return { data: null };
      row.user_id = userId;
      row.status = 'Activo';
      row.updated_at = timestamp;
      return { data: { id: row.id, status: row.status } };
    },
    async activateLinked(clientId, userId, timestamp) {
      const row = rows.find(item => item.id === clientId && item.user_id === userId);
      if (!row) return { data: null };
      row.status = 'Activo';
      row.updated_at = timestamp;
      return { data: { id: row.id, status: row.status } };
    },
    async findById(clientId) {
      const row = rows.find(item => item.id === clientId);
      return { data: row ? { id: row.id, user_id: row.user_id } : null };
    },
  };
  return Object.assign(store, overrides);
}

const clientUser = (email = 'new.client@example.test', id = 'auth-client-1') => ({
  id,
  email,
  email_confirmed_at: '2026-10-04T00:00:00Z',
});
const clientProfile = id => ({ id, role: 'client' });
const row = (overrides = {}) => ({
  id: 'client-row-1',
  email: 'new.client@example.test',
  user_id: null,
  status: 'Pendiente',
  ...overrides,
});
const fixedNow = () => '2026-10-04T12:00:00.000Z';

test('legitimate activation claims only the exact pending row and returns minimal fields', async () => {
  const store = makeStore([row()]);
  const result = await activateClientAccount({ user: clientUser(), profile: clientProfile('auth-client-1'), store, now: fixedNow });
  assert.deepEqual(result, { status: 200, body: { success: true, client: { id: 'client-row-1', status: 'Activo' } } });
  assert.equal(store.rows[0].user_id, 'auth-client-1');
  assert.deepEqual(Object.keys(result.body.client).sort(), ['id', 'status']);
});

test('trainer and admin roles are denied before any client-row lookup', async () => {
  for (const role of ['trainer', 'admin']) {
    const store = makeStore([row()], {
      async findByUserId() { throw new Error('must not query client rows'); },
    });
    const result = await activateClientAccount({
      user: clientUser(), profile: { id: 'auth-client-1', role }, store,
    });
    assert.equal(result.status, 403, role);
  }
});

test('an unverified email is denied', async () => {
  const store = makeStore([row()]);
  const user = { ...clientUser(), email_confirmed_at: null };
  const result = await activateClientAccount({ user, profile: clientProfile(user.id), store });
  assert.equal(result.status, 403);
  assert.equal(store.rows[0].user_id, null);
});

test('email is trimmed and lowercased, while underscore remains a literal character', async () => {
  const email = 'new_client@example.test';
  const store = makeStore([row({ email })]);
  const user = clientUser(`  ${email.toUpperCase()}  `);
  const result = await activateClientAccount({ user, profile: clientProfile(user.id), store });
  assert.equal(result.status, 200);
  assert.equal(store.rows[0].user_id, user.id);

  const mismatchStore = makeStore([row({ email: 'newXclient@example.test' })]);
  const mismatch = await activateClientAccount({ user, profile: clientProfile(user.id), store: mismatchStore });
  assert.equal(mismatch.status, 404);
  assert.equal(mismatchStore.rows[0].user_id, null);
});

test('percent in an email is literal and cannot match a different address', async () => {
  const email = 'new%client@example.test';
  const user = clientUser(email);
  const exactStore = makeStore([row({ email })]);
  assert.equal((await activateClientAccount({ user, profile: clientProfile(user.id), store: exactStore })).status, 200);

  const mismatchStore = makeStore([row({ email: 'new-any-client@example.test' })]);
  const mismatch = await activateClientAccount({ user, profile: clientProfile(user.id), store: mismatchStore });
  assert.equal(mismatch.status, 404);
  assert.equal(mismatchStore.rows[0].user_id, null);
});

test('a row already linked to the same auth user is idempotently accepted', async () => {
  const user = clientUser();
  const store = makeStore([row({ user_id: user.id })]);
  const result = await activateClientAccount({ user, profile: clientProfile(user.id), store });
  assert.equal(result.status, 200);
  assert.equal(store.rows[0].user_id, user.id);
});

test('a row linked to another user is rejected without changing ownership', async () => {
  const user = clientUser();
  const store = makeStore([row({ user_id: 'different-auth-user' })]);
  const result = await activateClientAccount({ user, profile: clientProfile(user.id), store });
  assert.equal(result.status, 409);
  assert.equal(store.rows[0].user_id, 'different-auth-user');
});

test('missing and duplicate exact-email rows are rejected', async () => {
  const user = clientUser();
  const missing = await activateClientAccount({ user, profile: clientProfile(user.id), store: makeStore([]) });
  assert.equal(missing.status, 404);

  const duplicate = await activateClientAccount({
    user,
    profile: clientProfile(user.id),
    store: makeStore([row(), row({ id: 'client-row-2' })]),
  });
  assert.equal(duplicate.status, 409);
});

test('query errors fail closed', async () => {
  const user = clientUser();
  const store = makeStore([], { async findByUserId() { return { data: null, error: new Error('database unavailable') }; } });
  const result = await activateClientAccount({ user, profile: clientProfile(user.id), store });
  assert.equal(result.status, 500);
});

test('a concurrent claim is accepted only if the same auth user won it', async () => {
  const user = clientUser();
  const sameUserStore = makeStore([row()], {
    async claimUnlinked() {
      this.rows[0].user_id = user.id;
      return { data: null };
    },
  });
  assert.equal((await activateClientAccount({ user, profile: clientProfile(user.id), store: sameUserStore })).status, 200);

  const otherUserStore = makeStore([row()], {
    async claimUnlinked() {
      this.rows[0].user_id = 'other-user';
      return { data: null };
    },
  });
  assert.equal((await activateClientAccount({ user, profile: clientProfile(user.id), store: otherUserStore })).status, 409);
  assert.equal(otherUserStore.rows[0].user_id, 'other-user');
});

test('production adapter uses exact email and conditional user_id updates; frontend has no direct fallback', () => {
  const edge = readFileSync(new URL('../supabase/functions/activate-client/index.ts', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/components/client/ClientActivate.tsx', import.meta.url), 'utf8');
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /\.from\('profiles'\)[\s\S]*?\.eq\('id', user\.id\)/);
  assert.match(edge, /\.eq\('email', email\)/);
  assert.match(edge, /\.is\('user_id', null\)/);
  assert.match(edge, /\.eq\('user_id', userId\)/);
  assert.doesNotMatch(edge, /\.ilike\(/);
  assert.doesNotMatch(ui, /\.from\('clients'\)|\.ilike\(/);
  assert.match(ui, /if \(edgeError \|\| !edgeData\?\.success \|\| !edgeData\.client\?\.id\)/);
});
