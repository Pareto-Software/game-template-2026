// Helpers for games made with Phaser (shared kit file – used by every Phaser game).
//
// startPhaserGame(config, options) – creates the Phaser game and adds everything
//   the other games have: "← Kaikki pelit", the ⚙️ menu (Esc), P to pause,
//   single-player mode and kit input (call input.player(1|2) in update()).
// emojiTexture(scene, key, '🐧', 64) – an emoji as a Phaser texture.
// circleTexture(scene, key, radius, color) – a filled circle texture (snowballs, dots).
//
// Phaser version: 4.2.1 (pinned in package.json). Use Phaser's own physics,
// tweens, particles and cameras; use the kit for input and sound (sfx).

import Phaser from 'phaser';
import { input } from './input';
import { addGameChrome, stylePage } from './chrome';
import { emojiCanvas } from './sprites';

export interface PhaserOptions {
  /** ⚙️ "Aloita alusta". */
  restartGame?: () => void;
  /** ⚙️ "Tämä taso alusta". */
  restartLevel?: () => void;
  /** 1 = single player, 2 = two players (default). */
  players?: 1 | 2;
}

export function startPhaserGame(config: Phaser.Types.Core.GameConfig, o: PhaserOptions = {}): Phaser.Game {
  stylePage();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: document.body,
    backgroundColor: '#111111',
    // The kit reads the keyboard and gamepads, so Phaser doesn't have to.
    input: { keyboard: false, gamepad: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    ...config,
  });
  // Kit input: "pressed this frame" is worked out once per Phaser step.
  game.events.on(Phaser.Core.Events.PRE_STEP, () => input.beginFrame());
  game.events.on(Phaser.Core.Events.POST_STEP, () => input.endFrame());

  const setPaused = (value: boolean) => (value ? game.pause() : game.resume());
  addGameChrome({ ...o, setPaused, isPaused: () => game.isPaused });
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && !e.repeat) setPaused(!game.isPaused);
  });
  return game;
}

/** Make (once) a texture from an emoji and return its key. */
export function emojiTexture(scene: Phaser.Scene, key: string, emoji: string, px = 64): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, emojiCanvas(emoji, px));
  return key;
}

/** Make (once) a filled circle texture and return its key. */
export function circleTexture(scene: Phaser.Scene, key: string, radius: number, color = 0xffffff): string {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }
  return key;
}
