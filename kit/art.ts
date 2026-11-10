// Picture files for the games: SVG or PNG (shared kit file – used by every game).
//
// Anywhere a game config has an emoji, it can have a picture file instead:
//   emoji: 'kuvat/limamoykky.svg'      – from this game's own folder: games/<peli>/kuvat/
//   emoji: 'kenney-animals/frog.png'   – from the shared assets/kuvat/ folder
// drawEmoji() (kit/sprites.ts) then draws the picture. Pictures should face RIGHT.
// The files are part of the site: nothing is ever loaded from the internet.

// Every picture file in the repo, found when the game is built: path → URL.
const files = import.meta.glob(
  ['../assets/kuvat/**/*.{svg,png,jpg,jpeg,webp}', '../games/*/kuvat/*.{svg,png,jpg,jpeg,webp}'],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

/** The folder name of the game on this page, e.g. 'tasohyppely'. */
const game = location.pathname.match(/\/games\/([^/]+)\//)?.[1] ?? '';

const images = new Map<string, HTMLImageElement | 'missing'>();
const loaded = new Set<HTMLImageElement>();

/** True if `look` is a picture file name (and not an emoji). */
export function isPicture(look: string): boolean {
  return /\.(svg|png|jpe?g|webp)$/i.test(look);
}

function urlFor(look: string): string | undefined {
  return files[`../games/${game}/${look}`] ?? files[`../assets/kuvat/${look}`];
}

/**
 * The loaded picture, or null while it is still loading (or missing).
 * A missing file shows up in virheet.log, and the game keeps running.
 */
export function picture(look: string): HTMLImageElement | null {
  let img = images.get(look);
  if (img === undefined) {
    const url = urlFor(look);
    if (!url) {
      images.set(look, 'missing');
      const where = look.startsWith('kuvat/') ? `games/${game}/${look}` : `assets/kuvat/${look}`;
      setTimeout(() => { throw new Error(`Picture not found: ${look} – put the file in ${where}`); });
      return null;
    }
    const image = new Image();
    image.onload = () => loaded.add(image);
    image.onerror = () => {
      images.set(look, 'missing');
      setTimeout(() => { throw new Error(`Picture could not be drawn: ${look} – is the file broken?`); });
    };
    image.src = url;
    images.set(look, image);
    img = image;
  }
  return img !== 'missing' && loaded.has(img) ? img : null;
}

/** True if the picture can't be found (draw something else instead). */
export function isMissing(look: string): boolean {
  return images.get(look) === 'missing';
}
