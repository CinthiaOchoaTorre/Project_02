// ============================================================
// Paradise Escape - Beach-Themed 15 Puzzle
// ------------------------------------------------------------
// This file runs the whole game in the browser:
//   - lets the player pick a name and a puzzle mode
//   - builds a 4x4 image puzzle and shuffles it (always solvable)
//   - tracks moves and time, offers a limited "Magic Hint"
//   - detects when the puzzle is solved
//   - sends the score to api.php and shows the MySQL leaderboard
// ============================================================


// ---------- Configuration ----------
const BOARD_SIZE = 4;                        // 4x4 grid
const TILE_COUNT = BOARD_SIZE * BOARD_SIZE;  // 16 slots total
const EMPTY = TILE_COUNT - 1;                // value 15 represents the empty slot
const SHUFFLE_MOVES = 200;                   // random valid moves used to shuffle
const MAX_HINTS = 3;                         // Magic Hints allowed per game

// Each puzzle mode uses its own beach photo. The image is sliced
// across the 16 tiles, so a different mode = a different picture.
const MODE_IMAGES = {
  tide: "images/tide_mode.jpg",
  breeze: "images/ocean_waves.jpg",
  sunshine: "images/sunshine_mode.jpg",
};

// Human-readable names, used on the leaderboard.
const MODE_NAMES = {
  tide: "Tide Mode",
  breeze: "Ocean Breeze Mode",
  sunshine: "Sunshine Mode",
};


// ---------- Game state ----------
let board = [];             // flat array of 16 values (0-15); 15 = empty slot
let emptyIndex = EMPTY;     // where the empty slot currently sits
let selectedMode = null;    // "tide" | "breeze" | "sunshine"
let moveCount = 0;
let gameCompleted = false;

// Timer state
let gameTimer = null;
let gameSeconds = 0;
let timerRunning = false;

// Hint state
let hintsRemaining = MAX_HINTS;


// ---------- DOM references ----------
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const boardEl = document.getElementById("puzzleBoard");
const moveCounterEl = document.getElementById("moveCounter");
const timerDisplayEl = document.getElementById("timerDisplay");
const hintCounterEl = document.getElementById("hintCounter");
const winMessageEl = document.getElementById("winMessage");
const leaderboardResultsEl = document.getElementById("leaderboardResults");


// ============================================================
// Mode selection -> start a new game
// ============================================================
document.querySelectorAll(".mode-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;
    setupPanel.hidden = true;
    gamePanel.hidden = false;
    startNewGame();
  });
});


// ============================================================
// Building and shuffling the board
// ============================================================

// The solved board is just 0,1,2,...,15 in order.
function createSolvedBoard() {
  return Array.from({ length: TILE_COUNT }, (_, i) => i);
}

// Start (or restart) a game: solved board -> shuffle -> reset all counters.
function startNewGame() {
  board = createSolvedBoard();
  emptyIndex = EMPTY;
  shuffleBoard();

  resetTimer();
  resetHints();
  winMessageEl.hidden = true;
  gameCompleted = false;

  render();
  updateMoveCounter();
}

// A random slide-puzzle is only solvable for half of all tile orders,
// so instead of shuffling the numbers directly we start from the solved
// board and make many random *legal* moves. Every board reached this way
// is guaranteed solvable.
function shuffleBoard() {
  for (let i = 0; i < SHUFFLE_MOVES; i++) {
    const neighbors = getMovableIndexes(emptyIndex);
    const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    swapTiles(randomNeighbor, emptyIndex);
  }
  moveCount = 0; // shuffling should not count as player moves
}


// ============================================================
// Movement logic
// ============================================================

