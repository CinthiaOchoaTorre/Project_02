// ================= Paradise Escape - Core Puzzle Logic =================
// Days 3-5 deliverable: board state, rendering, tile movement, solvable
// shuffle, and reset. (Timer, move counter wiring, and Magic Hint are
// Days 6-7 and will be added on top of this.)

const BOARD_SIZE = 4;               // 4x4 grid
const EMPTY = BOARD_SIZE * BOARD_SIZE - 1; // 15 = the empty slot's value

let board = [];        // flat array of length 16, values 0-15 (15 = empty)
let emptyIndex = EMPTY;
let selectedMode = null;
let moveCount = 0;

const boardEl = document.getElementById("puzzleBoard");
const moveCounterEl = document.getElementById("moveCounter");
const winMessageEl = document.getElementById("winMessage");

// ---------- Setup: mode selection ----------
document.querySelectorAll(".mode-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;
    document.getElementById("setup-panel").hidden = true;
    document.getElementById("game-panel").hidden = false;
    startNewGame();
  });
});

// ---------- Board creation ----------
function createSolvedBoard() {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i);
}

function startNewGame() {
  board = createSolvedBoard();
  emptyIndex = EMPTY;
  moveCount = 0;
  shuffleBoard();
  render();
}

// ---------- Solvable shuffle ----------
// Instead of randomizing tile order directly (which can produce an
// unsolvable arrangement), we shuffle by making many random *valid* moves
// starting from the solved state. Every board reached this way is
// guaranteed solvable.
function shuffleBoard() {
  const SHUFFLE_MOVES = 200;
  for (let i = 0; i < SHUFFLE_MOVES; i++) {
    const neighbors = getMovableIndexes(emptyIndex);
    const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    swapTiles(randomNeighbor, emptyIndex);
  }
  moveCount = 0; // shuffling itself doesn't count toward the player's moves
}

// ---------- Movement logic ----------
function getRowCol(index) {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

function getMovableIndexes(empty) {
  const { row, col } = getRowCol(empty);
  const candidates = [];

  if (row > 0) candidates.push(empty - BOARD_SIZE);            // above
  if (row < BOARD_SIZE - 1) candidates.push(empty + BOARD_SIZE); // below
  if (col > 0) candidates.push(empty - 1);                      // left
  if (col < BOARD_SIZE - 1) candidates.push(empty + 1);         // right

  return candidates;
}

function isAdjacentToEmpty(index) {
  return getMovableIndexes(emptyIndex).includes(index);
}

function swapTiles(a, b) {
  [board[a], board[b]] = [board[b], board[a]];
  if (board[a] === EMPTY) emptyIndex = a;
  if (board[b] === EMPTY) emptyIndex = b;
}

function handleTileClick(index) {
  if (!isAdjacentToEmpty(index)) return; // invalid move, ignore

  swapTiles(index, emptyIndex);
  moveCount++;
  updateMoveCounter();
  render();

  if (isSolved()) {
    showWinMessage();
  }
}

// ---------- Solved-state check ----------
function isSolved() {
  return board.every((value, index) => value === index);
}

// ---------- Rendering ----------
function render() {
  boardEl.innerHTML = "";

  board.forEach((value, index) => {
    const tile = document.createElement("div");
    tile.classList.add("tile");

    if (value === EMPTY) {
      tile.classList.add("empty");
    } else {
      tile.textContent = value + 1; // placeholder numeric label
      tile.addEventListener("click", () => handleTileClick(index));
    }

    boardEl.appendChild(tile);
  });
}

function updateMoveCounter() {
  moveCounterEl.textContent = `Moves: ${moveCount}`;
}

function showWinMessage() {
  winMessageEl.hidden = false;
  winMessageEl.textContent = `Solved in ${moveCount} moves!`;
  // Score-saving to the PHP/MySQL leaderboard API is added in Days 8-9.
}

// ---------- Controls: Shuffle / Reset ----------
document.getElementById("shuffleBtn").addEventListener("click", () => {
  winMessageEl.hidden = true;
  moveCount = 0;
  updateMoveCounter();
  shuffleBoard();
  render();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  winMessageEl.hidden = true;
  startNewGame();
  updateMoveCounter();
});
