# Hahmo – change or power up a player

**Both games:** everything is in `games/<peli>/config.ts` → `player1` / `player2`.

- New look: `player1: { emoji: '🦖', facesLeft: true, ... }`. Animal emoji that face
  left on a Mac: 🐌 🐈 🐕 🐎 🦖 🐉 🐊 🐍 🐢 – set `facesLeft: true` for those.
- Bigger hero: `size: 1.3` (tiles). In the maze the hero is drawn bigger but still fits the corridors.
- Faster: `speed` (tiles per second).

**Tasohyppely (platformer) only:**

- Higher jump: `jumpTiles` (how many tiles high).
- From the start: `doubleJump: true`, `canFly: true` (hold jump), `canShoot: true`
  (F / Enter shoots `config.shot`).
- Superpower as a pick-up: add a thing `{ emoji: '🍄', touch: 'power', power: 'big', bob: true }`.
  Powers: `doubleJump`, `fly`, `shoot`, `big`, `fast`.

**Labyrintti (maze) only:** powers from pick-ups: `fast`, `ghost` (through walls), `brave`
(catch the monsters); `powerTime` in seconds.
