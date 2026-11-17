// 🧠 SIMULAATIO – the rules of the game. Only the main screen runs this; phones
// just send commands and show what the main screen tells them.
// Also the shapes of everything stored in Firebase (shared with asemat.ts).

import { online } from '@kit/firebase';
import { config } from './config';

/** aula = waiting for the crew, matka = flying, perilla = arrived. */
export type Phase = 'aula' | 'matka' | 'perilla';

/** One phone in the room: rooms/<code>/players/<uid> */
export interface PlayerInfo {
  station: string;
  colour: string;
}

/** A tap sent by a phone: rooms/<code>/commands/<id> */
export interface Command {
  uid: string;
  station: string;
  action: string;
  value?: number | boolean | string;
}

/** Ohjaus's buttons: rooms/<code>/inputs/ohjaus */
export interface HelmInput {
  /** -1 = left, 0 = straight, 1 = right */
  turn: number;
  /** 0–3 = SEIS, 1/4, 1/2, TÄYSI (index to config.helm.speeds) */
  throttle: number;
}

/** What the phones see, written by the main screen ~5 times a second: rooms/<code>/state */
export interface ShipState {
  x: number;
  y: number;
  /** Direction in degrees: 0 = right, 90 = down. */
  heading: number;
  speed: number;
  throttle: number;
  /** Index of the place in config.route the ship is flying to. */
  target: number;
  /** Seconds until warp is ready again (0 = ready). */
  warpCharge: number;
  warping: boolean;
  /** Seconds since the trip started. */
  time: number;
}

/** Firebase paths of one room. */
export const paths = (code: string) => ({
  room: `rooms/${code}`,
  phase: `rooms/${code}/phase`,
  state: `rooms/${code}/state`,
  players: `rooms/${code}/players`,
  player: (uid: string) => `rooms/${code}/players/${uid}`,
  inputs: `rooms/${code}/inputs`,
  input: (station: string) => `rooms/${code}/inputs/${station}`,
  commands: `rooms/${code}/commands`,
});

/** Players at each station, e.g. { ohjaus: [player, …] } */
export function crewByStation(players: Record<string, PlayerInfo>): Record<string, PlayerInfo[]> {
  const crew: Record<string, PlayerInfo[]> = {};
  for (const s of config.stations) crew[s.id] = [];
  for (const p of Object.values(players)) crew[p.station]?.push(p);
  return crew;
}

