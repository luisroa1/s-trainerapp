import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrainerWorkoutHistory,
  compareExerciseExposureSets,
  deriveDayExecutionMetrics,
  deriveRecentExerciseExposures,
  formatPerformedLoad,
} from '../src/lib/trainerWorkoutHistory.mjs';

const day = {
  id: 'day-v1',
  title: 'Día de prueba',
  exercises: [{ id: 'exercise-a', order: 1, name: 'Press', target_sets: 4, target_reps: 8, target_load: '80 kg', target_rir: 2 }],
};
const result = (set_number, overrides = {}) => ({
  id: `result-${set_number}`,
  workout_session_id: 'session-a',
  exercise_id: 'exercise-a',
  set_number,
  reps_performed: 7,
  duration_seconds: null,
  load_kind: 'external_kg',
  load_kg: 77.5,
  rir_performed: 1,
  ...overrides,
});

test('derives 4/4 recorded planned sets and does not convert a rep difference into missing', () => {
  const metrics = deriveDayExecutionMetrics(day, [1, 2, 3, 4].map(n => result(n)), null);
  assert.equal(metrics.recordedPlannedSetCount, 4);
  assert.equal(metrics.plannedSetCount, 4);
  assert.equal(metrics.missingRecordCount, 0);
  assert.equal(metrics.sessionStatus, 'in_progress');
});

test('derives 2/4 and 0/4 without inventing performed values', () => {
  const partial = deriveDayExecutionMetrics(day, [result(1), result(2)], '2026-10-01T12:00:00Z');
  assert.equal(partial.recordedPlannedSetCount, 2);
  assert.equal(partial.missingRecordCount, 2);
  assert.equal(partial.sessionStatus, 'finished');
  assert.equal(partial.exercises[0].slots[2].state, 'missing');
  const empty = deriveDayExecutionMetrics(day, [], null);
  assert.equal(empty.recordedPlannedSetCount, 0);
  assert.equal(empty.missingRecordCount, 4);
});

test('finished 2/4 remains finished; in-progress 4/4 remains in progress', () => {
  assert.equal(deriveDayExecutionMetrics(day, [result(1), result(2)], '2026-10-01T12:00:00Z').sessionStatus, 'finished');
  assert.equal(deriveDayExecutionMetrics(day, [1, 2, 3, 4].map(n => result(n)), null).sessionStatus, 'in_progress');
});

test('counts a set when load and RIR are null and preserves both as unknown', () => {
  const metrics = deriveDayExecutionMetrics(day, [result(1, { load_kind: null, load_kg: null, rir_performed: null })]);
  assert.equal(metrics.recordedPlannedSetCount, 1);
  assert.equal(metrics.exercises[0].slots[0].performed.load_kg, null);
  assert.equal(metrics.exercises[0].slots[0].performed.rir_performed, null);
  assert.notEqual(metrics.exercises[0].slots[0].performed.load_kg, 0);
  assert.equal(formatPerformedLoad(metrics.exercises[0].slots[0].performed), 'Sin dato');
});

test('counts performed duration without manufacturing a structured duration target', () => {
  const durationDay = { ...day, exercises: [{ ...day.exercises[0], target_reps: null }] };
  const metrics = deriveDayExecutionMetrics(durationDay, [result(1, {
    reps_performed: null, duration_seconds: 52, load_kind: 'none', load_kg: null,
  })]);
  assert.equal(metrics.recordedPlannedSetCount, 1);
  assert.equal(metrics.exercises[0].slots[0].planned.reps, null);
  assert.equal(metrics.exercises[0].slots[0].performed.duration_seconds, 52);
  assert.equal(formatPerformedLoad(metrics.exercises[0].slots[0].performed), 'Sin carga');
});

test('keeps extras separately and never lets them increase X/Y', () => {
  const metrics = deriveDayExecutionMetrics(day, [1, 2, 3, 4, 5, 6].map(n => result(n)));
  assert.equal(metrics.recordedPlannedSetCount, 4);
  assert.equal(metrics.plannedSetCount, 4);
  assert.equal(metrics.extraSetCount, 2);
  assert.deepEqual(metrics.exercises[0].slots.slice(-2).map(slot => slot.state), ['extra', 'extra']);
});

test('preserves bodyweight, none, and unknown load as distinct values', () => {
  assert.equal(formatPerformedLoad(result(1, { load_kind: 'bodyweight', load_kg: null })), 'Peso corporal');
  assert.equal(formatPerformedLoad(result(1, { load_kind: 'none', load_kg: null })), 'Sin carga');
  assert.equal(formatPerformedLoad(result(1, { load_kind: null, load_kg: null })), 'Sin dato');
});

