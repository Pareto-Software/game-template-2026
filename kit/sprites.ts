// Drawing emoji and simple shapes (shared kit file – used by every game).
//
// drawEmoji(ctx, '🐱', x, y, size)  – draws an emoji centred on (x, y).
//   options: flipX (mirror), rotate (radians), alpha (0–1), scaleX / scaleY
//   (squash and stretch), flash (draw it white, e.g. when hit).
//
// Emoji look a little different on Mac, Windows and phones. Many animal emoji
// face LEFT (🐌 🐈 🐕 🐎 🦖 🐉 …): give those `facesLeft: true` in the game config
// so they are mirrored the right way.
//
// Instead of an emoji, `char` can be a picture file: 'kuvat/limamoykky.svg'
// (see kit/art.ts). Pictures face right.

import { isMissing, isPicture, picture } from './art';

const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const cache = new Map<string, HTMLCanvasElement>();

/** Draws a picture file so it fits in a px × px square centred on (x, y). */
function drawPicture(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, px: number) {
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const s = px / Math.max(w, h);
  g.drawImage(img, x - (w * s) / 2, y - (h * s) / 2, w * s, h * s);
}

/** The emoji or picture on its own small canvas, or null while a picture is still loading. */
function render(char: string, px: number, white: boolean): HTMLCanvasElement | null {
  const key = `${char}|${px}|${white ? 'w' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let img: HTMLImageElement | null = null;
  if (isPicture(char)) {
    img = picture(char);
    if (!img) return isMissing(char) ? render('❓', px, white) : null;
  }
  const pad = Math.ceil(px * 0.25);
  const c = document.createElement('canvas');
  c.width = c.height = px + pad * 2;
  const g = c.getContext('2d')!;
  if (img) {
    drawPicture(g, img, c.width / 2, c.height / 2, px);
  } else {
    g.font = `${px}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Emoji sit a little high with textBaseline "middle"; nudge them down.
    g.fillText(char, c.width / 2, c.height / 2 + px * 0.07);
  }
  if (white) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, c);
  return c;
}

/** An emoji drawn on its own canvas (1.2 × px square), e.g. for a Phaser texture. */
export function emojiCanvas(char: string, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(px * 1.2);
  const g = c.getContext('2d')!;
  if (isPicture(char)) {
    // Phaser games: the picture must have loaded already (otherwise the canvas stays empty).
    const img = picture(char);
    if (img) drawPicture(g, img, c.width / 2, c.height / 2, px);
    return c;
  }
  g.font = `${px}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(char, c.width / 2, c.height / 2 + px * 0.07);
  return c;
}

export interface EmojiOptions {
  flipX?: boolean;
  rotate?: number;
  alpha?: number;
  scaleX?: number;
  scaleY?: number;
  flash?: boolean;
}

export function drawEmoji(
  ctx: CanvasRenderingContext2D,
  char: string,
  x: number,
  y: number,
  size: number,
  o: EmojiOptions = {},
) {
  // Render at double size (the canvas is drawn at 2× resolution) in steps of 4 px.
  const px = Math.max(8, Math.round((size * 2) / 4) * 4);
  const img = render(char, px, !!o.flash);
  if (!img) return; // a picture that is still loading
  const drawn = (img.width / px) * size;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y);
  if (o.rotate) ctx.rotate(o.rotate);
  ctx.scale((o.flipX ? -1 : 1) * (o.scaleX ?? 1), o.scaleY ?? 1);
  ctx.drawImage(img, -drawn / 2, -drawn / 2, drawn, drawn);
  ctx.restore();
}

/** A rectangle with rounded corners. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number, color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** A filled circle. */
export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
