// 🎮 LUMISOTA – a top-down snowball fight made with Phaser 4.2.1 (Arcade physics).
// Numbers and emoji live in config.ts, the arena maps in levels.ts.
// See README.md for which function does what.

import Phaser from 'phaser';
import { startPhaserGame, emojiTexture, circleTexture } from '@kit/phaser';
import { input, type PlayerNumber } from '@kit/input';
import { sfx } from '@kit/sound';
import { themes } from '@kit/themes';
import { dev } from '@kit/dev';
import { storage } from '@kit/storage';
import { config, type EnemyDef, type PlayerDef, type TileDef } from './config';
import { levels } from './levels';

const T = 40; // tile size in pixels
const W = 960;
const H = 540;
const TEX = 96; // emoji texture size; the canvas is 1.2 × this
const theme = themes[config.theme] ?? themes.talvi;
const FONT = '"Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif';
const HUD = 1000; // depth of the score line and banners
const color = (hex: string) => parseInt(hex.replace('#', ''), 16);

// ---------------------------------------------------------------------------
// State that survives a restart of the arena
// ---------------------------------------------------------------------------

let levelIndex = Math.min(dev.recall('lumisota-level', 0), levels.length - 1);
let score = dev.recall('lumisota-score', 0);
let lives = config.lives;
let hits: [number, number] = [0, 0]; // 'vastakkain': hits by player 1 and player 2
let showTitle = true;
let godMode = false;

type Sprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

interface Player {
  n: PlayerNumber;
  def: PlayerDef;
  sprite: Sprite;
  active: boolean;
  /** The way the player last moved: snowballs fly this way. */
  aimX: number;
  aimY: number;
  reload: number;
  powerTime: number;
  safeTime: number;
  startX: number;
  startY: number;
}

interface Enemy {
  sprite: Sprite;
  def: EnemyDef;
  hp: number;
  boss: boolean;
  dirX: number;
  dirY: number;
  thinkTimer: number;
  throwTimer: number;
  hitTime: number;
}

// ---------------------------------------------------------------------------
// The arena scene
// ---------------------------------------------------------------------------

class Areena extends Phaser.Scene {
  players: Player[] = [];
  enemies: Enemy[] = [];
  walls!: Phaser.Physics.Arcade.StaticGroup;
  balls!: Phaser.Physics.Arcade.Group;
  powerUps!: Phaser.Physics.Arcade.StaticGroup;
  spawnPoints: { x: number; y: number }[] = [];
  map: string[] = [];
  top = 0; // y of the arena's top edge
  puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  hudLeft!: Phaser.GameObjects.Text;
  hudMid!: Phaser.GameObjects.Text;
  hudRight!: Phaser.GameObjects.Text;
  bannerText!: Phaser.GameObjects.Text;
  bannerSub!: Phaser.GameObjects.Text;
  bossBar!: Phaser.GameObjects.Graphics;
  mode: 'yhdessä' | 'vastakkain' = 'yhdessä';
  wave = 0;
  toSpawn = 0;
  spawnTimer = 0;
  waveBreak = 0;
  bossSpawned = false;
  arenaDone = 0;   // > 0 while celebrating a finished arena
  finished = false; // game won, game over or a 'vastakkain' round won

  constructor() {
    super('areena');
  }

