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

test('hard AI blocks a one-sided four before the player can make five', () => {
  let board = createBoard();
  board = placeStone(board, 7, 5, 'white');
  for (let col = 6; col < 10; col += 1) board = placeStone(board, 7, col, 'black');

  const move = chooseAiMove(board, 'white', 'hard');

  assert.deepEqual(move, [7, 10]);
});

test('hard AI extends its strongest four instead of playing nearby filler', () => {
  let board = createBoard();
  for (let col = 5; col < 9; col += 1) board = placeStone(board, 7, col, 'white');
  board = placeStone(board, 6, 7, 'black');
  board = placeStone(board, 8, 7, 'black');

  const move = chooseAiMove(board, 'white', 'hard');

  assert.deepEqual(move, [7, 4]);
});

test('hard AI blocks an open three before it becomes an easy win', () => {
  let board = createBoard();
  for (let col = 6; col < 9; col += 1) board = placeStone(board, 7, col, 'black');
  board = placeStone(board, 6, 6, 'white');

  const move = chooseAiMove(board, 'white', 'hard');

  assert.equal(move[0], 7);
  assert.ok(move[1] === 5 || move[1] === 9);
});

test('expert AI avoids moves that allow an immediate loss', () => {
  let board = createBoard();
  board = placeStone(board, 7, 5, 'black');
  board = placeStone(board, 7, 6, 'black');
  board = placeStone(board, 7, 7, 'black');
  board = placeStone(board, 6, 5, 'white');
  board = placeStone(board, 6, 6, 'white');

  const move = chooseAiMove(board, 'white', 'expert');

  assert.equal(move[0], 7);
  assert.ok(move[1] === 4 || move[1] === 8);
});

test('expert AI blocks a vertical four like the stage loss pattern', () => {
  let board = createBoard();
  for (let row = 7; row < 11; row += 1) board = placeStone(board, row, 8, 'black');
  board = placeStone(board, 7, 7, 'white');
  board = placeStone(board, 8, 7, 'white');

  const move = chooseAiMove(board, 'white', 'expert');

  assert.equal(move[1], 8);
  assert.ok(move[0] === 6 || move[0] === 11);
});

test('expert AI responds quickly enough for stages 9 and 10 after the first move', () => {
  const board = placeStone(createBoard(), 7, 7, 'black');
  const startedAt = Date.now();

  const move = chooseAiMove(board, 'white', 'expert');

  assert.equal(Array.isArray(move), true);
  assert.ok(Date.now() - startedAt < 500);
});

test('AI always returns a legal move', () => {
  const move = chooseAiMove(createBoard(), 'white', 'easy');
  assert.equal(Array.isArray(move), true);
  assert.equal(move.length, 2);
});
