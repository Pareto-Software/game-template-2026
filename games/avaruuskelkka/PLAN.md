# Avaruuskelkka – plan

Co-op "bridge crew" game. Every player is a station on a starship and plays on
their **phone**. The computer drives the **main screen** (projector), a 2D view of
what happens outside the ship, like the viewscreen on a Star Trek bridge. The crew
flies the ship from the home base to a far-away destination planet. The game
**can't be lost**: damage, low morale or bad choices only slow the ship down.

Made for the "Lapsi töihin" day: kids (8–13) change it by telling Claude their
ideas, so almost everything they'd want to change lives in `config.ts`.

Status: **phase 2 done** (first flight, console look) – next: phase 3 (danger). Open decisions are marked **❓**.

---

## 1. Decisions so far

| Topic | Decision |
| --- | --- |
| Genre | Co-op bridge crew, exploration mission (Captain Sonar / Artemis / Spaceteam style, calm rather than frantic) |
| Devices | Phones = stations (touch only). Computer = main screen, viewer only, plus a "Aloita" button and the QR code |
| Goal | Reach the destination planet. Round length 5–10 min |
| Failure | None. Hull 0 → the ship limps (slow) until Engineering repairs it |
| Players | 2–10. Players choose a free station when they join; stations nobody picked run on **autopilot** |
| Stations | Captain, Helm, Tactical, Science, Operations, Communications, Engineering, Counselor (8) |
| Joining | Main screen shows a **QR code + 4-digit room code**. The QR code holds the game's own address (`location.href` + `?huone=1234`), never a hard-coded URL |
| Backend | Firebase Realtime Database + Anonymous Auth, Spark (free) plan |
| Firebase code | Shared `kit/firebase.ts` (reusable by future games) |
| Dependencies | `firebase` npm package added to `package.json`; `npx firebase-tools` for rules/deploy (no global install) |
| Data | One room per main screen: `/rooms/<code>`. Rooms older than 24 h are deleted when a new room is made. No names or personal data, ever |
| Dev testing | "Simulated phones" debug view: main screen + several station iframes on one computer |
| Hosting | GitHub Pages via the existing `julkaise.yml` (no changes needed) |
| UI language | Finnish |
| Engine | **Phaser 4.2.1** for the main screen (same patterns as lumisota); **plain HTML/CSS** buttons for the phones |
| QR code | `qrcode` npm package (added with `firebase`) |
| Mission start | Both: the Captain's phone **and** the main-screen "Aloita" button |

## 2. The game

### Round flow
1. **Lobby (Aula)**: the main screen shows the ship, QR code, room code and the 8 station
   cards (taken / free / "autopilotti"). Phones scan → pick a free station → see
   "Odota kapteenia…".
2. **Lähtö**: the Captain's phone or the main-screen "Aloita" button starts the mission.
3. **Matka**: the route is a chain of **sectors** (e.g. 5). Each sector has a few
   **events** (asteroid field, space pirates, alien contact, nebula, broken
   engine, friendly space whale…). Stations solve them together, by talking out loud.
4. **Perillä**: arrival celebration on the main screen + on every phone; time and stars
   collected shown; "Uusi matka" restarts in the same room (players keep their stations).

### Shared ship state (what everyone affects)
- `position / heading / speed`: ship on the 2D map
- `hull` (runko) 0–100: low → slower
- `energy`: split between engines / shields / weapons (Engineering)
- `morale` (mieliala) 0–100: low → every station's actions are a bit slower (Counselor)
- `fuel`: optional, can't run out, just slows
- `stars`: collected bonus (score), nice-to-have

### Stations (first version: one clear job each)
| Station | Phone shows | Does |
| --- | --- | --- |
| **Kapteeni** (Captain) | Everyone's status + the route map | Chooses the next waypoint from 2–3 route options; approves big decisions (warp jump, "punainen hälytys" = shields up for everyone) |
| **Ohjaus** (Helm) | Steering wheel / left–right + throttle | Flies the ship towards the waypoint, dodges asteroids |
| **Taktiikka** (Tactical) | Radar with threats + fire / shield buttons | Bonks pirates and asteroids with cartoon lasers, raises shields on the hit side |
| **Tiede** (Science) | Scanner (hold to scan) | Only Science sees hidden things: shortcuts (wormholes), danger clouds, star crystals. Scanned things appear on the main screen |
| **Operaatiot** (Ops) | Alert list | Sees sensor alerts and sends tasks to stations ("Konehuone: korjaa moottori!"), runs the tractor beam to pick up stars |
| **Viestintä** (Comms) | Alien message in emoji symbols + 3 emoji answers | Right answer → aliens help (fuel, shortcut); wrong → they get grumpy (slow-down). No free text, only ready-made answers |
| **Konehuone** (Engineering) | 3 energy sliders + repair mini-game | Splits limited energy; repairs damage (tap the sparks) |
| **Neuvonantaja** (Counselor) | Crew mood faces + calming mini-game | Keeps morale up (e.g. tap in rhythm / pet the space cat) |

