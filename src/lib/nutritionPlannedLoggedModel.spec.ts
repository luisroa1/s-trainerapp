import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstructNutritionDay } from './nutritionPlannedLoggedModel';
import type { NutritionAssignmentContext, NutritionLogEvent, NutritionPlanSnapshot } from '../types';

const date = '2026-10-07';
const snapshot: NutritionPlanSnapshot = {
  schema_version: 1, plan_name: 'Plan V1', objective: null, target_kcal: null,
  targets: { protein_g: null, carbohydrate_g: null, fat_g: null, fiber_g: null, water_l: null }, notes: null,
  meals: [{ id: 'meal-v1', name: 'Comida', order: 1, description: null, notes: null, items: [
    { id: 'oats-v1', label: 'Avena', description: null, quantity: 60, unit: 'g', nutrients: null, notes: null, alternatives: [] },
    { id: 'milk-v1', label: 'Leche', description: null, quantity: null, unit: null, nutrients: null, notes: null, alternatives: [] },
  ] }],
};
const assignment: NutritionAssignmentContext = {
  id: 'assignment-v1', client_id: 'client-1', nutrition_plan_version_id: 'version-v1',
  assigned_at: '2026-10-01T00:00:00Z', ended_at: null, snapshot,
};
const event = (id: string, event_type: NutritionLogEvent['event_type'], extras: Partial<NutritionLogEvent> = {}): NutritionLogEvent => ({
  id, client_id: 'client-1', assignment_id: 'assignment-v1', prescribed_meal_id: 'meal-v1', event_type,
  occurred_at: '2026-10-07T10:00:00Z', nutrition_date: date, timezone_id: 'Europe/Madrid', recorded_at: '2026-10-07T10:00:01Z',
  actor_id: 'client-user', actor_kind: 'client_declaration', note: null, supersedes_event_id: null, items: [], ...extras,
});
const item = (id: string, operation: 'change_quantity' | 'removed' | 'substituted' | 'added', extras: Record<string, unknown> = {}) => ({
  id, event_id: 'log', client_id: 'client-1', operation,
  planned_item_id: operation === 'added' ? null : 'oats-v1', label: operation === 'added' || operation === 'substituted' ? 'Arroz' : null,
  quantity: operation === 'removed' ? null : 80, unit: operation === 'removed' ? null : 'g',
  energy_kcal: null, protein_g: null, carbohydrate_g: null, fat_g: null, fiber_g: null, note: null, ...extras,
});
const build = (events: NutritionLogEvent[], assignments = [assignment], historical = true) => reconstructNutritionDay({ nutritionDate: date, assignments, events, historical });

test('AS_PLANNED, SKIPPED, and known-context UNLOGGED remain distinct', () => {
  assert.equal(build([event('log', 'AS_PLANNED')]).meals[0].state, 'AS_PLANNED');
  assert.equal(build([event('skip', 'SKIPPED')]).meals[0].state, 'SKIPPED');
  assert.equal(build([]).meals[0].state, 'UNLOGGED');
});

test('missing historical context is not represented as UNLOGGED', () => {
  const result = build([], [{ ...assignment, assigned_at: '2026-10-07T12:00:00Z' }]);
  assert.equal(result.contextStatus, 'unavailable');
  assert.equal(result.meals[0].state, 'HISTORICAL_CONTEXT_UNAVAILABLE');
  assert.equal(build([], [], true).contextStatus, 'unavailable');
  assert.equal(build([], [], false).contextStatus, 'no_assignment');
});

test('assignment transition during a nutrition date leaves unobserved meals context-unavailable', () => {
  const secondMeal = { ...snapshot.meals[0], id: 'meal-v1-second', name: 'Cena' };
  const ended = { ...assignment, ended_at: '2026-10-07T12:00:00Z', snapshot: { ...snapshot, meals: [...snapshot.meals, secondMeal] } };
  const next: NutritionAssignmentContext = { ...assignment, id: 'assignment-v2', nutrition_plan_version_id: 'version-v2', assigned_at: '2026-10-07T12:00:00Z', snapshot: { ...snapshot, meals: [{ ...snapshot.meals[0], id: 'meal-v2', name: 'Comida V2' }] } };
  const result = build([event('v1-log', 'AS_PLANNED')], [ended, next]);
  assert.equal(result.contextStatus, 'unavailable');
  assert.equal(result.meals.find(row => row.mealId === 'meal-v1')?.state, 'AS_PLANNED');
  assert.equal(result.meals.find(row => row.mealId === 'meal-v1-second')?.state, 'HISTORICAL_CONTEXT_UNAVAILABLE');
  assert.ok(result.meals.every(row => row.state !== 'UNLOGGED'));
});

test('MODIFIED reconstructs changed, removed, substituted, added and unchanged items', () => {
  const modified = event('log', 'MODIFIED', { items: [
    item('change', 'change_quantity'),
    item('remove', 'removed', { planned_item_id: 'milk-v1' }),
    item('substitute', 'substituted', { planned_item_id: 'milk-v1' }),
    item('add', 'added', { planned_item_id: null }),
  ] });
  // Duplicate references are invalid rather than silently choosing one delta.
  const result = build([modified]);
  assert.equal(result.meals[0].state, 'HISTORICAL_CONTEXT_UNAVAILABLE');
  assert.match(result.issues[0], /Invalid item reference/);

  const valid = event('log', 'MODIFIED', { items: [
    item('change', 'change_quantity'), item('remove', 'removed', { planned_item_id: 'milk-v1' }), item('add', 'added', { planned_item_id: null }),
  ] });
  const meal = build([valid]).meals[0];
  assert.equal(meal.state, 'MODIFIED');
  assert.deepEqual(meal.items.map(row => row.kind), ['quantity_changed', 'removed', 'added']);
  assert.equal(meal.items[0].quantityDifference, 20);
  assert.equal(meal.items[2].logged?.energy_kcal, null);
});

