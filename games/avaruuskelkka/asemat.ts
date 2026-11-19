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
  paths, crewByStation, towards, angleDiff, stardate, hull, place, moodFace, callAnswers, stationIndex,
  faultAt, faultText, boosted, sideText, deedsOf, teamwork,
  type Phase, type PlayerInfo, type ShipState, type HelmInput, type ThreatKind, type Warning,
} from './simulaatio';

const app = document.createElement('div');
/** Console colours: always 7, repeating config.lcars if the kids put in fewer. */
const lcars = Array.from({ length: 7 }, (_, i) => config.lcars[i % config.lcars.length]);

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

/** "⚠️ Kivisade" / "⚠️ Möhköttäjä tulossa". */
function warningText(w: Warning) {
  return w.kind === 'kivisade' ? '⚠️ Kivisade' : `⚠️ ${config.danger.pirate.name} tulossa`;
}

/** An arrow pointing where something comes from, seen from the ship (up = straight ahead). */
function arrowFor(s: ShipState, dir: number) {
  return `<span class="arrow" style="display:inline-block; transform: rotate(${angleDiff(dir, s.heading)}deg)">▲</span>`;
}

/** Warnings Operaatiot forwarded to this station. */
function forwardedWarnings(s: ShipState, station: string) {
  const mine = stationIndex(station);
  return (s.warnings ?? []).filter((w) => w.sent?.includes(mine)).map((w) => `<div class="warning">${warningText(w)} ${Math.max(0, w.time)} s:
    ${arrowFor(s, w.dir)} ${sideText(angleDiff(w.dir, s.heading))}<small>📡 Operaatiot varoitti${station === 'taktiikka' && w.kind === 'kivisade' ? ' – kilvet nousevat itsestään' : ''}</small></div>`).join('');
}

/** Is a request of this kind waiting for the Captain? */
const waitingFor = (s: ShipState, what: string) => s.requests?.some((r) => r.what === what) ?? false;

/** Buttons for choosing a crewmate (for ⚡ and 💖): one per station, except the ones in skip. */
function crewButtons(action: string, skip: string[], icon: string) {
  return config.stations.map((st, i) => (skip.includes(st.id) ? ''
    : `<button class="c${i % 10} pick" data-send="${action}" data-value="${i}">${icon} ${st.emoji} ${st.name}</button>`)).join('');
}

