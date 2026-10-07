import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLIENT_ONBOARDING_FLOW_VERSION,
  CLIENT_ONBOARDING_STEPS,
  CLIENT_ONBOARDING_ROLLOUT_AT,
  clientGreetingName,
  firstMissingOnboardingStep,
  getCurrentHealthDeclaration,
  greetingForLocalHour,
  onboardingExperienceShape,
  resolveClientOnboardingEntry,
} from '../src/lib/clientOnboarding.mjs';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const onboarding = source('../src/components/client/ClientOnboarding.tsx');
const app = source('../src/components/client/ClientApp.tsx');
const home = source('../src/components/client/ClientHome.tsx');
const profile = source('../src/components/client/ClientProfile.tsx');
const dataForm = source('../src/components/client/ClientDataForm.tsx');
const adapter = source('../src/lib/supabase.ts');

test('1. A newly created Client after rollout enters onboarding', () => {
  assert.equal(resolveClientOnboardingEntry({ createdAt: CLIENT_ONBOARDING_ROLLOUT_AT, state: null }).kind, 'not_started');
});

test('2. in_progress resumes at its canonical step', () => {
  assert.deepEqual(resolveClientOnboardingEntry({ createdAt: CLIENT_ONBOARDING_ROLLOUT_AT, state: { status: 'in_progress', resume_step: 'experience' } }), { kind: 'in_progress', step: 'experience' });
});

test('3. completed never re-enters onboarding automatically', () => {
  assert.deepEqual(resolveClientOnboardingEntry({ createdAt: CLIENT_ONBOARDING_ROLLOUT_AT, state: { status: 'completed' } }), { kind: 'completed' });
});

test('4. Clients created before rollout remain legacy and are not blocked', () => {
  assert.deepEqual(resolveClientOnboardingEntry({ createdAt: '2026-10-07T20:10:20Z', state: null }), { kind: 'legacy' });
  assert.match(app, /entry\.kind === 'not_started' \|\| entry\.kind === 'in_progress'/);
});

test('5. Greeting uses preferred name, falls back to registered name, and follows local hour', () => {
  assert.equal(clientGreetingName('  Jesús Roa ', 'Legal Name'), 'Jesús');
  assert.equal(clientGreetingName(null, ' Ana Pérez '), 'Ana');
  assert.equal(greetingForLocalHour(17), 'Buenas tardes');
  assert.match(onboarding, /new Date\(\)\.getHours\(\)/);
  assert.match(onboarding, /onFinishOnboarding\(snapshot\.profile\?\.preferred_name \|\| null\)/);
  assert.match(app, /status: 'completed', preferredName/);
});

test('6. Unknown weight is no record/value, never zero', () => {
  assert.match(onboarding, /value=\{weightKg\}/);
  assert.match(onboarding, /No lo sé ahora/);
  assert.match(onboarding, /weightKg\.trim\(\)/);
  assert.doesNotMatch(onboarding, /weightKg\s*\|\|\s*0/);
});

test('7. Physiological sex has no default and maps only to the canonical 1A values', () => {
  assert.match(onboarding, /useState<'male' \| 'female' \| 'not_provided' \| ''>\(''\)/);
  assert.match(onboarding, /physiological_sex: physiologicalSex \|\| null/);
  assert.doesNotMatch(onboarding, /clients\.sex|activeClient\.sex/);
});

test('8. Experience branches clear values that become semantically invalid', () => {
  assert.deepEqual(onboardingExperienceShape('never', '1_3_years', 'over_2_years'), { experience_band: null, time_since_training_band: null });
  assert.deepEqual(onboardingExperienceShape('currently', '1_3_years', 'over_2_years'), { experience_band: '1_3_years', time_since_training_band: null });
  assert.deepEqual(onboardingExperienceShape('previously', '1_3_years', 'over_2_years'), { experience_band: '1_3_years', time_since_training_band: 'over_2_years' });
  assert.match(onboarding, /setExperienceBand\(''\); setTimeSinceBand\(''\)/);
  assert.match(onboarding, /\['6_months_2_years', '6 meses–2 años'\]/);
  assert.match(onboarding, /const timeSince = TIME_SINCE\.find/);
});

