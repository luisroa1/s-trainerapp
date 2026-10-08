import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFieldsFromPersistedData, readOptionalPersistedNumber } from '../src/lib/clientLegacyFields.mjs';
import { buildTrainerExport, trainerExportToCsv } from '../src/lib/trainerExport.mjs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('persisted legacy fields remain optional and explicit zero values are preserved', () => {
  const missing = clientFieldsFromPersistedData({ name: 'Client' });
  assert.equal(Object.hasOwn(missing, 'adherencePercentage'), false);
  assert.equal(Object.hasOwn(missing, 'metrics'), false);

  const stored = clientFieldsFromPersistedData({
    adherencePercentage: 0,
    metrics: { stepsToday: 0, kcalToday: 0 },
  });
  assert.equal(stored.adherencePercentage, 0);
  assert.equal(stored.metrics.stepsToday, 0);
  assert.equal(stored.metrics.kcalToday, 0);
  assert.equal(readOptionalPersistedNumber(0), 0);
  assert.equal(readOptionalPersistedNumber(undefined), undefined);
  assert.equal(readOptionalPersistedNumber(null), undefined);
});

test('partial legacy shapes and preserved clinical/note fields are copied without defaults', () => {
  const fields = clientFieldsFromPersistedData({
    metrics: { stepsToday: 0 },
    trainerNotes: [],
    pathologies: null,
    menstrualTracking: { sharedWithTrainer: false },
  });
  assert.deepEqual(fields.metrics, { stepsToday: 0 });
  assert.deepEqual(fields.trainerNotes, []);
  assert.equal(fields.pathologies, null);
  assert.deepEqual(fields.menstrualTracking, { sharedWithTrainer: false });
  assert.equal(fields.metrics.sleepHours, undefined);
});