/** Ohjaus: steer left/right, choose the speed, WARP! */
const helm = (() => {
  const input: HelmInput = { turn: 0, throttle: 0 };
  const held = { vasen: false, oikea: false };
  const names = ['Seis', '1/4', '1/2', 'Täysi'];
  return {
    html: () => `
      <div class="readout"><div class="compass"><span id="nuoli">▲</span></div>
        <div><b id="kohde"></b><span id="matka"></span><span id="nopeus"></span></div></div>
      <div id="varo"></div>
      <div class="row">
        <button class="hold c3" data-hold="vasen">◀ Vasen</button>
        <button class="hold c3" data-hold="oikea">Oikea ▶</button>
      </div>
      <div class="row throttle">${names.map((n, i) => `<button class="c${i + 1}" data-throttle="${i}">${n}</button>`).join('')}</div>
      <button class="big c2" id="warp" data-send="warp">✨ WARP! ✨</button>`,
    live: (s: ShipState) => {
      const t = place(s, s.target);
      const dir = towards(s, t.x, t.y);
      // The arrow shows where the target is compared to where the ship points (up = straight ahead)
      $('nuoli')!.style.transform = s.fog ? 'none' : `rotate(${angleDiff(dir.angle, s.heading)}deg)`;
      $('nuoli')!.textContent = s.fog ? '?' : '▲';
      $('kohde')!.textContent = s.fog ? '🌫️ Sumua! Kysy Tieteeltä suunta' : `${t.emoji} ${t.name}`;
      $('varo')!.innerHTML = forwardedWarnings(s, 'ohjaus');
      $('matka')!.textContent = s.fog ? '??? km' : `${Math.round(dir.distance)} km`;
      $('nopeus')!.textContent = s.warping ? 'WARP!!!' : `Nopeus ${s.speed}`;
      const warp = $('warp') as HTMLButtonElement;
      const asking = waitingFor(s, 'warp');
      warp.disabled = s.warpCharge > 0 || asking;
      warp.textContent = s.warpCharge > 0 ? `Warp latautuu… ${s.warpCharge}`
        : asking ? '⏳ Odotetaan kapteenin lupaa…' : '✨ WARP! (kysy kapteenilta) ✨';
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

/** Kapteeni during the trip: everyone's status, red alert, route choices and the route. */
const captain: StationView = (() => {
  let shownChoice = -2;
  let shownRequests = '';
  /** "lyhyt mutta kivinen" etc. – compares the two places. */
  const describe = (s: ShipState, i: number, w: { x: number; y: number; rocks?: boolean; pirate?: boolean; fog?: boolean }) => {
    const prev = place(s, i - 1);
    const next = config.route[i + 1] ? place(s, i + 1) : w;
    const length = towards(prev, w.x, w.y).distance + towards(w, next.x, next.y).distance;
    const other = config.route[i].alt && w === config.route[i] ? config.route[i].alt! : config.route[i];
    const otherLength = towards(prev, other.x, other.y).distance + towards(other, next.x, next.y).distance;
    const danger = w.rocks || w.pirate || w.fog;
    return `${length <= otherLength ? 'lyhyt' : 'pitkä'} mutta ${danger ? 'vaarallinen' : 'tylsä'}`;
  };
  return {
    html: () => {
      shownChoice = -2;
      shownRequests = '';
      return `
      <div class="status" id="tila"></div>
      <div id="pyynnot"></div>
      <div id="valinta"></div>
      <button class="big alertbtn" id="halytys" data-send="halytys">🚨 Punainen hälytys!</button>
      <div class="route">${config.route.map((_, i) => `<div data-paikka="${i}"></div>`).join('')}</div>
      <div class="silly" id="hassu"></div>`;
    },
    live: (s) => {
      const faults = s.faults?.length ?? 0;
      $('tila')!.innerHTML = `<span>🛡️ Runko ${hull(s)} %</span><span>💥 Vikoja ${faults}</span>
        <span>${s.shield > 0 ? '🛡️ Kilvet ylhäällä' : '🛡️ Kilvet alhaalla'}</span><span>💎 ${s.stars}</span>`;
      const alert = $('halytys') as HTMLButtonElement;
      alert.disabled = s.alertCharge > 0;
      alert.textContent = s.alert > 0 ? `🚨 HÄLYTYS! ${s.alert}` : s.alertCharge > 0 ? `Hälytys latautuu… ${s.alertCharge}` : '🚨 Punainen hälytys!';
      document.querySelectorAll<HTMLElement>('[data-paikka]').forEach((el) => {
        const i = Number(el.dataset.paikka);
        const w = place(s, i);
        el.textContent = `${w.emoji} ${w.name}`;
        el.className = i < s.target ? 'done' : i === s.target ? 'next' : '';
      });
      $('hassu')!.textContent = `Tähtipäivä ${stardate(s.time)}`;
      // Requests waiting for "Tehkää niin!": redraw only when the list changes, update the seconds
      const requests = s.requests ?? [];
      const key = requests.map((r) => r.id).join(',');
      if (key !== shownRequests) {
        shownRequests = key;
        $('pyynnot')!.innerHTML = requests.map((r) => {
          const st = config.stations[r.from];
          return `<div class="request"><div>📨 ${st?.emoji ?? ''} ${st?.name ?? ''} pyytää: <b>${config.captain.requests[r.what]}</b> <span data-aika="${r.id}"></span></div>
            <div class="row"><button class="c0" data-send="hyvaksy" data-value="${r.id}">✅ Tehkää niin!</button>
            <button class="c5" data-send="hylkaa" data-value="${r.id}">❌ Ei</button></div></div>`;
        }).join('');
        if (requests.length) sfx('click', { pitch: 2.5 });
      }
      for (const r of requests) {
        const t = document.querySelector(`[data-aika="${r.id}"]`);
        if (t) t.textContent = `${r.time} s`;
      }
      // Route choice: redraw the two buttons only when a new choice starts or ends
      if (s.choice !== shownChoice) {
        shownChoice = s.choice;
        const box = $('valinta')!;
        if (s.choice < 0) { box.innerHTML = ''; return; }
        const a = config.route[s.choice];
        const b = a.alt!;
        box.innerHTML = `<div class="hint">Valitse reitti! <span id="aika"></span></div><div class="row">
          <button class="c0 choice" data-send="reitti" data-value="0">${a.emoji} ${a.name}<small>${describe(s, s.choice, a)}</small></button>
          <button class="c1 choice" data-send="reitti" data-value="1">${b.emoji} ${b.name}<small>${describe(s, s.choice, b)}</small></button></div>`;
      }
      if (s.choice >= 0) $('aika')!.textContent = `${s.choiceTime} s`;
    },
  };
})();

/** Tiede: hold to scan, find secrets, and see the way even in fog. */
const science: StationView = (() => {
  let holding = 0;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    holding = 0;
    const fill = $('lataus');
    if (fill) fill.style.width = '0%';
  };
  /** Fills the bar while the button is held; full = scan! */
  const grow = () => {
    const done = (performance.now() - holding) / 1000 / config.science.holdSeconds;
    const fill = $('lataus');
    if (!fill || !holding) return;
    fill.style.width = `${Math.min(100, done * 100)}%`;
    if (done >= 1) { send('skannaa'); sfx('powerup', { pitch: 1.5 }); stop(); return; }
    frame = requestAnimationFrame(grow);
  };
  return {
    html: () => `
      <div class="readout"><div class="compass"><span id="nuoli">▲</span></div>
        <div><b id="kohde"></b><span id="matka"></span><span id="sumu"></span></div></div>
      <button class="hold scan c6" data-hold="skannaa"><span class="fill" id="lataus"></span><span class="label" id="skanneri">📡 Pidä pohjassa: skannaa!</span></button>
      <div class="found" id="loydot"></div>`,
    live: (s) => {
      const t = place(s, s.target);
      const dir = towards(s, t.x, t.y);
      $('nuoli')!.style.transform = `rotate(${angleDiff(dir.angle, s.heading)}deg)`;
      $('kohde')!.textContent = `${t.emoji} ${t.name}`;
      $('matka')!.textContent = `${Math.round(dir.distance)} km`;
      $('sumu')!.textContent = s.fog ? '🌫️ Sumua! Kerro Ohjaukselle suunta!' : s.fogClear > 0 ? `Sumu poissa ${s.fogClear} s` : '';
      $('skanneri')!.textContent = s.scanCharge > 0 ? `Skanneri latautuu… ${s.scanCharge}` : '📡 Pidä pohjassa: skannaa!';
      // Found things: what they are, which way and how far (up = straight ahead)
      const found = config.secrets.map((sec, i) => ({ sec, i })).filter(({ i }) => s.secrets[i] === 1);
      $('loydot')!.innerHTML = found.length
        ? found.map(({ sec }) => {
          const look = config.secretLooks[sec.kind];
          const d = towards(s, sec.x, sec.y);
          return `<div>${look.emoji} ${look.name} <span class="arrow" style="transform: rotate(${angleDiff(d.angle, s.heading)}deg)">▲</span> ${Math.round(d.distance)} km</div>`;
        }).join('')
        : '<div class="hint">Ei löytöjä vielä – skannaa!</div>';
    },
    hold: (_name, down) => {
      if (down && !holding && (now.ship?.scanCharge ?? 0) <= 0) { holding = performance.now(); grow(); }
      if (!down) stop();
    },
  };
})();

/** Stations that get their real job in a later phase: a console that beeps and says silly things. */
const waiting: StationView = {
  html: () => `<div class="silly" id="hassu"></div>
    <div class="row">${[1, 2, 3].map((i) => `<button class="c${i + 1}" data-beep="${i}">${10 + i * 17}-${'ABK'[i - 1]}</button>`).join('')}</div>`,
  live: (s) => {
    const lines = config.sillyLines;
    $('hassu')!.textContent = lines[Math.floor(s.time / 4) % lines.length];
  },
};

/** Taktiikka: tap a threat on the radar to zap it, shields up before a hit. */
const tactical: StationView = (() => {
  const emoji: Record<ThreatKind, string> = {
    kivi: config.danger.rock.emoji, mohko: config.danger.pirate.emoji, piirakka: config.danger.pie.emoji,
  };
  /** The radar shows a bit more than the laser reaches (the dashed circle). */
  const scale = 1 / (config.tactical.range * 1.4);
  return {
    html: () => `
      <div class="radar" id="tutka"><div class="reach"></div><span class="me">${config.ship.emoji}</span></div>
      <div id="varo"></div>
      <div class="hint" id="laser"></div>
      <button class="big c2" id="kilvet" data-send="kilvet">🛡️ Kilvet ylös!</button>`,
    live: (s) => {
      const radar = $('tutka')!;
      const seen = new Set<string>();
      for (const t of s.radar ?? []) {
        const id = String(t.id);
        seen.add(id);
        let dot = radar.querySelector<HTMLElement>(`[data-zap="${id}"]`);
        if (!dot) {
          dot = document.createElement('button');
          dot.className = `dot ${t.k}`;
          dot.dataset.zap = id;
          dot.textContent = emoji[t.k];
          radar.appendChild(dot);
        }
        dot.style.left = `${50 + t.dx * scale * 50}%`;
        dot.style.top = `${50 + t.dy * scale * 50}%`;
        dot.classList.toggle('far', Math.hypot(t.dx, t.dy) > config.tactical.range);
        dot.classList.toggle('weak', !!t.w);
      }
      radar.querySelectorAll<HTMLElement>('[data-zap]').forEach((d) => { if (!seen.has(d.dataset.zap!)) d.remove(); });
      radar.classList.toggle('blurry', !!faultAt(s, 'taktiikka'));
      $('varo')!.innerHTML = forwardedWarnings(s, 'taktiikka');
      const pirate = (s.radar ?? []).some((t) => t.k === 'mohko');
      $('laser')!.textContent = s.reload > 0 ? 'Laser latautuu… 🔋'
        : pirate && waitingFor(s, 'aseet') ? '⏳ Odotetaan kapteenin lupaa ampua Möhköttäjää…'
          : pirate && !s.weaponsFree ? '🔒 Möhköttäjä: ammu = kysy kapteenilta lupa'
            : pirate ? '🔓 Aseet vapaat! PIU PIU! (🎯 = tupla)' : 'Kosketa kohdetta = PIU PIU! 🔴';
      const shield = $('kilvet') as HTMLButtonElement;
      shield.disabled = s.shield > 0 || s.shieldCharge > 0;
      shield.textContent = s.shield > 0 ? `🛡️ Kilvet ylhäällä ${s.shield}` : s.shieldCharge > 0 ? `Kilvet latautuu… ${s.shieldCharge}` : '🛡️ Kilvet ylös!';
    },
  };
})();

/** Konehuone: keep the reactor needle in the green to charge ⚡, send it to a station, fix faults. */
const engineering: StationView & { reset: () => void } = (() => {
  let shownFaults = '';
  let needle = 50;
  let speed = 0;
  let charge = 0;
  let timer = 0;
  const green = [30, 70];
  /** The needle wobbles by itself; in the green zone the ⚡ charges. */
  const tick = () => {
    const bar = $('neula');
    if (!bar) { clearInterval(timer); return; }
    speed = Math.max(-1.8, Math.min(1.8, speed + (Math.random() - 0.5) * 1.4));
    needle += speed;
    if (needle < 0 || needle > 100) { needle = Math.max(0, Math.min(100, needle)); speed = -speed; }
    const inGreen = needle >= green[0] && needle <= green[1];
    if (inGreen && charge < 100) charge = Math.min(100, charge + 5000 / (config.boosts.power.chargeSeconds * 1000));
    bar.style.left = `${needle}%`;
    $('reaktori')!.classList.toggle('ok', inGreen);
    $('virta')!.style.width = `${charge}%`;
    const targets = $('kohteet')!;
    if (charge >= 100 && !targets.innerHTML) {
      targets.innerHTML = `<div class="hint">⚡ Täynnä! Kenelle virtaa?</div>${crewButtons('virta', ['konehuone'], '⚡')}`;
    }
  };
  return {
    html: () => {
      shownFaults = '';
      clearInterval(timer);
      timer = window.setInterval(tick, 50);
      return `
      <div class="hint">Pidä reaktorin neula vihreällä ◀ ▶</div>
      <div class="reactor" id="reaktori"><span class="zone"></span><span class="needle" id="neula"></span></div>
      <div class="row"><button class="c3" data-reactor="-1">◀</button><button class="c3" data-reactor="1">▶</button></div>
      <div class="charge"><i id="virta"></i></div>
      <div class="crew" id="kohteet"></div>
      <div class="hint" id="runko"></div>
      <div class="faults" id="viat"></div>`;
    },
    live: (s) => {
      $('runko')!.textContent = `Runko ${hull(s)} %`;
      // Redraw the fault buttons only when they change, so taps aren't lost
      const faults = s.faults ?? [];
      const key = faults.map((f) => `${f.id}:${Math.ceil(f.left)}`).join(',');
      if (key === shownFaults) return;
      shownFaults = key;
      $('viat')!.innerHTML = faults.length
        ? faults.map((f) => `<button class="fault" data-fix="${f.id}">💥 ${faultText(f.station)}<small>Napauta ${Math.ceil(f.left)}×</small></button>`).join('')
        : '<div class="hint">Ei vikoja ✅ Kaikki kunnossa (melkein)</div>';
    },
    /** ◀ / ▶ nudges the needle. */
    nudge: (way: number) => { needle += way * 12; speed = 0; },
    /** ⚡ was sent: start charging again. */
    reset: () => { charge = 0; const t = $('kohteet'); if (t) t.innerHTML = ''; },
  } as StationView & { reset: () => void; nudge: (way: number) => void };
})();

/** Viestintä: the aliens talk in emoji – pick the friendly answer. */
const comms: StationView = (() => {
  let shown = '';
  return {
    html: () => { shown = ''; return `<div id="puhelu"></div><div class="silly" id="hassu"></div>`; },
    live: (s) => {
      const call = s.call ?? null;
      const broken = !!faultAt(s, 'viestinta');
      const helped = boosted(s, 'viestinta');
      const key = call ? `${call.msg}/${call.order.join('')}/${broken}/${helped}` : 'none';
      if (key !== shown) {
        shown = key;
        const a = config.aliens;
        // Broken: the message breaks up (every other emoji is ❓). Boosted: one wrong answer disappears.
        const said = call ? a.messages[call.msg] : '';
        const emoji = [...new Intl.Segmenter().segment(said)].map((x) => x.segment);
        const ask = broken ? emoji.map((ch, i) => (i % 2 ? '❓' : ch)).join('') : said;
        const hidden = call && helped ? call.order.findIndex((m) => m !== call.mood) : -1;
        // The mood is Neuvonantaja's secret – unless nobody is there
        const counselorHere = crewByStation(now.players).neuvonantaja?.length > 0;
        const mood = call ? a.moods[call.mood] : null;
        const moodHint = !mood ? '' : counselorHere
          ? '💖 Kysy Neuvonantajalta, miltä heistä tuntuu!'
          : `He näyttävät ${mood.face} ${mood.name.toUpperCase()}`;
        $('puhelu')!.innerHTML = call
          ? `<div class="call"><span class="alien">${a.emoji}</span><span class="says">${ask}</span></div>
             <div class="hint">${a.name} soittaa! <span id="aika"></span><br>${moodHint}</div>
             <div class="answers">${callAnswers(call).map((ans, i) => (i === hidden ? ''
               : `<button class="c${i + 1}" data-send="vastaa" data-value="${i}">${ans}</button>`)).join('')}</div>`
          : `<div class="info">Kuunnellaan avaruutta… 📡</div>`;
      }
      if (call) $('aika')!.textContent = `${call.time} s`;
      $('hassu')!.textContent = call ? '' : config.sillyLines[Math.floor(s.time / 4) % config.sillyLines.length];
    },
  };
})();

/** Operaatiot: what needs doing right now, the cat, the tractor beam. */
const ops: StationView = (() => {
  let shown = '';
  let shownWarnings = '';
  const helm = stationIndex('ohjaus');
  const tactical = stationIndex('taktiikka');
  /** Warnings only Operaatiot sees, with buttons to forward them. */
  const showWarnings = (s: ShipState) => {
    const list = faultAt(s, 'operaatiot') ? [] : s.warnings ?? [];
    const key = list.map((w) => `${w.id}:${(w.sent ?? []).join('.')}`).join(',');
    if (key !== shownWarnings) {
      shownWarnings = key;
      $('varoitukset')!.innerHTML = list.map((w) => {
        const button = (st: number, label: string) => (w.sent?.includes(st)
          ? `<button class="sent" disabled>✓ ${label}</button>`
          : `<button class="c${st % 10}" data-send="varoita" data-value="${w.id * 100 + st}">📢 ${label}</button>`);
        return `<div class="warning"><div>${warningText(w)} <b data-varo="${w.id}"></b></div>
          <div class="row">${button(tactical, '🛡️ Taktiikka')}${button(helm, '🕹️ Ohjaus')}</div></div>`;
      }).join('');
    }
    for (const w of list) {
      const t = document.querySelector(`[data-varo="${w.id}"]`);
      if (t) t.innerHTML = `${Math.max(0, w.time)} s · ${arrowFor(s, w.dir)} ${sideText(angleDiff(w.dir, s.heading))}`;
    }
  };
  /** Jobs for the other stations, worked out from the ship's state. */
  const tasks = (s: ShipState) => {
    const list: [string, string][] = [];
    const radar = s.radar ?? [];
    const faults = s.faults?.length ?? 0;
    if (faults) list.push(['konehuone', `Korjaa ${faults} ${faults === 1 ? 'vika' : 'vikaa'}!`]);
    if (radar.some((t) => t.k === 'mohko')) list.push(['taktiikka', `${config.danger.pirate.name}! Laserit!`]);
    else if (radar.some((t) => t.k === 'piirakka')) list.push(['taktiikka', 'Piirakoita tulossa! Kilvet!']);
    if (radar.filter((t) => t.k === 'kivi').length >= 2) list.push(['ohjaus', 'Väistele kiviä!']);
    if (s.fog) list.push(['tiede', 'Sumua! Skannaa!']);
    if (s.call) list.push(['viestinta', `${config.aliens.name} soittaa!`]);
    if (s.morale < 50) list.push(['neuvonantaja', 'Miehistö on väsynyt!']);
    if (s.choice >= 0) list.push(['kapteeni', 'Valitse reitti!']);
    return list;
  };
  return {
    html: () => {
      shown = '';
      shownWarnings = '';
      return `<div id="varoitukset"></div>
      <div class="hint">Napauta tehtävää: asema saa hälytyksen 📢</div>
      <div class="tasks" id="tehtavat"></div>
      <div id="kissa"></div>
      <button class="big c6" id="veto" data-send="veto">🧲 Vetosäde</button>`;
    },
    live: (s) => {
      showWarnings(s);
      const list = faultAt(s, 'operaatiot') ? [] : tasks(s);
      const key = list.map(([id, text]) => id + text).join('|') + `/${s.cat}`;
      if (key !== shown) {
        shown = key;
        $('tehtavat')!.innerHTML = list.length
          ? list.map(([id, text]) => {
            const st = config.stations[stationIndex(id)];
            return `<button class="task" data-send="tehtava" data-value="${stationIndex(id)}">${st.emoji} ${st.name}: ${text}</button>`;
          }).join('')
          : '<div class="info">Kaikki rauhallista… liian rauhallista 🤨</div>';
        $('kissa')!.innerHTML = s.cat >= 0
          ? `<button class="big catbtn" data-send="kissa">🐟 Houkuttele kissa pois<small>${config.cat.emoji} istuu: ${config.stations[s.cat].name}</small></button>`
          : '';
      }
      const range = config.ops.tractorRange * (boosted(s, 'operaatiot') ? 2 : 1);
      const near = config.secrets.some((sec, i) => sec.kind === 'kristalli' && s.secrets[i] === 1
        && towards(s, sec.x, sec.y).distance < range);
      const beam = $('veto') as HTMLButtonElement;
      const asking = waitingFor(s, 'veto');
      beam.disabled = s.tractorCharge > 0 || !near || asking;
      beam.textContent = s.tractorCharge > 0 ? `Vetosäde latautuu… ${s.tractorCharge}`
        : asking ? '⏳ Odotetaan kapteenin lupaa…'
          : near ? '🧲 Vetosäde: nappaa kristalli! (kysy kapteenilta)' : '🧲 Vetosäde (ei kristallia lähellä)';
    },
  };
})();

/** Neuvonantaja: tap the heart in time to keep the crew happy. */
const counselor: StationView & { beat: () => void; reset: () => void } = (() => {
  let started = 0;
  /** Good taps since the last 💖 was sent (the main screen counts them too). */
  let good = 0;
  const showHearts = () => {
    const meter = $('sydamet');
    if (!meter) return;
    const need = config.boosts.cheer.beats;
    meter.textContent = `💖 ${'♥'.repeat(Math.min(good, need))}${'♡'.repeat(Math.max(0, need - good))}`;
    const crew = $('kannusta')!;
    if (good >= need && !crew.innerHTML) crew.innerHTML = `<div class="hint">💖 Täynnä! Ketä kannustat?</div>${crewButtons('kannusta', ['neuvonantaja'], '💖')}`;
  };
  return {
    html: () => {
      started = performance.now();
      setTimeout(showHearts);
      return `<div class="mood"><span id="naama"></span><div class="bar"><i id="mieli"></i></div></div>
      <div class="moodcall" id="olio"></div>
      <div class="hint" id="laulu"></div>
      <button class="heart" data-beat="1" style="animation-duration: ${config.morale.beat}s">💖</button>
      <div class="hint" id="palaute">Napauta sydäntä kun se on isoimmillaan!</div>
      <div class="hint" id="sydamet"></div>
      <div class="crew" id="kannusta"></div>`;
    },
    reset: () => { good = 0; const c = $('kannusta'); if (c) c.innerHTML = ''; showHearts(); },
    live: (s) => {
      $('naama')!.textContent = moodFace(s.morale);
      $('mieli')!.style.width = `${s.morale}%`;
      $('laulu')!.textContent = s.singing ? '🐋 Avaruusvalas laulaa… pidä miehistö hereillä!' : `Mieliala ${s.morale} %`;
      // Only this phone sees how the aliens feel: tell Viestintä!
      const mood = s.call ? config.aliens.moods[s.call.mood] : null;
      const text = mood ? `📞 ${config.aliens.name} soittavat! He ovat <b>${mood.face} ${mood.name}</b> – kerro Viestinnälle!` : '';
      const box = $('olio')!;
      if (box.innerHTML !== text) box.innerHTML = text;
    },
    /** Big heart = the start of each beat. A tap close to it counts. */
    beat: () => {
      const phase = ((performance.now() - started) / 1000 / config.morale.beat) % 1;
      const inTime = phase < 0.28 || phase > 0.82;
      const feedback = $('palaute');
      const broken = !!(now.ship && faultAt(now.ship, 'neuvonantaja'));
      if (inTime && !broken) {
        send('rauhoita');
        good += now.ship && boosted(now.ship, 'neuvonantaja') ? 2 : 1;
        showHearts();
      }
      sfx(inTime ? 'coin' : 'bounce', { pitch: inTime ? 1.5 : 0.7 });
      if (feedback) feedback.textContent = broken ? '💔 Sydän sekaisin – pyydä Konehuonetta!' : inTime ? 'Hyvä! Tahdissa! 💖' : 'Hups! Odota isoa sydäntä';
    },
  };
})();

const views: Record<string, StationView> = {
  ohjaus: helm, kapteeni: captain, taktiikka: tactical, konehuone: engineering, tiede: science,
  viestinta: comms, operaatiot: ops, neuvonantaja: counselor,
};

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
  document.body.classList.toggle('alert', now.phase === 'matka' && (now.ship?.alert ?? 0) > 0);
  if (!now.me || !now.ship || now.phase !== 'matka') { catOverlay(false); document.body.classList.remove('boost'); return; }
  (views[now.me.station] ?? waiting).live?.(now.ship);
  const mine = stationIndex(now.me.station);
  catOverlay(now.ship.cat === mine);
  pinged(now.ship, mine);
  faultBanner(now.ship, mine);
}

/** Red banner when this console is broken; golden glow when it is boosted. */
function faultBanner(s: ShipState, mine: number) {
  let el = document.getElementById('vika');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vika';
    app.prepend(el);
  }
  const fault = s.faults?.find((f) => f.station === mine);
  const boost = s.boosts?.[mine] ?? 0;
  const parts: string[] = [];
  if (fault) parts.push(`<div class="broken">💥 ${faultText(mine)}<small>Pyydä Konehuonetta korjaamaan!</small></div>`);
  if (boost > 0) {
    const by = s.boostBy?.[mine] === 2 ? '💖 Neuvonantaja kannusti' : '⚡ Konehuone antoi virtaa';
    parts.push(`<div class="boosted">${by}: ${config.boosts.texts[now.me!.station] ?? 'Tehostus!'} <b>${boost} s</b></div>`);
  }
  const html = parts.join('');
  if (el.innerHTML !== html) el.innerHTML = html;
  document.body.classList.toggle('boost', boost > 0);
  app.classList.toggle('spin', !!fault && now.me?.station === 'kapteeni');
}

/** The space cat sits on this phone's buttons. */
function catOverlay(on: boolean) {
  let el = document.getElementById('catcover');
  if (on && !el) {
    el = document.createElement('div');
    el.id = 'catcover';
    el.innerHTML = `<span>${config.cat.emoji}</span>Kissa istuu napeilla!<small>Pyydä Operaatioita houkuttelemaan se pois 🐟</small>`;
    document.body.appendChild(el);
    sfx('click', { pitch: 3 });
  }
  if (!on && el) el.remove();
}

let lastPing: number | null = null;
/** Operaatiot buzzed this station: flash and vibrate. */
function pinged(s: ShipState, mine: number) {
  const n = s.ping?.s === mine ? s.ping.n : -1;
  if (lastPing !== null && n !== -1 && n !== lastPing) {
    document.body.classList.remove('ping');
    void document.body.offsetWidth; // restart the flash animation
    document.body.classList.add('ping');
    navigator.vibrate?.(300);
    sfx('powerup', { pitch: 2 });
  }
  if (n !== -1 || lastPing === null) lastPing = n;
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
          <span class="pill c${i % 10}">${s.emoji}</span>
          <span><b>${s.name}</b><small>${s.job}</small></span>
          <span class="dots">${crew[s.id].map((p) => `<i style="background:${p.colour}"></i>`).join('')}</span>
        </button>`;
      }).join('')}
    </div>`);
}

