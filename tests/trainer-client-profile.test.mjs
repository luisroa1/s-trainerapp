import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateClientAge, buildTrainerClientProfile } from '../src/lib/trainerClientProfile.mjs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const adapter = source('../src/lib/supabase.ts');
const migration = source('../supabase/migrations/20261007200000_client_onboarding_1a_canonical_persistence.sql');
const panel = source('../src/components/trainer/TrainerClientProfilePanel.tsx');
const detail = source('../src/components/trainer/TrainerClientDetail.tsx');
const trainerApp = source('../src/components/trainer/TrainerApp.tsx');
const legacyHealth = source('../src/components/trainer/ClientPathologiesSummary.tsx');

test('age is derived from a valid date of birth and invalid or future dates stay unknown', () => {
  assert.equal(calculateClientAge('1990-10-08', new Date(2026, 9, 7)), 35);
  assert.equal(calculateClientAge('1990-10-07', new Date(2026, 9, 7)), 36);
  assert.equal(calculateClientAge('1990-02-30', new Date(2026, 9, 7)), null);
  assert.equal(calculateClientAge('2030-01-01', new Date(2026, 9, 7)), null);
  assert.equal(calculateClientAge(null, new Date(2026, 9, 7)), null);
});

test('Trainer profile presents canonical facts and keeps absent fields as No indicado', () => {
  const view = buildTrainerClientProfile({
    profile: { preferred_name: 'Ana', date_of_birth: '1990-10-08', physiological_sex: 'female', height_cm: 170 },
    training: { daily_activity_pattern: 'varies', daily_steps_band: 'unknown', strength_training_status: 'previously', experience_band: '1_3_years', time_since_training_band: '1_6_months', availability_days: '3', training_location: 'gym' },
    latestWeight: { weight_kg: 72.5, measured_on: '2026-10-06' },
    goal: { primary_goal: 'gain_strength', secondary_goals: ['health'] },
    healthStatus: 'available',
    health: { has_relevant_information: true, categories: ['injury_or_discomfort'], body_region: 'Rodilla', description: 'Molestia declarada', recorded_at: '2026-10-06T10:00:00Z' },
  }, 'Ana Pérez', new Date(2026, 9, 7));
  assert.deepEqual(view.personal.map(([, value]) => value), ['Ana Pérez', 'Ana', '35 años', 'Mujer', '170 cm', '72,5 kg', '6/10/2026']);
  assert.deepEqual(view.goals.map(([, value]) => value), ['Ganar fuerza', 'Mejorar la salud']);
  assert.equal(view.activity[0][1], 'Depende mucho del día');
  assert.equal(view.activity[1][1], 'No lo sé');
  assert.equal(view.experience[1][1], '1–3 años');
  assert.equal(view.experience[2][1], '1–6 meses');
  assert.match(view.health, /Declarado por el cliente: Lesión o molestia · Rodilla · Molestia declarada/);
  assert.doesNotMatch(view.health, /diagnóstico|recomendación/i);

  const empty = buildTrainerClientProfile({}, '', new Date(2026, 9, 7));
  assert.ok([...empty.personal, ...empty.goals, ...empty.activity, ...empty.experience, ...empty.availability]
    .every(([, value]) => value === 'No indicado' || value === 'No aplica'));
  assert.equal(empty.health, 'No indicado');
});

