import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  createBoard,
  placeStone,
  getWinner,
  isBoardFull,
  getLegalMoves
} from '../src/rules.js';

test('creates a 15 by 15 empty board', () => {
  const board = createBoard();
  assert.equal(board.length, BOARD_SIZE);
  assert.equal(board[0].length, BOARD_SIZE);
  assert.equal(board[0][0], null);
});

test('black wins with five horizontal stones', () => {
  let board = createBoard();
  for (let col = 3; col < 8; col += 1) board = placeStone(board, 7, col, 'black');

  assert.deepEqual(getWinner(board), {
    color: 'black',
    line: [
      [7, 3],
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7]
    ]
  });
});

test('white wins vertically and diagonally', () => {
  let vertical = createBoard();
  let diagonal = createBoard();
  for (let i = 0; i < 5; i += 1) {
    vertical = placeStone(vertical, i + 1, 4, 'white');
    diagonal = placeStone(diagonal, i + 2, i + 2, 'white');
  }
  assert.equal(getWinner(vertical)?.color, 'white');
  assert.equal(getWinner(diagonal)?.color, 'white');
});

test('six in a row is not treated as an exact five win', () => {
  let board = createBoard();
  for (let col = 3; col < 9; col += 1) board = placeStone(board, 7, col, 'black');

  assert.equal(getWinner(board), null);
});

test('rejects occupied and out of range moves', () => {
  const board = placeStone(createBoard(), 0, 0, 'black');
  assert.throws(() => placeStone(board, 0, 0, 'white'), /occupied/);
  assert.throws(() => placeStone(board, -1, 0, 'white'), /outside/);
  assert.throws(() => placeStone(board, 0, 15, 'white'), /outside/);
});

test('reports legal moves and full board', () => {
  let board = createBoard();
  assert.equal(getLegalMoves(board).length, 225);
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      board = placeStone(board, row, col, (row + col) % 2 === 0 ? 'black' : 'white');
    }
  }
  assert.equal(isBoardFull(board), true);
  assert.equal(getLegalMoves(board).length, 0);
});
