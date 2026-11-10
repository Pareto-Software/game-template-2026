// 🎮 LABYRINTTI – the game logic. Numbers and emoji live in config.ts,
// the maze maps in levels.ts. See README.md for which function does what.

import { startGame, hitStop } from '@kit/loop';
import { input, type PlayerNumber } from '@kit/input';
import { sfx } from '@kit/sound';
import { drawEmoji } from '@kit/sprites';
import { moveBody, overlap, distance, type TileWorld } from '@kit/physics';
import { particles, fx } from '@kit/particles';
import { text, hud, banner } from '@kit/ui';
import { themes } from '@kit/themes';
import { storage } from '@kit/storage';
import { dev } from '@kit/dev';
import { config, type ThingDef, type TileDef, type Power } from './config';
import { levels } from './levels';

const T = 40; // tile size in pixels
const W = 960;
const H = 540;
const TOP = 56; // room for the score line above the maze
const theme = themes[config.theme] ?? themes.perus;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

interface Player {
  n: PlayerNumber;
  active: boolean;
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  facing: 1 | -1;
  safeTime: number;
  startX: number; startY: number;
  powers: Map<Power, number>; // power → seconds left
}

interface Thing {
  key: string;
  def: ThingDef;
  x: number; y: number; w: number; h: number;
  /** Monsters walk from tile to tile: current direction. */
  dx: number; dy: number;
  /** The tile it is walking to. */
  tx: number; ty: number;
  dir: 1 | -1;
  startX: number; startY: number;
  dead: boolean;
}

let levelIndex = Math.min(dev.recall('maze-level', 0), levels.length - 1);
let score = dev.recall('maze-score', 0);
let lives = config.lives;
let map: string[] = [];
let cols = 0;
let rows = 0;
let things: Thing[] = [];
let time = 0;
let levelTime = 0;
let titleTime = 3;
let levelDoneTime = 0;
let gameWon = false;
let gameOver = false;
let godMode = false;
const openedDoors = new Set<string>();
const warned = new Set<string>();

const players: Player[] = [makePlayer(1), makePlayer(2)];

function makePlayer(n: PlayerNumber): Player {
  const def = n === 1 ? config.player1 : config.player2;
  // The hitbox never grows past 0.8 tiles, so even a big hero fits in the corridors
  const size = Math.min(def.size, 1) * T * 0.8;
  return {
    n, active: n === 1, x: 0, y: 0, w: size, h: size, vx: 0, vy: 0, facing: 1,
    safeTime: 0, startX: 0, startY: 0, powers: new Map(),
  };
}

function playerDef(p: Player) {
  return p.n === 1 ? config.player1 : config.player2;
}

function hasPower(p: Player, power: Power) {
  return (p.powers.get(power) ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Level loading
// ---------------------------------------------------------------------------

function loadLevel(index: number) {
  levelIndex = index;
  const lines = levels[index].split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  rows = lines.length;
  cols = Math.max(...lines.map((l) => l.length));
  map = lines.map((l) => l.padEnd(cols, ' '));
  things = [];
  openedDoors.clear();
  particles.clear();
  levelDoneTime = 0;
  levelTime = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      if (ch === ' ' || ch === '.') continue;
      if (ch === '1' || ch === '2') {
        const p = players[Number(ch) - 1];
        p.startX = c * T + (T - p.w) / 2;
        p.startY = r * T + (T - p.h) / 2;
        clearCell(r, c);
      } else if (config.things[ch]) {
        spawn(ch, c, r);
        clearCell(r, c);
      } else if (!config.tiles[ch]) {
        if (!warned.has(ch)) console.warn(`Unknown letter "${ch}" in the maze map – treated as empty.`);
        warned.add(ch);
        clearCell(r, c);
      }
    }
  }
  for (const p of players) { p.x = p.startX; p.y = p.startY; p.powers.clear(); }
  dev.keep('maze-level', levelIndex);
}

function clearCell(r: number, c: number) {
  map[r] = map[r].slice(0, c) + ' ' + map[r].slice(c + 1);
}