**Autopilot**: every station has a simple `autopilot(state)` function that does its job
slowly and sometimes badly, so the ship always moves even with 2 players.
With 9–10 players, a second player can join an already taken station (shared station).

### Look & feel: Star Trek parody 🖖
The whole game is **Star Trek-themed, tongue in cheek**: a goofy, slightly chaotic
starship bridge for kids. Messy and over the top is welcome.
- **Main screen = the bridge viewscreen**: framed like a big screen on the bridge, with
  stars streaking past at warp, a "PUNAINEN HÄLYTYS" mode (red flashing, siren), and
  dramatic zoom-ins when aliens call.
- **Phones = LCARS-style consoles**: black background, rounded pill/elbow panels in
  orange, peach, lilac and blue, chunky buttons with silly numbers ("47-B"), beeps on tap.
- **Language**: parody bridge jargon in Finnish: "Tehkää niin!", "Warp-nopeus!",
  "Kilvet ylös!", "Kapteeni, en pysty enempään!", "Säteilytä minut ylös!", stardate ("tähtipäivä").
- **Mess allowed**: sparks flying from consoles when hit, crew wobbling, alarms beeping,
  fake error codes, a space cat on the bridge.
- **Original, not copied** (CLAUDE.md content rules): no "Star Trek", "Starfleet",
  "Enterprise", delta badge, or real characters/species. Own goofy versions instead:
  e.g. ship "USS Avaruuskelkka", a badge of our own shape, aliens like the
  "Möhköttäjät" or "Pörröpäät".

### Content (kid-safe)
Cartoon only: lasers go "bonk", pirates are silly, asteroids crumble into sparkles,
aliens are friendly-weird. Emoji graphics + shapes drawn in code. No text input,
no names; a player is "Kapteeni 🟡" etc. (station + colour).

## 3. Architecture

### One page, two modes (no `vite.config.ts` change)
`games/avaruuskelkka/index.html` is the only entry (the build only picks up `index.html`).
`main.ts` looks at the address:
- no `?huone` → **main screen** (creates a room, shows QR code)
- `?huone=1234` → **phone** (joins the room, picks a station)
- `?testi` → **debug view**: main screen + N phone iframes side by side

### Host-authoritative simulation
- The **main screen is the host**: it runs the whole simulation at 60 fps (`simulaatio.ts`)
  and writes a compact `state` snapshot to Firebase ~5×/s.
- **Phones only send intents** (button taps, slider values) and render the state they read.
  They never compute game rules → the rules live in one place, which keeps kids' changes simple.
- If the main screen reloads, it rejoins the same room (code kept in `@kit/storage`) and continues.

### Firebase data model
```
/rooms/<code>
  createdAt, hostUid, phase: 'aula' | 'matka' | 'perilla'
  players/<uid>:  { station, colour, lastSeen }        ← written by that player; onDisconnect → removed
  inputs/<station>: { …slider/held values… }           ← continuous inputs (Helm wheel, energy)
  commands/<pushId>: { uid, station, action, value }   ← discrete taps; host consumes & deletes
  state: { ship, hull, energy, morale, sector, events, alienMsg, alerts, stars, … }  ← host only
```

### Security rules (`database.rules.json`, deployed with `npx firebase-tools`)
- Everything requires `auth != null` (anonymous).
- `/rooms/<code>`: create if it doesn't exist; delete if `hostUid == auth.uid` or `createdAt` older than 24 h.
- `state`, `phase`: only `hostUid` writes.
- `players/<uid>`: only that uid writes.
- `commands`, `inputs`: any player in the room; `.validate` limits keys and sizes (no free strings).
- Nothing else at the root is readable or writable.

### `kit/firebase.ts` (shared, small, game-agnostic)
- `connect()` → anonymous sign-in, returns uid. In `?testi` mode uses in-memory persistence
  so every iframe gets its **own** uid (otherwise iframes share one IndexedDB identity).
- `createRoom()` (random free 4-digit code + old-room cleanup), `joinRoom(code)`
- `watch(path, cb)`, `write(path, value)`, `update(path, patch)`, `push(path, value)`,
  `onLeave(path)` (onDisconnect), `serverTime()`
- Firebase web config (public by design) in `kit/firebase-config.ts`.

### Files in `games/avaruuskelkka/` (this is the fixed set; after it exists, the
"no new files" rule applies again)
| File | What |
| --- | --- |
| `index.html` | Entry page |
| `meta.json` | Gallery card |
| `README.md` | Map for the agent: request → where to change it |
| `config.ts` | **Everything kids change**: ship emoji, station emoji/colours/names, speeds, sectors, events, alien messages & answers, mini-game numbers, theme |
| `main.ts` | Mode switch (main screen / phone / testi), lobby, QR code |
| `paanaytto.ts` | Main screen drawing (map, ship, events, status bars, banners) |
| `simulaatio.ts` | Host simulation: state, events, applying commands, autopilots |
| `asemat.ts` | Phone UI: one small function per station |
| `PLAN.md` | This file |

