# Online Omok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable browser Omok game with friend room codes, real-time online turns, mission scoring, solo AI stages, and optional party rules.

**Architecture:** Use a dependency-free Node server for static files, JSON APIs, and Server-Sent Events. Keep Omok rules, scoring, AI, and room state in small modules that can be unit-tested outside the UI. The browser renders the lobby, board, online room, solo mode, result flow, and local fun stats.

**Tech Stack:** Node.js ES modules, built-in `node:test`, built-in `http`, browser HTML/CSS/JavaScript, Server-Sent Events plus `fetch`.

---

## File Structure

- Create `package.json`: scripts for running the server and tests.
- Create `server.js`: HTTP static server, API routes, SSE connections.
- Create `src/rules.js`: board creation, move validation, win/draw detection.
- Create `src/scoring.js`: mission detection, score calculation, local stat helpers.
- Create `src/ai.js`: solo AI candidate selection for easy, normal, hard.
- Create `src/rooms.js`: online room lifecycle, seats, moves, rematch, party options.
- Create `public/index.html`: app shell.
- Create `public/styles.css`: responsive board-first visual design.
- Create `public/app.js`: browser UI, online API/SSE client, solo play, localStorage.
- Create `tests/rules.test.mjs`: rules tests.
- Create `tests/scoring.test.mjs`: scoring tests.
- Create `tests/ai.test.mjs`: AI tests.
- Create `tests/rooms.test.mjs`: room lifecycle tests.

The spec originally recommends Express and WebSocket, but this workspace has restricted network access. The first implementation uses Node built-ins so it can run without installing packages. The `rooms` and `rules` boundaries keep the server transport replaceable with WebSocket in a future pass.

## Task 1: Project Skeleton And First Failing Test

**Files:**
- Create: `package.json`
- Create: `tests/rules.test.mjs`

- [ ] **Step 1: Create package metadata**

```json
{
  "name": "online-omok",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/*.test.mjs"
  }
}
```

- [ ] **Step 2: Write the failing rules test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, placeStone, getWinner } from '../src/rules.js';