  create() {
    this.players = [];
    this.enemies = [];
    this.spawnPoints = [];
    this.wave = 0;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.waveBreak = 1.5;
    this.bossSpawned = false;
    this.arenaDone = 0;
    this.finished = false;
    this.mode = input.singlePlayer ? 'yhdessä' : config.mode; // one player can't fight themself
    dev.keep('lumisota-level', levelIndex);

    this.makeTextures();
    this.walls = this.physics.add.staticGroup();
    this.powerUps = this.physics.add.staticGroup();
    this.balls = this.physics.add.group();
    this.buildArena();

    // Gently falling snow, and the puff used for every hit
    this.add.particles(0, -10, 'hiutale', {
      x: { min: 0, max: W }, lifespan: 9000, speedY: { min: 20, max: 45 }, speedX: { min: -12, max: 12 },
      scale: { min: 0.3, max: 0.8 }, alpha: 0.7, frequency: 160,
    }).setDepth(HUD - 1);
    this.puff = this.add.particles(0, 0, 'hiutale', {
      speed: { min: 60, max: 220 }, lifespan: 450, scale: { start: 1.2, end: 0 }, emitting: false,
    }).setDepth(HUD - 2);

    this.addColliders();
    this.makeHud();
    if (showTitle && levelIndex === 0) {
      const help = input.singlePlayer
        ? 'Liiku: W A S D tai nuolet  ·  Heitä: F tai Enter'
        : 'Pelaaja 1: W A S D + F heittää  ·  Pelaaja 2: nuolet + Enter heittää';
      this.banner(config.title + ' ❄️', help, 3000);
      showTitle = false;
    }
  }

  // ---- Setup ---------------------------------------------------------------

  makeTextures() {
    emojiTexture(this, 'p1-' + config.player1.emoji, config.player1.emoji, TEX);
    emojiTexture(this, 'p2-' + config.player2.emoji, config.player2.emoji, TEX);
    emojiTexture(this, 'enemy-' + config.enemy.emoji, config.enemy.emoji, TEX);
    if (config.boss) emojiTexture(this, 'boss-' + config.boss.emoji, config.boss.emoji, TEX);
    emojiTexture(this, 'power-' + config.powerUp.emoji, config.powerUp.emoji, TEX);
    for (const t of Object.values(config.tiles)) {
      if (t.look !== 'wall' && t.look !== 'ice') emojiTexture(this, 'tile-' + t.look, t.look, TEX);
    }
    circleTexture(this, 'pallo', config.snowball.radius, 0xffffff);
    circleTexture(this, 'hiutale', 3, 0xffffff);
  }

  tileAt(x: number, y: number): TileDef | null {
    const c = Math.floor(x / T), r = Math.floor((y - this.top) / T);
    return config.tiles[this.map[r]?.[c] ?? ' '] ?? null;
  }

