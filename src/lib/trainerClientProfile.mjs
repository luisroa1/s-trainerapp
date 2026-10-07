const NO_INDICADO = 'No indicado';

const ACTIVITY = {
  mostly_seated: 'Paso gran parte del día sentado',
  frequent_light_movement: 'Me muevo con frecuencia, sin demasiado esfuerzo físico',
  mostly_standing_or_walking: 'Paso buena parte del día de pie o caminando',
  physically_demanding: 'Mi día requiere bastante esfuerzo físico',
  varies: 'Depende mucho del día',
};

const STEPS = {
  unknown: 'No lo sé',
  under_4000: 'Menos de 4.000 pasos',
  '4000_8000': '4.000–8.000 pasos',
  '8000_12000': '8.000–12.000 pasos',
  over_12000: 'Más de 12.000 pasos',
};

const TRAINING_STATUS = {
  never: 'Nunca ha entrenado fuerza',
  previously: 'Ha entrenado antes; ahora no entrena',
  currently: 'Entrena fuerza actualmente',
};

const EXPERIENCE = {
  under_6_months: 'Menos de 6 meses',
  '6_12_months': '6–12 meses',
  '1_3_years': '1–3 años',
  over_3_years: 'Más de 3 años',
};

const TIME_SINCE = {
  under_1_month: 'Menos de 1 mes',
  '1_6_months': '1–6 meses',
  '6_months_2_years': '6 meses–2 años',
  over_2_years: 'Más de 2 años',
};

const GOALS = {
  gain_muscle: 'Ganar músculo',
  lose_fat: 'Perder grasa',
  gain_strength: 'Ganar fuerza',
  health: 'Mejorar la salud',
  performance: 'Mejorar el rendimiento',
  return_to_training: 'Volver a entrenar',
  other: 'Otro',
};

const HEALTH_CATEGORIES = {
  injury_or_discomfort: 'Lesión o molestia',
  medical_condition: 'Enfermedad o condición médica',
  prior_surgery: 'Operación previa',
  other: 'Otra situación',
};

const AVAILABILITY = {
  '1': '1 día/semana',
  '2': '2 días/semana',
  '3': '3 días/semana',
  '4': '4 días/semana',
  '5': '5 días/semana',
  '6_plus': '6 o más días/semana',
};

const LOCATION = {
  gym: 'Gimnasio',
  home: 'Casa',
  both: 'Gimnasio y casa',
  unknown: 'Todavía no lo sabe',
};

const valueOr = (value, labels) => labels?.[value] || NO_INDICADO;
const cleanText = value => typeof value === 'string' && value.trim() ? value.trim() : null;

/** @typedef {[string, string]} ProfileRow */

export function calculateClientAge(dateOfBirth, today = new Date()) {
  if (typeof dateOfBirth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() !== month - 1 || dateCheck.getUTCDate() !== day) return null;
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const age = todayYear - year - (todayMonth < month || (todayMonth === month && todayDay < day) ? 1 : 0);
  return age >= 0 ? age : null;
}

function displayDate(value) {
  const date = cleanText(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NO_INDICADO;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return NO_INDICADO;
  return parsed.toLocaleDateString('es-ES');
}

function goalLabel(goal, otherText) {
  if (!goal) return NO_INDICADO;
  if (goal === 'other') return cleanText(otherText) || GOALS.other;
  return GOALS[goal] || NO_INDICADO;
}

function healthSummary(snapshot) {
  if (snapshot.healthStatus === 'ambiguous') return 'No se pudo determinar de forma segura la declaración vigente.';
  if (snapshot.healthStatus !== 'available' || !snapshot.health) return NO_INDICADO;
  const health = snapshot.health;
  if (health.has_relevant_information === false) return 'El cliente indicó que no tiene información relevante que comunicar.';
  const categories = (health.categories || []).map(category => HEALTH_CATEGORIES[category] || category).join(', ');
  const details = [categories, cleanText(health.body_region), cleanText(health.description)].filter(Boolean).join(' · ');
  const recordedAt = cleanText(health.recorded_at);
  const recordedLabel = recordedAt && Number.isFinite(Date.parse(recordedAt))
    ? ` · Declarado ${new Date(recordedAt).toLocaleString('es-ES')}`
    : '';
  return `Declarado por el cliente: ${details || NO_INDICADO}${recordedLabel}`;
}

/**
 * @param {any} snapshot
 * @param {string} clientName
 * @param {Date} today
 * @returns {{ personal: ProfileRow[], goals: ProfileRow[], activity: ProfileRow[], experience: ProfileRow[], availability: ProfileRow[], health: string }}
 */
export function buildTrainerClientProfile(snapshot = {}, clientName = '', today = new Date()) {
  const profile = snapshot.profile || {};
  const training = snapshot.training || {};
  const weight = snapshot.latestWeight || {};
  const goal = snapshot.goal || {};
  const sex = {
    male: 'Hombre',
    female: 'Mujer',
    not_provided: 'Prefirió no indicarlo',
  }[profile.physiological_sex] || NO_INDICADO;
  const age = calculateClientAge(profile.date_of_birth, today);
  const height = Number.isFinite(Number(profile.height_cm)) && profile.height_cm !== null && profile.height_cm !== undefined
    ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(Number(profile.height_cm))} cm`
    : NO_INDICADO;
  const weightKg = Number.isFinite(Number(weight.weight_kg)) && weight.weight_kg !== null && weight.weight_kg !== undefined
    ? `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(Number(weight.weight_kg))} kg`
    : NO_INDICADO;
  const experience = training.strength_training_status === 'never'
    ? 'No aplica (no ha entrenado fuerza)'
    : valueOr(training.experience_band, EXPERIENCE);
  const timeSince = training.strength_training_status === 'previously'
    ? valueOr(training.time_since_training_band, TIME_SINCE)
    : 'No aplica';
  const secondaryGoals = Array.isArray(goal.secondary_goals) && goal.secondary_goals.length
    ? goal.secondary_goals.map(item => goalLabel(item, item === 'other' ? goal.secondary_other_text : null)).join(', ')
    : NO_INDICADO;

  return {
    personal: [
      ['Nombre', cleanText(clientName) || NO_INDICADO],
      ['Nombre preferido', cleanText(profile.preferred_name) || NO_INDICADO],
      ['Edad', age === null ? NO_INDICADO : `${age} años`],
      ['Sexo declarado', sex],
      ['Altura', height],
      ['Último peso', weightKg],
      ['Fecha del peso', displayDate(weight.measured_on)],
    ],
    goals: [
      ['Principal', goalLabel(goal.primary_goal, goal.primary_other_text)],
      ['Secundarios', secondaryGoals],
    ],
    activity: [
      ['Patrón de actividad', valueOr(training.daily_activity_pattern, ACTIVITY)],
      ['Pasos aproximados', valueOr(training.daily_steps_band, STEPS)],
    ],
    experience: [
      ['Estado', valueOr(training.strength_training_status, TRAINING_STATUS)],
      ['Experiencia acumulada', experience],
      ['Tiempo sin entrenar', timeSince],
    ],
    availability: [
      ['Días semanales', valueOr(training.availability_days, AVAILABILITY)],
      ['Lugar de entrenamiento', valueOr(training.training_location, LOCATION)],
    ],
    health: healthSummary(snapshot),
  };
}