test('black wins with five horizontal stones', () => {
  let board = createBoard();
  for (let col = 3; col < 8; col += 1) {
    board = placeStone(board, 7, col, 'black');
  }

  assert.equal(getWinner(board)?.color, 'black');
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm test`

Expected: FAIL with an import error because `src/rules.js` does not exist.

- [ ] **Step 4: Commit checkpoint when Git is available**

Run: `git add package.json tests/rules.test.mjs && git commit -m "test: add omok rules skeleton"`

Expected in this workspace: skip this command if `git` is still unavailable on PATH.

## Task 2: Omok Rules Engine

**Files:**
- Create: `src/rules.js`
- Modify: `tests/rules.test.mjs`

- [ ] **Step 1: Expand the failing rules tests**

```js
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

test('rejects occupied and out of range moves', () => {
  let board = placeStone(createBoard(), 0, 0, 'black');
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
```

- [ ] **Step 2: Run rules tests and confirm they fail**

Run: `node --test tests/rules.test.mjs`

Expected: FAIL with missing exports from `src/rules.js`.

- [ ] **Step 3: Implement the rules module**

```js
export const BOARD_SIZE = 15;
export const COLORS = ['black', 'white'];

export function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function placeStone(board, row, col, color) {
  if (!COLORS.includes(color)) throw new Error(`invalid color: ${color}`);
  if (!isInside(row, col)) throw new Error('move is outside the board');
  if (board[row][col] !== null) throw new Error('cell is occupied');
  const next = cloneBoard(board);
  next[row][col] = color;
  return next;
}

export function getLegalMoves(board, blockedCells = []) {
  const blocked = new Set(blockedCells.map(([row, col]) => `${row}:${col}`));
  const moves = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === null && !blocked.has(`${row}:${col}`)) moves.push([row, col]);
    }
  }
  return moves;
}

export function isBoardFull(board, blockedCells = []) {
  return getLegalMoves(board, blockedCells).length === 0;
}

export function getWinner(board) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const color = board[row][col];
      if (!color) continue;
      for (const [dr, dc] of directions) {
        const beforeRow = row - dr;
        const beforeCol = col - dc;
        if (isInside(beforeRow, beforeCol) && board[beforeRow][beforeCol] === color) continue;
        const line = [];
        for (let step = 0; step < 5; step += 1) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;
          if (!isInside(nextRow, nextCol) || board[nextRow][nextCol] !== color) break;
          line.push([nextRow, nextCol]);
        }
        if (line.length >= 5) return { color, line: line.slice(0, 5) };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run rules tests and confirm they pass**

Run: `node --test tests/rules.test.mjs`

Expected: PASS for all rules tests.

## Task 3: Mission Scoring And Solo AI

**Files:**
- Create: `src/scoring.js`
- Create: `src/ai.js`
- Create: `tests/scoring.test.mjs`
- Create: `tests/ai.test.mjs`

- [ ] **Step 1: Write scoring tests**

```js
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
```

- [ ] **Step 2: Write AI tests**

```js
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
```

- [ ] **Step 3: Run tests and confirm they fail**

Run: `node --test tests/scoring.test.mjs tests/ai.test.mjs`

Expected: FAIL with missing `src/scoring.js` and `src/ai.js`.

- [ ] **Step 4: Implement scoring**

```js
import { BOARD_SIZE } from './rules.js';

const MISSION_DEFS = {
  win: { label: '승리', points: 1000 },
  'open-four': { label: '열린 4 만들기', points: 450 },
  'fast-win': { label: '빠른 승리', points: 350 },
  revenge: { label: '복수전 승리', points: 500 }
};

export function calculateMissions({ board, playerColor, winner, moveCount, previousLoserWonRematch }) {
  const missions = [];
  if (winner === playerColor) missions.push({ id: 'win', ...MISSION_DEFS.win });
  if (hasOpenFour(board, playerColor)) missions.push({ id: 'open-four', ...MISSION_DEFS['open-four'] });
  if (winner === playerColor && moveCount <= 18) missions.push({ id: 'fast-win', ...MISSION_DEFS['fast-win'] });
  if (winner === playerColor && previousLoserWonRematch) missions.push({ id: 'revenge', ...MISSION_DEFS.revenge });
  return { score: missions.reduce((sum, mission) => sum + mission.points, 0), missions };
}

export function hasOpenFour(board, color) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      for (const [dr, dc] of directions) {
        const cells = [];
        for (let step = 0; step < 4; step += 1) cells.push([row + dr * step, col + dc * step]);
        if (!cells.every(([r, c]) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE)) continue;
        if (!cells.every(([r, c]) => board[r][c] === color)) continue;
        const before = [row - dr, col - dc];
        const after = [row + dr * 4, col + dc * 4];
        const beforeOpen = before[0] >= 0 && before[0] < BOARD_SIZE && before[1] >= 0 && before[1] < BOARD_SIZE && board[before[0]][before[1]] === null;
        const afterOpen = after[0] >= 0 && after[0] < BOARD_SIZE && after[1] >= 0 && after[1] < BOARD_SIZE && board[after[0]][after[1]] === null;
        if (beforeOpen && afterOpen) return true;
      }
    }
  }
  return false;
}

export function updateLocalRecord(record, { playerName, opponentName, won, score }) {
  const next = structuredClone(record || {});
  next.players ||= {};
  next.rivals ||= {};
  next.players[playerName] ||= { wins: 0, losses: 0, score: 0, streak: 0, bestStreak: 0 };
  const player = next.players[playerName];
  player.wins += won ? 1 : 0;
  player.losses += won ? 0 : 1;
  player.score += score;
  player.streak = won ? player.streak + 1 : 0;
  player.bestStreak = Math.max(player.bestStreak, player.streak);
  const key = [playerName, opponentName].sort().join('::');
  next.rivals[key] ||= { names: [playerName, opponentName].sort(), wins: 0, losses: 0 };
  if (won) next.rivals[key].wins += 1;
  else next.rivals[key].losses += 1;
  return next;
}
```

- [ ] **Step 5: Implement AI**

```js
import { getLegalMoves, getWinner, placeStone } from './rules.js';

const otherColor = (color) => (color === 'black' ? 'white' : 'black');

export function chooseAiMove(board, aiColor, difficulty = 'easy') {
  const moves = getLegalMoves(board);
  if (moves.length === 0) return null;
  const opponent = otherColor(aiColor);
  const immediateWin = findWinningMove(board, aiColor, moves);
  if (immediateWin) return immediateWin;
  const immediateBlock = findWinningMove(board, opponent, moves);
  if (immediateBlock) return immediateBlock;
  if (difficulty === 'hard') return bestScoredMove(board, aiColor, moves);
  if (difficulty === 'normal') return preferCenter(moves);
  return moves[Math.floor(Math.random() * moves.length)];
}

function findWinningMove(board, color, moves) {
  for (const [row, col] of moves) {
    const next = placeStone(board, row, col, color);
    if (getWinner(next)?.color === color) return [row, col];
  }
  return null;
}

function preferCenter(moves) {
  return moves.slice().sort((a, b) => distanceToCenter(a) - distanceToCenter(b))[0];
}

function bestScoredMove(board, color, moves) {
  const opponent = otherColor(color);
  return moves.slice().sort((a, b) => scoreMove(board, b, color, opponent) - scoreMove(board, a, color, opponent))[0];
}

function scoreMove(board, [row, col], color, opponent) {
  const centerScore = 20 - distanceToCenter([row, col]);
  return centerScore + neighborCount(board, row, col, color) * 8 + neighborCount(board, row, col, opponent) * 6;
}

function distanceToCenter([row, col]) {
  return Math.abs(row - 7) + Math.abs(col - 7);
}

function neighborCount(board, row, col, color) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      if (board[row + dr]?.[col + dc] === color) count += 1;
    }
  }
  return count;
}
```

- [ ] **Step 6: Run scoring and AI tests**

Run: `node --test tests/scoring.test.mjs tests/ai.test.mjs`

Expected: PASS.

## Task 4: Online Room State

**Files:**
- Create: `src/rooms.js`
- Create: `tests/rooms.test.mjs`

- [ ] **Step 1: Write room tests**

```js
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
```

- [ ] **Step 2: Run room tests and confirm they fail**

Run: `node --test tests/rooms.test.mjs`

Expected: FAIL with missing `src/rooms.js`.

- [ ] **Step 3: Implement room store**

```js
import { createBoard, getWinner, isBoardFull, placeStone } from './rules.js';
import { calculateMissions } from './scoring.js';

export function createRoomStore() {
  const rooms = new Map();

  function createRoom({ nickname, partyMode }) {
    const code = createCode(rooms);
    const player = createPlayer(nickname, 'black');
    const room = freshRoom(code, partyMode, [player]);
    rooms.set(code, room);
    return { room: publicRoom(room), player };
  }

  function joinRoom({ code, nickname }) {
    const room = requireRoom(rooms, code);
    if (room.players.length >= 2) throw new Error('room is full');
    const player = createPlayer(nickname, 'white');
    room.players.push(player);
    room.status = 'playing';
    return { room: publicRoom(room), player };
  }

  function place({ code, playerId, row, col }) {
    const room = requireRoom(rooms, code);
    if (room.status !== 'playing') throw new Error('room is not playing');
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('player is not in room');
    if (player.color !== room.turn) throw new Error('not your turn');
    room.board = placeStone(room.board, row, col, player.color);
    room.moves.push({ playerId, color: player.color, row, col, at: Date.now() });
    const winner = getWinner(room.board);
    if (winner || isBoardFull(room.board, room.blockedCells)) {
      room.status = 'finished';
      room.result = {
        winnerColor: winner?.color ?? null,
        winnerLine: winner?.line ?? [],
        missionsByColor: Object.fromEntries(room.players.map((seat) => [
          seat.color,
          calculateMissions({
            board: room.board,
            playerColor: seat.color,
            winner: winner?.color ?? null,
            moveCount: room.moves.length,
            previousLoserWonRematch: room.previousLoser === seat.color
          })
        ]))
      };
      if (winner) room.previousLoser = winner.color === 'black' ? 'white' : 'black';
    } else {
      room.turn = room.turn === 'black' ? 'white' : 'black';
    }
    return { room: publicRoom(room) };
  }

  function requestRematch({ code, playerId }) {
    const room = requireRoom(rooms, code);
    room.rematchRequests.add(playerId);
    if (room.players.length === 2 && room.players.every((player) => room.rematchRequests.has(player.id))) {
      const players = room.players.map((player) => ({ ...player, color: player.color === 'black' ? 'white' : 'black' }));
      const next = freshRoom(code, room.partyMode, players, room.previousLoser);
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

function freshRoom(code, partyMode, players, previousLoser = null) {
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
    previousLoser,
    updatedAt: Date.now()
  };
}

function createPlayer(nickname, color) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: String(nickname || 'Player').slice(0, 18),
    color
  };
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
    rematchRequests: Array.from(room.rematchRequests)
  };
}
```

- [ ] **Step 4: Run room tests**

Run: `node --test tests/rooms.test.mjs`

Expected: PASS.

## Task 5: HTTP Server And Realtime Events

**Files:**
- Create: `server.js`

- [ ] **Step 1: Implement server routes**

```js
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoomStore } from './src/rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const store = createRoomStore();
const subscribers = new Map();
const port = Number(process.env.PORT || 3000);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'POST' && url.pathname === '/api/rooms') return json(res, createAndBroadcast(await readJson(req)));
    if (req.method === 'POST' && url.pathname.match(/^\/api\/rooms\/[^/]+\/join$/)) return json(res, joinAndBroadcast(url, await readJson(req)));
    if (req.method === 'POST' && url.pathname.match(/^\/api\/rooms\/[^/]+\/move$/)) return json(res, moveAndBroadcast(url, await readJson(req)));
    if (req.method === 'POST' && url.pathname.match(/^\/api\/rooms\/[^/]+\/rematch$/)) return json(res, rematchAndBroadcast(url, await readJson(req)));
    if (req.method === 'GET' && url.pathname.match(/^\/api\/rooms\/[^/]+\/events$/)) return subscribe(url, res);
    return serveStatic(url, res);
  } catch (error) {
    json(res, { error: error.message }, 400);
  }
});

server.listen(port, () => {
  console.log(`Omok server running at http://localhost:${port}`);
});

