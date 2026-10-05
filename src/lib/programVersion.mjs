const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newId() {
  return globalThis.crypto.randomUUID();
}

export function normalizeProgramIds(program, createId = newId) {
  const usedDayIds = new Set();
  const usedExerciseIds = new Set();

  const days = (Array.isArray(program.days) ? program.days : []).map(day => {
    let dayId = day.id;
    if (!UUID_PATTERN.test(dayId || '') || usedDayIds.has(dayId.toLowerCase())) {
      dayId = createId();
    }
    usedDayIds.add(dayId.toLowerCase());

    const exercises = (Array.isArray(day.exercises) ? day.exercises : []).map(exercise => {
      let exerciseId = exercise.id;
      if (!UUID_PATTERN.test(exerciseId || '') || usedExerciseIds.has(exerciseId.toLowerCase())) {
        exerciseId = createId();
      }
      usedExerciseIds.add(exerciseId.toLowerCase());
      return { ...exercise, id: exerciseId };
    });

    return { ...day, id: dayId, exercises };
  });

  return { ...program, days };
}

export function buildProgramPrescriptionSnapshot(program) {
  return {
    schema_version: 1,
    days: (Array.isArray(program.days) ? program.days : []).map((day, dayIndex) => ({
      id: day.id,
      order: dayIndex + 1,
      title: day.title,
      focus_area: day.focusArea || null,
      exercises: (Array.isArray(day.exercises) ? day.exercises : []).map((exercise, exerciseIndex) => ({
        id: exercise.id,
        order: exerciseIndex + 1,
        name: exercise.name,
        muscle_group: exercise.muscleGroup || null,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        target_load: exercise.weight?.trim() || null,
        target_rir: exercise.rir,
        rest_seconds: exercise.restSeconds,
        ...(exercise.trainerTip?.trim() ? { instructions: exercise.trainerTip.trim() } : {}),
        ...(exercise.videoUrl?.trim() ? { video_url: exercise.videoUrl.trim() } : {}),
      })),
    })),
  };
}

export async function saveThenApply(program, saveProgram, applyProgramVersion) {
  const normalized = normalizeProgramIds(program);
  await saveProgram(normalized);
  return applyProgramVersion(normalized.id);
}
