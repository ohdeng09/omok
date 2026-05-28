import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/rooms.js';

test('creates a room and lets a second player join', () => {
  const store = createRoomStore();
  const created = store.createRoom({ nickname: 'player-a', partyMode: false });
  const joined = store.joinRoom({ code: created.room.code, nickname: 'player-b' });

  assert.equal(joined.room.players.length, 2);
  assert.equal(joined.room.status, 'playing');
  assert.deepEqual(joined.room.players.map((player) => player.color), [null, null]);
});

test('first mover becomes black and the other player becomes white', () => {
  const store = createRoomStore();
  const a = store.createRoom({ nickname: 'player-a', partyMode: false });
  const b = store.joinRoom({ code: a.room.code, nickname: 'player-b' });

  const afterFirstMove = store.placeStone({ code: a.room.code, playerId: b.player.id, row: 7, col: 7 });
  const firstMover = afterFirstMove.room.players.find((player) => player.id === b.player.id);
  const otherPlayer = afterFirstMove.room.players.find((player) => player.id === a.player.id);

  assert.equal(firstMover.color, 'black');
  assert.equal(otherPlayer.color, 'white');
  assert.equal(afterFirstMove.room.turn, 'white');
});

test('rejects moves from the wrong turn after the first move chooses black', () => {
  const store = createRoomStore();
  const a = store.createRoom({ nickname: 'player-a', partyMode: false });
  const b = store.joinRoom({ code: a.room.code, nickname: 'player-b' });

  store.placeStone({ code: a.room.code, playerId: b.player.id, row: 7, col: 7 });
  assert.throws(() => store.placeStone({ code: a.room.code, playerId: b.player.id, row: 7, col: 8 }), /turn/);
});

test('detects winner and allows rematch after both players request it', () => {
  const store = createRoomStore();
  const a = store.createRoom({ nickname: 'player-a', partyMode: false });
  const b = store.joinRoom({ code: a.room.code, nickname: 'player-b' });
  const black = a.player.id;
  const white = b.player.id;
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
  assert.deepEqual(rematch.room.players.map((player) => player.color), [null, null]);
});

test('party rooms expose party mode setting', () => {
  const store = createRoomStore();
  const created = store.createRoom({ nickname: 'player-a', partyMode: true });

  assert.equal(created.room.partyMode, true);
});
