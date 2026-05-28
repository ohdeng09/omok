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
        for (let step = 0; step < BOARD_SIZE; step += 1) {
          const nextRow = row + dr * step;
          const nextCol = col + dc * step;
          if (!isInside(nextRow, nextCol) || board[nextRow][nextCol] !== color) break;
          line.push([nextRow, nextCol]);
        }
        if (line.length === 5) return { color, line };
      }
    }
  }

  return null;
}
