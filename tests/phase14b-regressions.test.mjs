import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildAppCallbackUrl } from '../src/lib/appCallbackUrl.mjs';
import { clearSuccessfulActivationFlow } from '../src/lib/activationUrl.mjs';
import { resolveAuthorizedRedirect } from '../supabase/functions/_shared/authorizedRedirect.mjs';
import { isPasswordRecoveryRoute } from '../src/lib/passwordRecoveryRoute.mjs';
import { invokeInviteAndRefreshClients } from '../src/lib/inviteClientFlow.mjs';

test('recovery callback survives AppContext consuming the Auth fragment', () => {
  assert.equal(isPasswordRecoveryRoute({ search: '?flow=recovery', hash: '' }), true);
  assert.equal(isPasswordRecoveryRoute({ search: '?flow=activate', hash: '' }), false);
  assert.equal(isPasswordRecoveryRoute({ search: '', hash: '#access_token=synthetic&type=recovery' }), true);
  assert.equal(isPasswordRecoveryRoute({ search: '?code=synthetic', hash: '' }), true);

  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /isPasswordRecoveryRoute\(window\.location\)/);
});

test('Auth callback uses the GitHub Pages project base path and activation query', () => {
  assert.equal(
    buildAppCallbackUrl('https://luisroa1.github.io', '/s-trainerapp/', { flow: 'activate' }),
    'https://luisroa1.github.io/s-trainerapp/?flow=activate',
  );
});

test('Auth callback works from a root-host base path', () => {
  assert.equal(
    buildAppCallbackUrl('https://staging.example.test', '/', {}),
    'https://staging.example.test/',
  );
});

test('callback builder rejects a base path on another origin', () => {
  assert.throws(
    () => buildAppCallbackUrl('https://luisroa1.github.io', 'https://attacker.example/', {}),
    /mismo origen/,
  );
});

test('successful activation removes only flow=activate and preserves other URL state', () => {
  const result = clearSuccessfulActivationFlow(
    'https://luisroa1.github.io/s-trainerapp/?flow=activate&keep=1&flow=activate#access_token=synthetic&refresh_token=synthetic',
  );
  assert.equal(
    result,
    '/s-trainerapp/?keep=1#access_token=synthetic&refresh_token=synthetic',
  );
});

test('successful activation leaves other flow values untouched', () => {
  assert.equal(
    clearSuccessfulActivationFlow('https://staging.example.test/?flow=recovery&keep=1'),
    '/?flow=recovery&keep=1',
  );
});

test('ClientActivate applies the cleanup with replaceState after the success path', () => {
  const source = readFileSync(new URL('../src/components/client/ClientActivate.tsx', import.meta.url), 'utf8');
  const replaceStateIndex = source.indexOf('window.history.replaceState(');
  const cleanupIndex = source.indexOf('clearSuccessfulActivationFlow(window.location.href)');
  const successIndex = source.indexOf('setSuccessMessage(\'¡Contraseña establecida con éxito! Tu cuenta está activa.\')');
  assert.ok(replaceStateIndex >= 0 && cleanupIndex > replaceStateIndex && successIndex > cleanupIndex);
  assert.doesNotMatch(source, /window\.location\.(?:href|assign|replace)\s*=/);
});

test('invite redirect accepts the configured Pages callback and fallback', () => {
  const base = 'https://luisroa1.github.io/s-trainerapp/';
  assert.equal(
    resolveAuthorizedRedirect(base, `${base}?flow=activate`),
    `${base}?flow=activate`,
  );
  assert.equal(resolveAuthorizedRedirect(base), `${base}?flow=activate`);
});

test('invite redirect rejects external origins and non-base paths', () => {
  const base = 'https://luisroa1.github.io/s-trainerapp/';
  assert.throws(
    () => resolveAuthorizedRedirect(base, 'https://attacker.example/s-trainerapp/?flow=activate'),
    /origen y la ruta base autorizados/,
  );
  assert.throws(
    () => resolveAuthorizedRedirect(base, 'https://luisroa1.github.io/other/?flow=activate'),
    /origen y la ruta base autorizados/,
  );
  assert.throws(
    () => resolveAuthorizedRedirect(base, '/s-trainerapp/?flow=activate'),
    /URL absoluta autorizada/,
  );
});

test('invite redirect rejects fragments so Auth can append its session fragment', () => {
  assert.throws(
    () => resolveAuthorizedRedirect(
      'https://luisroa1.github.io/s-trainerapp/',
      'https://luisroa1.github.io/s-trainerapp/#attacker-fragment',
    ),
    /origen y la ruta base autorizados/,
  );
});

