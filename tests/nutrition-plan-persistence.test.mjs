import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { persistNutritionPlanForCurrentUser } from '../src/lib/nutritionPlanPersistence.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

function mockSupabase({ userId = 'authenticated-trainer-uid', authError = null, upsertError = null, noSavedRow = false } = {}) {
  const calls = { auth: 0, table: null, row: null, options: null };
  const client = {
    auth: {
      async getUser() {
        calls.auth += 1;
        return { data: { user: userId ? { id: userId } : null }, error: authError };
      },
    },
    from(table) {
      calls.table = table;
      return {
        upsert(row, options) {
          calls.row = row;
          calls.options = options;
          return {
            select(columns) {
              calls.selectedColumns = columns;
              return {
                async single() {
                  return { data: upsertError || noSavedRow ? null : { id: row.id }, error: upsertError };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test('nutrition plan ownership comes from Auth and preserves selected client id', async () => {
  const { client, calls } = mockSupabase();
  const plan = { id: 'nutrition-plan-1', clientId: 'stale-client', clientName: 'Client', trainer_id: 'caller-controlled' };

  await persistNutritionPlanForCurrentUser(client, 'selected-client-id', plan, 'attacker-trainer-id');

  assert.equal(calls.auth, 1);
  assert.equal(calls.table, 'nutrition_plans');
  assert.equal(calls.row.trainer_id, 'authenticated-trainer-uid');
  assert.equal(calls.row.client_id, 'selected-client-id');
  assert.equal(calls.row.data.clientId, 'selected-client-id');
  assert.equal('trainer_id' in calls.row.data, false);
  assert.equal('trainerId' in calls.row.data, false);
  assert.equal(calls.row.id, 'nutrition-plan-1');
  assert.deepEqual(calls.options, { onConflict: 'id' });
  assert.equal(calls.selectedColumns, 'id');
});

test('Auth and Supabase write errors reject instead of becoming successful persistence', async () => {
  const authFailure = new Error('Auth unavailable');
  const authMock = mockSupabase({ authError: authFailure });
  await assert.rejects(
    persistNutritionPlanForCurrentUser(authMock.client, 'client-1', { id: 'plan-1' }),
    authFailure,
  );
  assert.equal(authMock.calls.table, null);

  const writeFailure = new Error('RLS denied');
  const writeMock = mockSupabase({ upsertError: writeFailure });
  await assert.rejects(
    persistNutritionPlanForCurrentUser(writeMock.client, 'client-1', { id: 'plan-1' }),
    writeFailure,
  );

  const noUserMock = mockSupabase({ userId: null });
  await assert.rejects(
    persistNutritionPlanForCurrentUser(noUserMock.client, 'client-1', { id: 'plan-1' }),
    /sesión autenticada/,
  );
  assert.equal(noUserMock.calls.table, null);

  const noRowMock = mockSupabase({ noSavedRow: true });
  await assert.rejects(
    persistNutritionPlanForCurrentUser(noRowMock.client, 'client-1', { id: 'plan-1' }),
    /no confirmó el guardado/,
  );
});

test('Trainer save awaits persistence, shows errors, and updates state only after success', () => {
  const context = read('../src/context/AppContext.tsx');
  const update = context.slice(
    context.indexOf('const updateNutritionPlan ='),
    context.indexOf('const toggleMealCompleted ='),
  );
  assert.match(update, /await supabaseDb\.upsertNutritionPlan\(clientId, plan\)/);
  assert.match(update, /if \(error\) throw error/);
  assert.match(update, /userRole !== 'trainer'/);
  assert.ok(update.indexOf('if (error) throw error') < update.indexOf('setNutritionPlans('));

  const builder = read('../src/components/trainer/TrainerNutritionBuilder.tsx');
  assert.match(builder, /await updateNutritionPlan\(client\.id, \{ \.\.\.plan, clientId: client\.id \}\)/);
  assert.match(builder, /setSaveError\(/);
  assert.match(builder, /No se guardó el plan:/);
});

test('nutrition plan reads remain keyed by the stored client_id', () => {
  const supabase = read('../src/lib/supabase.ts');
  const getter = supabase.slice(
    supabase.indexOf('async getNutritionPlans'),
    supabase.indexOf('async upsertNutritionPlan'),
  );
  assert.match(getter, /\.from\('nutrition_plans'\)/);
  assert.match(getter, /\.select\('\*'\)/);
  assert.match(getter, /result\[row\.client_id\] = row\.data/);
});

test('other nutrition-plan saves propagate failures to visible client errors', () => {
  const context = read('../src/context/AppContext.tsx');
  assert.equal((context.match(/await supabaseDb\.upsertNutritionPlan\(/g) || []).length, 3);
  assert.equal((context.match(/if \(error\) throw error/g) || []).length >= 3, true);
  assert.match(read('../src/components/client/ClientNutrition.tsx'), /No se guardó el cambio:/);
  assert.match(read('../src/components/client/ClientShoppingList.tsx'), /No se guardó el cambio:/);
});
