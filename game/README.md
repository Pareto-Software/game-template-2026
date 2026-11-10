# simple-platformer – map for the agent

A side-scrolling platformer for one or two players. Levels are letter maps.
Everything in this game lives in four files; don't create new files.

| File | What is in it |
| --- | --- |
| `config.ts` | Every number, emoji, superpower, tile and thing. **Start here.** |
| `levels.ts` | The level maps (letters) and the legend. |
| `main.ts` | The game logic, in small functions (below). |
| `public/meta.json` | Title, emoji, description and controls shown in the gallery. |

## Request → where to change it

| Kids ask for … | Change |
| --- | --- |
| Different hero ("make the cat a dragon") | `config.player1.emoji` / `player2.emoji` (+ `facesLeft: true` for left-facing emoji) |
| Bigger / higher jump | `player1.jumpTiles` (3.3 → 5) |
| Faster | `player1.speed` |
| Double jump / flying / shooting from the start | `config.doubleJump`, `config.canFly`, `config.canShoot` |
| Floaty moon jumps | `config.gravity` smaller (45 → 20) |
| New enemy / item / boss | add a letter to `config.things`, then put the letter into `levels.ts` |
| Lava, spikes, ice, new blocks | add a letter to `config.tiles` (`hurt: true` hurts, `slippery: true` slides – see ice `I`) |
| "Make it rain candy" | `config.rain = { thing: 'c', every: 0.5 }` (any thing letter; rained things fall, then vanish after 8 s) |
| Two players fight each other | not built in: in `updateShots`, let a player's shot hurt the *other* player (add an owner to `Shot`) |
| Power-up that gives a superpower | thing with `touch: 'power', power: 'fly'` (doubleJump, fly, shoot, big, fast) |
| Enemy that shoots | thing with `shoots: { emoji: '🔥', every: 2 }` |
| Boss with a health bar | thing with `hp: 5, size: 2.4, boss: true` (see the dragon `D`) |
| New level / longer level | add or edit a string in `levels.ts` |
| Lives and game over | `config.lives` (0 = unlimited) |
| Colours, winter/space/jungle look | `config.theme`: perus, talvi, avaruus, viidakko, laava, meri |
| Sounds | `sfx('name')` in `main.ts`; names: jump coin hit powerup win lose boom click shoot bounce roar fart |
| New behaviour (e.g. teleport, ice sliding) | `main.ts`: `updatePlayer`, `updateThing` (one `case` per `moves`), `touchThing` (one `case` per `touch`) |

## main.ts functions

- `loadLevel` – reads a level map, places players and things
- `spawn(letter, x, bottom)` – adds a thing anywhere (e.g. from a timer)
- `shoot(...)` – fires a shot (player shots hurt enemies, enemy shots hurt players)
- `updatePlayer` – running, jumping (coyote time, jump buffer), flying, shooting
- `hurtPlayer` / `respawn` – players come back at the last safe spot and blink for `config.safeTime`
- `updateThing` – movement by `moves`: still, walk, hop, fly, chase, fall
- `touchThing` – what touching does by `touch`: collect, hurt, stomp, bounce, power, win
- `damageThing` – stomps and shots; a thing disappears at hp 0
- `update` – the main loop; also rain, level end and the adult keys
- `updateCamera` – follows both players; a player left far behind is brought along
- `draw*` – background, tiles, things, players, score line and banners

## Kit (read-only, import with `@kit/...`)

`loop` (startGame, hitStop) · `input` (player(1|2), keyPressed) · `sound` (sfx) ·
`sprites` (drawEmoji, roundRect, circle) · `physics` (moveBody, overlap, distance) ·
`particles` (particles.burst/confetti/dust, fx.shake/flash) · `ui` (text, hud, banner, bar) ·
`themes` · `storage` (highScore) · `dev` (keep/recall across reloads)

## Adult keys

Shift+N next level · Shift+G can't get hurt · Shift+R restart level · P pause · M mute
