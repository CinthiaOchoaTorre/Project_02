// ============================================================
// Paradise Escape - Beach-Themed Sliding Puzzle
// ------------------------------------------------------------
// This file runs the whole game in the browser:
//   - lets the player pick a name, a difficulty and a puzzle mode
//   - builds an N x N image puzzle and shuffles it (always solvable)
//   - tracks moves and time, offers a limited "Magic Hint"
//   - detects when the puzzle is solved
//   - saves every score to localStorage first, then syncs it to
//     MySQL through api/save.php, and shows the leaderboard from
//     api/list.php (falling back to the local copy if the server
//     or database is unreachable)
// ============================================================


// ---------- Configuration ----------

// Difficulty controls the board size, how badly the board is
// scrambled, and how many Magic Hints the player gets.
const DIFFICULTIES = {
  easy:   { label: "Easy",   size: 3, shuffleMoves: 80,  hints: 5 },
  medium: { label: "Medium", size: 4, shuffleMoves: 200, hints: 3 },
  hard:   { label: "Hard",   size: 5, shuffleMoves: 400, hints: 2 },
};

const DEFAULT_DIFFICULTY = "medium";

// Each puzzle mode uses its own beach photo. The image is sliced
// across the tiles, so a different mode = a different picture.
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

// Where local (offline) scores live in the browser.
const STORAGE_KEY = "paradiseEscapeScores";
const MAX_LOCAL_SCORES = 50;   // keep the local history from growing forever
const LEADERBOARD_SIZE = 10;


// ---------- Game state ----------
let boardSize = DIFFICULTIES[DEFAULT_DIFFICULTY].size; // tiles per row/column
let tileCount = boardSize * boardSize;                 // total slots
let emptyValue = tileCount - 1;                        // value that marks the empty slot

let board = [];             // flat array of tile values; emptyValue = empty slot
let startingBoard = [];     // snapshot taken right after the shuffle (used by Reset)
let emptyIndex = 0;         // where the empty slot currently sits

let selectedMode = null;                    // "tide" | "breeze" | "sunshine"
let selectedDifficulty = DEFAULT_DIFFICULTY; // "easy" | "medium" | "hard"

let moveCount = 0;
let gameCompleted = false;

// Timer state
let gameTimer = null;
let gameSeconds = 0;
let timerRunning = false;

// Hint state
let maxHints = DIFFICULTIES[DEFAULT_DIFFICULTY].hints;
let hintsRemaining = maxHints;


// ---------- DOM references ----------
const setupPanel = document.getElementById("setup-panel");
const gamePanel = document.getElementById("game-panel");
const boardEl = document.getElementById("puzzleBoard");
const moveCounterEl = document.getElementById("moveCounter");
const timerDisplayEl = document.getElementById("timerDisplay");
const hintCounterEl = document.getElementById("hintCounter");
const difficultyDisplayEl = document.getElementById("difficultyDisplay");
const winMessageEl = document.getElementById("winMessage");
const referenceImageEl = document.getElementById("referenceImage");
const playerNameInput = document.getElementById("playerName");
const leaderboardResultsEl = document.getElementById("leaderboardResults");
const storageNoticeEl = document.getElementById("storageNotice");


// ============================================================
// Difficulty selection
// ============================================================
document.querySelectorAll(".difficulty-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDifficulty = btn.dataset.difficulty;

    // Highlight the chosen card and un-highlight the others.
    document.querySelectorAll(".difficulty-card").forEach((card) => {
      const isChosen = card === btn;
      card.classList.toggle("is-selected", isChosen);
      card.setAttribute("aria-pressed", isChosen ? "true" : "false");
    });
  });
});

