// Keyboard and gamepad input for two players (locked kit file).
//
// Player 1: A / D move, W or Space jump (W also = up), S down, F action (shoot)
// Player 2: ← / → move, ↑ jump (also = up), ↓ down, Enter or . action
// Gamepad 1 → player 1, gamepad 2 → player 2 (stick or d-pad, A = jump, B/X = action).
//
// Keys are read by physical position (e.code), so the Finnish layout works.

export type PlayerNumber = 1 | 2;

export interface PlayerInput {
  /** -1 (left) … 1 (right) */
  x: number;
  /** -1 (up) … 1 (down) */
  y: number;
  /** jump is held down */
  jump: boolean;
  /** jump was pressed during this frame */
  jumpPressed: boolean;
  /** action (shoot) is held down */
  action: boolean;
  /** action was pressed during this frame */
  actionPressed: boolean;
}

type Button = 'left' | 'right' | 'up' | 'down' | 'jump' | 'action';

const KEYS: Record<PlayerNumber, Record<Button, string[]>> = {
  1: {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    jump: ['KeyW', 'Space'],
    action: ['KeyF'],
  },
  2: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['ArrowUp'],
    action: ['Enter', 'NumpadEnter', 'Period'],
  },
};

const BLOCK_DEFAULT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter']);

const held = new Set<string>();
const pressedThisFrame = new Set<string>();
let shiftHeld = false;

addEventListener('keydown', (e) => {
  if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
  shiftHeld = e.shiftKey;
  if (!e.repeat) pressedThisFrame.add(e.code);
  held.add(e.code);
});
addEventListener('keyup', (e) => {
  shiftHeld = e.shiftKey;
  held.delete(e.code);
});
// When the window loses focus (the adult clicks Terminal), forget held keys
// so nobody keeps running into a wall.
addEventListener('blur', () => held.clear());

interface PadState { x: number; y: number; jump: boolean; action: boolean }
const pads: Record<PlayerNumber, PadState> = {
  1: { x: 0, y: 0, jump: false, action: false },
  2: { x: 0, y: 0, jump: false, action: false },
};
const padPrev: Record<PlayerNumber, PadState> = {
  1: { x: 0, y: 0, jump: false, action: false },
  2: { x: 0, y: 0, jump: false, action: false },
};

function readPads() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  const connected = Array.from(list).filter((p): p is Gamepad => !!p);
  for (const n of [1, 2] as PlayerNumber[]) {
    padPrev[n] = { ...pads[n] };
    const p = connected[n - 1];
    if (!p) { pads[n] = { x: 0, y: 0, jump: false, action: false }; continue; }
    const b = (i: number) => !!p.buttons[i]?.pressed;
    const dead = (v: number) => (Math.abs(v) < 0.3 ? 0 : v);
    let x = dead(p.axes[0] ?? 0);
    let y = dead(p.axes[1] ?? 0);
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    pads[n] = { x, y, jump: b(0), action: b(1) || b(2) };
  }
}

const anyHeld = (codes: string[]) => codes.some((c) => held.has(c));
const anyPressed = (codes: string[]) => codes.some((c) => pressedThisFrame.has(c));

export const input = {
  /** The current input of player 1 or 2 (keyboard + gamepad together). */
  player(n: PlayerNumber): PlayerInput {
    const k = KEYS[n];
    const pad = pads[n];
    let x = (anyHeld(k.right) ? 1 : 0) - (anyHeld(k.left) ? 1 : 0);
    let y = (anyHeld(k.down) ? 1 : 0) - (anyHeld(k.up) ? 1 : 0);
    if (x === 0) x = pad.x;
    if (y === 0) y = pad.y;
    return {
      x,
      y,
      jump: anyHeld(k.jump) || pad.jump,
      jumpPressed: anyPressed(k.jump) || (pad.jump && !padPrev[n].jump),
      action: anyHeld(k.action) || pad.action,
      actionPressed: anyPressed(k.action) || (pad.action && !padPrev[n].action),
    };
  },

  /** True if this key (an e.code such as 'KeyN') was pressed during this frame. */
  keyPressed(code: string, opts: { shift?: boolean } = {}): boolean {
    if (opts.shift !== undefined && opts.shift !== shiftHeld) return false;
    return pressedThisFrame.has(code);
  },

  /** True while this key (an e.code such as 'KeyN') is held down. */
  keyHeld(code: string): boolean {
    return held.has(code);
  },

  /** Called by the game loop before each update step. */
  beginFrame() {
    readPads();
  },

  /** Called by the game loop after each update step. */
  endFrame() {
    pressedThisFrame.clear();
    padPrev[1] = { ...pads[1] };
    padPrev[2] = { ...pads[2] };
  },
};
