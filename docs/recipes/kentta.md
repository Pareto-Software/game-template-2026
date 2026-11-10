# Kenttä – levels, tiles, lava

Levels are strings in `games/<peli>/levels.ts`; each letter is one tile. The legend is
at the top of the file. Rows may have different lengths.

- **New level:** add another string to the `levels` array (copy an existing one
  and change it). The game goes through them in order.
- **Longer level (platformer):** make the rows longer. Keep the bottom rows as ground.
- **Maze size:** at most 24 letters wide and 12 rows tall.
- **New tile:** add a letter to `config.tiles`:

```ts
'~': { hurt: true, look: 'lava' },           // platformer: hurts
'I': { kind: 'solid', slippery: true, look: '🧊' },  // platformer: slippery ice (already in config)
'W': { kind: 'wall', look: '🌳' },            // maze: a tree wall
```

Platformer tile `kind`: `solid` or `oneway` (jump through from below); `hurt: true`
hurts; `slippery: true` makes players slide. `look`: `ground`, `platform`, `lava` or any emoji.

Every level must have a `1` (player start) and something to finish it
(platformer `F` flag with `touch: 'win'`, maze `E` with `touch: 'exit'`).
Shift+N jumps to the next level when testing.