function historyRow({ id, startedAt, versionId = 'version-1', versionNumber = 1, programId = 'program-a', exerciseName = 'Press', targetSets = 4 }) {
  return {
    id,
    client_program_assignment_id: `assignment-${versionId}`,
    program_day_id: 'day-v1',
    started_at: startedAt,
    completed_at: null,
    assignment: {
      id: `assignment-${versionId}`,
      client_id: 'client-a',
      program_version_id: versionId,
      assigned_at: startedAt,
      ended_at: null,
      program_version: {
        id: versionId,
        program_id: programId,
        version_number: versionNumber,
        snapshot: { schema_version: 1, days: [{ ...day, exercises: [{ ...day.exercises[0], name: exerciseName, target_sets: targetSets }] }] },
      },
    },
  };
}

test('derives recent exposures for the same exercise identity across versions of one program only', () => {
  const rows = [
    historyRow({ id: 's2', startedAt: '2026-10-02T10:00:00Z', versionId: 'v2', versionNumber: 2 }),
    historyRow({ id: 's1', startedAt: '2026-10-01T10:00:00Z' }),
    historyRow({ id: 's-other-program', startedAt: '2026-09-30T10:00:00Z', programId: 'program-b' }),
  ];
  const results = ['s2', 's1', 's-other-program'].map((sessionId, index) => result(1, {
    id: `result-${sessionId}`, workout_session_id: sessionId, reps_performed: 8 + index,
  }));
  const history = buildTrainerWorkoutHistory(rows, results, 'client-a');
  const current = history.find(entry => entry.session.id === 's2');
  const exposures = deriveRecentExerciseExposures(history, current, 'exercise-a');
  assert.deepEqual(exposures.map(item => item.sessionId), ['s2', 's1']);
  assert.equal(exposures[0].versionNumber, 2);
  assert.equal(exposures[0].recordedSetCount, 1);
  assert.equal(current.day.exercises[0].recentExposures.length, 2);
});

test('does not compare external loads across incompatible load kinds or units', () => {
  const old = result(1, { load_kind: 'external_kg', load_kg: 20 });
  const perDumbbell = result(1, { load_kind: 'external_kg_per_dumbbell', load_kg: 20 });
  const bodyweight = result(1, { load_kind: 'bodyweight', load_kg: null });
  assert.equal(compareExerciseExposureSets([old], [perDumbbell])[0].load, null);
  assert.equal(compareExerciseExposureSets([old], [bodyweight])[0].load, null);
  assert.deepEqual(compareExerciseExposureSets([old], [result(1, { load_kind: 'external_kg', load_kg: 22.5 })])[0].load,
    { kind: 'external_kg', previous: 20, current: 22.5 });
});

test('insufficient exposures and an empty history produce no trend', () => {
  assert.deepEqual(deriveRecentExerciseExposures([], {}, 'exercise-a'), []);
  const rows = [historyRow({ id: 'single', startedAt: '2026-10-01T10:00:00Z' })];
  const history = buildTrainerWorkoutHistory(rows, [], 'client-a');
  assert.deepEqual(deriveRecentExerciseExposures(history, history[0], 'exercise-a'), []);
  assert.deepEqual(buildTrainerWorkoutHistory([], [], 'client-a'), []);
});

test('derivation depends only on the historical day and execution rows, not legacy schedule or mutable programs', () => {
  const mutableProgram = { days: [{ id: 'day-v1', title: 'Changed afterwards' }] };
  const legacyClient = { weeklySchedule: [{ status: 'completed' }] };
  const metrics = deriveDayExecutionMetrics(day, [result(1)], null);
  assert.equal(metrics.plannedSetCount, 4);
  assert.equal(metrics.recordedPlannedSetCount, 1);
  assert.ok(mutableProgram && legacyClient);
  assert.equal('adherencePercentage' in metrics, false);
  assert.equal('percentage' in metrics, false);
});

test('exposure comparisons omit unknown values rather than treating them as zero', () => {
  const comparisons = compareExerciseExposureSets(
    [result(1, { reps_performed: 8, rir_performed: null, load_kg: null })],
    [result(1, { reps_performed: 9, rir_performed: 1, load_kg: null })],
  );
  assert.deepEqual(comparisons[0].reps, { previous: 8, current: 9 });
  assert.equal(comparisons[0].rir, null);
  assert.equal(comparisons[0].load, null);
});
