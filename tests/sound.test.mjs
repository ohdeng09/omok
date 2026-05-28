import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundEngine } from '../public/sound.js';

test('sound engine exposes stone hit and result music controls', () => {
  const sound = createSoundEngine({ storage: memoryStorage() });

  assert.equal(typeof sound.unlock, 'function');
  assert.equal(typeof sound.playStone, 'function');
  assert.equal(typeof sound.playWin, 'function');
  assert.equal(typeof sound.playLose, 'function');
  assert.equal(typeof sound.toggleMuted, 'function');
  assert.equal(typeof sound.isMuted, 'function');
});

test('sound engine can be muted and unmuted without audio support', async () => {
  const sound = createSoundEngine({ storage: memoryStorage(), AudioContext: null });

  assert.equal(sound.isMuted(), false);
  sound.toggleMuted();
  assert.equal(sound.isMuted(), true);
  await sound.unlock();
  sound.playStone();
  sound.playWin();
  sound.playLose();
});

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  };
}
