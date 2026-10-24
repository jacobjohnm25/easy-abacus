/* Easy Abacus: central local storage.
   Every app keeps its data under one namespace, one key per record:
     easyAbacus:shared:<name>    settings every app shares (theme mode)
     easyAbacus:<app>:<name>     an app's own settings, theme and last calculations
   All access is wrapped: private windows and blocked site data make localStorage throw,
   and the apps must keep working (without saving) when that happens. */
(function () {
  "use strict";
  const NS = "easyAbacus";
  const fullKey = (scope, name) => `${NS}:${scope}:${name}`;

  function read(key) {
    try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); } catch { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  function available() {
    try { const k = `${NS}:__test`; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; } catch { return false; }
  }

  /** A store for one scope ("shared" or an app id). */
  function createStore(scope) {
    return {
      scope,
      get(name, fallback = null) { const v = read(fullKey(scope, name)); return v == null ? fallback : v; },
      set(name, value) { return write(fullKey(scope, name), value); },
      remove(name) { remove(fullKey(scope, name)); },
      /** Calls back when another tab or app changes this record. */
      onChange(name, callback) {
        const key = fullKey(scope, name);
        window.addEventListener("storage", (e) => { if (e.key === key) callback(read(key)); });
      },
      /** Removes every record of this scope. */
      clear() {
        try {
          const prefix = `${NS}:${scope}:`;
          Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
        } catch { /* ignore */ }
      },
    };
  }

  /** One-time move of data saved under an older key. `move(oldValue)` writes the new records. */
  function migrate(oldKey, move) {
    const old = read(oldKey);
    if (old == null) return;
    try { move(old); } finally { remove(oldKey); }
  }

  window.EasyAbacus = Object.assign(window.EasyAbacus || {}, {
    storage: { createStore, shared: createStore("shared"), migrate, available, namespace: NS },
  });
})();
