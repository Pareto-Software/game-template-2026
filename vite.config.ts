import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { pelipaja } from './kit/vite-plugin.ts';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: 'game',
  base: './', // the published site lives at /<repo-name>/
  publicDir: 'public', // game/public → meta.json is copied as-is
  resolve: { alias: { '@kit': here('./kit'), '@assets': here('./assets') } },
  // Inline PostCSS options: Vite then never loads a postcss.config.* file from game/
  // (such a file would run as Node code on the laptop).
  css: { postcss: {} },
  server: {
    fs: { allow: [here('.')] },
    watch: { ignored: ['**/virheet.log'] },
  },
  build: { outDir: here('./dist'), emptyOutDir: true },
  plugins: [pelipaja({ logFile: here('./virheet.log') })],
});
