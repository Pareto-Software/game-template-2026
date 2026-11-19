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

/** kivi = rock, mohko = Möhköttäjä pirate, piirakka = a pie it threw */
export type ThreatKind = 'kivi' | 'mohko' | 'piirakka';

/** Something dangerous in space (only the main screen has these). */
export interface Threat {
  id: number;
  kind: ThreatKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  /** Seconds since it appeared. */
  age: number;
  /** Pirate: seconds until the next pie. */
  timer: number;
  /** Pirate: where it is around the ship (degrees). */
  orbit: number;
  leaving: boolean;
}

/** Energy points of the three systems (Konehuone). */
export interface Energy {
  moottori: number;
  kilvet: number;
  aseet: number;
}

/** Something broken on the ship. name = index to config.faults.names. */
export interface Fault {
  id: number;
  name: number;
  /** Taps left to fix it. */
  left: number;
}

/** A threat on the Tactical radar: distance from the ship. */
export interface RadarDot {
  id: number;
  k: ThreatKind;
  dx: number;
  dy: number;
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
  energy: Energy;
  /** Firebase drops empty lists, so these may be missing on the phones. */
  faults?: Fault[];
  radar?: RadarDot[];
  /** Seconds the shields stay up (0 = down). */
  shield: number;
  /** Seconds until the shields can go up again. */
  shieldCharge: number;
  /** Seconds until the laser can shoot again. */
  reload: number;
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
export function towards(s: { x: number; y: number }, x: number, y: number) {
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

/** Runko (hull) in percent: every fault takes some off, but it never reaches 0. */
export function hull(s: ShipState) {
  return Math.max(10, 100 - (s.faults?.length ?? 0) * 15);
}

function startState(): ShipState {
  const home = config.route[0];
  const next = config.route[1];
  const heading = (Math.atan2(next.y - home.y, next.x - home.x) * 180) / Math.PI;
  return {
    x: home.x, y: home.y, heading, speed: 0, throttle: 0, target: 1, warpCharge: 0, warping: false, time: 0,
    energy: { ...config.energy.start }, faults: [], radar: [], shield: 0, shieldCharge: 0, reload: 0,
  };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const random = (min: number, max: number) => min + Math.random() * (max - min);

/** Things the main screen wants to know about, to show them. */
export interface SimEvents {
  phase: (phase: Phase) => void;
  players: (players: Record<string, PlayerInfo>) => void;
  /** The ship arrived at config.route[index]. */
  arrived: (index: number) => void;
  /** Bumped into the edge of space. */
  bonk: () => void;
  warp: () => void;
  /** A laser shot hit this threat. */
  zap: (t: Threat) => void;
  /** This threat was zapped to pieces. */
  pop: (t: Threat) => void;
  /** Something hit the ship. blocked = the shields took it. */
  hit: (kind: ThreatKind, blocked: boolean) => void;
  shields: () => void;
  fixed: () => void;
  /** A pirate arrived (true) or got bored and left (false). */
  pirate: (arrived: boolean) => void;
}

/** The host side of a room: runs the ship and reacts to the phones. */
export class Simulaatio {
  phase: Phase = 'aula';
  players: Record<string, PlayerInfo> = {};
  ship: ShipState = startState();
  threats: Threat[] = [];
  private inputs: Record<string, Record<string, number | boolean>> = {};
  private warpLeft = 0;
  private sendTimer = 0;
  private rockTimer = 3;
  /** Seconds until this leg's pirate shows up (-1 = no pirate coming). */
  private pirateTimer = -1;
  private zapTimer = 0;
  private fixTimer = 0;
  private nextId = 1;
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
    this.threats = [];
    this.warpLeft = 0;
    this.pirateTimer = -1;
    online.write(this.p.state, this.ship);
    this.setPhase('aula');
  }

  /** Lähtö! The Captain's phone or the main screen's button. */
  start() {
    if (this.phase !== 'aula') return;
    this.setPhase('matka');
    this.legStarts();
  }

  /** Is somebody sitting at this station? If not, the autopilot does its job. */
  manned(station: string) {
    return Object.values(this.players).some((p) => p.station === station);
  }

  /** What each command from a phone does. */
  private handle(c: Command) {
    if (this.players[c.uid]?.station !== c.station) return; // only from someone at that station
    const a = `${c.station}:${c.action}`;
    if (a === 'kapteeni:aloita') this.start();
    if (a === 'kapteeni:uusi' && this.phase === 'perilla') this.newTrip();
    if (this.phase !== 'matka') return;
    if (a === 'ohjaus:warp') this.warp();
    if (a === 'taktiikka:ammu') this.zap(Number(c.value));
    if (a === 'taktiikka:kilvet') this.raiseShields();
    if (a === 'konehuone:energia') this.moveEnergy(String(c.value));
    if (a === 'konehuone:korjaa') this.repair(Number(c.value), 1);
  }

  warp() {
    if (this.ship.warpCharge > 0) return;
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
    this.spawnDangers(dt);
    this.moveDangers(dt);
    this.tickTimers(dt);
    this.autopilots(dt);
    this.checkArrival();
    // Send the state to the phones 5 times a second
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 0.2;
      this.send();
    }
  }

  private send() {
    online.write(this.p.state, roundState(this.ship, this.threats));
  }

  // ---------------------------------------------------------------------------
  // Ohjaus: flying
  // ---------------------------------------------------------------------------

  /** From the Helm phone, or the autopilot when nobody is there. */
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

  /** How fast the ship can go now: engine energy speeds it up, faults slow it down. */
  speedFactor() {
    const s = this.ship;
    const engines = 1 + (s.energy.moottori - 2) * config.energy.enginePerPoint;
    const faults = Math.max(0.4, 1 - (s.faults?.length ?? 0) * config.faults.slowEach);
    return engines * faults;
  }

  private move(dt: number) {
    const s = this.ship;
    s.warpCharge = Math.max(0, s.warpCharge - dt);
    this.warpLeft = Math.max(0, this.warpLeft - dt);
    s.warping = this.warpLeft > 0;
    const wanted = (s.warping ? config.helm.warpSpeed : config.helm.speeds[s.throttle]) * this.speedFactor();
    s.speed += (wanted - s.speed) * Math.min(1, dt * 2); // speeds up and slows down smoothly
    s.x += Math.cos(rad(s.heading)) * s.speed * dt;
    s.y += Math.sin(rad(s.heading)) * s.speed * dt;
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
      this.threats = [];
      this.send();
      this.setPhase('perilla');
    } else {
      s.target++;
      this.legStarts();
    }
  }

