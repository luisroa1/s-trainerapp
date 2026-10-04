import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('bulk local-to-Supabase sync routes and dead modal are removed', () => {
  const appContext = read('../src/context/AppContext.tsx');
  const trainerApp = read('../src/components/trainer/TrainerApp.tsx');
  const supabaseClient = read('../src/lib/supabase.ts');

  assert.doesNotMatch(appContext, /syncAllToSupabase|bulkUpsert(?:Clients|Programs)/);
  assert.doesNotMatch(trainerApp, /syncAllToSupabase|handleManualSync|Sincronizar base de datos completa/);
  assert.doesNotMatch(supabaseClient, /bulkUpsert(?:Clients|Programs)/);
  assert.equal(existsSync(new URL('../src/components/spec/SupabaseSyncModal.tsx', import.meta.url)), false);
});

test('manual refresh only reads Supabase and ordinary writes remain individual', () => {
  const appContext = read('../src/context/AppContext.tsx');
  const refresh = appContext.slice(
    appContext.indexOf('const refreshFromSupabase ='),
    appContext.indexOf('const loadProfileRole ='),
  );
  const supabaseClient = read('../src/lib/supabase.ts');

  assert.match(refresh, /supabaseDb\.getClients\(\)/);
  assert.match(refresh, /supabaseDb\.getPrograms\(programOwnerId\)/);
  assert.match(refresh, /supabaseDb\.getNutritionPlans\(\)/);
  assert.match(refresh, /supabaseDb\.getTrainerProfile\(/);
  assert.doesNotMatch(refresh, /\.upsert\s*\(|bulkUpsert|\.insert\s*\(|\.update\s*\(/);

  for (const method of ['upsertClient', 'upsertProgram', 'upsertNutritionPlan', 'upsertTrainerProfile']) {
    assert.match(supabaseClient, new RegExp(`async ${method}\\s*\\(`));
  }
});
