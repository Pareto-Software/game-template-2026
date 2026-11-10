// ⚙️ PELIN ASETUKSET – most changes the kids ask for are one line here.
// Sizes and distances are in TILES (one tile = one square of the level map).
// Speeds are tiles per second.

import type { ThemeName } from '@kit/themes';
import type { SoundName } from '@kit/sound';

/** How a thing moves. */
export type Moves =
  | 'still'   // stays put (bobs gently if bob: true)
  | 'walk'    // walks back and forth, turns at walls and edges
  | 'hop'     // walks and jumps now and then (frogs, kangaroos)
  | 'fly'     // flies back and forth in the air, ignores gravity
  | 'chase'   // flies towards the nearest player when close
  | 'fall';   // falls down (used for things that rain from the sky)

/** What happens when a player touches a thing. */
export type Touch =
  | 'collect' // the player picks it up and gets `score` points
  | 'hurt'    // the player gets hurt
  | 'stomp'   // jump on top to defeat it; touching its side hurts
  | 'bounce'  // a trampoline: throws the player up high
  | 'power'   // gives the player a superpower (see `power`)
  | 'win';    // finishes the level

export type Power = 'doubleJump' | 'fly' | 'shoot' | 'big' | 'fast';

export interface ThingDef {
  emoji: string;
  touch: Touch;
  moves?: Moves;
  /** Size in tiles (default 0.8). A boss could be 2.5. */
  size?: number;
  /** Speed in tiles per second (default 2). */
  speed?: number;
  /** How many stomps or shots it takes to defeat it (default 1). */
  hp?: number;
  /** Points for collecting or defeating it. */
  score?: number;
  /** Many animal emoji face left (🐌 🐈 🦖 🐉). Set true so they turn the right way. */
  facesLeft?: boolean;
  /** Gently float up and down. */
  bob?: boolean;
  /** Shoots at the players: emoji of the shot and seconds between shots. */
  shoots?: { emoji: string; every: number; speed?: number };
  /** For touch: 'power' – which superpower it gives. */
  power?: Power;
  /** Show a health bar at the top of the screen (for bosses). */
  boss?: boolean;
  /** Sound when collected / defeated. */
  sound?: SoundName;
}

export interface TileDef {
  /** 'solid' blocks from all sides, 'oneway' can be jumped through from below. */
  kind?: 'solid' | 'oneway';
  /** Touching it hurts (spikes, lava). */
  hurt?: boolean;
  /** Ice: players slide when standing on it. */
  slippery?: boolean;
  /** How it looks: 'ground', 'platform', 'lava', or an emoji such as '🧱'. */
  look: string;
}

export interface PlayerDef {
  emoji: string;
  facesLeft?: boolean;
  /** Running speed in tiles per second. */
  speed: number;
  /** How high a jump goes, in tiles. Reaches about 0.15 tiles less in practice,
   *  so 3.3 just clears a 3-tile step; below 3.2 some ledges in the levels get too high. */
  jumpTiles: number;
  /** Size in tiles. */
  size: number;
}

export const config = {
  title: 'Tähtiseikkailu',
  /** perus, talvi, avaruus, viidakko, laava or meri (see kit/themes.ts) */
  theme: 'perus' as ThemeName,
  /** 1 = yksinpeli: one player, both A D W and the arrows work. 2 = kaksinpeli.
   *  The ⚙️ menu can switch it too. */
  players: 2 as 1 | 2,

  player1: { emoji: '🐱', speed: 6, jumpTiles: 3.3, size: 0.9 } as PlayerDef,
  player2: { emoji: '🐶', speed: 6, jumpTiles: 3.3, size: 0.9 } as PlayerDef,

  // Superpowers everyone has from the start (things with touch: 'power' give them later)
  doubleJump: false,   // jump again in the air
  canFly: false,       // hold jump to fly
  canShoot: false,     // F (player 1) or Enter (player 2) shoots
  shot: { emoji: '⚡', speed: 14, size: 0.6 },

  /** 0 = unlimited lives */
  lives: 0,
  /** Gravity in tiles per second². Smaller = floaty moon jumps. */
  gravity: 45,
  /** Seconds a player blinks and can't be hurt after getting hurt. */
  safeTime: 1.5,

  /** Rain things from the sky: which thing (a letter from `things`) and how often (seconds). */
  rain: { thing: 'c', every: 0 }, // every: 0 = no rain

  /** Map letters for the level map (levels.ts). */
  tiles: {
    '#': { kind: 'solid', look: 'ground' },
    '=': { kind: 'oneway', look: 'platform' },
    'B': { kind: 'solid', look: '🧱' },
    '^': { hurt: true, look: '🔺' },
    '~': { hurt: true, look: 'lava' },
    'I': { kind: 'solid', slippery: true, look: '🧊' },
  } as Record<string, TileDef>,

  things: {
    'o': { emoji: '⭐', touch: 'collect', score: 10, bob: true, sound: 'coin' },
    'c': { emoji: '🍬', touch: 'collect', score: 5, moves: 'fall', sound: 'coin' },
    'e': { emoji: '🐌', touch: 'stomp', moves: 'walk', speed: 1.5, score: 20, facesLeft: true },
    'h': { emoji: '🐸', touch: 'stomp', moves: 'hop', speed: 2, score: 20 },
    'b': { emoji: '🦇', touch: 'hurt', moves: 'fly', speed: 2.5 },
    'T': { emoji: '🍄', touch: 'bounce', size: 0.9 },
    'P': { emoji: '🍭', touch: 'power', power: 'doubleJump', bob: true, sound: 'powerup' },
    'D': {
      emoji: '🐉', touch: 'stomp', moves: 'walk', speed: 1.2, size: 2.4, hp: 5, score: 200,
      facesLeft: true, boss: true, shoots: { emoji: '🔥', every: 2.2, speed: 6 }, sound: 'roar',
    },
    'F': { emoji: '🚩', touch: 'win', size: 1.2 },
  } as Record<string, ThingDef>,
};
