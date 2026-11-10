// Nopeat näpit – a tapping game for touch screens.
// Things pop out of holes; tap the good ones before they hide, don't touch the bad ones.
// The numbers and emoji are in config.ts.

import { startGame } from '@kit/loop';
import { touch, type Tap } from '@kit/touch';
import { input } from '@kit/input';
import { sfx } from '@kit/sound';
import { drawEmoji } from '@kit/sprites';
import { particles, fx } from '@kit/particles';
import { text, hud, banner, bar } from '@kit/ui';
import { themes } from '@kit/themes';
import { storage } from '@kit/storage';
import { config, type ThingDef } from './config';

const W = 960;
const H = 540;
const theme = themes[config.theme];
const SIZE = config.size;
const HOLES = config.holes.columns * config.holes.rows;

/** A thing that is out of its hole. */
interface Out {
  hole: number;
  def: ThingDef;
  /** Seconds it has been out. */
  age: number;
  /** Seconds it stays out. */
  life: number;
  tapped: boolean;
  /** Hiding back into the hole (tapped or time ran out). */
  leaving: boolean;
  leaveAge: number;
}

/** A number that floats up, e.g. "+3". */
interface Popup { x: number; y: number; text: string; color: string; age: number }

type Phase = 'alku' | 'peli' | 'loppu';

let phase: Phase = 'alku';
let out: Out[] = [];
let popups: Popup[] = [];
let score = 0;
let streak = 0; // hits in a row
let timeLeft = config.roundSeconds;
let nextIn = 0;
let endAge = 0;
let best = storage.load('best', 0);
let newRecord = false;

// ---- Holes ----------------------------------------------------------------

/** Where hole number i is (the middle of its opening). */
function holePos(i: number) {
  const { columns, rows } = config.holes;
  const c = i % columns;
  const r = Math.floor(i / columns);
  const x = ((c + 0.5) * W) / columns;
  const y = rows > 1 ? 190 + (r * 300) / (rows - 1) : 330;
  return { x, y };
}

/** Where the thing in hole i is drawn (a bit above the opening). */
function thingPos(i: number) {
  const h = holePos(i);
  return { x: h.x, y: h.y - SIZE * 0.4 };
}

// ---- Round ------------------------------------------------------------------

/** A new round from the start (also "Aloita alusta" in the ⚙️ menu). */
function startRound() {
  phase = 'peli';
  out = [];
  popups = [];
  score = 0;
  streak = 0;
  timeLeft = config.roundSeconds;
  nextIn = 0.5;
  newRecord = false;
  particles.clear();
  sfx('click');
}

function endRound() {
  phase = 'loppu';
  endAge = 0;
  for (const o of out) o.leaving = true;
  newRecord = score > best;
  best = storage.highScore(score);
  sfx('win');
  if (newRecord) particles.confetti(W / 2, H / 2);
}

/** How far the round is: 0 at the start, 1 at the end. Things get faster. */
function progress() {
  return 1 - timeLeft / config.roundSeconds;
}

function between(range: { start: number; end: number }) {
  return range.start + (range.end - range.start) * progress();
}

/** Points grow when you hit many in a row: ×1, ×2, ×3 … */
function multiplier() {
  return Math.min(config.maxMultiplier, 1 + Math.floor(streak / config.comboEvery));
}

// ---- Things popping out -------------------------------------------------------

/** Picks a random thing; things with a bigger `chance` come more often. */
function pickThing(): ThingDef {
  const total = config.things.reduce((sum, t) => sum + t.chance, 0);
  let r = Math.random() * total;
  for (const t of config.things) {
    r -= t.chance;
    if (r <= 0) return t;
  }
  return config.things[0];
}

function popOut() {
  const busy = new Set(out.map((o) => o.hole));
  const free = [...Array(HOLES).keys()].filter((i) => !busy.has(i));
  if (free.length === 0) return;
  const hole = free[Math.floor(Math.random() * free.length)];
  out.push({ hole, def: pickThing(), age: 0, life: between(config.stayOut), tapped: false, leaving: false, leaveAge: 0 });
}

function updateOut(dt: number) {
  for (const o of out) {
    o.age += dt;
    if (o.leaving) o.leaveAge += dt;
    else if (o.age >= o.life) {
      o.leaving = true;
      // A good one got away: the row of hits starts again.
      if (o.def.points > 0 && phase === 'peli') streak = 0;
    }
  }
  out = out.filter((o) => !(o.leaving && o.leaveAge > 0.15));
}

// ---- Tapping ------------------------------------------------------------------

function tapAt(tap: Tap) {
  // The closest thing under the finger (a little generous for small fingers).
  let hit: Out | null = null;
  let bestDist = SIZE * 0.7;
  for (const o of out) {
    if (o.leaving) continue;
    const p = thingPos(o.hole);
    const d = Math.hypot(tap.x - p.x, tap.y - p.y);
    if (d < bestDist) { bestDist = d; hit = o; }
  }
  if (!hit) {
    particles.dust(tap.x, tap.y);
    return;
  }
  hit.tapped = true;
  hit.leaving = true;
  const p = thingPos(hit.hole);
  if (hit.def.points > 0) hitGood(hit.def, p.x, p.y);
  else hitBad(hit.def, p.x, p.y);
}

