import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, placeStone } from '../src/rules.js';
import { calculateMissions, updateLocalRecord } from '../src/scoring.js';

test('awards win and open four missions', () => {
  let board = createBoard();
  for (let col = 4; col < 8; col += 1) board = placeStone(board, 7, col, 'black');

  const result = calculateMissions({
    board,
    playerColor: 'black',
    winner: 'black',
    moveCount: 9,
    previousLoserWonRematch: false
  });

  assert.equal(result.score >= 1300, true);
  assert.equal(result.missions.some((mission) => mission.id === 'win'), true);
  assert.equal(result.missions.some((mission) => mission.id === 'open-four'), true);
});

test('updates local friendly record', () => {
  const record = updateLocalRecord({}, {
    playerName: '나',
    opponentName: '친구',
    won: true,
    score: 1500
  });

  assert.equal(record.players['나'].wins, 1);
  assert.equal(record.rivals['나::친구'].wins, 1);
});
