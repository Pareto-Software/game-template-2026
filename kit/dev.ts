// Development helper (shared kit file – used by every game).
//
// When the game file changes, the page reloads. keep() remembers a few small
// values (e.g. level number and score) across those reloads, so the kids don't
// start from level 1 after every change. Only in development, never online.

const KEY = `pelipaja:dev:${location.pathname}:`;

export const dev = {
  /** Remember a value until the browser tab is closed (development only). */
  keep(name: string, value: unknown) {
    if (!import.meta.env.DEV) return;
    try {
      sessionStorage.setItem(KEY + name, JSON.stringify(value));
    } catch {}
  },
  /** Get a value saved with keep(), or the fallback. */
  recall<T>(name: string, fallback: T): T {
    if (!import.meta.env.DEV) return fallback;
    try {
      const raw = sessionStorage.getItem(KEY + name);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  /** Forget everything saved with keep(). */
  forget() {
    try {
      for (const k of Object.keys(sessionStorage)) if (k.startsWith(KEY)) sessionStorage.removeItem(k);
    } catch {}
  },
};
