import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the manual preview workflow requires the read-only flag and production workflows do not enable it', async () => {
  const preview = await readFile(new URL('../../.github/workflows/deploy-trainer-preview.yml', import.meta.url), 'utf8');
  const production = await readFile(new URL('../../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
  const legacyProduction = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(preview, /VITE_READ_ONLY_PREVIEW:\s*'true'/);
  assert.match(preview, /test "\$VITE_READ_ONLY_PREVIEW" = "true"/);
  assert.doesNotMatch(production, /VITE_READ_ONLY_PREVIEW/);
  assert.doesNotMatch(legacyProduction, /VITE_READ_ONLY_PREVIEW/);
});

test('AppContext guards each exposed data mutation before optimistic state changes', async () => {
  const appContext = await readFile(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
  for (const method of ['updateClient', 'addClient', 'addTrainerNote', 'saveProgram', 'applyProgramToClient', 'saveNutritionPlanDraft', 'applyNutritionPlan', 'resetAllData']) {
    const methodStart = appContext.indexOf(`const ${method} =`);
    assert.notEqual(methodStart, -1, `${method} exists`);
    const methodBody = appContext.slice(methodStart, appContext.indexOf('\n  };', methodStart));
    assert.match(methodBody, /assertWritable\(/, `${method} has a local state/write guard`);
  }
});
