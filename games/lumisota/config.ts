// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// A top-down snowball fight. Sizes and distances are in TILES (one tile = one
// square of the arena map, 40 px). Speeds are tiles per second.

import type { ThemeName } from '@kit/themes';

export interface PlayerDef {
  emoji: string;
  /** Running speed in tiles per second. */
  speed: number;
  /** Size in tiles. */
  size: number;
}

export interface EnemyDef {
  emoji: string;
  /** Walking speed in tiles per second. */
  speed: number;
  /** Snowballs it takes to melt it. */
  hp: number;
  /** Size in tiles. */
  size: number;
  /** Points for melting it. */
  score: number;
  /** Throws snowballs back: seconds between throws (0 = never). */
  throwsEvery: number;
}

export interface TileDef {
  /** 'wall' blocks players and snowballs, 'ice' is slippery floor. */
  kind: 'wall' | 'ice';
  /** How it looks: 'wall' (snowbank in the theme colour), 'ice', or an emoji such as '🌲'. */
  look: string;
}

export const config = {
  title: 'Lumisota',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'talvi' as ThemeName,
  /** 1 = yksinpeli: one player, both W A S D and the arrows work. 2 = kaksinpeli.
   *  The ⚙️ menu can switch it too. */
  players: 2 as 1 | 2,
  /** 'yhdessä' = together against snowmen · 'vastakkain' = the players throw at each other */
  mode: 'yhdessä' as 'yhdessä' | 'vastakkain',

  player1: { emoji: '🐧', speed: 5, size: 1 } as PlayerDef,
  player2: { emoji: '🦊', speed: 5, size: 1 } as PlayerDef,

  /** Snowballs fly the way the player last moved. F (player 1) or Enter (player 2) throws. */
  snowball: {
    /** Radius in pixels. */
    radius: 7,
    /** Speed in tiles per second. */
    speed: 12,
    /** How far a snowball flies, in tiles. */
    range: 9,
    /** Seconds between throws. */
    reload: 0.3,
    /** How hard a hit pushes, in tiles per second. */
    push: 8,
  },

  /** 0 = unlimited lives (only in 'yhdessä'). */
  lives: 0,
  /** Seconds a player blinks and can't be hurt after a hit. */
  safeTime: 1.5,

  // ---- 'yhdessä': waves of snowmen -------------------------------------
  enemy: { emoji: '☃️', speed: 1.6, hp: 2, size: 1, score: 10, throwsEvery: 0 } as EnemyDef,
  /** A boss at the end of each arena (null = no boss). */
  boss: { emoji: '🧊', speed: 1.1, hp: 12, size: 2.2, score: 100, throwsEvery: 1.6 } as EnemyDef | null,
  /** How many waves per arena before the boss (or the next arena). */
  waves: 3,
  /** Snowmen in the first wave; each wave brings this many more. */
  firstWave: 3,
  moreEachWave: 2,
  /** Seconds between snowmen coming in. */
  spawnEvery: 1.2,

  // ---- 'vastakkain': players against each other -------------------------
  /** Hits needed to win a round. */
  winHits: 10,

  /** Power-up (letter * in the map): seconds of super-fast throwing. */
  powerUp: { emoji: '🧤', seconds: 8, reload: 0.08 },

  /** Map letters for walls and floors (levels.ts). */
  tiles: {
    '#': { kind: 'wall', look: 'wall' },
    'T': { kind: 'wall', look: '🌲' },
    'B': { kind: 'wall', look: '🧱' },
    '~': { kind: 'ice', look: 'ice' },
  } as Record<string, TileDef>,
};