function createAndBroadcast(body) {
  const result = store.createRoom({ nickname: body.nickname, partyMode: Boolean(body.partyMode) });
  broadcast(result.room.code);
  return result;
}

function joinAndBroadcast(url, body) {
  const code = roomCodeFrom(url);
  const result = store.joinRoom({ code, nickname: body.nickname });
  broadcast(code);
  return result;
}

function moveAndBroadcast(url, body) {
  const code = roomCodeFrom(url);
  const result = store.placeStone({ code, playerId: body.playerId, row: body.row, col: body.col });
  broadcast(code);
  return result;
}

function rematchAndBroadcast(url, body) {
  const code = roomCodeFrom(url);
  const result = store.requestRematch({ code, playerId: body.playerId });
  broadcast(code);
  return result;
}

function roomCodeFrom(url) {
  return url.pathname.split('/')[3].toUpperCase();
}

function subscribe(url, res) {
  const code = roomCodeFrom(url);
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(store.getRoom(code))}\n\n`);
  const set = subscribers.get(code) ?? new Set();
  set.add(res);
  subscribers.set(code, set);
  res.on('close', () => set.delete(res));
}

function broadcast(code) {
  if (!subscribers.has(code)) return;
  const payload = `data: ${JSON.stringify(store.getRoom(code))}\n\n`;
  for (const res of subscribers.get(code)) res.write(payload);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function json(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function serveStatic(url, res) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return json(res, { error: 'not found' }, 404);
  const data = await fs.readFile(filePath);
  res.writeHead(200, { 'content-type': contentType(filePath) });
  res.end(data);
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}
```

