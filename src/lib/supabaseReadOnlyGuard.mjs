const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);
const READ_ONLY_RPC_ALLOWLIST = new Set(['get_open_workout_session']);
const AUTH_METHOD_ALLOWLIST = new Set([
  'getSession', 'getUser', 'getClaims', 'onAuthStateChange',
  'signInWithPassword', 'signOut', 'refreshSession', 'startAutoRefresh', 'stopAutoRefresh',
]);
const STORAGE_READ_ALLOWLIST = new Set([
  'download', 'list', 'getPublicUrl', 'createSignedUrl', 'createSignedUrls', 'exists',
]);

export class ReadOnlyPreviewWriteError extends Error {
  constructor(operation = 'Esta acción') {
    super(`${operation} está desactivada en la vista previa de solo lectura.`);
    this.name = 'ReadOnlyPreviewWriteError';
    this.code = 'READ_ONLY_PREVIEW';
  }
}

export function assertPreviewWritesAllowed(enabled, operation = 'Esta acción') {
  if (enabled) throw new ReadOnlyPreviewWriteError(operation);
}

function isQueryBuilder(value) {
  return value && typeof value === 'object' && typeof value.then === 'function'
    && [...WRITE_METHODS].some(method => typeof value[method] === 'function');
}

function guardQueryBuilder(builder) {
  if (!isQueryBuilder(builder)) return builder;
  return new Proxy(builder, {
    get(target, property) {
      if (WRITE_METHODS.has(property)) {
        return () => { throw new ReadOnlyPreviewWriteError(`La escritura (${String(property)})`); };
      }
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property === 'then' || property === 'catch' || property === 'finally') return value.bind(target);
      return (...args) => guardQueryBuilder(value.apply(target, args));
    },
  });
}

function guardMethods(target, { allowed, label }) {
  if (!target || typeof target !== 'object') return target;
  return new Proxy(target, {
    get(object, property) {
      const value = Reflect.get(object, property, object);
      if (typeof value !== 'function') return value;
      if (allowed && !allowed.has(property)) {
        return () => { throw new ReadOnlyPreviewWriteError(label); };
      }
      return value.bind(object);
    },
  });
}

/**
 * Frontend-only defense in depth for review builds. It does not replace RLS
 * or make production credentials/data safe for an untrusted deployment.
 */
export function protectSupabaseClient(client, enabled) {
  if (!enabled) return client;
  return new Proxy(client, {
    get(target, property) {
      if (property === 'from') {
        return (table, ...args) => guardQueryBuilder(target.from(table, ...args));
      }
      if (property === 'rpc') {
        return (name, ...args) => {
          if (!READ_ONLY_RPC_ALLOWLIST.has(name)) throw new ReadOnlyPreviewWriteError(`La operación ${name}`);
          return target.rpc(name, ...args);
        };
      }
      if (property === 'auth') return guardMethods(target.auth, { allowed: AUTH_METHOD_ALLOWLIST, label: 'La operación de cuenta' });
      if (property === 'storage') {
        const storage = target.storage;
        return new Proxy(storage, {
          get(storageTarget, storageProperty) {
            const storageValue = Reflect.get(storageTarget, storageProperty, storageTarget);
            if (storageProperty !== 'from' || typeof storageValue !== 'function') {
              return typeof storageValue === 'function' ? storageValue.bind(storageTarget) : storageValue;
            }
            return (bucket, ...args) => guardMethods(storageValue.call(storageTarget, bucket, ...args), {
              allowed: STORAGE_READ_ALLOWLIST,
              label: 'La escritura de archivos',
            });
          },
        });
      }
      if (property === 'functions') {
        return guardMethods(target.functions, { allowed: new Set(), label: 'La llamada a funciones remotas' });
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
