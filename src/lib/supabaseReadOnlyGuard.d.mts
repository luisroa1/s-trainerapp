export class ReadOnlyPreviewWriteError extends Error {
  code: 'READ_ONLY_PREVIEW';
  constructor(operation?: string);
}
export function assertPreviewWritesAllowed(enabled: boolean, operation?: string): void;
export function protectSupabaseClient<T extends object>(client: T, enabled: boolean): T;
