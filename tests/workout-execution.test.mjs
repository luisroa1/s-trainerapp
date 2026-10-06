import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workoutSessionFromRpc } from '../src/lib/workoutExecution.mjs';

const baseSession = {
  id: 'session-1',
  client_program_assignment_id: 'assignment-1',
  program_day_id: 'day-1',
  started_at: '2026-10-06T10:00:00Z',
  completed_at: null,
};

test('maps persisted session payload to its exact snapshot day and performed results', () => {
  const result = {
    id: 'result-1',
    workout_session_id: 'session-1',
    exercise_id: 'exercise-1',
    set_number: 1,
    reps_performed: 7,
    duration_seconds: null,
    load_kind: null,
    load_kg: null,
    rir_performed: null,
    note: null,
    created_at: '2026-10-06T10:02:00Z',
    updated_at: '2026-10-06T10:02:00Z',
  };
  const mapped = workoutSessionFromRpc({
    session: baseSession,
    program_version_id: 'version-1',
    day: { id: 'day-1', order: 2, title: 'Tirón', exercises: [{
      id: 'exercise-1', order: 1, name: 'Remo', target_sets: 3,
      target_reps: 8, target_load: '80 kg', target_rir: 2, rest_seconds: 90,
    }] },
    results: [result],
    recovered: true,
  });

  assert.equal(mapped.session.id, 'session-1');
  assert.equal(mapped.program_version_id, 'version-1');
  assert.equal(mapped.day.id, 'day-1');
  assert.equal(mapped.day.exercises[0].id, 'exercise-1');
  assert.equal(mapped.day.exercises[0].weight, '80 kg');
  assert.equal(mapped.results[0], result);
  assert.equal(mapped.recovered, true);
  assert.equal('reps_performed' in mapped.day.exercises[0], false);
});

test('preserves a legitimately empty prescription day without inventing exercises', () => {
  const mapped = workoutSessionFromRpc({
    session: { ...baseSession, program_day_id: 'day-empty' },
    program_version_id: 'version-empty',
    day: { id: 'day-empty', order: 1, title: 'Día vacío', exercises: [] },
    results: [],
    recovered: false,
  });

  assert.equal(mapped.day.id, 'day-empty');
  assert.deepEqual(mapped.day.exercises, []);
  assert.deepEqual(mapped.results, []);
});

test('rejects incomplete RPC payloads instead of falling back to local or mutable program data', () => {
  assert.equal(workoutSessionFromRpc(null), null);
  assert.equal(workoutSessionFromRpc({ session: baseSession, program_version_id: 'version-1' }), null);
  assert.equal(workoutSessionFromRpc({
    session: baseSession,
    program_version_id: 'version-1',
    day: { id: 'day-1', title: 'Tirón', exercises: [] },
    results: null,
  }), null);
  assert.equal(workoutSessionFromRpc({
    session: baseSession,
    program_version_id: 'version-1',
    day: { id: 'day-1', title: 'Tirón', exercises: [null] },
    results: [],
  }), null);
});

test('Client execution routes only after persisted session confirmation and avoids a blank Entreno route', () => {
  const app = readFileSync(new URL('../src/components/client/ClientApp.tsx', import.meta.url), 'utf8');
  assert.match(app, /const startWorkout = async \(programDayId: string\)[\s\S]*?await supabaseDb\.startWorkoutSession\(programDayId\)[\s\S]*?if \(error \|\| !data\)[\s\S]*?return;[\s\S]*?setCurrentScreen\('workout_exercise'\)/);
  assert.match(app, /if \(workoutSession && !workoutSession\.session\.completed_at\)/);
  assert.match(app, /setActiveTab\('hoy'\);\s*setCurrentScreen\('hoy'\)/);
  assert.match(app, /getOpenWorkoutSession\(\)/);
});

test('performed inputs remain unknown until entered and failed saves preserve the form', () => {
  const workout = readFileSync(new URL('../src/components/client/WorkoutExercise.tsx', import.meta.url), 'utf8');
  assert.match(workout, /const \[repsValue, setRepsValue\] = useState\(''\)/);
  assert.match(workout, /const \[loadValue, setLoadValue\] = useState\(''\)/);
  assert.match(workout, /await supabaseDb\.saveWorkoutSetResult/);
  assert.match(workout, /if \(saveError \|\| !data\)[\s\S]*?Los datos siguen en pantalla/);
  assert.match(workout, /Solo valores realizados/);
  assert.match(workout, /Hay datos de una serie sin guardar/);
});
