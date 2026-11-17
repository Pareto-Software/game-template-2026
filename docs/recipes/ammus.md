# Ammus – shooting

**Platformer:**

- Players shoot from the start: `config.canShoot = true`. Player 1 shoots with F,
  player 2 with Enter. Look and speed: `config.shot = { emoji: '🔥', speed: 14, size: 0.6 }`.
- Shooting as a pick-up: a thing `{ emoji: '🔫', touch: 'power', power: 'shoot' }` – use a
  water pistol 🔫 or a magic wand 🪄, never realistic weapons.
- Enemies that shoot: add `shoots: { emoji: '🍅', every: 2, speed: 6 }` to the thing.
- Shots hurt things whose `touch` is `stomp` or `hurt`; each hit takes one `hp`.
- Code: `shoot(x, y, dx, dy, emoji, speed, size, fromPlayer)` in `main.ts`.

**Maze:** no shooting built in. Add it to `updatePlayer` in `main.ts` with
`input.player(p.n).actionPressed`, moving a shot in a straight line until it hits
`blocked(col, row)`.