- [ ] **Step 2: Run all module tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Start the server**

Run: `npm start`

Expected: terminal prints `Omok server running at http://localhost:3000`.

## Task 6: Browser UI And Online Play

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Create HTML shell**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>온라인 오목</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create board-first CSS**

```css
:root {
  color-scheme: dark;
  --bg: #101411;
  --panel: #17211c;
  --panel-2: #223229;
  --line: #35463d;
  --text: #eef5ef;
  --muted: #a9b8ad;
  --accent: #f0bf57;
  --green: #69d89e;
  --danger: #ff7a6b;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at 18% 0%, #284033, transparent 34%), var(--bg);
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button, input, select { font: inherit; }
button {
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: #21180a;
  padding: 10px 14px;
  font-weight: 800;
  cursor: pointer;
}
button.secondary { background: #26352d; color: var(--text); border: 1px solid var(--line); }
input, select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #0f1612;
  color: var(--text);
  padding: 11px 12px;
}
#app { width: min(1180px, 100%); margin: 0 auto; padding: 24px; }
.layout { display: grid; grid-template-columns: minmax(280px, 1fr) 360px; gap: 18px; align-items: start; }
.panel { background: rgba(23, 33, 28, 0.92); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
.hero { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: center; min-height: 76vh; }
.title { font-size: clamp(32px, 6vw, 64px); line-height: 1; margin: 0 0 12px; }
.muted { color: var(--muted); line-height: 1.55; }
.actions { display: grid; gap: 10px; margin-top: 16px; }
.board-wrap { display: grid; place-items: center; }
.board {
  width: min(72vw, 660px);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  grid-template-rows: repeat(15, 1fr);
  background: #d9ad63;
  border: 3px solid #5b4020;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
}
.cell {
  position: relative;
  border-right: 1px solid rgba(74, 52, 26, 0.72);
  border-bottom: 1px solid rgba(74, 52, 26, 0.72);
  background: transparent;
  border-radius: 0;
  padding: 0;
}
.stone {
  position: absolute;
  inset: 12%;
  border-radius: 999px;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.4);
}
.black { background: #111; }
.white { background: #f3eee4; }
.winning .stone { outline: 3px solid var(--green); }
.stats { display: grid; gap: 10px; }
.stat { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.08); padding: 8px 0; }
.missions { display: grid; gap: 8px; }
.mission { border: 1px solid var(--line); border-radius: 6px; padding: 9px; background: rgba(255,255,255,.035); }
.stage-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.stage { aspect-ratio: 1; display: grid; place-items: center; border-radius: 6px; background: #26352d; border: 1px solid var(--line); }
@media (max-width: 860px) {
  #app { padding: 14px; }
  .hero, .layout { grid-template-columns: 1fr; }
  .board { width: min(94vw, 620px); }
}
```

