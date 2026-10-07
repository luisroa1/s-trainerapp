import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { applyNutritionPlan, getActiveNutritionPlan, getNutritionPlanDrafts, saveNutritionPlanDraft } from '../src/lib/nutritionPlanPersistence.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function supabaseMock({ userId = 'trainer-uuid', rows = {}, errors = {} } = {}) {
  const calls = [];
  const client = {
    auth: { async getUser() { calls.push({ auth: true }); return { data: { user: userId ? { id: userId } : null }, error: errors.auth || null }; } },
    from(table) {
      const call = { table, filters: [], selected: null, body: null, operation: 'select' };
      calls.push(call);
      const result = rows[table];
      const query = {
        select(value) { call.selected = value; return query; },
        eq(column, value) { call.filters.push(['eq', column, value]); return query; },
        is(column, value) { call.filters.push(['is', column, value]); return query; },
        order(column, options) { call.order = [column, options]; return query; },
        limit(value) { call.limit = value; return query; },
        insert(body) { call.operation = 'insert'; call.body = body; return query; },
        update(body) { call.operation = 'update'; call.body = body; return query; },
        async single() { return { data: result?.single || null, error: errors[table] || null }; },
        async maybeSingle() { return { data: result?.single || null, error: errors[table] || null }; },
        then(resolve, reject) { return Promise.resolve({ data: result?.list || [], error: errors[table] || null }).then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) { calls.push({ rpc: name, args }); return { data: rows.rpc || null, error: errors.rpc || null }; },
  };
  return { client, calls };
}

const snapshot = {
  schema_version: 1,
  plan_name: 'Plan de prueba',
  objective: null,
  target_kcal: null,
  targets: { protein_g: null, carbohydrate_g: null, fat_g: null, fiber_g: null, water_l: null },
  meals: [],
  notes: null,
};

test('Trainer draft persists only to canonical identity table with Auth ownership', async () => {
  const { client, calls } = supabaseMock({ rows: { nutrition_plan_definitions: { single: { id: 'identity-1' } } } });
  const id = await saveNutritionPlanDraft(client, 'client-1', null, snapshot);
  assert.equal(id, 'identity-1');
  const write = calls.find(call => call.table === 'nutrition_plan_definitions');
  assert.equal(write.operation, 'insert');
  assert.equal(write.body.client_id, 'client-1');
  assert.equal(write.body.trainer_id, 'trainer-uuid');
  assert.equal(write.body.draft_snapshot, snapshot);
  assert.equal(calls.some(call => call.table === 'nutrition_plans'), false);
});

test('draft persistence and apply reject unconfirmed results', async () => {
  const unauthenticated = supabaseMock({ userId: null });
  await assert.rejects(saveNutritionPlanDraft(unauthenticated.client, 'client-1', null, snapshot), /sesión autenticada/);
  assert.equal(unauthenticated.calls.some(call => call.table), false);

  const noRow = supabaseMock({ rows: { nutrition_plan_definitions: { single: null } } });
  await assert.rejects(saveNutritionPlanDraft(noRow.client, 'client-1', null, snapshot), /no confirmó/);

  const noApplyResult = supabaseMock();
  await assert.rejects(applyNutritionPlan(noApplyResult.client, 'identity-1', 'request-key'), /no confirmó/);
  assert.deepEqual(noApplyResult.calls.at(-1), { rpc: 'apply_nutrition_plan', args: { p_plan_id: 'identity-1', p_request_key: 'request-key' } });
});

test('Client active-plan reader follows active assignment to immutable version, not legacy JSON', async () => {
  const active = { id: 'assignment-1', assigned_at: '2026-10-07T10:00:00Z', nutrition_plan_version_id: 'version-1' };
  const version = { id: 'version-1', version_number: 1, snapshot };
  const { client, calls } = supabaseMock({ rows: {
    clients: { single: { id: 'client-1' } },
    client_nutrition_assignments: { single: active },
    nutrition_plan_versions: { single: version },
  } });
  const result = await getActiveNutritionPlan(client);
  assert.deepEqual(result, { assignmentId: active.id, assignedAt: active.assigned_at, versionId: version.id, versionNumber: 1, snapshot });
  assert.deepEqual(calls.filter(call => call.table).map(call => call.table), ['clients', 'client_nutrition_assignments', 'nutrition_plan_versions']);
  assert.equal(calls.some(call => call.table === 'nutrition_plans'), false);
});

test('draft loader reads only canonical draft definitions', async () => {
  const row = { id: 'identity-1', client_id: 'client-1', draft_snapshot: snapshot };
  const { client, calls } = supabaseMock({ rows: { nutrition_plan_definitions: { list: [row] } } });
  assert.deepEqual(await getNutritionPlanDrafts(client), [row]);
  assert.equal(calls[0].table, 'nutrition_plan_definitions');
});

test('app and Client UI do not use legacy nutrition cache or checklist as Planned/Logged authority', () => {
  const context = read('../src/context/AppContext.tsx');
  const clientUi = read('../src/components/client/ClientNutrition.tsx');
  const clientApp = read('../src/components/client/ClientApp.tsx');
  assert.doesNotMatch(context, /localStorage\.(?:getItem|setItem)\(['"]strainer_nutrition/);
  assert.match(context, /active assignment -> immutable version/);
  assert.doesNotMatch(clientUi, /toggleMealCompleted|completed|kcalToday|kcalGoal|nutritionPlans\[/);
  assert.match(clientUi, /activeNutritionPlan/);
  assert.doesNotMatch(clientApp, /setCurrentScreen\('(calculadora|lista_compra|suplementos)'\)/);
});
