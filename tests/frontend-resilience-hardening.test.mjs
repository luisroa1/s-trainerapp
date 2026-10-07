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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createAuthHarness(overrides = {}) {
  let generation = 0;
  const state = { session: null, user: null, role: null, error: null, loading: true };
  const getGeneration = () => generation;
  const handlers = {
    onSession: (session, isCurrent) => {
      if (!isCurrent()) return;
      state.session = session;
      state.user = session.user;
      state.error = null;
    },
    onNoSession: isCurrent => {
      if (!isCurrent()) return;
      state.session = null;
      state.user = null;
      state.role = null;
      state.error = null;
    },
    onError: (error, isCurrent) => {
      if (!isCurrent()) return;
      state.session = null;
      state.user = null;
      state.role = null;
      state.error = 'No se pudo verificar tu sesión. Recarga para intentarlo de nuevo.';
    },
    onSettled: () => { state.loading = false; },
    ...overrides,
  };
  const emitAuthEvent = (event, session = null) => {
    generation += 1;
    state.session = session;
    state.user = session?.user ?? null;
    state.error = null;
    if (event === 'SIGNED_OUT') state.role = null;
  };
  return { state, getGeneration, emitAuthEvent, handlers };
}

test('Case A: initial success without a later Auth event keeps the valid session', async () => {
  const session = { user: { id: 'trainer-test' } };
  const harness = createAuthHarness();

  const result = await resolveInitialSession(
    async () => ({ data: { session }, error: null }),
    harness.getGeneration,
    harness.handlers,
  );

  assert.equal(result.status, 'session');
  assert.equal(harness.state.session, session);
  assert.equal(harness.state.user.id, 'trainer-test');
  assert.equal(harness.state.loading, false);
});

test('Case B: initial no-session without a later Auth event remains unauthenticated', async () => {
  const harness = createAuthHarness();
  const result = await resolveInitialSession(
    async () => ({ data: { session: null }, error: null }),
    harness.getGeneration,
    harness.handlers,
  );

  assert.equal(result.status, 'empty');
  assert.equal(harness.state.session, null);
  assert.equal(harness.state.user, null);
  assert.equal(harness.state.error, null);
  assert.equal(harness.state.loading, false);
});

test('Case C: initial rejection without a later Auth event becomes controlled error and ends loading', async () => {
  const failure = new Error('private auth detail');
  const harness = createAuthHarness();
  const result = await resolveInitialSession(
    () => Promise.reject(failure),
    harness.getGeneration,
    harness.handlers,
  );

  assert.equal(result.status, 'error');
  assert.equal(harness.state.session, null);
  assert.equal(harness.state.error, 'No se pudo verificar tu sesión. Recarga para intentarlo de nuevo.');
  assert.equal(harness.state.error.includes(failure.message), false);
  assert.equal(harness.state.loading, false);
});

test('an Auth error returned by the initial Supabase lookup follows the controlled error path', async () => {
  const failure = new Error('private auth detail');
  const harness = createAuthHarness();
  const result = await resolveInitialSession(
    async () => ({ data: { session: null }, error: failure }),
    harness.getGeneration,
    harness.handlers,
  );

  assert.equal(result.status, 'error');
  assert.equal(harness.state.session, null);
  assert.equal(harness.state.error, 'No se pudo verificar tu sesión. Recarga para intentarlo de nuevo.');
  assert.equal(harness.state.error.includes(failure.message), false);
  assert.equal(harness.state.loading, false);
});

test('Case D: a valid SIGNED_IN event wins over a late initial rejection', async () => {
  const pending = deferred();
  const session = { user: { id: 'auth-event-user' } };
  const harness = createAuthHarness();
  const initial = resolveInitialSession(() => pending.promise, harness.getGeneration, harness.handlers);

  harness.emitAuthEvent('SIGNED_IN', session);
  pending.reject(new Error('late initial failure'));
  const result = await initial;

  assert.equal(result.status, 'superseded');
  assert.equal(harness.state.session, session);
  assert.equal(harness.state.user.id, 'auth-event-user');
  assert.equal(harness.state.error, null);
  assert.equal(harness.state.loading, false);
});

