# Pelipohja – Pelipaja game template

Template repo for Pareto's "Lapsi töihin" game workshop. The site has a gallery
page with every game in `games/`; each game has a "← Kaikki pelit" button back
to the gallery. Teams make their own copy, turn on GitHub Pages, and change the
games by telling Claude Code what they want. Claude edits a game, checks it,
commits and pushes; a GitHub Actions workflow publishes the site.

**Live site (GitHub Pages):** https://pareto-software.github.io/game-template-2026/
– updated automatically by the Julkaise workflow on every push to `main`.
A team copy is published at `https://<organisation>.github.io/<repo-name>/`.

## Team lead guide (do this before the day, about 30 minutes)

Pick a team name, e.g. `kettu`.

### 1. Requirements

**Accounts**

- A **GitHub account** that is a member of the **Pareto-Software** organisation
  (it must be allowed to create repositories there).
- A **Claude account with Claude Code access** (your Pareto Claude seat).

**Laptop:** macOS, Windows 10/11 or Linux, with internet access and these installed:

| Tool | Version | Why |
| --- | --- | --- |
| **Node.js** (includes npm) | 24 or newer (the LTS is fine) | runs the game locally and builds it |
| **Git** | any recent | saves and publishes every change |
| **GitHub CLI** (`gh`) | any recent | logs git in to GitHub, clones the repo |
| **Claude Code** | latest | the AI that edits the games |
| **Google Chrome** (recommended as default browser) | latest | the game opens there; any modern browser works |
| A **colour emoji font** | – | the games draw everything with emoji (built in on macOS and Windows) |

How to install them:

- **macOS:** with [Homebrew](https://brew.sh): `brew install node git gh`.
  Claude Code: `curl -fsSL https://claude.ai/install.sh | bash`.
- **Windows:** from PowerShell: `winget install OpenJS.NodeJS.LTS Git.Git GitHub.cli`.
  Claude Code: `irm https://claude.ai/install.ps1 | iex`. Git for Windows is
  required by Claude Code, so install Git first. Use **Git Bash** or **PowerShell**
  as the terminal.
- **Linux:** Node.js 24 from [nodejs.org](https://nodejs.org) or your distribution
  (check the version), `git` and `gh` from the package manager
  ([GitHub CLI install](https://github.com/cli/cli#installation)), and an emoji font
  (e.g. `fonts-noto-color-emoji` on Debian/Ubuntu). Claude Code:
  `curl -fsSL https://claude.ai/install.sh | bash`.

If an install command doesn't work, use the tool's official installer instead;
only the versions in the table matter.

**Check** in a new terminal window: `node -v` (v24 or newer), `git --version`,
`gh --version` and `claude --version` all print a version.

**One-time setting:** log GitHub in (choose GitHub.com → HTTPS → Login with a web browser), then let
git use that login:

```bash
gh auth login
```

```bash
gh auth setup-git
```

The games are made and tested on macOS. On Windows and Linux they work the same,
but emoji look a little different.

### 2. The team's own copy of the games (once)

1. Open https://github.com/Pareto-Software/game-template-2026 →
   **Use this template → Create a new repository**.
   - Owner: **Pareto-Software** · Name: **`peli-kettu`** (your team name) · **Public**
2. In the new repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions** tab → **Julkaise** → **Run workflow** → **Run workflow**.
   Wait for the green tick (about a minute).
4. The games are now live at **https://pareto-software.github.io/peli-kettu/**.
   From now on every push to `main` updates the page automatically.

### 3. Get it on the laptop (once)

In a terminal, in the folder where you keep projects (any folder works):

```bash
gh repo clone Pareto-Software/peli-kettu
```

```bash
cd peli-kettu
```

```bash
npm ci
```

Set a neutral git author for this folder only, so no personal names end up in
the public repo (your other projects keep your own name):

```bash
git config user.name "Pelipaja"
```

```bash
git config user.email "peli@pelipaja.invalid"
```

Then start Claude Code there once: run `claude`, sign in with your Claude account
and answer **Yes** to "Do you trust the files in this folder?".

### 4. Test run (5 minutes)

1. Open two terminal tabs or windows in the `peli-kettu` folder. In the first: `npm run dev`
   (the gallery opens in the browser). In the second: `claude`.
2. Tell Claude: *"Tasohyppelyssä kissan tilalle lohikäärme"*.
3. The game reloads with the change. Claude saves and publishes it; about a
   minute later it's also on the team's web page.

Claude asks permission before it edits files or runs commands. To keep the
kids from waiting: press **Shift+Tab** until it shows **accept edits on**, and the
first time it asks to run `npm run check` or `git …`, choose
**"Yes, and don't ask again"**.

### On the day

- Two terminal tabs as in the test run: `npm run dev` and `claude`.
- Type or dictate the kids' ideas in Finnish. One idea at a time works best.
- Click the game window after sending a request, so the key presses go to the game.
- **"Kumoa"** undoes the last change. **"Peli on rikki"** makes Claude find and fix the error.
- Adult keys in every game: ⚙️ / Esc menu (start over, one or two players, sound),
  Shift+N next level, Shift+G can't get hurt, P pause, M mute.

### If something goes wrong

| Problem | Fix |
| --- | --- |
| The web page shows 404 | Step 2.2 (Pages source) was skipped, or the workflow hasn't run yet: do 2.3. |
| `git push` is rejected | Tell Claude "push epäonnistui"; it pulls and pushes again. |
| `npm run dev` says the port is in use | Close the old terminal tab, or use the URL it prints. |
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

- `npm run check` type-checks; `npm run build` never does, so a type error can't
  block publishing.
- In development, browser errors go to `virheet.log` (emptied on every page
  load). Claude reads it when told the game is broken.
- Emoji look different on Windows and phones; the games are made for Macs.
