// Particles and screen effects (locked kit file).
//
// particles.burst(x, y, ...) – a puff of dots or emoji at a world position
// particles.confetti(x, y)   – a big colourful celebration
// particles.dust(x, y)       – a small puff, e.g. when landing
// fx.shake(strength, ms)     – shake the whole screen
// fx.flash(color, ms)        – flash the whole screen
//
// Draw the particles inside your camera transform: particles.draw(ctx).

import { drawEmoji } from './sprites';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color?: string; emoji?: string; gravity: number; spin: number; angle: number;
}

export interface BurstOptions {
  /** Colour of the dots, e.g. '#ffd93d'. Ignored if emoji is given. */
  color?: string;
  /** Use an emoji instead of dots, e.g. '💥'. */
  emoji?: string;
  /** How many particles (default 12). */
  count?: number;
  /** Speed in pixels per second (default 200). */
  speed?: number;
  /** Lifetime in seconds (default 0.6). */
  life?: number;
  /** Size in pixels (default 6, emoji default 20). */
  size?: number;
  /** Gravity in pixels per second² (default 400). */
  gravity?: number;
}

const list: Particle[] = [];
const CONFETTI = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f1c'];

export const particles = {
  burst(x: number, y: number, o: BurstOptions = {}) {
    const count = o.count ?? 12;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (o.speed ?? 200) * (0.4 + Math.random() * 0.8);
      const life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life, maxLife: life, size: o.size ?? (o.emoji ? 20 : 6),
        color: o.color ?? '#ffffff', emoji: o.emoji, gravity: o.gravity ?? 400,
        spin: (Math.random() - 0.5) * 10, angle: 0,
      });
    }
  },

  confetti(x: number, y: number, count = 80) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const s = 300 + Math.random() * 400;
      const life = 1.2 + Math.random() * 1;
      list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life,
        size: 5 + Math.random() * 5, color: CONFETTI[i % CONFETTI.length],
        gravity: 600, spin: (Math.random() - 0.5) * 20, angle: Math.random() * 6,
      });
    }
  },

  dust(x: number, y: number) {
    particles.burst(x, y, { color: 'rgba(255,255,255,0.8)', count: 6, speed: 90, life: 0.35, size: 5, gravity: -50 });
  },

  update(dt: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0) list.splice(i, 1);
    }
  },

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of list) {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife * 1.5));
      if (p.emoji) {
        drawEmoji(ctx, p.emoji, p.x, p.y, p.size, { alpha, rotate: p.angle });
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color!;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }
  },

  clear() {
    list.length = 0;
  },
};

let shakeLeft = 0;
let shakeTotal = 0;
let shakeStrength = 0;
let flashLeft = 0;
let flashTotal = 0;
let flashColor = '#fff';

export const fx = {
  /** Shake the screen. strength in pixels (e.g. 8), ms in milliseconds (e.g. 250). */
  shake(strength = 8, ms = 250) {
    shakeStrength = Math.max(shakeStrength * (shakeLeft > 0 ? 1 : 0), strength);
    shakeLeft = shakeTotal = ms / 1000;
  },
  /** Flash the screen with a colour, e.g. fx.flash('#fff', 120). */
  flash(color = '#ffffff', ms = 120) {
    flashColor = color;
    flashLeft = flashTotal = ms / 1000;
  },
  update(dt: number) {
    shakeLeft = Math.max(0, shakeLeft - dt);
    flashLeft = Math.max(0, flashLeft - dt);
  },
  shakeOffset() {
    if (shakeLeft <= 0) return { x: 0, y: 0 };
    const k = shakeStrength * (shakeLeft / shakeTotal);
    return { x: (Math.random() * 2 - 1) * k, y: (Math.random() * 2 - 1) * k };
  },
  drawFlash(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (flashLeft <= 0) return;
    ctx.save();
    ctx.globalAlpha = (flashLeft / flashTotal) * 0.6;
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};
