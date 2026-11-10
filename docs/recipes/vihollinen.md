# Vihollinen – a new enemy or a boss

1. Add a letter to `config.things` in `game/config.ts`.
2. Put that letter into a level in `game/levels.ts`.

**Platformer** (`moves`: still, walk, hop, fly, chase, fall · `touch`: hurt, stomp):

```ts
'z': { emoji: '🧟', touch: 'stomp', moves: 'walk', speed: 1, score: 30 },
'g': { emoji: '👻', touch: 'hurt', moves: 'chase', speed: 2 },
```

A boss: big, several hits, a health bar, shoots at the players:

```ts
'K': { emoji: '🦍', touch: 'stomp', moves: 'hop', size: 2.5, hp: 6, boss: true,
       score: 300, sound: 'roar', shoots: { emoji: '🍌', every: 1.5, speed: 7 } },
```

**Maze** (`moves`: still, wander, chase, patrol · `touch`: hurt):

```ts
'g': { emoji: '👻', touch: 'hurt', moves: 'chase', speed: 2 },
```

Defeating enemies: stomp (`touch: 'stomp'`) or shots (`canShoot: true`) – both
take one `hp` per hit. New behaviour = a new `case` in `updateThing` in `main.ts`.
