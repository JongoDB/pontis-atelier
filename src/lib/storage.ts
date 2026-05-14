// Thin storage adapter so we can swap localStorage → Pontis backend later
// without touching the Zustand store. The adapter only needs three methods;
// Zustand's `createJSONStorage` consumes this shape directly.
//
// To migrate to Pontis: implement a `pontisStorage()` factory below that calls
// REST endpoints, and pass it into the store's `createJSONStorage` factory.

export interface StorageAdapter {
  getItem: (key: string) => string | Promise<string | null> | null;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

/**
 * Local-only adapter (today). Reads + writes browser localStorage.
 * Safe to call in non-browser contexts; returns nulls and no-ops.
 */
export function localStorageAdapter(): StorageAdapter {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  const ls = window.localStorage;
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: (k) => ls.removeItem(k),
  };
}

/**
 * Sketch of the future Pontis backend adapter. Not wired today — kept here so
 * the migration is one factory swap when the backend ships.
 *
 *   import { pontisBackendAdapter } from './storage';
 *   createJSONStorage(() => pontisBackendAdapter({ baseUrl, token }))
 *
 * The persistence API is intentionally minimal: just opaque-string get/set/remove
 * on a key. Zustand's `persist` middleware serialises the state into JSON and
 * hands the string to setItem; that means we can move to any KV-shaped backend
 * without touching the store.
 */
export function pontisBackendAdapter(opts: { baseUrl: string; token: string }): StorageAdapter {
  const headers = { 'authorization': `Bearer ${opts.token}`, 'content-type': 'application/json' };
  return {
    getItem: async (k) => {
      const r = await fetch(`${opts.baseUrl}/state/${encodeURIComponent(k)}`, { headers });
      if (!r.ok) return null;
      const j = await r.json();
      return j.value ?? null;
    },
    setItem: async (k, v) => {
      await fetch(`${opts.baseUrl}/state/${encodeURIComponent(k)}`, {
        method: 'PUT', headers, body: JSON.stringify({ value: v }),
      });
    },
    removeItem: async (k) => {
      await fetch(`${opts.baseUrl}/state/${encodeURIComponent(k)}`, {
        method: 'DELETE', headers,
      });
    },
  };
}
