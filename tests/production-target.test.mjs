import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF, validateSupabaseTarget } from '../src/lib/supabaseTarget.mjs';

const productionUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const publishableKey = 'sb_publishable_synthetic_test_key';

test('production target accepts only the explicitly allowlisted production project', () => {
  const result = validateSupabaseTarget({
    appTarget: 'production',
    supabaseUrl: productionUrl,
    publishableKey,
  });
  assert.equal(result.supabaseUrl, productionUrl);
  assert.equal(result.projectRef, PRODUCTION_PROJECT_REF);
});

test('production target fails closed for absent or mismatched URL and key', () => {
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'production', supabaseUrl: '', publishableKey,
  }), /Falta VITE_SUPABASE_URL/);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'production', supabaseUrl: stagingUrl, publishableKey,
  }), /Configuración production rechazada/);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'production', supabaseUrl: 'https://attacker.example', publishableKey,
  }), /Configuración production rechazada/);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'production', supabaseUrl: productionUrl, publishableKey: '',
  }), /clave publicable/);
});

test('frontend target rejects Supabase secret and service_role keys', () => {
  const serviceRolePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'production', supabaseUrl: productionUrl, publishableKey: 'sb_secret_never_allowed',
  }), /no se permite una clave Supabase secreta/);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'production', supabaseUrl: productionUrl, publishableKey: `header.${serviceRolePayload}.signature`,
  }), /no se permite una clave Supabase secreta/);
});

test('staging remains pinned to the isolated project and local target cannot use either hosted target', () => {
  assert.equal(validateSupabaseTarget({
    appTarget: 'staging', supabaseUrl: stagingUrl, publishableKey,
  }).projectRef, STAGING_PROJECT_REF);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'staging', supabaseUrl: productionUrl, publishableKey,
  }), /Configuración staging rechazada/);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'local', supabaseUrl: stagingUrl, publishableKey,
  }), /Configuración local rechazada/);
  assert.throws(() => validateSupabaseTarget({
    appTarget: 'local', supabaseUrl: productionUrl, publishableKey,
  }), /Configuración local rechazada/);
});

test('production workflow is manual, main-only, gated by the protected environment, and runs checks first', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /build-and-deploy:[\s\S]*?needs: validate[\s\S]*?environment: production/);
  assert.match(workflow, /bun install --frozen-lockfile/);
  assert.match(workflow, /bun run lint/);
  assert.match(workflow, /bun run test/);
  assert.match(workflow, /VITE_APP_TARGET: production/);
  assert.match(workflow, /VITE_SUPABASE_URL: \$\{\{ vars\.PRODUCTION_SUPABASE_URL \}\}/);
  assert.match(workflow, /PRODUCTION_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /--project-name=s-trainerapp-production --branch=main/);
  assert.doesNotMatch(workflow, /rfxyisqvrukslnlgzzek|service_role|sb_secret_/);
});

test('Vite build and browser client use the same target validation helper', () => {
  const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
  const browserClient = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
  assert.match(viteConfig, /validateSupabaseTarget\(/);
  assert.match(browserClient, /validateSupabaseTarget\(/);
});
