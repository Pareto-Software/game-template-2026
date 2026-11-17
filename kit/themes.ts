// Ready-made looks for the games (shared kit file – used by every game).
//
// Pick one in games/<peli>/config.ts:  theme: 'talvi'
// Each theme has colours, a few background decorations and suggested emoji.

import { drawEmoji } from './sprites';

export type ThemeName = 'perus' | 'talvi' | 'avaruus' | 'viidakko' | 'laava' | 'meri';

export interface Theme {
  /** Sky colours from top to bottom. */
  skyTop: string;
  skyBottom: string;
  /** Ground and walls. */
  ground: string;
  /** The thin strip on top of the ground (grass, snow …). */
  groundTop: string;
  /** Jump-through platforms. */
  platform: string;
  /** Floor of a top-down maze. */
  floor: string;
  /** Walls of a top-down maze. */
  wall: string;
  /** Background decorations drawn far away (they move slowly). */
  decorations: string[];
  /** Things falling or twinkling in the air: 'snow', 'stars', 'bubbles', 'embers' or none. */
  weather?: 'snow' | 'stars' | 'bubbles' | 'embers';
  /** Suggested emoji for this theme. */
  ideas: { players: string[]; enemies: string[]; items: string[] };
}

export const themes: Record<ThemeName, Theme> = {
  perus: {
    skyTop: '#5ec8ff', skyBottom: '#c9f0ff', ground: '#8b5a2b', groundTop: '#5cc84a',
    platform: '#c08a4a', floor: '#e8dcc0', wall: '#6d4c2f',
    decorations: ['☁️', '🌳', '☁️', '🌷'],
    ideas: { players: ['🐱', '🐶', '🐸', '🐵'], enemies: ['🐌', '🐝', '🦔'], items: ['⭐', '🍎', '💎'] },
  },
  talvi: {
    skyTop: '#7fa8d8', skyBottom: '#e6f2ff', ground: '#8fa9c4', groundTop: '#ffffff',
    platform: '#b8d4ee', floor: '#eef6ff', wall: '#6f8fb0',
    decorations: ['🌲', '⛄', '🌲', '❄️'], weather: 'snow',
    ideas: { players: ['🐧', '🐻‍❄️', '🦊'], enemies: ['☃️', '🐺', '🦭'], items: ['❄️', '🎁', '🍪'] },
  },
  avaruus: {
    skyTop: '#05051a', skyBottom: '#2a1050', ground: '#4b4b6b', groundTop: '#9d9dff',
    platform: '#7070a0', floor: '#22223a', wall: '#5a5a8a',
    decorations: ['🪐', '🌙', '🛸', '☄️'], weather: 'stars',
    ideas: { players: ['👩‍🚀', '🤖', '👽'], enemies: ['👾', '🛸', '☄️'], items: ['⭐', '🔋', '💫'] },
  },
  viidakko: {
    skyTop: '#3fa06a', skyBottom: '#b8f0a0', ground: '#5a3d1e', groundTop: '#2f9e44',
    platform: '#8a6a3a', floor: '#cfe8b0', wall: '#2f6b2f',
    decorations: ['🌴', '🌿', '🦜', '🌺'],
    ideas: { players: ['🐵', '🐯', '🦎'], enemies: ['🐍', '🐊', '🕷️'], items: ['🍌', '🥥', '💎'] },
  },
  laava: {
    skyTop: '#2b0a0a', skyBottom: '#a33a12', ground: '#3a2a2a', groundTop: '#ff6a00',
    platform: '#6b3a2a', floor: '#4a2a20', wall: '#2a1a1a',
    decorations: ['🌋', '🔥', '🌋'], weather: 'embers',
    ideas: { players: ['🐲', '🤖', '🦖'], enemies: ['🔥', '👹', '🦂'], items: ['💎', '🔑', '🍖'] },
  },
  meri: {
    skyTop: '#0a3d6b', skyBottom: '#2a9dd8', ground: '#c2a060', groundTop: '#f0d890',
    platform: '#3aa0a0', floor: '#9fd8e8', wall: '#1d6b8a',
    decorations: ['🐠', '🪸', '🐚', '🐟'], weather: 'bubbles',
    ideas: { players: ['🐙', '🐬', '🧜'], enemies: ['🦈', '🦀', '🪼'], items: ['🐚', '💎', '🫧'] },
  },
};


/**
 * Draws the sky, slowly moving decorations and weather.
 * camX/camY: camera position in pixels; time: seconds.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D, theme: Theme, width: number, height: number,
  camX: number, camY: number, time: number,
) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, theme.skyTop);
  g.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Far decorations: parallax at 20 % of the camera speed.
  const gap = 260;
  const off = (camX * 0.2) % gap;
  const first = Math.floor((camX * 0.2) / gap);
  for (let i = -1; i < width / gap + 2; i++) {
    const n = first + i;
    const d = theme.decorations[((n % theme.decorations.length) + theme.decorations.length) % theme.decorations.length];
    const y = height * 0.25 + ((n * 97) % 5) * 28 - camY * 0.05;
    drawEmoji(ctx, d, i * gap - off + 80, y, 48, { alpha: 0.55 });
  }

  if (!theme.weather) return;
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const seed = i * 137.5;
    const x = ((seed * 7.3 - camX * 0.3) % width + width) % width;
    let y: number;
    switch (theme.weather) {
      case 'snow':
        y = (seed * 3.1 + time * (30 + (i % 5) * 10)) % height;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(x + Math.sin(time + i) * 8, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
        break;
      case 'stars':
        y = (seed * 5.7) % height;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(time * 2 + i)})`;
        ctx.fillRect(x, y, 2, 2);
        break;
      case 'bubbles':
        y = height - ((seed * 3.1 + time * (25 + (i % 4) * 10)) % height);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(x + Math.sin(time + i) * 6, y, 3 + (i % 4), 0, Math.PI * 2); ctx.stroke();
        break;
      case 'embers':
        y = height - ((seed * 3.1 + time * (40 + (i % 4) * 15)) % height);
        ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},0,0.8)`;
        ctx.fillRect(x + Math.sin(time * 2 + i) * 10, y, 3, 3);
        break;
    }
  }
  ctx.restore();
}
