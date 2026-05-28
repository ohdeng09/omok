import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('server and package are ready for public hosting', async () => {
  const server = await readFile(new URL('../server.js', import.meta.url), 'utf8');
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(server, /HOST/);
  assert.match(server, /0\.0\.0\.0/);
  assert.equal(pkg.scripts.start, 'node server.js');
  assert.match(pkg.engines.node, />=20/);
});

test('mobile clients can install and share room links', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const manifest = await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /theme-color/);
  assert.match(html, /styles\.css\?v=/);
  assert.match(html, /app\.js\?v=/);
  assert.match(app, /URLSearchParams/);
  assert.match(app, /\/src\/ai\.js\?v=/);
  assert.match(app, /shareRoom/);
  assert.match(app, /navigator\.share/);
  assert.match(app, /serviceWorker/);
  assert.match(manifest, /온라인 오목/);
  assert.match(sw, /CACHE_NAME/);
});

test('deployed app shell does not blank if supplemental files are omitted', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(app, /from ['"]\/sound\.js['"]/);
  assert.doesNotMatch(app, /from ['"]\/src\/scoring\.js['"]/);
});