/** Ohjekortti: what this station does and who it works with (config.stations[].howTo). */
function howToCard(s: StationDef) {
  const lines = s.howTo?.length ? s.howTo : [s.job];
  return `<div class="howto"><b>Näin pelaat: ${s.emoji} ${s.name}</b>${lines.map((l) => `<div>${l}</div>`).join('')}</div>`;
}

function showStation(s: StationDef) {
  const help = now.phase === 'matka' ? '<button class="helpbtn" data-go="ohje">❓</button>' : '';
  const header = `<header>
      <span class="pill c0">${s.emoji}</span><span><b>${s.name}</b><small>${s.job}</small></span>
      ${help}<i style="background:${now.me!.colour}"></i>
    </header>`;
  if (now.phase === 'aula') {
    const startButton = s.id === 'kapteeni' ? `<button class="big c0" data-send="aloita">🚀 Tehkää niin!</button>` : '';
    show(`${header}${howToCard(s)}<div class="hint">Odotetaan lähtöä… ⏳</div>${startButton}
      <button class="small" data-go="vaihda">↩️ Vaihda asemaa</button>`);
  } else if (now.phase === 'perilla') {
    const again = s.id === 'kapteeni' ? `<button class="big c1" data-send="uusi">🔄 Uusi matka</button>` : '';
    const ship = now.ship;
    const mine = ship ? deedsOf(ship, s.id) : '';
    const team = ship ? `<div class="hint">🤝 Koko miehistön yhteistyö: ${teamwork(ship)}</div>` : '';
    show(`${header}<div class="info">🎉 Perillä! 🎉<small>Hyvää työtä, miehistö!</small></div>
      ${mine ? `<div class="howto"><b>Sinun asemasi teki:</b><div>${mine}</div></div>` : ''}${team}${again}`);
  } else {
    show(`${header}${(views[s.id] ?? waiting).html()}`);
  }
}

