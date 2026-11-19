// 🧠 SIMULAATIO – the rules of the game. Only the main screen runs this; phones
// just send commands and show what the main screen tells them.
// Also the shapes of everything stored in Firebase (shared with asemat.ts).

import { online } from '@kit/firebase';
import { config, type Waypoint } from './config';

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
  /** Places (indexes of config.route) where the Captain chose the other place (alt). */
  alts?: number[];
  /** A route choice the Captain is making now: index of config.route, or -1. */
  choice: number;
  choiceTime: number;
  /** PUNAINEN HÄLYTYS: seconds left, and seconds until it can be used again. */
  alert: number;
  alertCharge: number;
  /** In thick fog: the main screen and the Helm can't see. */
  fog: boolean;
  /** Seconds the fog stays away after a scan. */
  fogClear: number;
  /** Seconds until Tiede can scan again. */
  scanCharge: number;
  /** One number per config.secrets: 0 = hidden, 1 = found, 2 = used. */
  secrets: number[];
  /** Star crystals collected. */
  stars: number;
  /** Mieliala: the crew's mood 0–100. */
  morale: number;
  /** The space whale is singing (the crew gets sleepy). */
  singing: boolean;
  /** An alien call waiting for Viestintä's answer, or null. */
  call?: AlienCall | null;
  /** The space cat sits on this station (index of config.stations), -1 = nowhere. */
  cat: number;
  /** Seconds until Operaatiot's tractor beam works again. */
  tractorCharge: number;
  /** Operaatiot buzzed this station (index of config.stations); n grows on every buzz. */
  ping?: { s: number; n: number } | null;
}

/** msg = index of config.aliens.messages. order = how the 3 answers are shown: 0 = the right one. */
export interface AlienCall {
  msg: number;
  order: number[];
  /** Seconds left to answer. */
  time: number;
}

/** The answers of a call in the order the phone shows them. */
export function callAnswers(call: AlienCall) {
  const m = config.aliens.messages[call.msg];
  const all = [m.right, ...m.wrong];
  return call.order.map((o) => all[o]);
}

/** A face for the crew's mood. */
export function moodFace(morale: number) {
  return morale >= 70 ? '😄' : morale >= 45 ? '🙂' : morale >= 25 ? '😐' : '😴';
}

/** Index of a station in config.stations. */
export const stationIndex = (id: string) => config.stations.findIndex((x) => x.id === id);

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

