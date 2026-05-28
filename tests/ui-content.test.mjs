import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('party mode has an accessible inline help summary', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

  assert.match(app, /aria-label="파티룰 설명"/);
  assert.match(app, /힌트/);
  assert.match(app, /금지 칸/);
  assert.match(app, /기본 승부는 그대로/);
  assert.match(css, /\.help-trigger/);
  assert.match(css, /\.help-popover/);
});

test('app wires stone hit and result sounds into the UI', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

  assert.match(app, /createSoundEngine/);
  assert.match(app, /playStone/);
  assert.match(app, /playStart/);
  assert.match(app, /playWin/);
  assert.match(app, /playLose/);
  assert.match(app, /expert/);
  assert.match(app, /최고/);
  assert.match(app, /isLocalHost/);
  assert.match(app, /data-sound-toggle/);
  assert.match(css, /\.sound-toggle/);
});

test('app visibly explains the active standard Omok rule set', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

  assert.match(app, /ruleNoteHtml/);
  assert.match(app, /15x15 교차점에 착수/);
  assert.match(app, /정확히 5목 승리/);
  assert.match(app, /첫 수를 둔 사람이 흑/);
  assert.match(css, /\.rule-note/);
});

test('production links do not keep cache-busting test query parameters', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(app, /cleanRuntimeUrl/);
  assert.match(app, /history\.replaceState/);
  assert.match(app, /location\.origin \+ location\.pathname/);
  assert.doesNotMatch(app, /new URL\(location\.href\)/);
});

test('mobile sharing points users to the Render public URL instead of localhost', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

  assert.match(app, /PUBLIC_APP_URL = 'https:\/\/omok-h9o2\.onrender\.com\/\?fresh=20260528-cache-fix'/);
  assert.match(app, /CACHE_BUST_PARAM/);
  assert.match(app, /url\.searchParams\.set\('fresh', CACHE_BUST_PARAM\)/);
  assert.match(app, /mobileShareHtml/);
  assert.match(app, /share-mobile-url/);
  assert.match(app, /localhost가 아니라 공개주소/);
  assert.match(css, /\.mobile-note/);
  assert.match(css, /\.link-button/);
});

test('board grid uses intersection coordinates instead of cell borders', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(css, /\.board::before/);
  assert.match(css, /--board-padding/);
  assert.match(css, /\.hoshi/);
  assert.match(css, /clamp\(9px,\s*1\.6vw,\s*13px\)/);
  assert.match(css, /--board-padding:\s*clamp\(44px,\s*8vw,\s*76px\)/);
  assert.match(css, /\.intersection-guide/);
  assert.match(css, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(css, /width:\s*calc\(var\(--cell-step\) \* 1\.16\)/);
  assert.match(css, /height:\s*calc\(var\(--cell-step\) \* 1\.16\)/);
  assert.match(css, /z-index:\s*4/);
  assert.match(css, /cursor:\s*pointer/);
  assert.match(app, /--row:\s*\$\{row\}/);
  assert.match(app, /--col:\s*\$\{col\}/);
  assert.match(app, /hoshi/);
  assert.match(app, /intersection-guide/);
  assert.doesNotMatch(css, /\.cell\s*\{[^}]*border-right/s);
  assert.doesNotMatch(css, /\.cell\s*\{[^}]*border-bottom/s);
});
