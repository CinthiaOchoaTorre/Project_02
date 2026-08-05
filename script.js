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

// A short code identifying the current scramble. Reset keeps it,
// Shuffle replaces it - that is how the player can tell the two
// buttons apart, since both leave a scrambled board on screen.
let puzzleId = "";
let attemptNumber = 1;

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
const puzzleIdDisplayEl = document.getElementById("puzzleIdDisplay");
const actionMessageEl = document.getElementById("actionMessage");
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

  // A new scramble means a new puzzle ID and a fresh attempt count.
  puzzleId = makePuzzleId(startingBoard);
  attemptNumber = 1;

  resetProgress();
  showActionMessage(`New puzzle shuffled - this is Puzzle #${puzzleId}.`);
}

// RESET: put the *same* puzzle back to the layout it started with.
// This is what makes Reset different from Shuffle - the picture and
// the scramble stay identical, only your progress is wiped.
function resetCurrentGame() {
  if (startingBoard.length === 0) return; // nothing has been played yet

  board = startingBoard.slice();
  emptyIndex = board.indexOf(emptyValue);

  // Same scramble, so the puzzle ID does NOT change - only the attempt.
  attemptNumber++;

  resetProgress();
  showActionMessage(
    `Puzzle #${puzzleId} restored to its starting layout - attempt ${attemptNumber}. ` +
    `(Shuffle would have given you a different puzzle.)`
  );
}

// Turn a scramble into a short, stable code like "3F9C" so the player
// can see at a glance that Reset kept the same puzzle.
function makePuzzleId(layout) {
  let hash = 0;
  layout.forEach((value, index) => {
    hash = (hash * 31 + (value + 1) * (index + 1)) % 0xffff;
  });
  return hash.toString(16).toUpperCase().padStart(4, "0");
}

function updatePuzzleIdDisplay() {
  puzzleIdDisplayEl.textContent =
    `Puzzle #${puzzleId} · Attempt ${attemptNumber}`;
}

