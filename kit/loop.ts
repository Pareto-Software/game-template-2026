// Canvas, scaling and the game loop (shared kit file – used by every game).
//
// The game always draws on a fixed logical canvas (default 960 × 540) that is
// scaled to fit the window. update(dt) runs at a fixed 60 steps per second.

import { input } from './input';
import { fx } from './particles';
import { addSettingsMenu } from './menu';

export interface GameSetup {
  /** Logical width in pixels (default 960). */
  width?: number;
  /** Logical height in pixels (default 540). */
  height?: number;
  /** Called 60 times per second. dt is in seconds (1/60). */
  update(dt: number): void;
  /** Called once per animation frame, after the updates. */
  draw(ctx: CanvasRenderingContext2D): void;
  /** "Aloita alusta" in the ⚙️ menu: back to the first level, score 0, everyone at the start. */
  restartGame?: () => void;
  /** "Tämä taso alusta" in the ⚙️ menu: the current level from the start. */
  restartLevel?: () => void;
  /** 1 = single player (any keys control player 1), 2 = two players (default).
   *  The ⚙️ menu can switch it; that choice is remembered. */
  players?: 1 | 2;
}

export interface RunningGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Seconds since the game started (only counts unpaused time). */
  time(): number;
}

const STEP = 1 / 60;
let freezeLeft = 0;
let paused = false;

/** Freeze the game for a few milliseconds (a "hit stop" that makes hits feel strong). */
export function hitStop(ms: number) {
  freezeLeft = Math.max(freezeLeft, ms / 1000);
}

/** Pause or continue the game. P toggles it too. */
export function setPaused(value: boolean) {
  paused = value;
}

export function isPaused(): boolean {
  return paused;
}

/**
 * A small "back to all games" button in the bottom-left corner.
 * Games live in games/<name>/, so the gallery is two folders up.
 */
function addGalleryLink() {
  const a = document.createElement('a');
  a.href = '../../';
  a.textContent = '← Kaikki pelit';
  a.title = 'Takaisin galleriaan';
  Object.assign(a.style, {
    position: 'fixed', left: '12px', bottom: '12px', zIndex: '10',
    padding: '8px 14px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)',
    color: '#fff', font: 'bold 15px system-ui, sans-serif', textDecoration: 'none',
  });
  // Don't let the link keep keyboard focus: the keys belong to the game.
  a.addEventListener('focus', () => a.blur());
  document.body.appendChild(a);
}

export function startGame(setup: GameSetup): RunningGame {
  const width = setup.width ?? 960;
  const height = setup.height ?? 540;
  const scale = 2; // draw at double resolution so emoji look sharp

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.display = 'block';
  canvas.style.margin = 'auto';
  canvas.style.imageRendering = 'auto';
  canvas.tabIndex = 0;
  document.body.style.margin = '0';
  document.body.style.background = '#111';
  document.body.style.height = '100vh';
  document.body.style.display = 'grid';
  document.body.style.placeItems = 'center';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  addGalleryLink();
  input.initPlayers(setup.players ?? 2);
  addSettingsMenu({
    restartGame: setup.restartGame,
    restartLevel: setup.restartLevel,
    setPaused,
    isPaused,
  });

  const fit = () => {
    const s = Math.min(innerWidth / width, innerHeight / height);
    canvas.style.width = `${Math.floor(width * s)}px`;
    canvas.style.height = `${Math.floor(height * s)}px`;
  };
  fit();
  addEventListener('resize', fit);
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && !e.repeat) paused = !paused;
  });

  let acc = 0;
  let last = performance.now();
  let t = 0;

  const frame = (now: number) => {
    let elapsed = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!paused) {
      if (freezeLeft > 0) {
        const used = Math.min(freezeLeft, elapsed);
        freezeLeft -= used;
        elapsed -= used;
      }
      acc += elapsed;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        input.beginFrame();
        setup.update(STEP);
        fx.update(STEP);
        input.endFrame();
        acc -= STEP;
        t += STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
    } else {
      input.beginFrame();
      input.endFrame();
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.save();
    const shake = fx.shakeOffset();
    ctx.translate(shake.x, shake.y);
    setup.draw(ctx);
    ctx.restore();
    fx.drawFlash(ctx, width, height);
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Tauko – paina P', width / 2, height / 2);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  canvas.focus();

  return { canvas, ctx, width, height, time: () => t };
}
