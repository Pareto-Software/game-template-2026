# Pelipohja – Pelipaja game template

Template repo for Pareto's "Lapsi töihin" game workshop. Each team makes its own
copy, turns on GitHub Pages, and builds a browser game by telling Claude Code
what to change. Claude edits `game/`, checks it, commits and pushes; a GitHub
Actions workflow publishes the game.

## Make your team's copy (once, before the day)

1. On this repo: **Use this template → Create a new repository**.
   - Owner: the event organisation. Name: `peli-<table animal>`, e.g. `peli-kettu`.
   - **Public.** (Offline teams: **Private**, and skip step 2 – private repos
     can't publish Pages on GitHub Free.)
2. In the new repo: **Settings → Pages → Source: GitHub Actions**.
3. **Actions → Julkaise → Run workflow.** About a minute later the game is at
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

The first opens the game in Chrome; the second is Claude Code. Click the game
window after sending a request so the kids' key presses go to the game.

## Laptop requirements

- macOS with Chrome set as the default browser (`npm run dev` opens the default
  browser), Node 24 (`.nvmrc`), git, GitHub CLI, Claude Code.
- A dedicated Mac or a fresh macOS user account, so only this repo's
  `.claude/settings.json` applies (personal Claude settings would add permissions).
- Git author: `git config --global user.name "Pelipaja"` and
  `git config --global user.email "peli@pelipaja.invalid"`.
- Run `claude` once in the team folder: sign in with the adult's Pareto seat and
  accept the folder trust prompt.

## What's in here

| Path | What |
| --- | --- |
| `game/` | The team's game – the only folder Claude may edit. Starts as simple-platformer. |
| `templates/` | `simple-platformer`, `simple-maze` – starting games with the same file names. |
| `kit/` | Shared engine: loop, input (2 players + gamepads), sound, sprites, physics, particles, ui, themes. |
| `docs/recipes/` | Short how-tos for common requests. |
| `assets/CATALOG.md` | Emoji ideas, themes, sound names. |
| `CLAUDE.md` | Rules for the agent (content, saving, undo). |
| `.claude/settings.json` | Claude's permissions: edit `game/`, a few git and npm commands, no web. |
| `.github/workflows/julkaise.yml` | Builds and publishes to GitHub Pages on every push. |

## Controls

- Player 1: A / D move, W or Space jump, F action
- Player 2: ← / → move, ↑ jump, Enter action (player 2 joins by pressing a key)
- Gamepads 1 and 2 work too.
- Adult keys: Shift+N next level, Shift+G can't get hurt, Shift+R restart level, P pause, M mute.

## Notes

- `npm run check` type-checks; `npm run build` never does, so a type error can't
  block publishing.
- In development, browser errors go to `virheet.log` (emptied on every page
  load). Claude reads it when told the game is broken.
- Emoji look different on Windows and phones; the games are made for Macs.