function tileAt(c: number, r: number): TileDef | null {
  if (r < 0 || c < 0 || c >= cols || r >= rows) return null;
  return config.tiles[map[r][c]] ?? null;
}

function blocked(c: number, r: number): boolean {
  if (r < 0 || c < 0 || c >= cols || r >= rows) return true;
  const t = tileAt(c, r);
  if (!t) return false;
  if (t.kind === 'door' && openedDoors.has(map[r][c])) return false;
  return true;
}

const wallsWorld: TileWorld = { tile: T, kindAt: (c, r) => (blocked(c, r) ? 'solid' : null) };
// With the 'ghost' power only the outer edge stops you.
const ghostWorld: TileWorld = {
  tile: T,
  kindAt: (c, r) => (c <= 0 || r <= 0 || c >= cols - 1 || r >= rows - 1 ? 'solid' : null),
};

/** Put a new thing on tile (col, row). */
function spawn(key: string, col: number, row: number): Thing | null {
  const def = config.things[key];
  if (!def) return null;
  const size = (def.size ?? 0.8) * T * 0.8;
  const t: Thing = {
    key, def, x: col * T + (T - size) / 2, y: row * T + (T - size) / 2, w: size, h: size,
    dx: 0, dy: 0, tx: col, ty: row, dir: 1, startX: col, startY: row, dead: false,
  };
  things.push(t);
  return t;
}

const allCollected = () => !things.some((t) => t.def.touch === 'collect');

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

function hurtPlayer(p: Player) {
  if (p.safeTime > 0 || godMode || levelDoneTime > 0) return;
  sfx('hit');
  fx.shake(8, 250);
  hitStop(80);
  particles.burst(p.x + p.w / 2, p.y + p.h / 2, { color: '#ff5252', count: 16 });
  if (config.lives > 0) {
    lives--;
    if (lives <= 0) { gameOver = true; sfx('lose'); return; }
  }
  p.x = p.startX; p.y = p.startY;
  p.safeTime = config.safeTime;
}

function updatePlayer(p: Player, dt: number) {
  const inp = input.player(p.n);
  if (!p.active) {
    if (inp.jumpPressed || inp.x !== 0 || inp.y !== 0) {
      p.active = true;
      p.x = players[0].x; p.y = players[0].y;
      p.safeTime = 1;
      sfx('powerup');
    }
    return;
  }
  const speed = playerDef(p).speed * T * (hasPower(p, 'fast') ? 1.7 : 1);
  let ix = inp.x, iy = inp.y;
  const len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; }
  p.vx = ix * speed;
  p.vy = iy * speed;
  if (ix !== 0) p.facing = ix > 0 ? 1 : -1;

  const world = hasPower(p, 'ghost') ? ghostWorld : wallsWorld;
  cornerAssist(p, world, dt);
  moveBody(p, world, dt);

  const wasGhost = hasPower(p, 'ghost');
  for (const [power, left] of p.powers) p.powers.set(power, left - dt);
  if (wasGhost && !hasPower(p, 'ghost')) moveOutOfWall(p);
  p.safeTime = Math.max(0, p.safeTime - dt);
}

/** After walking through walls: if the player ended up inside one, move them to the nearest open tile. */
function moveOutOfWall(p: Player) {
  const col = Math.floor((p.x + p.w / 2) / T), row = Math.floor((p.y + p.h / 2) / T);
  for (let ring = 0; ring <= 4; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring || blocked(col + dc, row + dr)) continue;
        if (ring === 0 && !overlapsWall(p)) return; // already fine
        p.x = (col + dc) * T + (T - p.w) / 2;
        p.y = (row + dr) * T + (T - p.h) / 2;
        return;
      }
    }
  }
}

function overlapsWall(p: Player): boolean {
  for (let r = Math.floor(p.y / T); r <= Math.floor((p.y + p.h - 0.01) / T); r++)
    for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w - 0.01) / T); c++)
      if (blocked(c, r)) return true;
  return false;
}

/**
 * Corner assist: when a player pushes into a wall but is almost lined up with an
 * open corridor, slide them into the corridor so they don't get stuck on corners.
 */
