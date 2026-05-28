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

  return {
    score: missions.reduce((sum, mission) => sum + mission.points, 0),
    missions
  };
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
        const beforeOpen = isOpen(board, before[0], before[1]);
        const afterOpen = isOpen(board, after[0], after[1]);
        if (beforeOpen && afterOpen) return true;
      }
    }
  }

  return false;
}

export function updateLocalRecord(record, { playerName, opponentName, won, score }) {
  const next = cloneRecord(record || {});
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

function isOpen(board, row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === null;
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}