function getRowCol(index) {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

// Indexes of the tiles directly above/below/left/right of the empty slot.
function getMovableIndexes(empty) {
  const { row, col } = getRowCol(empty);
  const candidates = [];

  if (row > 0) candidates.push(empty - BOARD_SIZE);             // tile above
  if (row < BOARD_SIZE - 1) candidates.push(empty + BOARD_SIZE); // tile below
  if (col > 0) candidates.push(empty - 1);                       // tile to the left
  if (col < BOARD_SIZE - 1) candidates.push(empty + 1);          // tile to the right

  return candidates;
}

function isAdjacentToEmpty(index) {
  return getMovableIndexes(emptyIndex).includes(index);
}

// Swap two board slots and keep track of where the empty slot moved to.
function swapTiles(a, b) {
  [board[a], board[b]] = [board[b], board[a]];
  if (board[a] === EMPTY) emptyIndex = a;
  if (board[b] === EMPTY) emptyIndex = b;
}

// Runs when the player clicks a tile.
function handleTileClick(index) {
  if (gameCompleted) return;
  if (!isAdjacentToEmpty(index)) return; // not next to the empty slot -> ignore

  swapTiles(index, emptyIndex);
  moveCount++;
  updateMoveCounter();

  // Start the timer on the very first move of the game.
  if (moveCount === 1) startTimer();

  render();

  if (isSolved()) handleWin();
}

// The board is solved when every value sits in its own index (0 at 0, etc.).
function isSolved() {
  return board.every((value, index) => value === index);
}


// ============================================================
// Winning: stop the clock, show a message, save the score
// ============================================================
function handleWin() {
  if (gameCompleted) return;
  gameCompleted = true;

  stopTimer();

  winMessageEl.hidden = false;
  winMessageEl.textContent =
    `You solved it in ${moveCount} moves and ${formatTime(gameSeconds)}!`;

  saveGameScore();
}


// ============================================================
// Rendering the board as image tiles
// ============================================================
function render() {
  boardEl.innerHTML = "";
  const imageUrl = MODE_IMAGES[selectedMode];

  board.forEach((value, index) => {
    const tile = document.createElement("div");
    tile.classList.add("tile");

    if (value === EMPTY) {
      tile.classList.add("empty");
    } else {
      // A tile's picture slice is decided by its *solved* position (value),
      // not where it currently sits. background-size 400% makes the full
      // image span 4 tiles; the position picks which quarter to show.
      const solvedRow = Math.floor(value / BOARD_SIZE);
      const solvedCol = value % BOARD_SIZE;

      tile.style.backgroundImage = `url("${imageUrl}")`;
      tile.style.backgroundSize = `${BOARD_SIZE * 100}% ${BOARD_SIZE * 100}%`;
      tile.style.backgroundPosition =
        `${(solvedCol / (BOARD_SIZE - 1)) * 100}% ${(solvedRow / (BOARD_SIZE - 1)) * 100}%`;

      tile.addEventListener("click", () => handleTileClick(index));
    }

    boardEl.appendChild(tile);
  });
}

function updateMoveCounter() {
  moveCounterEl.textContent = `Moves: ${moveCount}`;
}


// ============================================================
// Timer
// ============================================================

// Format a number of seconds as MM:SS.
function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTimerDisplay() {
  timerDisplayEl.textContent = `Time: ${formatTime(gameSeconds)}`;
}

function startTimer() {
  if (timerRunning || gameCompleted) return;
  timerRunning = true;
  gameTimer = setInterval(() => {
    gameSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(gameTimer);
  gameTimer = null;
  timerRunning = false;
}

function resetTimer() {
  stopTimer();
  gameSeconds = 0;
  updateTimerDisplay();
}


// ============================================================
// Magic Hint (limited to MAX_HINTS per game)
// Briefly highlights a tile the player is allowed to move.
// ============================================================
function updateHintDisplay() {
  hintCounterEl.textContent = `Hints: ${hintsRemaining}`;
}

function resetHints() {
  hintsRemaining = MAX_HINTS;
  updateHintDisplay();
  clearHintHighlight();
}

function clearHintHighlight() {
  document.querySelectorAll(".magic-hint").forEach((tile) => {
    tile.classList.remove("magic-hint");
  });
}

function showMagicHint() {
  if (gameCompleted) return;

  if (hintsRemaining <= 0) {
    alert("You have used all 3 Magic Hints!");
    return;
  }

  const movableIndexes = getMovableIndexes(emptyIndex);
  if (movableIndexes.length === 0) return;

  const randomIndex =
    movableIndexes[Math.floor(Math.random() * movableIndexes.length)];
  const tile = document.querySelectorAll("#puzzleBoard .tile")[randomIndex];
  if (!tile) return;

  hintsRemaining--;
  updateHintDisplay();

  tile.classList.add("magic-hint");
  setTimeout(() => tile.classList.remove("magic-hint"), 2000);
}


// ============================================================
// Controls: Shuffle / Reset / Magic Hint
// ============================================================
document.getElementById("shuffleBtn").addEventListener("click", startNewGame);
document.getElementById("resetBtn").addEventListener("click", startNewGame);
document.getElementById("hintBtn").addEventListener("click", showMagicHint);


// ============================================================
// Leaderboard: save a score, then reload the table from MySQL
// ============================================================
function saveGameScore() {
  const playerName = document.getElementById("playerName").value.trim();
  if (playerName === "") return; // name is optional to play, required to save

  const scoreData = {
    playerName: playerName,
    mode: selectedMode,
    moves: moveCount,
    time: gameSeconds,
  };

  fetch("api/save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scoreData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        loadLeaderboard();
      } else {
        console.error(data.message);
      }
    })
    .catch((error) => console.error("Unable to save score:", error));
}

function loadLeaderboard() {
  fetch("api/list.php")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        leaderboardResultsEl.textContent = "Unable to load leaderboard.";
        return;
      }

      if (!data.scores || data.scores.length === 0) {
        leaderboardResultsEl.textContent = "No scores yet. Be the first to play!";
        return;
      }

      renderLeaderboardTable(data.scores);
    })
    .catch((error) => {
      console.error("Unable to load leaderboard:", error);
      leaderboardResultsEl.textContent = "Leaderboard unavailable.";
    });
}

function renderLeaderboardTable(scores) {
  leaderboardResultsEl.innerHTML = "";

  const table = document.createElement("table");
  table.className = "leaderboard-table";

  // Header row
  const headerRow = document.createElement("tr");
  ["Rank", "Player", "Mode", "Moves", "Time", "Date"].forEach((title) => {
    const th = document.createElement("th");
    th.textContent = title;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // One row per score
  scores.forEach((player, index) => {
    const row = document.createElement("tr");
    const cells = [
      index + 1,
      player.playerName,
      MODE_NAMES[player.mode] || player.mode,
      player.moves,
      formatTime(player.time),
      player.completedAt,
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      row.appendChild(td);
    });

    table.appendChild(row);
  });

  leaderboardResultsEl.appendChild(table);
}


// ---------- Page load ----------
updateTimerDisplay();
updateHintDisplay();
loadLeaderboard();