  /** Reads the arena map: walls, ice, start points, snowman doors, power-ups. */
  buildArena() {
    const lines = levels[levelIndex].split('\n');
    while (lines.length && lines[0].trim() === '') lines.shift();
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    this.map = lines;
    this.top = H - lines.length * T; // room for the score line above the arena

    // Snowy floor with a few sparkles
    this.add.rectangle(0, 0, W, H, color(theme.wall)).setOrigin(0).setDepth(-20);
    this.add.rectangle(0, this.top, W, lines.length * T, color(theme.floor)).setOrigin(0).setDepth(-19);
    for (let i = 0; i < 80; i++) {
      this.add.circle((i * 397) % W, this.top + ((i * 211) % (lines.length * T)), 2, 0xffffff, 0.8).setDepth(-18);
    }

    lines.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        const x = c * T + T / 2, y = this.top + r * T + T / 2;
        const tile = config.tiles[ch];
        if (tile?.look === 'wall') {
          // A snowbank: the theme's wall colour with a white top
          const block = this.add.rectangle(x, y, T, T, color(theme.wall)).setDepth(y);
          const above = config.tiles[lines[r - 1]?.[c] ?? ' '];
          if (above?.look !== 'wall') this.add.rectangle(x, y - T / 2 + 6, T, 12, 0xffffff, 0.9).setDepth(y + 0.1);
          this.walls.add(block);
        } else if (tile?.look === 'ice') {
          this.add.rectangle(x, y, T, T, 0xbfe6ff).setDepth(-17);
          this.add.line(0, 0, x - 12, y + 8, x + 4, y - 8, 0xffffff, 0.9).setOrigin(0).setDepth(-16);
        } else if (tile) {
          const img = this.walls.create(x, y, 'tile-' + tile.look) as Phaser.Physics.Arcade.Sprite;
          img.setDisplaySize(T * 1.2, T * 1.2).setDepth(y);
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(T * 0.8, T * 0.8);
          img.refreshBody();
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(T * 0.8, T * 0.8, true);
        } else if (ch === '1' || ch === '2') {
          this.addPlayer(Number(ch) as PlayerNumber, x, y);
        } else if (ch === 'S') {
          this.spawnPoints.push({ x, y });
        } else if (ch === '*') {
          const pu = this.powerUps.create(x, y, 'power-' + config.powerUp.emoji) as Phaser.Physics.Arcade.Sprite;
          pu.setDisplaySize(T, T).refreshBody().setDepth(y);
          this.tweens.add({ targets: pu, scale: pu.scale * 1.15, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
        } else if (ch !== ' ' && ch !== '.') {
          console.warn(`Unknown letter "${ch}" in the arena map – treated as empty.`);
        }
      }
    });
    if (this.spawnPoints.length === 0) this.spawnPoints.push({ x: W / 2, y: this.top + T * 1.5 });
    if (!this.players.find((p) => p.n === 1)) this.addPlayer(1, W / 2, H / 2);
    if (!this.players.find((p) => p.n === 2)) this.addPlayer(2, this.players[0].startX, this.players[0].startY);
  }

  addPlayer(n: PlayerNumber, x: number, y: number) {
    const def = n === 1 ? config.player1 : config.player2;
    const sprite = this.physics.add.sprite(x, y, `p${n}-${def.emoji}`) as Sprite;
    fitBody(sprite, def.size, 0.55);
    sprite.setCollideWorldBounds(true);
    const p: Player = {
      n, def, sprite, active: n === 1, aimX: n === 1 ? 1 : -1, aimY: 0,
      reload: 0, powerTime: 0, safeTime: 0, startX: x, startY: y,
    };
    sprite.setFlipX(p.aimX < 0);
    // Player 2 joins by pressing a key; in 'vastakkain' they are there from the start.
    if (n === 2 && (input.singlePlayer || this.mode !== 'vastakkain')) this.setActive(p, false);
    this.players.push(p);
  }

  setActive(p: Player, on: boolean) {
    p.active = on;
    p.sprite.setVisible(on);
    p.sprite.body.enable = on;
  }

  addColliders() {
    for (const p of this.players) {
      this.physics.add.collider(p.sprite, this.walls);
      this.physics.add.overlap(p.sprite, this.powerUps, (_a, pu) => this.takePowerUp(p, pu as Phaser.Physics.Arcade.Sprite));
      this.physics.add.overlap(p.sprite, this.balls, (_a, b) => this.ballHitsPlayer(p, b as Sprite));
    }
    if (this.mode === 'vastakkain') this.physics.add.collider(this.players[0].sprite, this.players[1].sprite);
    this.physics.add.collider(this.balls, this.walls, (b) => this.splat(b as Sprite));
  }

  makeHud() {
    const style = { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 };
    this.hudLeft = this.add.text(16, 14, '', style).setDepth(HUD);
    this.hudMid = this.add.text(W / 2, 14, '', style).setOrigin(0.5, 0).setDepth(HUD);
    this.hudRight = this.add.text(W - 16, 14, '', style).setOrigin(1, 0).setDepth(HUD);
    this.bossBar = this.add.graphics().setDepth(HUD);
    this.bannerText = this.add.text(W / 2, H / 2 - 30, '', { ...style, fontSize: '56px', strokeThickness: 8 })
      .setOrigin(0.5).setDepth(HUD + 1).setAlpha(0);
    this.bannerSub = this.add.text(W / 2, H / 2 + 34, '', { ...style, fontSize: '22px', color: '#ffe9a8' })
      .setOrigin(0.5).setDepth(HUD + 1).setAlpha(0);
  }

  /** A big message in the middle of the screen. ms = how long it stays (0 = until changed). */
  banner(title: string, subtitle = '', ms = 2000) {
    this.tweens.killTweensOf([this.bannerText, this.bannerSub]);
    this.bannerText.setText(title).setAlpha(1);
    this.bannerSub.setText(subtitle).setAlpha(1);
    if (ms > 0) this.tweens.add({ targets: [this.bannerText, this.bannerSub], alpha: 0, delay: ms - 500, duration: 500 });
  }

  // ---- The main update, every frame ------------------------------------------

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05);

    // Adult keys: Shift+N next arena, Shift+G can't get hurt, Shift+R restart arena
    if (input.keyPressed('KeyN', { shift: true })) { levelIndex = (levelIndex + 1) % levels.length; this.scene.restart(); return; }
    if (input.keyPressed('KeyG', { shift: true })) godMode = !godMode;
    if (input.keyPressed('KeyR', { shift: true })) { restartLevel(); return; }
    if (this.mode === 'vastakkain' && input.singlePlayer) { this.scene.restart(); return; }

    if (this.finished) {
      if (input.player(1).actionPressed || input.player(2).actionPressed) restartGame();
      return;
    }

    for (const p of this.players) this.updatePlayer(p, dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => e.sprite.active);
    this.updateBalls(dt);
    if (this.mode === 'yhdessä') this.updateWaves(dt);
    this.drawHud();
  }

  // ---- Players ---------------------------------------------------------------

  updatePlayer(p: Player, dt: number) {
    const inp = input.player(p.n);
    if (!p.active) {
      if (p.n === 2 && !input.singlePlayer && (inp.actionPressed || inp.x !== 0 || inp.y !== 0)) {
        const other = this.players[0].sprite;
        this.setActive(p, true);
        p.sprite.setPosition(other.x, other.y);
        p.safeTime = 1;
        sfx('powerup');
      }
      return;
    }
    if (p.n === 2 && input.singlePlayer) { this.setActive(p, false); return; }

    // Moving in 8 directions, sliding on ice
    const body = p.sprite.body;
    let ix = inp.x, iy = inp.y;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const speed = p.def.speed * T;
    const onIce = this.tileAt(p.sprite.x, p.sprite.y)?.kind === 'ice';
    const step = (onIce ? 5 : 50) * T * dt;
    body.setVelocity(
      Phaser.Math.Clamp(ix * speed, body.velocity.x - step, body.velocity.x + step),
      Phaser.Math.Clamp(iy * speed, body.velocity.y - step, body.velocity.y + step),
    );
    if (len > 0) {
      p.aimX = ix / Math.min(1, len) || 0;
      p.aimY = iy / Math.min(1, len) || 0;
      if (ix !== 0) p.sprite.setFlipX(ix < 0);
    }
    // A little waddle while walking
    p.sprite.setRotation(len > 0 ? Math.sin(this.time.now / 70) * 0.12 : 0);
    p.sprite.setDepth(p.sprite.y);

    // Throwing snowballs
    p.reload -= dt;
    p.powerTime -= dt;
    const fast = p.powerTime > 0;
    if ((inp.actionPressed || (fast && inp.action)) && p.reload <= 0) {
      p.reload = fast ? config.powerUp.reload : config.snowball.reload;
      this.throwBall(p.sprite.x, p.sprite.y, p.aimX, p.aimY, p.n);
      this.squash(p.sprite);
    }

    // Blinking while safe after a hit
    p.safeTime = Math.max(0, p.safeTime - dt);
    p.sprite.setAlpha(p.safeTime > 0 && Math.floor(p.safeTime * 12) % 2 === 0 ? 0.3 : 1);
  }

  /** Throw a snowball from (x, y) towards (dx, dy). owner: 1 or 2 = a player, 0 = an enemy. */
  throwBall(x: number, y: number, dx: number, dy: number, owner: number) {
    const s = config.snowball;
    const len = Math.hypot(dx, dy) || 1;
    const b = this.balls.create(x + (dx / len) * 16, y + (dy / len) * 16, 'pallo') as Sprite;
    b.body.setCircle(s.radius);
    b.body.setVelocity((dx / len) * s.speed * T, (dy / len) * s.speed * T);
    b.setData('owner', owner).setData('life', s.range / s.speed).setDepth(HUD - 3);
    if (owner === 0) b.setTint(0x9fdcff); // enemy snowballs are icy blue
    sfx('shoot', { pitch: owner === 0 ? 0.8 : 1.3, volume: 0.5 });
  }

  updateBalls(dt: number) {
    for (const b of this.balls.getChildren() as Sprite[]) {
      const life = (b.getData('life') as number) - dt;
      b.setData('life', life);
      if (life <= 0) this.splat(b);
    }
  }

  /** A snowball lands or hits a wall: puff! */
  splat(b: Sprite) {
    if (!b.active) return;
    this.puff.explode(6, b.x, b.y);
    b.destroy();
  }

  ballHitsPlayer(p: Player, b: Sprite) {
    const owner = b.getData('owner') as number;
    if (!b.active || !p.active || owner === p.n) return;
    if (owner !== 0 && this.mode !== 'vastakkain') return; // team mates don't hit each other
    const vx = b.body.velocity.x, vy = b.body.velocity.y;
    this.splat(b);
    if (owner === 0) { this.hurtPlayer(p, p.sprite.x - vx, p.sprite.y - vy); return; }
    if (p.safeTime > 0) return;
    hits[owner - 1]++;
    p.safeTime = 0.6;
    this.push(p.sprite, vx, vy, config.snowball.push);
    this.cameras.main.shake(120, 0.006);
    sfx('hit', { pitch: 1.2 });
    if (hits[owner - 1] >= config.winHits) {
      const winner = owner === 1 ? config.player1.emoji : config.player2.emoji;
      this.finished = true;
      this.banner(`${winner} voitti! 🏆`, `${hits[0]} – ${hits[1]} · Paina heittoa: uusi erä`, 0);
      sfx('win');
      this.cameras.main.flash(300, 255, 255, 255);
    }
  }

  takePowerUp(p: Player, pu: Phaser.Physics.Arcade.Sprite) {
    if (!pu.active || !p.active) return;
    pu.destroy();
    p.powerTime = config.powerUp.seconds;
    this.puff.explode(16, pu.x, pu.y);
    this.cameras.main.flash(150, 255, 255, 255);
    sfx('powerup');
  }

  /** A snowman or an icy snowball got the player. (fromX, fromY) is where it came from. */
  hurtPlayer(p: Player, fromX: number, fromY: number) {
    if (p.safeTime > 0 || godMode || this.arenaDone > 0) return;
    sfx('hit');
    this.cameras.main.shake(200, 0.01);
    this.puff.explode(14, p.sprite.x, p.sprite.y);
    this.push(p.sprite, p.sprite.x - fromX, p.sprite.y - fromY, config.snowball.push);
    p.safeTime = config.safeTime;
    if (config.lives > 0) {
      lives--;
      if (lives <= 0) {
        this.finished = true;
        this.banner('Peli loppui', 'Paina heittoa yrittääksesi uudelleen', 0);
        sfx('lose');
      }
    }
  }

  /** Push a sprite in direction (dx, dy) with a speed in tiles per second. */
  push(s: Sprite, dx: number, dy: number, tilesPerSecond: number) {
    const len = Math.hypot(dx, dy) || 1;
    s.body.setVelocity((dx / len) * tilesPerSecond * T, (dy / len) * tilesPerSecond * T);
  }

  squash(s: Sprite) {
    const bx = s.getData('baseScaleX') as number, by = s.getData('baseScaleY') as number;
    this.tweens.add({ targets: s, scaleX: bx * 1.2, scaleY: by * 0.85, duration: 70, yoyo: true, onComplete: () => s.setScale(bx, by) });
  }

  // ---- Snowmen ---------------------------------------------------------------

  updateWaves(dt: number) {
    if (this.arenaDone > 0) {
      this.arenaDone -= dt;
      if (this.arenaDone <= 0) this.nextArena();
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = config.spawnEvery;
        this.toSpawn--;
        this.spawnEnemy(config.enemy, false);
      }
      return;
    }
    if (this.enemies.length > 0) return;
    // Everyone melted: next wave, the boss, or the arena is won
    this.waveBreak -= dt;
    if (this.waveBreak > 0) return;
    this.waveBreak = 2;
    if (this.wave < config.waves) {
      this.wave++;
      this.toSpawn = config.firstWave + (this.wave - 1) * config.moreEachWave;
      this.banner(`Aalto ${this.wave}! ☃️`, '', 1500);
    } else if (config.boss && !this.bossSpawned) {
      this.bossSpawned = true;
      this.spawnEnemy(config.boss, true);
      this.banner('Pomo tulee! 😱', '', 1500);
      sfx('roar');
    } else {
      this.arenaDone = 2.5;
      this.banner('Areena voitettu! 🎉', '', 2500);
      sfx('win');
      this.cameras.main.flash(300, 255, 255, 255);
      dev.keep('lumisota-score', score);
    }
  }

  nextArena() {
    if (levelIndex + 1 < levels.length) {
      levelIndex++;
      this.scene.restart();
    } else {
      this.finished = true;
      const best = storage.highScore(score, 'lumisota-best');
      this.banner('Voitit pelin! 🏆', `Pisteet: ${score} · Ennätys: ${best} · Paina heittoa`, 0);
    }
  }

  spawnEnemy(def: EnemyDef, boss: boolean) {
    const at = Phaser.Utils.Array.GetRandom(this.spawnPoints);
    const s = this.physics.add.sprite(at.x, at.y, (boss ? 'boss-' : 'enemy-') + def.emoji) as Sprite;
    fitBody(s, def.size, 0.6);
    s.setCollideWorldBounds(true);
    const e: Enemy = {
      sprite: s, def, hp: def.hp, boss, dirX: 0, dirY: 0, thinkTimer: 0,
      throwTimer: def.throwsEvery, hitTime: 0,
    };
    this.physics.add.collider(s, this.walls);
    this.physics.add.overlap(s, this.balls, (_a, b) => this.ballHitsEnemy(e, b as Sprite));
    for (const p of this.players) this.physics.add.overlap(p.sprite, s, () => this.hurtPlayer(p, s.x, s.y));
    const bx = s.getData('baseScaleX'), by = s.getData('baseScaleY');
    s.setScale(0);
    this.tweens.add({ targets: s, scaleX: bx, scaleY: by, duration: 250, ease: 'Back.out' });
    this.enemies.push(e);
  }

  updateEnemy(e: Enemy, dt: number) {
    const s = e.sprite;
    if (!s.active) return;
    const body = s.body;
    s.setDepth(s.y);
    e.hitTime = Math.max(0, e.hitTime - dt);
    if (e.hitTime > 0) return; // pushed back after a hit
    const target = nearest(this.players.filter((p) => p.active).map((p) => p.sprite), s);

    // Every now and then, head towards the nearest player (a bit wobbly)
    e.thinkTimer -= dt;
    const stuck = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down;
    if (stuck && e.thinkTimer > 0.4) {
      // Bumped into a wall: walk sideways for a moment
      [e.dirX, e.dirY] = Math.random() < 0.5 ? [-e.dirY, e.dirX] : [e.dirY, -e.dirX];
      e.thinkTimer = 0.4;
    } else if (e.thinkTimer <= 0 && target) {
      e.thinkTimer = 0.7 + Math.random() * 0.7;
      const a = Math.atan2(target.y - s.y, target.x - s.x) + (Math.random() - 0.5) * 0.8;
      e.dirX = Math.cos(a);
      e.dirY = Math.sin(a);
    }
    body.setVelocity(e.dirX * e.def.speed * T, e.dirY * e.def.speed * T);
    if (e.dirX !== 0) s.setFlipX(e.dirX > 0);
    s.setRotation(Math.sin(this.time.now / 120 + s.x) * 0.08);

    // Some enemies (the boss) throw snowballs back
    if (e.def.throwsEvery > 0 && target) {
      e.throwTimer -= dt;
      if (e.throwTimer <= 0) {
        e.throwTimer = e.def.throwsEvery;
        this.throwBall(s.x, s.y, target.x - s.x, target.y - s.y, 0);
      }
    }
  }

  ballHitsEnemy(e: Enemy, b: Sprite) {
    if (!b.active || !e.sprite.active || b.getData('owner') === 0) return;
    const vx = b.body.velocity.x, vy = b.body.velocity.y;
    this.splat(b);
    e.hp--;
    e.hitTime = 0.25;
    e.sprite.setTint(0x99ddff);
    this.time.delayedCall(120, () => e.sprite.active && e.sprite.clearTint());
    this.push(e.sprite, vx, vy, config.snowball.push * (e.boss ? 0.3 : 1));
    if (e.hp > 0) { sfx('hit', { pitch: 1.6, volume: 0.5 }); return; }
    // Melted!
    score += e.def.score;
    this.puff.explode(e.boss ? 60 : 20, e.sprite.x, e.sprite.y);
    this.cameras.main.shake(e.boss ? 400 : 100, e.boss ? 0.015 : 0.004);
    sfx(e.boss ? 'boom' : 'bounce');
    e.sprite.destroy();
    dev.keep('lumisota-score', score);
  }

  // ---- Score line ------------------------------------------------------------

  drawHud() {
    this.bossBar.clear();
    if (this.mode === 'vastakkain') {
      this.hudLeft.setText(`${config.player1.emoji} ${hits[0]}`);
      this.hudMid.setText(`${config.winHits} osumaa voittaa`);
      this.hudRight.setText(`${hits[1]} ${config.player2.emoji}`);
      return;
    }
    const hearts = config.lives > 0 ? '   ' + '❤️'.repeat(Math.max(0, lives)) : '';
    this.hudLeft.setText(`⭐ ${score}${hearts}${godMode ? '   GOD' : ''}`);
    this.hudMid.setText(`Areena ${levelIndex + 1}/${levels.length} · Aalto ${Math.max(1, this.wave)}/${config.waves}`);
    const left = this.toSpawn + this.enemies.filter((e) => !e.boss).length;
    const p2 = this.players[1];
    this.hudRight.setText(left > 0 ? `${config.enemy.emoji} ${left}` : p2.active || input.singlePlayer ? '' : 'Pelaaja 2: paina nuolta');
    const boss = this.enemies.find((e) => e.boss);
    if (boss) {
      this.bossBar.fillStyle(0x000000, 0.6).fillRect(W / 2 - 152, 44, 304, 12);
      this.bossBar.fillStyle(0xff4d4d, 1).fillRect(W / 2 - 150, 46, 300 * (boss.hp / boss.def.hp), 8);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Size an emoji sprite to `size` tiles and give it a round-ish hitbox (a fraction of the emoji). */
function fitBody(s: Sprite, size: number, frac: number) {
  s.setDisplaySize(size * T * 1.2, size * T * 1.2);
  s.setData('baseScaleX', s.scaleX).setData('baseScaleY', s.scaleY);
  const src = s.width; // texture size (1.2 × TEX)
  const box = TEX * frac;
  s.body.setSize(box, box, false);
  s.body.setOffset((src - box) / 2, (src - box) / 2 + TEX * 0.08);
}

function nearest(list: Phaser.GameObjects.Sprite[], from: Phaser.GameObjects.Sprite) {
  let best: Phaser.GameObjects.Sprite | null = null, bestD = Infinity;
  for (const s of list) {
    const d = Phaser.Math.Distance.Between(s.x, s.y, from.x, from.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/** ⚙️ "Aloita alusta": first arena, score 0, everyone at the start. */
function restartGame() {
  levelIndex = 0;
  score = 0;
  lives = config.lives;
  hits = [0, 0];
  godMode = false;
  showTitle = true;
  dev.keep('lumisota-score', 0);
  game.scene.getScene('areena')?.scene.restart();
}

/** ⚙️ "Tämä taso alusta": this arena from the start. */
function restartLevel() {
  hits = [0, 0];
  game.scene.getScene('areena')?.scene.restart();
}

// ---------------------------------------------------------------------------

const game = startPhaserGame(
  {
    width: W,
    height: H,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } }, // top-down: no gravity
    scene: [Areena],
  },
  { restartGame, restartLevel, players: config.players },
);
