function oneRelation(value, label) {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new Error(`La relación ${label} no es inequívoca.`);
    return value[0];
  }
  return value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Builds a Trainer read model only from persisted sessions/results and their immutable snapshot. */
export function buildTrainerWorkoutHistory(sessionRows, resultRows, clientId) {
  if (!Array.isArray(sessionRows) || !Array.isArray(resultRows) || !clientId) {
    throw new Error('La respuesta del historial de entrenamiento no es válida.');
  }

  const resultsBySession = new Map();
  for (const result of resultRows) {
    if (!isRecord(result) || typeof result.workout_session_id !== 'string'
      || typeof result.exercise_id !== 'string' || !Number.isInteger(result.set_number) || result.set_number < 1) {
      throw new Error('Supabase devolvió un resultado de serie incompleto.');
    }
    const rows = resultsBySession.get(result.workout_session_id) || [];
    rows.push(result);
    resultsBySession.set(result.workout_session_id, rows);
  }

  const seenSessionIds = new Set();
  const model = sessionRows.map(row => {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.client_program_assignment_id !== 'string'
      || typeof row.program_day_id !== 'string' || typeof row.started_at !== 'string'
      || !Number.isFinite(Date.parse(row.started_at))
      || (row.completed_at !== null && row.completed_at !== undefined
        && (typeof row.completed_at !== 'string' || !Number.isFinite(Date.parse(row.completed_at))))) {
      throw new Error('Supabase devolvió una sesión incompleta.');
    }
    if (seenSessionIds.has(row.id)) throw new Error('Supabase devolvió una sesión duplicada.');
    seenSessionIds.add(row.id);

    const assignment = oneRelation(row.assignment, 'assignment');
    const version = oneRelation(assignment?.program_version, 'program_version');
    if (!assignment?.id || assignment.id !== row.client_program_assignment_id
      || assignment.client_id !== clientId || !assignment.program_version_id
      || version?.id !== assignment.program_version_id || !version.program_id
      || !Number.isInteger(version.version_number)) {
      throw new Error('No se pudo resolver la asignación y versión histórica de la sesión.');
    }

    const snapshot = version.snapshot;
    if (!isRecord(snapshot) || snapshot.schema_version !== 1 || !Array.isArray(snapshot.days)) {
      throw new Error('El snapshot histórico no tiene una estructura compatible.');
    }
    const matchingDays = snapshot.days.filter(day => day?.id === row.program_day_id);
    if (matchingDays.length !== 1) throw new Error('El día de la sesión no existe de forma inequívoca en su snapshot.');
    const day = matchingDays[0];
    if (typeof day.title !== 'string' || !Array.isArray(day.exercises)) {
      throw new Error('El día histórico no contiene una prescripción válida.');
    }

    const exerciseIds = new Set();
    const exercises = day.exercises.map(exercise => {
      if (!isRecord(exercise) || typeof exercise.id !== 'string' || typeof exercise.name !== 'string'
        || !Number.isInteger(exercise.order) || !Number.isInteger(exercise.target_sets) || exercise.target_sets < 0
        || (exercise.target_reps !== null && exercise.target_reps !== undefined && !Number.isFinite(exercise.target_reps))) {
        throw new Error('El snapshot contiene un ejercicio incompleto.');
      }
      if (exerciseIds.has(exercise.id)) throw new Error('El snapshot contiene IDs de ejercicio duplicados.');
      exerciseIds.add(exercise.id);
      return exercise;
    }).sort((a, b) => a.order - b.order);

    const sessionResults = resultsBySession.get(row.id) || [];
    const seenSetKeys = new Set();
    for (const result of sessionResults) {
      if (result.workout_session_id !== row.id || !exerciseIds.has(result.exercise_id)) {
        throw new Error('Un resultado no corresponde al día de su snapshot histórico.');
      }
      const key = `${result.exercise_id}:${result.set_number}`;
      if (seenSetKeys.has(key)) throw new Error('Hay resultados duplicados para una serie.');
      seenSetKeys.add(key);
    }
    if (sessionResults.some(result => (result.reps_performed == null) === (result.duration_seconds == null))) {
      throw new Error('Un resultado no identifica de forma inequívoca reps o duración.');
    }

    return {
      session: {
        id: row.id,
        client_program_assignment_id: row.client_program_assignment_id,
        program_day_id: row.program_day_id,
        started_at: row.started_at,
        completed_at: row.completed_at ?? null,
      },
      assignment: {
        id: assignment.id,
        client_id: assignment.client_id,
        program_version_id: assignment.program_version_id,
        assigned_at: assignment.assigned_at,
        ended_at: assignment.ended_at ?? null,
      },
      programVersion: {
        id: version.id,
        program_id: version.program_id,
        version_number: version.version_number,
      },
      day: { ...day, exercises },
      results: sessionResults.slice().sort((a, b) => a.exercise_id.localeCompare(b.exercise_id) || a.set_number - b.set_number),
    };
  });

  const knownSessionIds = new Set(model.map(item => item.session.id));
  if (resultRows.some(result => !knownSessionIds.has(result.workout_session_id))) {
    throw new Error('Se recibió un resultado sin una sesión del cliente consultado.');
  }
  return model.sort((a, b) => Date.parse(b.session.started_at) - Date.parse(a.session.started_at));
}

/** Creates display rows without deriving performed values from prescribed targets. */
export function plannedPerformedRows(sessionEntry, exerciseId) {
  const exercise = sessionEntry?.day?.exercises?.find(item => item.id === exerciseId);
  if (!exercise) throw new Error('El ejercicio no pertenece a la sesión histórica.');
  const results = sessionEntry.results.filter(item => item.exercise_id === exerciseId);
  const bySet = new Map(results.map(item => [item.set_number, item]));
  const maxSet = Math.max(exercise.target_sets, ...results.map(item => item.set_number), 0);
  return Array.from({ length: maxSet }, (_, index) => {
    const setNumber = index + 1;
    return {
      set_number: setNumber,
      planned: setNumber <= exercise.target_sets ? {
        reps: exercise.target_reps ?? null,
        load: exercise.target_load ?? null,
        rir: exercise.target_rir ?? null,
      } : null,
      performed: bySet.get(setNumber) || null,
    };
  });
}

export function formatPerformedMeasure(result) {
  if (result?.reps_performed !== null && result?.reps_performed !== undefined) return `${result.reps_performed} reps`;
  if (result?.duration_seconds !== null && result?.duration_seconds !== undefined) return `${result.duration_seconds} s`;
  return 'Sin dato';
}

export function formatPerformedLoad(result) {
  if (!result || result.load_kind === null) return 'Sin dato';
  if (result.load_kind === 'bodyweight') return 'Peso corporal';
  if (result.load_kind === 'none') return 'Sin carga';
  if (result.load_kind === 'external_kg') return result.load_kg === null ? 'Sin dato' : `${result.load_kg} kg`;
  if (result.load_kind === 'external_kg_per_dumbbell') return result.load_kg === null ? 'Sin dato' : `${result.load_kg} kg/mancuerna`;
  return 'Sin dato';
}
