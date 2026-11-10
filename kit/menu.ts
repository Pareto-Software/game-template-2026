// The ⚙️ settings menu in the bottom-left corner of every game (shared kit file – used by every game).
//
// Opens with the ⚙️ button or the Esc key and pauses the game while open:
//   🔄 Aloita alusta       – back to level 1, score 0, everyone at the start
//   ↩️ Tämä taso alusta    – the current level from the start
//   🔇 Äänet pois / päälle
//   ▶️ Jatka peliä
// A game gives the restart functions to startGame({ restartGame, restartLevel }).

import { toggleMute, isMuted } from './sound';

export interface MenuOptions {
  restartGame?: () => void;
  restartLevel?: () => void;
  setPaused: (value: boolean) => void;
  isPaused: () => boolean;
}

const BUTTON_STYLE: Partial<CSSStyleDeclaration> = {
  padding: '8px 14px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', border: 'none',
  color: '#fff', font: 'bold 15px system-ui, sans-serif', cursor: 'pointer',
};

export function addSettingsMenu(o: MenuOptions) {
  const gear = document.createElement('button');
  gear.textContent = '⚙️ Asetukset';
  gear.title = 'Asetukset (Esc)';
  Object.assign(gear.style, BUTTON_STYLE, { position: 'fixed', left: '140px', bottom: '12px', zIndex: '10' });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', inset: '0', zIndex: '20', display: 'none', placeItems: 'center',
    background: 'rgba(0,0,0,0.55)',
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    background: '#1f2350', border: '3px solid #3a3f86', borderRadius: '20px', padding: '24px',
    display: 'grid', gap: '12px', minWidth: '280px', color: '#fff',
    font: 'bold 18px system-ui, sans-serif', textAlign: 'center',
  });
  const title = document.createElement('div');
  title.textContent = '⚙️ Asetukset';
  title.style.fontSize = '24px';
  box.appendChild(title);
  panel.appendChild(box);

  let pausedBefore = false;
  const isOpen = () => panel.style.display !== 'none';
  const open = () => {
    pausedBefore = o.isPaused();
    o.setPaused(true);
    panel.style.display = 'grid';
    soundButton.textContent = soundLabel();
    (box.querySelector('button') as HTMLButtonElement | null)?.focus();
  };
  const close = () => {
    panel.style.display = 'none';
    o.setPaused(pausedBefore);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const addButton = (label: string, action: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, BUTTON_STYLE, { borderRadius: '12px', padding: '12px 18px', fontSize: '18px', background: '#3a3f86' });
    b.addEventListener('click', action);
    box.appendChild(b);
    return b;
  };

  if (o.restartGame) addButton('🔄 Aloita alusta', () => { close(); o.restartGame!(); });
  if (o.restartLevel) addButton('↩️ Tämä taso alusta', () => { close(); o.restartLevel!(); });
  const soundLabel = () => (isMuted() ? '🔈 Äänet päälle' : '🔇 Äänet pois');
  const soundButton = addButton(soundLabel(), () => { toggleMute(); soundButton.textContent = soundLabel(); });
  addButton('▶️ Jatka peliä', close);

  gear.addEventListener('click', () => (isOpen() ? close() : open()));
  gear.addEventListener('focus', () => gear.blur()); // the keys belong to the game
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { e.preventDefault(); isOpen() ? close() : open(); }
  });

  document.body.append(gear, panel);
}