// Apply a difficulty to the game state (board size, hint budget).
function applyDifficulty(key) {
  const settings = DIFFICULTIES[key] || DIFFICULTIES[DEFAULT_DIFFICULTY];

  boardSize = settings.size;
  tileCount = boardSize * boardSize;
  emptyValue = tileCount - 1;
  maxHints = settings.hints;

  difficultyDisplayEl.textContent =
    `Difficulty: ${settings.label} (${boardSize}×${boardSize})`;

  // The board is a CSS grid, so the column/row count has to follow
  // the difficulty instead of being hard-coded at 4.
  boardEl.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${boardSize}, 1fr)`;
}


// ============================================================
// Mode selection -> start a new game
// ============================================================
document.querySelectorAll(".mode-card").forEach((btn) => {
  btn.addEventListener("click", () => {
    // A name is required before any game can start.
    const name = playerNameInput.value.trim();
    if (name === "") {
      alert("Please enter your name before starting a game.");
      playerNameInput.focus();
      return;
    }

    selectedMode = btn.dataset.mode;
    applyDifficulty(selectedDifficulty);

    setupPanel.hidden = true;
    gamePanel.hidden = false;
    startNewGame();
  });
});


// ============================================================
// Building and shuffling the board
// ============================================================

// The solved board is just 0,1,2,...,n in order.
function createSolvedBoard() {
  return Array.from({ length: tileCount }, (_, i) => i);
}

// SHUFFLE: throw away the current puzzle and scramble a brand-new one.
function startNewGame() {
  board = createSolvedBoard();
  emptyIndex = emptyValue;

  // Show the full picture for this mode as a "goal" reference.
  referenceImageEl.src = MODE_IMAGES[selectedMode];

  shuffleBoard();

  // Remember this exact scramble so Reset can bring it back.
  startingBoard = board.slice();

  resetProgress();
}

// RESET: put the *same* puzzle back to the layout it started with.
// This is what makes Reset different from Shuffle - the picture and
// the scramble stay identical, only your progress is wiped.
function resetCurrentGame() {
  if (startingBoard.length === 0) return; // nothing has been played yet

  board = startingBoard.slice();
  emptyIndex = board.indexOf(emptyValue);

  resetProgress();
}

// Shared by Shuffle and Reset: zero the counters and redraw.
function resetProgress() {
  moveCount = 0;
  gameCompleted = false;

  resetTimer();
  resetHints();
  winMessageEl.hidden = true;

  render();
  updateMoveCounter();
}

// A random slide-puzzle is only solvable for half of all tile orders,
// so instead of shuffling the numbers directly we start from the solved
// board and make many random *legal* moves. Every board reached this way
// is guaranteed solvable.
function shuffleBoard() {
  const shuffleMoves = DIFFICULTIES[selectedDifficulty].shuffleMoves;

  for (let i = 0; i < shuffleMoves; i++) {
    const neighbors = getMovableIndexes(emptyIndex);
    const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
    swapTiles(randomNeighbor, emptyIndex);
  }

  // A scramble can (rarely) land back on the solved board - reshuffle if so.
  if (isSolved()) shuffleBoard();
}


// ============================================================
// Movement logic
// ============================================================

function getRowCol(index) {
  return { row: Math.floor(index / boardSize), col: index % boardSize };
}

// Indexes of the tiles directly above/below/left/right of the empty slot.
function getMovableIndexes(empty) {
  const { row, col } = getRowCol(empty);
  const candidates = [];

  if (row > 0) candidates.push(empty - boardSize);             // tile above
  if (row < boardSize - 1) candidates.push(empty + boardSize); // tile below
  if (col > 0) candidates.push(empty - 1);                     // tile to the left
  if (col < boardSize - 1) candidates.push(empty + 1);         // tile to the right

  return candidates;
}

function isAdjacentToEmpty(index) {
  return getMovableIndexes(emptyIndex).includes(index);
}

// Swap two board slots and keep track of where the empty slot moved to.
function swapTiles(a, b) {
  [board[a], board[b]] = [board[b], board[a]];
  if (board[a] === emptyValue) emptyIndex = a;
  if (board[b] === emptyValue) emptyIndex = b;
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
    `You solved the ${DIFFICULTIES[selectedDifficulty].label} puzzle in ` +
    `${moveCount} moves and ${formatTime(gameSeconds)}!`;

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

    if (value === emptyValue) {
      tile.classList.add("empty");
    } else {
      // A tile's picture slice is decided by its *solved* position (value),
      // not where it currently sits. Sizing the background to N x 100%
      // makes the full image span the whole board; the position picks
      // which slice this tile shows.
      const solvedRow = Math.floor(value / boardSize);
      const solvedCol = value % boardSize;

      tile.style.backgroundImage = `url("${imageUrl}")`;
      tile.style.backgroundSize = `${boardSize * 100}% ${boardSize * 100}%`;
      tile.style.backgroundPosition =
        `${(solvedCol / (boardSize - 1)) * 100}% ${(solvedRow / (boardSize - 1)) * 100}%`;

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
// Magic Hint (budget depends on the difficulty)
// Briefly highlights a tile the player is allowed to move.
// ============================================================
function updateHintDisplay() {
  hintCounterEl.textContent = `Hints: ${hintsRemaining}`;
}

function resetHints() {
  hintsRemaining = maxHints;
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
    alert(`You have used all ${maxHints} Magic Hints for this difficulty!`);
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
// Controls
// ============================================================
document.getElementById("shuffleBtn").addEventListener("click", startNewGame);
document.getElementById("resetBtn").addEventListener("click", resetCurrentGame);
document.getElementById("hintBtn").addEventListener("click", showMagicHint);
document.getElementById("giveUpBtn").addEventListener("click", giveUp);
document.getElementById("menuBtn").addEventListener("click", backToMenu);

// Give Up: record the current attempt as "Did Not Finish" and return to setup.
function giveUp() {
  if (gameCompleted) return; // already solved this game, nothing to give up

  const confirmed = confirm("Give up this puzzle? It will be saved as 'Did Not Finish'.");
  if (!confirmed) return;

  gameCompleted = true;
  stopTimer();
  saveGameScore("dnf");

  backToMenu();
}

// Return to the setup screen (to change difficulty, mode or name).
function backToMenu() {
  stopTimer();
  gamePanel.hidden = true;
  setupPanel.hidden = false;
}


// ============================================================
// Local storage fallback
// ------------------------------------------------------------
// Every finished game is written to the browser FIRST, so a score
// is never lost when PHP/MySQL is unavailable. Records that have
// not reached the database yet are marked `synced: false` and are
// retried on the next page load.
// ============================================================

// Some browsers (private mode) block localStorage - detect it once.
const storageAvailable = (function () {
  try {
    const probe = "__paradise_test__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
})();

function readLocalScores() {
  if (!storageAvailable) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Local scores were unreadable:", error);
    return [];
  }
}

function writeLocalScores(scores) {
  if (!storageAvailable) return;
  try {
    // Keep only the most recent records so storage cannot grow forever.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores.slice(-MAX_LOCAL_SCORES)));
  } catch (error) {
    console.error("Could not write local scores:", error);
  }
}

// "2026-08-05 14:03:27" - same shape as the MySQL timestamp so both
// kinds of row look identical on the leaderboard.
function localTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
         `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function storeScoreLocally(score) {
  const record = {
    ...score,
    localId: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    completedAt: localTimestamp(),
    synced: false,
  };

  const scores = readLocalScores();
  scores.push(record);
  writeLocalScores(scores);

  return record;
}

