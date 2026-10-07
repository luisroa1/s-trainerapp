import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const client = await readFile(new URL('./client/ClientNutrition.tsx', import.meta.url), 'utf8');
const trainer = await readFile(new URL('./trainer/TrainerNutritionLogHistory.tsx', import.meta.url), 'utf8');

test('Client UI exposes only explicit declaration actions and explains self-report semantics', () => {
  assert.match(client, /Hecho según el plan/);
  assert.match(client, /Registrar cambios/);
  assert.match(client, /No la hice/);
  assert.match(client, /Añadir algo extra/);
  assert.match(client, /no una verificación objetiva de ingesta/);
  assert.match(client, /Los elementos que no modifiques quedarán declarados como realizados según el plan/);
});

test('Client UI waits for RPC confirmation and does not treat missing events as skipped', () => {
  assert.match(client, /if \(error \|\| !data\?\.event\?\.id\) throw/);
  assert.match(client, /'Sin registro'/);
  assert.doesNotMatch(client, /event_type:\s*'SKIPPED'.*UNLOGGED/s);
});

test('Trainer UI reads canonical declarations and distinguishes correction/void history', () => {
  assert.match(trainer, /getTrainerNutritionLogHistory/);
  assert.match(trainer, /Registros declarados por el Client/);
  assert.match(trainer, /Prescrito en la versión asignada/);
  assert.match(trainer, /Corregida/);
  assert.match(trainer, /Anulación conservada como historial/);
});

test('Client and Trainer both consume the single shared Planned-vs-Logged reconstruction', () => {
  assert.match(client, /reconstructNutritionDay/);
  assert.match(trainer, /reconstructNutritionDay/);
});
