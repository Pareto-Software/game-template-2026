// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// Sizes are in TILES (one square of the maze map). Speeds are tiles per second.

import type { ThemeName } from '@kit/themes';
import type { SoundName } from '@kit/sound';

/** How a thing moves in the maze. */
export type Moves =
  | 'still'   // stays put (bobs gently if bob: true)
  | 'wander'  // walks along the corridors and turns at random
  | 'chase'   // walks along the corridors towards the nearest player
  | 'patrol'; // walks straight, turns around at walls

/** What happens when a player touches a thing. */
export type Touch =
  | 'collect' // picked up, gives `score` points; the exit opens when all of them are collected
  | 'bonus'   // picked up, gives points, not needed to open the exit
  | 'hurt'    // the player gets hurt
  | 'power'   // gives the player a superpower (see `power`)
  | 'key'     // opens all doors with the same letter as `opens`
  | 'exit';   // finishes the level (only when all `collect` things are collected)

export type Power = 'fast' | 'ghost' | 'brave';

export interface ThingDef {
  emoji: string;
  touch: Touch;
  moves?: Moves;
  /** Size in tiles (default 0.8). */
  size?: number;
  /** Speed in tiles per second (default 2). */
  speed?: number;
  score?: number;
  facesLeft?: boolean;
  bob?: boolean;
  /** For touch: 'power'. fast = quicker, ghost = walk through walls, brave = monsters run away and can be caught. */
  power?: Power;
  /** How many seconds a power lasts (default 8). */
  powerTime?: number;
  /** For touch: 'key' – the door letter it opens. */
  opens?: string;
  sound?: SoundName;
}

export interface TileDef {
  /** 'wall' blocks, 'door' blocks until opened with a key. */
  kind: 'wall' | 'door';
  /** How it looks: 'wall' (theme colour) or an emoji such as '🧱' or '🚪'. */
  look: string;
}

export interface PlayerDef {
  emoji: string;
  facesLeft?: boolean;
  speed: number;
  size: number;
}

export const config = {
  title: 'Juustolabyrintti',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'perus' as ThemeName,
  /** 1 = yksinpeli: one player, both A D W and the arrows work. 2 = kaksinpeli.
   *  The ⚙️ menu can switch it too. */
  players: 2 as 1 | 2,

  player1: { emoji: '🐭', speed: 5, size: 0.8 } as PlayerDef,
  player2: { emoji: '🐹', speed: 5, size: 0.8 } as PlayerDef,

  /** 0 = unlimited lives */
  lives: 0,
  /** Seconds a player blinks and can't be hurt after getting hurt. */
  safeTime: 1.5,
  /** Seconds to finish a level, 0 = no time limit. */
  timeLimit: 0,

  /** Map letters for the walls (levels.ts). */
  tiles: {
    '#': { kind: 'wall', look: 'wall' },
    'B': { kind: 'wall', look: '🧱' },
    'L': { kind: 'door', look: '🚪' },
  } as Record<string, TileDef>,

  things: {
    'o': { emoji: '🧀', touch: 'collect', score: 10, bob: true, sound: 'coin' },
    '*': { emoji: '🍓', touch: 'bonus', score: 50, bob: true, sound: 'powerup' },
    'b': { emoji: '🐝', touch: 'hurt', moves: 'wander', speed: 2.5 },
    's': { emoji: '🕷️', touch: 'hurt', moves: 'chase', speed: 1.8 },
    'p': { emoji: '🦀', touch: 'hurt', moves: 'patrol', speed: 3 },
    'k': { emoji: '🔑', touch: 'key', opens: 'L', bob: true, sound: 'powerup' },
    'P': { emoji: '⚡', touch: 'power', power: 'fast', powerTime: 6, bob: true, sound: 'powerup' },
    'E': { emoji: '🏠', touch: 'exit', size: 1 },
  } as Record<string, ThingDef>,
};