test('invite-client validates redirect before sending the invitation', () => {
  const source = readFileSync(new URL('../supabase/functions/invite-client/index.ts', import.meta.url), 'utf8');
  assert.ok(source.indexOf('resolveAuthorizedRedirect(normalizeAuthorizedBaseUrl(baseUrl), body.redirectTo)') < source.indexOf('adminClient.auth.admin.inviteUserByEmail('));
  assert.match(source, /La URL de redirección no está autorizada\./);
});

test('trainer invitation may omit a program but never chooses one outside the Trainer ownership', () => {
  const invite = readFileSync(new URL('../src/components/trainer/TrainerInvite.tsx', import.meta.url), 'utf8');
  const db = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
  const context = readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
  const edgeFunction = readFileSync(new URL('../supabase/functions/invite-client/index.ts', import.meta.url), 'utf8');

  assert.match(db, /getPrograms\(trainerId: string\)[\s\S]*?\.eq\('trainer_id', trainerId\)/);
  assert.match(context, /supabaseDb\.getPrograms\(programOwnerId\)/);
  assert.match(invite, /programs\.filter\(program => program\.trainerId === supabaseUser\?\.id\)/);
  assert.match(invite, /if \(assignedProgram && !trainerPrograms\.some\(program => program\.id === assignedProgram\)\)/);
  assert.match(invite, /assignedProgramId: assignedProgram \|\| null/);
  assert.match(invite, /Puedes invitar al cliente sin asignarle un programa todavía/);
  assert.doesNotMatch(edgeFunction, /rawAssignedProgramId \|\| 'prog-1'/);
  assert.match(edgeFunction, /p_program_id: assignedProgramId/);
  assert.match(edgeFunction, /p_assignment_id: assignedProgramId \? crypto\.randomUUID\(\) : null/);
  assert.match(edgeFunction, /complete_invited_client/);
  assert.match(edgeFunction, /\.eq\('trainer_id', user\.id\)/);
  assert.ok(edgeFunction.indexOf(".eq('trainer_id', user.id)") < edgeFunction.indexOf('adminClient.auth.admin.inviteUserByEmail('));
});

test('successful trainer invitation refreshes existing clients without a second writer', async () => {
  const calls = [];
  const serverClient = { id: 'server-created-client', email: 'fixture@example.test' };
  const result = await invokeInviteAndRefreshClients({
    invoke: async () => {
      calls.push('invite-client-write');
      return { data: { success: true, client: serverClient }, error: null };
    },
    refreshClients: async () => {
      calls.push('refresh-existing-clients');
    },
  });

  assert.deepEqual(calls, ['invite-client-write', 'refresh-existing-clients']);
  assert.equal(result.data.client, serverClient);

  const source = readFileSync(new URL('../src/components/trainer/TrainerInvite.tsx', import.meta.url), 'utf8');
  assert.match(source, /invokeInviteAndRefreshClients\(/);
  assert.match(source, /refreshClients: \(\) => refreshFromSupabase\(/);
  assert.doesNotMatch(source, /\baddClient\s*\(/);
  assert.doesNotMatch(source, /(?:supabaseDb\.)?(?:upsertClient|bulkUpsertClients)\s*\(/);

  const failedCalls = [];
  await invokeInviteAndRefreshClients({
    invoke: async () => ({ data: null, error: new Error('invitation failed') }),
    refreshClients: async () => failedCalls.push('refresh'),
  });
  assert.deepEqual(failedCalls, []);
});

test('read-only preview opens the existing invitation form but cannot invoke invite-client', () => {
  const app = readFileSync(new URL('../src/components/trainer/TrainerApp.tsx', import.meta.url), 'utf8');
  const invite = readFileSync(new URL('../src/components/trainer/TrainerInvite.tsx', import.meta.url), 'utf8');

  assert.match(app, /onOpenInvite=\{\(\) => setActiveSection\('invite'\)\}/);
  assert.match(app, /<TrainerInvite readOnly=\{IS_READ_ONLY_PREVIEW\}/);
  assert.match(invite, /if \(readOnly\) \{[\s\S]*?setErrorMessage\('El envío está desactivado en esta vista previa de solo lectura\.'\);[\s\S]*?return;/);
  assert.ok(invite.indexOf('if (readOnly)') < invite.indexOf('const { data, error } = await invokeInviteAndRefreshClients('));
  assert.match(invite, /disabled=\{isLoading \|\| readOnly\}/);
  assert.match(invite, /Vista previa de solo lectura: puedes revisar el formulario, pero no se enviarán invitaciones\./);
  assert.match(invite, /La invitación no se enviará desde esta vista previa\./);
  assert.match(invite, /role="alert"[\s\S]*?errorMessage/);
  assert.match(invite, /setErrorMessage\(displayError\)/);
  assert.match(invite, /setErrorMessage\(data\.error\)/);
  assert.match(invite, /setErrorMessage\(err\.message/);
  assert.match(invite, /invokeInviteAndRefreshClients\([\s\S]*?supabase\.functions\.invoke\('invite-client'/);
});
