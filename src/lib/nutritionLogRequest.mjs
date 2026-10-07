import { nutritionDateForInstant } from './nutritionLogModel.mjs';

/** Retains the exact request envelope for safe retries after an uncertain network outcome. */
export function prepareNutritionLogRequest({ pending, createKey, eventType, assignmentId, mealId, supersedesId, items = [], note = null, today, timezoneId, now = new Date() }) {
  const fingerprint = JSON.stringify({ eventType, assignmentId, mealId, supersedesId, items, note, today });
  const prior = pending?.fingerprint === fingerprint ? pending : null;
  const occurredAt = prior?.occurred_at || now.toISOString();
  const timezone = prior?.timezone_id || timezoneId;
  const nutritionDate = prior?.nutrition_date || nutritionDateForInstant(occurredAt, timezone);
  const request = {
    request_key: prior?.request_key || createKey(),
    event_type: eventType,
    assignment_id: assignmentId,
    prescribed_meal_id: mealId,
    occurred_at: occurredAt,
    timezone_id: timezone,
    nutrition_date: nutritionDate,
    note,
    supersedes_event_id: supersedesId,
    items,
  };
  return {
    request,
    pending: {
      fingerprint,
      request_key: request.request_key,
      occurred_at: occurredAt,
      timezone_id: timezone,
      nutrition_date: nutritionDate,
    },
  };
}
