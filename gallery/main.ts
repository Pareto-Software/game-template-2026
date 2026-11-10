// The gallery page: one card for every game in games/<name>/ (read from its meta.json).
// A new game folder shows up here automatically.

interface Meta {
  title: string;
  emoji: string;
  description: string;
  controls: string;
  team?: string;
}

const metas = import.meta.glob<Meta>('../games/*/meta.json', { eager: true, import: 'default' });

const games = Object.entries(metas)
  .map(([path, meta]) => ({ folder: path.split('/')[2], meta }))
  .sort((a, b) => a.folder.localeCompare(b.folder, 'fi'));

const style = document.createElement('style');
style.textContent = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% 0%, #2a2f6b, #11132b 70%);
    color: #fff; font-family: "Arial Rounded MT Bold", "Avenir Next", system-ui, sans-serif;
  }
  main { max-width: 1100px; margin: 0 auto; padding: 48px 16px 64px; }
  h1 { font-size: clamp(36px, 7vw, 64px); margin: 0; text-align: center; }
  .sub { text-align: center; color: #c9cdf5; font-size: 20px; margin: 8px 0 40px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  a.card {
    display: block; text-decoration: none; color: inherit; background: #1f2350; border: 3px solid #3a3f86;
    border-radius: 20px; padding: 22px; transition: transform .12s, border-color .12s, background .12s;
  }
  a.card:hover, a.card:focus-visible { transform: translateY(-4px) scale(1.02); border-color: #ffd93d; background: #272c63; outline: none; }
  .emoji { font-size: 72px; line-height: 1; font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
  .title { font-size: 26px; margin: 14px 0 6px; }
  .team { color: #ffd93d; font-size: 16px; margin-bottom: 6px; }
  .desc { color: #dde0ff; font-size: 17px; line-height: 1.4; margin: 0 0 12px; }
  .controls { color: #9ea3dd; font-size: 14px; }
  .empty { text-align: center; color: #c9cdf5; }
`;
document.head.appendChild(style);

const root = document.getElementById('galleria')!;
const h1 = document.createElement('h1');
h1.textContent = '🎮 Pelipaja';
const sub = document.createElement('p');
sub.className = 'sub';
sub.textContent = 'Valitse peli';
const list = document.createElement('div');
list.className = 'cards';
root.append(h1, sub, list);

// Titles and descriptions are set as plain text, never as HTML.
for (const { folder, meta } of games) {
  const card = document.createElement('a');
  card.className = 'card';
  card.href = `./games/${folder}/`;
  const parts: [string, string][] = [
    ['emoji', meta.emoji || '🎮'],
    ['title', meta.title || folder],
    ['team', meta.team ? `Tiimi: ${meta.team}` : ''],
    ['desc', meta.description || ''],
    ['controls', meta.controls || ''],
  ];
  for (const [cls, value] of parts) {
    if (!value) continue;
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = value;
    card.appendChild(el);
  }
  list.appendChild(card);
}
if (games.length === 0) {
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = 'Ei vielä pelejä – lisää kansio games/-hakemistoon.';
  root.appendChild(p);
}
(list.querySelector('a') as HTMLAnchorElement | null)?.focus();
