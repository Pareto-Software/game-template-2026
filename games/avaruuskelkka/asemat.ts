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
  type Phase, type PlayerInfo, type ShipState, type HelmInput, type Energy, type ThreatKind,
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
      const t = place(s, s.target);
      const dir = towards(s, t.x, t.y);
      // The arrow shows where the target is compared to where the ship points (up = straight ahead)
      $('nuoli')!.style.transform = s.fog ? 'none' : `rotate(${angleDiff(dir.angle, s.heading)}deg)`;
      $('nuoli')!.textContent = s.fog ? '?' : '▲';
      $('kohde')!.textContent = s.fog ? '🌫️ Sumua! Kysy Tieteeltä suunta' : `${t.emoji} ${t.name}`;
      $('matka')!.textContent = s.fog ? '??? km' : `${Math.round(dir.distance)} km`;
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

/** Kapteeni during the trip: everyone's status, red alert, route choices and the route. */
const captain: StationView = (() => {
  let shownChoice = -2;
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
      return `
      <div class="status" id="tila"></div>
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
      }
      radar.querySelectorAll<HTMLElement>('[data-zap]').forEach((d) => { if (!seen.has(d.dataset.zap!)) d.remove(); });
      $('laser')!.textContent = s.reload > 0 ? 'Laser latautuu… 🔋' : 'Kosketa kohdetta = PIU PIU! 🔴';
      const shield = $('kilvet') as HTMLButtonElement;
      shield.disabled = s.shield > 0 || s.shieldCharge > 0;
      shield.textContent = s.shield > 0 ? `🛡️ Kilvet ylhäällä ${s.shield}` : s.shieldCharge > 0 ? `Kilvet latautuu… ${s.shieldCharge}` : '🛡️ Kilvet ylös!';
    },
  };
})();

/** Konehuone: share the energy, tap faults to fix them. */
const engineering: StationView = (() => {
  const systems: [keyof Energy, string][] = [['moottori', '🔥 Moottori'], ['kilvet', '🛡️ Kilvet'], ['aseet', '🔴 Aseet']];
  let shownFaults = '';
  return {
    html: () => {
      shownFaults = '';
      return `
      <div class="hint" id="runko"></div>
      ${systems.map(([id, name], i) => `<div class="energy">
        <span class="name">${name}</span>
        <button class="c5" data-energy="${id}_miinus">−</button>
        <span class="pips" id="pips-${id}">${'<i></i>'.repeat(config.energy.max)}</span>
        <button class="c${i + 1}" data-energy="${id}_plus">+</button>
      </div>`).join('')}
      <div class="hint" id="vapaa"></div>
      <div class="faults" id="viat"></div>`;
    },
    live: (s) => {
      const used = s.energy.moottori + s.energy.kilvet + s.energy.aseet;
      for (const [id] of systems) {
        $(`pips-${id}`)!.querySelectorAll('i').forEach((pip, i) => pip.classList.toggle('full', i < s.energy[id]));
      }
      const free = config.energy.total - used;
      $('vapaa')!.textContent = free > 0 ? `Vapaata energiaa: ${'⚡'.repeat(free)}` : 'Ei vapaata energiaa – ota ensin toisesta (−)';
      $('runko')!.textContent = `Runko ${hull(s)} %`;
      // Redraw the fault buttons only when they change, so taps aren't lost
      const faults = s.faults ?? [];
      const key = faults.map((f) => `${f.id}:${f.left}`).join(',');
      if (key === shownFaults) return;
      shownFaults = key;
      $('viat')!.innerHTML = faults.length
        ? faults.map((f) => `<button class="fault" data-fix="${f.id}">💥 ${config.faults.names[f.name]}<small>Napauta ${f.left}×</small></button>`).join('')
        : '<div class="hint">Ei vikoja ✅ Kaikki kunnossa (melkein)</div>';
    },
  };
})();

/** Viestintä: the aliens talk in emoji – pick the friendly answer. */
const comms: StationView = (() => {
  let shown = '';
  return {
    html: () => { shown = ''; return `<div id="puhelu"></div><div class="silly" id="hassu"></div>`; },
    live: (s) => {
      const call = s.call ?? null;
      const key = call ? `${call.msg}/${call.order.join('')}` : 'none';
      if (key !== shown) {
        shown = key;
        const a = config.aliens;
        $('puhelu')!.innerHTML = call
          ? `<div class="call"><span class="alien">${a.emoji}</span><span class="says">${a.messages[call.msg].ask}</span></div>
             <div class="hint">${a.name} soittaa! Mikä on ystävällinen vastaus? <span id="aika"></span></div>
             <div class="answers">${callAnswers(call).map((ans, i) => `<button class="c${i + 1}" data-send="vastaa" data-value="${i}">${ans}</button>`).join('')}</div>`
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
      return `<div class="hint">Napauta tehtävää: asema saa hälytyksen 📢</div>
      <div class="tasks" id="tehtavat"></div>
      <div id="kissa"></div>
      <button class="big c6" id="veto" data-send="veto">🧲 Vetosäde</button>`;
    },
    live: (s) => {
      const list = tasks(s);
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
      const near = config.secrets.some((sec, i) => sec.kind === 'kristalli' && s.secrets[i] === 1
        && towards(s, sec.x, sec.y).distance < config.ops.tractorRange);
      const beam = $('veto') as HTMLButtonElement;
      beam.disabled = s.tractorCharge > 0 || !near;
      beam.textContent = s.tractorCharge > 0 ? `Vetosäde latautuu… ${s.tractorCharge}`
        : near ? '🧲 Vetosäde: nappaa kristalli!' : '🧲 Vetosäde (ei kristallia lähellä)';
    },
  };
})();

/** Neuvonantaja: tap the heart in time to keep the crew happy. */
const counselor: StationView & { beat: () => void } = (() => {
  let started = 0;
  return {
    html: () => {
      started = performance.now();
      return `<div class="mood"><span id="naama"></span><div class="bar"><i id="mieli"></i></div></div>
      <div class="hint" id="laulu"></div>
      <button class="heart" data-beat="1" style="animation-duration: ${config.morale.beat}s">💖</button>
      <div class="hint" id="palaute">Napauta sydäntä kun se on isoimmillaan!</div>`;
    },
    live: (s) => {
      $('naama')!.textContent = moodFace(s.morale);
      $('mieli')!.style.width = `${s.morale}%`;
      $('laulu')!.textContent = s.singing ? '🐋 Avaruusvalas laulaa… pidä miehistö hereillä!' : `Mieliala ${s.morale} %`;
    },
    /** Big heart = the start of each beat. A tap close to it counts. */
    beat: () => {
      const phase = ((performance.now() - started) / 1000 / config.morale.beat) % 1;
      const good = phase < 0.22 || phase > 0.88;
      const feedback = $('palaute');
      if (good) send('rauhoita');
      sfx(good ? 'coin' : 'bounce', { pitch: good ? 1.5 : 0.7 });
      if (feedback) feedback.textContent = good ? 'Hyvä! Tahdissa! 💖' : 'Hups! Odota isoa sydäntä';
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
  if (!now.me || !now.ship || now.phase !== 'matka') { catOverlay(false); return; }
  (views[now.me.station] ?? waiting).live?.(now.ship);
  const mine = stationIndex(now.me.station);
  catOverlay(now.ship.cat === mine);
  pinged(now.ship, mine);
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
  keepAwake();
  app.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || b.dataset.hold || b.dataset.zap || b.dataset.fix || b.dataset.beat) return;
    sfx('click', { pitch: 1 + Math.random() }); // every console beeps a bit differently
    if (b.dataset.pick) pick(b.dataset.pick);
    if (b.dataset.send) send(b.dataset.send, b.dataset.value === undefined ? undefined : Number(b.dataset.value));
    if (b.dataset.throttle) helm.setThrottle(Number(b.dataset.throttle));
    if (b.dataset.energy) send('energia', b.dataset.energy);
    if (b.dataset.go === 'vaihda') standUp();
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
  .energy { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
  .energy .name { width: 100%; font-size: 18px; text-transform: uppercase; }
  .energy button { width: 52px; height: 52px; padding: 0; font-size: 28px; }
  .pips { flex: 1; display: flex; gap: 4px; }
  .pips i { flex: 1; height: 26px; border-radius: 6px; background: #222; }
  .pips i.full { background: ${lcars[0]}; }
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