test('Case E: a valid SIGNED_IN event wins over a late initial no-session result', async () => {
  const pending = deferred();
  const session = { user: { id: 'auth-event-user' } };
  const harness = createAuthHarness();
  const initial = resolveInitialSession(() => pending.promise, harness.getGeneration, harness.handlers);

  harness.emitAuthEvent('SIGNED_IN', session);
  pending.resolve({ data: { session: null }, error: null });
  const result = await initial;

  assert.equal(result.status, 'superseded');
  assert.equal(harness.state.session, session);
  assert.equal(harness.state.user.id, 'auth-event-user');
  assert.equal(harness.state.error, null);
  assert.equal(harness.state.loading, false);
});

test('Case F: a later legitimate SIGNED_OUT event clears a prior SIGNED_IN session', async () => {
  const pending = deferred();
  const session = { user: { id: 'auth-event-user' } };
  const harness = createAuthHarness();
  const initial = resolveInitialSession(() => pending.promise, harness.getGeneration, harness.handlers);

  harness.emitAuthEvent('SIGNED_IN', session);
  harness.state.role = 'client';
  harness.emitAuthEvent('SIGNED_OUT', null);
  pending.resolve({ data: { session: null }, error: null });
  const result = await initial;

  assert.equal(result.status, 'superseded');
  assert.equal(harness.state.session, null);
  assert.equal(harness.state.user, null);
  assert.equal(harness.state.role, null);
  assert.equal(harness.state.error, null);
  assert.equal(harness.state.loading, false);
});

test('Case G: a later Auth session remains authoritative after initial success', async () => {
  const sessionWork = deferred();
  const enteredSessionHandler = deferred();
  const initialSession = { user: { id: 'initial-user' } };
  const newerSession = { user: { id: 'newer-auth-user' } };
  const harness = createAuthHarness({
    onSession: async (session, isCurrent) => {
      if (isCurrent()) harness.state.session = session;
      enteredSessionHandler.resolve();
      await sessionWork.promise;
      if (isCurrent()) harness.state.session = session;
    },
  });
  const initial = resolveInitialSession(
    async () => ({ data: { session: initialSession }, error: null }),
    harness.getGeneration,
    harness.handlers,
  );

  await enteredSessionHandler.promise;
  harness.emitAuthEvent('SIGNED_IN', newerSession);
  sessionWork.resolve();
  const result = await initial;

  assert.equal(result.status, 'superseded');
  assert.equal(harness.state.session, newerSession);
  assert.equal(harness.state.user.id, 'newer-auth-user');
  assert.equal(harness.state.loading, false);
});

test('Supabase Auth event generation gates all initial-session mutation handlers', async () => {
  const context = await readFile(path.join(projectRoot, 'src/context/AppContext.tsx'), 'utf8');
  assert.match(context, /const authEventGeneration = useRef\(0\)/);
  assert.match(context, /resolveInitialSession\(establishCallbackSession, \(\) => authEventGeneration\.current/);
  assert.match(context, /const eventGeneration = \+\+authEventGeneration\.current/);
  assert.match(context, /onNoSession: isCurrent => \{\s*if \(!isMounted \|\| !isCurrent\(\)\) return/);
  assert.match(context, /onError: \(error, isCurrent\) => \{\s*if \(!isMounted \|\| !isCurrent\(\)\) return/);
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
  assert.match(context, /onError: \(error, isCurrent\) =>/);
  assert.match(context, /onSettled: \(\) =>[\s\S]*setAuthLoading\(false\)/);
  assert.match(app, /authInitializationError && !supabaseUser/);
  assert.match(app, /Recargar/);
  assert.match(app, /window\.location\.reload\(\)/);
});
