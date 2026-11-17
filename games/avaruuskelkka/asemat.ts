// 📱 ASEMAT – what the phones show. Every phone is one station of the ship.
// Phones never decide what happens: they send commands to the main screen
// (simulaatio.ts) and show what it tells them. Plain HTML buttons, no Phaser.

import { online } from '@kit/firebase';
import { storage } from '@kit/storage';
import { config, type StationDef } from './config';
import { paths, crewByStation, type Phase, type PlayerInfo } from './simulaatio';

const app = document.createElement('div');

/** Everything the phone knows right now. */
const now = {
  code: '',
  uid: '',
  phase: 'aula' as Phase,
  players: {} as Record<string, PlayerInfo>,
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
  // Every time the connection comes back (phone woke up), sit down at my station again.
  online.watch<boolean>('.info/connected', (connected) => { if (connected && now.me) sitDown(now.me); });
}

/** Number buttons for typing the room code shown on the main screen. */
export function startJoinPad() {
  setUpPage();
  let typed = '';
  const draw = (message = '') => show(`
    <h1>Liity laivaan</h1>
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

// ---------------------------------------------------------------------------
// Drawing the phone screen
// ---------------------------------------------------------------------------

function render() {
  if (!now.me) return showPicker();
  const s = config.stations.find((x) => x.id === now.me!.station);
  if (!s) return standUp();
  showStation(s);
}

function showPicker() {
  const crew = crewByStation(now.players);
  show(`<h1>Valitse asema</h1>
    <div class="stations">
      ${config.stations.map((s) => {
        const full = crew[s.id].length >= config.playersPerStation;
        return `<button class="station" data-pick="${s.id}" ${full ? 'disabled' : ''}>
          <span class="emoji">${s.emoji}</span>
          <span><b>${s.name}</b><small>${s.job}</small></span>
          <span class="dots">${crew[s.id].map((p) => `<i style="background:${p.colour}"></i>`).join('')}</span>
        </button>`;
      }).join('')}
    </div>`);
}

function showStation(s: StationDef) {
  const header = `<header style="border-color:${now.me!.colour}">
      <span class="emoji">${s.emoji}</span><span><b>${s.name}</b><small>${s.job}</small></span>
      <i style="background:${now.me!.colour}"></i>
    </header>`;
  if (now.phase === 'aula') {
    const startButton = s.id === 'kapteeni' ? `<button class="big" data-send="aloita">🚀 Aloita matka</button>` : '';
    show(`${header}<div class="info">Odotetaan lähtöä… ⏳</div>${startButton}
      <button class="small" data-go="vaihda">↩️ Vaihda asemaa</button>`);
  } else {
    show(`${header}<div class="info">Matka käynnissä! 🚀<br><small>Aseman ohjaimet tulevat pian.</small></div>`);
  }
}

// ---------------------------------------------------------------------------
// Page set-up and the one click handler for every button
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
    if (!b) return;
    if (b.dataset.pick) pick(b.dataset.pick);
    if (b.dataset.send) send(b.dataset.send);
    if (b.dataset.go === 'vaihda') standUp();
    if (b.dataset.go === 'liity') location.search = '?liity';
  });
}

const CSS = `
  body { margin: 0; background: #0b1030; color: #fff; font-family: "Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif;
    -webkit-user-select: none; user-select: none; touch-action: manipulation; }
  .phone { max-width: 520px; margin: 0 auto; padding: 16px; box-sizing: border-box; min-height: 100vh;
    display: flex; flex-direction: column; gap: 14px; }
  h1 { margin: 4px 0; text-align: center; font-size: 28px; }
  small { display: block; font-size: 14px; opacity: 0.75; font-weight: normal; }
  button { font: inherit; color: inherit; border: none; border-radius: 16px; cursor: pointer; }
  button:active { transform: scale(0.97); }
  .stations { display: flex; flex-direction: column; gap: 10px; }
  .station, header { display: flex; align-items: center; gap: 12px; padding: 12px 14px; text-align: left;
    background: rgba(255,255,255,0.1); font-size: 20px; border-radius: 16px; }
  .station:disabled { opacity: 0.35; }
  .station > span:nth-child(2), header > span:nth-child(2) { flex: 1; }
  .emoji { font-size: 40px; }
  .dots i, header i { display: inline-block; width: 18px; height: 18px; border-radius: 50%; margin-left: 4px; }
  header { border: 4px solid; }
  header i { width: 28px; height: 28px; }
  .info { text-align: center; font-size: 24px; padding: 24px 0; }
  .big { background: #ffcc00; color: #111; font-size: 30px; padding: 22px; }
  .small { background: rgba(255,255,255,0.12); font-size: 18px; padding: 12px; margin-top: auto; }
  .code { text-align: center; font-size: 56px; letter-spacing: 16px; }
  .pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .pad button { background: rgba(255,255,255,0.14); font-size: 34px; padding: 18px 0; }
`;
