import { programDaysFromSnapshot } from './clientProgramAssignment.mjs';

export function workoutSessionFromRpc(payload) {
  if (!payload || typeof payload !== 'object'
    || !payload.session?.id
    || !payload.program_version_id
    || !payload.day?.id
    || payload.session.program_day_id !== payload.day.id
    || !Array.isArray(payload.day.exercises)
    || !payload.day.exercises.every(exercise => exercise && typeof exercise === 'object' && typeof exercise.id === 'string' && typeof exercise.name === 'string')
    || !Array.isArray(payload.results)
    || !payload.results.every(result => result
      && typeof result === 'object'
      && result.workout_session_id === payload.session.id
      && typeof result.id === 'string'
      && typeof result.exercise_id === 'string'
      && typeof result.set_number === 'number')) {
    return null;
  }

  const days = programDaysFromSnapshot({ schema_version: 1, days: [payload.day] });
  if (!days[0]?.id) return null;

  return {
    session: payload.session,
    program_version_id: payload.program_version_id,
    day: days[0],
    results: payload.results,
    recovered: payload.recovered === true,
  };
}