- [ ] **Step 3: Implement browser app**

```js
import { BOARD_SIZE, createBoard, getWinner, isBoardFull, placeStone } from '/src/rules.js';
import { chooseAiMove } from '/src/ai.js';
import { calculateMissions, updateLocalRecord } from '/src/scoring.js';

const app = document.querySelector('#app');
const state = {
  nickname: localStorage.getItem('omok:nickname') || '',
  player: null,
  room: null,
  source: null,
  solo: null,
  record: JSON.parse(localStorage.getItem('omok:record') || '{}')
};

renderLobby();

function renderLobby(message = '') {
  app.innerHTML = `
    <section class="hero">
      <div>
        <h1 class="title">온라인 오목</h1>
        <p class="muted">친구와 방 코드로 바로 붙고, 연승과 미션 점수로 계속 경쟁하세요. 혼자서는 단계별 AI와 점수 목표에 도전할 수 있습니다.</p>
      </div>
      <form class="panel" id="lobby-form">
        <label>닉네임<input name="nickname" maxlength="18" value="${escapeHtml(state.nickname)}" required /></label>
        <div class="actions">
          <button name="action" value="create">방 만들기</button>
          <input name="code" placeholder="입장 코드" maxlength="4" />
          <button class="secondary" name="action" value="join">방 입장</button>
          <button class="secondary" name="action" value="solo">혼자 하기</button>
        </div>
        ${message ? `<p class="muted">${escapeHtml(message)}</p>` : ''}
      </form>
    </section>`;
  document.querySelector('#lobby-form').addEventListener('submit', onLobbySubmit);
}

async function onLobbySubmit(event) {
  event.preventDefault();
  const data = new FormData(event.submitter.form);
  const action = event.submitter.value;
  state.nickname = data.get('nickname').trim() || 'Player';
  localStorage.setItem('omok:nickname', state.nickname);
  if (action === 'solo') return startSolo();
  try {
    if (action === 'create') {
      const result = await post('/api/rooms', { nickname: state.nickname, partyMode: false });
      state.player = result.player;
      state.room = result.room;
      subscribe(result.room.code);
    } else {
      const code = data.get('code').trim().toUpperCase();
      const result = await post(`/api/rooms/${code}/join`, { nickname: state.nickname });
      state.player = result.player;
      state.room = result.room;
      subscribe(code);
    }
    renderOnline();
  } catch (error) {
    renderLobby(error.message);
  }
}

function subscribe(code) {
  if (state.source) state.source.close();
  state.source = new EventSource(`/api/rooms/${code}/events`);
  state.source.onmessage = (event) => {
    state.room = JSON.parse(event.data);
    renderOnline();
  };
}

function renderOnline() {
  const room = state.room;
  const me = room.players.find((player) => player.id === state.player.id);
  const opponent = room.players.find((player) => player.id !== state.player.id);
  app.innerHTML = `
    <section class="layout">
      <div class="board-wrap">${boardHtml(room.board, room.result?.winnerLine || [])}</div>
      <aside class="panel">
        <h2>방 ${room.code}</h2>
        <p class="muted">${room.status === 'waiting' ? '친구에게 코드를 보내주세요.' : room.status === 'finished' ? '대국 종료' : `${room.turn === me.color ? '내 차례' : '상대 차례'}`}</p>
        <div class="stats">
          <div class="stat"><span>나</span><strong>${escapeHtml(me.nickname)} (${colorLabel(me.color)})</strong></div>
          <div class="stat"><span>상대</span><strong>${opponent ? escapeHtml(opponent.nickname) : '대기 중'}</strong></div>
          <div class="stat"><span>수순</span><strong>${room.moves.length}</strong></div>
        </div>
        ${room.result ? resultHtml(room, me) : ''}
        <div class="actions">
          ${room.result ? '<button id="rematch">재대결 요청</button>' : ''}
          <button class="secondary" id="leave">로비로</button>
        </div>
      </aside>
    </section>`;
  attachBoardHandlers((row, col) => post(`/api/rooms/${room.code}/move`, { playerId: state.player.id, row, col }));
  document.querySelector('#leave')?.addEventListener('click', () => location.reload());
  document.querySelector('#rematch')?.addEventListener('click', () => post(`/api/rooms/${room.code}/rematch`, { playerId: state.player.id }));
}

function startSolo(stage = 1, difficulty = 'easy') {
  state.solo = { board: createBoard(), turn: 'black', stage, difficulty, moves: [], result: null };
  renderSolo();
}

function renderSolo() {
  const solo = state.solo;
  app.innerHTML = `
    <section class="layout">
      <div class="board-wrap">${boardHtml(solo.board, solo.result?.winnerLine || [])}</div>
      <aside class="panel">
        <h2>혼자 하기</h2>
        <p class="muted">Stage ${solo.stage} · ${solo.difficulty}</p>
        ${solo.result ? resultHtml({ ...solo, players: [{ color: 'black', nickname: state.nickname }, { color: 'white', nickname: 'AI' }] }, { color: 'black', nickname: state.nickname }) : ''}
        <div class="stage-grid">${Array.from({ length: 10 }, (_, index) => `<button class="stage" data-stage="${index + 1}">${index + 1}</button>`).join('')}</div>
        <div class="actions"><button class="secondary" id="leave">로비로</button></div>
      </aside>
    </section>`;
  attachBoardHandlers(onSoloMove);
  document.querySelector('#leave').addEventListener('click', () => renderLobby());
  document.querySelectorAll('.stage').forEach((button) => button.addEventListener('click', () => startSolo(Number(button.dataset.stage), stageDifficulty(Number(button.dataset.stage)))));
}

function onSoloMove(row, col) {
  if (state.solo.result || state.solo.board[row][col]) return;
  try {
    state.solo.board = placeStone(state.solo.board, row, col, 'black');
    state.solo.moves.push({ color: 'black', row, col });
    finishSoloIfNeeded();
    if (!state.solo.result) {
      const aiMove = chooseAiMove(state.solo.board, 'white', state.solo.difficulty);
      if (aiMove) {
        state.solo.board = placeStone(state.solo.board, aiMove[0], aiMove[1], 'white');
        state.solo.moves.push({ color: 'white', row: aiMove[0], col: aiMove[1] });
      }
      finishSoloIfNeeded();
    }
    renderSolo();
  } catch (error) {
    renderSolo();
  }
}

function finishSoloIfNeeded() {
  const winner = getWinner(state.solo.board);
  if (winner || isBoardFull(state.solo.board)) {
    state.solo.result = {
      winnerColor: winner?.color || null,
      winnerLine: winner?.line || [],
      missionsByColor: {
        black: calculateMissions({
          board: state.solo.board,
          playerColor: 'black',
          winner: winner?.color || null,
          moveCount: state.solo.moves.length,
          previousLoserWonRematch: false
        })
      }
    };
  }
}

function boardHtml(board, winnerLine) {
  const winning = new Set(winnerLine.map(([row, col]) => `${row}:${col}`));
  return `<div class="board">${board.flatMap((row, rowIndex) => row.map((cell, colIndex) => `
    <button class="cell ${winning.has(`${rowIndex}:${colIndex}`) ? 'winning' : ''}" data-row="${rowIndex}" data-col="${colIndex}">
      ${cell ? `<span class="stone ${cell}"></span>` : ''}
    </button>`)).join('')}</div>`;
}

function attachBoardHandlers(handler) {
  document.querySelectorAll('.cell').forEach((cell) => cell.addEventListener('click', () => handler(Number(cell.dataset.row), Number(cell.dataset.col))));
}

function resultHtml(room, me) {
  const missions = room.result?.missionsByColor?.[me.color]?.missions || [];
  const score = room.result?.missionsByColor?.[me.color]?.score || 0;
  return `<div class="panel">
    <h3>${room.result.winnerColor === me.color ? '승리' : room.result.winnerColor ? '패배' : '무승부'} · +${score}</h3>
    <div class="missions">${missions.map((mission) => `<div class="mission">${mission.label} +${mission.points}</div>`).join('') || '<div class="mission">완료한 미션 없음</div>'}</div>
  </div>`;
}

async function post(url, body) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '요청 실패');
  return data;
}

function colorLabel(color) {
  return color === 'black' ? '흑' : '백';
}

function stageDifficulty(stage) {
  if (stage >= 7) return 'hard';
  if (stage >= 4) return 'normal';
  return 'easy';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}
```