function markScoreSynced(localId) {
  const scores = readLocalScores().map((score) =>
    score.localId === localId ? { ...score, synced: true } : score
  );
  writeLocalScores(scores);
}

// Scores that still need to reach MySQL.
function getPendingScores() {
  return readLocalScores().filter((score) => !score.synced);
}

// POST one record to the API. Resolves true when the database accepted it.
function pushScoreToServer(record) {
  return fetch("api/save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerName: record.playerName,
      mode: record.mode,
      difficulty: record.difficulty,
      moves: record.moves,
      time: record.time,
      status: record.status,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        markScoreSynced(record.localId);
        return true;
      }
      console.error("Server rejected the score:", data.message, data.detail || "");
      return false;
    })
    .catch((error) => {
      console.error("Unable to reach api/save.php:", error);
      return false;
    });
}

// Try to flush everything that is still waiting to be saved.
function syncPendingScores() {
  const pending = getPendingScores();
  if (pending.length === 0) return Promise.resolve(0);

  return Promise.all(pending.map(pushScoreToServer))
    .then((results) => results.filter(Boolean).length);
}


// ============================================================
// Leaderboard: save a score, then show the ranked table
// ============================================================
// status is "completed" (puzzle solved) or "dnf" (player gave up).
function saveGameScore(status = "completed") {
  const playerName = playerNameInput.value.trim();
  if (playerName === "") return; // name is required (checked before starting too)

  // 1. Always save locally first - this can never fail because of the network.
  const record = storeScoreLocally({
    playerName: playerName,
    mode: selectedMode,
    difficulty: selectedDifficulty,
    moves: moveCount,
    time: gameSeconds,
    status: status,
  });

  // 2. Then try to push it (plus anything still pending) to MySQL.
  pushScoreToServer(record).then(syncPendingScores).then(loadLeaderboard);
}

