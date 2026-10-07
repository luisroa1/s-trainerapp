// Preserve legacy JSON fields as stored without supplying semantic defaults.
// This keeps explicit values such as 0 and partial metrics intact while leaving
// missing/null fields absent for consumers to represent neutrally.
export function clientFieldsFromPersistedData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const { metrics, ...fields } = data;
  return {
    ...fields,
    ...(metrics && typeof metrics === 'object' && !Array.isArray(metrics)
      ? { metrics: { ...metrics } }
      : {}),
  };
}

export function readOptionalPersistedNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
