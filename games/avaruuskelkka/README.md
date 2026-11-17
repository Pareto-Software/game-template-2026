# avaruuskelkka – map for the agent

A co-op bridge-crew game. Every **phone** is one station of a spaceship; the
**computer** is the ship's main screen (projector). The crew flies to a far-away
planet together. Firebase keeps everyone in sync (see `CLAUDE.md` → Avaruuskelkka
exceptions). The full plan and what's still coming: `PLAN.md`.
Everything in this game lives in these files; don't create new files.

| File | What is in it |
| --- | --- |
| `config.ts` | Ship emoji, the stations (name, emoji, job), player colours, theme. **Start here.** |
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
| Funny console messages | `config.sillyLines` |
| Console colours (orange, lilac …) | `config.lcars` |
| Stardate | `config.stardate` |
| Rename a station / new emoji / job text | `config.stations` (`name`, `emoji`, `job`; never change `id`) |
| More people per station | `config.playersPerStation` |
| Player colours | `config.colours` (lowercase `#rrggbb`) |
| What a button on a phone does | `send('action')` in `asemat.ts` → `handle()` in `simulaatio.ts` |
| Sounds (main screen) | `sfx('name')` from `@kit/sound`; names: jump coin hit powerup win lose boom click shoot bounce roar fart |

## How it fits together

- Look: a goofy starship-bridge parody (see PLAN.md "Look & feel"): rounded console
  panels in `config.lcars` colours, CAPITAL narrow text, beeps. No real show names or logos.
- The main screen is the **host**: `Simulaatio` reads the phones' commands
  (`rooms/<code>/commands`), decides what happens and writes `phase` and `state` (`ShipState`, 5×/s).
- Phone views live in `views` in `asemat.ts`: `html()` once, `live(ship)` on every state,
  `hold(name, down)` for hold-down buttons (`data-hold`). Stations without a view show `waiting`.
- Helm sends held values to `inputs/ohjaus` (`turn`, `throttle`); `steer()` in `simulaatio.ts` reads them,
  or flies on autopilot when nobody is at Ohjaus.
- Phones only **send** (`send('aloita')`) and **show**. They never decide game rules.
- Firebase only through `online` from `@kit/firebase`. Only the keys allowed by
  `database.rules.json` can be stored: station ids, colours, numbers, true/false, short codes.
- A command's `action` and `value` must be short codes (`a-z A-Z 0-9 _`), never text.

## Adult keys (main screen)

⚙️ Asetukset (or Esc): "Aloita alusta" = back to the lobby, sound on/off · M mute
