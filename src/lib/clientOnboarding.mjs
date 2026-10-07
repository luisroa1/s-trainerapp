export const CLIENT_ONBOARDING_FLOW_VERSION = 1;

// Captured from the production schema_migrations entry when the 1A persistence
// became available. Existing Client rows before this point are legacy and must
// not be blocked by a missing onboarding-state row.
export const CLIENT_ONBOARDING_ROLLOUT_AT = '2026-10-07T20:10:21Z';

export const CLIENT_ONBOARDING_STEPS = [
  'profile',
  'goal',
  'activity',
  'experience',
  'availability',
  'health',
  'cycle',
  'review',
];

export function resolveClientOnboardingEntry({ createdAt, state }) {
  if (state?.status === 'completed') return { kind: 'completed' };
  if (state?.status === 'in_progress') {
    const step = CLIENT_ONBOARDING_STEPS.includes(state.resume_step) ? state.resume_step : 'profile';
    return { kind: 'in_progress', step };
  }

  const createdAtMs = Date.parse(createdAt || '');
  const rolloutAtMs = Date.parse(CLIENT_ONBOARDING_ROLLOUT_AT);
  if (!Number.isFinite(createdAtMs)) return { kind: 'unresolved' };
  return createdAtMs >= rolloutAtMs
    ? { kind: 'not_started', step: 'welcome' }
    : { kind: 'legacy' };
}

export function greetingForLocalHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 'Hola';
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function clientGreetingName(preferredName, registeredName) {
  const preferred = typeof preferredName === 'string' ? preferredName.trim() : '';
  const registered = typeof registeredName === 'string' ? registeredName.trim() : '';
  const name = preferred || registered;
  return name.split(/\s+/).filter(Boolean)[0] || '';
}

export function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentHealthDeclaration(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const superseded = new Set(rows.map(row => row.supersedes_id).filter(Boolean));
  const heads = rows.filter(row => !superseded.has(row.id));
  return heads.length === 1 ? heads[0] : null;
}

export function sameHealthDeclaration(left, right) {
  if (!left || !right) return false;
  const leftCategories = [...(left.categories || [])].sort();
  const rightCategories = [...(right.categories || [])].sort();
  return left.has_relevant_information === right.has_relevant_information
    && JSON.stringify(leftCategories) === JSON.stringify(rightCategories)
    && (left.body_region || null) === (right.body_region || null)
    && (left.description || null) === (right.description || null);
}

export function onboardingExperienceShape(status, experienceBand, timeSinceBand) {
  if (status === 'never') return { experience_band: null, time_since_training_band: null };
  if (status === 'currently') return { experience_band: experienceBand || null, time_since_training_band: null };
  if (status === 'previously') return {
    experience_band: experienceBand || null,
    time_since_training_band: timeSinceBand || null,
  };
  return { experience_band: null, time_since_training_band: null };
}

export function firstMissingOnboardingStep(snapshot = {}) {
  const profile = snapshot.profile || {};
  const training = snapshot.training || {};
  if (!profile.date_of_birth || !profile.height_cm) return 'profile';
  if (!snapshot.goal?.primary_goal) return 'goal';
  if (!training.daily_activity_pattern || !training.strength_training_status || !training.availability_days || !training.training_location) return !training.daily_activity_pattern ? 'activity' : !training.strength_training_status ? 'experience' : 'availability';
  if (training.strength_training_status !== 'never' && !training.experience_band) return 'experience';
  if (training.strength_training_status === 'previously' && !training.time_since_training_band) return 'experience';
  if (!snapshot.health || typeof snapshot.health.has_relevant_information !== 'boolean') return 'health';
  return null;
}
