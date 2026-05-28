import { createBoard, getWinner, isBoardFull, placeStone } from './rules.js';
import { calculateMissions } from './scoring.js';

export function createRoomStore() {
  const rooms = new Map();

  function createRoom({ nickname, partyMode }) {
    const code = createCode(rooms);
    const player = createPlayer(nickname);
    const room = freshRoom(code, partyMode, [player]);
    rooms.set(code, room);
    return { room: publicRoom(room), player };
  }

  function joinRoom({ code, nickname }) {
    const room = requireRoom(rooms, code);
    if (room.players.length >= 2) throw new Error('room is full');
    const player = createPlayer(nickname);
    room.players.push(player);
    room.status = 'playing';
    room.updatedAt = Date.now();
    return { room: publicRoom(room), player };
  }

  function place({ code, playerId, row, col }) {
    const room = requireRoom(rooms, code);
    if (room.status !== 'playing') throw new Error('room is not playing');
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('player is not in room');
    if (room.moves.length === 0) assignFirstMover(room, playerId);
    if (player.color !== room.turn) throw new Error('not your turn');
    if (isBlocked(room, row, col)) throw new Error('cell is blocked this turn');

    room.board = placeStone(room.board, row, col, player.color);
    room.moves.push({ playerId, color: player.color, row, col, at: Date.now() });
    room.blockedCells = room.partyMode ? nextBlockedCells(room.board, row, col) : [];

    const winner = getWinner(room.board);
    if (winner || isBoardFull(room.board, room.blockedCells)) {
      room.status = 'finished';
      room.result = {
        winnerColor: winner?.color ?? null,
        winnerLine: winner?.line ?? [],
        endedAt: Date.now(),
        missionsByColor: Object.fromEntries(room.players.map((seat) => [
          seat.color,
          calculateMissions({
            board: room.board,
            playerColor: seat.color,
            winner: winner?.color ?? null,
            moveCount: room.moves.length,
            previousLoserWonRematch: room.previousLoserPlayerId === seat.id
          })
        ]))
      };
      if (winner) room.previousLoserPlayerId = room.players.find((seat) => seat.color !== winner.color)?.id ?? null;
    } else {
      room.turn = room.turn === 'black' ? 'white' : 'black';
    }

    room.updatedAt = Date.now();
    return { room: publicRoom(room) };
  }

  function requestRematch({ code, playerId }) {
    const room = requireRoom(rooms, code);
    room.rematchRequests.add(playerId);
    room.updatedAt = Date.now();
    if (room.players.length === 2 && room.players.every((player) => room.rematchRequests.has(player.id))) {
      const players = room.players.map((player) => ({ ...player, color: null }));
      const next = freshRoom(code, room.partyMode, players, room.previousLoserPlayerId);
      rooms.set(code, next);
      return { room: publicRoom(next) };
    }
    return { room: publicRoom(room) };
  }

  return {
    createRoom,
    joinRoom,
    placeStone: place,
    requestRematch,
    getRoom(code) {
      return publicRoom(requireRoom(rooms, code));
    },
    hasRoom(code) {
      return rooms.has(String(code).toUpperCase());
    }
  };
}

function freshRoom(code, partyMode, players, previousLoserPlayerId = null) {
  return {
    code,
    partyMode,
    players,
    status: players.length === 2 ? 'playing' : 'waiting',
    board: createBoard(),
    turn: 'black',
    moves: [],
    result: null,
    blockedCells: [],
    rematchRequests: new Set(),
    previousLoserPlayerId,
    updatedAt: Date.now()
  };
}

function createPlayer(nickname, color = null) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: String(nickname || 'Player').slice(0, 18),
    color
  };
}

function assignFirstMover(room, playerId) {
  const firstMover = room.players.find((player) => player.id === playerId);
  const secondMover = room.players.find((player) => player.id !== playerId);
  firstMover.color = 'black';
  if (secondMover) secondMover.color = 'white';
  room.turn = 'black';
}

function createCode(rooms) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function requireRoom(rooms, code) {
  const room = rooms.get(String(code).trim().toUpperCase());
  if (!room) throw new Error('room not found');
  return room;
}

function publicRoom(room) {
  return {
    ...room,
    board: room.board.map((row) => row.slice()),
    players: room.players.map((player) => ({ ...player })),
    moves: room.moves.map((move) => ({ ...move })),
    blockedCells: room.blockedCells.map((cell) => cell.slice()),
    rematchRequests: Array.from(room.rematchRequests),
    result: room.result ? {
      ...room.result,
      winnerLine: room.result.winnerLine.map((cell) => cell.slice()),
      missionsByColor: room.result.missionsByColor
    } : null
  };
}

function isBlocked(room, row, col) {
  return room.blockedCells.some(([blockedRow, blockedCol]) => blockedRow === row && blockedCol === col);
}

function nextBlockedCells(board, row, col) {
  const candidates = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ].filter(([r, c]) => board[r]?.[c] === null);
  return candidates.length ? [candidates[0]] : [];
}
