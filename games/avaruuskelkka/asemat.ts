// 📱 ASEMAT – what the phones show. Every phone is one console on the bridge.
// Phones never decide what happens: they send commands to the main screen
// (simulaatio.ts) and show what it tells them. Plain HTML buttons, no Phaser.
//
// Each station has a view: a function that returns its HTML once, and an
// optional live() that updates numbers 5 times a second (without redrawing buttons).

import { online } from '@kit/firebase';
import { storage } from '@kit/storage';
import { sfx } from '@kit/sound';
import { config, type StationDef } from './config';
import {
  paths, crewByStation, towards, angleDiff, stardate,
  type Phase, type PlayerInfo, type ShipState, type HelmInput,
} from './simulaatio';

const app = document.createElement('div');

/** Everything the phone knows right now. */
const now = {
  code: '',
  uid: '',
  phase: 'aula' as Phase,
  players: {} as Record<string, PlayerInfo>,
  ship: null as ShipState | null,
  /** My station and colour, or null while choosing. */
  me: null as PlayerInfo | null,
};

// ---------------------------------------------------------------------------
// Starting: ?huone=1234 joins that room, ?liity shows number buttons
// ---------------------------------------------------------------------------

export async function startPhone(code: string) {
  setUpPage();
  show(`<div class="info">Yhdistetään… 🛰️</div>`);
  now.code = code;
  now.uid = await online.connect();
  if (!(await online.roomExists(code))) {
    show(`<div class="info">Huonetta ${code} ei löytynyt 😕</div>
      <button class="big" data-go="liity">🔢 Näppäile koodi</button>`);
    return;
  }
  const p = paths(code);
  now.me = storage.load<PlayerInfo | null>(`asema-${code}-${now.uid}`, null);
  online.watch<Phase>(p.phase, (v) => { now.phase = v ?? 'aula'; render(); });
  online.watch<Record<string, PlayerInfo>>(p.players, (v) => {
    now.players = v ?? {};
    fixSameColour();
    render();
  });
  online.watch<ShipState>(p.state, (v) => { now.ship = v; live(); });
  // Every time the connection comes back (phone woke up), sit down at my station again.
  online.watch<boolean>('.info/connected', (connected) => { if (connected && now.me) sitDown(now.me); });
}