test('Trainer adapter batches only existing Trainer-readable canonical profile tables', () => {
  const method = adapter.slice(adapter.indexOf('async getTrainerClientProfile'), adapter.indexOf('async saveClientOnboardingProfile'));
  for (const table of ['client_profile', 'client_training_context', 'client_weight_records', 'client_goal_history', 'client_health_declarations']) {
    assert.match(method, new RegExp(`from\\('${table}'\\)`));
  }
  assert.doesNotMatch(method, /client_menstrual_profile|client_onboarding_state|clients\.data/);
  assert.match(method, /Promise\.all/);
  assert.match(method, /ended_at/);
  assert.match(method, /measured_on.*ascending: false/);
  assert.match(method, /getCurrentHealthDeclaration/);
  assert.doesNotMatch(panel, /\.insert\(|\.upsert\(|\.update\(|\.delete\(/);
  assert.match(detail, /<TrainerClientProfilePanel client=\{client\} variant="rail" \/>/);
  assert.match(detail, /<TrainerClientProfilePanel client=\{client\} variant="progress" \/>/);
});

test('Trainer detail uses canonical active nutrition and versioned training assignment reads', () => {
  const nutritionReader = adapter.slice(adapter.indexOf('async getTrainerActiveNutritionPlan'), adapter.indexOf('async saveNutritionPlanDraft'));
  assert.match(nutritionReader, /from\('client_nutrition_assignments'\)/);
  assert.match(nutritionReader, /from\('nutrition_plan_versions'\)/);
  assert.match(nutritionReader, /\.eq\('client_id', clientId\)/);
  assert.match(detail, /getActiveProgramAssignment\(client\.id\)/);
  assert.match(detail, /getTrainerActiveNutritionPlan\(client\.id\)/);
  assert.match(detail, /<TrainerNutritionLogHistory clientId=\{client\.id\} \/>/);
  assert.match(detail, /<WorkoutHistory status=\{workoutHistoryStatus\}/);
  assert.doesNotMatch(detail, /client\.objective/);
  assert.doesNotMatch(detail, /Datos históricos sincronizados/);
});

test('Trainer detail uses the dedicated workstation shell and retains real section navigation', () => {
  assert.doesNotMatch(detail, /showMessageModal|chatHistory|handleSendMessage|NOTAS DEL ENTRENADOR|newNoteText/);
  assert.match(detail, /'Entrenamiento'.*'Nutrición'.*'Progreso'.*'Seguimiento'.*'Informes'/s);
  assert.doesNotMatch(detail, /'Peso', 'Medidas', 'Fuerza', 'Actividad', 'Fotos', 'Notas'/);
  assert.match(detail, /xl:grid-cols-\[25%_47\.7%_27\.3%\]/);
  assert.match(detail, /<TrainerBrandMark[\s\S]*Volver a clientes[\s\S]*aria-label="Secciones de la ficha"[\s\S]*Cerrar sesión/);
  assert.match(detail, /className="[^"]*border-r[^"]*"[\s\S]*Volver a clientes/);
  assert.match(detail, /aria-label="Datos esenciales del cliente"[\s\S]*?variant="rail"/);
  assert.match(detail, /aria-label=\{`Área de trabajo:/);
  assert.match(detail, /aria-label="Herramientas contextuales"/);
  assert.doesNotMatch(detail, /variant="full"/);
  assert.doesNotMatch(detail, /lucide-react|Dumbbell|Apple|ChartNoAxesCombined/);
  assert.match(detail, /xl:sticky/);
  assert.match(trainerApp, /isClientWorkstation \? \(/);
  assert.match(trainerApp, /className="trainer-global-header"/);
  assert.match(trainerApp, /className="trainer-global-sidebar"/);
  assert.match(trainerApp, /IS_READ_ONLY_PREVIEW/);
  assert.match(trainerApp, /workstationTab/);
  assert.match(detail, /role="alert"/);
  assert.match(detail, /role="status"/);
  assert.match(panel, /Resumen esencial del cliente/);
  assert.match(panel, /Objetivo principal/);
  assert.match(detail, /variant="health"/);
  assert.match(panel, /Salud · declaración inicial/);
  assert.doesNotMatch(panel.slice(panel.indexOf("if (variant === 'rail')"), panel.indexOf("if (variant === 'health')")), /Actividad diaria|Experiencia|Salud · declaración/);
  assert.match(panel, /sm:flex-row/);
});

test('current prescriptions distinguish missing assignment, query failure, and an empty immutable meal list', () => {
  assert.match(detail, /No hay una asignación de entrenamiento activa/);
  assert.match(detail, /No se pudo consultar la asignación nutricional vigente/);
  assert.match(detail, /No hay una prescripción nutricional activa/);
  assert.match(detail, /todavía no contiene comidas pautadas/);
  assert.match(detail, /plan\.snapshot\.meals\.length === 0/);
});

test('existing 1A RLS permits owned-Trainer reads but keeps menstrual data Client-only and state private', () => {
  for (const table of ['client_profile', 'client_training_context', 'client_weight_records', 'client_goal_history', 'client_health_declarations']) {
    const policyBlock = migration.slice(migration.indexOf(`CREATE POLICY ${table === 'client_profile' ? 'client_profile_select' : `${table}_select`}`));
    assert.match(policyBlock.slice(0, policyBlock.indexOf(';')), /c\.trainer_id=p\.id/);
  }
  const menstrualPolicy = migration.slice(migration.indexOf('CREATE POLICY client_menstrual_profile_client_select'), migration.indexOf('CREATE POLICY client_onboarding_state_select'));
  assert.doesNotMatch(menstrualPolicy, /p\.role = 'trainer'/);
  const statePolicy = migration.slice(migration.indexOf('CREATE POLICY client_onboarding_state_select'), migration.indexOf('REVOKE ALL ON FUNCTION private.touch_client_onboarding_row'));
  assert.doesNotMatch(statePolicy, /p\.role = 'trainer'/);
});

test('legacy health JSON remains separate and is no longer presented as confirmed current information', () => {
  assert.match(legacyHealth, /perfil anterior/i);
  assert.match(legacyHealth, /puede no estar actualizado/i);
  assert.doesNotMatch(legacyHealth, /Confirmado — sin restricciones/i);
});
