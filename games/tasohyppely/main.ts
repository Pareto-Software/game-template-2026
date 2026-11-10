// 🎮 TASOHYPPELY – the game logic. Numbers and emoji live in config.ts,
// the level maps in levels.ts. See README.md for which function does what.

import { startGame, hitStop } from '@kit/loop';
import { input, type PlayerNumber } from '@kit/input';
import { sfx } from '@kit/sound';
import { drawEmoji } from '@kit/sprites';
import { moveBody, overlap, distance, type TileWorld } from '@kit/physics';
import { particles, fx } from '@kit/particles';
import { text, hud, banner, bar } from '@kit/ui';
import { themes, drawBackground } from '@kit/themes';
import { storage } from '@kit/storage';
import { dev } from '@kit/dev';
import { config, type ThingDef, type TileDef, type Power } from './config';
import { levels } from './levels';

const T = 40; // tile size in pixels
const W = 960;
const H = 540;
const theme = themes[config.theme] ?? themes.perus;

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

interface Player {
  n: PlayerNumber;
  active: boolean;
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  onGround: boolean;
  facing: 1 | -1;
  coyote: number;       // seconds left where a jump still works after leaving ground
  jumpBuffer: number;   // seconds left where an early jump press still counts
  airJumps: number;     // extra jumps left (double jump)
  jumping: boolean;     // rising from the player's own jump (letting go makes it lower)
  safeTime: number;     // blinking, can't be hurt
  safeX: number; safeY: number; // last safe place to stand, for respawning
  groundTime: number;
  squashX: number; squashY: number;
  shootCooldown: number;
  powers: Set<Power>;
}

interface Thing {
  key: string;
  def: ThingDef;
  x: number; y: number; w: number; h: number; vx: number; vy: number;
  startX: number; startY: number;
  dir: 1 | -1;
  hp: number;
  timer: number;
  cooldown: number;     // seconds until it can shoot again
  flash: number;
  life: number;         // seconds left (things that rain disappear after a while)
  falling: boolean;     // rained from the sky: falls until it lands
  onGround: boolean;
  hitWall?: number;
  dead: boolean;
}

interface Shot {
  x: number; y: number; vx: number; vy: number; size: number;
  emoji: string; fromPlayer: boolean; life: number;
}

let levelIndex = Math.min(dev.recall('platformer-level', 0), levels.length - 1);
let score = dev.recall('platformer-score', 0);
let lives = config.lives;
let map: string[] = [];
let cols = 0;
let rows = 0;
let things: Thing[] = [];
let shots: Shot[] = [];
let camX = 0;
let camY = 0;
let time = 0;
let titleTime = 3;          // the title fades out during the first seconds
let levelDoneTime = 0;      // > 0 while celebrating a finished level
let gameWon = false;
let gameOver = false;
let rainTimer = 0;
let godMode = false;
const warned = new Set<string>();

const players: Player[] = [makePlayer(1), makePlayer(2)];

function makePlayer(n: PlayerNumber): Player {
  const def = n === 1 ? config.player1 : config.player2;
  const size = def.size * T;
  return {
    n, active: n === 1,
    x: 0, y: 0, w: size * 0.7, h: size * 0.85, vx: 0, vy: 0,
    onGround: false, facing: 1, coyote: 0, jumpBuffer: 0, airJumps: 0, jumping: false,
    safeTime: 0, safeX: 0, safeY: 0, groundTime: 0, squashX: 1, squashY: 1,
    shootCooldown: 0, powers: new Set(),
  };
}

function playerDef(p: Player) {
  return p.n === 1 ? config.player1 : config.player2;
}

function hasPower(p: Player, power: Power): boolean {
  if (p.powers.has(power)) return true;
  if (power === 'doubleJump') return config.doubleJump;
  if (power === 'fly') return config.canFly;
  if (power === 'shoot') return config.canShoot;
  return false;
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
  shots = [];
  particles.clear();
  levelDoneTime = 0;
  let found2 = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      if (ch === ' ' || ch === '.') continue;
      if (ch === '1' || ch === '2') {
        const p = players[Number(ch) - 1];
        p.safeX = c * T + (T - p.w) / 2;
        p.safeY = (r + 1) * T - p.h;
        if (ch === '2') found2 = true;
        clearCell(r, c);
      } else if (config.things[ch]) {
        spawn(ch, c * T + T / 2, (r + 1) * T);
        clearCell(r, c);
      } else if (!config.tiles[ch]) {
        if (!warned.has(ch)) console.warn(`Unknown letter "${ch}" in the level map – treated as empty.`);
        warned.add(ch);
        clearCell(r, c);
      }
    }
  }
  if (!found2) { players[1].safeX = players[0].safeX; players[1].safeY = players[0].safeY; }
  for (const p of players) respawn(p, false);
  camX = players[0].x - W / 2;
  camY = rows * T - H;
  dev.keep('platformer-level', levelIndex);
}

