import type {
  NutritionLogEvent,
  NutritionLogEventItem,
  NutritionAssignmentContext,
  NutritionMealSnapshot,
  NutritionPlanSnapshot,
} from '../types';

export type PrescribedMealState = 'AS_PLANNED' | 'MODIFIED' | 'SKIPPED' | 'UNLOGGED' | 'HISTORICAL_CONTEXT_UNAVAILABLE';
export type ReconstructedItemKind = 'unchanged' | 'quantity_changed' | 'removed' | 'substituted' | 'added';

export interface ReconstructedItem {
  kind: ReconstructedItemKind;
  planned: NutritionMealSnapshot['items'][number] | null;
  logged: NutritionLogEventItem | null;
  quantityDifference: number | null;
}

export interface ReconstructedMeal {
  assignmentId: string | null;
  planName: string | null;
  mealId: string | null;
  meal: NutritionMealSnapshot | null;
  state: PrescribedMealState;
  declaration: NutritionLogEvent | null;
  items: ReconstructedItem[];
}

export interface ReconstructedExtra {
  event: NutritionLogEvent;
  items: NutritionLogEventItem[];
}

export interface NutritionDailyReconstruction {
  nutritionDate: string;
  contextStatus: 'known' | 'unavailable' | 'no_assignment';
  meals: ReconstructedMeal[];
  extras: ReconstructedExtra[];
  issues: string[];
}

const isPrescribed = (event: NutritionLogEvent) => event.assignment_id !== null && event.prescribed_meal_id !== null;
const isExtra = (event: NutritionLogEvent) => event.assignment_id === null && event.prescribed_meal_id === null
  && (event.event_type === 'EXTRA' || event.event_type === 'VOID');
const prescribedKey = (event: NutritionLogEvent) => `${event.client_id}|${event.assignment_id}|${event.prescribed_meal_id}|${event.nutrition_date}`;

function assignmentForDate(assignments: NutritionAssignmentContext[], nutritionDate: string, historical: boolean) {
  // Without a stored timezone for an event-free historical date, a local day can
  // span UTC boundaries. Only select an assignment covering every possible IANA
  // local-day instant (UTC offsets are bounded to ±14 hours); otherwise context
  // is genuinely ambiguous.
  const dayStart = Date.parse(`${nutritionDate}T00:00:00.000Z`) - 14 * 60 * 60 * 1000;
  const dayEnd = Date.parse(`${nutritionDate}T00:00:00.000Z`) + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000;
  const overlapping = assignments.filter(assignment => {
    const start = Date.parse(assignment.assigned_at);
    const end = assignment.ended_at ? Date.parse(assignment.ended_at) : Number.POSITIVE_INFINITY;
    return Number.isFinite(start) && start < dayEnd && end > dayStart;
  });
  const spanning = overlapping.filter(assignment => {
    const start = Date.parse(assignment.assigned_at);
    const end = assignment.ended_at ? Date.parse(assignment.ended_at) : Number.POSITIVE_INFINITY;
    return start <= dayStart && end >= dayEnd && Boolean(assignment.snapshot);
  });
  return {
    assignment: overlapping.length === 1 && spanning.length === 1 ? spanning[0] : null,
    ambiguous: overlapping.length > 0 || (assignments.length === 0 && historical),
    overlapping,
  };
}

