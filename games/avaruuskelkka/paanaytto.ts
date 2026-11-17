// 📺 PÄÄNÄYTTÖ – the ship's main viewscreen on the computer / projector (Phaser 4.2.1).
// A goofy starship bridge: rounded console panels around a big viewscreen.
// Makes the room, shows the QR code and the crew, then the flight through space.

import Phaser from 'phaser';
import QRCode from 'qrcode';
import { startPhaserGame, emojiTexture, circleTexture } from '@kit/phaser';
import { online } from '@kit/firebase';
import { storage } from '@kit/storage';
import { sfx } from '@kit/sound';
import { config } from './config';
import { Simulaatio, crewByStation, stardate, towards, type Phase, type PlayerInfo } from './simulaatio';

const W = 1280;
const H = 720;
/** The viewscreen: the window to space inside the console frame. */
const VS = { x: 150, y: 70, w: 1110, h: 590 };
const FONT = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", system-ui, sans-serif';
const color = (hex: string) => parseInt(hex.replace('#', ''), 16);
const LC = config.lcars.map(color); // console colours as numbers
const FRAME = 900; // depth of the console frame
const UI = 800; // depth of things drawn on top of the viewscreen

let sim: Simulaatio | null = null;

/** Starts the main screen: makes (or reuses) a room, then opens the Phaser scene. */
export async function startMainScreen() {
  const code = await myRoom();
  // The ?testi view listens for this so it can open the phones.
  if (window.self !== window.top) window.parent.postMessage({ huone: code }, location.origin);
  startPhaserGame(
    { width: W, height: H, backgroundColor: '#000000', scene: [new Paanaytto(code)] },
    { restartGame: () => sim?.newTrip(), players: 1 },
  );
}

/** After a reload, keep the same room so the phones stay connected. */
async function myRoom(): Promise<string> {
  const uid = await online.connect();
  const old = storage.load('huone', '');
  if (old && (await online.read<string>(`rooms/${old}/hostUid`)) === uid) return old;
  const code = await online.createRoom();
  storage.save('huone', code);
  return code;
}

/** The address a phone opens to join this room. */
function joinUrl(code: string) {
  return `${location.origin}${location.pathname}?huone=${code}`;
}

/** Text in the console style: tall, narrow, CAPITALS. */
function label(scene: Phaser.Scene, x: number, y: number, text: string, size = 22, fill = '#000000') {
  return scene.add.text(x, y, text.toUpperCase(), { fontFamily: FONT, fontSize: `${size}px`, color: fill, fontStyle: 'bold' });
}

interface Star { x: number; y: number; z: number }

