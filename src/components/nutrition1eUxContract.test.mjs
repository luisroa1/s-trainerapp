import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { clientFieldsFromPersistedData } from '../lib/clientLegacyFields.mjs';
import { clientDataWithoutLegacyAssignment } from '../lib/clientAssignment.mjs';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const exists = async (path) => access(new URL(path, import.meta.url)).then(() => true, () => false);

test('Client Nutrition remains on canonical active Planned and 1B declaration actions', async () => {
  const client = await source('./client/ClientNutrition.tsx');
  assert.match(client, /activeNutritionPlan\?\.snapshot/);
  assert.match(client, /reconstructNutritionDay/);
  assert.match(client, /recordNutritionLogEvent/);
  for (const label of ['Hecho según el plan', 'Registrar cambios', 'No la hice', 'Añadir algo extra']) {
    assert.ok(client.includes(label), `missing canonical Client action: ${label}`);
  }
});

test('Trainer Planned-vs-Logged and factual analysis remain reachable', async () => {
  const detail = await source('./trainer/TrainerClientDetail.tsx');
  const history = await source('./trainer/TrainerNutritionLogHistory.tsx');
  assert.match(detail, /<TrainerNutritionLogHistory clientId=\{client\.id\}/);
  assert.match(history, /reconstructNutritionDay/);
  assert.match(history, /deriveNutritionPeriodAnalysis/);
});

test('Admin no longer exposes the legacy nutrition_plans count or read path', async () => {
  const admin = await source('./common/AdminApp.tsx');
  const readModel = await source('../lib/adminReadModel.mjs');
  assert.doesNotMatch(admin, /nutrition_plans|nutritionPlans|Nutrición/);
  assert.doesNotMatch(readModel, /nutrition_plans|nutritionPlans/);
});

test('supplements navigation and orphan ClientSupplements content are unreachable', async () => {
  const profile = await source('./client/ClientProfile.tsx');
  const app = await source('./client/ClientApp.tsx');
  assert.doesNotMatch(profile, /Suplementación|suplementos/);
  assert.doesNotMatch(app, /ClientSupplements|suplementos/);
  assert.equal(await exists('./client/ClientSupplements.tsx'), false);
});

test('hydration reminder control is removed without changing unrelated reminder toggles', async () => {
  const reminders = await source('./client/ClientReminders.tsx');
  assert.doesNotMatch(reminders, /hidrat|water|Droplet|cada 2 horas/i);
  assert.match(reminders, /Pausas activas/);
  assert.match(reminders, /Hora de dormir/);
});

test('active canonical plan with zero meals has a distinct honest empty state', async () => {
  const client = await source('./client/ClientNutrition.tsx');
  assert.match(client, /sortedMeals\.length === 0/);
  assert.match(client, /Tu plan nutricional está activo, pero todavía no contiene comidas pautadas\./);
  assert.match(client, /No tienes una prescripción nutricional activa\./);
});

test('legacy kcal and adherence fields do not feed canonical Nutrition UI or analysis', async () => {
  const client = await source('./client/ClientNutrition.tsx');
  const trainer = await source('./trainer/TrainerNutritionLogHistory.tsx');
  const analysis = await source('../lib/nutritionDerivedAnalysis.ts');
  const types = await source('../types/index.ts');
  assert.doesNotMatch(client + trainer + analysis, /kcalToday|adherencePercentage|adherencia|Adherencia/i);
  assert.match(types, /@deprecated Legacy persisted field only\. Never use as Nutrition authority or analysis\.[\s\S]*?adherencePercentage/);
  assert.match(types, /@deprecated Preserved legacy client JSON only/);
});

test('legacy completed contract and demo Nutrition fixtures are retired, while canonical event model remains', async () => {
  const types = await source('../types/index.ts');
  const mocks = await source('../data/mockData.ts');
  const client = await source('./client/ClientNutrition.tsx');
  assert.doesNotMatch(types, /interface NutritionPlan\s*\{[\s\S]*?completed\??:/);
  assert.doesNotMatch(mocks, /INITIAL_NUTRITION_PLAN|FREQUENT_FOODS|kcalToday|kcalGoal|waterLiters|waterGoal|adherencePercentage/);
  assert.match(client, /NutritionLogEvent/);
  assert.equal(await exists('./trainer/TrainerNutritionNew.tsx'), false);
  assert.equal(await exists('./client/ClientCalculator.tsx'), false);
});

test('Nutrition localStorage is not a read/write authority; reset cleanup remains harmless', async () => {
  const client = await source('./client/ClientNutrition.tsx');
  const context = await source('../context/AppContext.tsx');
  assert.doesNotMatch(client, /localStorage|strainer_nutrition|roafit_nutrition/);
  assert.doesNotMatch(context, /localStorage\.getItem\(['"](?:strainer_nutrition|roafit_nutrition)/);
  assert.match(context, /localStorage\.removeItem\('strainer_nutrition'\)/);
  assert.match(context, /localStorage\.removeItem\('roafit_nutrition'\)/);
});

test('legacy Client JSON values, including explicit zeroes, remain preserved by compatibility helpers', () => {
  const legacy = {
    metrics: { kcalToday: 0, waterLiters: 0, kcalGoal: 1800 },
    adherencePercentage: 0,
    assignedProgramId: 'legacy-program',
  };
  const restored = clientFieldsFromPersistedData(legacy);
  assert.deepEqual(restored.metrics, legacy.metrics);
  const writePayload = clientDataWithoutLegacyAssignment({ ...restored, assignedProgramId: 'legacy-program' });
  assert.deepEqual(writePayload.metrics, legacy.metrics);
  assert.equal(writePayload.adherencePercentage, 0);
  assert.equal('assignedProgramId' in writePayload, false);
});
