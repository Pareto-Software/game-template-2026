# Hahmo – change or power up a player

**Platformer and maze:** everything is in `game/config.ts` → `player1` / `player2`.

- New look: `player1: { emoji: '🦖', facesLeft: true, ... }`. Animal emoji that face
  left on a Mac: 🐌 🐈 🐕 🐎 🦖 🐉 🐊 🐍 🐢 – set `facesLeft: true` for those.
- Bigger hero: `size: 1.3` (tiles). In the maze the hero is drawn bigger but still fits the corridors.
- Faster: `speed` (tiles per second).

**Platformer only:**

- Higher jump: `jumpTiles` (how many tiles high).
- From the start: `doubleJump: true`, `canFly: true` (hold jump), `canShoot: true`
  (F / Enter shoots `config.shot`).
- Superpower as a pick-up: add a thing `{ emoji: '🍄', touch: 'power', power: 'big', bob: true }`.
  Powers: `doubleJump`, `fly`, `shoot`, `big`, `fast`.

**Maze only:** powers from pick-ups: `fast`, `ghost` (through walls), `brave`
(catch the monsters); `powerTime` in seconds.