- [ ] **Step 4: Run server and open browser**

Run: `npm start`

Expected: `http://localhost:3000` opens to the lobby and renders without console syntax errors.

## Task 7: Local Friendly Stats, Party Toggle, And UI Polish

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `src/rooms.js`
- Modify: `tests/rooms.test.mjs`

- [ ] **Step 1: Add party room test**

```js
test('party rooms expose party mode setting', () => {
  const store = createRoomStore();
  const created = store.createRoom({ nickname: '하나', partyMode: true });
  assert.equal(created.room.partyMode, true);
});
```

- [ ] **Step 2: Add party toggle to lobby form**

```html
<label class="check"><input type="checkbox" name="partyMode" /> 선택형 파티룰 켜기</label>
```

In `onLobbySubmit`, send `partyMode: data.get('partyMode') === 'on'` when creating a room.

- [ ] **Step 3: Save friendly stats after a result**

```js
function saveOnlineResult(room, me) {
  const opponent = room.players.find((player) => player.id !== me.id);
  if (!room.result || !opponent || state.savedResultFor === `${room.code}:${room.moves.length}`) return;
  const score = room.result.missionsByColor?.[me.color]?.score || 0;
  state.record = updateLocalRecord(state.record, {
    playerName: me.nickname,
    opponentName: opponent.nickname,
    won: room.result.winnerColor === me.color,
    score
  });
  state.savedResultFor = `${room.code}:${room.moves.length}`;
  localStorage.setItem('omok:record', JSON.stringify(state.record));
}
```

