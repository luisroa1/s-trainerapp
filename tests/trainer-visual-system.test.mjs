import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Trainer landing and client workstation share centralized vector icons based on approved reference silhouettes', () => {
  const system = source('../src/components/common/TrainerVisualSystem.tsx');
  const dashboard = source('../src/components/trainer/TrainerDashboard.tsx');
  const detail = source('../src/components/trainer/TrainerClientDetail.tsx');
  const sprite = source('../src/assets/trainer-visual/trainer-icons.svg');
  assert.equal(existsSync(new URL('../src/assets/trainer-visual/brand-s-trainer-reference.png', import.meta.url)), true, 'provisional brand mark is available');
  for (const name of [
    'clients', 'programs', 'library', 'agenda', 'help', 'training', 'nutrition',
    'progress', 'followup', 'reports', 'inviteClient', 'notification',
    'arrowRight', 'chevronDown', 'programsCard',
  ]) {
    assert.match(sprite, new RegExp(`<symbol id="${name}" viewBox="0 0 \\d+ \\d+">`), `${name} is a centralized vector symbol`);
  }
  assert.match(system, /export const TRAINER_COLORS/);
  assert.match(system, /background: '#080F14'/);
  assert.match(system, /cyan: '#00BCE8'/);
  assert.match(system, /nutrition: '#00E575'/);
  assert.match(system, /brand-s-trainer-reference\.png/);
  assert.match(system, /trainer-icons\.svg\?url/);
  assert.match(system, /<use href=\{`\$\{iconSprite\}#\$\{name\}`\}/);
  assert.match(sprite, /fill="currentColor"/);
  assert.match(sprite, /id="arrowRight" viewBox="0 0 29 28"/);
  assert.match(sprite, /id="programsCard" viewBox="0 0 43 49"/);
  assert.doesNotMatch(system, /import\s+\w+\s+from\s+['"][^'"]*trainer-icons[^'"]*\.png/);
  assert.match(dashboard, /TrainerIconFrame name=\{tool\.icon\}/);
  assert.match(dashboard, /Abrir programas <TrainerIcon name="arrowRight" size=\{21\} \/>/);
  assert.match(detail, /TrainerIcon name=\{icons\[tab\]\}/);
  assert.match(detail, /TrainerBrandMark/);
});

test('Trainer dashboard represents loading, query failure and confirmed empty data distinctly', () => {
  const dashboard = source('../src/components/trainer/TrainerDashboard.tsx');
  const context = source('../src/context/AppContext.tsx');
  assert.match(dashboard, /clientListStatus === 'loading'/);
  assert.match(dashboard, /clientListStatus === 'error'/);
  assert.match(dashboard, /clientListStatus === 'loaded' && clients\.length === 0/);
  assert.match(dashboard, /onClick=\{onRetry\}/);
  assert.match(context, /setClientListStatus\('error'\)/);
  assert.match(context, /setClientListStatus\('loaded'\)/);
  assert.match(context, /if \(clientsRes\.error \|\| !clientsRes\.data\)/);
});

test('trainer home uses current profile data and has no invented notification action', () => {
  const trainerApp = source('../src/components/trainer/TrainerApp.tsx');
  const dashboard = source('../src/components/trainer/TrainerDashboard.tsx');
  assert.match(trainerApp, /trainer\.avatarUrl/);
  assert.match(trainerApp, /trainer\.initials/);
  assert.match(trainerApp, /trainer\.name/);
  assert.match(trainerApp, /Abrir menú de cuenta/);
  assert.match(dashboard, /new Date\(\)\.getHours\(\)/);
  assert.match(dashboard, /Invitar cliente/);
  assert.doesNotMatch(trainerApp, /onClick=.*notification|setNotifications|notificationCount/);
});