function validateAndGetHeads(events: NutritionLogEvent[], issues: string[]) {
  const byId = new Map(events.map(event => [event.id, event]));
  const invalidKeys = new Set<string>();
  const invalidEventIds = new Set<string>();
  const rootId = (event: NutritionLogEvent) => {
    let current = event;
    const seen = new Set<string>();
    while (current.supersedes_event_id && byId.has(current.supersedes_event_id) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.supersedes_event_id)!;
    }
    return current.id;
  };
  const keyFor = (event: NutritionLogEvent) => isPrescribed(event)
    ? prescribedKey(event)
    : isExtra(event) ? `${event.client_id}|extra|${event.nutrition_date}|${rootId(event)}` : `invalid|${event.id}`;
  const superseded = new Set<string>();
  for (const event of events) {
    if (!event.supersedes_event_id) continue;
    const predecessor = byId.get(event.supersedes_event_id);
    const samePrescription = predecessor && isPrescribed(predecessor) && isPrescribed(event)
      && prescribedKey(predecessor) === prescribedKey(event);
    const sameExtraChain = predecessor && isExtra(predecessor) && isExtra(event)
      && predecessor.client_id === event.client_id && predecessor.nutrition_date === event.nutrition_date
      && predecessor.event_type === 'EXTRA' && event.event_type === 'VOID';
    if (!predecessor || (!samePrescription && !sameExtraChain) || predecessor.id === event.id) {
      issues.push(`Invalid correction link for event ${event.id}`);
      invalidEventIds.add(event.id);
      if (predecessor) invalidEventIds.add(predecessor.id);
      if (isPrescribed(event)) invalidKeys.add(prescribedKey(event));
      if (isPrescribed(predecessor || event)) invalidKeys.add(prescribedKey(predecessor || event));
      continue;
    }
    superseded.add(predecessor.id);
  }
  // A cycle leaves no head. Detect it explicitly rather than showing a stale
  // declaration or silently treating the meal as unlogged.
  for (const event of events) {
    const seen = new Set<string>();
    let current: NutritionLogEvent | undefined = event;
    while (current?.supersedes_event_id) {
      if (seen.has(current.id)) {
        issues.push(`Correction cycle involving event ${event.id}`);
        for (const id of seen) invalidEventIds.add(id);
        invalidEventIds.add(event.id);
        if (isPrescribed(event)) invalidKeys.add(prescribedKey(event));
        break;
      }
      seen.add(current.id);
      current = byId.get(current.supersedes_event_id);
    }
  }
  const headsByKey = new Map<string, NutritionLogEvent[]>();
  for (const event of events) {
    if (!isPrescribed(event) && !isExtra(event)) {
      issues.push(`Invalid event target for event ${event.id}`);
      continue;
    }
    if (superseded.has(event.id)) continue;
    const key = keyFor(event);
    headsByKey.set(key, [...(headsByKey.get(key) || []), event]);
  }
  for (const [key, heads] of headsByKey) {
    if (heads.length > 1) issues.push(`Multiple current declarations for ${key}`);
  }
  return { headsByKey, superseded, invalidKeys, invalidEventIds };
}

function reconstructItems(meal: NutritionMealSnapshot, event: NutritionLogEvent | null): ReconstructedItem[] {
  const deltas = event?.event_type === 'MODIFIED' ? event.items : [];
  const byPlannedId = new Map<string, NutritionLogEventItem>();
  const added: NutritionLogEventItem[] = [];
  for (const delta of deltas) {
    if (delta.operation === 'added') {
      added.push(delta);
      continue;
    }
    if (!delta.planned_item_id || !meal.items.some(item => item.id === delta.planned_item_id) || byPlannedId.has(delta.planned_item_id)) {
      throw new Error('Invalid item reference in historical Nutrition declaration');
    }
    byPlannedId.set(delta.planned_item_id, delta);
  }
  const rows = meal.items.map(planned => {
    const delta = byPlannedId.get(planned.id);
    if (!delta) return { kind: 'unchanged' as const, planned, logged: null, quantityDifference: null };
    if (delta.operation === 'removed') return { kind: 'removed' as const, planned, logged: delta, quantityDifference: null };
    if (delta.operation === 'substituted') return { kind: 'substituted' as const, planned, logged: delta, quantityDifference: null };
    const compatible = planned.quantity !== null && delta.quantity !== null && planned.unit !== null && planned.unit === delta.unit;
    return {
      kind: 'quantity_changed' as const,
      planned,
      logged: delta,
      quantityDifference: compatible ? delta.quantity! - planned.quantity! : null,
    };
  });
  return [...rows, ...added.map(logged => ({ kind: 'added' as const, planned: null, logged, quantityDifference: null }))];
}