function loadLeaderboard() {
  leaderboardResultsEl.textContent = "Loading leaderboard...";

  return fetch("api/list.php")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        console.error("Leaderboard error:", data.message, data.detail || "");
        showLocalLeaderboard("Database unavailable");
        return;
      }

      // Server rows, plus anything on this device that has not synced yet.
      const serverScores = (data.scores || []).map((score) => ({ ...score, isLocal: false }));
      const pending = getPendingScores().map((score) => ({ ...score, isLocal: true }));

      renderLeaderboard(serverScores.concat(pending));

      if (pending.length > 0) {
        showNotice(
          `${pending.length} score(s) on this device could not be saved to the ` +
          `database yet. They are shown below and will be uploaded automatically.`
        );
      } else {
        hideNotice();
      }
    })
    .catch((error) => {
      console.error("Unable to load leaderboard:", error);
      showLocalLeaderboard("Server unreachable");
    });
}

// Fallback view: everything we have on this device.
function showLocalLeaderboard(reason) {
  const localScores = readLocalScores().map((score) => ({ ...score, isLocal: true }));

  showNotice(
    `${reason} - showing the scores saved in this browser. ` +
    `They will be uploaded to the leaderboard once the database is reachable again.`
  );

  if (localScores.length === 0) {
    leaderboardResultsEl.textContent =
      "No scores saved on this device yet. Finish a puzzle to add one!";
    return;
  }

  renderLeaderboard(localScores);
}

function showNotice(message) {
  storageNoticeEl.textContent = message;
  storageNoticeEl.hidden = false;
}

function hideNotice() {
  storageNoticeEl.hidden = true;
}

// Completed games first, then fastest time, then fewest moves.
function compareScores(a, b) {
  const aDone = a.status !== "dnf";
  const bDone = b.status !== "dnf";
  if (aDone !== bDone) return aDone ? -1 : 1;
  if (a.time !== b.time) return a.time - b.time;
  return a.moves - b.moves;
}

function renderLeaderboard(scores) {
  const ranked = scores.slice().sort(compareScores).slice(0, LEADERBOARD_SIZE);

  leaderboardResultsEl.innerHTML = "";

  if (ranked.length === 0) {
    leaderboardResultsEl.textContent = "No scores yet. Be the first to play!";
    return;
  }

  const table = document.createElement("table");
  table.className = "leaderboard-table";

  // Header row
  const headerRow = document.createElement("tr");
  ["Rank", "Player", "Mode", "Difficulty", "Moves", "Time", "Status", "Date"]
    .forEach((title) => {
      const th = document.createElement("th");
      th.textContent = title;
      headerRow.appendChild(th);
    });
  table.appendChild(headerRow);

  // One row per score
  ranked.forEach((player, index) => {
    const isDnf = player.status === "dnf";
    const row = document.createElement("tr");
    if (isDnf) row.classList.add("dnf-row");
    if (player.isLocal) row.classList.add("local-row");

    const difficulty = DIFFICULTIES[player.difficulty];

    const cells = [
      index + 1,
      player.playerName,
      MODE_NAMES[player.mode] || player.mode,
      difficulty ? difficulty.label : (player.difficulty || "-"),
      isDnf ? "—" : player.moves,           // no meaningful moves for a DNF
      isDnf ? "—" : formatTime(player.time), // no completion time for a DNF
      isDnf ? "Did Not Finish" : "Completed",
      player.isLocal ? `${player.completedAt} (this device)` : player.completedAt,
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
applyDifficulty(selectedDifficulty);
updateTimerDisplay();
updateHintDisplay();

// Upload anything left over from a previous (offline) session, then draw the table.
syncPendingScores().then(loadLeaderboard);
