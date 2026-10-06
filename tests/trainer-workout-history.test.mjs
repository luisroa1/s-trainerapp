import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrainerWorkoutHistory,
  formatPerformedLoad,
  formatPerformedMeasure,
  plannedPerformedRows,
} from '../src/lib/trainerWorkoutHistory.mjs';

const CLIENT_ID = 'client-a';
const DAY_ID = 'day-v1';
const EXERCISE_ID = 'exercise-v1';

function sessionRow({
  id = 'session-1',
  startedAt = '2026-10-01T10:00:00.000Z',
  completedAt = '2026-10-01T10:30:00.000Z',
  dayId = DAY_ID,
  versionId = 'version-1',
  versionNumber = 1,
  exerciseName = 'Sentadilla',
  targetSets = 2,
  targetReps = 10,
  targetLoad = '80 kg',
  targetRir = 2,
} = {}) {
  return {
    id,
    client_program_assignment_id: `assignment-${versionId}`,
    program_day_id: dayId,
    started_at: startedAt,
    completed_at: completedAt,
    assignment: {
      id: `assignment-${versionId}`,
      client_id: CLIENT_ID,
      program_version_id: versionId,
      assigned_at: '2026-09-01T00:00:00.000Z',
      ended_at: versionNumber === 1 ? '2026-09-20T00:00:00.000Z' : null,
      program_version: {
        id: versionId,
        program_id: 'program-a',
        version_number: versionNumber,
        snapshot: {
          schema_version: 1,
          days: [{
            id: dayId,
            order: 1,
            title: `Día ${versionNumber}`,
            focus_area: 'Pierna',
            exercises: [{
              id: EXERCISE_ID,
              order: 1,
              name: exerciseName,
              target_sets: targetSets,
              target_reps: targetReps,
              target_load: targetLoad,
              target_rir: targetRir,
              instructions: 'Controla el descenso.',
            }],
          }],
        },
      },
    },
  };
}

function result(overrides = {}) {
  return {
    id: 'result-1',
    workout_session_id: 'session-1',
    exercise_id: EXERCISE_ID,
    set_number: 1,
    reps_performed: 9,
    duration_seconds: null,
    load_kind: 'external_kg',
    load_kg: 77.5,
    rir_performed: 1,
    note: null,
    created_at: '2026-10-01T10:10:00.000Z',
    updated_at: '2026-10-01T10:10:00.000Z',
    ...overrides,
  };
}

function model(rows = [sessionRow()], results = [result()]) {
  return buildTrainerWorkoutHistory(rows, results, CLIENT_ID);
}

test('maps a completed session from its persisted historical snapshot and set result', () => {
  const [entry] = model();
  assert.equal(entry.session.completed_at, '2026-10-01T10:30:00.000Z');
  assert.equal(entry.day.title, 'Día 1');
  assert.equal(entry.day.exercises[0].name, 'Sentadilla');
  assert.equal(entry.results[0].reps_performed, 9);
  assert.equal(entry.results[0].load_kg, 77.5);
});

test('keeps an open session distinguishable from a completed session', () => {
  const [entry] = model([sessionRow({ completedAt: null })], []);
  assert.equal(entry.session.completed_at, null);
});

test('represents partial execution and planned sets with no result as Sin registro', () => {
  const [entry] = model([sessionRow({ targetSets: 3 })], [result()]);
  const rows = plannedPerformedRows(entry, EXERCISE_ID);
  assert.equal(rows.length, 3);
  assert.ok(rows[0].performed);
  assert.equal(rows[1].performed, null);
  assert.equal(rows[2].performed, null);
  assert.equal(rows[1].planned.reps, 10);
});

test('does not copy planned target values into missing performed values', () => {
  const [entry] = model([sessionRow()], [result({ load_kind: null, load_kg: null, rir_performed: null })]);
  const [row] = plannedPerformedRows(entry, EXERCISE_ID);
  assert.equal(row.planned.load, '80 kg');
  assert.equal(row.performed.load_kg, null);
  assert.equal(row.performed.rir_performed, null);
  assert.equal(formatPerformedLoad(row.performed), 'Sin dato');
  assert.notEqual(row.performed.load_kg, 0);
});

test('formats explicit bodyweight separately from numeric external loads', () => {
  assert.equal(formatPerformedLoad(result({ load_kind: 'bodyweight', load_kg: null })), 'Peso corporal');
  assert.equal(formatPerformedLoad(result({ load_kind: 'external_kg', load_kg: 77.5 })), '77.5 kg');
  assert.equal(formatPerformedLoad(result({ load_kind: 'external_kg_per_dumbbell', load_kg: 20 })), '20 kg/mancuerna');
  assert.equal(formatPerformedLoad(result({ load_kind: 'none', load_kg: null })), 'Sin carga');
});

test('reads performed duration without inferring a duration target from free text', () => {
  const [entry] = model(
    [sessionRow({ targetReps: 45, targetLoad: 'Tiempo (s)' })],
    [result({ reps_performed: null, duration_seconds: 52, load_kind: 'none', load_kg: null })],
  );
  const [row] = plannedPerformedRows(entry, EXERCISE_ID);
  assert.equal(row.planned.reps, 45);
  assert.equal(row.planned.load, 'Tiempo (s)');
  assert.equal(row.performed.duration_seconds, 52);
  assert.equal(formatPerformedMeasure(row.performed), '52 s');
});

test('preserves the exact snapshot for an ended historical assignment', () => {
  const rows = [
    sessionRow({ id: 'session-v2', versionId: 'version-2', versionNumber: 2, exerciseName: 'Sentadilla nueva', startedAt: '2026-10-02T10:00:00Z' }),
    sessionRow({ id: 'session-v1', versionId: 'version-1', versionNumber: 1, exerciseName: 'Sentadilla antigua' }),
  ];
  const history = model(rows, []);
  assert.equal(history[1].assignment.ended_at, '2026-09-20T00:00:00.000Z');
  assert.equal(history[1].programVersion.id, 'version-1');
  assert.equal(history[1].day.exercises[0].name, 'Sentadilla antigua');
});

test('later mutable program state cannot alter Planned because it is not an input', () => {
  const currentMutableProgram = { days: [{ title: 'Programa editado después' }] };
  const [entry] = model();
  assert.equal(entry.day.exercises[0].name, 'Sentadilla');
  assert.ok(currentMutableProgram);
});

test('fails closed if the snapshot day is absent or ambiguous', () => {
  const row = sessionRow();
  row.assignment.program_version.snapshot.days = [];
  assert.throws(() => model([row], []), /día de la sesión/);
  const duplicate = sessionRow();
  duplicate.assignment.program_version.snapshot.days.push(duplicate.assignment.program_version.snapshot.days[0]);
  assert.throws(() => model([duplicate], []), /día de la sesión/);
});

test('fails closed if a result exercise is not in the historical day', () => {
  assert.throws(() => model([sessionRow()], [result({ exercise_id: 'exercise-from-another-day' })]), /no corresponde al día/);
});

test('fails closed if the snapshot contains an incomplete exercise', () => {
  const row = sessionRow();
  row.assignment.program_version.snapshot.days[0].exercises[0].id = undefined;
  assert.throws(() => model([row], []), /ejercicio incompleto/);
});

test('fails closed if returned result rows have no matching session', () => {
  assert.throws(() => model([sessionRow()], [result({ workout_session_id: 'other-session' })]), /sin una sesión/);
});

test('fails closed if the joined assignment does not match the session foreign key', () => {
  const row = sessionRow();
  row.assignment.id = 'different-assignment';
  assert.throws(() => model([row], []), /asignación y versión histórica/);
});