Call `saveOnlineResult(room, me)` inside `renderOnline` after `me` is resolved.

- [ ] **Step 4: Show local record panel**

```js
function recordHtml(name) {
  const player = state.record.players?.[name];
  if (!player) return '<div class="stat"><span>기록</span><strong>첫 대국</strong></div>';
  return `
    <div class="stat"><span>승패</span><strong>${player.wins}승 ${player.losses}패</strong></div>
    <div class="stat"><span>연승</span><strong>${player.streak} · 최고 ${player.bestStreak}</strong></div>
    <div class="stat"><span>누적 점수</span><strong>${player.score}</strong></div>`;
}
```

Insert `${recordHtml(me.nickname)}` into the online side panel.

- [ ] **Step 5: Add CSS for checkbox and status badges**

```css
.check { display: flex; align-items: center; gap: 8px; color: var(--muted); }
.check input { width: auto; }
.badge { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; padding: 4px 9px; color: var(--muted); }
```

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS.

## Task 8: Verification And Delivery

**Files:**
- Modify only if verification reveals a concrete issue.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: PASS for `rules`, `scoring`, `ai`, and `rooms`.

- [ ] **Step 2: Start local server**

Run: `npm start`

Expected: server starts at `http://localhost:3000`.

- [ ] **Step 3: Browser smoke test**

