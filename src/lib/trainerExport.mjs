export const CLIENT_EXPORT_FIELDS = Object.freeze([
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Email' },
  { key: 'objective', label: 'Objetivo' },
  { key: 'status', label: 'Estado' },
]);

export const PROGRAM_EXPORT_FIELDS = Object.freeze([
  { key: 'id', label: 'ID programa' },
  { key: 'name', label: 'Programa' },
  { key: 'type', label: 'Tipo' },
  { key: 'durationWeeks', label: 'Duración (semanas)' },
  { key: 'daysPerWeek', label: 'Días por semana' },
]);

const pickSelected = (record, fields, selected) => Object.fromEntries(
  fields
    .filter(({ key }) => selected.has(key))
    .filter(({ key }) => record?.[key] !== undefined)
    .map(({ key }) => [key, record[key]])
);

export function buildTrainerExport({
  clients = [],
  programs = [],
  selectedClientFields = CLIENT_EXPORT_FIELDS.map(({ key }) => key),
  includePrograms = false,
  exportedAt = new Date().toISOString(),
} = {}) {
  const selected = new Set(selectedClientFields);
  return {
    exportedAt,
    clients: clients.map(client => pickSelected(client, CLIENT_EXPORT_FIELDS, selected)),
    programs: includePrograms
      ? programs.map(program => pickSelected(program, PROGRAM_EXPORT_FIELDS, new Set(PROGRAM_EXPORT_FIELDS.map(({ key }) => key))))
      : [],
  };
}

const csvCell = value => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export function trainerExportToCsv(payload) {
  const clientKeys = CLIENT_EXPORT_FIELDS
    .filter(({ key }) => payload.clients.some(client => Object.hasOwn(client, key)))
    .map(({ key }) => key);
  const programKeys = PROGRAM_EXPORT_FIELDS
    .filter(({ key }) => payload.programs.some(program => Object.hasOwn(program, key)))
    .map(({ key }) => key);
  const headers = ['tipo_registro', 'fecha_exportacion', ...clientKeys, ...programKeys];
  const rows = [
    ...payload.clients.map(client => ['cliente', payload.exportedAt, ...clientKeys.map(key => client[key] ?? ''), ...programKeys.map(() => '')]),
    ...payload.programs.map(program => ['programa', payload.exportedAt, ...clientKeys.map(() => ''), ...programKeys.map(key => program[key] ?? '')]),
  ];
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