/** The ❓ button: shows the how-to card on top of the station until "Selvä!". */
function helpOverlay(on: boolean) {
  document.getElementById('ohje')?.remove();
  const s = config.stations.find((x) => x.id === now.me?.station);
  if (!on || !s) return;
  const el = document.createElement('div');
  el.id = 'ohje';
  el.innerHTML = `${howToCard(s)}<button class="big c0" data-go="ohje-pois">👍 Selvä!</button>`;
  app.appendChild(el);
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
  keepAwake();
  app.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || b.dataset.hold || b.dataset.zap || b.dataset.fix || b.dataset.beat) return;
    sfx('click', { pitch: 1 + Math.random() }); // every console beeps a bit differently
    if (b.dataset.pick) pick(b.dataset.pick);
    if (b.dataset.send) send(b.dataset.send, b.dataset.value === undefined ? undefined : Number(b.dataset.value));
    if (b.dataset.send === 'virta') engineering.reset();
    if (b.dataset.send === 'kannusta') counselor.reset();
    if (b.dataset.throttle) helm.setThrottle(Number(b.dataset.throttle));
    if (b.dataset.reactor) (engineering as unknown as { nudge: (w: number) => void }).nudge(Number(b.dataset.reactor));
    if (b.dataset.go === 'vaihda') standUp();
    if (b.dataset.go === 'ohje') helpOverlay(true);
    if (b.dataset.go === 'ohje-pois') helpOverlay(false);
    if (b.dataset.go === 'liity') location.search = '?liity';
  });
  // Buttons that work while held down (steering)
  const holdButton = (e: PointerEvent) => (e.target as HTMLElement).closest<HTMLElement>('[data-hold]');
  // Radar targets and faults move and change all the time: react on touch, not on click
  app.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-zap], [data-fix], [data-beat]');
    if (!b) return;
    if (b.dataset.beat) counselor.beat();
    if (b.dataset.zap) { send('ammu', Number(b.dataset.zap)); sfx('shoot'); }
    if (b.dataset.fix) { send('korjaa', Number(b.dataset.fix)); sfx('hit', { pitch: 2 }); b.classList.add('on'); }
  });
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