Phone colour clashes (two phones joining at once) are fixed on the phones: the later uid picks a free colour.
Also `?liity` = number-button pad for typing the room code without the QR code.

### Other repo changes
- `package.json`: add `firebase` and `qrcode` (+ `@types/qrcode` dev). Root: `firebase.json`, `.firebaserc`, `database.rules.json`.
- `kit/firebase.ts`, `kit/firebase-config.ts`.
- `CLAUDE.md`: an **Avaruuskelkka exception** section: Firebase only via `@kit/firebase`;
  network access to Firebase allowed; QR code of the game's own address allowed;
  phones are touch-only and the main screen has no keyboard players (the "both players'
  controls must work" rule becomes "joining and every station must still work");
  never store anything typed or personal.
- Root `README.md`: Firebase setup notes for the team lead.

## 4. Firebase setup (CLI, done once)
1. Adult runs `! npx firebase-tools login` in this session.
2. ✅ Project **`avaruuskelkka`** (made in the console; the CLI got 403 on `addFirebase`). Web app `1:1039979419245:web:545bf2c85c188974be5164` ✅
3. ✅ Realtime Database `avaruuskelkka-default-rtdb` in **europe-west1** (made in the console).
4. ✅ Enable **Anonymous** sign-in (Console → Authentication; the CLI can't fully do this, so this is one console click).
5. ✅ `npx firebase-tools apps:create web` → copy the config to `kit/firebase-config.ts`.
6. ✅ `npx firebase-tools deploy --only database` (rules; verified live: 18 allow/deny checks pass).
7. Console: restrict the API key to the GitHub Pages domain + `localhost` (optional hardening).

## 5. Execution phases (each ends playable + pushed)
0. ✅ **Foundation**: Firebase project, rules, `kit/firebase.ts`, `package.json`, CLAUDE.md exception.
1. ✅ **Lobby**: room create/join, QR code, station picking, presence, `?testi` debug view.
2. ✅ **First flight** ⭐ first playable: simulation loop, main-screen map, Helm steers to destination, arrival screen. Other stations on autopilot.
3. **Danger**: Tactical + Engineering + hull/energy; asteroid & pirate events.
4. **Discovery**: Science (hidden things) + Captain (route choices, red alert).
5. **People**: Comms (emoji aliens) + Ops (alerts, tractor beam) + Counselor (morale).
6. **Polish**: sounds (`@kit/sound`), particles, autopilot tuning, Wake Lock on phones, rejoin after reload.
7. **Kid-ready**: README map, `meta.json`, recipes-style table of easy changes, playtest on real phones via GitHub Pages.

## 6. Risks / notes
- **Wi-Fi**: phones and the main screen need internet; guest Wi-Fi may block Firebase websockets (it falls back to long-polling). Test on site beforehand.
- **Phone sleep**: use the Screen Wake Lock API on the station page.
- **Kids' edits breaking sync**: keep the state shape and Firebase calls out of `config.ts`; kids edit content, not plumbing.
- **Spark limits**: 100 simultaneous connections, 10 GB/month download: plenty. Keep `state` small and at ~5 Hz.
- **Local dev hits the real database** (no emulator): fine, rooms are separate and auto-cleaned.

## 7. Open decisions ❓
1. Approve the **sector & event list** below (section 8).

## 8. Route & events (proposal – phases 3–5 build these)

Route (in `config.route`): 🛰️ Kotitelakka → 🧀 Juustosumu → 🪨 Kivikaista →
👾 Pörröpäiden asema → 🐋 Avaruusvalaan laulupaikka → 🪐 Planeetta Kotikolo.
Phase 2 flight: about 75 s on autopilot. Events should bring a round to 5–10 min.

| Where | Event | Who solves it | Phase |
| --- | --- | --- | --- |
| Anywhere | 🪨 Kivisade: asteroids fly at the ship | Ohjaus dodges, Taktiikka bonks them, Kilvet soften hits | 3 |
| Kivikaista | 🪨 Big asteroid field | Ohjaus + Taktiikka; Konehuone shifts energy to shields | 3 |
| Anywhere | 🏴 Möhköttäjät (silly cartoon pirates) throw space pies 🥧 | Taktiikka + Kilvet; Kapteeni calls PUNAINEN HÄLYTYS | 3 |
| After hits | 💥 Sparks, broken engine / toilet | Konehuone repairs (tap the sparks), Operaatiot assigns | 3 / 5 |
| Juustosumu | 🌫️ Fog hides everything | Tiede scans: shows the way + a secret wormhole shortcut 🌀 | 4 |
| Junctions | 🧭 Two routes: short & dangerous / long & calm | Kapteeni chooses | 4 |
| Pörröpäiden asema | 👾 Aliens call in emoji | Viestintä picks the right emoji reply → they give fuel | 5 |
| Laulupaikka | 🐋 Space whale sings, crew gets sleepy | Neuvonantaja keeps morale up (rhythm game) | 5 |
| Anywhere | 🐈 The space cat walks on a console | Operaatiot catches it | 5 |
