// Saving small things in the browser, e.g. a high score (locked kit file).
//
// All games on the same site share the browser's storage, so every key gets a
// prefix from the game's own address. Never store names or personal details.

const prefix = (() => {
  const first = location.pathname.split('/').filter(Boolean)[0];
  return `pelipaja:${first ?? 'local'}:`;
})();

export const storage = {
  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(prefix + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  save(key: string, value: unknown) {
    try {
      localStorage.setItem(prefix + key, JSON.stringify(value));
    } catch {
      // storage can be blocked; the game works without it
    }
  },
  /** Saves the score if it beats the old best. Returns the best score. */
  highScore(score: number, key = 'best'): number {
    const best = storage.load(key, 0);
    if (score > best) storage.save(key, score);
    return Math.max(best, score);
  },
};
