const { LAYOUT } = require('./boardLayout');

function createBoard() {
  return {
    mainGrid: Array.from({ length: LAYOUT.rows }, () => Array(LAYOUT.columns).fill(false)),
    numberRowTop: Array(LAYOUT.columns).fill('blank'),
    numberRowBottom: Array(LAYOUT.columns).fill('blank'),
    exclaimRow: Array(LAYOUT.exclaimCount).fill(false),
    sideColumns: LAYOUT.sideColumnColors.map((color) => ({ color, five: 'blank', three: 'blank' })),
    scores: LAYOUT.scoreFields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  };
}

const TRISTATE = ['blank', 'X', 'O'];
function cycleTristate(value) {
  const idx = TRISTATE.indexOf(value);
  return TRISTATE[(idx + 1) % TRISTATE.length];
}

// Applies a single click/edit to a player's board. Throws on malformed input.
// This intentionally does NOT validate game rules (which cells "should" be
// markable) - the app is a faithful digital scoresheet, not a rules referee.
function applyBoardUpdate(board, action) {
  const { section } = action;

  if (section === 'mainGrid') {
    const { row, col } = action;
    if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error('bad cell');
    if (row < 0 || row >= LAYOUT.rows || col < 0 || col >= LAYOUT.columns) throw new Error('out of range');
    board.mainGrid[row][col] = !board.mainGrid[row][col];
    return;
  }

  if (section === 'numberRowTop' || section === 'numberRowBottom') {
    const { col } = action;
    if (!Number.isInteger(col) || col < 0 || col >= LAYOUT.columns) throw new Error('out of range');
    board[section][col] = cycleTristate(board[section][col]);
    return;
  }

  if (section === 'exclaimRow') {
    const { index } = action;
    if (!Number.isInteger(index) || index < 0 || index >= LAYOUT.exclaimCount) throw new Error('out of range');
    board.exclaimRow[index] = !board.exclaimRow[index];
    return;
  }

  if (section === 'sideColumn') {
    const { colorIndex, column } = action;
    if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex >= board.sideColumns.length) {
      throw new Error('out of range');
    }
    if (column !== 'five' && column !== 'three') throw new Error('bad column');
    const entry = board.sideColumns[colorIndex];
    entry[column] = cycleTristate(entry[column]);
    return;
  }

  if (section === 'score') {
    const { key, value } = action;
    const field = LAYOUT.scoreFields.find((f) => f.key === key);
    if (!field) throw new Error('bad score field');
    if (value === '' || value === null || value === undefined) {
      board.scores[key] = '';
      return;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > 50) throw new Error('score out of range');
    board.scores[key] = Math.round(num);
    return;
  }

  throw new Error('unknown section');
}

module.exports = { createBoard, applyBoardUpdate };
