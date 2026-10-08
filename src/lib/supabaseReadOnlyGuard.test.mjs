import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPreviewWritesAllowed, protectSupabaseClient, ReadOnlyPreviewWriteError } from './supabaseReadOnlyGuard.mjs';

function queryBuilder(calls) {
  const builder = {
    select() { calls.push('select'); return this; },
    eq() { calls.push('eq'); return this; },
    insert() { calls.push('insert'); return this; },
    update() { calls.push('update'); return this; },
    upsert() { calls.push('upsert'); return this; },
    delete() { calls.push('delete'); return this; },
    then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
  };
  return builder;
}

function mockClient() {
  const calls = [];
  const client = {
    calls,
    from: (table) => { calls.push(`from:${table}`); return queryBuilder(calls); },
    rpc: (name) => { calls.push(`rpc:${name}`); return Promise.resolve({ data: null, error: null }); },
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: 'trainer' } }, error: null }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: { id: 'trainer' } }, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.invalid/read.png' } }),
        upload: async () => ({ data: { path: 'write.png' }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    functions: { invoke: async () => ({ data: {}, error: null }) },
  };
  return client;
}

test('preview blocks direct table mutations after read filters and preserves reads', async () => {
  const raw = mockClient();
  const client = protectSupabaseClient(raw, true);

  const read = await client.from('clients').select('id').eq('trainer_id', 'trainer');
  assert.deepEqual(read, { data: [], error: null });
  for (const method of ['insert', 'update', 'upsert', 'delete']) {
    assert.throws(() => client.from('programs').select('id').eq('id', 'p')[method]({}), ReadOnlyPreviewWriteError);
  }
  assert.deepEqual(raw.calls, ['from:clients', 'select', 'eq', 'from:programs', 'select', 'eq', 'from:programs', 'select', 'eq', 'from:programs', 'select', 'eq', 'from:programs', 'select', 'eq']);
});

test('preview allows login and read RPC but blocks write RPC, password changes, storage writes and Edge Functions', async () => {
  const client = protectSupabaseClient(mockClient(), true);
  const login = await client.auth.signInWithPassword({ email: 'trainer@example.invalid', password: 'not-real' });
  assert.equal(login.data.user.id, 'trainer');
  await client.rpc('get_open_workout_session');
  assert.throws(() => client.rpc('apply_program_to_client', {}), ReadOnlyPreviewWriteError);
  assert.throws(() => client.auth.resetPasswordForEmail('trainer@example.invalid'), ReadOnlyPreviewWriteError);
  assert.throws(() => client.storage.from('avatars').upload('x', new Blob()), ReadOnlyPreviewWriteError);
  assert.throws(() => client.storage.from('avatars').remove(['x']), ReadOnlyPreviewWriteError);
  assert.throws(() => client.functions.invoke('invite-client', {}), ReadOnlyPreviewWriteError);
});

test('production-mode client is returned unchanged and remains writable', async () => {
  const raw = mockClient();
  const client = protectSupabaseClient(raw, false);
  assert.equal(client, raw);
  await client.from('programs').upsert({ id: 'p' });
  assert.ok(raw.calls.includes('upsert'));
});

test('preview context write entry points reject before changing app state', () => {
  assert.throws(() => assertPreviewWritesAllowed(true, 'Guardar programa'), ReadOnlyPreviewWriteError);
  assert.doesNotThrow(() => assertPreviewWritesAllowed(false, 'Guardar programa'));
});
