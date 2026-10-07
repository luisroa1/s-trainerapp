import type { NutritionLogEventInput, NutritionLogEventType, NutritionLogItemInput } from '../types';

export interface PendingNutritionLogRequest {
  fingerprint: string;
  request_key: string;
  occurred_at: string;
  timezone_id: string;
  nutrition_date: string;
}

export function prepareNutritionLogRequest(args: {
  pending?: PendingNutritionLogRequest | null;
  createKey: () => string;
  eventType: NutritionLogEventType;
  assignmentId: string | null;
  mealId: string | null;
  supersedesId: string | null;
  items?: NutritionLogItemInput[];
  note?: string | null;
  today: string;
  timezoneId: string;
  now?: Date;
}): { request: NutritionLogEventInput; pending: PendingNutritionLogRequest };
