import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNutritionDelta, currentMealDeclaration, nutritionDateForInstant } from './nutritionLogModel.mjs';
import { prepareNutritionLogRequest } from './nutritionLogRequest.mjs';

test('nutrition date is grouped in the saved IANA timezone, including UTC boundary', () => {
  assert.equal(nutritionDateForInstant('2026-10-07T22:30:00.000Z', 'Europe/Madrid'), '2026-10-08');
  assert.equal(nutritionDateForInstant('2026-10-07T22:30:00.000Z', 'America/Los_Angeles'), '2026-10-07');
});

test('meal declaration is absent rather than SKIPPED when no event exists', () => {
  assert.equal(currentMealDeclaration([], 'assignment', 'meal', '2026-10-07'), null);
});

test('correction chain resolves to one current declaration without rewriting its predecessor', () => {
  const first = { id: 'one', assignment_id: 'a', prescribed_meal_id: 'm', nutrition_date: '2026-10-07', event_type: 'AS_PLANNED', supersedes_event_id: null };
  const correction = { id: 'two', assignment_id: 'a', prescribed_meal_id: 'm', nutrition_date: '2026-10-07', event_type: 'MODIFIED', supersedes_event_id: 'one' };
  const events = [first, correction];
  assert.equal(currentMealDeclaration(events, 'a', 'm', '2026-10-07'), correction);
  assert.equal(first.event_type, 'AS_PLANNED');
});

test('VOID remains an audit head and is not presented as a meal outcome', () => {
  const extra = { id: 'one', assignment_id: null, prescribed_meal_id: null, nutrition_date: '2026-10-07', event_type: 'EXTRA', supersedes_event_id: null };
  const voided = { id: 'two', assignment_id: null, prescribed_meal_id: null, nutrition_date: '2026-10-07', event_type: 'VOID', supersedes_event_id: 'one' };
  assert.equal(currentMealDeclaration([extra, voided], null, null, '2026-10-07'), voided);
});

test('MODIFIED deltas preserve untouched Planned items and unknown nutrients', () => {
  const meal = { items: [
    { id: 'a', label: 'A', quantity: 60, unit: 'g', nutrients: null },
    { id: 'b', label: 'B', quantity: null, unit: null, nutrients: null },
  ] };
  const rows = applyNutritionDelta(meal, [
    { operation: 'change_quantity', planned_item_id: 'a', quantity: 80, unit: 'g', energy_kcal: null },
    { operation: 'removed', planned_item_id: 'b' },
    { operation: 'added', label: 'C', quantity: null, unit: null, energy_kcal: null },
  ]);
  assert.deepEqual(rows.map(row => row.kind), ['changed_quantity', 'removed', 'added']);
  assert.equal(rows[0].plannedItem.nutrients, null);
  assert.equal(rows[0].delta.energy_kcal, null);
  assert.equal(rows[2].delta.quantity, null);
});

test('MODIFIED with no delta does not silently become AS_PLANNED', () => {
  assert.deepEqual(applyNutritionDelta({ items: [] }, []), []);
});

test('uncertain client retries reuse the same immutable request envelope', () => {
  const args = { createKey: () => 'request-1', eventType: 'AS_PLANNED', assignmentId: 'assignment', mealId: 'meal', supersedesId: null, items: [], note: null, today: '2026-10-07', timezoneId: 'Europe/Madrid' };
  const first = prepareNutritionLogRequest({ ...args, now: new Date('2026-10-07T22:30:00.000Z') });
  const retry = prepareNutritionLogRequest({ ...args, pending: first.pending, createKey: () => 'request-2', now: new Date('2026-10-08T00:10:00.000Z') });
  assert.equal(retry.request.request_key, 'request-1');
  assert.equal(retry.request.occurred_at, first.request.occurred_at);
  assert.equal(retry.request.nutrition_date, '2026-10-08');
});

test('changed declaration gets a fresh key and never reuses incompatible pending input', () => {
  const first = prepareNutritionLogRequest({ createKey: () => 'request-a', eventType: 'AS_PLANNED', assignmentId: 'assignment', mealId: 'meal', supersedesId: null, items: [], note: null, today: '2026-10-07', timezoneId: 'UTC', now: new Date('2026-10-07T12:00:00Z') });
  const changed = prepareNutritionLogRequest({ pending: first.pending, createKey: () => 'request-b', eventType: 'SKIPPED', assignmentId: 'assignment', mealId: 'meal', supersedesId: null, items: [], note: null, today: '2026-10-07', timezoneId: 'UTC', now: new Date('2026-10-07T12:01:00Z') });
  assert.equal(changed.request.request_key, 'request-b');
  assert.equal(changed.request.event_type, 'SKIPPED');
});
