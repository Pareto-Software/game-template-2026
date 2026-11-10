# Pelipohja – Pelipaja game template

Template repo for Pareto's "Lapsi töihin" game workshop. The site has a gallery
page with every game in `games/`; each game has a "← Kaikki pelit" button back
to the gallery. Teams make their own copy, turn on GitHub Pages, and change the
games by telling Claude Code what they want. Claude edits a game, checks it,
commits and pushes; a GitHub Actions workflow publishes the site.

**Live site (GitHub Pages):** https://pareto-software.github.io/game-template-2026/
– updated automatically by the Julkaise workflow on every push to `main`.
A team copy is published at `https://<organisation>.github.io/<repo-name>/`.

## Make your team's copy (once, before the day)

1. On this repo: **Use this template → Create a new repository**.
   - Owner: the event organisation. Name: `peli-<table animal>`, e.g. `peli-kettu`.
   - **Public** (private repos can't publish Pages on GitHub Free).
2. In the new repo: **Settings → Pages → Source: GitHub Actions**.
3. **Actions → Julkaise → Run workflow.** About a minute later the site is at
   `https://<organisation>.github.io/peli-kettu/`.
4. On the laptop:

```bash
gh auth login
gh auth setup-git
gh repo clone <organisation>/peli-kettu ~/pelipaja/peli-kettu
cd ~/pelipaja/peli-kettu
npm ci
```

## Every morning

Two Terminal tabs in the team folder:

```bash
npm run dev
```

```bash
claude
```

The first opens the gallery in the default browser; the second is Claude Code.
Click the game window after sending a request so the kids' key presses go to the game.

## Laptop requirements

- macOS with Chrome set as the default browser, Node 24 (`.nvmrc`), git,
  GitHub CLI, Claude Code.
- Git author: `git config --global user.name "Pelipaja"` and
  `git config --global user.email "peli@pelipaja.invalid"`.
- Run `claude` once in the team folder: sign in with the adult's Pareto seat and
  accept the folder trust prompt.

## What's in here

| Path | What |
| --- | --- |
| `index.html`, `gallery/` | The gallery page: a card per game, read from each game's `meta.json`. |
| `games/tasohyppely/` | Platformer: 3 levels, power-ups, a dragon boss. |
| `games/labyrintti/` | Maze: 2 levels, critters, a key and doors. |
| `games/lumisota/` | Top-down snowball fight made with Phaser 4.2.1: waves of snowmen and a boss, or player vs player. |
| `games/reaktio/` | Nopeat näpit: a tapping reaction game for touch screens (several fingers at once). |
| `kit/` | Shared engine: loop, input (2 players + gamepads), touch (taps), sound, sprites, physics, particles, ui, themes, menu; `kit/phaser.ts` for Phaser games. |
| `docs/recipes/` | Short how-tos for common requests. |
| `assets/CATALOG.md` | Emoji ideas, themes, sound names. |
| `CLAUDE.md` | Rules for the agent (content, saving, undo). |
| `.github/workflows/julkaise.yml` | Builds and publishes to GitHub Pages on every push. |

A new game is a new folder in `games/` with `index.html` and `meta.json` (copy
an existing one); it appears in the gallery and the build automatically.

## Controls

- Player 1: A / D move, W or Space jump, F action
- Player 2: ← / → move, ↑ jump, Enter action (player 2 joins by pressing a key)
- Single player: `players: 1` in a game's `config.ts`, or ⚙️ → Vaihda yksinpeliin.
  Then both key sets and both gamepads control player 1.
- Gamepads 1 and 2 work too.
- **⚙️ Asetukset** button (or Esc) in every game: start the whole game over
  (level 1, score 0, players at the start), restart the current level,
  single player / two players, sound on/off.
  **← Kaikki pelit** goes back to the gallery.
- Adult keys: Shift+N next level, Shift+G can't get hurt, Shift+R restart level, P pause, M mute.

## Notes

- `npm run check` type-checks; `npm run build` never does, so a type error can't
  block publishing.
- In development, browser errors go to `virheet.log` (emptied on every page
  load). Claude reads it when told the game is broken.
- Emoji look different on Windows and phones; the games are made for Macs.