// A short line under the controls explaining what the last button did.
function showActionMessage(message) {
  actionMessageEl.textContent = message;
  actionMessageEl.hidden = false;
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
  updatePuzzleIdDisplay();
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

  // If the player made the move the hint asked for, keep the rest of
  // the plan so the next hint is instant; otherwise the plan is stale.
  if (hintPlan.length > 0 && hintPlan[0] === index) {
    hintPlan = hintPlan.slice(1);
  } else {
    hintPlan = [];
    hintPlanKey = "";
  }

  clearHintHighlight();

  swapTiles(index, emptyIndex);
  moveCount++;
  updateMoveCounter();

  // The plan was written for the layout before this move.
  if (hintPlan.length > 0) hintPlanKey = board.join(",");

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
      // The hint lives in `hintIndex` rather than on the element, so a
      // redraw cannot wipe it. It stays put until the player moves.
      if (index === hintIndex) {
        tile.classList.add("magic-hint");
        tile.textContent = hintArrow;
      }

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
// ------------------------------------------------------------
// A hint has to be genuinely useful, so it is not "any tile you
// are allowed to move" - it is the next move of a real solution
// worked out from the board in front of you.
//
// The plan is found with a beam search guided by the Manhattan
// distance (how far every tile is from its home square). Beam
// search keeps only the most promising layouts at each depth, so
// it stays fast even on the 5x5 board, where searching for a
// perfect solution would take far too long in a browser.
// ============================================================

// How wide/deep the search is allowed to go, per board size.
const HINT_SEARCH = {
  3: { width: 200, maxDepth: 120 },
  4: { width: 400, maxDepth: 260 },
  5: { width: 900, maxDepth: 600 },
};

const HINT_TIME_BUDGET_MS = 900; // never freeze the page looking for a hint

// The tile the current hint is pointing at (null = no hint showing).
// render() reads this, which is why the highlight survives a redraw.
let hintIndex = null;
let hintArrow = "";

// A worked-out solution we can reuse, so asking for several hints
// in a row does not re-run the search every time.
let hintPlan = [];      // remaining moves, as tile indexes to click
let hintPlanKey = "";   // the layout the plan was computed from

function updateHintDisplay() {
  hintCounterEl.textContent = `Hints: ${hintsRemaining}`;
}

function resetHints() {
  hintsRemaining = maxHints;
  updateHintDisplay();
  clearHintHighlight();
  hintPlan = [];
  hintPlanKey = "";
}

function clearHintHighlight() {
  hintIndex = null;
  hintArrow = "";
}

// How far every tile is from where it belongs. 0 means solved.
function manhattanDistance(layout) {
  let total = 0;

  for (let index = 0; index < layout.length; index++) {
    const value = layout[index];
    if (value === emptyValue) continue;

    const currentRow = Math.floor(index / boardSize);
    const currentCol = index % boardSize;
    const goalRow = Math.floor(value / boardSize);
    const goalCol = value % boardSize;

    total += Math.abs(currentRow - goalRow) + Math.abs(currentCol - goalCol);
  }

  return total;
}

// Work out a full sequence of moves that solves `startLayout`.
// Returns an array of tile indexes to click, or null if the search
// ran out of room. Nodes keep a parent pointer instead of copying
// the move list, which keeps the search cheap.
function planSolution(startLayout) {
  const limits = HINT_SEARCH[boardSize] || HINT_SEARCH[4];
  const deadline = Date.now() + HINT_TIME_BUDGET_MS;
  const goalKey = createSolvedBoard().join(",");

  let beam = [{
    layout: startLayout,
    empty: startLayout.indexOf(emptyValue),
    move: null,
    parent: null,
  }];

  const seen = new Set([startLayout.join(",")]);

  for (let depth = 0; depth < limits.maxDepth; depth++) {
    const nextLevel = [];

    for (const node of beam) {
      for (const tileIndex of getMovableIndexes(node.empty)) {
        const layout = node.layout.slice();
        layout[node.empty] = layout[tileIndex];
        layout[tileIndex] = emptyValue;

        const key = layout.join(",");
        if (seen.has(key)) continue;
        seen.add(key);

        const child = { layout, empty: tileIndex, move: tileIndex, parent: node };

        if (key === goalKey) return buildMoveList(child);

        child.score = manhattanDistance(layout);
        nextLevel.push(child);
      }
    }

    if (nextLevel.length === 0) return null;
    if (Date.now() > deadline) return null;

    // Keep only the most promising layouts for the next round.
    nextLevel.sort((a, b) => a.score - b.score);
    beam = nextLevel.slice(0, limits.width);
  }

  return null;
}

// Walk the parent pointers back to the start to recover the moves.
function buildMoveList(endNode) {
  const moves = [];
  for (let node = endNode; node && node.move !== null; node = node.parent) {
    moves.unshift(node.move);
  }
  return moves;
}

// Safety net: if the search cannot find a full solution in time,
// suggest the single legal move that brings the most tiles closer
// to home. Never suggests undoing the move just played.
function bestSingleMove() {
  let best = null;
  let bestScore = Infinity;

  for (const tileIndex of getMovableIndexes(emptyIndex)) {
    const layout = board.slice();
    layout[emptyIndex] = layout[tileIndex];
    layout[tileIndex] = emptyValue;

    const score = manhattanDistance(layout);
    if (score < bestScore) {
      bestScore = score;
      best = tileIndex;
    }
  }

  return best;
}

// Which way does this tile slide to reach the gap?
function arrowFor(tileIndex) {
  if (tileIndex === emptyIndex + boardSize) return "↑"; // sits below the gap
  if (tileIndex === emptyIndex - boardSize) return "↓"; // sits above the gap
  if (tileIndex === emptyIndex + 1) return "←";
  if (tileIndex === emptyIndex - 1) return "→";
  return "•";
}

function showMagicHint() {
  if (gameCompleted) return;

  if (isSolved()) {
    showActionMessage("The puzzle is already solved - no hint needed!");
    return;
  }

  if (hintsRemaining <= 0) {
    showActionMessage(
      `No Magic Hints left - you get ${maxHints} on ${DIFFICULTIES[selectedDifficulty].label}.`
    );
    return;
  }

  const currentKey = board.join(",");
  let suggestion = null;
  let exact = true;

  // Reuse the existing plan when the board still matches it.
  if (hintPlan.length > 0 && hintPlanKey === currentKey) {
    suggestion = hintPlan[0];
  } else {
    const plan = planSolution(board.slice());

    if (plan && plan.length > 0) {
      hintPlan = plan;
      hintPlanKey = currentKey;
      suggestion = plan[0];
    } else {
      // Could not solve the whole board in the time available.
      suggestion = bestSingleMove();
      exact = false;
      hintPlan = [];
      hintPlanKey = "";
    }
  }

  if (suggestion === null || suggestion === undefined) {
    showActionMessage("No hint available for this board.");
    return;
  }

  hintsRemaining--;
  updateHintDisplay();

  hintIndex = suggestion;
  hintArrow = arrowFor(suggestion);
  render(); // redraw so the highlight and arrow appear

  const movesLeft = hintPlan.length;
  showActionMessage(
    exact
      ? `Magic Hint: slide the glowing tile ${hintArrow} into the gap. ` +
        `This puzzle can be finished in ${movesLeft} more move${movesLeft === 1 ? "" : "s"}. ` +
        `(${hintsRemaining} hint${hintsRemaining === 1 ? "" : "s"} left)`
      : `Magic Hint: slide the glowing tile ${hintArrow} into the gap - ` +
        `it brings the picture closer to finished. (${hintsRemaining} left)`
  );
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