/** Distance and direction (degrees) from the ship to a place. */
export function towards(s: ShipState, x: number, y: number) {
  const dx = x - s.x;
  const dy = y - s.y;
  return { distance: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** The difference of two directions, -180 … 180. */
export function angleDiff(a: number, b: number) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

export function stardate(time: number) {
  return (config.stardate.start + time * config.stardate.perSecond).toFixed(1);
}

function startState(): ShipState {
  const home = config.route[0];
  const next = config.route[1];
  const heading = (Math.atan2(next.y - home.y, next.x - home.x) * 180) / Math.PI;
  return { x: home.x, y: home.y, heading, speed: 0, throttle: 0, target: 1, warpCharge: 0, warping: false, time: 0 };
}

/** Things the main screen wants to know about, to show them. */
export interface SimEvents {
  phase: (phase: Phase) => void;
  players: (players: Record<string, PlayerInfo>) => void;
  /** The ship arrived at config.route[index]. */
  arrived: (index: number) => void;
  /** Bumped into the edge of space. */
  bonk: () => void;
  warp: () => void;
}

/** The host side of a room: runs the ship and reacts to the phones. */
export class Simulaatio {
  phase: Phase = 'aula';
  players: Record<string, PlayerInfo> = {};
  ship: ShipState = startState();
  private inputs: Record<string, Record<string, number | boolean>> = {};
  private warpLeft = 0;
  private sendTimer = 0;
  private p: ReturnType<typeof paths>;
  /** The edges of space: a bit outside the route. */
  readonly bounds = (() => {
    const xs = config.route.map((w) => w.x);
    const ys = config.route.map((w) => w.y);
    const m = 2500;
    return { left: Math.min(...xs) - m, right: Math.max(...xs) + m, top: Math.min(...ys) - m, bottom: Math.max(...ys) + m };
  })();

  constructor(readonly code: string, private on: SimEvents) {
    this.p = paths(code);
    online.watch<Record<string, PlayerInfo>>(this.p.players, (v) => {
      this.players = v ?? {};
      this.on.players(this.players);
    });
    online.watch<Record<string, Record<string, number | boolean>>>(this.p.inputs, (v) => (this.inputs = v ?? {}));
    online.watchAdded<Command>(this.p.commands, (id, c) => {
      online.remove(`${this.p.commands}/${id}`);
      this.handle(c);
    });
    this.newTrip();
  }

  setPhase(phase: Phase) {
    this.phase = phase;
    online.write(this.p.phase, phase);
    this.on.phase(phase);
  }

  /** Back to the lobby with the ship at home. */
  newTrip() {
    this.ship = startState();
    this.warpLeft = 0;
    online.write(this.p.state, this.ship);
    this.setPhase('aula');
  }

  /** Lähtö! The Captain's phone or the main screen's button. */
  start() {
    if (this.phase === 'aula') this.setPhase('matka');
  }

  /** Is somebody sitting at this station? If not, the autopilot does its job. */
  manned(station: string) {
    return Object.values(this.players).some((p) => p.station === station);
  }

  /** What each command from a phone does. */
  private handle(c: Command) {
    if (this.players[c.uid]?.station !== c.station) return; // only from someone at that station
    if (c.action === 'aloita' && c.station === 'kapteeni') this.start();
    if (c.action === 'uusi' && c.station === 'kapteeni' && this.phase === 'perilla') this.newTrip();
    if (c.action === 'warp' && c.station === 'ohjaus') this.warp();
  }

  warp() {
    if (this.phase !== 'matka' || this.ship.warpCharge > 0) return;
    this.warpLeft = config.helm.warpSeconds;
    this.ship.warpCharge = config.helm.warpSeconds + config.helm.warpCharge;
    this.on.warp();
  }

  /** Called by the main screen 60 times a second. */
  update(dt: number) {
    if (this.phase !== 'matka') return;
    const s = this.ship;
    s.time += dt;
    this.steer(dt);
    this.move(dt);
    this.checkArrival();
    // Send the state to the phones 5 times a second
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 0.2;
      online.write(this.p.state, roundState(s));
    }
  }

  /** Ohjaus: from the Helm phone, or the autopilot when nobody is there. */
  private steer(dt: number) {
    const s = this.ship;
    let turn = 0;
    if (this.manned('ohjaus')) {
      const helm = (this.inputs.ohjaus ?? {}) as Partial<HelmInput>;
      turn = Math.sign(helm.turn ?? 0);
      // Until the Helm picks a speed, keep the old one
      if (helm.throttle !== undefined) s.throttle = Math.max(0, Math.min(config.helm.speeds.length - 1, Math.round(helm.throttle)));
    } else {
      // Autopilotti: turn towards the next place
      const t = config.route[s.target];
      const diff = angleDiff(towards(s, t.x, t.y).angle, s.heading);
      turn = Math.abs(diff) < 3 ? 0 : Math.sign(diff);
      s.throttle = config.autopilot.helmThrottle;
    }
    s.heading = (s.heading + turn * config.helm.turnSpeed * dt + 360) % 360;
  }

  private move(dt: number) {
    const s = this.ship;
    s.warpCharge = Math.max(0, s.warpCharge - dt);
    this.warpLeft = Math.max(0, this.warpLeft - dt);
    s.warping = this.warpLeft > 0;
    const wanted = s.warping ? config.helm.warpSpeed : config.helm.speeds[s.throttle];
    s.speed += (wanted - s.speed) * Math.min(1, dt * 2); // speeds up and slows down smoothly
    const rad = (s.heading * Math.PI) / 180;
    s.x += Math.cos(rad) * s.speed * dt;
    s.y += Math.sin(rad) * s.speed * dt;
    // BOING! The edge of space bounces the ship back.
    const b = this.bounds;
    if (s.x < b.left || s.x > b.right || s.y < b.top || s.y > b.bottom) {
      s.x = Math.max(b.left, Math.min(b.right, s.x));
      s.y = Math.max(b.top, Math.min(b.bottom, s.y));
      s.heading = (s.heading + 180) % 360;
      s.speed *= 0.3;
      this.warpLeft = 0;
      this.on.bonk();
    }
  }

  private checkArrival() {
    const s = this.ship;
    const t = config.route[s.target];
    if (towards(s, t.x, t.y).distance > config.arriveDistance) return;
    this.on.arrived(s.target);
    if (s.target === config.route.length - 1) {
      online.write(this.p.state, roundState(s));
      this.setPhase('perilla');
    } else {
      s.target++;
    }
  }
}

/** Fewer decimals = less to send. */
function roundState(s: ShipState): ShipState {
  return {
    ...s,
    x: Math.round(s.x), y: Math.round(s.y), heading: Math.round(s.heading), speed: Math.round(s.speed),
    warpCharge: Math.ceil(s.warpCharge), time: Math.round(s.time * 10) / 10,
  };
}
