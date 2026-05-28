import { getLegalMoves, getWinner, placeStone } from './rules.js';

const otherColor = (color) => (color === 'black' ? 'white' : 'black');

export function chooseAiMove(board, aiColor, difficulty = 'easy') {
  const legalMoves = getLegalMoves(board);
  if (legalMoves.length === 0) return null;

  const opponent = otherColor(aiColor);
  const level = aiLevel(difficulty);
  const moves = nearbyMoves(board, legalMoves, level >= 8 ? 3 : 2);
  const immediateWin = findWinningMove(board, aiColor, moves);
  if (immediateWin) return immediateWin;

  const immediateBlock = findWinningMove(board, opponent, moves);
  if (immediateBlock) return immediateBlock;

  return bestLevelMove(board, aiColor, opponent, moves, level);
}

function aiLevel(difficulty) {
  if (typeof difficulty === 'number') return clampLevel(difficulty);
  const levelMatch = String(difficulty).match(/level-(\d+)/);
  if (levelMatch) return clampLevel(Number(levelMatch[1]));
  if (difficulty === 'expert') return 10;
  if (difficulty === 'hard') return 8;
  if (difficulty === 'normal') return 5;
  return 2;
}

function clampLevel(level) {
  return Math.max(1, Math.min(10, Number.isFinite(level) ? Math.round(level) : 1));
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

function bestLevelMove(board, color, opponent, moves, level) {
  const forcingMove = bestThreatMove(board, color, moves);
  const defensiveMove = bestThreatMove(board, opponent, moves);
  const forcingScore = forcingMove ? tacticalValue(board, forcingMove, color) : 0;
  const defensiveScore = defensiveMove ? tacticalValue(board, defensiveMove, opponent) : 0;
  const defenseThreshold = threatThreshold(level);

  if (defensiveScore >= defenseThreshold && shouldDefend(defensiveScore, forcingScore, level)) return defensiveMove;
  if (forcingScore >= attackThreshold(level)) return forcingMove;
  return bestScoredMove(board, color, opponent, moves, level);
}

function bestThreatMove(board, color, moves) {
  return moves
    .map((move) => ({ move, score: tacticalValue(board, move, color) }))
    .filter((candidate) => candidate.score >= 1000)
    .sort((a, b) => b.score - a.score || distanceToCenter(a.move) - distanceToCenter(b.move))[0]?.move ?? null;
}

function shouldDefend(defensiveScore, forcingScore, level) {
  if (defensiveScore >= 60_000) return defensiveScore >= forcingScore * 0.8;
  if (level >= 6 && defensiveScore >= 18_000) return defensiveScore >= forcingScore * 0.7;
  if (level >= 3 && defensiveScore >= 18_000) return defensiveScore >= forcingScore;
  return defensiveScore >= forcingScore * 1.15;
}

function threatThreshold(level) {
  if (level >= 6) return 4_000;
  if (level >= 3) return 18_000;
  return 60_000;
}

function attackThreshold(level) {
  if (level >= 7) return 4_000;
  if (level >= 4) return 18_000;
  return 60_000;
}

function bestScoredMove(board, color, opponent, moves, level) {
  return moves
    .map((move) => ({ move, score: scoreMove(board, move, color, opponent, level) }))
    .sort((a, b) => b.score - a.score || distanceToCenter(a.move) - distanceToCenter(b.move))[0].move;
}

function scoreMove(board, [row, col], color, opponent, level) {
  const centerScore = (20 - distanceToCenter([row, col])) * Math.max(2, 12 - level);
  const next = placeStone(board, row, col, color);
  const replyMoves = level >= 3 ? nearbyMoves(next, getLegalMoves(next), level >= 8 ? 3 : 2) : [];
  const givesImmediateWin = level >= 3 && findWinningMove(next, opponent, replyMoves);
  const opponentReplyThreat = level >= 5 ? strongestReplyThreat(next, opponent, replyMoves) : 0;
  const ownFork = level >= 5 ? forkPotential(next, color) : 0;
  const opponentFork = level >= 7 ? forkPotential(next, opponent) : 0;
  const attackWeight = 0.8 + level * 0.11;
  const defenseWeight = 0.95 + level * 0.14;
  return centerScore +
    tacticalValue(board, [row, col], color) * attackWeight +
    tacticalValue(board, [row, col], opponent) * defenseWeight +
    ownFork * (level >= 8 ? 0.45 : 0.25) -
    opponentFork * (level >= 9 ? 0.75 : 0.45) +
    neighborCount(board, row, col, color) * (6 + level) +
    neighborCount(board, row, col, opponent) * (7 + level) -
    (givesImmediateWin ? 500_000 : 0) -
    opponentReplyThreat * (level >= 9 ? 0.92 : 0.65);
}

function strongestReplyThreat(board, opponent, moves = nearbyMoves(board, getLegalMoves(board))) {
  return Math.max(0, ...moves.map((move) => tacticalValue(board, move, opponent)));
}

function forkPotential(board, color) {
  const threats = nearbyMoves(board, getLegalMoves(board), 2)
    .map((move) => tacticalValue(board, move, color))
    .filter((score) => score >= 18_000)
    .sort((a, b) => b - a);
  if (threats.length < 2) return threats[0] || 0;
  return threats[0] + threats[1] * 0.85 + threats.length * 1_500;
}

function nearbyMoves(board, legalMoves, radius = 2) {
  const occupied = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col]) occupied.push([row, col]);
    }
  }
  if (occupied.length === 0) return [preferCenter(legalMoves)];

  const legal = new Set(legalMoves.map(([row, col]) => `${row}:${col}`));
  const candidates = new Set();
  for (const [stoneRow, stoneCol] of occupied) {
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const row = stoneRow + dr;
        const col = stoneCol + dc;
        const key = `${row}:${col}`;
        if (legal.has(key)) candidates.add(key);
      }
    }
  }

  const moves = Array.from(candidates, (key) => key.split(':').map(Number));
  return moves.length ? moves : legalMoves;
}