function clearCell(r: number, c: number) {
  map[r] = map[r].slice(0, c) + ' ' + map[r].slice(c + 1);
}

function tileAt(c: number, r: number): TileDef | null {
  if (r < 0 || c < 0 || c >= cols || r >= rows) return null;
  return config.tiles[map[r][c]] ?? null;
}

const world: TileWorld = {
  tile: T,
  kindAt(c, r) {
    if (c < 0 || c >= cols) return 'solid'; // invisible walls at the level edges
    return tileAt(c, r)?.kind ?? null;
  },
};

/** Put a new thing into the level. x is its centre, bottom is where its feet are. */
function spawn(key: string, x: number, bottom: number): Thing | null {
  const def = config.things[key];
  if (!def) return null;
  const size = (def.size ?? 0.8) * T;
  const w = size * 0.75;
  const h = size * 0.75;
  const t: Thing = {
    key, def, x: x - w / 2, y: bottom - h, w, h, vx: 0, vy: 0,
    startX: x - w / 2, startY: bottom - h, dir: -1, hp: def.hp ?? 1,
    timer: Math.random() * 2, cooldown: def.shoots?.every ?? 0, flash: 0, life: Infinity,
    falling: false, onGround: false, dead: false,
  };
  things.push(t);
  return t;
}

/** Fire a shot from (x, y) in direction (dx, dy). */
function shoot(x: number, y: number, dx: number, dy: number, emoji: string, speed: number, size: number, fromPlayer: boolean) {
  const len = Math.hypot(dx, dy) || 1;
  shots.push({
    x, y, vx: (dx / len) * speed * T, vy: (dy / len) * speed * T, size: size * T,
    emoji, fromPlayer, life: 3,
  });
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

function respawn(p: Player, hurt: boolean) {
  p.x = p.safeX;
  p.y = p.safeY;
  p.vx = 0;
  p.vy = 0;
  if (hurt) p.safeTime = config.safeTime;
}

function hurtPlayer(p: Player) {
  if (p.safeTime > 0 || godMode || levelDoneTime > 0) return;
  sfx('hit');
  fx.shake(10, 300);
  hitStop(80);
  particles.burst(p.x + p.w / 2, p.y + p.h / 2, { color: '#ff5252', count: 16 });
  if (config.lives > 0) {
    lives--;
    if (lives <= 0) {
      gameOver = true;
      sfx('lose');
      return;
    }
  }
  respawn(p, true);
}

function updatePlayer(p: Player, dt: number) {
  const inp = input.player(p.n);
  if (!p.active) {
    if (inp.jumpPressed || inp.x !== 0) {
      // Player 2 joins next to player 1
      const other = players[0];
      p.active = true;
      p.x = other.x; p.y = other.y - 4; p.safeX = other.safeX; p.safeY = other.safeY;
      p.safeTime = 1;
      sfx('powerup');
    }
    return;
  }
  const def = playerDef(p);
  const big = p.powers.has('big') ? 1.5 : 1;
  const speed = def.speed * T * (p.powers.has('fast') ? 1.6 : 1);
  const gravity = config.gravity * T;
  const jumpSpeed = Math.sqrt(2 * gravity * def.jumpTiles * T);

  // Running, with a little acceleration so it feels smooth (and very little on ice)
  const target = inp.x * speed;
  const under = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 2) / T));
  const accel = (p.onGround ? (under?.slippery ? 6 : 60) : 35) * T;
  if (p.vx < target) p.vx = Math.min(target, p.vx + accel * dt);
  if (p.vx > target) p.vx = Math.max(target, p.vx - accel * dt);
  if (inp.x !== 0) p.facing = inp.x > 0 ? 1 : -1;

  // Jumping: coyote time + jump buffer make jumps forgiving
  p.coyote = p.onGround ? 0.1 : p.coyote - dt;
  p.jumpBuffer = inp.jumpPressed ? 0.12 : p.jumpBuffer - dt;
  if (p.onGround) p.airJumps = hasPower(p, 'doubleJump') ? 1 : 0;
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = -jumpSpeed;
    p.jumping = true;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.squashX = 0.75; p.squashY = 1.3;
    sfx('jump');
  } else if (inp.jumpPressed && p.airJumps > 0 && !hasPower(p, 'fly')) {
    p.airJumps--;
    p.vy = -jumpSpeed * 0.9;
    p.jumping = true;
    p.jumpBuffer = 0;
    particles.burst(p.x + p.w / 2, p.y + p.h, { color: '#ffffff', count: 8, speed: 120 });
    sfx('jump', { pitch: 1.3 });
  }
  // Let go of jump early = a smaller jump (not after trampolines and stomps)
  if (p.vy >= 0) p.jumping = false;
  if (p.jumping && !inp.jump && p.vy < -jumpSpeed * 0.4 && !hasPower(p, 'fly')) p.vy = -jumpSpeed * 0.4;

  // Flying: hold jump to go up
  if (hasPower(p, 'fly') && inp.jump) p.vy = Math.max(p.vy - gravity * 2.2 * dt, -speed);

  p.vy = Math.min(p.vy + gravity * dt, 20 * T);
  const wasOnGround = p.onGround;
  const fallSpeed = p.vy;
  p.w = def.size * T * 0.7 * big;
  p.h = def.size * T * 0.85 * big;
  moveBody(p, world, dt, { dropThrough: inp.y > 0 });
  p.onGround = !!p.onGround;

  // Landing: squash + dust
  if (p.onGround && !wasOnGround && fallSpeed > 300) {
    p.squashX = 1.25; p.squashY = 0.8;
    particles.dust(p.x + p.w / 2, p.y + p.h);
  }
  p.squashX += (1 - p.squashX) * Math.min(1, dt * 12);
  p.squashY += (1 - p.squashY) * Math.min(1, dt * 12);

  // Remember a safe spot to come back to after getting hurt
  p.groundTime = p.onGround ? p.groundTime + dt : 0;
  if (p.groundTime > 0.3 && !touchesHurtTile(p)) { p.safeX = p.x; p.safeY = p.y; }

  // Shooting
  p.shootCooldown -= dt;
  if (hasPower(p, 'shoot') && inp.actionPressed && p.shootCooldown <= 0) {
    p.shootCooldown = 0.25;
    shoot(p.x + p.w / 2, p.y + p.h / 2, p.facing, 0, config.shot.emoji, config.shot.speed, config.shot.size, true);
    sfx('shoot');
  }

  p.safeTime = Math.max(0, p.safeTime - dt);
  if (touchesHurtTile(p)) hurtPlayer(p);
  if (p.y > rows * T + 200) hurtPlayer(p); // fell out of the level
  if (p.y > rows * T + 200) respawn(p, true); // god mode: still come back
}