test('9. Unknown steps remain an explicit unknown band, not a fabricated numeric count', () => {
  assert.match(onboarding, /\['unknown','No lo sé'\]/);
  assert.match(onboarding, /daily_steps_band: stepsBand/);
  assert.doesNotMatch(onboarding, /stepsBand\s*\|\|\s*0/);
});

test('10. Missing health answer is distinct from an explicit No', () => {
  assert.match(onboarding, /health\.has_relevant_information === true \? 'yes' : health\.has_relevant_information === false \? 'no' : ''/);
  assert.match(onboarding, /if \(!healthAnswer\) throw/);
});

test('11. Yes health declarations require categories and preserve Client-declared details', () => {
  assert.match(onboarding, /healthAnswer === 'yes' && categories\.length === 0/);
  assert.match(onboarding, /has_relevant_information: healthAnswer === 'yes'/);
  assert.match(adapter, /saveClientHealthDeclaration/);
});

test('12. Menstrual tracking is optional and persisted only through the private 1A entity', () => {
  assert.match(onboarding, /cycleChoice === 'yes'/);
  assert.match(onboarding, /value="yes"/);
  assert.match(onboarding, /value="not_now"/);
  assert.match(adapter, /from\('client_menstrual_profile'\)/);
  const trainerProfileReader = adapter.slice(adapter.indexOf('async getTrainerClientProfile'), adapter.indexOf('async saveClientOnboardingProfile'));
  assert.doesNotMatch(trainerProfileReader, /client_menstrual_profile|last_menstrual_start|cycle_pattern/i);
});

test('13. Canonical onboarding cycle information is not exposed to Trainer surfaces', () => {
  const trainerDetail = source('../src/components/trainer/TrainerClientDetail.tsx');
  const trainerProfile = source('../src/components/trainer/TrainerClientProfilePanel.tsx');
  assert.doesNotMatch(trainerDetail, /client_menstrual_profile|last_menstrual_start|cycle_pattern/i);
  assert.doesNotMatch(trainerProfile, /client_menstrual_profile|last_menstrual_start|cycle_pattern/i);
  assert.doesNotMatch(home, /menstrualTracking|menstrual_profile|cycle_pattern/i);
});

test('14. Failed canonical writes cannot advance the step', () => {
  assert.match(onboarding, /if \(result\.error \|\| !result\.data\) throw/);
  assert.match(onboarding, /await saveProgressAndAdvance\(nextStepFor\('activity'\)\)/);
  assert.match(onboarding, /catch \(saveError\)/);
  assert.match(onboarding, /No se pudo guardar todavía/);
});

test('15. Confirmed block persistence precedes progress update', () => {
  const persist = onboarding.indexOf('const result = await supabaseDb.saveClientTrainingContext(clientId, values)');
  const confirm = onboarding.indexOf("if (result.error || !result.data) throw", persist);
  const advance = onboarding.indexOf("await saveProgressAndAdvance(nextStepFor('activity'))", confirm);
  assert.ok(persist >= 0 && confirm > persist && advance > confirm);
});

test('16. Reload reads canonical snapshot and progress, without localStorage authority', () => {
  assert.match(adapter, /getClientOnboardingSnapshot/);
  assert.match(adapter, /getClientOnboardingEntry/);
  assert.match(onboarding, /getClientOnboardingSnapshot\(clientId\)/);
  assert.doesNotMatch(onboarding + adapter, /localStorage\.(getItem|setItem).*onboard|onboard.*localStorage\.(getItem|setItem)/i);
});

