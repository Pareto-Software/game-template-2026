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

### Avaruuskelkka on the day

1. On the projector computer open the **published** game,
   `https://<organisation>.github.io/<repo-name>/games/avaruuskelkka/`, and press F11 for full screen.
   (Phones can't reach `localhost`, so use the published page for real phones.)
2. Kids scan the QR code (or open `…/games/avaruuskelkka/?liity` and type the room code)
   and each picks a station. Stations nobody picks run on autopilot.
3. The Kapteeni taps **Tehkää niin!** (or click the button on the main screen).
4. After the kids' changes are published (about a minute), reload the main screen: the trip
   continues in the same room. Phones reload themselves only if you reload them.
5. Testing on one computer: `npm run dev`, then open `…/games/avaruuskelkka/?testi`
   (the main screen + simulated phones; 📱 + puhelin adds one).

Phones and the computer need internet (Firebase). Check that the venue Wi-Fi allows it.

### Problems

| Problem | Fix |
| --- | --- |
| Web page shows 404 | Do steps 2.2 and 2.3. |
| `git push` fails with a login error | Set up the git login (step 1). |
| `git push` is rejected | Tell Claude "push epäonnistui". |
| Avaruuskelkka: a phone says "Huonetta ei löytynyt" | Rescan the QR code on the main screen (the room changed). |
| Avaruuskelkka: phones don't react | Check the internet connection; reload the phone. |
| Anything else | Call the technical lead. |

## What's in here

| Path | What |
| --- | --- |
| `index.html`, `gallery/` | The gallery page: a card per game, read from each game's `meta.json`. |
| `games/tasohyppely/` | Platformer: 3 levels, power-ups, a dragon boss. |
| `games/labyrintti/` | Maze: 2 levels, critters, a key and doors. |
| `games/lumisota/` | Top-down snowball fight made with Phaser 4.2.1: waves of snowmen and a boss, or player vs player. |
| `games/reaktio/` | Nopeat näpit: a tapping reaction game for touch screens (several fingers at once). |
| `games/avaruuskelkka/` | Avaruuskelkka: a co-op starship-bridge game for 2–10 players. Phones are the ship's stations, the projector is the main screen. Uses Firebase (see below). |
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

## Firebase (online games)

Games played on many devices at once (like Avaruuskelkka) use Firebase Realtime
Database through `online` from `@kit/firebase`. Players sign in anonymously; no
names or typed text are ever stored.

| File | What |
| --- | --- |
| `firebase-web-config.json` | **Which Firebase project** the games use (the web app config – public by design). |
| `.firebaserc` | The same project id, for the `firebase-tools` CLI. |
| `database.rules.json` | Who may read and write what. Deploy with `npx firebase-tools deploy --only database`. |
| `kit/firebase.ts` | The `online` helper: rooms, read/watch/write, presence. |

**Every game has its own section.** The kit puts each game's data under
`games/<game folder>/…`, worked out from the page address. A game just uses paths like
`rooms/1234/state`, and in the database they end up at `games/avaruuskelkka/rooms/1234/state`.
Two games never see each other's rooms, and a new online game needs no setup: copy a
game folder, import `online` and use `rooms/…`. The rules allow, in every game section,
`rooms/<4-digit code>/` with `createdAt`, `hostUid`, `phase`, `state` (host only),
`players/<uid>` (`station` + `colour`), `inputs/<station>` and `commands/<id>`
(short codes and numbers only). A game that needs something else needs a rules change.

### Firebase: use your own project

The repo points at the project `avaruuskelkka`. To use another one (e.g. your own team's copy):

1. `npx firebase-tools login` (a Google account that can create projects).
2. In the [Firebase console](https://console.firebase.google.com): **Create a project**
   (Analytics not needed), then **Build → Realtime Database → Create database**
   (location e.g. *europe-west1*, *locked mode*), and **Authentication → Get started →
   Sign-in method → Anonymous → Enable**.
3. Create a web app and print its config:
   `npx firebase-tools apps:create web peli --project <project-id>`, then
   `npx firebase-tools apps:sdkconfig web --project <project-id>`.
4. Copy the values into `firebase-web-config.json`: `apiKey`, `authDomain`, `databaseURL`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId`. If `databaseURL` is missing,
   it is shown in the console's Realtime Database page, e.g.
   `https://<project-id>-default-rtdb.europe-west1.firebasedatabase.app`.
5. Put the same project id in `.firebaserc`.
6. Deploy the rules: `npx firebase-tools deploy --only database`.
7. Commit and push. Test with `…/games/avaruuskelkka/?testi`.

If `firebase-web-config.json` is empty or incomplete, the online games show a yellow
"Firebase ei ole asetettu" box instead of starting.

## Notes

- `npm run check` type-checks; `npm run build` never does, so a type error can't
  block publishing.
- In development, browser errors go to `virheet.log` (emptied on every page
  load). Claude reads it when told the game is broken.
- Emoji look different on Windows and phones; the games are made for Macs.