  /** A new leg of the trip: is a pirate waiting on the way? */
  private legStarts() {
    this.pirateTimer = config.route[this.ship.target].pirate ? 6 : -1;
  }

  // ---------------------------------------------------------------------------
  // Vaarat: rocks, pirates and pies
  // ---------------------------------------------------------------------------

  private add(kind: ThreatKind, x: number, y: number, vx: number, vy: number, hp = 1): Threat {
    const t: Threat = { id: this.nextId++, kind, x, y, vx, vy, hp, age: 0, timer: 2, orbit: 0, leaving: false };
    this.threats.push(t);
    return t;
  }

  /** Are we near a place with lots of rocks? */
  private inRockField() {
    return config.route.some((w) => w.rocks && towards(this.ship, w.x, w.y).distance < 2500);
  }

  private spawnDangers(dt: number) {
    const s = this.ship;
    const rock = config.danger.rock;
    this.rockTimer -= dt;
    if (this.rockTimer <= 0) {
      this.rockTimer = this.inRockField() ? rock.fieldEvery : rock.every;
      // A rock appears ahead of the ship and drifts towards it
      const a = rad(s.heading + random(-70, 70));
      const d = random(750, 950);
      const x = s.x + Math.cos(a) * d;
      const y = s.y + Math.sin(a) * d;
      const aim = towards({ x, y }, s.x + random(-200, 200), s.y + random(-200, 200));
      const speed = rock.speed * random(0.6, 1.4);
      this.add('kivi', x, y, Math.cos(rad(aim.angle)) * speed, Math.sin(rad(aim.angle)) * speed);
    }
    if (this.pirateTimer > 0) {
      this.pirateTimer -= dt;
      if (this.pirateTimer <= 0) {
        const a = rad(s.heading + 180);
        const p = this.add('mohko', s.x + Math.cos(a) * 900, s.y + Math.sin(a) * 900, 0, 0, config.danger.pirate.hp);
        p.orbit = s.heading + 180;
        this.on.pirate(true);
      }
    }
  }

  private moveDangers(dt: number) {
    const s = this.ship;
    for (const t of [...this.threats]) {
      t.age += dt;
      if (t.kind === 'mohko') this.movePirate(t, dt);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      const d = towards(s, t.x, t.y).distance;
      const size = t.kind === 'kivi' ? config.danger.rock.size : config.danger.pie.size;
      if (t.kind !== 'mohko' && d < (size + config.ship.size) * 0.35) this.hitShip(t);
      else if (d > 1500 || (t.kind === 'piirakka' && t.age > 6)) this.remove(t);
    }
  }

  /** The pirate circles the ship, throws pies, and gets bored after a while. */
  private movePirate(t: Threat, dt: number) {
    const s = this.ship;
    const cfg = config.danger.pirate;
    if (t.age > cfg.leavesAfter && !t.leaving) {
      t.leaving = true;
      this.on.pirate(false);
    }
    if (t.leaving) {
      const away = towards(s, t.x, t.y).angle;
      t.vx = Math.cos(rad(away)) * 500;
      t.vy = Math.sin(rad(away)) * 500;
      return;
    }
    t.orbit += 25 * dt;
    const goalX = s.x + Math.cos(rad(t.orbit)) * 420;
    const goalY = s.y + Math.sin(rad(t.orbit)) * 420;
    t.vx = (goalX - t.x) * 1.5;
    t.vy = (goalY - t.y) * 1.5;
    t.timer -= dt;
    if (t.timer <= 0 && t.age > 3) {
      t.timer = cfg.throwsEvery;
      const aim = towards(t, s.x, s.y);
      const speed = config.danger.pie.speed;
      this.add('piirakka', t.x, t.y, Math.cos(rad(aim.angle)) * speed, Math.sin(rad(aim.angle)) * speed);
    }
  }

