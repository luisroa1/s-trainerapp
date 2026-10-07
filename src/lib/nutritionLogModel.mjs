export function nutritionDateForInstant(instant, timezoneId) {
  const value = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(value.getTime())) throw new Error('Invalid occurrence time');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${part.year}-${part.month}-${part.day}`;
}

export function currentMealDeclaration(events, assignmentId, mealId, nutritionDate) {
  const chain = events.filter(event => event.assignment_id === assignmentId
    && event.prescribed_meal_id === mealId && event.nutrition_date === nutritionDate);
  const supersededIds = new Set(chain.map(event => event.supersedes_event_id).filter(Boolean));
  const heads = chain.filter(event => !supersededIds.has(event.id));
  if (heads.length > 1) throw new Error('Nutrition declaration chain has multiple current heads');
  return heads[0] || null;
}

export function applyNutritionDelta(meal, deltaItems = []) {
  const byPlannedItem = new Map(deltaItems.filter(item => item.planned_item_id)
    .map(item => [item.planned_item_id, item]));
  const planned = meal.items.map(item => {
    const delta = byPlannedItem.get(item.id);
    if (!delta) return { kind: 'planned', item };
    byPlannedItem.delete(item.id);
    if (delta.operation === 'removed') return { kind: 'removed', plannedItem: item, delta };
    if (delta.operation === 'substituted') return { kind: 'substituted', plannedItem: item, delta };
    if (delta.operation === 'change_quantity') return { kind: 'changed_quantity', plannedItem: item, delta };
    throw new Error('Unsupported delta for a Planned item');
  });
  const added = deltaItems.filter(item => item.operation === 'added').map(delta => ({ kind: 'added', delta }));
  if (byPlannedItem.size > 0) throw new Error('Delta refers to an item outside the historical meal');
  return [...planned, ...added];
}

export function nutritionDeclarationLabel(eventType) {
  return ({
    AS_PLANNED: 'Declaró hecho según el plan',
    MODIFIED: 'Declaró cambios',
    SKIPPED: 'Declaró que no la hizo',
    EXTRA: 'Declaró algo extra',
    VOID: 'Declaración extra anulada',
  })[eventType] || 'Declaración desconocida';
}
