// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// A tapping game for touch screens: things pop out of holes, tap them fast!
// Works with a mouse too, and every finger counts – several kids can play at once.

import type { ThemeName } from '@kit/themes';
import type { SoundName } from '@kit/sound';

export interface ThingDef {
  emoji: string;
  /** Points for tapping it. Below 0 = don't touch it! */
  points: number;
  /** How often it comes compared with the others (bigger = more often). */
  chance: number;
  /** Sound when it is tapped. */
  sound: SoundName;
}

export const config = {
  title: 'Nopeat näpit',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'viidakko' as ThemeName,

  /** How long one round lasts, in seconds. */
  roundSeconds: 30,

  /** The holes things pop out of. */
  holes: { columns: 5, rows: 3 },
  /** Size of the things in pixels (the screen is 960 × 540). */
  size: 84,
  /** At most this many things out at the same time. */
  maxOut: 4,

  /** Seconds between new things: at the start of the round … at the end (faster!). */
  appearEvery: { start: 0.9, end: 0.35 },
  /** Seconds a thing stays out before it hides: at the start … at the end. */
  stayOut: { start: 1.8, end: 0.75 },

  /** Every this many hits in a row the points grow: ×2, ×3 … */
  comboEvery: 5,
  maxMultiplier: 5,

  /** What pops out of the holes. */
  things: [
    { emoji: '🐹', points: 1, chance: 10, sound: 'coin' },
    { emoji: '🐰', points: 1, chance: 6, sound: 'coin' },
    { emoji: '⭐', points: 5, chance: 1, sound: 'powerup' },
    { emoji: '🌵', points: -3, chance: 2, sound: 'fart' },
  ] as ThingDef[],
};
