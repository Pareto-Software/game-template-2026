// Simple physics for tile-based games (locked kit file).
//
// Positions are the TOP-LEFT corner of a box, in pixels. Speeds are pixels per second.
// moveBody() moves a box and stops it at solid tiles; one-way tiles ("=")
// only stop a box that falls onto them from above.

export interface Body {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  /** Set by moveBody: standing on something. */
  onGround?: boolean;
  /** Set by moveBody: -1 hit a wall on the left, 1 on the right, 0 none. */
  hitWall?: number;
  /** Set by moveBody: bumped the head. */
  hitCeiling?: boolean;
}

export type TileKind = 'solid' | 'oneway' | null;

export interface TileWorld {
  /** Tile size in pixels. */
  tile: number;
  /** What is at this tile column/row? Outside the map should return 'solid' or null. */
  kindAt(col: number, row: number): TileKind;
}

export interface MoveOptions {
  /** Fall through one-way platforms (e.g. while holding down). */
  dropThrough?: boolean;
}

const EPS = 0.001;

export function moveBody(b: Body, world: TileWorld, dt: number, o: MoveOptions = {}) {
  const T = world.tile;
  b.hitWall = 0;
  b.hitCeiling = false;
  b.onGround = false;

  // Horizontal
  const dx = b.vx * dt;
  if (dx !== 0) {
    b.x += dx;
    const top = Math.floor(b.y / T);
    const bottom = Math.floor((b.y + b.h - EPS) / T);
    if (dx > 0) {
      const col = Math.floor((b.x + b.w - EPS) / T);
      for (let r = top; r <= bottom; r++) {
        if (world.kindAt(col, r) === 'solid') { b.x = col * T - b.w; b.vx = 0; b.hitWall = 1; break; }
      }
    } else {
      const col = Math.floor(b.x / T);
      for (let r = top; r <= bottom; r++) {
        if (world.kindAt(col, r) === 'solid') { b.x = (col + 1) * T; b.vx = 0; b.hitWall = -1; break; }
      }
    }
  }

  // Vertical
  const dy = b.vy * dt;
  const left = Math.floor(b.x / T);
  const right = Math.floor((b.x + b.w - EPS) / T);
  if (dy > 0) {
    const oldBottom = b.y + b.h;
    b.y += dy;
    const row = Math.floor((b.y + b.h - EPS) / T);
    for (let c = left; c <= right; c++) {
      const k = world.kindAt(c, row);
      const landsOnOneWay = k === 'oneway' && !o.dropThrough && oldBottom <= row * T + EPS;
      if (k === 'solid' || landsOnOneWay) { b.y = row * T - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else if (dy < 0) {
    b.y += dy;
    const row = Math.floor(b.y / T);
    for (let c = left; c <= right; c++) {
      if (world.kindAt(c, row) === 'solid') { b.y = (row + 1) * T; b.vy = 0; b.hitCeiling = true; break; }
    }
  } else {
    // Not moving vertically: check if we are standing on something.
    const row = Math.floor((b.y + b.h + 1) / T);
    for (let c = left; c <= right; c++) {
      const k = world.kindAt(c, row);
      if (k === 'solid' || (k === 'oneway' && !o.dropThrough)) {
        if (Math.abs(b.y + b.h - row * T) < 1.5) { b.onGround = true; break; }
      }
    }
  }
}

/** Do two boxes overlap? */
export function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Distance between the centres of two boxes. */
export function distance(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
}
