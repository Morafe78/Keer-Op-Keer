// Static, shared layout for the scoreboard. This describes the *board itself*
// (colours, star cells, printed numbers) - never per-player state. Per-player
// marks (X/O/etc) live in server/board.js. Because this lives on the server
// and every client renders from it, all players always see the identical
// grid - there's no risk of it drifting between players.
//
// The main colour grid below is a hand-transcription from a photo of the
// physical scoreboard (row by row, column by column, A-O). Exact pixel
// shades don't matter - only that each cell is clearly one of the five
// colours (and whether it's a star cell) matching the same cell on the
// physical card. If you spot a cell that doesn't match your card, just
// edit its entry below (row index 0-6, column index 0-14 = A-O) and
// restart the server.

const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
const COLUMNS = COLUMN_LETTERS.length; // 15
const ROWS = 7;

// g=green, y=yellow, b=blue, p=pink, o=orange. Suffix "*" marks a star cell.
const MAIN_GRID_CODES = [
  ['g', 'g', 'g', 'y', 'y', 'y', 'y', 'g*', 'b', 'b', 'b', 'o*', 'y', 'y', 'y'],
  ['o', 'g', 'y*', 'g', 'y*', 'y', 'o', 'o', 'p', 'b*', 'b', 'o', 'o', 'g', 'g'],
  ['b*', 'g', 'p', 'g', 'g', 'g', 'g', 'p', 'p', 'p', 'y', 'y', 'o', 'g', 'g'],
  ['b', 'p', 'p', 'g', 'o', 'o*', 'b', 'b', 'g', 'g', 'y', 'y', 'o', 'p*', 'b'],
  ['p', 'o', 'o', 'o', 'o', 'o', 'p', 'b', 'o', 'g', 'g', 'y', 'y', 'o', 'p'],
  ['p', 'b*', 'b', 'p*', 'p', 'p', 'p', 'y', 'y*', 'o', 'p*', 'b', 'b', 'b', 'o*'],
  ['y', 'y', 'b*', 'b', 'b', 'b', 'p', 'y', 'y', 'y', 'g', 'g', 'g*', 'o', 'o']
];

const COLOR_CODE_MAP = { g: 'green', y: 'yellow', b: 'blue', p: 'pink', o: 'orange' };

function buildMainGrid() {
  return MAIN_GRID_CODES.map((row, r) => {
    if (row.length !== COLUMNS) {
      throw new Error(`MAIN_GRID_CODES row ${r} has ${row.length} entries, expected ${COLUMNS}`);
    }
    return row.map((code) => {
      const star = code.endsWith('*');
      const color = COLOR_CODE_MAP[star ? code.slice(0, -1) : code];
      if (!color) throw new Error(`Unknown colour code "${code}" in MAIN_GRID_CODES`);
      return { color, star };
    });
  });
}

// Read directly off the photo (both rows are palindromes).
const NUMBER_ROW_TOP = [5, 3, 3, 3, 2, 2, 2, 1, 2, 2, 2, 3, 3, 3, 5];
const NUMBER_ROW_BOTTOM = [3, 2, 2, 2, 1, 1, 1, 0, 1, 1, 1, 2, 2, 2, 3];

const EXCLAIM_COUNT = 8;

const SIDE_COLUMN_COLORS = ['green', 'yellow', 'blue', 'pink', 'orange'];
const SIDE_COLUMN_VALUES = { five: 5, three: 3 };

const SCORE_FIELDS = [
  { key: 'bonus', label: 'BONUS', sign: '=' },
  { key: 'aToO', label: 'A-O', sign: '+' },
  { key: 'exclaim', label: '! (+1)', sign: '+' },
  { key: 'star', label: '★ (-2)', sign: '-' },
  { key: 'total', label: 'TOTAAL', sign: '=' }
];

const LAYOUT = {
  columnLetters: COLUMN_LETTERS,
  rows: ROWS,
  columns: COLUMNS,
  mainGrid: buildMainGrid(),
  numberRowTop: NUMBER_ROW_TOP,
  numberRowBottom: NUMBER_ROW_BOTTOM,
  exclaimCount: EXCLAIM_COUNT,
  sideColumnColors: SIDE_COLUMN_COLORS,
  sideColumnValues: SIDE_COLUMN_VALUES,
  scoreFields: SCORE_FIELDS
};

module.exports = { LAYOUT };