/** The place number i on this trip (the Captain may have chosen the other one). */
export function place(s: ShipState, i: number): Waypoint {
  const w = config.route[i];
  return w.alt && s.alts?.includes(i) ? w.alt : w;
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
    alts: [], choice: -1, choiceTime: 0, alert: 0, alertCharge: 0, fog: false, fogClear: 0, scanCharge: 0,
    secrets: config.secrets.map(() => 0), stars: 0,
    morale: config.morale.start, singing: false, call: null, cat: -1, tractorCharge: 0, ping: null,
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
  /** Tiede scanned and found these secrets (indexes of config.secrets). */
  scan: (found: number[]) => void;
  /** Flew into a wormhole (index of config.secrets). */
  wormhole: (i: number) => void;
  crystal: (i: number) => void;
  alert: () => void;
  /** The Captain must choose a route now. */
  choose: () => void;
  /** The route was chosen: flying to this place. */
  chosen: (w: Waypoint) => void;
  /** The aliens call (look at ship.call). */
  call: () => void;
  /** Viestintä answered: true = friends, false = oops, null = no answer in time. */
  answered: (right: boolean | null) => void;
  /** The cat sat on a station (index), or left (-1). */
  cat: (station: number) => void;
  /** The tractor beam pulled in this crystal (index of config.secrets). */
  tractor: (i: number) => void;
  /** The whale started singing. */
  song: () => void;
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
  private scanTimer = 4;
  /** Alien calls still coming in this visit, and seconds until the next one. */
  private callsLeft = 0;
  private callGap = 0;
  private randomCallTimer = config.aliens.randomEvery;
  private visitedAliens = new Set<number>();
  private catTimer = config.cat.firstAfter;
  private catAge = 0;
  private nextId = 1;
  private p: ReturnType<typeof paths>;
  /** The edges of space: a bit outside the route. */
  readonly bounds = (() => {
    const all = [...config.route, ...config.route.flatMap((w) => (w.alt ? [w.alt] : [])), ...config.secrets];
    const xs = all.map((w) => w.x);
    const ys = all.map((w) => w.y);
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
    this.resume();
  }

  /** After a reload of the main screen: carry on with the trip that was going on. */
  private async resume() {
    const [phase, saved] = await Promise.all([online.read<Phase>(this.p.phase), online.read<ShipState>(this.p.state)]);
    if (phase !== 'matka' || !saved) return this.newTrip();
    this.ship = { ...startState(), ...saved, faults: saved.faults ?? [], alts: saved.alts ?? [], radar: [], call: null };
    // Aliens of places already passed don't call again
    config.route.forEach((_, i) => { if (i < this.ship.target) this.visitedAliens.add(i); });
    this.setPhase('matka');
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
    this.callsLeft = 0;
    this.randomCallTimer = config.aliens.randomEvery;
    this.visitedAliens.clear();
    this.catTimer = config.cat.firstAfter;
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
    if (this.catOn(c.station)) return; // the cat is sitting on the buttons!
    if (a === 'viestinta:vastaa') this.answer(Number(c.value));
    if (a === 'operaatiot:kissa') this.shooCat();
    if (a === 'operaatiot:veto') this.tractorBeam();
    if (a === 'operaatiot:tehtava') this.ping(Number(c.value));
    if (a === 'neuvonantaja:rauhoita') this.cheer(config.morale.calm);
    if (a === 'ohjaus:warp') this.warp();
    if (a === 'taktiikka:ammu') this.zap(Number(c.value));
    if (a === 'taktiikka:kilvet') this.raiseShields();
    if (a === 'konehuone:energia') this.moveEnergy(String(c.value));
    if (a === 'konehuone:korjaa') this.repair(Number(c.value), this.ship.alert > 0 ? 2 : 1);
    if (a === 'tiede:skannaa') this.scan();
    if (a === 'kapteeni:halytys') this.redAlert();
    if (a === 'kapteeni:reitti') this.chooseRoute(Number(c.value));
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
    this.people(dt);
    this.checkSecrets();
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
      turn = this.catOn('ohjaus') ? 0 : Math.sign(helm.turn ?? 0);
      // Until the Helm picks a speed, keep the old one
      if (helm.throttle !== undefined) s.throttle = Math.max(0, Math.min(config.helm.speeds.length - 1, Math.round(helm.throttle)));
    } else {
      // Autopilotti: turn towards the next place
      const t = place(s, s.target);
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
    const mood = 1 - config.morale.slowAtZero * (1 - s.morale / 100);
    return engines * faults * mood;
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
    const t = place(s, s.target);
    if (towards(s, t.x, t.y).distance > config.arriveDistance) return;
    this.on.arrived(s.target);
    this.cheer(config.morale.arrive);
    if (s.target === config.route.length - 1) {
      this.threats = [];
      this.send();
      this.setPhase('perilla');
    } else {
      s.target++;
      this.legStarts();
    }
  }

  /** A new leg of the trip: is a pirate waiting on the way? Does the Captain choose the route? */
  private legStarts() {
    const s = this.ship;
    const w = config.route[s.target];
    if (w.alt) {
      s.choice = s.target;
      s.choiceTime = config.captain.choiceSeconds;
      this.on.choose();
    }
    this.pirateTimer = place(s, s.target).pirate ? 6 : -1;
  }

  // ---------------------------------------------------------------------------
  // Kapteeni: route choice and red alert
  // ---------------------------------------------------------------------------

  /** 0 = the normal place, 1 = the other place (alt). */
  private chooseRoute(which: number) {
    const s = this.ship;
    if (s.choice < 0) return;
    if (which === 1) s.alts = [...(s.alts ?? []), s.choice];
    const w = place(s, s.choice);
    s.choice = -1;
    this.pirateTimer = w.pirate ? 6 : -1;
    this.on.chosen(w);
  }

  private redAlert() {
    const s = this.ship;
    if (s.alertCharge > 0) return;
    s.alert = config.captain.alertSeconds;
    s.alertCharge = s.alert + config.captain.alertCharge;
    s.shieldCharge = 0; // shields ready right away
    this.on.alert();
  }

  // ---------------------------------------------------------------------------
  // Tiede: scanning, fog and secrets
  // ---------------------------------------------------------------------------

  /** Are we near a place with fog? */
  private inFogArea() {
    const s = this.ship;
    return config.route.some((_, i) => {
      const w = place(s, i);
      return w.fog && towards(s, w.x, w.y).distance < config.science.fogRadius;
    });
  }

  private scan() {
    const s = this.ship;
    if (s.scanCharge > 0) return;
    s.scanCharge = config.science.scanCharge;
    if (this.inFogArea()) s.fogClear = config.science.fogClear;
    const found: number[] = [];
    config.secrets.forEach((sec, i) => {
      if (s.secrets[i] === 0 && towards(s, sec.x, sec.y).distance < config.science.scanRadius) {
        s.secrets[i] = 1;
        found.push(i);
      }
    });
    this.on.scan(found);
  }

  /** Fly into a found secret to use it. */
  private checkSecrets() {
    const s = this.ship;
    config.secrets.forEach((sec, i) => {
      if (s.secrets[i] !== 1) return;
      const size = config.secretLooks[sec.kind].size;
      if (towards(s, sec.x, sec.y).distance > size * 0.6 + 40) return;
      s.secrets[i] = 2;
      if (sec.kind === 'kristalli') {
        s.stars++;
        this.cheer(config.morale.crystal);
        this.on.crystal(i);
      } else if (sec.exit) {
        // WHOOSH! Out of the other end, and on to the next place from there
        s.x = sec.exit.x;
        s.y = sec.exit.y;
        s.target = Math.max(s.target, sec.exit.target);
        s.choice = -1;
        this.threats = [];
        this.on.wormhole(i);
        this.legStarts();
      }
    });
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
    if (!blocked) this.cheer(-config.morale.hit);
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
    if (s.alert > 0) s.reload /= 2; // red alert: everyone is twice as fast
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
    s.alert = Math.max(0, s.alert - dt);
    s.alertCharge = Math.max(0, s.alertCharge - dt);
    s.scanCharge = Math.max(0, s.scanCharge - dt);
    s.fogClear = Math.max(0, s.fogClear - dt);
    s.tractorCharge = Math.max(0, s.tractorCharge - dt);
    s.fog = this.inFogArea() && s.fogClear <= 0;
    if (s.choice >= 0) {
      // Nobody at the Captain's chair: the autopilot takes the first route quickly
      if (!this.manned('kapteeni')) s.choiceTime = Math.min(s.choiceTime, 3);
      s.choiceTime -= dt;
      if (s.choiceTime <= 0) this.chooseRoute(0);
    }
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
  // People: mood, aliens, the cat (Neuvonantaja, Viestintä, Operaatiot)
  // ---------------------------------------------------------------------------

  /** Changes the crew's mood (minus = worse), keeping it between min and 100. */
  private cheer(amount: number) {
    const s = this.ship;
    s.morale = Math.max(config.morale.min, Math.min(100, s.morale + amount));
  }

  private catOn(station: string) {
    return this.ship.cat >= 0 && config.stations[this.ship.cat]?.id === station;
  }

  private people(dt: number) {
    const s = this.ship;
    // The space whale sings: everybody gets sleepy
    const singing = config.route.some((_, i) => {
      const w = place(s, i);
      return w.song && towards(s, w.x, w.y).distance < config.morale.songRadius;
    });
    if (singing && !s.singing) this.on.song();
    s.singing = singing;
    if (singing) this.cheer(-config.morale.songPerSecond * dt);
    this.aliens(dt);
    // The cat jumps on a console now and then (never on Operaatiot – they chase it)
    if (s.cat >= 0) this.catAge += dt;
    else {
      this.catTimer -= dt;
      if (this.catTimer <= 0) {
        this.catTimer = config.cat.every;
        const seats = config.stations.map((_, i) => i).filter((i) => config.stations[i].id !== 'operaatiot');
        s.cat = seats[Math.floor(Math.random() * seats.length)];
        this.catAge = 0;
        this.on.cat(s.cat);
      }
    }
  }

  private shooCat() {
    if (this.ship.cat < 0) return;
    this.ship.cat = -1;
    this.cheer(5);
    this.on.cat(-1);
  }

  private aliens(dt: number) {
    const s = this.ship;
    // Near the aliens' home they call a few times; elsewhere sometimes a surprise call
    config.route.forEach((_, i) => {
      const w = place(s, i);
      if (w.aliens && !this.visitedAliens.has(i) && towards(s, w.x, w.y).distance < 2200) {
        this.visitedAliens.add(i);
        this.callsLeft = config.aliens.perVisit;
        this.callGap = 0.5;
      }
    });
    if (config.aliens.randomEvery > 0) {
      this.randomCallTimer -= dt;
      if (this.randomCallTimer <= 0) {
        this.randomCallTimer = config.aliens.randomEvery;
        if (!this.callsLeft && !s.call) { this.callsLeft = 1; this.callGap = 0; }
      }
    }
    if (s.call) {
      s.call.time -= dt;
      if (s.call.time <= 0) {
        s.call = null;
        this.callGap = 3;
        this.on.answered(null);
      }
    } else if (this.callsLeft > 0) {
      this.callGap -= dt;
      if (this.callGap <= 0) {
        this.callsLeft--;
        const order = [0, 1, 2].sort(() => Math.random() - 0.5);
        s.call = { msg: Math.floor(Math.random() * config.aliens.messages.length), order, time: config.aliens.answerSeconds };
        this.on.call();
      }
    }
  }

  /** button = which of the 3 answer buttons was tapped. */
  private answer(button: number) {
    const s = this.ship;
    if (!s.call || !(button in s.call.order)) return;
    const right = s.call.order[button] === 0;
    s.call = null;
    this.callGap = 3;
    if (right) {
      this.cheer(config.aliens.friendMorale);
      s.stars++;
    } else {
      // Offended aliens throw pies (cartoon pies, of course)
      this.cheer(-config.morale.hit);
      for (let k = 0; k < config.aliens.angryPies; k++) {
        const a = rad(Math.random() * 360);
        const x = s.x + Math.cos(a) * 700;
        const y = s.y + Math.sin(a) * 700;
        const speed = config.danger.pie.speed;
        this.add('piirakka', x, y, -Math.cos(a) * speed, -Math.sin(a) * speed);
      }
    }
    this.on.answered(right);
  }

  /** Pulls the nearest found crystal to the ship. */
  private tractorBeam() {
    const s = this.ship;
    if (s.tractorCharge > 0) return;
    let best = -1;
    let bestDistance = config.ops.tractorRange;
    config.secrets.forEach((sec, i) => {
      const d = towards(s, sec.x, sec.y).distance;
      if (sec.kind === 'kristalli' && s.secrets[i] === 1 && d < bestDistance) { best = i; bestDistance = d; }
    });
    if (best < 0) return;
    s.tractorCharge = config.ops.tractorCharge;
    s.secrets[best] = 2;
    s.stars++;
    this.cheer(config.morale.crystal);
    this.on.tractor(best);
  }

  private ping(station: number) {
    if (!config.stations[station]) return;
    this.ship.ping = { s: station, n: (this.ship.ping?.n ?? 0) + 1 };
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
    if (!this.manned('tiede')) {
      this.scanTimer -= dt;
      if (this.scanTimer <= 0) {
        this.scanTimer = config.autopilot.scanEvery;
        this.scan();
      }
    }
    const call = s.call;
    if (!this.manned('viestinta') && call && call.time < config.aliens.answerSeconds - config.autopilot.commsSeconds) {
      const right = Math.random() < config.autopilot.commsRight;
      this.answer(call.order.indexOf(right ? 0 : 1 + Math.floor(Math.random() * 2)));
    }
    if (!this.manned('operaatiot') && s.cat >= 0 && this.catAge > config.autopilot.catSeconds) this.shooCat();
    if (!this.manned('neuvonantaja')) this.cheer(config.autopilot.moralePerSecond * dt);
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
    choiceTime: Math.ceil(s.choiceTime), alert: Math.ceil(s.alert), alertCharge: Math.ceil(s.alertCharge),
    fogClear: Math.ceil(s.fogClear), scanCharge: Math.ceil(s.scanCharge), secrets: [...s.secrets],
    morale: Math.round(s.morale), tractorCharge: Math.ceil(s.tractorCharge),
    call: s.call ? { ...s.call, time: Math.ceil(s.call.time) } : null,
    radar,
  };
}
