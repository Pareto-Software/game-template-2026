# labyrintti – map for the agent

A top-down maze for one or two players: collect all the cheese 🧀, avoid the
critters, reach the exit 🏠. Each level fits on one screen (max 24 × 12 tiles).
Everything in this game lives in four files; don't create new files.

| File | What is in it |
| --- | --- |
| `config.ts` | Every number, emoji, power, tile and thing. **Start here.** |
| `levels.ts` | The maze maps (letters) and the legend. |
| `main.ts` | The game logic, in small functions (below). |
| `meta.json` | Title, emoji, description and controls shown on the gallery page. |

## Request → where to change it

| Kids ask for … | Change |
| --- | --- |
| Different hero | `config.player1.emoji` / `player2.emoji` (+ `facesLeft: true` for left-facing emoji) |
| Faster / slower | `player1.speed`, or a monster's `speed` in `config.things` |
| New monster / item | add a letter to `config.things` (`moves`: still, wander, chase, patrol), then put it into `levels.ts` |
| Monsters that chase | `moves: 'chase'` |
| Collect something else (diamonds, carrots) | change the emoji of `'o'` in `config.things` |
| Key and locked door | thing with `touch: 'key', opens: 'L'` + tile `'L'` with `kind: 'door'` |
| Speed boost, walk through walls, catch the monsters | thing with `touch: 'power'` and `power: 'fast'`, `'ghost'` or `'brave'` |
| Time limit | `config.timeLimit` in seconds (0 = none) |
| Lives and game over | `config.lives` (0 = unlimited) |
| New or bigger maze | edit or add a string in `levels.ts` (max 24 wide, 12 tall) |
| Colours | `config.theme`: perus, talvi, avaruus, viidakko, laava, meri |
| Sounds | `sfx('name')` in `main.ts`; names: jump coin hit powerup win lose boom click shoot bounce roar fart |
| New behaviour (teleporters, ice, …) | `main.ts`: `updatePlayer`, `updateThing` (one branch per `moves`), `touchThing` (one `case` per `touch`) |

## main.ts functions

- `loadLevel` – reads a maze map, places players and things
- `spawn(letter, col, row)` – adds a thing on a tile (e.g. from a timer)
- `blocked(col, row)` – is this tile a wall (doors count until opened)
- `updatePlayer` + `cornerAssist` – free movement that slides around corners
- `hurtPlayer` – back to the start, blinking for `config.safeTime`
- `updateThing` – monsters walk tile to tile and choose a direction at each tile centre
- `touchThing` – what touching does by `touch`: collect, bonus, key, power, hurt, exit
- `update` – the main loop; also level end and the adult keys
- `draw*` – maze, things, players, score line and banners

## Kit (read-only, import with `@kit/...`)

`loop` (startGame, hitStop) · `input` (player(1|2), keyPressed) · `sound` (sfx) ·
`sprites` (drawEmoji, roundRect, circle) · `physics` (moveBody, overlap, distance) ·
`particles` (particles.burst/confetti/dust, fx.shake/flash) · `ui` (text, hud, banner, bar) ·
`themes` · `storage` (highScore) · `dev` (keep/recall across reloads)

## Adult keys

Shift+N next level · Shift+G can't get hurt · Shift+R restart level · P pause · M mute
