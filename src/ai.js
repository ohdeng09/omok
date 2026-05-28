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
