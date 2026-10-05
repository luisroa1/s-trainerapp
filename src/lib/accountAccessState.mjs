const VALID_ACCESS_STATES = new Set(['pending', 'enabled', 'suspended']);

export function resolveAccountAccess({ row, error }) {
  if (error) return 'error';
  if (!row) return 'pending';
  return VALID_ACCESS_STATES.has(row.state) ? row.state : 'error';
}
