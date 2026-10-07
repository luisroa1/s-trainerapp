import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ClientPathologiesSummary } from '../src/components/trainer/ClientPathologiesSummary';

describe('ClientPathologiesSummary', () => {
  test('missing data renders a neutral state without claiming no limitations', () => {
    const html = renderToStaticMarkup(<ClientPathologiesSummary pathologies={undefined} />);
    assert.match(html, /Sin información registrada/);
    assert.doesNotMatch(html, /Sin patologías ni limitaciones registradas/);
    assert.doesNotMatch(html, /Confirmado/);
  });

  test('limitations retain their recorded details', () => {
    const html = renderToStaticMarkup(<ClientPathologiesSummary pathologies={{
      hasLimitations: true,
      training: 'Limitación registrada',
      nutrition: 'Restricción registrada',
    }} />);
    assert.match(html, /Limitación registrada/);
    assert.match(html, /Restricción registrada/);
  });

  test('explicit no-limitations data retains the confirmed state', () => {
    const html = renderToStaticMarkup(<ClientPathologiesSummary pathologies={{
      hasLimitations: false,
      training: 'Sin limitaciones registradas',
      nutrition: 'Sin restricciones registradas',
    }} />);
    assert.match(html, /Sin patologías ni limitaciones registradas/);
    assert.match(html, /Confirmado/);
  });
});