Open `http://localhost:3000` and verify:

- Lobby shows nickname, create room, join room, solo play.
- Create room returns a four-character code.
- A second tab can join that code.
- Black and white turns alternate.
- Five stones end the match.
- Result panel shows score and mission list.
- Rematch resets the board.
- Solo mode starts and AI responds.
- Mobile viewport keeps the board visible without HUD overlap.

- [ ] **Step 4: Record limitations in final response**

Final response should mention:

- Game URL for local testing.
- Tests run and their result.
- Whether Git checkpoint was skipped because `git` is unavailable.
- The online game is ready for local network/deployment-style testing but still uses in-memory rooms.

## Self-Review

Spec coverage:

- Friend online matches: Tasks 4, 5, 6, and 8.
- Room code flow: Tasks 4, 5, and 6.
- Server-side validation and win detection: Tasks 2 and 4.
- Rematch: Tasks 4 and 6.
- Friend league stats: Task 7.
- Mission scoring: Task 3 and Task 6.
- Solo AI stages: Task 3 and Task 6.
- Optional party mode: Task 7.
- Responsive UI: Task 6 and Task 8.
- Login, cloud database, matchmaking, public leaderboard: excluded from implementation and not required for first release.

Placeholder scan:

- No incomplete placeholder markers are intentionally included.
- Every task names files, commands, and expected results.

Type consistency:

- `createBoard`, `placeStone`, `getWinner`, `isBoardFull`, and `getLegalMoves` are defined in Task 2 before use.
- `calculateMissions` and `updateLocalRecord` are defined in Task 3 before client use.
- `chooseAiMove` is defined in Task 3 before solo UI use.
- `createRoomStore` is defined in Task 4 before server use.
