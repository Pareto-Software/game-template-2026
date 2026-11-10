import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { pelipaja } from './kit/vite-plugin.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Every folder in games/ with an index.html is a game: it gets its own page at
// games/<name>/ and a card on the gallery page (index.html).
const games = readdirSync(here('./games')).filter((d) => existsSync(here(`./games/${d}/index.html`)));

export default defineConfig({
  base: './', // the published site lives at /<repo-name>/
  publicDir: false,
  resolve: { alias: { '@kit': here('./kit'), '@assets': here('./assets') } },
  // Inline PostCSS options: Vite never loads a postcss.config.* file from the project.
  css: { postcss: {} },
  server: { watch: { ignored: ['**/virheet.log'] } },
  build: {
    outDir: here('./dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        gallery: here('./index.html'),
        ...Object.fromEntries(games.map((g) => [g, here(`./games/${g}/index.html`)])),
      },
    },
  },
  plugins: [pelipaja({ logFile: here('./virheet.log') })],
});
