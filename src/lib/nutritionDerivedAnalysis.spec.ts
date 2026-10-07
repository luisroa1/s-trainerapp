import test from 'node:test';
import assert from 'node:assert/strict';
import type { NutritionDailyReconstruction, PrescribedMealState, ReconstructedExtra } from './nutritionPlannedLoggedModel';
import { deriveNutritionPeriodAnalysis, nutritionDateRange } from './nutritionDerivedAnalysis';

const prescribed = (state: PrescribedMealState, mealId: string = state): NutritionDailyReconstruction['meals'][number] => ({
  assignmentId: 'assignment', planName: 'Plan', mealId, meal: null, state, declaration: null, items: [],
});
const extra = (id: string): ReconstructedExtra => ({
  event: {
    id, client_id: 'client', assignment_id: null, prescribed_meal_id: null, event_type: 'EXTRA',
    occurred_at: '2026-10-04T12:00:00Z', nutrition_date: '2026-10-04', timezone_id: 'Europe/Madrid',
    recorded_at: '2026-10-04T12:00:00Z', actor_id: 'client-user', actor_kind: 'client_declaration',
    note: null, supersedes_event_id: null, items: [],
  }, items: [],
});
const day = (date: string, states: PrescribedMealState[], options: {
  contextStatus?: NutritionDailyReconstruction['contextStatus'];
  extras?: ReconstructedExtra[];
  issues?: string[];
} = {}): NutritionDailyReconstruction => ({
  nutritionDate: date,
  contextStatus: options.contextStatus || 'known',
  meals: states.map((state, index) => prescribed(state, `${date}-${index}`)),
  extras: options.extras || [],
  issues: options.issues || [],
});
const analyze = (days: NutritionDailyReconstruction[], startDate = '2026-10-01', endDate = '2026-10-01') =>
  deriveNutritionPeriodAnalysis({ startDate, endDate, days });

test('all logged slots give full logging coverage, not an adherence metric', () => {
  const result = analyze([day('2026-10-01', ['AS_PLANNED', 'MODIFIED', 'SKIPPED'])]);
  assert.equal(result.loggingCoverage.numerator, 3);
  assert.equal(result.loggingCoverage.denominator, 3);
  assert.equal(result.loggingCoverage.ratio, 1);
  assert.equal(result.completeness, 'COMPLETE');
  assert.ok(!('adherence' in result));
});

test('UNLOGGED remains in the denominator and not in explicit declarations', () => {
  const result = analyze([day('2026-10-01', ['AS_PLANNED', 'MODIFIED', 'UNLOGGED', 'UNLOGGED'])]);
  assert.deepEqual(result.counts, {
    reconstructablePrescribedMealSlots: 4, explicitDeclarations: 2, unloggedPrescribedMealSlots: 2,
    asPlanned: 1, modified: 1, skipped: 0, effectiveExtras: 0,
  });
  assert.equal(result.loggingCoverage.ratio, 0.5);
});

test('SKIPPED, MODIFIED, and AS_PLANNED each count as explicit declarations', () => {
  const result = analyze([day('2026-10-01', ['SKIPPED', 'MODIFIED', 'AS_PLANNED', 'UNLOGGED'])]);
  assert.equal(result.counts.explicitDeclarations, 3);
  assert.equal(result.counts.skipped, 1);
  assert.equal(result.counts.modified, 1);
  assert.equal(result.counts.asPlanned, 1);
});

test('unavailable historical context is excluded from denominator and marks the period PARTIAL', () => {
  const result = analyze([
    day('2026-10-01', ['AS_PLANNED', 'UNLOGGED']),
    day('2026-10-02', ['HISTORICAL_CONTEXT_UNAVAILABLE'], { contextStatus: 'unavailable' }),
  ], '2026-10-01', '2026-10-02');
  assert.equal(result.counts.reconstructablePrescribedMealSlots, 2);
  assert.equal(result.counts.explicitDeclarations, 1);
  assert.deepEqual(result.unavailableContextDates, ['2026-10-02']);
  assert.equal(result.completeness, 'PARTIAL');
  assert.equal(result.loggingCoverage.availability, 'PARTIAL');
});