function tacticalValue(board, [row, col], color) {
  if (board[row][col] !== null) return -Infinity;
  const next = placeStone(board, row, col, color);
  if (getWinner(next)?.color === color) return 1_000_000;

  const lineScores = lineStats(next, row, col, color).map(({ count, openEnds }) => {
    if (count >= 4 && openEnds >= 2) return 90_000;
    if (count >= 4 && openEnds >= 1) return 60_000;
    if (count === 3 && openEnds >= 2) return 18_000;
    if (count === 3 && openEnds === 1) return 4_000;
    if (count === 2 && openEnds >= 2) return 1_200;
    if (count === 2 && openEnds === 1) return 250;
    return 0;
  }).sort((a, b) => b - a);
  return lineScores[0] + lineScores.slice(1).reduce((sum, score) => sum + score * 0.45, 0);
}

function lineStats(board, row, col, color) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  return directions.map(([dr, dc]) => {
    const forward = countDirection(board, row, col, dr, dc, color);
    const backward = countDirection(board, row, col, -dr, -dc, color);
    const afterForward = [row + dr * (forward + 1), col + dc * (forward + 1)];
    const afterBackward = [row - dr * (backward + 1), col - dc * (backward + 1)];
    const openEnds = Number(isOpen(board, afterForward[0], afterForward[1])) +
      Number(isOpen(board, afterBackward[0], afterBackward[1]));
    return { count: 1 + forward + backward, openEnds };
  });
}

function countDirection(board, row, col, dr, dc, color) {
  let count = 0;
  let nextRow = row + dr;
  let nextCol = col + dc;
  while (board[nextRow]?.[nextCol] === color) {
    count += 1;
    nextRow += dr;
    nextCol += dc;
  }
  return count;
}

function isOpen(board, row, col) {
  return board[row]?.[col] === null;
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