test('17. Completion calls the canonical 1A RPC and waits for confirmed completed state', () => {
  assert.match(adapter, /rpc\('complete_client_onboarding'/);
  assert.match(adapter, /data\.status !== 'completed'/);
  assert.match(onboarding, /firstMissingOnboardingStep\(snapshot\)/);
  assert.match(onboarding, /await supabaseDb\.completeClientOnboarding\(\)/);
});

test('18. Completed onboarding with no assignment has a distinct honest Home state', () => {
  assert.match(home, /!activeProgramAssignment/);
  assert.match(home, /Tu entrenador está preparando tu planificación/);
  assert.match(home, /Cuando esté lista, aparecerá aquí/);
  assert.match(home, /const trainerMessage = cleanExerciseTip/);
  assert.doesNotMatch(home, /Sigue las indicaciones de cada ejercicio/);
});

test('Review renders canonical availability values and the optional answers in human-readable form', () => {
  const experiencePresenter = onboarding.slice(onboarding.indexOf('function experienceLabel'), onboarding.indexOf('function availabilityLabel'));
  assert.match(onboarding, /'6_plus':'6\+ días\/semana'/);
  assert.match(onboarding, /physiologicalSexLabel\(snapshot\.profile\.physiological_sex\)/);
  assert.match(onboarding, /function cycleLabel\(value: any\)/);
  assert.match(onboarding, /Última menstruación:/);
  assert.doesNotMatch(experiencePresenter, /time_since_training_band \|\|/);
});

test('19. An active assignment still renders the actual immutable program', () => {
  assert.match(home, /programFromActiveAssignment\(activeProgramAssignment\)/);
  assert.match(home, /programDays\.map\(day/);
});

test('20. Legacy Clients with active assignments remain accessible without synthetic completion', () => {
  assert.match(app, /entry\.kind === 'completed'|entry\.kind === 'legacy'/);
  assert.match(home, /activeProgramAssignment/);
  assert.doesNotMatch(app, /clients\.data.*completed|setOnboarding.*completed.*legacy/i);
});

test('Onboarding gate does not override a pending invitation or recovery route', () => {
  assert.match(app, /const activationRoutePending = typeof window !== 'undefined'/);
  assert.match(app, /if \(activationRoutePending\) return/);
  assert.match(app, /window\.location\.hash\.includes\('type=recovery'\)/);
});

test('canonical writes avoid clients.data and the legacy sex column', () => {
  const onboardingAdapter = adapter.slice(adapter.indexOf('// Canonical Client Onboarding 1A persistence'), adapter.indexOf('// Programs'));
  const executableSource = onboardingAdapter.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executableSource, /from\('clients'\)\.(update|upsert)|current_weight|clients\.sex/);
  assert.match(onboardingAdapter, /client_profile/);
  assert.match(onboardingAdapter, /client_weight_records/);
  assert.match(onboardingAdapter, /client_goal_history|save_client_goal_state/);
  assert.match(onboardingAdapter, /client_training_context/);
  assert.match(onboardingAdapter, /client_health_declarations/);
  assert.match(onboardingAdapter, /client_onboarding_state/);
});

test('flow version and progress steps match the canonical 1A contract', () => {
  assert.equal(CLIENT_ONBOARDING_FLOW_VERSION, 1);
  assert.deepEqual(CLIENT_ONBOARDING_STEPS, ['profile', 'goal', 'activity', 'experience', 'availability', 'health', 'cycle', 'review']);
  assert.match(adapter, /p_flow_version: CLIENT_ONBOARDING_FLOW_VERSION/);
});

test('completion requirements map missing canonical facts to the right block', () => {
  assert.equal(firstMissingOnboardingStep({}), 'profile');
  assert.equal(firstMissingOnboardingStep({ profile: { date_of_birth: '2000-01-01', height_cm: 170 } }), 'goal');
  assert.equal(firstMissingOnboardingStep({ profile: { date_of_birth: '2000-01-01', height_cm: 170 }, goal: { primary_goal: 'health' } }), 'activity');
  assert.equal(firstMissingOnboardingStep({ profile: { date_of_birth: '2000-01-01', height_cm: 170 }, goal: { primary_goal: 'health' }, training: { daily_activity_pattern: 'varies', strength_training_status: 'never', availability_days: '3', training_location: 'unknown' } }), 'health');
});

test('Health declaration head resolution fails closed for a branched chain', () => {
  assert.equal(getCurrentHealthDeclaration([{ id: 'a', supersedes_id: null }, { id: 'b', supersedes_id: 'a' }, { id: 'c', supersedes_id: 'a' }]), null);
});

test('Profile editor does not create a competing legacy DOB/sex/height write path', () => {
  assert.doesNotMatch(dataForm, /setBirthDate|setSex|setHeight|birthDate,|sex,|height,/);
  assert.match(profile, /preferredName\?\.trim\(\)/);
});

test('Home greeting does not repeat a fallback name', () => {
  assert.match(home, /Hola\{firstName \? `, \$\{firstName\}` : ''\}/);
  assert.doesNotMatch(home, /Hola, Hola/);
});