test('complete context remains COMPLETE when known meals are UNLOGGED', () => {
  const result = analyze([day('2026-10-01', ['UNLOGGED', 'UNLOGGED'])]);
  assert.equal(result.completeness, 'COMPLETE');
  assert.equal(result.counts.unloggedPrescribedMealSlots, 2);
  assert.equal(result.loggingCoverage.ratio, 0);
});

test('declaration distributions use only explicit declarations and return unavailable when empty', () => {
  const mixed = analyze([day('2026-10-01', ['AS_PLANNED', 'MODIFIED', 'SKIPPED', 'UNLOGGED'])]);
  assert.equal(mixed.declarationDistribution.asPlanned.denominator, 3);
  assert.equal(mixed.declarationDistribution.modified.denominator, 3);
  assert.equal(mixed.declarationDistribution.skipped.denominator, 3);
  assert.equal(mixed.declarationDistribution.skipped.ratio, 1 / 3);
  const empty = analyze([day('2026-10-01', ['UNLOGGED'])]);
  assert.equal(empty.declarationDistribution.asPlanned.ratio, null);
  assert.equal(empty.declarationDistribution.asPlanned.availability, 'INSUFFICIENT_DATA');
});

test('zero reconstructable slots return insufficient data, never a 0% ratio', () => {
  const result = analyze([day('2026-10-01', [], { contextStatus: 'no_assignment' })]);
  assert.equal(result.completeness, 'INSUFFICIENT_DATA');
  assert.equal(result.loggingCoverage.ratio, null);
  assert.equal(result.loggingCoverage.availability, 'INSUFFICIENT_DATA');
});

test('effective extras are independent from prescribed meal denominator; voided extras are absent from 1C input', () => {
  const result = analyze([day('2026-10-01', ['UNLOGGED'], { extras: [extra('x1'), extra('x2')] })]);
  assert.equal(result.counts.effectiveExtras, 2);
  assert.equal(result.counts.reconstructablePrescribedMealSlots, 1);
  const afterVoid = analyze([day('2026-10-01', ['UNLOGGED'], { extras: [] })]);
  assert.equal(afterVoid.counts.effectiveExtras, 0);
});

test('only current reconstructed meal slots count; superseded history is not an analysis input', () => {
  const result = analyze([day('2026-10-01', ['MODIFIED'])]);
  assert.equal(result.counts.explicitDeclarations, 1);
  assert.equal(result.counts.modified, 1);
  assert.ok(!('events' in result));
  assert.ok(!('requestLedger' in result));
});

test('requested range boundaries are inclusive, and missing or duplicate dates make the result partial', () => {
  assert.deepEqual(nutritionDateRange('2026-10-01', '2026-10-03'), ['2026-10-01', '2026-10-02', '2026-10-03']);
  const missing = analyze([day('2026-10-01', ['AS_PLANNED']), day('2026-10-03', ['UNLOGGED'])], '2026-10-01', '2026-10-03');
  assert.deepEqual(missing.unavailableContextDates, ['2026-10-02']);
  assert.equal(missing.completeness, 'PARTIAL');
  const duplicate = analyze([day('2026-10-01', ['AS_PLANNED']), day('2026-10-01', ['SKIPPED'])]);
  assert.equal(duplicate.counts.reconstructablePrescribedMealSlots, 0);
  assert.equal(duplicate.completeness, 'PARTIAL');
});

test('partial context never changes the interpretation into client performance', () => {
  const result = analyze([day('2026-10-01', ['SKIPPED'], { issues: ['read-model issue'] })]);
  assert.equal(result.completeness, 'PARTIAL');
  assert.equal(result.counts.skipped, 1);
  assert.ok(!('compliance' in result));
  assert.ok(!('nutrients' in result));
});

test('invalid date ranges fail closed', () => {
  assert.throws(() => nutritionDateRange('2026-10-03', '2026-10-01'), RangeError);
  assert.throws(() => nutritionDateRange('2026-02-30', '2026-03-01'), RangeError);
});
