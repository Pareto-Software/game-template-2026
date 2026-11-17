// 📺 PÄÄNÄYTTÖ – the ship's main screen on the computer / projector (Phaser 4.2.1).
// Makes the room, shows the QR code and the crew, and (later) the flight itself.

import Phaser from 'phaser';
import QRCode from 'qrcode';
import { startPhaserGame, emojiTexture } from '@kit/phaser';
import { online } from '@kit/firebase';
import { storage } from '@kit/storage';
import { sfx } from '@kit/sound';
import { themes } from '@kit/themes';
import { config } from './config';
import { Simulaatio, crewByStation, type Phase, type PlayerInfo } from './simulaatio';

const W = 1280;
const H = 720;
const FONT = '"Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif';
const theme = themes[config.theme] ?? themes.avaruus;
const color = (hex: string) => parseInt(hex.replace('#', ''), 16);

let sim: Simulaatio | null = null;

/** Starts the main screen: makes (or reuses) a room, then opens the Phaser scene. */
export async function startMainScreen() {
  const code = await myRoom();
  // The ?testi view listens for this so it can open the phones.
  if (window.self !== window.top) window.parent.postMessage({ huone: code }, location.origin);
  startPhaserGame(
    { width: W, height: H, backgroundColor: theme.skyTop, scene: [new Paanaytto(code)] },
    { restartGame: () => sim?.setPhase('aula'), players: 1 },
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

class Paanaytto extends Phaser.Scene {
  private lobby!: Phaser.GameObjects.Container;
  private crewDots: Phaser.GameObjects.Container[] = [];
  private flight!: Phaser.GameObjects.Container;
  private corner!: Phaser.GameObjects.Text;

  constructor(private code: string) {
    super('Paanaytto');
  }

  create() {
    this.drawStars();
    this.makeLobby();
    this.makeFlight();
    sim = new Simulaatio(this.code, {
      phase: (phase) => this.showPhase(phase),
      players: (players) => this.showCrew(players),
    });
  }

  /** Twinkling stars in the background. */
  private drawStars() {
    for (let i = 0; i < 120; i++) {
      const star = this.add.circle(Math.random() * W, Math.random() * H, Math.random() * 2 + 0.5, 0xffffff);
      this.tweens.add({
        targets: star, alpha: 0.2, duration: 800 + Math.random() * 2000,
        yoyo: true, repeat: -1, delay: Math.random() * 2000,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Aula – waiting for the crew
  // ---------------------------------------------------------------------------

  private makeLobby() {
    this.lobby = this.add.container(0, 0);
    const title = this.add.text(W / 2, 50, `${config.ship.emoji} ${config.title}`, {
      fontFamily: FONT, fontSize: '56px', color: '#ffffff',
    }).setOrigin(0.5);
    this.lobby.add(title);

    // QR code + room code on the left
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, joinUrl(this.code), { width: 300, margin: 2 }).then(() => {
      this.textures.addCanvas('qr', canvas);
      this.lobby.add(this.add.image(220, 330, 'qr'));
    });
    this.lobby.add(this.add.text(220, 520, 'Skannaa puhelimella!', {
      fontFamily: FONT, fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5));
    this.lobby.add(this.add.text(220, 570, `Huone ${this.code}`, {
      fontFamily: FONT, fontSize: '40px', color: '#ffcc00',
    }).setOrigin(0.5));

    // Station cards on the right: 2 columns × 4 rows
    config.stations.forEach((s, i) => {
      const x = 470 + (i % 2) * 400;
      const y = 130 + Math.floor(i / 2) * 115;
      const card = this.add.rectangle(x, y, 380, 100, 0x000000, 0.45).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.3);
      const icon = this.add.image(x + 50, y + 50, emojiTexture(this, `asema-${s.id}`, s.emoji, 64));
      const name = this.add.text(x + 100, y + 18, s.name, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' });
      const dots = this.add.container(x + 100, y + 72);
      this.crewDots[i] = dots;
      this.lobby.add([card, icon, name, dots]);
    });

    const start = this.add.text(W / 2 + 230, 640, '🚀 Aloita matka', {
      fontFamily: FONT, fontSize: '36px', color: '#111111', backgroundColor: '#ffcc00',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => sim?.start());
    this.lobby.add(start);
  }

  /** Coloured dots for the players at each station, or 🤖 when nobody is there. */
  private showCrew(players: Record<string, PlayerInfo>) {
    const crew = crewByStation(players);
    config.stations.forEach((s, i) => {
      const dots = this.crewDots[i];
      dots.removeAll(true);
      if (crew[s.id].length === 0) {
        dots.add(this.add.text(0, 0, '🤖 autopilotti', { fontFamily: FONT, fontSize: '20px', color: '#aaaaaa' }).setOrigin(0, 0.5));
      } else {
        crew[s.id].forEach((p, j) => dots.add(this.add.circle(12 + j * 34, 0, 13, color(p.colour))));
      }
    });
    if (Object.keys(players).length > 0) sfx('click');
  }

  // ---------------------------------------------------------------------------
  // Matka – the flight (phase 2 makes this the real game)
  // ---------------------------------------------------------------------------

  private makeFlight() {
    this.flight = this.add.container(0, 0).setVisible(false);
    const ship = this.add.image(W / 2, H / 2, emojiTexture(this, 'laiva', config.ship.emoji, 128)).setAngle(45);
    this.tweens.add({ targets: ship, y: H / 2 - 20, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.flight.add(ship);
    this.flight.add(this.add.text(W / 2, 140, 'Matka alkaa!', {
      fontFamily: FONT, fontSize: '64px', color: '#ffffff',
    }).setOrigin(0.5));
    // Latecomers can still join with the room code
    this.corner = this.add.text(W - 20, 20, `Huone ${this.code}`, {
      fontFamily: FONT, fontSize: '24px', color: '#ffcc00',
    }).setOrigin(1, 0);
    this.flight.add(this.corner);
  }

  private showPhase(phase: Phase) {
    this.lobby.setVisible(phase === 'aula');
    this.flight.setVisible(phase !== 'aula');
    if (phase === 'matka') sfx('powerup');
  }
}
