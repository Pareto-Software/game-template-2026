# avaruuskelkka – map for the agent

A co-op bridge-crew game (a goofy starship-bridge parody). Every **phone** is one
station of the USS Avaruuskelkka; the **computer** is the ship's main viewscreen
(projector). 2–10 players fly from Kotitelakka to Planeetta Kotikolo together, past
rocks, pie-throwing pirates, fog, aliens, a singing whale and a space cat. The game
can't be lost: trouble only slows the ship down. A round takes about 5–10 minutes.
Firebase keeps everyone in sync (see `CLAUDE.md` → Avaruuskelkka exceptions).
Background and design decisions: `PLAN.md`.
Everything in this game lives in these files; don't create new files.

| File | What is in it |
| --- | --- |
| `config.ts` | Every number, emoji and text: ship, stations, route, dangers, secrets, aliens, mood, colours. **Start here.** |
| `main.ts` | Picks the mode from the address, and the `?testi` view |
| `paanaytto.ts` | Main screen (Phaser 4.2.1): console frame, lobby + QR code, space and ship, mini map, banners, arrival party |
| `simulaatio.ts` | The game rules, run only by the main screen; Firebase paths and data shapes |
| `asemat.ts` | Phone screens (plain HTML buttons): join pad, station picker, one view per station |
| `meta.json` | Title, emoji, description and controls on the gallery page |

## Addresses

- `…/games/avaruuskelkka/` – main screen: makes a room, shows QR code + room code
- `…/games/avaruuskelkka/?huone=1234` – a phone in room 1234 (the QR code opens this)
- `…/games/avaruuskelkka/?liity` – a phone typing the room code with number buttons
- `…/games/avaruuskelkka/?testi` – **test on one computer**: main screen + simulated phones (📱 + puhelin adds one)

## Request → where to change it

| Kids ask for … | Change |
| --- | --- |
| Different ship | `config.ship.emoji`, `.name`, `.size` |
| New / different places on the trip | `config.route` (name, emoji, x, y; first = home, last = goal) |
| Faster / slower ship, sharper turns | `config.helm.speeds`, `.turnSpeed` |
| Longer / shorter warp | `config.helm.warpSpeed`, `.warpSeconds`, `.warpCharge` |
| Autopilot flies faster | `config.autopilot.helmThrottle` (0–3) |
| More / fewer rocks, bigger rocks | `config.danger.rock` (`every`, `fieldEvery`, `speed`, `size`, `emoji`) |
| Rock field somewhere | `rocks: true` on a place in `config.route` |
| Pirate on the way to a place | `pirate: true` on that place; looks and toughness: `config.danger.pirate` |
| Pirate throws something else | `config.danger.pie.emoji` |
| Lasers reach further / shoot faster | `config.tactical.range`, `.reload` |
| Longer shields | `config.tactical.shieldSeconds`, `.shieldCharge` |
| What breaks at a station, easier repairs | `config.faults.byStation` (text; the effect is in the code), `.tapsToFix` |
| What needs the Captain's permission (texts), how long requests wait | `config.captain.requests`, `.requestSeconds`, `.autoApprove` |
| Stronger / longer boosts | `config.boosts.power` (⚡ Konehuone), `config.boosts.cheer` (💖 Neuvonantaja), `.texts` |
| Alien moods and their right answers | `config.aliens.moods` (`face`, `name`, `answer`); what they say: `config.aliens.messages` |
| More / fewer rock showers, earlier warnings | `config.warnings` (`showerEvery`, `firstAfter`, `rocks`, `lead`) |
| Autopilot zaps / repairs / scans faster | `config.autopilot.zapEvery`, `.fixEvery`, `.scanEvery` |
| Fog somewhere | `fog: true` on a place in `config.route`; size and scan effect: `config.science` |
| Captain chooses between two places | `alt: { name, emoji, x, y }` on a place in `config.route` |
| More hidden crystals / wormholes | `config.secrets` (`kind`, `x`, `y`; wormhole: `exit: { x, y, target }`); looks: `config.secretLooks` |
| Aliens somewhere | `aliens: true` on a place |
| Aliens call more / less often | `config.aliens.randomEvery`, `.perVisit`, `.answerSeconds` |
| Whale song somewhere | `song: true` on a place; how sleepy: `config.morale.songPerSecond`, `.songRadius` |
| Mood goes up / down faster | `config.morale` (`hit`, `crystal`, `arrive`, `calm`, `slowAtZero`, `beat`) |
| Cat comes more / less often | `config.cat.every`, `.firstAfter`, `.emoji` |
| Tractor beam reach | `config.ops.tractorRange`, `.tractorCharge` |
| Longer / shorter trip | move the places in `config.route` further apart / closer (an autopilot-only trip is ~2 min) |
| Longer red alert | `config.captain.alertSeconds`, `.alertCharge`; route choice time: `.choiceSeconds` |
| Funny console messages | `config.sillyLines` |
| Console colours (orange, lilac …) | `config.lcars` |
| Stardate | `config.stardate` |
| Rename a station / new emoji / job text | `config.stations` (`name`, `emoji`, `job`; never change `id`) |
| More people per station | `config.playersPerStation` |
| Player colours | `config.colours` (lowercase `#rrggbb`) |
| What a button on a phone does | `send('action')` in `asemat.ts` → `handle()` in `simulaatio.ts` |
| Sounds (main screen) | `sfx('name')` from `@kit/sound`; names: jump coin hit powerup win lose boom click shoot bounce roar fart |

## Bigger requests

