import { buildAppCallbackUrl } from './appCallbackUrl.mjs';

/**
 * Build Auth callback URLs from Vite's configured application base path.
 * This supports root hosts and project sites such as /s-trainerapp/.
 */
export function getAppCallbackUrl(query: Record<string, string> = {}): string {
  const configuredBasePath = import.meta.env.BASE_URL || '/';
  return buildAppCallbackUrl(window.location.origin, configuredBasePath, query);
}
