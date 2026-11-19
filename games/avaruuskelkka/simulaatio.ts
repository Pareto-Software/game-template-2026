// 🧠 SIMULAATIO – the rules of the game. Only the main screen runs this; phones
// just send commands and show what the main screen tells them.
// Also the shapes of everything stored in Firebase (shared with asemat.ts).

import { online } from '@kit/firebase';
import { config, type RequestKind, type Waypoint } from './config';

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
  /** Tiede found its weak spot: lasers do double damage. */
  weak: boolean;
}

/** A broken console: station = index of config.stations. */
export interface Fault {
  id: number;
  station: number;
  /** Taps left to fix it. */
  left: number;
}

/** Something waiting for the Captain's "Tehkää niin!". from = index of config.stations. */
export interface CaptainRequest {
  id: number;
  from: number;
  what: RequestKind;
  /** Seconds left before it expires. */
  time: number;
}

/** A threat on the Tactical radar: distance from the ship. w = weak spot found. */
export interface RadarDot {
  id: number;
  k: ThreatKind;
  dx: number;
  dy: number;
  w?: boolean;
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
  /** Firebase drops empty lists, so these may be missing on the phones. */
  faults?: Fault[];
  requests?: CaptainRequest[];
  /** The Captain said "aseet vapaiksi": Taktiikka may shoot the pirate. */
  weaponsFree: boolean;
  /** Seconds of boost left for each station (index of config.stations), and who sent it: 1 = ⚡, 2 = 💖. */
  boosts?: number[];
  boostBy?: number[];
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
  /** Early warnings (only Operaatiot sees them all). */
  warnings?: Warning[];
  /** Operaatiot buzzed this station (index of config.stations); n grows on every buzz. */
  ping?: { s: number; n: number } | null;
}

/** msg = index of config.aliens.messages. order = how the 3 answers are shown: 0 = the right one. */
export interface AlienCall {
  /** What they say: index of config.aliens.messages. */
  msg: number;
  /** How they feel: index of config.aliens.moods. Only Neuvonantaja's phone shows it. */
  mood: number;
  /** The 3 answers offered, as indexes of config.aliens.moods (one of them is the right mood). */
  order: number[];
  /** Seconds left to answer. */
  time: number;
}

/** The answers of a call in the order the phone shows them. */
export function callAnswers(call: AlienCall) {
  return call.order.map((m) => config.aliens.moods[m].answer);
}

/** An early warning on Operaatiot's phone. dir = where it comes from (degrees, like heading). */
export interface Warning {
  id: number;
  kind: 'kivisade' | 'mohko';
  dir: number;
  /** Seconds until it arrives. */
  time: number;
  /** Stations (indexes of config.stations) Operaatiot forwarded it to. */
  sent?: number[];
}