function cornerAssist(p: Player, world: TileWorld, dt: number) {
  const slide = playerDef(p).speed * T * dt;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  const col = Math.floor(cx / T), row = Math.floor(cy / T);
  if (p.vx !== 0 && p.vy === 0) {
    const next = col + Math.sign(p.vx);
    const aheadX = p.vx > 0 ? p.x + p.w + 1 : p.x - 1;
    const hitsTop = world.kindAt(Math.floor(aheadX / T), Math.floor(p.y / T)) === 'solid';
    const hitsBottom = world.kindAt(Math.floor(aheadX / T), Math.floor((p.y + p.h - 0.01) / T)) === 'solid';
    if ((hitsTop || hitsBottom) && world.kindAt(next, row) !== 'solid') {
      const target = row * T + T / 2;
      p.y += Math.max(-slide, Math.min(slide, target - cy));
    }
  } else if (p.vy !== 0 && p.vx === 0) {
    const next = row + Math.sign(p.vy);
    const aheadY = p.vy > 0 ? p.y + p.h + 1 : p.y - 1;
    const hitsLeft = world.kindAt(Math.floor(p.x / T), Math.floor(aheadY / T)) === 'solid';
    const hitsRight = world.kindAt(Math.floor((p.x + p.w - 0.01) / T), Math.floor(aheadY / T)) === 'solid';
    if ((hitsLeft || hitsRight) && world.kindAt(col, next) !== 'solid') {
      const target = col * T + T / 2;
      p.x += Math.max(-slide, Math.min(slide, target - cx));
    }
  }
}

