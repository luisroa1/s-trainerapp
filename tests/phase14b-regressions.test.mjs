import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildAppCallbackUrl } from '../src/lib/appCallbackUrl.mjs';
import { clearSuccessfulActivationFlow } from '../src/lib/activationUrl.mjs';
import { resolveAuthorizedRedirect } from '../supabase/functions/_shared/authorizedRedirect.mjs';
import { isPasswordRecoveryRoute } from '../src/lib/passwordRecoveryRoute.mjs';

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
  assert.ok(source.indexOf('resolveAuthorizedRedirect(authorizedAppUrl, customRedirectTo)') < source.indexOf('adminClient.auth.admin.inviteUserByEmail('));
  assert.match(source, /La URL de redirección de la invitación no está autorizada para este entorno\./);
});
