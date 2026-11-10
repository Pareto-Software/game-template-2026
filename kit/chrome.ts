// The buttons around every game (shared kit file – used by every game):
// "← Kaikki pelit" back to the gallery, and the ⚙️ settings menu.
// startGame() (kit/loop.ts) and startPhaserGame() (kit/phaser.ts) add these for you.

import { input } from './input';
import { addSettingsMenu } from './menu';

export interface ChromeOptions {
  restartGame?: () => void;
  restartLevel?: () => void;
  /** 1 = single player, 2 = two players (default). */
  players?: 1 | 2;
  setPaused: (value: boolean) => void;
  isPaused: () => boolean;
}

/** Page styles shared by every game: dark background, game centred, no scrolling. */
export function stylePage() {
  Object.assign(document.body.style, {
    margin: '0', background: '#111', height: '100vh', display: 'grid',
    placeItems: 'center', overflow: 'hidden',
  });
}

/**
 * A small "back to all games" button in the bottom-left corner.
 * Games live in games/<name>/, so the gallery is two folders up.
 */
function addGalleryLink() {
  const a = document.createElement('a');
  a.href = '../../';
  a.textContent = '← Kaikki pelit';
  a.title = 'Takaisin galleriaan';
  Object.assign(a.style, {
    position: 'fixed', left: '12px', bottom: '12px', zIndex: '10',
    padding: '8px 14px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)',
    color: '#fff', font: 'bold 15px system-ui, sans-serif', textDecoration: 'none',
  });
  // Don't let the link keep keyboard focus: the keys belong to the game.
  a.addEventListener('focus', () => a.blur());
  document.body.appendChild(a);
}

export function addGameChrome(o: ChromeOptions) {
  addGalleryLink();
  input.initPlayers(o.players ?? 2);
  addSettingsMenu(o);
}
