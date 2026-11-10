// Pelipaja Vite plugin (shared kit file).
// - Adds <meta name="robots" content="noindex"> to every page (dev and build).
// - In development, browser errors are written to virheet.log in the repo root,
//   so the agent can read them when the adult says "peli on rikki".
//   The log is emptied every time the page is loaded.
import type { Plugin } from 'vite';
import { appendFileSync, writeFileSync } from 'node:fs';

const REPORTER = `
(() => {
  const send = (msg) => {
    try { fetch('/__virhe', { method: 'POST', body: String(msg).slice(0, 4000) }); } catch {}
  };
  addEventListener('error', (e) => {
    if (!(e instanceof ErrorEvent)) {
      // A script or file that failed to load (e.g. a module with a syntax error).
      const src = e.target && (e.target.src || e.target.href);
      send('Failed to load ' + (src ? src.replace(location.origin, '') : 'a file') + ' – run npm run check');
      return;
    }
    const where = e.filename ? ' (' + e.filename.replace(location.origin, '') + ':' + e.lineno + ':' + e.colno + ')' : '';
    send((e.error && e.error.stack) || (e.message + where));
  }, true);
  addEventListener('unhandledrejection', (e) => {
    send('Unhandled promise rejection: ' + ((e.reason && e.reason.stack) || e.reason));
  });
})();
`;

export function pelipaja(opts: { logFile: string }): Plugin {
  const log = (text: string) => {
    try {
      appendFileSync(opts.logFile, `[${new Date().toLocaleTimeString('fi-FI')}] ${text}\n\n`);
    } catch {}
  };
  return {
    name: 'pelipaja',
    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        const tags: { tag: string; attrs?: Record<string, string>; children?: string; injectTo: 'head-prepend' }[] = [
          { tag: 'meta', attrs: { name: 'robots', content: 'noindex' }, injectTo: 'head-prepend' },
        ];
        if (ctx.server) {
          // A page load starts a fresh log (server side, so it always happens before new errors).
          try { writeFileSync(opts.logFile, ''); } catch {}
          tags.push({ tag: 'script', children: REPORTER, injectTo: 'head-prepend' });
        }
        return tags;
      },
    },
    configureServer(server) {
      server.middlewares.use('/__virhe', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c) => { if (body.length < 8000) body += c; });
        req.on('end', () => { log(body); res.statusCode = 204; res.end(); });
      });
    },
  };
}