class Paanaytto extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Triangle;
  private stars: Star[] = [];
  private starGfx!: Phaser.GameObjects.Graphics;
  private miniMap!: Phaser.GameObjects.Graphics;
  private targetText!: Phaser.GameObjects.Text;
  private dateText!: Phaser.GameObjects.Text;
  private lobby!: Phaser.GameObjects.Container;
  private crewDots: Phaser.GameObjects.Container[] = [];
  private finish!: Phaser.GameObjects.Container;
  private finishTime!: Phaser.GameObjects.Text;
  private lastBanner: Phaser.GameObjects.Text | null = null;

  constructor(private code: string) {
    super('Paanaytto');
  }

  create() {
    sim = new Simulaatio(this.code, {
      phase: (phase) => this.showPhase(phase),
      players: (players) => this.showCrew(players),
      arrived: (i) => this.arrivedAt(i),
      bonk: () => this.bonk(),
      warp: () => this.warpFlash(),
    });
    this.makeStars();
    this.makeSpace();
    this.makeShip();
    this.makeOverlay();
    this.makeFrame();
    this.makeLobby();
    this.makeFinish();
    this.showPhase(sim.phase);
  }

  update(_time: number, deltaMs: number) {
    if (!sim) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    sim.update(dt);
    const s = sim.ship;
    this.ship.setPosition(s.x, s.y).setAngle(s.heading + 45); // the 🚀 emoji points up-right
    this.drawStars(dt);
    this.drawArrow();
    this.drawMiniMap();
    const t = config.route[s.target];
    this.targetText.setText(`KOHDE: ${t.name.toUpperCase()} ${t.emoji}   ${Math.round(towards(s, t.x, t.y).distance)} KM`);
    this.dateText.setText(`TÄHTIPÄIVÄ ${stardate(s.time)}`);
  }

  // ---------------------------------------------------------------------------
  // Space: stars, planets, the ship
  // ---------------------------------------------------------------------------

  /** Stars that rush past the viewscreen (long streaks at warp). */
  private makeStars() {
    for (let i = 0; i < 170; i++) {
      this.stars.push({ x: VS.x + Math.random() * VS.w, y: VS.y + Math.random() * VS.h, z: 0.15 + Math.random() * 0.85 });
    }
    this.starGfx = this.add.graphics().setScrollFactor(0).setDepth(-10);
  }

  private drawStars(dt: number) {
    const s = sim!.ship;
    const rad = (s.heading * Math.PI) / 180;
    const vx = Math.cos(rad) * s.speed;
    const vy = Math.sin(rad) * s.speed;
    const streak = s.speed > 500 ? 0.06 : 0.004;
    const g = this.starGfx.clear();
    for (const st of this.stars) {
      st.x -= vx * st.z * dt * 0.5;
      st.y -= vy * st.z * dt * 0.5;
      if (st.x < VS.x) st.x += VS.w;
      if (st.x > VS.x + VS.w) st.x -= VS.w;
      if (st.y < VS.y) st.y += VS.h;
      if (st.y > VS.y + VS.h) st.y -= VS.h;
      g.lineStyle(st.z * 2.5, 0xffffff, 0.4 + st.z * 0.6);
      g.lineBetween(st.x, st.y, st.x + vx * st.z * streak + 0.5, st.y + vy * st.z * streak + 0.5);
    }
  }

  /** The places on the route, the dotted route line, colourful space clouds and the edge of space. */
  private makeSpace() {
    const b = sim!.bounds;
    for (let i = 0; i < 45; i++) {
      const x = b.left + Math.random() * (b.right - b.left);
      const y = b.top + Math.random() * (b.bottom - b.top);
      this.add.circle(x, y, 200 + Math.random() * 500, Phaser.Utils.Array.GetRandom(LC), 0.06).setDepth(-5);
    }
    const g = this.add.graphics().setDepth(-4);
    g.lineStyle(6, LC[1], 0.35);
    config.route.forEach((w, i) => {
      const next = config.route[i + 1];
      if (!next) return;
      const steps = Math.floor(Math.hypot(next.x - w.x, next.y - w.y) / 60);
      for (let k = 0; k < steps; k += 2) {
        const a = k / steps;
        const c = (k + 1) / steps;
        g.lineBetween(w.x + (next.x - w.x) * a, w.y + (next.y - w.y) * a, w.x + (next.x - w.x) * c, w.y + (next.y - w.y) * c);
      }
    });
    config.route.forEach((w, i) => {
      const planet = this.add.image(w.x, w.y, emojiTexture(this, `paikka-${i}`, w.emoji, 200)).setDepth(-3);
      this.tweens.add({ targets: planet, angle: 8, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      label(this, w.x, w.y + 130, w.name, 30, config.lcars[0]).setOrigin(0.5).setDepth(-3);
    });
    // The wobbly pink edge of space
    g.lineStyle(14, 0xff5ca8, 0.5);
    g.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
  }

  private makeShip() {
    const s = sim!.ship;
    this.ship = this.add.image(s.x, s.y, emojiTexture(this, 'laiva', config.ship.emoji, 128)).setDisplaySize(config.ship.size, config.ship.size);
    this.arrow = this.add.triangle(0, 0, 0, -16, 34, 0, 0, 16, LC[0]).setDepth(5);
    // The ship sits in the middle of the viewscreen, not the middle of the whole picture
    this.cameras.main.startFollow(this.ship, false, 0.15, 0.15, -(VS.x + VS.w / 2 - W / 2), -(VS.y + VS.h / 2 - H / 2));
  }

  /** An orange arrow next to the ship points to where we are going. */
  private drawArrow() {
    const s = sim!.ship;
    const t = config.route[s.target];
    const dir = towards(s, t.x, t.y);
    const rad = (dir.angle * Math.PI) / 180;
    this.arrow.setPosition(s.x + Math.cos(rad) * 110, s.y + Math.sin(rad) * 110).setAngle(dir.angle);
    this.arrow.setVisible(sim!.phase === 'matka' && dir.distance > 400);
  }

  // ---------------------------------------------------------------------------
  // Things on top of the viewscreen: target line, mini map, banners
  // ---------------------------------------------------------------------------

  private makeOverlay() {
    this.targetText = label(this, VS.x + 60, VS.y + 14, '', 26, config.lcars[0]).setScrollFactor(0).setDepth(UI);
    this.add.rectangle(VS.x + VS.w - 270, VS.y + VS.h - 140, 260, 130, 0x000000, 0.6)
      .setOrigin(0).setScrollFactor(0).setDepth(UI).setStrokeStyle(3, LC[2]);
    this.miniMap = this.add.graphics().setScrollFactor(0).setDepth(UI);
  }

  /** Small map in the corner: the whole route and where the ship is. */
  private drawMiniMap() {
    const b = sim!.bounds;
    const box = { x: VS.x + VS.w - 260, y: VS.y + VS.h - 130, w: 240, h: 110 };
    const px = (x: number) => box.x + ((x - b.left) / (b.right - b.left)) * box.w;
    const py = (y: number) => box.y + ((y - b.top) / (b.bottom - b.top)) * box.h;
    const g = this.miniMap.clear();
    const s = sim!.ship;
    g.lineStyle(2, LC[1], 0.6);
    config.route.forEach((w, i) => {
      const next = config.route[i + 1];
      if (next) g.lineBetween(px(w.x), py(w.y), px(next.x), py(next.y));
      g.fillStyle(i < s.target ? 0x7cff6b : i === s.target ? LC[0] : 0x888888, 1);
      g.fillCircle(px(w.x), py(w.y), 5);
    });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(px(s.x), py(s.y), 4);
  }

  /** A big message that flies in and fades away. */
  private banner(text: string, fill = config.lcars[0]) {
    if (this.lastBanner) { this.tweens.killTweensOf(this.lastBanner); this.lastBanner.destroy(); } // one message at a time
    const t = label(this, VS.x + VS.w / 2, VS.y + 120, text, 56, fill).setOrigin(0.5).setScrollFactor(0).setDepth(UI).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 350, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 600, onComplete: () => t.destroy() });
    this.lastBanner = t;
  }

  private arrivedAt(i: number) {
    const w = config.route[i];
    sfx(i === config.route.length - 1 ? 'win' : 'coin');
    this.banner(`SAAVUTTU: ${w.name} ${w.emoji}`);
  }

  private bonk() {
    sfx('boom');
    this.cameras.main.shake(400, 0.015);
    this.banner('BOING! AVARUUDEN REUNA!', '#ff5ca8');
  }

  private warpFlash() {
    sfx('powerup');
    this.cameras.main.flash(300, 200, 220, 255);
    this.banner('WARP-NOPEUS!', config.lcars[2]);
  }

  // ---------------------------------------------------------------------------
  // The console frame around the viewscreen (rounded corners, coloured blocks)
  // ---------------------------------------------------------------------------

  private makeFrame() {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d = FRAME) =>
      o.setScrollFactor(0).setDepth(d);
    // Black around the viewscreen, so space shows only inside it
    for (const [x, y, w, h] of [[0, 0, W, VS.y], [0, VS.y + VS.h, W, H - VS.y - VS.h], [0, 0, VS.x, H], [VS.x + VS.w, 0, W - VS.x - VS.w, H]]) {
      fixed(this.add.rectangle(x, y, w, h, 0x000000).setOrigin(0), FRAME - 1);
    }
    const g = fixed(this.add.graphics());
    // Top elbow + top bar
    g.fillStyle(LC[0]);
    g.fillRoundedRect(0, 0, 130, 200, { tl: 50, tr: 0, bl: 0, br: 0 });
    g.fillRect(100, 0, 460, 46);
    g.fillRect(130, 46, 26, 26);
    g.fillStyle(0x000000);
    g.fillRoundedRect(130, 46, 60, 60, { tl: 26, tr: 0, bl: 0, br: 0 });
    // Bottom elbow + bottom bar
    g.fillStyle(LC[1]);
    g.fillRoundedRect(0, 520, 130, 200, { tl: 0, tr: 0, bl: 50, br: 0 });
    g.fillRect(100, 674, 460, 46);
    g.fillRect(130, 648, 26, 26);
    g.fillStyle(0x000000);
    g.fillRoundedRect(130, 614, 60, 60, { tl: 0, tr: 0, bl: 26, br: 0 });
    // Left column blocks with silly numbers
    const blocks = [[210, 110, LC[2], '03-47'], [326, 70, LC[3], '12-B'], [402, 112, LC[4], '88-K']] as const;
    for (const [y, h, c, n] of blocks) {
      g.fillStyle(c);
      g.fillRect(0, y, 130, h);
      fixed(label(this, 120, y + h - 30, n, 20).setOrigin(1, 0));
    }
    // More pieces of the top and bottom bars
    const bars = [[570, 0, 230, LC[2]], [810, 0, 140, LC[5]], [960, 0, 320, LC[4]], [570, 674, 330, LC[3]], [910, 674, 370, LC[2]]] as const;
    for (const [x, y, w, c] of bars) {
      g.fillStyle(c);
      g.fillRoundedRect(x, y, w, 46, x + w >= W ? { tl: 0, tr: 23, bl: 0, br: 23 } : 0);
    }
    fixed(label(this, 110, 10, config.ship.name, 28));
    fixed(label(this, 975, 10, `HUONE ${this.code}`, 28));
    this.dateText = fixed(label(this, 585, 684, '', 26));
    fixed(label(this, 925, 684, 'JÄRJESTELMÄT SEKAISIN', 26));
    g.lineStyle(3, LC[1], 0.8);
    g.strokeRoundedRect(VS.x - 2, VS.y - 2, VS.w + 4, VS.h + 4, 14);
  }

  // ---------------------------------------------------------------------------
  // Aula – the crew signs in
  // ---------------------------------------------------------------------------

  private makeLobby() {
    this.lobby = this.add.container(0, 0).setScrollFactor(0).setDepth(UI + 10);
    this.lobby.add(this.add.rectangle(VS.x, VS.y, VS.w, VS.h, 0x000000, 0.93).setOrigin(0));
    this.lobby.add(label(this, VS.x + VS.w / 2, VS.y + 40, 'Miehistö ilmoittautuu sillalle!', 44, config.lcars[0]).setOrigin(0.5));

    // QR code + room code on the left
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, joinUrl(this.code), { width: 280, margin: 2 }).then(() => {
      this.textures.addCanvas('qr', canvas);
      this.lobby.add(this.add.image(VS.x + 175, VS.y + 270, 'qr'));
    });
    this.lobby.add(label(this, VS.x + 175, VS.y + 440, 'Skannaa puhelimella!', 28, '#ffffff').setOrigin(0.5));
    this.lobby.add(label(this, VS.x + 175, VS.y + 485, `Huone ${this.code}`, 42, config.lcars[0]).setOrigin(0.5));

    // Station cards on the right: 2 columns × 4 rows of console pills
    config.stations.forEach((s, i) => {
      const x = VS.x + 360 + (i % 2) * 370;
      const y = VS.y + 95 + Math.floor(i / 2) * 102;
      const c = LC[i % LC.length];
      const g = this.add.graphics();
      g.fillStyle(c);
      g.fillRoundedRect(x, y, 70, 86, { tl: 43, tr: 0, bl: 43, br: 0 });
      g.fillRect(x + 76, y, 280, 10);
      g.fillRect(x + 76, y + 76, 280, 10);
      const icon = this.add.image(x + 40, y + 43, emojiTexture(this, `asema-${s.id}`, s.emoji, 64)).setDisplaySize(52, 52);
      const name = label(this, x + 88, y + 16, s.name, 30, config.lcars[i % LC.length]);
      const dots = this.add.container(x + 88, y + 60);
      this.crewDots[i] = dots;
      this.lobby.add([g, icon, name, dots]);
    });

    const start = label(this, VS.x + 720, VS.y + 530, '  Tehkää niin! 🚀  ', 38).setOrigin(0.5)
      .setBackgroundColor(config.lcars[0]).setPadding(24, 10, 24, 10).setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => sim?.start());
    this.lobby.add(start);
  }

  /** Coloured dots for the players at each station, or 🤖 when nobody is there. */
  private showCrew(players: Record<string, PlayerInfo>) {
    const crew = crewByStation(players);
    config.stations.forEach((s, i) => {
      const dots = this.crewDots[i];
      if (!dots) return;
      dots.removeAll(true);
      if (crew[s.id].length === 0) {
        dots.add(label(this, 0, 0, '🤖 autopilotti', 20, '#888888').setOrigin(0, 0.5));
      } else {
        crew[s.id].forEach((p, j) => dots.add(this.add.circle(12 + j * 34, 0, 13, color(p.colour))));
      }
    });
    if (Object.keys(players).length > 0) sfx('click');
  }

  // ---------------------------------------------------------------------------
  // Perillä – we made it!
  // ---------------------------------------------------------------------------

  private makeFinish() {
    this.finish = this.add.container(0, 0).setScrollFactor(0).setDepth(UI + 10).setVisible(false);
    this.finish.add(this.add.rectangle(VS.x, VS.y, VS.w, VS.h, 0x000000, 0.6).setOrigin(0));
    this.finish.add(label(this, VS.x + VS.w / 2, VS.y + 150, 'Perillä! 🎉', 96, config.lcars[0]).setOrigin(0.5));
    this.finishTime = label(this, VS.x + VS.w / 2, VS.y + 250, '', 36, '#ffffff').setOrigin(0.5);
    this.finish.add(this.finishTime);
    const again = label(this, VS.x + VS.w / 2, VS.y + 500, '  Uusi matka  ', 36).setOrigin(0.5)
      .setBackgroundColor(config.lcars[1]).setPadding(24, 10, 24, 10).setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => sim?.newTrip());
    this.finish.add(again);
  }

  private party() {
    const s = sim!.ship;
    const minutes = Math.floor(s.time / 60);
    const seconds = String(Math.floor(s.time % 60)).padStart(2, '0');
    this.finishTime.setText(`MATKA-AIKA ${minutes}:${seconds} · TÄHTIPÄIVÄ ${stardate(s.time)}`);
    LC.forEach((c, i) => {
      const confetti = this.add.particles(VS.x + VS.w / 2, VS.y + 40, circleTexture(this, `konfetti-${i}`, 7, c), {
        speed: { min: 200, max: 600 }, angle: { min: 20, max: 160 }, gravityY: 500, lifespan: 3500, emitting: false,
      }).setScrollFactor(0).setDepth(UI + 20);
      confetti.explode(40);
      this.time.delayedCall(4000, () => confetti.destroy());
    });
    // The bridge's space cat runs across the viewscreen
    const cat = this.add.image(VS.x - 60, VS.y + VS.h - 80, emojiTexture(this, 'kissa', '🐈', 96)).setScrollFactor(0).setDepth(UI + 20);
    this.tweens.add({ targets: cat, x: VS.x + VS.w + 60, duration: 4000, onComplete: () => cat.destroy() });
    this.tweens.add({ targets: cat, y: cat.y - 40, duration: 250, yoyo: true, repeat: 15 });
  }

  private showPhase(phase: Phase) {
    if (!this.lobby) return; // create() is still running
    this.lobby.setVisible(phase === 'aula');
    this.finish.setVisible(phase === 'perilla');
    this.targetText.setVisible(phase === 'matka');
    if (phase === 'matka') { sfx('jump'); this.banner('Tehkää niin!'); }
    if (phase === 'perilla') this.party();
  }
}