  private remove(t: Threat) {
    this.threats = this.threats.filter((x) => x !== t);
  }

  /** KOLINAA! Without shields something breaks. */
  private hitShip(t: Threat) {
    this.remove(t);
    const s = this.ship;
    const blocked = s.shield > 0;
    if (!blocked && (s.faults?.length ?? 0) < config.faults.max) {
      s.faults = [...(s.faults ?? []), {
        id: this.nextId++, name: Math.floor(Math.random() * config.faults.names.length), left: config.faults.tapsToFix,
      }];
    }
    this.on.hit(t.kind, blocked);
  }

  // ---------------------------------------------------------------------------
  // Taktiikka: lasers and shields
  // ---------------------------------------------------------------------------

  private zap(id: number) {
    const s = this.ship;
    const t = this.threats.find((x) => x.id === id);
    if (!t || s.reload > 0 || towards(s, t.x, t.y).distance > config.tactical.range) return;
    s.reload = Math.max(0.3, config.tactical.reload - config.tactical.reloadPerPoint * s.energy.aseet);
    t.hp--;
    this.on.zap(t);
    if (t.hp <= 0) {
      this.remove(t);
      this.on.pop(t);
    }
  }

  private raiseShields() {
    const s = this.ship;
    if (s.shieldCharge > 0) return;
    s.shield = config.tactical.shieldSeconds + config.tactical.shieldPerPoint * s.energy.kilvet;
    s.shieldCharge = s.shield + config.tactical.shieldCharge;
    this.on.shields();
  }

  private tickTimers(dt: number) {
    const s = this.ship;
    s.shield = Math.max(0, s.shield - dt);
    s.shieldCharge = Math.max(0, s.shieldCharge - dt);
    s.reload = Math.max(0, s.reload - dt);
  }

  // ---------------------------------------------------------------------------
  // Konehuone: energy and repairs
  // ---------------------------------------------------------------------------

  /** value is e.g. 'moottori_plus' or 'aseet_miinus'. */
  private moveEnergy(value: string) {
    const [system, way] = value.split('_') as [keyof Energy, string];
    const e = this.ship.energy;
    if (!(system in e)) return;
    const used = e.moottori + e.kilvet + e.aseet;
    if (way === 'plus' && used < config.energy.total && e[system] < config.energy.max) e[system]++;
    if (way === 'miinus' && e[system] > 0) e[system]--;
  }

  private repair(id: number, taps: number) {
    const s = this.ship;
    const f = s.faults?.find((x) => x.id === id);
    if (!f) return;
    f.left -= taps;
    if (f.left <= 0) {
      s.faults = s.faults!.filter((x) => x !== f);
      this.on.fixed();
    }
  }

  // ---------------------------------------------------------------------------
  // Autopilots for empty stations
  // ---------------------------------------------------------------------------

  private autopilots(dt: number) {
    const s = this.ship;
    if (!this.manned('taktiikka')) {
      this.zapTimer -= dt;
      if (this.zapTimer <= 0) {
        this.zapTimer = config.autopilot.zapEvery;
        // Zap the nearest thing in range (pies first, they're the messiest)
        const inRange = this.threats
          .filter((t) => towards(s, t.x, t.y).distance <= config.tactical.range)
          .sort((a, b) => Number(b.kind === 'piirakka') - Number(a.kind === 'piirakka')
            || towards(s, a.x, a.y).distance - towards(s, b.x, b.y).distance);
        if (inRange[0]) this.zap(inRange[0].id);
      }
    }
    if (!this.manned('konehuone') && s.faults?.length) {
      this.fixTimer -= dt;
      if (this.fixTimer <= 0) {
        this.fixTimer = config.autopilot.fixEvery;
        this.repair(s.faults[0].id, config.faults.tapsToFix);
      }
    }
  }
}

/** Fewer decimals = less to send. The radar gets threats near the ship. */
function roundState(s: ShipState, threats: Threat[]): ShipState {
  const near = config.tactical.range * 1.4;
  const radar = threats
    .map((t) => ({ id: t.id, k: t.kind, dx: Math.round(t.x - s.x), dy: Math.round(t.y - s.y) }))
    .filter((t) => Math.hypot(t.dx, t.dy) < near);
  return {
    ...s,
    x: Math.round(s.x), y: Math.round(s.y), heading: Math.round(s.heading), speed: Math.round(s.speed),
    warpCharge: Math.ceil(s.warpCharge), time: Math.round(s.time * 10) / 10,
    shield: Math.ceil(s.shield), shieldCharge: Math.ceil(s.shieldCharge), reload: Math.round(s.reload * 10) / 10,
    radar,
  };
}