test('numeric differences require explicit quantities and exactly matching units', () => {
  const changed = (quantity: number | null, unit: string | null) => event('log', 'MODIFIED', { items: [item('change', 'change_quantity', { quantity, unit })] });
  assert.equal(build([changed(80, 'g')]).meals[0].items[0].quantityDifference, 20);
  assert.equal(build([changed(80, 'oz')]).meals[0].items[0].quantityDifference, null);
  assert.equal(build([changed(null, 'g')]).meals[0].items[0].quantityDifference, null);
});

test('substitution records the original Planned item and the Client-declared replacement', () => {
  const substituted = event('log', 'MODIFIED', { items: [item('sub', 'substituted', { planned_item_id: 'milk-v1', label: 'Bebida vegetal' })] });
  const rows = build([substituted]).meals[0].items;
  assert.equal(rows[0].kind, 'unchanged');
  assert.equal(rows[1].kind, 'substituted');
  assert.equal(rows[1].planned?.label, 'Leche');
  assert.equal(rows[1].logged?.label, 'Bebida vegetal');
});

test('correction chain exposes only the current head; prior declarations remain history', () => {
  const first = event('one', 'AS_PLANNED');
  const second = event('two', 'MODIFIED', { supersedes_event_id: 'one', items: [item('change', 'change_quantity')] });
  const result = build([first, second]);
  assert.equal(result.meals[0].declaration?.id, 'two');
  assert.equal(result.meals[0].state, 'MODIFIED');
});

test('broken, branching or cyclic correction history fails safely', () => {
  const first = event('one', 'AS_PLANNED');
  const second = event('two', 'SKIPPED', { supersedes_event_id: 'one' });
  const branch = event('three', 'MODIFIED', { supersedes_event_id: 'one' });
  assert.equal(build([first, second, branch]).meals[0].state, 'HISTORICAL_CONTEXT_UNAVAILABLE');
  const cycleA = event('a', 'AS_PLANNED', { supersedes_event_id: 'b' });
  const cycleB = event('b', 'SKIPPED', { supersedes_event_id: 'a' });
  assert.equal(build([cycleA, cycleB]).meals[0].state, 'HISTORICAL_CONTEXT_UNAVAILABLE');
});

test('EXTRA is separate; VOID removes it from effective extras but preserves source history', () => {
  const extra = event('extra', 'EXTRA', { assignment_id: null, prescribed_meal_id: null, items: [item('extra-item', 'added', { event_id: 'extra' })] });
  const result = build([extra]);
  assert.equal(result.extras.length, 1);
  assert.equal(result.meals[0].state, 'UNLOGGED');
  const voided = event('void', 'VOID', { assignment_id: null, prescribed_meal_id: null, supersedes_event_id: 'extra' });
  assert.equal(build([extra, voided]).extras.length, 0);
});

test('V1 event resolves only through its historical assignment after V2 is assigned', () => {
  const v1Ended = { ...assignment, ended_at: '2026-10-08T15:00:00Z' };
  const v2: NutritionAssignmentContext = { ...assignment, id: 'assignment-v2', nutrition_plan_version_id: 'version-v2', assigned_at: '2026-10-08T15:00:00Z', snapshot: { ...snapshot, plan_name: 'Plan V2', meals: [{ ...snapshot.meals[0], id: 'meal-v2', name: 'Comida V2' }] } };
  const result = build([event('v1-log', 'AS_PLANNED')], [v1Ended, v2]);
  assert.equal(result.meals[0].assignmentId, 'assignment-v1');
  assert.equal(result.meals[0].meal?.name, 'Comida');
  assert.equal(result.meals[0].state, 'AS_PLANNED');
});

test('date and event timezone are preserved without regrouping', () => {
  const logged = event('log', 'AS_PLANNED', { occurred_at: '2026-10-06T22:30:00Z', nutrition_date: date, timezone_id: 'Europe/Madrid' });
  const result = build([logged]);
  assert.equal(result.nutritionDate, date);
  assert.equal(result.meals[0].declaration?.nutrition_date, date);
  assert.equal(result.meals[0].declaration?.timezone_id, 'Europe/Madrid');
});

test('no current draft, latest version, legacy fields, or request ledger are read-model inputs', () => {
  const result = reconstructNutritionDay({ nutritionDate: date, assignments: [assignment], events: [] });
  assert.equal(result.meals[0].meal?.name, 'Comida');
  assert.equal(result.meals[0].state, 'UNLOGGED');
  assert.ok(!('requestLedger' in result));
  assert.ok(!('kcalToday' in result));
});

test('invalid event meal reference cannot fall back to another snapshot meal', () => {
  const invalid = event('log', 'AS_PLANNED', { prescribed_meal_id: 'meal-from-other-version' });
  const result = build([invalid]);
  assert.equal(result.meals[0].state, 'HISTORICAL_CONTEXT_UNAVAILABLE');
  assert.match(result.issues[0], /missing from event assignment snapshot/);
});
