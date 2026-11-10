# Kuva – draw your own character or thing (SVG)

Any `emoji` (or tile `look`) in a game's config can be a picture file instead:

```ts
'e': { emoji: 'kuvat/limamoykky.svg', touch: 'stomp', moves: 'walk' },
```

- `'kuvat/name.svg'` = the game's own folder `games/<peli>/kuvat/`. This is the
  only new folder or file you may add to a game.
- `'pack/name.png'` = the shared `assets/kuvat/` folder (packs listed in `assets/CATALOG.md`).
- Example: `games/tasohyppely/kuvat/limamoykky.svg`.

## Drawing a new one

1. Write an SVG from what the kids describe: `games/<peli>/kuvat/<name>.svg`,
   name in lowercase a–z (no ä/ö), e.g. `lohikaarme.svg`.
2. Use it in `config.ts`: `emoji: 'kuvat/lohikaarme.svg'`. No `facesLeft`.
3. `npm run check`, save as usual (`git add games` includes the picture).

## SVG rules

- `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">`:
  always set `width`, `height` and `viewBox`; square is easiest.
- The character **faces right** and fills most of the square, with feet near the bottom.
- Only shapes: `path`, `circle`, `ellipse`, `rect`, `polygon`, `line`, gradients and `g`.
  No `<image>`, no `<script>`, no `<text>`, no `href` to other files, no URLs
  (`xmlns` is the only one allowed).
- Thick dark outlines (`stroke-width` 3) and bright colours read best when small.
- Big eyes and a smile make anything cute. Keep it cartoon: content rules apply to pictures too.
- Changes ("bigger wings", "make it purple") are edits to the same file.

## If it doesn't show

- A ❓ in the game = the file isn't found: check the path and name (`virheet.log` says where it looked).
- Nothing at all = the SVG is broken: check it is valid XML (every tag closed).
- Lumisota (Phaser) doesn't support picture files yet; use emoji there.
