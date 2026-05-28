import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/rooms.js';

test('creates a room and lets a second player join', () => {
  const store = createRoomStore();
  const created = store.createRoom({ nickname: '하나', partyMode: false });
  const joined = store.joinRoom({ code: created.room.code, nickname: '둘' });

  assert.equal(joined.room.players.length, 2);
  assert.equal(joined.room.status, 'playing');
});

test('rejects moves from the wrong turn', () => {
  const store = createRoomStore();
  const a = store.createRoom({ nickname: '하나', partyMode: false });
  const b = store.joinRoom({ code: a.room.code, nickname: '둘' });

  assert.throws(() => store.placeStone({ code: a.room.code, playerId: b.player.id, row: 7, col: 7 }), /turn/);
});

test('detects winner and allows rematch after both players request it', () => {
  const store = createRoomStore();
  const a = store.createRoom({ nickname: '하나', partyMode: false });
  const b = store.joinRoom({ code: a.room.code, nickname: '둘' });
  const black = a.room.players.find((player) => player.color === 'black')?.id ?? a.player.id;
  const white = b.room.players.find((player) => player.color === 'white')?.id ?? b.player.id;
  const sequence = [
    [black, 7, 3],
    [white, 8, 3],
    [black, 7, 4],
    [white, 8, 4],
    [black, 7, 5],
    [white, 8, 5],
    [black, 7, 6],
    [white, 8, 6],
    [black, 7, 7]
  ];

  for (const [playerId, row, col] of sequence) store.placeStone({ code: a.room.code, playerId, row, col });

  assert.equal(store.getRoom(a.room.code).result.winnerColor, 'black');
  store.requestRematch({ code: a.room.code, playerId: black });
  const rematch = store.requestRematch({ code: a.room.code, playerId: white });
  assert.equal(rematch.room.status, 'playing');
  assert.equal(rematch.room.moves.length, 0);
});

test('party rooms expose party mode setting', () => {
  const store = createRoomStore();
  const created = store.createRoom({ nickname: '하나', partyMode: true });

  assert.equal(created.room.partyMode, true);
});
