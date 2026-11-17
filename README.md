# Pelipohja – Pelipaja game template

Template repo for Pareto's "Lapsi töihin" game workshop. The site has a gallery
page with every game in `games/`; each game has a "← Kaikki pelit" button back
to the gallery. Teams make their own copy, turn on GitHub Pages, and change the
games by telling Claude Code what they want. Claude edits a game, checks it,
commits and pushes; a GitHub Actions workflow publishes the site.

**Live site (GitHub Pages):** https://pareto-software.github.io/game-template-2026/
– updated automatically by the Julkaise workflow on every push to `main`.
A team copy is published at `https://<organisation>.github.io/<repo-name>/`.

## Team lead guide (before the day, about 30 minutes)

### 1. Requirements

**Accounts**

- GitHub account, member of **Pareto-Software**, allowed to create repositories.
- Claude account with Claude Code access (your Pareto Claude seat).

**Laptop:** macOS, Windows or Linux with:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 24 or newer | includes npm |
| Git | recent | must be able to push to GitHub (see below) |
| Claude Code | latest | on Windows it needs Git for Windows |
| Browser | recent | Chrome recommended |
| GitHub CLI (`gh`) | optional | easiest way to log git in to GitHub |
| Emoji font | – | built in on macOS and Windows; Linux: e.g. `fonts-noto-color-emoji` |

Install with your usual package manager or each tool's official installer.

**Git login to GitHub** – one of:

- **GitHub CLI:** `gh auth login`, then `gh auth setup-git`.
- **Windows:** nothing to do; Git for Windows asks you to log in on the first clone.
- **SSH key** already on your GitHub account: clone with the SSH address instead.

### 2. Team repo and publishing

1. https://github.com/Pareto-Software/game-template-2026 → **Use this template →
   Create a new repository**. Owner **Pareto-Software**, name `peli-<team>`
   (e.g. `peli-kettu`), **Public**.
2. New repo → **Settings → Pages → Source: GitHub Actions**.
3. **Actions → Julkaise → Run workflow**. Wait for the green tick (about a minute).
4. The games are live at `https://pareto-software.github.io/peli-<team>/`.
   Every push to `main` updates the page automatically.

### 3. Laptop setup

```bash
git clone https://github.com/Pareto-Software/peli-kettu.git
```

```bash
cd peli-kettu
```

```bash
npm ci
```

Run `claude` once in that folder: sign in and answer **Yes** to trusting the folder.

### 4. Test run

1. Two terminals in the team folder: `npm run dev` (opens the games in the
   browser) and `claude`.
2. Tell Claude: *"Tasohyppelyssä kissan tilalle lohikäärme"*.
3. The game changes right away; the web page about a minute later.

To avoid approval prompts: press **Shift+Tab** until **accept edits on** shows,
and answer **"Yes, and don't ask again"** when Claude first runs `npm` or `git`.

### On the day

- Start `npm run dev` and `claude` as in the test run.
- Type the kids' ideas in Finnish, one at a time. Click the game afterwards so
  the keys go to it.
- **"Kumoa"** undoes the last change, **"Peli on rikki"** fixes errors.
- Adult keys: ⚙️ / Esc menu, Shift+N next level, Shift+G can't get hurt, P pause, M mute.

### Problems

| Problem | Fix |
| --- | --- |
| Web page shows 404 | Do steps 2.2 and 2.3. |
| `git push` fails with a login error | Set up the git login (step 1). |
| `git push` is rejected | Tell Claude "push epäonnistui". |
| Anything else | Call the technical lead. |

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

- **Avaruuskelkka** uses Firebase (project `avaruuskelkka`, Realtime Database in
  europe-west1, anonymous sign-in). Web config: `kit/firebase-config.ts`; rules:
  `database.rules.json`, deployed with `npx firebase-tools deploy --only database`
  (needs `npx firebase-tools login` with an account on the project).

- `npm run check` type-checks; `npm run build` never does, so a type error can't
  block publishing.
- In development, browser errors go to `virheet.log` (emptied on every page
  load). Claude reads it when told the game is broken.
- Emoji look different on Windows and phones; the games are made for Macs.
