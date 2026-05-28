import { getLegalMoves, getWinner, placeStone } from './rules.js';

const otherColor = (color) => (color === 'black' ? 'white' : 'black');

export function chooseAiMove(board, aiColor, difficulty = 'easy') {
  const legalMoves = getLegalMoves(board);
  if (legalMoves.length === 0) return null;

  const opponent = otherColor(aiColor);
  const moves = difficulty === 'hard' || difficulty === 'expert'
    ? nearbyMoves(board, legalMoves)
    : legalMoves;
  const immediateWin = findWinningMove(board, aiColor, moves);
  if (immediateWin) return immediateWin;

  const immediateBlock = findWinningMove(board, opponent, moves);
  if (immediateBlock) return immediateBlock;

  if (difficulty === 'hard' || difficulty === 'expert') return bestHardMove(board, aiColor, opponent, moves, difficulty);
  if (difficulty === 'normal') return preferCenter(moves);
  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
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

function bestHardMove(board, color, opponent, moves, difficulty) {
  const forcingMove = bestThreatMove(board, color, moves);
  const defensiveMove = bestThreatMove(board, opponent, moves);
  const forcingScore = forcingMove ? tacticalValue(board, forcingMove, color) : 0;
  const defensiveScore = defensiveMove ? tacticalValue(board, defensiveMove, opponent) : 0;

  if (defensiveScore >= 12000 && defensiveScore >= forcingScore) return defensiveMove;
  if (forcingScore >= 12000) return forcingMove;
  return bestScoredMove(board, color, opponent, moves, difficulty);
}

function bestThreatMove(board, color, moves) {
  return moves
    .map((move) => ({ move, score: tacticalValue(board, move, color) }))
    .filter((candidate) => candidate.score >= 12000)
    .sort((a, b) => b.score - a.score || distanceToCenter(a.move) - distanceToCenter(b.move))[0]?.move ?? null;
}

function bestScoredMove(board, color, opponent, moves, difficulty) {
  return moves
    .map((move) => ({ move, score: scoreMove(board, move, color, opponent, difficulty) }))
    .sort((a, b) => b.score - a.score || distanceToCenter(a.move) - distanceToCenter(b.move))[0].move;
}

function scoreMove(board, [row, col], color, opponent, difficulty) {
  const centerScore = 20 - distanceToCenter([row, col]);
  const next = placeStone(board, row, col, color);
  const replyMoves = difficulty === 'expert' ? nearbyMoves(next, getLegalMoves(next)) : [];
  const givesImmediateWin = difficulty === 'expert' && findWinningMove(next, opponent, replyMoves);
  const opponentReplyThreat = difficulty === 'expert' ? strongestReplyThreat(next, opponent) : 0;
  return centerScore +
    tacticalValue(board, [row, col], color) +
    tacticalValue(board, [row, col], opponent) * 0.92 +
    neighborCount(board, row, col, color) * 8 +
    neighborCount(board, row, col, opponent) * 6 -
    (givesImmediateWin ? 500_000 : 0) -
    opponentReplyThreat * 0.72;
}

function strongestReplyThreat(board, opponent) {
  return Math.max(0, ...nearbyMoves(board, getLegalMoves(board)).map((move) => tacticalValue(board, move, opponent)));
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