function hitGood(def: ThingDef, x: number, y: number) {
  streak++;
  const points = def.points * multiplier();
  score += points;
  sfx(def.sound, { pitch: 1 + Math.min(streak, 20) * 0.03 });
  particles.burst(x, y, { color: '#ffd93d', count: 14, speed: 260 });
  popups.push({ x, y: y - 30, text: `+${points}`, color: '#ffe066', age: 0 });
  if (streak > 0 && streak % config.comboEvery === 0 && multiplier() > 1) {
    popups.push({ x, y: y - 70, text: `×${multiplier()}!`, color: '#7cf0ff', age: 0 });
  }
}

/** Oops – a thing you shouldn't touch. */
function hitBad(def: ThingDef, x: number, y: number) {
  streak = 0;
  score = Math.max(0, score + def.points);
  sfx(def.sound);
  fx.shake(10, 250);
  fx.flash('#ff4d4d', 120);
  particles.burst(x, y, { emoji: '💥', count: 4, speed: 160, size: 26 });
  popups.push({ x, y: y - 30, text: `${def.points}`, color: '#ff6b6b', age: 0 });
}

// ---- update & draw --------------------------------------------------------------

function wantsToStart(taps: Tap[]) {
  return taps.length > 0 || input.keyPressed('Space') || input.keyPressed('Enter');
}

function update(dt: number) {
  const taps = touch.taps();
  particles.update(dt);
  for (const p of popups) p.age += dt;
  popups = popups.filter((p) => p.age < 0.8);

  if (phase === 'loppu') endAge += dt;
  if (phase === 'alku' || (phase === 'loppu' && endAge > 1.2)) {
    if (wantsToStart(taps)) startRound();
    else { updateOut(dt); return; }
  }
  if (phase !== 'peli') { updateOut(dt); return; }

  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endRound();
    return;
  }

  nextIn -= dt;
  const active = out.filter((o) => !o.leaving).length;
  if (nextIn <= 0 && active < config.maxOut) {
    popOut();
    nextIn = between(config.appearEvery) * (0.7 + Math.random() * 0.6);
  }

  for (const tap of taps) tapAt(tap);
  updateOut(dt);
}

function drawHole(i: number) {
  const h = holePos(i);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(h.x, h.y + 6, SIZE * 0.62, SIZE * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.ground;
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, SIZE * 0.58, SIZE * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawThing(o: Out) {
  const p = thingPos(o.hole);
  const appear = Math.min(1, o.age / 0.12);
  const hide = o.leaving ? Math.max(0, 1 - o.leaveAge / 0.15) : 1;
  const s = appear * hide;
  drawEmoji(ctx, o.def.emoji, p.x, p.y + (1 - s) * SIZE * 0.4, SIZE, {
    scaleY: s, scaleX: 0.8 + 0.2 * s, flash: o.tapped && o.leaveAge < 0.06,
  });
  if (!o.leaving) {
    // The ring shows how long it stays out.
    ctx.save();
    ctx.strokeStyle = o.def.points > 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,90,90,0.85)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const left = 1 - o.age / o.life;
    ctx.arc(p.x, p.y, SIZE * 0.62, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function draw(c: CanvasRenderingContext2D) {
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  c.fillStyle = theme.groundTop;
  c.fillRect(0, 100, W, H - 100);

  for (let i = 0; i < HOLES; i++) drawHole(i);
  for (const o of out) drawThing(o);
  particles.draw(c);
  for (const p of popups) {
    text(c, p.text, p.x, p.y - p.age * 60, { size: 34, align: 'center', color: p.color, alpha: 1 - p.age / 0.8 });
  }

  const mult = multiplier();
  hud(c, W, {
    score,
    level: phase === 'peli' ? `⏱️ ${Math.ceil(timeLeft)}` : config.title,
    extra: phase === 'peli' && mult > 1 ? `×${mult} 🔥` : `🏆 ${best}`,
  });
  if (phase === 'peli') bar(c, 16, 52, W - 32, 8, timeLeft / config.roundSeconds, '#ffd93d');

  if (phase === 'alku') {
    const avoid = config.things.filter((t) => t.points < 0).map((t) => t.emoji).join(' ');
    banner(c, W, H, config.title, `Napauta ruutua aloittaaksesi${avoid ? ` · älä koske: ${avoid}` : ''}`);
  }
  if (phase === 'loppu') {
    const sub = newRecord ? 'Uusi ennätys! 🏆' : `Ennätys ${best}`;
    banner(c, W, H, `Aika loppui! ⭐ ${score}`, endAge > 1.2 ? `${sub} · napauta niin uusi kierros` : sub);
  }
}

const { ctx } = startGame({
  width: W,
  height: H,
  update,
  draw,
  restartGame: startRound,
  restartLevel: startRound,
  players: 1,
});
