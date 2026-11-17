// 🚀 AVARUUSKELKKA – a bridge-crew game: phones are the ship's stations,
// the computer is the main screen. Numbers, emoji and stations live in config.ts.
// See README.md for which file does what.
//
// The address decides what this page is:
//   …/avaruuskelkka/              → main screen (paanaytto.ts)
//   …/avaruuskelkka/?huone=1234   → a phone in room 1234 (asemat.ts)
//   …/avaruuskelkka/?liity        → a phone typing the room code
//   …/avaruuskelkka/?testi        → main screen + simulated phones on one computer

import { config } from './config';

const params = new URLSearchParams(location.search);
const room = params.get('huone');

// Loaded only when needed, so phones never download Phaser.
if (params.has('testi')) startTestView();
else if (room && /^[0-9]{4}$/.test(room)) import('./asemat').then((m) => m.startPhone(room));
else if (params.has('liity')) import('./asemat').then((m) => m.startJoinPad());
else import('./paanaytto').then((m) => m.startMainScreen());

/** The main screen and a few phones side by side, each one its own player. */
function startTestView() {
  const page = location.pathname;
  document.body.innerHTML = `
    <style>
      body { margin: 0; background: #222; display: flex; gap: 12px; padding: 12px; height: 100vh; box-sizing: border-box;
        font-family: system-ui, sans-serif; color: #fff; }
      #main { flex: 1; border: 0; border-radius: 8px; background: #000; }
      #phones { display: flex; flex-wrap: wrap; gap: 12px; align-content: flex-start; width: 52%; overflow: auto; }
      .phone { width: 300px; height: 560px; border: 0; border-radius: 18px; background: #0b1030; }
      #add { height: fit-content; }
      button { font-size: 18px; padding: 10px 16px; border-radius: 12px; border: 0; cursor: pointer; }
    </style>
    <iframe id="main" src="${page}"></iframe>
    <div id="phones"><button id="add">📱 + puhelin</button></div>`;
  const phones = document.getElementById('phones')!;
  let code = '';
  const addPhone = () => {
    if (!code) return;
    const f = document.createElement('iframe');
    f.className = 'phone';
    f.src = `${page}?huone=${code}`;
    phones.appendChild(f);
  };
  document.getElementById('add')!.onclick = addPhone;
  // The main screen tells us its room code when it is ready.
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data?.huone || code) return;
    code = e.data.huone;
    for (let i = 0; i < config.testPhones; i++) addPhone();
  });
}
