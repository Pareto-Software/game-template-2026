# lumisota – map for the agent

A top-down snowball fight for one or two players, made with **Phaser 4.2.1**
(Arcade physics, no gravity). In `'yhdessä'` the players melt waves of snowmen
and a boss together; in `'vastakkain'` they throw at each other.
Everything in this game lives in these files; don't create new files.

| File | What is in it |
| --- | --- |
| `config.ts` | Every number, emoji, mode, enemy, boss and map tile. **Start here.** |
| `levels.ts` | The arena maps (letters, max 24 × 12) and the legend. |
| `main.ts` | The `Areena` Phaser scene, in small methods (below). |
| `meta.json` | Title, emoji, description and controls shown on the gallery page. |

## Request → where to change it

| Kids ask for … | Change |
| --- | --- |
| Different hero | `config.player1.emoji` / `player2.emoji` |
| Faster / slower | `player1.speed`, `enemy.speed` |
| Fight each other | `config.mode = 'vastakkain'` (first to `winHits` wins) |
| One player only ("yksinpeli") | `config.players: 1` – any keys control player 1 (the ⚙️ menu can switch it too) |
| Bigger / faster / further snowballs | `config.snowball.radius`, `.speed`, `.range`, `.reload` |
| Different enemy (zombies, robots) | `config.enemy.emoji`, `.hp`, `.speed`; enemies that throw back: `throwsEvery: 2` |
| Bigger or no boss | `config.boss` (`hp`, `size`, `throwsEvery`), or `boss: null` |
| More or harder waves | `config.waves`, `firstWave`, `moreEachWave`, `spawnEvery` |
| New walls, trees, ice | add a letter to `config.tiles` (`kind: 'wall'` or `'ice'`, `look`: `'wall'`, `'ice'` or an emoji), then use it in `levels.ts` |
| Where snowmen come from | letter `S` in `levels.ts` |
| Power-up | letter `*` in `levels.ts`; what it does: `config.powerUp` |
| Lives and game over | `config.lives` (0 = unlimited) |
| Colours | `config.theme`: perus, talvi, avaruus, viidakko, laava, meri |
| Sounds | `sfx('name')` from `@kit/sound`; names: jump coin hit powerup win lose boom click shoot bounce roar fart |
| New behaviour | methods of `Areena` in `main.ts` (below) |

## main.ts – the `Areena` scene

- `create` – builds everything; `scene.restart()` starts the arena again
- `makeTextures` – emoji → Phaser textures (`emojiTexture`), snowball and snowflake circles
- `buildArena` – reads the map: walls (static bodies), ice, start points, `S` doors, power-ups
- `addPlayer` / `updatePlayer` – 8-direction movement, sliding on ice, aiming, throwing
- `throwBall(x, y, dx, dy, owner)` – owner 1 or 2 = a player, 0 = an enemy
- `ballHitsPlayer` / `ballHitsEnemy` / `hurtPlayer` / `push` – hits, knock-back, melting
- `updateWaves` – waves, the boss, arena won → `nextArena`
- `spawnEnemy` / `updateEnemy` – snowmen walk towards the nearest player and around walls
- `drawHud` / `banner` – score line, boss health bar, big messages
- `restartGame` / `restartLevel` – used by the ⚙️ menu

## Phaser and the kit

- Use Phaser 4.2.1 APIs only: `this.physics.add.sprite`, groups, `collider`/`overlap`,
  `this.tweens`, `this.add.particles`, `this.cameras.main.shake/flash`, `this.time.delayedCall`.
- Keyboard and gamepads come from the kit, not Phaser: `input.player(1 | 2)` in `update`.
- `startPhaserGame` (`@kit/phaser`) adds "← Kaikki pelit", the ⚙️ menu (Esc), P to pause and single-player mode.

## Adult keys

⚙️ Asetukset (or Esc): start over, restart arena, one/two players, sound · Shift+N next arena · Shift+G can't get hurt · Shift+R restart arena · P pause · M mute