// ---------------------------------------------------------------------------
// Things (monsters, cheese, keys …)
// ---------------------------------------------------------------------------

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function nearestPlayer(t: Thing): Player | null {
  let best: Player | null = null, bestD = Infinity;
  for (const p of players) {
    if (!p.active) continue;
    const d = distance(p, t);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

const someoneBrave = () => players.some((p) => p.active && hasPower(p, 'brave'));

/** Monsters move from the centre of one tile to the next and choose a new direction there. */
function updateThing(t: Thing, dt: number) {
  const moves = t.def.moves ?? 'still';
  if (moves === 'still') return;
  const speed = (t.def.speed ?? 2) * T * (someoneBrave() ? 0.6 : 1);
  const step = speed * dt;
  const targetX = t.tx * T + T / 2, targetY = t.ty * T + T / 2;
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  const dist = Math.hypot(targetX - cx, targetY - cy);
  if (dist <= step) {
    // Arrived at the tile centre: choose where to go next.
    t.x = targetX - t.w / 2;
    t.y = targetY - t.h / 2;
    chooseDirection(t, moves);
    t.tx += t.dx;
    t.ty += t.dy;
    return;
  }
  t.x += ((targetX - cx) / dist) * step;
  t.y += ((targetY - cy) / dist) * step;
  if (t.dx !== 0) t.dir = t.dx > 0 ? 1 : -1;
}

function chooseDirection(t: Thing, moves: string) {
  const col = t.tx, row = t.ty;
  const open = DIRS.filter(([dx, dy]) => !blocked(col + dx, row + dy));
  const forward = open.filter(([dx, dy]) => !(dx === -t.dx && dy === -t.dy));
  const choices = forward.length ? forward : open;
  const ahead = (t.dx !== 0 || t.dy !== 0) && !blocked(col + t.dx, row + t.dy);
  let pick: number[] | undefined;
  if (moves === 'patrol') {
    // Straight on; turn around at a wall.
    pick = ahead ? [t.dx, t.dy] : open.find(([dx, dy]) => dx === -t.dx && dy === -t.dy) ?? choices[0];
  } else if (moves === 'chase' && nearestPlayer(t)) {
    const p = nearestPlayer(t)!;
    const px = (p.x + p.w / 2) / T, py = (p.y + p.h / 2) / T;
    const away = someoneBrave() ? -1 : 1; // run away when a player is brave
    pick = [...choices].sort((a, b) =>
      away * (Math.hypot(col + 0.5 + a[0] - px, row + 0.5 + a[1] - py) - Math.hypot(col + 0.5 + b[0] - px, row + 0.5 + b[1] - py)))[0];
  } else {
    // wander: usually straight on, sometimes a random turn
    pick = ahead && Math.random() > 0.3 ? [t.dx, t.dy] : choices[Math.floor(Math.random() * choices.length)];
  }
  [t.dx, t.dy] = pick ?? [0, 0];
}

/** What happens when a player touches a thing. */
function touchThing(p: Player, t: Thing) {
  const def = t.def;
  const burst = () => particles.burst(t.x + t.w / 2, t.y + t.h / 2, { color: '#ffd93d', count: 10, speed: 160 });
  switch (def.touch) {
    case 'collect':
    case 'bonus':
      t.dead = true;
      score += def.score ?? 0;
      burst();
      sfx(def.sound ?? 'coin');
      if (def.touch === 'collect' && things.filter((o) => !o.dead && o.def.touch === 'collect').length === 0) {
        sfx('powerup', { pitch: 0.8 });
        fx.flash('#fff6c0', 200);
      }
      break;
    case 'key':
      t.dead = true;
      if (def.opens) openedDoors.add(def.opens);
      burst();
      sfx(def.sound ?? 'powerup');
      break;
    case 'power':
      t.dead = true;
      if (def.power) p.powers.set(def.power, def.powerTime ?? 8);
      particles.burst(t.x + t.w / 2, t.y + t.h / 2, { emoji: '✨', count: 8 });
      sfx(def.sound ?? 'powerup');
      break;
    case 'hurt':
      if (someoneBrave()) {
        // Brave players catch monsters, which go back to where they started.
        score += 30;
        sfx('bounce');
        particles.burst(t.x + t.w / 2, t.y + t.h / 2, { emoji: '💫', count: 6 });
        t.x = t.startX * T + (T - t.w) / 2; t.y = t.startY * T + (T - t.h) / 2;
        t.tx = t.startX; t.ty = t.startY; t.dx = 0; t.dy = 0;
      } else {
        hurtPlayer(p);
      }
      break;
    case 'exit':
      if (allCollected() && levelDoneTime === 0) {
        levelDoneTime = 2;
        particles.confetti(t.x + t.w / 2, t.y);
        sfx('win');
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// The main update, 60 times per second
// ---------------------------------------------------------------------------

function update(dt: number) {
  time += dt;
  titleTime -= dt;
  dev.keep('maze-score', score);

  // Adult keys: Shift+N next level, Shift+G god mode, Shift+R restart level
  if (input.keyPressed('KeyN', { shift: true })) { loadLevel((levelIndex + 1) % levels.length); return; }
  if (input.keyPressed('KeyG', { shift: true })) godMode = !godMode;
  if (input.keyPressed('KeyR', { shift: true })) { loadLevel(levelIndex); return; }

  if (gameOver || gameWon) {
    if (input.player(1).jumpPressed || input.player(2).jumpPressed) restartGame();
    particles.update(dt);
    return;
  }

  levelTime += dt;
  if (config.timeLimit > 0 && levelTime > config.timeLimit && levelDoneTime === 0) { gameOver = true; sfx('lose'); }

  for (const p of players) updatePlayer(p, dt);
  for (const t of things) updateThing(t, dt);
  for (const p of players) {
    if (!p.active) continue;
    for (const t of things) if (!t.dead && overlap(p, t)) touchThing(p, t);
  }
  things = things.filter((t) => !t.dead);

  if (levelDoneTime > 0) {
    levelDoneTime -= dt;
    if (levelDoneTime <= 0) {
      if (levelIndex + 1 < levels.length) loadLevel(levelIndex + 1);
      else { gameWon = true; storage.highScore(score, 'maze-best'); particles.confetti(W / 2, H / 2, 150); }
    }
  }
  particles.update(dt);
}

function restartGame() {
  score = 0;
  lives = config.lives;
  gameOver = false;
  gameWon = false;
  dev.keep('maze-score', 0);
  loadLevel(0);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = theme.skyTop;
  ctx.fillRect(0, 0, W, H);
  // Centre the maze below the score line
  const ox = Math.round((W - cols * T) / 2);
  const oy = TOP + Math.max(0, Math.round((H - TOP - rows * T) / 2));
  ctx.save();
  ctx.translate(ox, oy);
  drawMaze(ctx);
  for (const t of things) drawThing(ctx, t);
  for (const p of players) drawPlayer(ctx, p);
  particles.draw(ctx);
  ctx.restore();
  drawHud(ctx);
}

function drawMaze(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, cols * T, rows * T);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = tileAt(c, r);
      if (!tile) continue;
      if (tile.kind === 'door' && openedDoors.has(map[r][c])) continue;
      if (tile.look === 'wall') {
        ctx.fillStyle = theme.wall;
        ctx.fillRect(c * T, r * T, T, T);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(c * T, r * T, T, 5);
      } else {
        drawEmoji(ctx, tile.look, c * T + T / 2, r * T + T / 2, T);
      }
    }
  }
}

function drawThing(ctx: CanvasRenderingContext2D, t: Thing) {
  const size = (t.def.size ?? 0.8) * T;
  const bob = t.def.bob ? Math.sin(time * 3 + t.startX) * 3 : 0;
  const flip = t.def.facesLeft ? t.dir > 0 : t.dir < 0;
  const closedExit = t.def.touch === 'exit' && !allCollected();
  const scared = t.def.touch === 'hurt' && someoneBrave();
  drawEmoji(ctx, t.def.emoji, t.x + t.w / 2, t.y + t.h / 2 + bob, size, {
    flipX: flip, alpha: closedExit ? 0.35 : scared ? 0.6 : 1,
  });
  if (closedExit) drawEmoji(ctx, '🔒', t.x + t.w / 2, t.y + t.h / 2, size * 0.5);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
  if (!p.active) return;
  if (p.safeTime > 0 && Math.floor(p.safeTime * 12) % 2 === 0) return; // blink
  const def = playerDef(p);
  const size = def.size * T;
  const flip = def.facesLeft ? p.facing > 0 : p.facing < 0;
  const wobble = p.vx !== 0 || p.vy !== 0 ? Math.sin(time * 18) * 0.08 : 0;
  drawEmoji(ctx, def.emoji, p.x + p.w / 2, p.y + p.h / 2, size, {
    flipX: flip, rotate: wobble, alpha: hasPower(p, 'ghost') ? 0.5 : 1,
  });
  if (godMode) text(ctx, 'GOD', p.x + p.w / 2, p.y - 10, { size: 12, align: 'center' });
}

function drawHud(ctx: CanvasRenderingContext2D) {
  const left = things.filter((t) => t.def.touch === 'collect').length;
  const collectEmoji = Object.values(config.things).find((d) => d.touch === 'collect')?.emoji ?? '';
  const timeLeft = config.timeLimit > 0 ? ` · ⏱️ ${Math.max(0, Math.ceil(config.timeLimit - levelTime))}` : '';
  hud(ctx, W, {
    score,
    lives: config.lives > 0 ? lives : undefined,
    level: `Taso ${levelIndex + 1}/${levels.length}${timeLeft}`,
    extra: left > 0 ? `${collectEmoji} ${left} jäljellä` : 'Maaliin! 🏁',
  });
  if (!players[1].active) text(ctx, 'Pelaaja 2: paina nuolta', W - 16, H - 14, { size: 16, align: 'right' });
  if (titleTime > 0 && levelIndex === 0) {
    banner(ctx, W, H, config.title, 'Pelaaja 1: W A S D   ·   Pelaaja 2: nuolet', Math.min(1, titleTime));
  }
  if (levelDoneTime > 0) banner(ctx, W, H, 'Taso läpi! 🎉', '', Math.min(1, levelDoneTime * 2));
  if (gameWon) banner(ctx, W, H, 'Voitit pelin! 🏆', `Pisteet: ${score} · Paina välilyöntiä aloittaaksesi alusta`);
  if (gameOver) banner(ctx, W, H, 'Peli loppui', 'Paina välilyöntiä yrittääksesi uudelleen');
}

// ---------------------------------------------------------------------------

loadLevel(levelIndex);
startGame({ width: W, height: H, update, draw });
