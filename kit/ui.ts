// Text, score display and banners (shared kit file – used by every game).

const FONT = '"Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif';

export interface TextOptions {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  /** Dark outline around the letters so they show on any background (default true). */
  outline?: boolean;
  alpha?: number;
}

export function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, o: TextOptions = {}) {
  const size = o.size ?? 24;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'middle';
  if (o.outline !== false) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color ?? '#ffffff';
  ctx.fillText(str, x, y);
  ctx.restore();
}

export interface HudValues {
  score?: number;
  /** Lives left; leave out (or 0 lives in the config) for unlimited lives. */
  lives?: number;
  /** e.g. "Taso 2/3" */
  level?: string;
  /** Anything else, shown on the right, e.g. "🧀 3 jäljellä". */
  extra?: string;
}

/** The score line at the top of the screen. */
export function hud(ctx: CanvasRenderingContext2D, width: number, v: HudValues) {
  let x = 16;
  if (v.score !== undefined) { text(ctx, `⭐ ${v.score}`, x, 26, { size: 26 }); x += 140; }
  if (v.lives !== undefined) { text(ctx, '❤️'.repeat(Math.max(0, Math.min(v.lives, 10))), x, 26, { size: 22 }); }
  if (v.level) text(ctx, v.level, width / 2, 26, { size: 22, align: 'center' });
  if (v.extra) text(ctx, v.extra, width - 16, 26, { size: 22, align: 'right' });
}

/** A big centred title with an optional smaller line under it. alpha fades it. */
export function banner(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  title: string, subtitle = '', alpha = 1,
) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, height / 2 - 90, width, 180);
  ctx.restore();
  text(ctx, title, width / 2, height / 2 - 22, { size: 56, align: 'center', alpha });
  if (subtitle) text(ctx, subtitle, width / 2, height / 2 + 42, { size: 22, align: 'center', alpha, color: '#ffe9a8' });
}

/** A progress or health bar. fraction is 0–1. */
export function bar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  fraction: number, color = '#ff4d4d',
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
  ctx.restore();
}
