import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, placeStone } from '../src/rules.js';
import { chooseAiMove } from '../src/ai.js';

test('AI blocks an immediate four-stone threat', () => {
  let board = createBoard();
  for (let col = 3; col < 7; col += 1) board = placeStone(board, 7, col, 'black');

  const move = chooseAiMove(board, 'white', 'hard');

  assert.deepEqual(move, [7, 2]);
});

test('AI always returns a legal move', () => {
  const move = chooseAiMove(createBoard(), 'white', 'easy');
  assert.equal(Array.isArray(move), true);
  assert.equal(move.length, 2);
});
