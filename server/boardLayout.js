// Static, shared layout for the scoreboard. This describes the *board itself*
// (colours, star cells, printed numbers) - never per-player state. Per-player
// marks (X/O/etc) live in server/board.js.
//
// NOTE: The main colour grid below is a best-effort placeholder reconstructed
// from a photo of the physical scoreboard, not a guaranteed pixel-perfect
// transcription (there was no reliable way to verify every single cell's
// colour/star from the image). It is fully data-driven so it's a quick fix:
// edit MAIN_GRID_COLOR_AT/MAIN_GRID_STARS below (or replace the generator
// with a hand-typed 7x15 array) to match your physical card exactly, then
// restart the server. Everything else on this page (the two number rows,
// the exclamation row, and the five colour side-columns) was read directly
// off the photo and should be accurate.

const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
const COLUMNS = COLUMN_LETTERS.length; // 15
const ROWS = 7;

const COLORS = ['green', 'yellow', 'blue', 'pink', 'orange'];

// Deterministic placeholder pattern (see note above) - same every time the
// server starts, so it's stable to look at and easy to hand-edit.
function buildMainGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLUMNS; c++) {
      const color = COLORS[(r + c) % COLORS.length];
      const star = (r * COLUMNS + c) % 11 === 0;
      row.push({ color, star });
    }
    grid.push(row);
  }
  return grid;
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
