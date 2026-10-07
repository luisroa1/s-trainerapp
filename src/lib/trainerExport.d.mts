import type { ClientData, Program } from '../types';

export type ClientExportField = 'id' | 'name' | 'email' | 'objective' | 'status';
export interface TrainerExportPayload {
  exportedAt: string;
  clients: Array<Partial<Pick<ClientData, ClientExportField>>>;
  programs: Array<Partial<Pick<Program, 'id' | 'name' | 'type' | 'durationWeeks' | 'daysPerWeek'>>>;
}

export const CLIENT_EXPORT_FIELDS: readonly { key: ClientExportField; label: string }[];
export const PROGRAM_EXPORT_FIELDS: readonly { key: string; label: string }[];
export function buildTrainerExport(options?: {
  clients?: ClientData[];
  programs?: Program[];
  selectedClientFields?: ClientExportField[];
  includePrograms?: boolean;
  exportedAt?: string;
}): TrainerExportPayload;
export function trainerExportToCsv(payload: TrainerExportPayload): string;
