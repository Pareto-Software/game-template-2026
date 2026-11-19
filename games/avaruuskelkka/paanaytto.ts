// 📺 PÄÄNÄYTTÖ – the ship's main viewscreen on the computer / projector (Phaser 4.2.1).
// A goofy starship bridge: rounded console panels around a big viewscreen.
// Makes the room, shows the QR code and the crew, then the flight through space.

import Phaser from 'phaser';
import QRCode from 'qrcode';
import { startPhaserGame, emojiTexture, circleTexture } from '@kit/phaser';
import { online } from '@kit/firebase';
import { storage } from '@kit/storage';
import { sfx } from '@kit/sound';
import { config, type Waypoint } from './config';
import { Simulaatio, crewByStation, stardate, towards, hull, place, type Phase, type PlayerInfo, type Threat, type ThreatKind } from './simulaatio';

const W = 1280;
const H = 720;
/** The viewscreen: the window to space inside the console frame. */
const VS = { x: 150, y: 70, w: 1110, h: 590 };
const FONT = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", system-ui, sans-serif';
const color = (hex: string) => parseInt(hex.replace('#', ''), 16);
const LC = config.lcars.map(color); // console colours as numbers
const FRAME = 900; // depth of the console frame
/** How far the viewscreen zooms out, so the crew sees the danger coming (1 = no zoom). */
const ZOOM = 0.62;
/** The stars cover the whole viewscreen even though space is zoomed out. */
const STARS = {
  x: W / 2 - (W / 2 - VS.x) / ZOOM, y: H / 2 - (H / 2 - VS.y) / ZOOM, w: VS.w / ZOOM, h: VS.h / ZOOM,
};
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
  private statusText!: Phaser.GameObjects.Text;
  private threatSprites = new Map<number, Phaser.GameObjects.Image>();
  private pirateLabel!: Phaser.GameObjects.Text;
  private shieldBubble!: Phaser.GameObjects.Arc;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private laser!: Phaser.GameObjects.Graphics;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private secretSprites: Phaser.GameObjects.Image[] = [];
  private fog!: Phaser.GameObjects.Container;
  private alertGlow!: Phaser.GameObjects.Rectangle;
  private alertText!: Phaser.GameObjects.Text;
  private sirenTimer = 0;

  constructor(private code: string) {
    super('Paanaytto');
  }

  create() {
    this.makeCameras();
    sim = new Simulaatio(this.code, {
      phase: (phase) => this.showPhase(phase),
      players: (players) => this.showCrew(players),
      arrived: (i) => this.arrivedAt(i),
      bonk: () => this.bonk(),
      warp: () => this.warpFlash(),
      zap: (t) => this.zap(t),
      pop: (t) => this.pop(t),
      hit: (kind, blocked) => this.hit(kind, blocked),
      shields: () => { sfx('powerup', { pitch: 0.7 }); this.banner('KILVET YLÖS!', config.lcars[2]); },
      fixed: () => sfx('coin', { pitch: 1.5 }),
      pirate: (arrived) => this.pirateNews(arrived),
      scan: (found) => this.scanPulse(found),
      wormhole: (i) => this.wormhole(i),
      crystal: (i) => this.crystal(i),
      alert: () => { this.banner('PUNAINEN HÄLYTYS!', '#ff3333'); this.cameras.main.shake(300, 0.01); },
      choose: () => { sfx('click'); this.banner('Kapteeni, valitse reitti!', config.lcars[1]); },
      chosen: (w) => { sfx('coin'); this.banner(`Kurssi: ${w.name} ${w.emoji}`, config.lcars[0]); },
    });
    this.makeStars();
    this.makeSpace();
    this.makeShip();
    this.makeDangerFx();
    this.makeSecrets();
    this.makeOverlay();
    this.makeFogAndAlert();
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
    this.drawThreats();
    this.drawShipFx();
    this.drawSecrets();
    this.drawFogAndAlert(dt);
    const t = place(s, s.target);
    this.targetText.setText(`KOHDE: ${t.name.toUpperCase()} ${t.emoji}   ${Math.round(towards(s, t.x, t.y).distance)} KM`);
    this.dateText.setText(`TÄHTIPÄIVÄ ${stardate(s.time)}`);
    const faults = s.faults?.length ?? 0;
    const shields = s.shield > 0 ? 'KILVET YLHÄÄLLÄ 🛡️' : s.shieldCharge > 0 ? 'KILVET LATAUTUU' : 'KILVET VALMIINA';
    this.statusText.setText(`RUNKO ${hull(s)}%   ${faults ? '💥'.repeat(faults) + ' VIKOJA ' + faults : 'EI VIKOJA'}   ${shields}   💎 ${s.stars}`);
    this.statusText.setColor(faults >= 3 ? '#ff5c5c' : config.lcars[2]);
  }

  /** Two cameras: the main one shows space (zoomed out), the other the console frame and texts.
   *  Things fixed on the screen (setScrollFactor(0)) go to the frame camera automatically. */
  private makeCameras() {
    this.cameras.main.setZoom(ZOOM);
    this.uiCam = this.cameras.add(0, 0, W, H);
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, (o: Phaser.GameObjects.GameObject) => {
      queueMicrotask(() => {
        if (!o.scene) return; // already gone
        let root = o as Phaser.GameObjects.GameObject & { scrollFactorX?: number };
        while (root.parentContainer) root = root.parentContainer;
        const onScreen = root.scrollFactorX === 0 && root.name !== 'space';
        (onScreen ? this.cameras.main : this.uiCam).ignore(o);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Space: stars, planets, the ship
  // ---------------------------------------------------------------------------

  /** Stars that rush past the viewscreen (long streaks at warp). */
  private makeStars() {
    for (let i = 0; i < 170; i++) {
      this.stars.push({ x: STARS.x + Math.random() * STARS.w, y: STARS.y + Math.random() * STARS.h, z: 0.15 + Math.random() * 0.85 });
    }
    this.starGfx = this.add.graphics().setScrollFactor(0).setDepth(-10).setName('space');
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
      if (st.x < STARS.x) st.x += STARS.w;
      if (st.x > STARS.x + STARS.w) st.x -= STARS.w;
      if (st.y < STARS.y) st.y += STARS.h;
      if (st.y > STARS.y + STARS.h) st.y -= STARS.h;
      g.lineStyle((st.z * 2.5) / ZOOM, 0xffffff, 0.4 + st.z * 0.6);
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
    const dashes = (a: Waypoint, b: Waypoint) => {
      const steps = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 60);
      for (let k = 0; k < steps; k += 2) {
        const p = k / steps;
        const q = (k + 1) / steps;
        g.lineBetween(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p, a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q);
      }
    };
    config.route.forEach((w, i) => {
      const next = config.route[i + 1];
      if (next) dashes(w, next);
      // The other route the Captain can choose: dashes to it and on from it
      const prev = config.route[i - 1];
      if (w.alt && prev) { dashes(prev, w.alt); if (next) dashes(w.alt, next); }
    });
    const planet = (w: Waypoint, key: string) => {
      const img = this.add.image(w.x, w.y, emojiTexture(this, key, w.emoji, 200)).setDepth(-3);
      this.tweens.add({ targets: img, angle: 8, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      label(this, w.x, w.y + 140, w.name, 44, config.lcars[0]).setOrigin(0.5).setDepth(-3);
    };
    config.route.forEach((w, i) => {
      planet(w, `paikka-${i}`);
      if (w.alt) planet(w.alt, `paikka-${i}-alt`);
    });
    // The wobbly pink edge of space
    g.lineStyle(14, 0xff5ca8, 0.5);
    g.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
  }

  private makeShip() {
    const s = sim!.ship;
    this.ship = this.add.image(s.x, s.y, emojiTexture(this, 'laiva', config.ship.emoji, 128)).setDisplaySize(config.ship.size, config.ship.size);
    this.arrow = this.add.triangle(0, 0, 0, -24, 50, 0, 0, 24, LC[0]).setDepth(5);
    // The ship sits in the middle of the viewscreen, not the middle of the whole picture
    this.cameras.main.startFollow(this.ship, false, 0.15, 0.15, -(VS.x + VS.w / 2 - W / 2) / ZOOM, -(VS.y + VS.h / 2 - H / 2) / ZOOM);
  }

  /** An orange arrow next to the ship points to where we are going. */
  private drawArrow() {
    const s = sim!.ship;
    const t = place(s, s.target);
    const dir = towards(s, t.x, t.y);
    const rad = (dir.angle * Math.PI) / 180;
    this.arrow.setPosition(s.x + Math.cos(rad) * 140, s.y + Math.sin(rad) * 140).setAngle(dir.angle);
    this.arrow.setVisible(sim!.phase === 'matka' && dir.distance > 400);
  }

  // ---------------------------------------------------------------------------
  // Vaarat: rocks, pirates, pies, lasers, shields, sparks
  // ---------------------------------------------------------------------------

  private makeDangerFx() {
    const d = config.danger;
    emojiTexture(this, 'kivi', d.rock.emoji, 96);
    emojiTexture(this, 'mohko', d.pirate.emoji, 128);
    emojiTexture(this, 'piirakka', d.pie.emoji, 64);
    this.pirateLabel = label(this, 0, 0, d.pirate.name, 36, '#7cff6b').setOrigin(0.5).setVisible(false).setDepth(6);
    this.shieldBubble = this.add.circle(0, 0, config.ship.size * 0.8, LC[2], 0.18).setStrokeStyle(5, LC[6]).setDepth(4).setVisible(false);
    this.laser = this.add.graphics().setDepth(6);
    // Sparks fly from the ship while something is broken
    this.sparks = this.add.particles(0, 0, circleTexture(this, 'kipina', 5, 0xffcc00), {
      speed: { min: 80, max: 220 }, lifespan: 500, scale: { start: 1, end: 0 }, frequency: 200, emitting: false,
    }).setDepth(5);
    this.sparks.startFollow(this.ship);
  }

  /** Keeps a picture for every threat in the simulation, in the right place. */
  private drawThreats() {
    const live = new Set<number>();
    const sizes: Record<ThreatKind, number> = {
      kivi: config.danger.rock.size, mohko: config.danger.pirate.size, piirakka: config.danger.pie.size,
    };
    let pirate: Threat | null = null;
    for (const t of sim!.threats) {
      live.add(t.id);
      let img = this.threatSprites.get(t.id);
      if (!img) {
        img = this.add.image(t.x, t.y, t.kind).setDisplaySize(sizes[t.kind], sizes[t.kind]).setDepth(3);
        this.threatSprites.set(t.id, img);
      }
      img.setPosition(t.x, t.y);
      if (t.kind === 'kivi') img.angle += 1;
      if (t.kind === 'piirakka') img.angle += 6;
      if (t.kind === 'mohko') { pirate = t; img.setAngle(Math.sin(t.age * 3) * 15); }
    }
    for (const [id, img] of this.threatSprites) {
      if (!live.has(id)) { img.destroy(); this.threatSprites.delete(id); }
    }
    this.pirateLabel.setVisible(!!pirate);
    if (pirate) this.pirateLabel.setPosition(pirate.x, pirate.y - 100).setText(`${config.danger.pirate.name} ${'❤️'.repeat(pirate.hp)}`);
  }

  private drawShipFx() {
    const s = sim!.ship;
    this.shieldBubble.setPosition(s.x, s.y).setVisible(s.shield > 0).setAlpha(0.6 + Math.sin(this.time.now / 80) * 0.3);
    const faults = s.faults?.length ?? 0;
    this.sparks.emitting = faults > 0 && sim!.phase === 'matka';
    this.sparks.frequency = Math.max(40, 300 - faults * 50);
  }

  /** PIU PIU: a laser line from the ship to the target. */
  private zap(t: Threat) {
    sfx('shoot');
    const s = sim!.ship;
    const g = this.laser.clear().setAlpha(1);
    g.lineStyle(12, 0xff3355, 1).lineBetween(s.x, s.y, t.x, t.y);
    g.lineStyle(4, 0xffffff, 1).lineBetween(s.x, s.y, t.x, t.y);
    this.tweens.add({ targets: g, alpha: 0, duration: 250 });
    const img = this.threatSprites.get(t.id);
    if (img) this.tweens.add({ targets: img, alpha: 0.3, duration: 80, yoyo: true });
  }

  /** POKS! A zapped threat bursts into sparkles. */
  private pop(t: Threat) {
    sfx(t.kind === 'mohko' ? 'win' : 'bounce');
    LC.slice(0, 4).forEach((c, i) => {
      const bits = this.add.particles(t.x, t.y, circleTexture(this, `konfetti-${i}`, 7, c), {
        speed: { min: 100, max: 350 }, lifespan: 700, scale: { start: 1, end: 0 }, emitting: false,
      }).setDepth(6);
      bits.explode(t.kind === 'mohko' ? 30 : 10);
      this.time.delayedCall(900, () => bits.destroy());
    });
    const word = label(this, t.x, t.y, t.kind === 'mohko' ? 'MÖHKÖTTÄJÄ KARKASI!' : 'POKS!', t.kind === 'mohko' ? 60 : 50, '#ffffff').setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: word, y: t.y - 80, alpha: 0, duration: 900, onComplete: () => word.destroy() });
  }

  /** Something hit the ship: shake, or TÖKS if the shields held. */
  private hit(kind: ThreatKind, blocked: boolean) {
    if (blocked) {
      sfx('bounce', { pitch: 0.6 });
      this.banner('TÖKS! KILVET PITIVÄT!', config.lcars[6]);
      return;
    }
    sfx('hit');
    this.cameras.main.shake(300, 0.012);
    if (kind === 'piirakka') {
      this.banner('PLÖRTS! 🥧', '#ffcc99');
      this.splat();
    } else {
      this.banner('KOLINAA! JOTAIN HAJOSI!', '#ff5c5c');
    }
  }

  /** A pie sticks to the viewscreen and slowly slides down. */
  private splat() {
    const x = VS.x + 150 + Math.random() * (VS.w - 300);
    const y = VS.y + 100 + Math.random() * (VS.h - 250);
    const pie = this.add.image(x, y, 'piirakka').setDisplaySize(260, 260).setScrollFactor(0).setDepth(UI - 1).setAngle(Math.random() * 360);
    this.tweens.add({ targets: pie, y: y + 120, alpha: 0, duration: 3500, ease: 'Quad.in', onComplete: () => pie.destroy() });
  }

  private pirateNews(arrived: boolean) {
    if (arrived) { sfx('roar'); this.banner(`${config.danger.pirate.name} hyökkää! ${config.danger.pirate.emoji}`, '#7cff6b'); }
    else this.banner(`${config.danger.pirate.name} kyllästyi ja lähti`, '#7cff6b');
  }

  // ---------------------------------------------------------------------------
  // Tiede: hidden secrets, scan pulse, fog. Kapteeni: red alert
  // ---------------------------------------------------------------------------

  private makeSecrets() {
    this.secretSprites = config.secrets.map((sec, i) => {
      const look = config.secretLooks[sec.kind];
      const img = this.add.image(sec.x, sec.y, emojiTexture(this, `salaisuus-${sec.kind}`, look.emoji, 128))
        .setDisplaySize(look.size, look.size).setDepth(2).setVisible(false);
      if (sec.kind === 'madonreika') this.tweens.add({ targets: img, angle: 360, duration: 3000, repeat: -1 });
      else this.tweens.add({ targets: img, scale: img.scale * 1.15, duration: 600, yoyo: true, repeat: -1 });
      img.setName(String(i));
      return img;
    });
  }

  /** Found secrets are visible, hidden and used ones are not. */
  private drawSecrets() {
    const s = sim!.ship;
    this.secretSprites.forEach((img, i) => img.setVisible(s.secrets[i] === 1));
  }

  /** A ring flies out from the ship; found things pop into view. */
  private scanPulse(found: number[]) {
    sfx('powerup', { pitch: 1.5 });
    const s = sim!.ship;
    const ring = this.add.circle(s.x, s.y, 50).setStrokeStyle(10, LC[6], 0.9).setDepth(8);
    this.tweens.add({
      targets: ring, radius: config.science.scanRadius, alpha: 0, duration: 1200, ease: 'Quad.out', onComplete: () => ring.destroy(),
    });
    for (const i of found) {
      const look = config.secretLooks[config.secrets[i].kind];
      const img = this.secretSprites[i].setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 800, delay: 400 });
      this.time.delayedCall(500, () => this.banner(`Löytyi: ${look.name} ${look.emoji}`, config.lcars[6]));
    }
    if (!found.length && sim!.ship.fogClear > 0) this.banner('Sumu hälvenee!', config.lcars[6]);
  }

  private wormhole(i: number) {
    sfx('powerup', { pitch: 0.5 });
    this.cameras.main.flash(600, 180, 140, 255);
    this.cameras.main.shake(500, 0.02);
    this.banner('WHOOOSH! MADONREIKÄ! 🌀', '#b48cff');
    this.secretSprites[i].setVisible(false);
  }

  private crystal(i: number) {
    sfx('coin', { pitch: 2 });
    const sec = config.secrets[i];
    const word = label(this, sec.x, sec.y, '+1 💎', 60, '#3dffd2').setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: word, y: sec.y - 120, alpha: 0, duration: 1000, onComplete: () => word.destroy() });
  }

  /** Cheesy yellow fog over the viewscreen, and the red alert glow. */
  private makeFogAndAlert() {
    this.fog = this.add.container(0, 0).setScrollFactor(0).setDepth(UI - 2).setAlpha(0);
    this.fog.add(this.add.rectangle(VS.x, VS.y, VS.w, VS.h, 0xfff1b8, 0.88).setOrigin(0));
    for (let i = 0; i < 9; i++) {
      const cloud = this.add.image(VS.x + Math.random() * VS.w, VS.y + 80 + Math.random() * (VS.h - 120),
        emojiTexture(this, i % 3 ? 'pilvi' : 'juusto', i % 3 ? '☁️' : '🧀', 128)).setAlpha(0.7).setDisplaySize(180, 180);
      this.tweens.add({ targets: cloud, x: cloud.x + 120, duration: 4000 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.fog.add(cloud);
    }
    this.fog.add(label(this, VS.x + VS.w / 2, VS.y + VS.h / 2, 'SUMUA! TIEDE, SKANNAA!', 52, '#996600').setOrigin(0.5));
    this.alertGlow = this.add.rectangle(VS.x, VS.y, VS.w, VS.h, 0xff0000, 0).setOrigin(0)
      .setStrokeStyle(16, 0xff0000).setScrollFactor(0).setDepth(UI - 1).setVisible(false);
    this.alertText = label(this, 925, 684, 'PUNAINEN HÄLYTYS', 26).setScrollFactor(0).setDepth(FRAME + 1)
      .setBackgroundColor('#ff3333').setVisible(false);
  }

  private drawFogAndAlert(dt: number) {
    const s = sim!.ship;
    const goal = s.fog && sim!.phase === 'matka' ? 1 : 0;
    this.fog.setAlpha(this.fog.alpha + (goal - this.fog.alpha) * Math.min(1, dt * 2));
    const alert = s.alert > 0 && sim!.phase === 'matka';
    const blink = Math.sin(this.time.now / 120) > 0;
    this.alertGlow.setVisible(alert).setFillStyle(0xff0000, blink ? 0.15 : 0.03);
    this.alertText.setVisible(alert && blink);
    if (alert) {
      // Siren: high – low – high – low
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.45;
        sfx('bounce', { pitch: blink ? 2 : 1.4, volume: 0.6 });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Things on top of the viewscreen: target line, mini map, banners
  // ---------------------------------------------------------------------------

  private makeOverlay() {
    this.targetText = label(this, VS.x + 60, VS.y + 14, '', 26, config.lcars[0]).setScrollFactor(0).setDepth(UI);
    this.statusText = label(this, VS.x + 60, VS.y + 46, '', 22, config.lcars[2]).setScrollFactor(0).setDepth(UI);
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
    config.route.forEach((_, i) => {
      const w = place(s, i);
      const next = config.route[i + 1] && place(s, i + 1);
      if (next) g.lineBetween(px(w.x), py(w.y), px(next.x), py(next.y));
      g.fillStyle(i < s.target ? 0x7cff6b : i === s.target ? LC[0] : 0x888888, 1);
      g.fillCircle(px(w.x), py(w.y), 5);
    });
    config.secrets.forEach((sec, i) => {
      if (s.secrets[i] !== 1) return;
      g.fillStyle(sec.kind === 'madonreika' ? 0xb48cff : 0x3dffd2, 1);
      g.fillCircle(px(sec.x), py(sec.y), 3);
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
    const w = place(sim!.ship, i);
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
    this.finishTime.setText(`MATKA-AIKA ${minutes}:${seconds} · 💎 ${s.stars} KRISTALLIA · TÄHTIPÄIVÄ ${stardate(s.time)}`);
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
    this.statusText.setVisible(phase === 'matka');
    if (phase === 'matka') { sfx('jump'); this.banner('Tehkää niin!'); }
    if (phase === 'perilla') this.party();
  }
}
