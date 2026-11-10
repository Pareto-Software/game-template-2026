# Asset catalog

Graphics are emoji, shapes drawn in code, or picture files (SVG / PNG); sounds
are synthesised by `@kit/sound`.

## Picture files

Any `emoji` or tile `look` in a config can be a picture file (see `docs/recipes/kuva.md`):

- `'kuvat/name.svg'` – the game's own `games/<peli>/kuvat/` folder (SVG drawn by Claude).
  Example: `games/tasohyppely/kuvat/limamoykky.svg`, a green slime blob.
- `'pack/name.png'` – shared packs in `assets/kuvat/<pack>/`. None yet: CC0 packs
  will be listed here, each with its LICENSE.txt and the sprite names.

## Emoji ideas by theme

| Theme (`config.theme`) | Heroes | Enemies | Items |
| --- | --- | --- | --- |
| `perus` | 🐱 🐶 🐸 🐵 🐭 🐹 | 🐌 🐝 🦔 🦀 🕷️ | ⭐ 🍎 💎 🧀 🍓 |
| `talvi` | 🐧 🐻‍❄️ 🦊 | ☃️ 🐺 🦭 | ❄️ 🎁 🍪 |
| `avaruus` | 👩‍🚀 🤖 👽 | 👾 🛸 ☄️ | ⭐ 🔋 💫 |
| `viidakko` | 🐵 🐯 🦎 | 🐍 🐊 🕷️ | 🍌 🥥 💎 |
| `laava` | 🐲 🤖 🦖 | 🔥 👹 🦂 | 💎 🔑 🍖 |
| `meri` | 🐙 🐬 🧜 | 🦈 🦀 🪼 | 🐚 💎 🫧 |

Bosses: 🐉 🦖 🦍 🐙 👾 🤖 · Blocks: 🧱 🧊 🌳 🪨 📦 · Effects: 💥 ✨ 💫 💖 🔥 ⚡

Emoji that face left on a Mac (set `facesLeft: true`): 🐌 🐈 🐕 🐎 🦖 🐉 🐊 🐍 🐢 🐇.
Avoid emoji made of several joined characters in new art if they look odd on
Windows (e.g. 🐻‍❄️ shows as 🐻❄️ on old systems).

## Sounds (`sfx(name)`)

jump · coin · hit · powerup · win · lose · boom · click · shoot · bounce · roar · fart