/** Keeps the phone's screen on while playing (Screen Wake Lock, where the browser has it). */
function keepAwake() {
  let lock: WakeLockSentinel | null = null;
  const ask = async () => {
    if (lock || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } catch {
      // not allowed or not supported: the game works anyway, the screen may just go dark
    }
  };
  ask();
  document.addEventListener('visibilitychange', ask);
  addEventListener('pointerdown', ask); // some phones only allow it after a tap
}

/** Console colours: classes c0 … c9, repeating config.lcars if the kids put in fewer. */
const colourCss = Array.from({ length: 10 }, (_, i) => `.c${i} { background: ${config.lcars[i % config.lcars.length]}; }`).join('\n');

const CSS = `
  body { margin: 0; background: #000; color: #fff;
    font-family: "Arial Narrow", "Roboto Condensed", "Helvetica Neue", system-ui, sans-serif; font-stretch: condensed;
    -webkit-user-select: none; user-select: none; touch-action: manipulation; -webkit-touch-callout: none; }
  .phone { overflow-x: hidden; max-width: 520px; margin: 0 auto; padding: 14px; box-sizing: border-box; min-height: 100vh;
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
  .bar .title { white-space: nowrap; font-size: 26px; font-weight: bold; text-transform: uppercase; color: ${lcars[0]}; }
  .bar .cap2 { flex: 1; height: 44px; border-radius: 0 22px 22px 0; color: #000; font-weight: bold;
    text-transform: uppercase; display: flex; align-items: center; justify-content: flex-end; padding-right: 16px; font-size: 14px; overflow: hidden; white-space: nowrap; }
  .stations { display: flex; flex-direction: column; gap: 8px; }
  .station, header { display: flex; align-items: center; gap: 12px; padding: 0 14px 0 0; text-align: left;
    background: #111; color: #fff; font-size: 20px; border-radius: 32px 12px 12px 32px; text-transform: none; }
  header { border-bottom: 6px solid ${lcars[0]}; }
  .station > span:nth-child(2), header > span:nth-child(2) { flex: 1; padding: 8px 0; }
  .pill { font-size: 34px; width: 70px; height: 64px; display: grid; place-items: center; border-radius: 32px 0 0 32px; }
  .dots i, header i { display: inline-block; width: 18px; height: 18px; border-radius: 50%; margin-left: 4px; }
  header i { width: 28px; height: 28px; }
  .helpbtn { background: #222; color: #fff; font-size: 22px; padding: 6px 12px; }
  .howto { background: #111; border: 3px solid ${lcars[0]}; border-radius: 18px; padding: 12px 14px; display: flex;
    flex-direction: column; gap: 10px; font-size: 19px; line-height: 1.25; }
  .howto b { color: ${lcars[0]}; font-size: 21px; }
  #ohje { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 20; padding: 14px; display: flex;
    flex-direction: column; gap: 14px; justify-content: center; max-width: 520px; margin: 0 auto; }
  .info { text-align: center; font-size: 26px; padding: 22px 0; text-transform: uppercase; color: ${lcars[4]}; }
  .big { font-size: 28px; padding: 18px; }
  .small { background: #222; color: #fff; font-size: 18px; padding: 12px; margin-top: auto; }
  .row { display: flex; gap: 10px; }
  .row > button { flex: 1; }
  .hold { font-size: 26px; padding: 28px 0; border-radius: 24px; }
  .throttle button { font-size: 18px; padding: 16px 0; opacity: 0.55; }
  .throttle button.on { opacity: 1; outline: 4px solid #fff; }
  .readout { display: flex; gap: 14px; align-items: center; background: #111; border-radius: 16px; padding: 12px; }
  .readout b, .readout span { display: block; }
  .readout > div:last-child { min-width: 0; overflow-wrap: anywhere; }
  .readout #kohde { color: ${lcars[0]}; font-size: 19px; }
  .readout #matka { font-size: 30px; font-weight: bold; }
  .readout #nopeus { color: ${lcars[2]}; }
  .compass { width: 84px; height: 84px; border-radius: 50%; border: 4px solid ${lcars[1]}; display: grid; place-items: center; font-size: 44px; color: ${lcars[0]}; flex: none; }
  #nuoli { transition: transform 0.2s; display: inline-block !important; }
  .route div { padding: 10px 16px; margin: 6px 0; border-radius: 999px; background: #111; font-size: 20px; text-transform: uppercase; }
  .route .done { background: #1f4d1a; text-decoration: line-through; opacity: 0.7; }
  .route .next { background: ${lcars[0]}; color: #000; font-weight: bold; }
  .silly { text-align: center; font-size: 22px; padding: 24px 8px; color: ${lcars[1]}; min-height: 60px; }
  .radar { position: relative; width: 100%; aspect-ratio: 1; border-radius: 50%; border: 3px solid ${lcars[2]};
    background: radial-gradient(circle, #102040 0%, #000 70%); overflow: hidden; }
  .radar .reach { position: absolute; inset: 14.3%; border-radius: 50%; border: 2px dashed ${lcars[0]}; opacity: 0.6; }
  .radar .me { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 30px; }
  .radar .dot { position: absolute; transform: translate(-50%, -50%); background: none; font-size: 40px; padding: 8px;
    transition: left 0.2s linear, top 0.2s linear; }
  .radar .dot.mohko { font-size: 54px; }
  .radar .dot.far { opacity: 0.4; }
  .hint { text-align: center; font-size: 18px; color: ${lcars[4]}; text-transform: uppercase; }
  .reactor { position: relative; height: 44px; border-radius: 22px; background: #401010; overflow: hidden; }
  .reactor .zone { position: absolute; left: 30%; width: 40%; top: 0; bottom: 0; background: #1f6d2a; }
  .reactor.ok .zone { background: #3dcc55; }
  .reactor .needle { position: absolute; top: 0; bottom: 0; width: 8px; margin-left: -4px; background: #fff; border-radius: 4px; }
  .charge { height: 18px; border-radius: 9px; background: #222; overflow: hidden; }
  .charge i { display: block; height: 100%; width: 0%; background: #ffee55; }
  .crew { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .crew .hint { grid-column: 1 / -1; }
  .pick { font-size: 15px; padding: 10px 6px; border-radius: 14px; }
  .warning { background: #3a2a00; border: 3px solid #ffcc00; border-radius: 16px; padding: 8px 12px; font-size: 18px;
    text-transform: uppercase; display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px; }
  .warning .arrow { color: #ffcc00; }
  .warning button { font-size: 15px; padding: 10px 4px; }
  .warning .sent { background: #333; color: #aaa; }
  .moodcall { text-align: center; font-size: 20px; text-transform: uppercase; color: #fff; }
  .moodcall:not(:empty) { background: #1f3d1a; border: 3px solid #7cff6b; border-radius: 16px; padding: 10px; animation: wobble 0.4s infinite alternate; }
  .moodcall b { color: #7cff6b; font-size: 26px; }
  .request { background: #111; border: 3px solid ${lcars[1]}; border-radius: 18px; padding: 10px; display: flex; flex-direction: column; gap: 8px;
    font-size: 18px; text-transform: uppercase; animation: wobble 0.5s infinite alternate; }
  #vika .broken { background: #ff3333; color: #fff; border-radius: 16px; padding: 10px 14px; font-weight: bold; text-transform: uppercase; }
  #vika .broken small { color: #fff; opacity: 0.9; }
  #vika .boosted { background: #ffee55; color: #000; border-radius: 16px; padding: 10px 14px; font-weight: bold; margin-top: 6px; }
  body.boost .phone { box-shadow: inset 0 0 40px 10px #ffee55; }
  .phone.spin { animation: spin 3s infinite ease-in-out alternate; }
  @keyframes spin { from { transform: rotate(-8deg); } to { transform: rotate(8deg); } }
  .radar.blurry .dot { filter: blur(6px); }
  .radar .dot.weak::after { content: '🎯'; position: absolute; right: -6px; top: -6px; font-size: 22px; }
  .faults { display: flex; flex-direction: column; gap: 8px; }
  .fault { background: #ff5c5c; text-align: left; border-radius: 16px; animation: wobble 0.4s infinite alternate; }
  @keyframes wobble { from { transform: rotate(-1.5deg); } to { transform: rotate(1.5deg); } }
  .status { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: #111; border-radius: 16px; padding: 10px 14px;
    font-size: 18px; text-transform: uppercase; }
  .alertbtn { background: #ff3333; font-size: 24px; }
  .choice { font-size: 17px; padding: 14px 6px; border-radius: 20px; min-width: 0; overflow-wrap: anywhere; }
  .choice small { opacity: 0.8; color: #000; }
  .scan { position: relative; overflow: hidden; font-size: 22px; }
  .scan .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: #fff; opacity: 0.6; }
  .scan .label { position: relative; }
  .found div { padding: 10px 16px; margin: 6px 0; border-radius: 999px; background: #111; font-size: 20px; text-transform: uppercase; }
  .found .arrow { display: inline-block; color: ${lcars[0]}; }
  #sumu { color: #fff1b8; }
  body.alert { animation: redalert 0.5s infinite alternate; }
  @keyframes redalert { from { box-shadow: inset 0 0 0 0 #f00; } to { box-shadow: inset 0 0 60px 20px #f00; } }
  .call { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 10px; }
  .call .alien { font-size: 64px; animation: wobble 0.3s infinite alternate; }
  .call .says { font-size: 48px; background: #fff; border-radius: 30px; padding: 8px 20px; white-space: nowrap; }
  .answers { display: flex; flex-direction: column; gap: 10px; }
  .answers button { font-size: 44px; padding: 12px; }
  .tasks { display: flex; flex-direction: column; gap: 8px; }
  .task { background: ${lcars[3]}; text-align: left; font-size: 18px; border-radius: 16px; }
  .catbtn { background: #ffcc99; font-size: 24px; }
  .mood { display: flex; align-items: center; gap: 12px; }
  .mood #naama { font-size: 52px; }
  .mood .bar { flex: 1; height: 28px; border-radius: 14px; background: #222; overflow: hidden; }
  .mood .bar i { display: block; height: 100%; background: ${lcars[1]}; transition: width 0.3s; }
  .heart { background: none; font-size: 110px; padding: 0; animation: beat infinite ease-out; }
  .heart:active { transform: none; }
  @keyframes beat { 0% { transform: scale(1.3); } 30% { transform: scale(0.9); } 100% { transform: scale(0.9); } }
  #catcover { position: fixed; inset: 18% 6% auto 6%; background: #ffcc99; color: #000; border-radius: 30px; padding: 20px;
    text-align: center; font-size: 26px; font-weight: bold; text-transform: uppercase; z-index: 10; box-shadow: 0 0 0 100vmax rgba(0,0,0,0.6); }
  #catcover span { display: block; font-size: 120px; animation: wobble 0.3s infinite alternate; }
  #catcover small { color: #333; }
  body.ping { animation: ping 0.3s 5 alternate; }
  @keyframes ping { from { background: #000; } to { background: ${lcars[3]}; } }
  .code { text-align: center; font-size: 56px; letter-spacing: 16px; color: ${lcars[0]}; }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .pad button { background: ${lcars[1]}; font-size: 34px; padding: 18px 0; }
`;
