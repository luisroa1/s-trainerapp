import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { programDaysFromSnapshot, programFromActiveAssignment } from '../src/lib/clientProgramAssignment.mjs';

const snapshot = {
  schema_version: 1,
  days: [{
    id: 'day-uuid', order: 2, title: 'Día de fuerza', focus_area: 'Pierna',
    exercises: [{
      id: 'exercise-uuid', order: 1, name: 'Sentadilla', muscle_group: 'Pierna',
      target_sets: 4, target_reps: 8, target_load: '60 kg', target_rir: 2,
      rest_seconds: 120, instructions: 'Controla la bajada', video_url: 'https://example.test/video',
    }],
  }],
};

test('Client prescription is mapped exclusively from the immutable assignment snapshot', () => {
  const active = programFromActiveAssignment({
    id: 'assignment-uuid',
    program_version: { id: 'version-uuid', program_id: 'program-uuid', version_number: 3, snapshot },
  });
  assert.equal(active.id, 'program-uuid');
  assert.equal(active.versionId, 'version-uuid');
  assert.equal(active.versionNumber, 3);
  assert.deepEqual(active.days, [{
    id: 'day-uuid', dayNumber: 2, title: 'Día de fuerza', focusArea: 'Pierna',
    exercises: [{
      id: 'exercise-uuid', order: 1, name: 'Sentadilla', muscleGroup: 'Pierna',
      sets: 4, reps: 8, weight: '60 kg', rir: 2, restSeconds: 120,
      trainerTip: 'Controla la bajada', videoUrl: 'https://example.test/video',
    }],
  }]);
});

test('missing assignment or invalid snapshot stays absent; empty prescription stays empty', () => {
  assert.equal(programFromActiveAssignment(null), null);
  assert.equal(programFromActiveAssignment({ program_version: null }), null);
  assert.deepEqual(programDaysFromSnapshot({ schema_version: 1, days: [] }), []);
  assert.deepEqual(programDaysFromSnapshot({ days: 'invalid' }), []);
});

test('Client screens consume the active assignment snapshot and contain no mutable-program fallback', () => {
  const home = readFileSync(new URL('../src/components/client/ClientHome.tsx', import.meta.url), 'utf8');
  const workout = readFileSync(new URL('../src/components/client/WorkoutExercise.tsx', import.meta.url), 'utf8');
  const context = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');

  assert.match(home, /programFromActiveAssignment\(activeProgramAssignment\)/);
  assert.match(workout, /session\.day\.exercises/);
  assert.doesNotMatch(home, /\.from\(['"]programs['"]\)|\.data\?\.days|assignedProgramId|weeklySchedule\./);
  assert.doesNotMatch(workout, /\.from\(['"]programs['"]\)|\.data\?\.days|assignedProgramId|weeklySchedule\./);
  assert.match(context, /getActiveProgramAssignment\(realClient\.id\)/);
  assert.match(context, /authenticatedRole === 'trainer' \? authenticatedUserId/);
  assert.doesNotMatch(context, /if \(!client\.assignedProgramId[\s\S]{0,120}assignedProgramId/);
});

test('assignment RPC is the only frontend assignment writer and requires confirmed persistence', () => {
  const db = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
  const context = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/20261006091957_core1c_client_program_assignments.sql', import.meta.url), 'utf8');

  assert.match(db, /rpc\('apply_program_to_client'/);
  assert.match(db, /Supabase no confirmó la asignación/);
  assert.match(context, /await supabaseDb\.applyProgramToClient\(clientId, programId\)/);
  assert.match(migration, /WHERE a\.client_id = p_client_id AND a\.ended_at IS NULL/);
  assert.match(migration, /v_existing\.program_version_id = v_version\.id/);
  assert.match(migration, /client_program_assignments_one_active_per_client/);
  assert.match(migration, /FOR UPDATE/);
});

test('Trainer can re-apply the same program after an edit; database idempotency decides whether history changes', () => {
  const detail = readFileSync(new URL('../src/components/trainer/TrainerClientDetail.tsx', import.meta.url), 'utf8');
  assert.match(detail, /disabled=\{assignmentStatus !== 'loaded' \|\| isApplying \|\| \(!selectedProgramId && !activeProgramId\)\}/);
  assert.doesNotMatch(detail, /selectedProgramId === activeProgramId/);
  assert.match(detail, /await applyProgramToClient\(client\.id, selectedProgramId \|\| null\)/);
});
