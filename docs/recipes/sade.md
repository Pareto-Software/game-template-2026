# Sade ja efektit – raining things, effects, sounds

**Rain things from the sky (platformer):** `config.rain = { thing: 'c', every: 0.5 }` –
any letter from `config.things`. Rained things fall down, then move their own
way, and vanish after 8 seconds. Rain enemies too: `thing: 'b'` (bats) or
`thing: 'e'` (snails).

**Spawn from code (both games):** `spawn('o', x, bottom)` (platformer, pixels) or
`spawn('o', col, row)` (maze, tiles), e.g. on a timer in `update`.

**Effects** (from `@kit/particles`, already imported in `main.ts`):

```ts
particles.burst(x, y, { emoji: '💖', count: 10 });   // puff of emoji
particles.confetti(x, y);                             // celebration
fx.shake(10, 300);                                    // screen shake
fx.flash('#ffffff', 150);                             // screen flash
```

**Sounds:** `sfx('fart')`, `sfx('coin', { pitch: 2 })`. Names: jump coin hit powerup
win lose boom click shoot bounce roar fart. A thing's `sound` plays when it is
collected or defeated.

**Look:** `config.theme` – perus, talvi (snow), avaruus (stars), viidakko,
laava (embers), meri (bubbles).