| Kids ask for … | How |
| --- | --- |
| A new station ("lohikäärme puhaltaa tulta") | Add it to `config.stations` (new lowercase `id`). It works right away with the silly console view; give it a real job by adding a view to `views` in `asemat.ts` (`html` + `live`, buttons with `data-send="action"`) and a line in `handle()` in `simulaatio.ts` (`'id:action'`). |
| A new kind of danger | Copy the rock: a new `ThreatKind`, spawn it in `spawnDangers`, give it a texture in `makeDangerFx` and a size in `drawThreats`. |
| A new event at a place | Add a flag to `Waypoint` (like `song` / `aliens`), check it in `people()` with `place(s, i)`, show it in `paanaytto.ts`. |

Safe to change without breaking the game (tested): up to 10 stations (the lobby
shrinks the cards), fewer console colours (they repeat), removing or adding places on
the route, different emoji and texts everywhere.

## Crew cooperation (who needs whom)

| Station | Keeps doing | Needs | Gives |
| --- | --- | --- | --- |
| Kapteeni | Answers requests ✅/❌, route choice, red alert | Requests from others | "Tehkää niin!" to WARP, wormhole, tractor beam, shooting the pirate |
| Ohjaus | Steers | Captain (WARP, wormhole), Tiede in fog, Operaatiot's warnings | – |
| Taktiikka | Zaps, shields | Captain (pirate), Tiede's 🎯 weak spots, Operaatiot's warnings | – |
| Tiede | Scans | – | Fog directions, secrets, 🎯 weak spots |
| Konehuone | Reactor needle ⚡, repairs | Broken stations shouting | ⚡ boosts, repairs |
| Neuvonantaja | Heartbeat 💖 | – | 💖 boosts, the aliens' mood to Viestintä |
| Viestintä | Answers alien calls | Neuvonantaja (the mood) | Crystals and mood from friendly aliens |
| Operaatiot | Forwards early warnings, cat, tractor beam | Captain (tractor beam) | Warnings to Taktiikka/Ohjaus, pings |

A hit breaks one station's console (`faultAt`), each with its own effect. With nobody at a
partner station its part is automatic (autopilot), or its information shows on the other phone.

## How it fits together

- Look: a goofy starship-bridge parody (see PLAN.md "Look & feel"): rounded console
  panels in `config.lcars` colours, CAPITAL narrow text, beeps. No real show names or logos.
- The main screen is the **host**: `Simulaatio` reads the phones' commands
  (`rooms/<code>/commands`), decides what happens and writes `phase` and `state` (`ShipState`, 5×/s).
- Phone views live in `views` in `asemat.ts`: `html()` once, `live(ship)` on every state,
  `hold(name, down)` for hold-down buttons (`data-hold`). Every station now has its own view.
- Danger: `spawnDangers` / `moveDangers` / `movePirate` / `hitShip` in `simulaatio.ts`;
  Taktiikka → `zap` + `raiseShields`, Konehuone → `repair`, empty stations → `autopilots`.
  The main screen draws them in `drawThreats`, `zap`, `pop`, `hit`, `splat` (`paanaytto.ts`).
- Discovery: `scan` / `checkSecrets` / `inFogArea` (Tiede), `chooseRoute` / `redAlert` (Kapteeni) in
  `simulaatio.ts`. Use `place(s, i)` – not `config.route[i]` – for the place the crew is really flying to.
  Main screen: `scanPulse`, `wormhole`, `crystal`, `drawFogAndAlert`.
- Cooperation: `ask` / `answerRequest` / `tickRequests` (Captain's orders), `hitShip` + `faultAt` (station faults),
  `powerBoost` / `cheerBoost` / `giveBoost` + `boosted` (boosts), `warn` / `forward` / `tickWarnings` / `rockShower`
  (early warnings) in `simulaatio.ts`. Phones: `faultBanner`, `forwardedWarnings`, the `engineering` reactor game.
- People: `people` / `aliens` / `answer` / `shooCat` / `tractorBeam` / `ping` / `cheer` (mood) in `simulaatio.ts`.
  The cat blocks a station's commands (`catOn`). Phones: `comms`, `ops`, `counselor` views, `catOverlay`, `pinged`.
  Main screen: `drawPeople`, `alienCalls`, `alienAnswered`, `catNews`, `tractor`.
- A reload of the main screen continues the trip (`resume` in `simulaatio.ts`): same room, same ship.
  Phones keep the screen on with the Screen Wake Lock (`keepAwake` in `asemat.ts`).
- The main screen has two cameras: space is zoomed out (`ZOOM`), the console frame is not.
  Anything with `setScrollFactor(0)` goes to the frame camera automatically.
- Helm sends held values to `inputs/ohjaus` (`turn`, `throttle`); `steer()` in `simulaatio.ts` reads them,
  or flies on autopilot when nobody is at Ohjaus.
- Phones only **send** (`send('aloita')`) and **show**. They never decide game rules.
- Firebase only through `online` from `@kit/firebase`. Paths are relative to this game's
  own section: `rooms/1234/state` is really `games/avaruuskelkka/rooms/1234/state`.
  Only the keys allowed by `database.rules.json` can be stored: station ids, colours,
  numbers, true/false, short codes. Which Firebase project: `firebase-web-config.json` (root README → Firebase).
- A command's `action` and `value` must be short codes (`a-z A-Z 0-9 _`), never text.

## Adult keys (main screen)

⚙️ Asetukset (or Esc): "Aloita alusta" = back to the lobby, sound on/off · M mute ·
reloading the main screen page continues the trip in the same room.