function touchesHurtTile(b: { x: number; y: number; w: number; h: number }): boolean {
  // Spikes and lava: a little forgiveness (4 px). Solid hurting blocks: touching them is enough.
  const pad = 4;
  for (let r = Math.floor((b.y - 1) / T); r <= Math.floor((b.y + b.h + 1) / T); r++) {
    for (let c = Math.floor((b.x - 1) / T); c <= Math.floor((b.x + b.w + 1) / T); c++) {
      const tile = tileAt(c, r);
      if (!tile?.hurt) continue;
      if (tile.kind === 'solid') return true;
      const inside = b.x + pad < (c + 1) * T && b.x + b.w - pad > c * T && b.y + pad < (r + 1) * T && b.y + b.h - pad > r * T;
      if (inside) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Things (enemies, stars, power-ups …)
// ---------------------------------------------------------------------------

function nearestPlayer(t: Thing): Player | null {
  let best: Player | null = null;
  let bestD = Infinity;
  for (const p of players) {
    if (!p.active) continue;
    const d = distance(p, t);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function updateThing(t: Thing, dt: number) {
  const def = t.def;
  const speed = (def.speed ?? 2) * T;
  const gravity = config.gravity * T;
  t.timer += dt;
  t.flash = Math.max(0, t.flash - dt);
  t.life -= dt;
  if (t.life <= 0) { t.dead = true; return; }

  switch (t.falling ? 'fall' : def.moves ?? 'still') {
    case 'still':
      break;
    case 'walk':
    case 'hop': {
      t.vx = t.dir * speed;
      // Turn around at the edge of a platform
      const frontX = t.dir > 0 ? t.x + t.w + 2 : t.x - 2;
      const below = world.kindAt(Math.floor(frontX / T), Math.floor((t.y + t.h + 4) / T));
      if (t.onGround && below === null) t.dir = t.dir > 0 ? -1 : 1;
      if (def.moves === 'hop' && t.onGround && t.timer > 1.2) { t.vy = -Math.sqrt(2 * gravity * 2 * T); t.timer = 0; }
      t.vy = Math.min(t.vy + gravity * dt, 20 * T);
      moveBody(t, world, dt);
      t.onGround = !!t.onGround;
      if (t.hitWall) t.dir = t.hitWall > 0 ? -1 : 1;
      break;
    }
    case 'fly': {
      t.vx = t.dir * speed;
      t.vy = Math.sin(t.timer * 3) * T;
      moveBody(t, world, dt);
      if (t.hitWall || Math.abs(t.x - t.startX) > 4 * T) {
        t.dir = t.x > t.startX ? -1 : 1;
      }
      break;
    }
    case 'chase': {
      const p = nearestPlayer(t);
      if (p && distance(p, t) < 9 * T) {
        const dx = p.x - t.x, dy = p.y - t.y, len = Math.hypot(dx, dy) || 1;
        t.vx = (dx / len) * speed;
        t.vy = (dy / len) * speed;
        t.dir = dx > 0 ? 1 : -1;
      } else { t.vx *= 0.9; t.vy *= 0.9; }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      break;
    }
    case 'fall': {
      t.vy = Math.min(t.vy + gravity * 0.5 * dt, 8 * T);
      moveBody(t, world, dt);
      if (t.onGround) t.falling = false; // landed: from now on it moves its own way
      break;
    }
  }

  t.cooldown -= dt;
  if (def.shoots && levelDoneTime === 0 && t.cooldown <= 0) {
    const p = nearestPlayer(t);
    if (p && distance(p, t) < 12 * T) {
      t.cooldown = def.shoots.every;
      // Aim from the middle of the thing at the middle of the player
      const fromX = t.x + t.w / 2, fromY = t.y + t.h / 2;
      shoot(fromX, fromY, p.x + p.w / 2 - fromX, p.y + p.h / 2 - fromY, def.shoots.emoji, def.shoots.speed ?? 6, 0.6, false);
      sfx('shoot', { pitch: 0.7, volume: 0.6 });
    }
  }
  if (t.y > rows * T + 400) t.dead = true;
}

function damageThing(t: Thing, amount: number) {
  if (t.flash > 0) return; // just got hit – a short moment to recover
  t.hp -= amount;
  t.flash = 0.3;
  hitStop(50);
  if (t.hp <= 0) {
    t.dead = true;
    score += t.def.score ?? 0;
    particles.burst(t.x + t.w / 2, t.y + t.h / 2, { emoji: '💥', count: 6, speed: 150 });
    sfx(t.def.sound ?? (t.def.boss ? 'boom' : 'bounce'));
    if (t.def.boss) { sfx('boom'); fx.shake(14, 500); }
  } else {
    sfx('hit', { pitch: 1.4 });
  }
}

/** What happens when a player touches a thing. */
function touchThing(p: Player, t: Thing) {
  const def = t.def;
  const jumpSpeed = Math.sqrt(2 * config.gravity * T * playerDef(p).jumpTiles * T);
  switch (def.touch) {
    case 'collect':
      t.dead = true;
      score += def.score ?? 0;
      particles.burst(t.x + t.w / 2, t.y + t.h / 2, { color: '#ffd93d', count: 10, speed: 160 });
      sfx(def.sound ?? 'coin');
      break;
    case 'power':
      t.dead = true;
      if (def.power) p.powers.add(def.power);
      particles.burst(t.x + t.w / 2, t.y + t.h / 2, { emoji: '✨', count: 8 });
      fx.flash('#ffffff', 150);
      sfx(def.sound ?? 'powerup');
      break;
    case 'bounce':
      if (p.vy > 0) {
        p.vy = -jumpSpeed * 1.5;
        p.squashX = 0.7; p.squashY = 1.4;
        sfx('bounce');
      }
      break;
    case 'stomp': {
      const falling = p.vy > 0 && p.y + p.h - p.vy / 60 <= t.y + t.h * 0.5;
      if (falling) {
        p.y = t.y - p.h; // lift the player off, so the next frame doesn't count as a side hit
        p.vy = -jumpSpeed * 0.7;
        damageThing(t, 1);
      } else {
        hurtPlayer(p);
      }
      break;
    }
    case 'hurt':
      hurtPlayer(p);
      break;
    case 'win':
      if (levelDoneTime === 0) finishLevel(t);
      break;
  }
}

function finishLevel(t: Thing) {
  levelDoneTime = 2;
  particles.confetti(t.x + t.w / 2, t.y);
  sfx('win');
  dev.keep('platformer-score', score);
}

function updateShots(dt: number) {
  for (const s of shots) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    const box = { x: s.x - s.size / 3, y: s.y - s.size / 3, w: s.size / 1.5, h: s.size / 1.5 };
    if (world.kindAt(Math.floor(s.x / T), Math.floor(s.y / T)) === 'solid') s.life = 0;
    if (s.fromPlayer) {
      for (const t of things) {
        if (!t.dead && (t.def.touch === 'stomp' || t.def.touch === 'hurt') && overlap(box, t)) {
          damageThing(t, 1);
          s.life = 0;
          break;
        }
      }
    } else {
      for (const p of players) if (p.active && overlap(box, p)) { hurtPlayer(p); s.life = 0; }
    }
  }
  shots = shots.filter((s) => s.life > 0);
}

// ---------------------------------------------------------------------------
// The main update, 60 times per second
// ---------------------------------------------------------------------------

function update(dt: number) {
  time += dt;
  titleTime -= dt;
  dev.keep('platformer-score', score);

  // Adult keys: Shift+N next level, Shift+G god mode, Shift+R restart level
  if (input.keyPressed('KeyN', { shift: true })) { loadLevel((levelIndex + 1) % levels.length); return; }
  if (input.keyPressed('KeyG', { shift: true })) godMode = !godMode;
  if (input.keyPressed('KeyR', { shift: true })) { loadLevel(levelIndex); return; }

  if (gameOver || gameWon) {
    if (input.player(1).jumpPressed || input.player(2).jumpPressed) restartGame();
    particles.update(dt);
    return;
  }

  for (const p of players) updatePlayer(p, dt);
  for (const t of things) updateThing(t, dt);
  updateShots(dt);

  for (const p of players) {
    if (!p.active) continue;
    for (const t of things) {
      if (!t.dead && overlap(p, t)) touchThing(p, t);
    }
  }
  things = things.filter((t) => !t.dead);

  // Rain things from the sky
  if (config.rain.every > 0) {
    rainTimer -= dt;
    if (rainTimer <= 0) {
      rainTimer = config.rain.every;
      const t = spawn(config.rain.thing, camX + Math.random() * W, camY - T);
      if (t) { t.falling = true; t.life = 8; } // falls down, disappears after 8 seconds
    }
  }

  if (levelDoneTime > 0) {
    levelDoneTime -= dt;
    if (levelDoneTime <= 0) {
      if (levelIndex + 1 < levels.length) loadLevel(levelIndex + 1);
      else { gameWon = true; storage.highScore(score, 'platformer-best'); particles.confetti(camX + W / 2, camY + H / 2, 150); }
    }
  }

  updateCamera(dt);
  particles.update(dt);
}

function restartGame() {
  score = 0;
  lives = config.lives;
  gameOver = false;
  gameWon = false;
  for (const p of players) p.powers.clear();
  dev.keep('platformer-score', 0);
  loadLevel(0);
}

function updateCamera(dt: number) {
  const active = players.filter((p) => p.active);
  // If one player is left far behind, bring them to the other one's last safe spot.
  if (active.length === 2) {
    const [a, b] = active;
    const [behind, ahead] = a.x < b.x ? [a, b] : [b, a];
    if (ahead.x - behind.x > W * 0.85 && ahead.onGround) {
      behind.x = ahead.safeX; behind.y = ahead.safeY; behind.vx = 0; behind.vy = 0;
      behind.safeTime = 1;
      particles.burst(behind.x + behind.w / 2, behind.y + behind.h / 2, { emoji: '✨', count: 6 });
    }
  }
  const cx = active.reduce((s, p) => s + p.x + p.w / 2, 0) / active.length;
  const cy = active.reduce((s, p) => s + p.y + p.h / 2, 0) / active.length;
  const targetX = Math.max(0, Math.min(cols * T - W, cx - W / 2));
  const targetY = Math.min(rows * T - H, cy - H * 0.55);
  camX += (targetX - camX) * Math.min(1, dt * 6);
  camY += (targetY - camY) * Math.min(1, dt * 4);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function draw(ctx: CanvasRenderingContext2D) {
  drawBackground(ctx, theme, W, H, camX, camY, time);
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  drawTiles(ctx);
  for (const t of things) drawThing(ctx, t);
  for (const s of shots) drawEmoji(ctx, s.emoji, s.x, s.y, s.size, { rotate: time * 10 });
  for (const p of players) drawPlayer(ctx, p);
  particles.draw(ctx);
  ctx.restore();
  drawHud(ctx);
}

function drawTiles(ctx: CanvasRenderingContext2D) {
  const c0 = Math.max(0, Math.floor(camX / T));
  const c1 = Math.min(cols - 1, Math.floor((camX + W) / T));
  const r0 = Math.max(0, Math.floor(camY / T));
  const r1 = Math.min(rows - 1, Math.floor((camY + H) / T));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = tileAt(c, r);
      if (!tile) continue;
      const x = c * T, y = r * T;
      switch (tile.look) {
        case 'ground': {
          ctx.fillStyle = theme.ground;
          ctx.fillRect(x, y, T, T);
          const above = tileAt(c, r - 1);
          if (!above || above.look !== 'ground') {
            ctx.fillStyle = theme.groundTop;
            ctx.fillRect(x, y, T, 9);
          }
          break;
        }
        case 'platform':
          ctx.fillStyle = theme.platform;
          ctx.beginPath(); ctx.roundRect(x, y, T, 14, 5); ctx.fill();
          break;
        case 'lava': {
          ctx.fillStyle = '#ff5a1f';
          ctx.fillRect(x, y + 6, T, T - 6);
          ctx.fillStyle = '#ffb02e';
          const wave = Math.sin(time * 4 + c) * 3;
          ctx.fillRect(x, y + 6 + wave, T, 6);
          break;
        }
        default:
          drawEmoji(ctx, tile.look, x + T / 2, y + T / 2, T);
      }
    }
  }
}

function drawThing(ctx: CanvasRenderingContext2D, t: Thing) {
  const size = (t.def.size ?? 0.8) * T;
  const bob = t.def.bob ? Math.sin(time * 3 + t.startX) * 4 : 0;
  const flip = t.def.facesLeft ? t.dir > 0 : t.dir < 0;
  drawEmoji(ctx, t.def.emoji, t.x + t.w / 2, t.y + t.h - size / 2 + bob + size * 0.12, size, { flipX: flip, flash: t.flash > 0 });
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
  if (!p.active) return;
  if (p.safeTime > 0 && Math.floor(p.safeTime * 12) % 2 === 0) return; // blink
  const def = playerDef(p);
  const size = def.size * T * (p.powers.has('big') ? 1.5 : 1);
  const flip = def.facesLeft ? p.facing > 0 : p.facing < 0;
  // Squash and stretch from the feet
  const sy = p.squashY;
  drawEmoji(ctx, def.emoji, p.x + p.w / 2, p.y + p.h - (size / 2) * sy + size * 0.1, size, {
    flipX: flip, scaleX: p.squashX, scaleY: sy,
  });
  if (godMode) text(ctx, 'GOD', p.x + p.w / 2, p.y - 12, { size: 12, align: 'center' });
}

function drawHud(ctx: CanvasRenderingContext2D) {
  hud(ctx, W, {
    score,
    lives: config.lives > 0 ? lives : undefined,
    level: `Taso ${levelIndex + 1}/${levels.length}`,
    extra: players[1].active ? '' : 'Pelaaja 2: paina ↑',
  });
  // Boss health bar, when a boss is near
  const boss = things.find((t) => t.def.boss && Math.abs(t.x - (camX + W / 2)) < W);
  if (boss) {
    bar(ctx, W / 2 - 150, 52, 300, 14, boss.hp / (boss.def.hp ?? 1));
    drawEmoji(ctx, boss.def.emoji, W / 2 - 172, 59, 26);
  }
  if (titleTime > 0 && levelIndex === 0) {
    banner(ctx, W, H, config.title, 'Pelaaja 1: A D + W   ·   Pelaaja 2: ← → + ↑', Math.min(1, titleTime));
  }
  if (levelDoneTime > 0) banner(ctx, W, H, 'Taso läpi! 🎉', '', Math.min(1, levelDoneTime * 2));
  if (gameWon) banner(ctx, W, H, 'Voitit pelin! 🏆', `Pisteet: ${score} · Paina hyppyä aloittaaksesi alusta`);
  if (gameOver) banner(ctx, W, H, 'Peli loppui', 'Paina hyppyä yrittääksesi uudelleen');
}

// ---------------------------------------------------------------------------

loadLevel(levelIndex);
startGame({ width: W, height: H, update, draw });
