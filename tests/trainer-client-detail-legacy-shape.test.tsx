import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import type { ClientData } from '../src/types';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  define: {
    'import.meta.env.VITE_APP_TARGET': JSON.stringify('local'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_test_key'),
  },
});
const [{ TrainerClientDetail }, { AppProvider }, { deserializeClientFromDb }] = await Promise.all([
  vite.ssrLoadModule('/src/components/trainer/TrainerClientDetail.tsx'),
  vite.ssrLoadModule('/src/context/AppContext.tsx'),
  vite.ssrLoadModule('/src/lib/supabase.ts'),
]);
after(() => vite.close());

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
});

const minimalClient: ClientData = {
  id: 'client-shape-test',
  name: 'Cliente de prueba',
  initials: 'CP',
  email: 'client-shape-test@example.invalid',
  phone: '',
  birthDate: '',
  sex: 'Otro',
  height: '',
  objective: '',
  status: 'Activo',
  nextWorkout: '',
  adherencePercentage: 0,
  completedWorkoutsCount: 0,
  totalScheduledWorkoutsCount: 0,
  initialWeight: 0,
  targetWeight: 0,
  weightWeeklyTrend: '',
  lastCheckIn: '',
  assignedProgramId: '',
  weeklySchedule: [],
  strengthProgression: [],
  bodyMeasurements: { cintura: 0, cadera: 0, pecho: 0, brazo: 0, lastUpdated: '' },
  impedanceHistory: [],
};

const renderDetail = (client: ClientData) => renderToStaticMarkup(
  <AppProvider>
    <TrainerClientDetail
      client={client}
      onBack={() => undefined}
      onEditProgram={() => undefined}
      onEditNutrition={() => undefined}
    />
  </AppProvider>,
);

describe('TrainerClientDetail legacy persisted shapes', () => {
  test('renders a full detail with optional legacy data absent', () => {
    const html = renderDetail(minimalClient);
    assert.match(html, /Sin datos/);
    assert.match(html, /Sin datos suficientes/);
    assert.match(html, /Sin información registrada/);
    assert.doesNotMatch(html, /70,0 kg|70\.0 kg|86\s*%/);
  });

  test('renders present metrics, weight, and notes without changing their values', () => {
    const html = renderDetail({
      ...minimalClient,
      currentWeight: 82.5,
      metrics: { stepsToday: 1234, sleepHours: '6 h' },
      trainerNotes: [{ id: 'note-1', date: 'Hoy', content: 'Nota conservada' }],
    });
    assert.match(html, /1,234/);
    assert.match(html, /6 h/);
    assert.match(html, /82,5 kg/);
    assert.match(html, /Nota conservada/);
  });

  test('renders neutral values when the metrics object exists but its values are absent', () => {
    const html = renderDetail({ ...minimalClient, metrics: {} });
    assert.match(html, /Sin datos/);
    assert.doesNotMatch(html, /PASOS[\s\S]*?>\s*0\s*</);
  });

  test('legacy shared menstrual phase is never rendered as current Trainer information', () => {
    const html = renderDetail({
      ...minimalClient,
      sex: 'Mujer',
      menstrualTracking: { sharedWithTrainer: true, phase: 'Folicular' },
    });
    assert.doesNotMatch(html, /Fase folicular/i);
    assert.doesNotMatch(html, /client_menstrual_profile|last_menstrual_start|cycle_pattern/i);
  });

  test('deserialization preserves missing and zero weight instead of synthesizing 70', () => {
    const missingWeight = deserializeClientFromDb({
      id: 'client-shape-test',
      name: 'Cliente de prueba',
      data: { name: 'Cliente de prueba' },
    });
    assert.equal(missingWeight.currentWeight, undefined);

    const zeroWeight = deserializeClientFromDb({
      id: 'client-shape-test',
      name: 'Cliente de prueba',
      current_weight: 0,
      data: { name: 'Cliente de prueba' },
    });
    assert.equal(zeroWeight.currentWeight, 0);
  });
});