/** Number buttons for typing the room code shown on the main screen. */
export function startJoinPad() {
  setUpPage();
  let typed = '';
  const draw = (message = '') => show(`
    ${bar('Liity laivaan', 0)}
    <div class="code">${typed.padEnd(4, '·')}</div>
    <div class="info">${message}</div>
    <div class="pad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-digit="${n}">${n}</button>`).join('')}
      <button data-digit="del">⌫</button><button data-digit="0">0</button><span></span>
    </div>`);
  draw();
  app.onclick = async (e) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>('[data-digit]')?.dataset.digit;
    if (!d) return;
    typed = d === 'del' ? typed.slice(0, -1) : (typed + d).slice(0, 4);
    draw();
    if (typed.length === 4) {
      if (await online.roomExists(typed)) location.search = `?huone=${typed}`;
      else { typed = ''; draw('Ei löytynyt, kokeile uudestaan'); }
    }
  };
}

// ---------------------------------------------------------------------------
// Choosing a station
// ---------------------------------------------------------------------------

function sitDown(me: PlayerInfo) {
  now.me = me;
  storage.save(`asema-${now.code}-${now.uid}`, me);
  const path = paths(now.code).player(now.uid);
  online.write(path, me);
  online.removeOnLeave(path);
  render();
}

function standUp() {
  now.me = null;
  storage.save(`asema-${now.code}-${now.uid}`, null);
  online.remove(paths(now.code).player(now.uid));
  render();
}

function pick(station: string) {
  sitDown({ station, colour: freeColour() });
}

function freeColour() {
  const used = Object.entries(now.players).filter(([uid]) => uid !== now.uid).map(([, p]) => p.colour);
  return config.colours.find((c) => !used.includes(c)) ?? config.colours[0];
}

/** Two phones picked at the same moment and got the same colour: the later id picks again. */
function fixSameColour() {
  if (!now.me) return;
  const clash = Object.entries(now.players).some(([uid, p]) => uid < now.uid && p.colour === now.me!.colour);
  if (clash) sitDown({ ...now.me, colour: freeColour() });
}

/** Sends a tap to the main screen, e.g. send('aloita'). */
function send(action: string, value?: number | boolean | string) {
  if (!now.me) return;
  const command = { uid: now.uid, station: now.me.station, action, ...(value === undefined ? {} : { value }) };
  online.add(paths(now.code).commands, command);
}

/** Sends a held-down value (like the Helm's wheel) to the main screen. */
function sendInput(values: Record<string, number | boolean>) {
  if (now.me) online.write(paths(now.code).input(now.me.station), values);
}

// ---------------------------------------------------------------------------
// Station views during the trip
// ---------------------------------------------------------------------------

interface StationView {
  html: () => string;
  /** Updates numbers on the screen when the ship's state changes. */
  live?: (ship: ShipState) => void;
  /** Called when a button with data-hold is pressed (true) or let go (false). */
  hold?: (name: string, down: boolean) => void;
}

const $ = (id: string) => document.getElementById(id);

/** Ohjaus: steer left/right, choose the speed, WARP! */
const helm = (() => {
  const input: HelmInput = { turn: 0, throttle: 0 };
  const held = { vasen: false, oikea: false };
  const names = ['Seis', '1/4', '1/2', 'Täysi'];
  return {
    html: () => `
      <div class="readout"><div class="compass"><span id="nuoli">▲</span></div>
        <div><b id="kohde"></b><span id="matka"></span><span id="nopeus"></span></div></div>
      <div class="row">
        <button class="hold c3" data-hold="vasen">◀ Vasen</button>
        <button class="hold c3" data-hold="oikea">Oikea ▶</button>
      </div>
      <div class="row throttle">${names.map((n, i) => `<button class="c${i + 1}" data-throttle="${i}">${n}</button>`).join('')}</div>
      <button class="big c2" id="warp" data-send="warp">✨ WARP! ✨</button>`,
    live: (s: ShipState) => {
      const t = config.route[s.target];
      const dir = towards(s, t.x, t.y);
      // The arrow shows where the target is compared to where the ship points (up = straight ahead)
      $('nuoli')!.style.transform = `rotate(${angleDiff(dir.angle, s.heading)}deg)`;
      $('kohde')!.textContent = `${t.emoji} ${t.name}`;
      $('matka')!.textContent = `${Math.round(dir.distance)} km`;
      $('nopeus')!.textContent = s.warping ? 'WARP!!!' : `Nopeus ${s.speed}`;
      const warp = $('warp') as HTMLButtonElement;
      warp.disabled = s.warpCharge > 0;
      warp.textContent = s.warpCharge > 0 ? `Warp latautuu… ${s.warpCharge}` : '✨ WARP! ✨';
      // Just sat down: show the speed the ship already has
      if (!document.querySelector('.throttle .on')) { input.throttle = s.throttle; markThrottle(s.throttle); }
    },
    hold: (name: string, down: boolean) => {
      held[name as 'vasen' | 'oikea'] = down;
      input.turn = (held.oikea ? 1 : 0) - (held.vasen ? 1 : 0);
      sendInput({ ...input });
    },
    setThrottle: (n: number) => {
      input.throttle = n;
      markThrottle(n);
      sendInput({ ...input });
    },
  };
})();

function markThrottle(n: number) {
  document.querySelectorAll('[data-throttle]').forEach((b) => b.classList.toggle('on', Number((b as HTMLElement).dataset.throttle) === n));
}

/** Kapteeni during the trip: the route, with the places already visited ticked. */
const captain: StationView = {
  html: () => `<div class="route">${config.route.map((w, i) => `<div data-paikka="${i}">${w.emoji} ${w.name}</div>`).join('')}</div>
    <div class="silly" id="hassu"></div>`,
  live: (s) => {
    document.querySelectorAll<HTMLElement>('[data-paikka]').forEach((el) => {
      const i = Number(el.dataset.paikka);
      el.className = i < s.target ? 'done' : i === s.target ? 'next' : '';
    });
    $('hassu')!.textContent = `Tähtipäivä ${stardate(s.time)}`;
  },
};

/** Stations that get their real job in a later phase: a console that beeps and says silly things. */
const waiting: StationView = {
  html: () => `<div class="silly" id="hassu"></div>
    <div class="row">${[1, 2, 3].map((i) => `<button class="c${i + 1}" data-beep="${i}">${10 + i * 17}-${'ABK'[i - 1]}</button>`).join('')}</div>`,
  live: (s) => {
    const lines = config.sillyLines;
    $('hassu')!.textContent = lines[Math.floor(s.time / 4) % lines.length];
  },
};

const views: Record<string, StationView> = { ohjaus: helm, kapteeni: captain };

// ---------------------------------------------------------------------------
// Drawing the phone screen
// ---------------------------------------------------------------------------

/** What's on screen now – only redraw the buttons when this changes. */
let drawn = '';

function render() {
  if (!now.me) { drawn = ''; return showPicker(); }
  const s = config.stations.find((x) => x.id === now.me!.station);
  if (!s) return standUp();
  const key = `${s.id}/${now.phase}/${now.me.colour}`;
  if (key === drawn) return;
  drawn = key;
  showStation(s);
  live();
}

/** Updates the numbers of the current view. */
function live() {
  if (!now.me || !now.ship || now.phase !== 'matka') return;
  (views[now.me.station] ?? waiting).live?.(now.ship);
}

/** A console bar: a rounded coloured end + title. */
function bar(title: string, colour: number, right = '') {
  return `<div class="bar"><span class="cap c${colour}"></span><span class="title">${title}</span><span class="cap2 c${colour}">${right}</span></div>`;
}

function showPicker() {
  const crew = crewByStation(now.players);
  show(`${bar('Valitse asema', 0, config.ship.name)}
    <div class="stations">
      ${config.stations.map((s, i) => {
        const full = crew[s.id].length >= config.playersPerStation;
        return `<button class="station" data-pick="${s.id}" ${full ? 'disabled' : ''}>
          <span class="pill c${i % 7}">${s.emoji}</span>
          <span><b>${s.name}</b><small>${s.job}</small></span>
          <span class="dots">${crew[s.id].map((p) => `<i style="background:${p.colour}"></i>`).join('')}</span>
        </button>`;
      }).join('')}
    </div>`);
}

function showStation(s: StationDef) {
  const header = `<header>
      <span class="pill c0">${s.emoji}</span><span><b>${s.name}</b><small>${s.job}</small></span>
      <i style="background:${now.me!.colour}"></i>
    </header>`;
  if (now.phase === 'aula') {
    const startButton = s.id === 'kapteeni' ? `<button class="big c0" data-send="aloita">🚀 Tehkää niin!</button>` : '';
    show(`${header}<div class="info">Odotetaan lähtöä… ⏳</div>${startButton}
      <button class="small" data-go="vaihda">↩️ Vaihda asemaa</button>`);
  } else if (now.phase === 'perilla') {
    const again = s.id === 'kapteeni' ? `<button class="big c1" data-send="uusi">🔄 Uusi matka</button>` : '';
    show(`${header}<div class="info">🎉 Perillä! 🎉<small>Hyvää työtä, miehistö!</small></div>${again}`);
  } else {
    show(`${header}${(views[s.id] ?? waiting).html()}`);
  }
}

// ---------------------------------------------------------------------------
// Page set-up and the button handlers
// ---------------------------------------------------------------------------

function show(html: string) {
  app.innerHTML = html;
}

function setUpPage() {
  document.title = config.title;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  app.className = 'phone';
  document.body.appendChild(app);
  app.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || b.dataset.hold) return;
    sfx('click', { pitch: 1 + Math.random() }); // every console beeps a bit differently
    if (b.dataset.pick) pick(b.dataset.pick);
    if (b.dataset.send) send(b.dataset.send);
    if (b.dataset.throttle) helm.setThrottle(Number(b.dataset.throttle));
    if (b.dataset.go === 'vaihda') standUp();
    if (b.dataset.go === 'liity') location.search = '?liity';
  });
  // Buttons that work while held down (steering)
  const holdButton = (e: PointerEvent) => (e.target as HTMLElement).closest<HTMLElement>('[data-hold]');
  app.addEventListener('pointerdown', (e) => {
    const b = holdButton(e);
    if (!b || !now.me) return;
    b.setPointerCapture(e.pointerId);
    b.classList.add('on');
    sfx('click');
    views[now.me.station]?.hold?.(b.dataset.hold!, true);
  });
  const release = (e: PointerEvent) => {
    const b = holdButton(e);
    if (!b || !now.me || !b.classList.contains('on')) return;
    b.classList.remove('on');
    views[now.me.station]?.hold?.(b.dataset.hold!, false);
  };
  app.addEventListener('pointerup', release);
  app.addEventListener('pointercancel', release);
  app.addEventListener('contextmenu', (e) => e.preventDefault()); // long press must not open a menu
}

const colourCss = config.lcars.map((c, i) => `.c${i} { background: ${c}; }`).join('\n');

const CSS = `
  body { margin: 0; background: #000; color: #fff;
    font-family: "Arial Narrow", "Roboto Condensed", "Helvetica Neue", system-ui, sans-serif; font-stretch: condensed;
    -webkit-user-select: none; user-select: none; touch-action: manipulation; -webkit-touch-callout: none; }
  .phone { max-width: 520px; margin: 0 auto; padding: 14px; box-sizing: border-box; min-height: 100vh;
    display: flex; flex-direction: column; gap: 12px; }
  ${colourCss}
  b { text-transform: uppercase; letter-spacing: 1px; }
  small { display: block; font-size: 14px; opacity: 0.75; font-weight: normal; }
  button { font: inherit; font-weight: bold; text-transform: uppercase; color: #000; border: none; border-radius: 999px;
    cursor: pointer; padding: 14px; font-size: 20px; }
  button:active, button.on { filter: brightness(1.4); transform: scale(0.97); }
  button:disabled { opacity: 0.35; }
  .bar { display: flex; gap: 8px; align-items: center; height: 44px; }
  .bar .cap { width: 44px; height: 44px; border-radius: 22px 0 0 22px; }
  .bar .title { white-space: nowrap; font-size: 26px; font-weight: bold; text-transform: uppercase; color: ${config.lcars[0]}; }
  .bar .cap2 { flex: 1; height: 44px; border-radius: 0 22px 22px 0; color: #000; font-weight: bold;
    text-transform: uppercase; display: flex; align-items: center; justify-content: flex-end; padding-right: 16px; font-size: 14px; overflow: hidden; white-space: nowrap; }
  .stations { display: flex; flex-direction: column; gap: 8px; }
  .station, header { display: flex; align-items: center; gap: 12px; padding: 0 14px 0 0; text-align: left;
    background: #111; color: #fff; font-size: 20px; border-radius: 32px 12px 12px 32px; text-transform: none; }
  header { border-bottom: 6px solid ${config.lcars[0]}; }
  .station > span:nth-child(2), header > span:nth-child(2) { flex: 1; padding: 8px 0; }
  .pill { font-size: 34px; width: 70px; height: 64px; display: grid; place-items: center; border-radius: 32px 0 0 32px; }
  .dots i, header i { display: inline-block; width: 18px; height: 18px; border-radius: 50%; margin-left: 4px; }
  header i { width: 28px; height: 28px; }
  .info { text-align: center; font-size: 26px; padding: 22px 0; text-transform: uppercase; color: ${config.lcars[4]}; }
  .big { font-size: 28px; padding: 18px; }
  .small { background: #222; color: #fff; font-size: 18px; padding: 12px; margin-top: auto; }
  .row { display: flex; gap: 10px; }
  .row > button { flex: 1; }
  .hold { font-size: 26px; padding: 28px 0; border-radius: 24px; }
  .throttle button { font-size: 18px; padding: 16px 0; opacity: 0.55; }
  .throttle button.on { opacity: 1; outline: 4px solid #fff; }
  .readout { display: flex; gap: 14px; align-items: center; background: #111; border-radius: 16px; padding: 12px; }
  .readout b, .readout span { display: block; }
  .readout #kohde { color: ${config.lcars[0]}; font-size: 22px; }
  .readout #matka { font-size: 30px; font-weight: bold; }
  .readout #nopeus { color: ${config.lcars[2]}; }
  .compass { width: 84px; height: 84px; border-radius: 50%; border: 4px solid ${config.lcars[1]}; display: grid; place-items: center; font-size: 44px; color: ${config.lcars[0]}; flex: none; }
  #nuoli { transition: transform 0.2s; display: inline-block !important; }
  .route div { padding: 10px 16px; margin: 6px 0; border-radius: 999px; background: #111; font-size: 20px; text-transform: uppercase; }
  .route .done { background: #1f4d1a; text-decoration: line-through; opacity: 0.7; }
  .route .next { background: ${config.lcars[0]}; color: #000; font-weight: bold; }
  .silly { text-align: center; font-size: 22px; padding: 24px 8px; color: ${config.lcars[1]}; min-height: 60px; }
  .code { text-align: center; font-size: 56px; letter-spacing: 16px; color: ${config.lcars[0]}; }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .pad button { background: ${config.lcars[1]}; font-size: 34px; padding: 18px 0; }
`;
