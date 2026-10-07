import type { Session } from '@supabase/supabase-js';

export interface InitialSessionHandlers {
  onSession: (session: Session) => void | Promise<void>;
  onNoSession: () => void | Promise<void>;
  onError: (error: unknown) => void | Promise<void>;
  onSettled: () => void | Promise<void>;
}

export function resolveInitialSession(
  loadSession: () => Promise<{ data?: { session?: Session | null } | null; error?: unknown }>,
  handlers: InitialSessionHandlers,
): Promise<{ status: 'session' | 'empty' | 'error' }>;
