import type { Session } from '@supabase/supabase-js';

export interface InitialSessionHandlers {
  onSession: (session: Session, isCurrent: () => boolean) => void | Promise<void>;
  onNoSession: (isCurrent: () => boolean) => void | Promise<void>;
  onError: (error: unknown, isCurrent: () => boolean) => void | Promise<void>;
  onSettled: () => void | Promise<void>;
}

export function resolveInitialSession(
  loadSession: () => Promise<{ data?: { session?: Session | null } | null; error?: unknown }>,
  getAuthEventGeneration: () => number,
  handlers: InitialSessionHandlers,
): Promise<{ status: 'session' | 'empty' | 'error' | 'superseded' }>;