/** Shared, presentation-independent Planned ↔ Client-declared Logged reconstruction. */
export function reconstructNutritionDay(input: {
  nutritionDate: string;
  assignments: NutritionAssignmentContext[];
  events: NutritionLogEvent[];
  historical?: boolean;
}): NutritionDailyReconstruction {
  const { nutritionDate, assignments, events, historical = false } = input;
  const dateEvents = events.filter(event => event.nutrition_date === nutritionDate);
  const issues: string[] = [];
  const { headsByKey, invalidKeys, invalidEventIds } = validateAndGetHeads(dateEvents, issues);
  const assignmentById = new Map(assignments.map(assignment => [assignment.id, assignment]));
  const meals: ReconstructedMeal[] = [];
  const contexts = new Map<string, NutritionAssignmentContext | null>();

  for (const event of dateEvents.filter(isPrescribed)) {
    const context = assignmentById.get(event.assignment_id!);
    if (!context?.snapshot) {
      contexts.set(`missing:${event.assignment_id}`, null);
      continue;
    }
    if (!context.snapshot?.meals?.some(meal => meal.id === event.prescribed_meal_id)) {
      contexts.set(`invalid:${event.id}`, null);
      issues.push(`Prescribed meal missing from event assignment snapshot for event ${event.id}`);
      continue;
    }
    contexts.set(context.id, context);
  }

  const dateResolution = assignmentForDate(assignments, nutritionDate, historical);
  const dateContext = dateResolution.assignment;
  const eventContextIds = [...contexts.keys()];
  const dateContextIsSafe = Boolean(dateContext && eventContextIds.every(id => id === dateContext.id));
  if (contexts.size === 0 && dateContext) contexts.set(dateContext.id, dateContext);
  else if (contexts.size === 0 && ((dateResolution.ambiguous && dateResolution.overlapping.length === 0) || dateEvents.some(isPrescribed))) contexts.set('unavailable', null);
  else if (dateContext && !dateContextIsSafe) contexts.set(dateContext.id, dateContext);
  if (dateResolution.ambiguous) {
    for (const assignment of dateResolution.overlapping) {
      if (assignment.snapshot) contexts.set(assignment.id, assignment);
    }
  }

  for (const [contextId, context] of contexts) {
    if (!context) {
      meals.push({ assignmentId: null, planName: null, mealId: null, meal: null, state: 'HISTORICAL_CONTEXT_UNAVAILABLE', declaration: null, items: [] });
      continue;
    }
    const snapshot = context.snapshot!;
    const knownForWholeDate = dateContextIsSafe && dateContext?.id === context.id;
    const eventMealIds = new Set(dateEvents.filter(event => isPrescribed(event) && event.assignment_id === context.id)
      .map(event => event.prescribed_meal_id!));
    for (const meal of [...snapshot.meals].sort((a, b) => a.order - b.order)) {
      if (!knownForWholeDate && !eventMealIds.has(meal.id)) {
        meals.push({ assignmentId: context.id, planName: snapshot.plan_name, mealId: meal.id, meal, state: 'HISTORICAL_CONTEXT_UNAVAILABLE', declaration: null, items: [] });
        continue;
      }
      const key = `${context.client_id}|${context.id}|${meal.id}|${nutritionDate}`;
      const heads = headsByKey.get(key) || [];
      const hasDeclaration = dateEvents.some(event => isPrescribed(event) && prescribedKey(event) === key);
      if (invalidKeys.has(key) || heads.length > 1 || (hasDeclaration && heads.length === 0)) {
        meals.push({ assignmentId: context.id, planName: snapshot.plan_name, mealId: meal.id, meal, state: 'HISTORICAL_CONTEXT_UNAVAILABLE', declaration: null, items: [] });
        continue;
      }
      const declaration = heads[0] || null;
      if (declaration?.event_type === 'VOID' || declaration?.event_type === 'EXTRA') {
        issues.push(`Invalid event type for prescribed meal ${meal.id}`);
        meals.push({ assignmentId: context.id, planName: snapshot.plan_name, mealId: meal.id, meal, state: 'HISTORICAL_CONTEXT_UNAVAILABLE', declaration: null, items: [] });
        continue;
      }
      const canCallUnlogged = knownForWholeDate;
      const state: PrescribedMealState = declaration?.event_type === 'AS_PLANNED' || declaration?.event_type === 'MODIFIED' || declaration?.event_type === 'SKIPPED'
        ? declaration.event_type
        : canCallUnlogged ? 'UNLOGGED' : 'HISTORICAL_CONTEXT_UNAVAILABLE';
      try {
        meals.push({ assignmentId: context.id, planName: snapshot.plan_name, mealId: meal.id, meal, state, declaration, items: reconstructItems(meal, declaration) });
      } catch (error) {
        issues.push(error instanceof Error ? error.message : 'Invalid historical Nutrition declaration');
        meals.push({ assignmentId: context.id, planName: snapshot.plan_name, mealId: meal.id, meal, state: 'HISTORICAL_CONTEXT_UNAVAILABLE', declaration: null, items: [] });
      }
    }
  }

  const extras = [...headsByKey.values()].flat().filter(event => isExtra(event) && event.event_type === 'EXTRA' && !invalidEventIds.has(event.id))
    .map(event => ({ event, items: event.items }));
  return {
    nutritionDate,
    contextStatus: dateContextIsSafe ? 'known' : contexts.size > 0 ? 'unavailable' : 'no_assignment',
    meals,
    extras,
    issues,
  };
}

export function formatQuantityDifference(value: number | null, unit: string | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit ? ` ${unit}` : ''}`;
}
