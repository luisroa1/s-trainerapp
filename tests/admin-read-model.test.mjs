import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminReadModel,
  canEnterAdmin,
  fetchAdminReadModel,
  getAdminNavigationTarget,
  searchAdminDirectory,
} from '../src/lib/adminReadModel.mjs';

const seed = {
  profiles: [
    { id: 'trainer-1', role: 'trainer', email: 'trainer@example.test', full_name: 'Ada Trainer', created_at: '2026-01-01' },
    { id: 'client-1', role: 'client', email: 'client@example.test', full_name: 'Client Profile' },
  ],
  trainerProfiles: [
    { id: 'trainer-1', name: 'Ada Presentation', initials: 'AP' },
    { id: 'fake-trainer', name: 'Not authoritative' },
  ],
  clients: [
    { id: 'c-1', trainer_id: 'trainer-1', name: 'Bea Client', email: 'bea@example.test', status: 'Activo', assigned_program_id: 'p-1' },
  ],
  programs: [
    { id: 'p-1', trainer_id: 'trainer-1', name: 'Strength', days_per_week: 3 },
  ],
};

test('Admin read model trusts profiles.role and groups persisted ownership relationships', () => {
  const model = buildAdminReadModel(seed);
  assert.equal(model.trainers.length, 1);
  assert.equal(model.trainers[0].name, 'Ada Presentation');
  assert.equal(model.trainers[0].clients.length, 1);
  assert.equal(model.trainers[0].programs.length, 1);
  assert.equal(model.clients[0].trainer.id, 'trainer-1');
  assert.equal(model.clients[0].program.id, 'p-1');
  assert.equal(model.programs[0].clients[0].id, 'c-1');
  assert.equal('nutritionPlans' in model, false);
});

test('trainer_profiles presentation rows never create Admin Trainer identities', () => {
  const model = buildAdminReadModel({ ...seed, profiles: [] });
  assert.deepEqual(model.trainers, []);
});

test('global directory search finds Trainers and Clients by available fields', () => {
  const model = buildAdminReadModel(seed);
  assert.deepEqual(searchAdminDirectory(model, 'ada').trainers.map(row => row.id), ['trainer-1']);
  assert.deepEqual(searchAdminDirectory(model, 'bea@example.test').clients.map(row => row.id), ['c-1']);
  assert.deepEqual(searchAdminDirectory(model, '').trainers, []);
});

test('Admin navigation links relationships to read-only record details', () => {
  assert.deepEqual(getAdminNavigationTarget('trainer', 'trainer-1'), { section: 'trainers', selectedId: 'trainer-1' });
  assert.deepEqual(getAdminNavigationTarget('client', 'c-1'), { section: 'clients', selectedId: 'c-1' });
  assert.deepEqual(getAdminNavigationTarget('programs', 'p-1'), { section: 'programs', selectedId: 'p-1' });
  assert.deepEqual(getAdminNavigationTarget('unknown'), { section: 'home', selectedId: null });
});

test('only the authoritative admin role may enter Admin', () => {
  assert.equal(canEnterAdmin('admin'), true);
  assert.equal(canEnterAdmin('trainer'), false);
  assert.equal(canEnterAdmin('client'), false);
  assert.equal(canEnterAdmin(null), false);
});

test('Admin read failure rejects instead of falling back to cached or mock data', async () => {
  const responses = {
    profiles: { data: seed.profiles, error: null },
    trainer_profiles: { data: seed.trainerProfiles, error: null },
    clients: { data: null, error: new Error('RLS denied') },
    programs: { data: seed.programs, error: null },
  };
  const fakeSupabase = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        then(resolve, reject) { return Promise.resolve(responses[table]).then(resolve, reject); },
      };
      return query;
    },
  };
  await assert.rejects(fetchAdminReadModel(fakeSupabase), /No se pudieron cargar los datos de clients/);
});

test('Admin read model never queries legacy nutrition_plans', async () => {
  const queriedTables = [];
  const fakeSupabase = {
    from(table) {
      queriedTables.push(table);
      const query = {
        select() { return query; },
        eq() { return query; },
        then(resolve, reject) {
          const rows = table === 'profiles' ? seed.profiles
            : table === 'trainer_profiles' ? seed.trainerProfiles
              : table === 'clients' ? seed.clients : seed.programs;
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const model = await fetchAdminReadModel(fakeSupabase);
  assert.deepEqual(queriedTables.sort(), ['clients', 'profiles', 'programs', 'trainer_profiles']);
  assert.equal('nutritionPlans' in model, false);
});
