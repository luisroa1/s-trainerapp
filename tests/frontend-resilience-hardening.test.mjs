import assert from 'node:assert/strict';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transform } from 'esbuild';
import { resolveInitialSession } from '../src/lib/initialSessionResolution.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createHandlers(overrides = {}) {
  const calls = [];
  return {
    calls,
    handlers: {
      onSession: session => calls.push(['session', session]),
      onNoSession: () => calls.push(['empty']),
      onError: error => calls.push(['error', error]),
      onSettled: () => calls.push(['settled']),
      ...overrides,
    },
  };
}

test('initial callback session success preserves the session flow and settles loading', async () => {
  const session = { user: { id: 'trainer-test' } };
  const { calls, handlers } = createHandlers();
  let loading = true;
  handlers.onSettled = () => { loading = false; calls.push(['settled']); };

  const result = await resolveInitialSession(
    async () => ({ data: { session }, error: null }),
    handlers,
  );

  assert.equal(result.status, 'session');
  assert.deepEqual(calls, [['session', session], ['settled']]);
  assert.equal(loading, false);
});

test('initial callback session rejection is handled and always ends loading', async () => {
  const failure = new Error('private auth detail');
  const { calls, handlers } = createHandlers();
  let loading = true;
  let safeUiMessage = null;
  handlers.onError = error => {
    calls.push(['error', error]);
    safeUiMessage = 'No se pudo verificar tu sesión. Recarga para intentarlo de nuevo.';
  };
  handlers.onSettled = () => { loading = false; calls.push(['settled']); };

  const result = await resolveInitialSession(() => Promise.reject(failure), handlers);

  assert.equal(result.status, 'error');
  assert.deepEqual(calls, [['error', failure], ['settled']]);
  assert.equal(loading, false);
  assert.equal(safeUiMessage, 'No se pudo verificar tu sesión. Recarga para intentarlo de nuevo.');
  assert.equal(safeUiMessage.includes(failure.message), false);
});

test('an auth error returned by Supabase follows the same controlled rejection path', async () => {
  const failure = new Error('session lookup failed');
  const { calls, handlers } = createHandlers();
  const result = await resolveInitialSession(
    async () => ({ data: { session: null }, error: failure }),
    handlers,
  );

  assert.equal(result.status, 'error');
  assert.equal(calls[0][0], 'error');
  assert.equal(calls[0][1], failure);
  assert.deepEqual(calls.at(-1), ['settled']);
});

test('top-level Error Boundary renders normal children and a neutral recovery fallback', async () => {
  const componentPath = path.join(projectRoot, 'src/components/common/AppErrorBoundary.tsx');
  const tempPath = path.join(projectRoot, 'tests', `.AppErrorBoundary-${randomUUID()}.mjs`);
  const source = await readFile(componentPath, 'utf8');
  const compiled = await transform(source, { loader: 'tsx', format: 'esm' });
  await writeFile(tempPath, compiled.code);

  try {
    const { AppErrorBoundary } = await import(`${pathToFileURL(tempPath).href}?test=${randomUUID()}`);
    const normalChild = React.createElement('p', null, 'app rendered');
    const normalBoundary = new AppErrorBoundary({ children: normalChild });
    assert.equal(normalBoundary.render(), normalChild);

    const secretError = new Error('private token-like diagnostic');
    const ThrowingDescendant = () => { throw secretError; };
    assert.throws(() => ThrowingDescendant(), secretError);
    // React invokes this lifecycle transition when a descendant throws.
    const derivedState = AppErrorBoundary.getDerivedStateFromError(secretError);
    const failedBoundary = new AppErrorBoundary({ children: React.createElement(ThrowingDescendant) });
    failedBoundary.state = derivedState;
    const fallbackMarkup = renderToStaticMarkup(failedBoundary.render());

    assert.match(fallbackMarkup, /No pudimos mostrar esta pantalla/);
    assert.match(fallbackMarkup, /Recargar/);
    assert.doesNotMatch(fallbackMarkup, /private token-like diagnostic|Error:|stack|componentStack/);
    assert.match(source, /componentDidCatch\(error: Error, info: React\.ErrorInfo\)/);
    assert.match(source, /console\.error\(/);
    assert.match(source, /window\.location\.reload\(\)/);

    const originalConsoleError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args);
    try {
      failedBoundary.componentDidCatch(secretError, { componentStack: '\n    in ThrowingDescendant' });
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(logged[0][1], secretError);
    assert.equal(logged[0][2].componentStack, '\n    in ThrowingDescendant');
  } finally {
    await unlink(tempPath).catch(() => {});
  }
});

test('the application root is wrapped by the top-level Error Boundary', async () => {
  const main = await readFile(path.join(projectRoot, 'src/main.tsx'), 'utf8');
  assert.match(main, /<AppErrorBoundary>[\s\S]*<StrictMode>[\s\S]*<App \/>[\s\S]*<\/AppErrorBoundary>/);
});

test('callback rejection has a neutral user state and reload action, not an indefinite loader', async () => {
  const app = await readFile(path.join(projectRoot, 'src/App.tsx'), 'utf8');
  const context = await readFile(path.join(projectRoot, 'src/context/AppContext.tsx'), 'utf8');
  assert.match(context, /resolveInitialSession\(establishCallbackSession/);
  assert.match(context, /onError: error =>/);
  assert.match(context, /onSettled: \(\) =>[\s\S]*setAuthLoading\(false\)/);
  assert.match(app, /authInitializationError && !supabaseUser/);
  assert.match(app, /Recargar/);
  assert.match(app, /window\.location\.reload\(\)/);
});
