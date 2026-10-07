function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @typedef {{ set_number: number, state: 'recorded'|'missing'|'extra', planned: { reps: number|null, load: string|null, rir: number|null }|null, performed: (Record<string, any>|null) }} ExecutionSlot */
/** @typedef {{ exercise_id: string, plannedSetCount: number, recordedPlannedSetCount: number, extraSetCount: number, missingRecordCount: number, slots: ExecutionSlot[] }} ExerciseExecutionMetrics */
/** @typedef {{ sessionStatus: 'in_progress'|'finished', plannedSetCount: number, recordedPlannedSetCount: number, extraSetCount: number, missingRecordCount: number, exercises: ExerciseExecutionMetrics[] }} DayExecutionMetrics */

/** Canonical on-read counts for one historical prescribed day and its persisted results. */
/** @param {any} day @param {any[]} [results] @param {string|null} [completedAt] @returns {DayExecutionMetrics} */
export function deriveDayExecutionMetrics(day, results = [], completedAt = null) {
  if (!isRecord(day) || !Array.isArray(day.exercises) || !Array.isArray(results)) {
    throw new Error('No se puede derivar el registro de una sesión incompleta.');
  }

  const exercisesById = new Map();
  for (const exercise of day.exercises) {
    const targetSets = exercise?.target_sets ?? exercise?.sets;
    if (!isRecord(exercise) || typeof exercise.id !== 'string'
      || !Number.isInteger(targetSets) || targetSets < 0 || exercisesById.has(exercise.id)) {
      throw new Error('La prescripción contiene un ejercicio o número de series inválido.');
    }
    exercisesById.set(exercise.id, { exercise, targetSets });
  }

  const resultsByExercise = new Map();
  const seenSlots = new Set();
  for (const result of results) {
    if (!isRecord(result) || typeof result.exercise_id !== 'string'
      || !Number.isInteger(result.set_number) || result.set_number < 1
      || !exercisesById.has(result.exercise_id)) {
      throw new Error('Un resultado no corresponde a un slot válido del día histórico.');
    }
    const key = `${result.exercise_id}:${result.set_number}`;
    if (seenSlots.has(key)) throw new Error('Hay más de un resultado para el mismo slot.');
    seenSlots.add(key);
    const exerciseResults = resultsByExercise.get(result.exercise_id) || [];
    exerciseResults.push(result);
    resultsByExercise.set(result.exercise_id, exerciseResults);
  }

  let plannedSetCount = 0;
  let recordedPlannedSetCount = 0;
  let extraSetCount = 0;
  const exerciseMetrics = day.exercises.map(exercise => {
    const targetSets = exercisesById.get(exercise.id).targetSets;
    const exerciseResults = (resultsByExercise.get(exercise.id) || []).slice().sort((a, b) => a.set_number - b.set_number);
    const bySet = new Map(exerciseResults.map(result => [result.set_number, result]));
    const exerciseExtras = exerciseResults.filter(result => result.set_number > targetSets).length;
    const exerciseRecorded = exerciseResults.filter(result => result.set_number <= targetSets).length;
    plannedSetCount += targetSets;
    recordedPlannedSetCount += exerciseRecorded;
    extraSetCount += exerciseExtras;
    const maxSet = Math.max(targetSets, ...exerciseResults.map(result => result.set_number), 0);
    const slots = Array.from({ length: maxSet }, (_, index) => {
      const setNumber = index + 1;
      const result = bySet.get(setNumber) || null;
      const planned = setNumber <= targetSets ? {
        reps: exercise.target_reps ?? exercise.reps ?? null,
        load: exercise.target_load ?? exercise.weight ?? null,
        rir: exercise.target_rir ?? exercise.rir ?? null,
      } : null;
      return {
        set_number: setNumber,
        state: planned ? (result ? 'recorded' : 'missing') : 'extra',
        planned,
        performed: result,
      };
    });
    return {
      exercise_id: exercise.id,
      plannedSetCount: targetSets,
      recordedPlannedSetCount: exerciseRecorded,
      extraSetCount: exerciseExtras,
      missingRecordCount: targetSets - exerciseRecorded,
      slots,
    };
  });

  return {
    sessionStatus: completedAt == null ? 'in_progress' : 'finished',
    plannedSetCount,
    recordedPlannedSetCount,
    extraSetCount,
    missingRecordCount: plannedSetCount - recordedPlannedSetCount,
    exercises: exerciseMetrics,
  };
}

/** Returns raw recent exposures for the same exercise identity within the same program. */
/** @param {any[]} history @param {any} currentEntry @param {string} exerciseId @param {number} [limit] */
export function deriveRecentExerciseExposures(history, currentEntry, exerciseId, limit = 3) {
  if (!Array.isArray(history) || !currentEntry?.programVersion?.program_id || !exerciseId
    || !Number.isInteger(limit) || limit < 1) return [];

  const currentExercise = currentEntry.day?.exercises?.find(exercise => exercise.id === exerciseId);
  if (!currentExercise) return [];
  const currentTime = Date.parse(currentEntry.session.started_at);
  if (!Number.isFinite(currentTime)) return [];

  return history
    .filter(entry => entry.programVersion?.program_id === currentEntry.programVersion.program_id
      && Date.parse(entry.session.started_at) <= currentTime
      && entry.day.exercises.some(exercise => exercise.id === exerciseId && exercise.name === currentExercise.name))
    .map(entry => {
      const exercise = entry.day.exercises.find(item => item.id === exerciseId);
      const results = entry.results.filter(result => result.exercise_id === exerciseId)
        .slice().sort((a, b) => a.set_number - b.set_number);
      return results.length ? {
        sessionId: entry.session.id,
        startedAt: entry.session.started_at,
        versionNumber: entry.programVersion.version_number,
        exerciseName: exercise.name,
        recordedSetCount: results.length,
        results,
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, limit);
}

/** Field comparisons only where the performed measurements share a real compatible type. */
/** @param {any[]} previousResults @param {any[]} currentResults */
export function compareExerciseExposureSets(previousResults, currentResults) {
  const previousBySet = new Map(previousResults.map(result => [result.set_number, result]));
  return currentResults.map(current => {
    const previous = previousBySet.get(current.set_number);
    if (!previous) return { set_number: current.set_number, reps: null, duration: null, rir: null, load: null };
    const sameExternalLoadKind = previous.load_kind === current.load_kind
      && (current.load_kind === 'external_kg' || current.load_kind === 'external_kg_per_dumbbell')
      && previous.load_kg != null && current.load_kg != null;
    return {
      set_number: current.set_number,
      reps: previous.reps_performed != null && current.reps_performed != null
        ? { previous: previous.reps_performed, current: current.reps_performed } : null,
      duration: previous.duration_seconds != null && current.duration_seconds != null
        ? { previous: previous.duration_seconds, current: current.duration_seconds } : null,
      rir: previous.rir_performed != null && current.rir_performed != null
        ? { previous: previous.rir_performed, current: current.rir_performed } : null,
      load: sameExternalLoadKind
        ? { kind: current.load_kind, previous: previous.load_kg, current: current.load_kg } : null,
    };
  });
}