test('deserializer no longer fabricates adherence 100 or metric defaults', () => {
  const db = source('../src/lib/supabase.ts');
  const context = source('../src/context/AppContext.tsx');
  assert.match(db, /clientFieldsFromPersistedData\(row\.data\)/);
  assert.doesNotMatch(db, /adherencePercentage:\s*Number\([^\n]*100/);
  assert.doesNotMatch(context, /stepsToday:\s*0|kcalToday:\s*0|sleepHours:\s*['"]7\.5|waterLiters:\s*2/);
  assert.doesNotMatch(context, /currentWeight:\s*clientData\.currentWeight\s*\|\|\s*75|targetWeight:\s*clientData\.targetWeight\s*\|\|\s*72|adherencePercentage:\s*100/);
  assert.match(context, /weeklySchedule: clientData\.weeklySchedule \?\? \[\]/);
});

test('Dashboard omits legacy adherence, next workout, alerts, weight, and check-in claims', () => {
  const dashboard = source('../src/components/trainer/TrainerDashboard.tsx');
  for (const claim of ['ADHERENCIA', 'PRÓXIMO ENTRENO', 'CHECK-IN', 'ALERTA']) {
    assert.doesNotMatch(dashboard, new RegExp(claim, 'i'));
  }
  assert.doesNotMatch(dashboard, /adherencePercentage|nextWorkout|currentWeight|lastCheckIn|client\.alert/);
  assert.match(dashboard, /clientes activos/);
});

test('Assistant presents availability only and contains no prefabricated analytics or conversation', () => {
  const assistant = source('../src/components/trainer/TrainerAssistant.tsx');
  const trainerApp = source('../src/components/trainer/TrainerApp.tsx');
  assert.match(assistant, /aún no está disponible/);
  assert.doesNotMatch(assistant, /adherencia|Juan|Lucía|Pedro|volumen|analizando|recomiendo|%/i);
  assert.doesNotMatch(assistant, /useState|setTimeout|quickPrompts/);
  assert.doesNotMatch(trainerApp, /<span>Asistente IA<\/span>/);
});

test('export selector controls payload and only whitelisted fields are exported', () => {
  const payload = buildTrainerExport({
    clients: [{ id: 'c-1', name: 'Cliente', email: 'c@example.test', objective: 'Fuerza', status: 'Activo', adherencePercentage: 0, currentWeight: 72 }],
    programs: [{ id: 'p-1', name: 'Programa', type: 'Fuerza', durationWeeks: 8, daysPerWeek: 4, weeksVolume: [1] }],
    selectedClientFields: ['id', 'name', 'status'],
    includePrograms: true,
    exportedAt: '2026-10-07T10:00:00.000Z',
  });
  assert.deepEqual(payload.clients, [{ id: 'c-1', name: 'Cliente', status: 'Activo' }]);
  assert.deepEqual(payload.programs, [{ id: 'p-1', name: 'Programa', type: 'Fuerza', durationWeeks: 8, daysPerWeek: 4 }]);
  assert.equal(JSON.stringify(payload).includes('adherencePercentage'), false);
  assert.equal(JSON.stringify(payload).includes('weeksVolume'), false);
});

test('CSV is a real CSV format and selection applies to CSV columns too', () => {
  const payload = buildTrainerExport({
    clients: [{ id: 'c-1', name: 'Ana, Test', email: 'a@example.test', objective: 'Salud', status: 'Activo' }],
    selectedClientFields: ['id', 'name'],
    includePrograms: false,
    exportedAt: '2026-10-07T10:00:00.000Z',
  });
  const csv = trainerExportToCsv(payload);
  assert.match(csv, /"tipo_registro","fecha_exportacion","id","name"/);
  assert.match(csv, /"cliente"/);
  assert.match(csv, /"Ana, Test"/);
  assert.doesNotMatch(csv, /email|objetivo|adherencia|peso/);
});

test('export UI offers only CSV/JSON and no fake Drive or sync controls', () => {
  const component = source('../src/components/trainer/TrainerExport.tsx');
  assert.match(component, /<option value="CSV">CSV/);
  assert.match(component, /<option value="JSON">JSON/);
  assert.doesNotMatch(component, /Google Drive|Sincronizar ahora|Excel|PDF|Adherencia|biometría|check-in/i);
});

test('ClientProgress is neutral and omits synthetic trends, adherence, strength, and photos', () => {
  const progress = source('../src/components/client/ClientProgress.tsx');
  assert.match(progress, /Aún no hay suficientes datos registrados para mostrar evolución/);
  assert.doesNotMatch(progress, /0,4 kg|adherencia|strengthProgression|fotos guardadas|<svg|currentWeight/);
});

test('ClientHome and TrainerClientDetail do not render legacy metrics or execution claims', () => {
  const home = source('../src/components/client/ClientHome.tsx');
  const detail = source('../src/components/trainer/TrainerClientDetail.tsx');
  assert.doesNotMatch(home, /metrics\?\.(stepsToday|kcalToday|sleepHours)|weeklySchedule/);
  assert.doesNotMatch(detail, /adherencePercentage|completedWorkoutsCount|totalScheduledWorkoutsCount|stepsToday|sleepHours|currentWeight|client\.alert/);
  assert.doesNotMatch(detail, /client\.trainerNotes|addTrainerNote/);
  assert.match(detail, /Sesiones y resultados/);
  assert.match(detail, /ClientPathologiesSummary pathologies=\{client\.pathologies\}/);
});

test('manual measurements remain optional and absent values do not become zero', () => {
  const types = source('../src/types/index.ts');
  const measurements = source('../src/components/client/ClientMeasurements.tsx');
  assert.match(types, /bodyMeasurements\?:/);
  assert.match(types, /impedanceHistory\?:/);
  assert.match(measurements, /bodyMeasurements\?\.cintura/);
  assert.match(measurements, /Sin datos/);
  assert.match(measurements, /impedanceHistory \?\? \[\]/);
  assert.doesNotMatch(measurements, /setCintura\(Number\(e\.target\.value\)\)/);
});

test('missing or partial menstrual tracking is not synthesized or surfaced on Client Home', () => {
  const cycle = source('../src/components/client/ClientCycle.tsx');
  const home = source('../src/components/client/ClientHome.tsx');
  assert.match(cycle, /const tracking = activeClient\.menstrualTracking;/);
  assert.doesNotMatch(cycle, /activeClient\.menstrualTracking\s*\|\|\s*\{|day:\s*3|enabled:\s*true,\s*sharedWithTrainer/);
  assert.match(cycle, /tracking\?\.enabled === true/);
  assert.match(cycle, /Sin fase registrada/);
  assert.doesNotMatch(home, /activeClient\.menstrualTracking|menstrual_profile|cycle_pattern/i);
});

test('help text no longer promises unavailable adherence, alert, streak, or weekly-calendar features', () => {
  const clientHelp = source('../src/components/client/ClientHelp.tsx');
  const trainerGuide = source('../src/components/trainer/TrainerGuide.tsx');
  assert.doesNotMatch(clientHelp, /adherencia|racha protegida|entrenamiento de hoy, aún pendiente|LOS CÍRCULOS DE LA SEMANA/i);
  assert.match(clientHelp, /Aún no hay un calendario de sesiones esperadas/);
  assert.doesNotMatch(trainerGuide, /ves adherencia y alertas/);
});

test('weeklySchedule is not read as execution and new clients receive only an empty structural collection', () => {
  const context = source('../src/context/AppContext.tsx');
  const detail = source('../src/components/trainer/TrainerClientDetail.tsx');
  const home = source('../src/components/client/ClientHome.tsx');
  assert.match(context, /weeklySchedule: clientData\.weeklySchedule \?\? \[\]/);
  assert.doesNotMatch(context, /weeklySchedule:\s*\[\s*\{\s*day:/);
  assert.doesNotMatch(detail, /client\.weeklySchedule/);
  assert.doesNotMatch(home, /weeklySchedule/);
});

test('localStorage cache cannot reintroduce removed metrics in affected views', () => {
  const affectedViews = [
    source('../src/components/trainer/TrainerDashboard.tsx'),
    source('../src/components/trainer/TrainerAssistant.tsx'),
    source('../src/components/trainer/TrainerExport.tsx'),
    source('../src/components/trainer/TrainerClientDetail.tsx'),
    source('../src/components/client/ClientHome.tsx'),
    source('../src/components/client/ClientProgress.tsx'),
  ].join('\n');
  assert.doesNotMatch(affectedViews, /adherencePercentage|nextWorkout|weightWeeklyTrend|lastCheckIn|metrics\?\.(stepsToday|kcalToday|sleepHours)|strengthProgression/);
});

test('Nutrition remains deferred and CORE 1F Phase 1 read model remains the execution authority', () => {
  const nutrition = source('../src/components/client/ClientNutrition.tsx');
  const history = source('../src/lib/trainerWorkoutHistory.mjs');
  assert.doesNotMatch(nutrition, /metrics/); // Planned Nutrition is independent of legacy client metrics.
  assert.match(history, /buildTrainerWorkoutHistory/);
  assert.doesNotMatch(source('../src/components/trainer/TrainerDashboard.tsx'), /schedule adherence|adherencia/i);
});
