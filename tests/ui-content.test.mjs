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
  assert.match(app, /playWin/);
  assert.match(app, /playLose/);
  assert.match(app, /data-sound-toggle/);
  assert.match(css, /\.sound-toggle/);
});
