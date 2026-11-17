# reaktio – map for the agent

"Nopeat näpit": a tapping game for touch screens (a mouse works too). Things pop
out of holes; tap the good ones before they hide, don't touch the bad ones.
Every finger counts, so several kids can play on one screen at the same time.
A round lasts 30 seconds and gets faster towards the end.
Everything in this game lives in these files; don't create new files.

| File | What is in it |
| --- | --- |
| `config.ts` | Every number, emoji, hole layout and thing. **Start here.** |
| `main.ts` | The round, popping out, tapping, drawing (below). |
| `meta.json` | Title, emoji, description and controls shown on the gallery page. |

## Request → where to change it

| Kids ask for … | Change |
| --- | --- |
| Different animals | `config.things` – `emoji`, `points`, `chance`, `sound` |
| Something you must not touch | a thing with `points` below 0 (like 🌵) |
| Super rare treasure | a thing with big `points` and `chance: 1` |
| Longer / shorter round | `config.roundSeconds` |
| Faster / slower | `config.appearEvery` and `config.stayOut` (`start` … `end` of the round) |
| More holes | `config.holes` (`columns`, `rows`) |
| Bigger things (easier to hit) | `config.size` |
| More things out at once | `config.maxOut` |
| Combo points | `config.comboEvery`, `config.maxMultiplier` |
| Colours | `config.theme`: perus, talvi, avaruus, viidakko, laava, meri |
| Sounds | names: jump coin hit powerup win lose boom click shoot bounce roar fart |

## main.ts

- `startRound` / `endRound` – a round from the start (also the ⚙️ menu) and its end, high score
- `popOut` / `pickThing` – a random thing into a free hole (`chance` decides how often)
- `updateOut` – things hide when their time is up; a good one getting away resets the combo
- `tapAt` → `hitGood` / `hitBad` – what happens when a finger hits something
- `drawHole` / `drawThing` – the holes, the things and the ring that shows time left
- Taps come from `touch.taps()` (`@kit/touch`): a list of `{ x, y }` in game coordinates.

## Adult keys

⚙️ Asetukset (or Esc): start over, sound · Space or Enter starts a round · P pause · M mute
