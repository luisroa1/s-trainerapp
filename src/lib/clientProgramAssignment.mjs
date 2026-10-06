export function programDaysFromSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.days)) return [];

  return snapshot.days.map((day, dayIndex) => ({
    id: day.id,
    dayNumber: day.order ?? dayIndex + 1,
    title: day.title || `Día ${day.order ?? dayIndex + 1}`,
    focusArea: day.focus_area || '',
    exercises: (Array.isArray(day.exercises) ? day.exercises : []).map((exercise, exerciseIndex) => ({
      id: exercise.id,
      order: exercise.order ?? exerciseIndex + 1,
      name: exercise.name,
      muscleGroup: exercise.muscle_group || '',
      sets: exercise.target_sets,
      reps: exercise.target_reps,
      weight: exercise.target_load || '',
      rir: exercise.target_rir,
      restSeconds: exercise.rest_seconds,
      trainerTip: exercise.instructions || undefined,
      videoUrl: exercise.video_url || undefined,
    })),
  }));
}

export function programFromActiveAssignment(assignment) {
  const version = assignment?.program_version;
  if (!version?.id || !version.snapshot || !Array.isArray(version.snapshot.days)) return null;
  return {
    id: version.program_id,
    versionId: version.id,
    versionNumber: version.version_number,
    days: programDaysFromSnapshot(version.snapshot),
  };
}
