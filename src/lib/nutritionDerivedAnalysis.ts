import type { NutritionDailyReconstruction, PrescribedMealState } from './nutritionPlannedLoggedModel';

export type AnalysisCompleteness = 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA';

export interface CountRatio {
  numerator: number;
  denominator: number;
  ratio: number | null;
  availability: AnalysisCompleteness;
}

export interface NutritionPeriodAnalysis {
  startDate: string;
  endDate: string;
  completeness: AnalysisCompleteness;
  unavailableContextDates: string[];
  counts: {
    reconstructablePrescribedMealSlots: number;
    explicitDeclarations: number;
    unloggedPrescribedMealSlots: number;
    asPlanned: number;
    modified: number;
    skipped: number;
    effectiveExtras: number;
  };
  loggingCoverage: CountRatio;
  declarationDistribution: {
    asPlanned: CountRatio;
    modified: CountRatio;
    skipped: CountRatio;
  };
}

const PRESCRIBED_STATES = new Set<PrescribedMealState>(['AS_PLANNED', 'MODIFIED', 'SKIPPED', 'UNLOGGED']);

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function nutritionDateRange(startDate: string, endDate: string): string[] {
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
    throw new RangeError('Invalid Nutrition analysis date range');
  }
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function ratio(numerator: number, denominator: number, partial: boolean): CountRatio {
  if (denominator === 0) return { numerator, denominator, ratio: null, availability: 'INSUFFICIENT_DATA' };
  return { numerator, denominator, ratio: numerator / denominator, availability: partial ? 'PARTIAL' : 'COMPLETE' };
}

/** Derives factual counts from the shared Nutrition 1C reconstruction only. */
export function deriveNutritionPeriodAnalysis(input: {
  startDate: string;
  endDate: string;
  days: NutritionDailyReconstruction[];
}): NutritionPeriodAnalysis {
  const { startDate, endDate, days } = input;
  const requestedDates = nutritionDateRange(startDate, endDate);
  const byDate = new Map<string, NutritionDailyReconstruction[]>();
  for (const day of days) {
    if (day.nutritionDate < startDate || day.nutritionDate > endDate) continue;
    byDate.set(day.nutritionDate, [...(byDate.get(day.nutritionDate) || []), day]);
  }

  const unavailable = new Set<string>();
  const uniqueDays: NutritionDailyReconstruction[] = [];
  for (const date of requestedDates) {
    const rows = byDate.get(date) || [];
    if (rows.length !== 1) {
      unavailable.add(date);
      continue;
    }
    const day = rows[0];
    uniqueDays.push(day);
    if (day.contextStatus === 'unavailable' || day.issues.length > 0
      || day.meals.some(meal => meal.state === 'HISTORICAL_CONTEXT_UNAVAILABLE')) {
      unavailable.add(date);
    }
  }

  const counts = {
    reconstructablePrescribedMealSlots: 0,
    explicitDeclarations: 0,
    unloggedPrescribedMealSlots: 0,
    asPlanned: 0,
    modified: 0,
    skipped: 0,
    effectiveExtras: 0,
  };
  for (const day of uniqueDays) {
    // These are observed facts for loaded dates. On a PARTIAL period they are
    // intentionally accompanied by unavailableContextDates and are not totals
    // for the unobserved portion of the requested range.
    counts.effectiveExtras += day.extras.length;
    for (const meal of day.meals) {
      if (!PRESCRIBED_STATES.has(meal.state)) continue;
      counts.reconstructablePrescribedMealSlots += 1;
      if (meal.state === 'UNLOGGED') counts.unloggedPrescribedMealSlots += 1;
      else {
        counts.explicitDeclarations += 1;
        if (meal.state === 'AS_PLANNED') counts.asPlanned += 1;
        if (meal.state === 'MODIFIED') counts.modified += 1;
        if (meal.state === 'SKIPPED') counts.skipped += 1;
      }
    }
  }

  const partial = unavailable.size > 0;
  const completeness: AnalysisCompleteness = partial ? 'PARTIAL'
    : counts.reconstructablePrescribedMealSlots === 0 ? 'INSUFFICIENT_DATA' : 'COMPLETE';
  return {
    startDate,
    endDate,
    completeness,
    unavailableContextDates: [...unavailable].sort(),
    counts,
    loggingCoverage: ratio(counts.explicitDeclarations, counts.reconstructablePrescribedMealSlots, partial),
    declarationDistribution: {
      asPlanned: ratio(counts.asPlanned, counts.explicitDeclarations, partial),
      modified: ratio(counts.modified, counts.explicitDeclarations, partial),
      skipped: ratio(counts.skipped, counts.explicitDeclarations, partial),
    },
  };
}