/** "edestä", "oikealta" … – where something comes from, seen from the ship. */
export function sideText(relative: number) {
  const a = Math.abs(relative);
  return a < 45 ? 'edestä' : a > 135 ? 'takaa' : relative > 0 ? 'oikealta' : 'vasemmalta';
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

/** The broken console of a station, if any. */
export function faultAt(s: ShipState, station: string) {
  const i = stationIndex(station);
  return s.faults?.find((f) => f.station === i);
}

/** Is this station boosted right now? */
export function boosted(s: ShipState, station: string) {
  return (s.boosts?.[stationIndex(station)] ?? 0) > 0;
}

/** What breaks at a station (config.faults.byStation). */
export function faultText(station: number) {
  const id = config.stations[station]?.id ?? '';
  return config.faults.byStation[id] ?? config.faults.other;
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
    faults: [], requests: [], weaponsFree: false, boosts: config.stations.map(() => 0), boostBy: config.stations.map(() => 0),
    radar: [], shield: 0, shieldCharge: 0, reload: 0,
    alts: [], choice: -1, choiceTime: 0, alert: 0, alertCharge: 0, fog: false, fogClear: 0, scanCharge: 0,
    secrets: config.secrets.map(() => 0), stars: 0,
    morale: config.morale.start, singing: false, call: null, cat: -1, tractorCharge: 0, ping: null, warnings: [],
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
  /** Someone asks the Captain for permission. */
  request: (r: CaptainRequest) => void;
  /** The Captain answered: true = "Tehkää niin!", false = no, null = no answer in time. */
  requestDone: (r: CaptainRequest, ok: boolean | null) => void;
  /** A station got a boost: ⚡ from Konehuone or 💖 from Neuvonantaja. */
  boost: (station: number, by: 1 | 2) => void;
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
  private showerTimer = config.warnings.firstAfter;
  /** Where this leg's pirate comes from (it was announced to Operaatiot). */
  private pirateDir = 0;
  /** When the shields go up by themselves (after a forwarded rock shower warning). */
  private autoShieldAt = -1;
  /** Neuvonantaja's good heart taps since the last 💖, and when Konehuone last sent ⚡. */
  private heartBeats = 0;
  private lastPower = -99;
  /** After a "no" or no answer, the same thing can't be asked again for a few seconds. */
  private askAgainAt: Partial<Record<RequestKind, number>> = {};
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
    const fresh = startState();
    this.ship = {
      ...fresh, ...saved, alts: saved.alts ?? [], radar: [], call: null, requests: [], warnings: [],
      faults: (saved.faults ?? []).filter((f) => typeof f.station === 'number'), // older saves had other faults
      boosts: fresh.boosts, boostBy: fresh.boostBy,
    };
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
    this.heartBeats = 0;
    this.lastPower = -99;
    this.showerTimer = config.warnings.firstAfter;
    this.askAgainAt = {};
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
    if (a === 'operaatiot:veto') this.ask('veto', c.station);
    if (a === 'kapteeni:hyvaksy') this.answerRequest(Number(c.value), true);
    if (a === 'kapteeni:hylkaa') this.answerRequest(Number(c.value), false);
    if (a === 'konehuone:virta') this.powerBoost(Number(c.value));
    if (a === 'neuvonantaja:kannusta') this.cheerBoost(Number(c.value));
    if (a === 'operaatiot:tehtava') this.ping(Number(c.value));
    if (a === 'operaatiot:varoita') this.forward(Math.floor(Number(c.value) / 100), Number(c.value) % 100);
    if (a === 'neuvonantaja:rauhoita' && !faultAt(this.ship, 'neuvonantaja')) {
      const double = boosted(this.ship, 'neuvonantaja') ? 2 : 1;
      this.cheer(config.morale.calm * double);
      this.heartBeats += double;
    }
    if (a === 'ohjaus:warp' && this.ship.warpCharge <= 0) this.ask('warp', c.station);
    if (a === 'taktiikka:ammu') this.zap(Number(c.value));
    if (a === 'taktiikka:kilvet') this.raiseShields();
    if (a === 'konehuone:korjaa') this.repair(Number(c.value), this.repairTaps());
    if (a === 'tiede:skannaa') this.scan();
    if (a === 'kapteeni:halytys') this.redAlert();
    if (a === 'kapteeni:reitti') this.chooseRoute(Number(c.value));
  }

  private warp() {
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
    this.tickWarnings(dt);
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
      if (faultAt(s, 'ohjaus')) turn = Math.min(turn, 0); // broken: only turns left
      // Until the Helm picks a speed, keep the old one
      if (helm.throttle !== undefined) s.throttle = Math.max(0, Math.min(config.helm.speeds.length - 1, Math.round(helm.throttle)));
    } else {
      // Autopilotti: turn towards the next place
      const t = place(s, s.target);
      const diff = angleDiff(towards(s, t.x, t.y).angle, s.heading);
      turn = Math.abs(diff) < 3 ? 0 : Math.sign(diff);
      s.throttle = config.autopilot.helmThrottle;
    }
    const turnSpeed = config.helm.turnSpeed * (boosted(s, 'ohjaus') ? 1.6 : 1);
    s.heading = (s.heading + turn * turnSpeed * dt + 360) % 360;
  }

  /** How fast the ship can go now: a boosted Helm speeds it up, faults and a sleepy crew slow it down. */
  speedFactor() {
    const s = this.ship;
    const engines = boosted(s, 'ohjaus') ? 1.25 : 1;
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
    this.pirateComing(place(s, s.target).pirate);
  }

  /** A pirate on this leg: it arrives in a few seconds, and Operaatiot gets a warning. */
  private pirateComing(yes?: boolean) {
    this.pirateTimer = yes ? config.warnings.lead : -1;
    if (!yes) return;
    this.pirateDir = this.ship.heading + 180 + random(-60, 60);
    this.warn('mohko', this.pirateDir, config.warnings.lead);
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
    this.pirateComing(w.pirate);
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
    let radius = config.science.scanRadius;
    if (faultAt(s, 'tiede')) radius /= 2; // broken: coughing scanner
    if (boosted(s, 'tiede')) { radius *= 2; s.scanCharge = 0; }
    // Weak spots of pirates nearby
    for (const t of this.threats) if (t.kind === 'mohko' && towards(s, t.x, t.y).distance < radius) t.weak = true;
    const found: number[] = [];
    config.secrets.forEach((sec, i) => {
      if (s.secrets[i] === 0 && towards(s, sec.x, sec.y).distance < radius) {
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
      if (sec.kind === 'kristalli') {
        s.secrets[i] = 2;
        s.stars++;
        this.cheer(config.morale.crystal);
        this.on.crystal(i);
      } else {
        this.ask('madonreika', 'ohjaus'); // jumping needs the Captain's order
      }
    });
  }

  /** WHOOSH! Out of the other end of the nearest found wormhole, and on to the next place from there. */
  private jumpThrough() {
    const s = this.ship;
    let best = -1;
    config.secrets.forEach((sec, i) => {
      if (sec.kind !== 'madonreika' || s.secrets[i] !== 1 || !sec.exit) return;
      const far = (j: number) => towards(s, config.secrets[j].x, config.secrets[j].y).distance;
      if (best < 0 || far(i) < far(best)) best = i;
    });
    const exit = config.secrets[best]?.exit;
    if (!exit) return;
    s.secrets[best] = 2;
    s.x = exit.x;
    s.y = exit.y;
    s.target = Math.min(config.route.length - 1, Math.max(s.target, exit.target));
    s.choice = -1;
    this.threats = [];
    this.on.wormhole(best);
    this.legStarts();
  }

  // ---------------------------------------------------------------------------
  // Kapteenin käskyt: requests that need "Tehkää niin!"
  // ---------------------------------------------------------------------------

  /** A station asks the Captain. Only one request of each kind at a time. */
  private ask(what: RequestKind, station: string) {
    const s = this.ship;
    if (s.requests?.some((r) => r.what === what) || s.time < (this.askAgainAt[what] ?? 0)) return;
    if (what === 'veto' && this.tractorTarget() < 0) return; // nothing to pull
    const r: CaptainRequest = { id: this.nextId++, from: stationIndex(station), what, time: config.captain.requestSeconds };
    s.requests = [...(s.requests ?? []), r];
    this.on.request(r);
  }

  private answerRequest(id: number, ok: boolean) {
    const s = this.ship;
    const r = s.requests?.find((x) => x.id === id);
    if (!r) return;
    s.requests = s.requests!.filter((x) => x !== r);
    this.on.requestDone(r, ok);
    if (!ok) { this.askAgainAt[r.what] = s.time + 4; return; }
    if (r.what === 'warp') this.warp();
    if (r.what === 'madonreika') this.jumpThrough();
    if (r.what === 'veto') this.tractorBeam();
    if (r.what === 'aseet') s.weaponsFree = true;
  }

  /** Requests expire; with nobody at Kapteeni the autopilot says yes quickly. */
  private tickRequests(dt: number) {
    const s = this.ship;
    for (const r of [...(s.requests ?? [])]) {
      r.time -= dt;
      const waited = config.captain.requestSeconds - r.time;
      if (!this.manned('kapteeni') && waited >= config.captain.autoApprove) this.answerRequest(r.id, true);
      else if (r.time <= 0) {
        s.requests = s.requests!.filter((x) => x !== r);
        this.askAgainAt[r.what] = s.time + 4;
        this.on.requestDone(r, null);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Vaarat: rocks, pirates and pies
  // ---------------------------------------------------------------------------

  private add(kind: ThreatKind, x: number, y: number, vx: number, vy: number, hp = 1): Threat {
    const t: Threat = { id: this.nextId++, kind, x, y, vx, vy, hp, age: 0, timer: 2, orbit: 0, leaving: false, weak: false };
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
        const a = rad(this.pirateDir);
        const p = this.add('mohko', s.x + Math.cos(a) * 900, s.y + Math.sin(a) * 900, 0, 0, config.danger.pirate.hp);
        p.orbit = this.pirateDir;
        // Taktiikka was warned in time: it already asks for permission to shoot
        const w = s.warnings?.find((x) => x.kind === 'mohko');
        if (w?.sent?.includes(stationIndex('taktiikka'))) this.ask('aseet', 'taktiikka');
        s.warnings = s.warnings?.filter((x) => x !== w);
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
    // Something breaks: one station's console that isn't broken yet
    const working = config.stations.map((_, i) => i).filter((i) => !s.faults?.some((f) => f.station === i));
    if (!blocked && working.length) {
      const station = working[Math.floor(Math.random() * working.length)];
      s.faults = [...(s.faults ?? []), { id: this.nextId++, station, left: config.faults.tapsToFix }];
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
    // The pirate may only be shot after the Captain says "aseet vapaiksi"
    if (t.kind === 'mohko' && !s.weaponsFree) { this.ask('aseet', 'taktiikka'); return; }
    s.reload = config.tactical.reload;
    if (faultAt(s, 'taktiikka')) s.reload *= 2; // broken: slow laser
    if (boosted(s, 'taktiikka')) s.reload /= 2;
    if (s.alert > 0) s.reload /= 2; // red alert: everyone is twice as fast
    t.hp -= 1 + (t.weak ? 1 : 0) + (boosted(s, 'taktiikka') ? 1 : 0);
    this.on.zap(t);
    if (t.hp <= 0) {
      this.remove(t);
      this.on.pop(t);
    }
  }

  private raiseShields() {
    const s = this.ship;
    if (s.shieldCharge > 0) return;
    s.shield = config.tactical.shieldSeconds;
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
    s.boosts = s.boosts!.map((b) => Math.max(0, b - dt));
    if (this.autoShieldAt > 0 && s.time >= this.autoShieldAt) {
      this.autoShieldAt = -1;
      if (s.shieldCharge <= 0) this.raiseShields();
    }
    this.tickRequests(dt);
    if (!this.threats.some((t) => t.kind === 'mohko')) s.weaponsFree = false; // a new pirate needs a new order
    s.fog = this.inFogArea() && s.fogClear <= 0;
    if (s.choice >= 0) {
      // Nobody at the Captain's chair: the autopilot takes the first route quickly
      if (!this.manned('kapteeni')) s.choiceTime = Math.min(s.choiceTime, 3);
      s.choiceTime -= dt;
      if (s.choiceTime <= 0) this.chooseRoute(0);
    }
  }

  // ---------------------------------------------------------------------------
  // Konehuone: repairs and ⚡ boosts. Neuvonantaja: 💖 boosts
  // ---------------------------------------------------------------------------

  /** How much one repair tap counts: less with a lost wrench, more when boosted or on red alert. */
  private repairTaps() {
    const s = this.ship;
    let taps = 1;
    if (faultAt(s, 'konehuone')) taps /= 2;
    if (boosted(s, 'konehuone')) taps *= 2;
    if (s.alert > 0) taps *= 2;
    return taps;
  }

  /** ⚡ from Konehuone to another station (it charges in the reactor game). */
  private powerBoost(station: number) {
    const s = this.ship;
    if (!config.stations[station] || config.stations[station].id === 'konehuone') return;
    if (s.time - this.lastPower < config.boosts.power.chargeSeconds) return;
    this.lastPower = s.time;
    this.giveBoost(station, config.boosts.power.seconds, 1);
  }

  /** 💖 from Neuvonantaja to a crewmate, after enough good heart taps. */
  private cheerBoost(station: number) {
    if (!config.stations[station] || this.heartBeats < config.boosts.cheer.beats) return;
    this.heartBeats = 0;
    this.cheer(config.boosts.cheer.morale);
    this.giveBoost(station, config.boosts.cheer.seconds, 2);
  }

  private giveBoost(station: number, seconds: number, by: 1 | 2) {
    const s = this.ship;
    s.boosts![station] = Math.max(s.boosts![station] ?? 0, seconds);
    s.boostBy![station] = by;
    const id = config.stations[station].id;
    // Some boosts work right away
    if (id === 'kapteeni') s.alertCharge = 0;
    if (id === 'tiede') s.scanCharge = 0;
    if (id === 'viestinta' && s.call) s.call.time += 10;
    this.on.boost(station, by);
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
        // A random mood, and two other moods' answers as the wrong ones
        const moods = config.aliens.moods.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 3);
        const mood = moods[0];
        const order = moods.sort(() => Math.random() - 0.5);
        s.call = { msg: Math.floor(Math.random() * config.aliens.messages.length), mood, order, time: config.aliens.answerSeconds };
        this.on.call();
      }
    }
  }

  /** button = which of the 3 answer buttons was tapped. */
  private answer(button: number) {
    const s = this.ship;
    if (!s.call || !(button in s.call.order)) return;
    const right = s.call.order[button] === s.call.mood;
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
  /** The nearest found crystal the tractor beam can reach (-1 = none). */
  tractorTarget() {
    const s = this.ship;
    if (s.tractorCharge > 0) return -1;
    let best = -1;
    let bestDistance = config.ops.tractorRange * (boosted(s, 'operaatiot') ? 2 : 1);
    config.secrets.forEach((sec, i) => {
      const d = towards(s, sec.x, sec.y).distance;
      if (sec.kind === 'kristalli' && s.secrets[i] === 1 && d < bestDistance) { best = i; bestDistance = d; }
    });
    return best;
  }

  private tractorBeam() {
    const s = this.ship;
    const best = this.tractorTarget();
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
  // Ennakkovaroitukset: Operaatiot sees rock showers and pirates coming and forwards them
  // ---------------------------------------------------------------------------

  private warn(kind: Warning['kind'], dir: number, time: number) {
    const s = this.ship;
    s.warnings = [...(s.warnings ?? []), { id: this.nextId++, kind, dir: (dir + 360) % 360, time, sent: [] }];
  }

  /** Operaatiot sends warning id to a station. */
  private forward(id: number, station: number) {
    const w = this.ship.warnings?.find((x) => x.id === id);
    if (!w || !config.stations[station] || w.sent?.includes(station)) return;
    w.sent = [...(w.sent ?? []), station];
  }

  private tickWarnings(dt: number) {
    const s = this.ship;
    this.showerTimer -= dt;
    if (this.showerTimer <= 0) {
      this.showerTimer = config.warnings.showerEvery;
      this.warn('kivisade', s.heading + random(-100, 100), config.warnings.lead);
    }
    for (const w of [...(s.warnings ?? [])]) {
      w.time -= dt;
      // Nobody at Operaatiot: warnings forward themselves
      if (!this.manned('operaatiot') && config.warnings.lead - w.time >= config.autopilot.warnSeconds) {
        this.forward(w.id, stationIndex('taktiikka'));
        this.forward(w.id, stationIndex('ohjaus'));
      }
      if (w.kind === 'kivisade' && w.time <= 0) {
        s.warnings = s.warnings!.filter((x) => x !== w);
        this.rockShower(w);
      }
    }
  }

  /** A shower of rocks from one direction. If Taktiikka was warned, the shields go up by themselves. */
  private rockShower(w: Warning) {
    const s = this.ship;
    const rock = config.danger.rock;
    for (let k = 0; k < config.warnings.rocks; k++) {
      const a = rad(w.dir + random(-15, 15));
      const d = random(850, 1050);
      const x = s.x + Math.cos(a) * d;
      const y = s.y + Math.sin(a) * d;
      const aim = towards({ x, y }, s.x + random(-150, 150), s.y + random(-150, 150));
      const speed = rock.speed * random(1.5, 2.1);
      this.add('kivi', x, y, Math.cos(rad(aim.angle)) * speed, Math.sin(rad(aim.angle)) * speed);
    }
    // Taktiikka was warned: shields go up by themselves a moment before the rocks get here
    if (w.sent?.includes(stationIndex('taktiikka'))) this.autoShieldAt = s.time + 3.5;
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
      this.answer(right ? call.order.indexOf(call.mood) : call.order.findIndex((m) => m !== call.mood));
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
    .map((t) => ({ id: t.id, k: t.kind, dx: Math.round(t.x - s.x), dy: Math.round(t.y - s.y), w: t.weak }))
    .filter((t) => Math.hypot(t.dx, t.dy) < near);
  return {
    ...s,
    x: Math.round(s.x), y: Math.round(s.y), heading: Math.round(s.heading), speed: Math.round(s.speed),
    warpCharge: Math.ceil(s.warpCharge), time: Math.round(s.time * 10) / 10,
    shield: Math.ceil(s.shield), shieldCharge: Math.ceil(s.shieldCharge), reload: Math.round(s.reload * 10) / 10,
    choiceTime: Math.ceil(s.choiceTime), alert: Math.ceil(s.alert), alertCharge: Math.ceil(s.alertCharge),
    fogClear: Math.ceil(s.fogClear), scanCharge: Math.ceil(s.scanCharge), secrets: [...s.secrets],
    morale: Math.round(s.morale), tractorCharge: Math.ceil(s.tractorCharge),
    requests: (s.requests ?? []).map((r) => ({ ...r, time: Math.ceil(r.time) })),
    boosts: s.boosts!.map((b) => Math.ceil(b)),
    warnings: (s.warnings ?? []).map((w) => ({ ...w, dir: Math.round(w.dir), time: Math.ceil(w.time) })),
    call: s.call ? { ...s.call, time: Math.ceil(s.call.time) } : null,
    radar,
  };
}
