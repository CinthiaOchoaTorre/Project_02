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

let gameTimer = null;
let gameSeconds = 0;
let timerRunning = false;
let gameCompleted = false;


/* Get timer element */

const timerDisplay =
  document.getElementById("timerDisplay");


/* Update timer display */

function updateGameTimerDisplay() {

  const minutes =
    Math.floor(gameSeconds / 60);

  const seconds =
    gameSeconds % 60;

  const formattedMinutes =
    String(minutes).padStart(2, "0");

  const formattedSeconds =
    String(seconds).padStart(2, "0");

  timerDisplay.textContent =
    "Time: " +
    formattedMinutes +
    ":" +
    formattedSeconds;

}


/* Start timer */

function startGameTimer() {

  if (timerRunning) {
    return;
  }

  if (gameCompleted) {
    return;
  }

  timerRunning = true;

  gameTimer =
    setInterval(function() {

      gameSeconds++;

      updateGameTimerDisplay();

    }, 1000);

}


/* Stop timer */

function stopGameTimer() {

  clearInterval(gameTimer);

  gameTimer = null;

  timerRunning = false;

}

/* Reset timer */

function resetGameTimer() {

  stopGameTimer();

  gameSeconds = 0;

  gameCompleted = false;

  updateGameTimerDisplay();

}
/* Initial timer display */

updateGameTimerDisplay();

document
  .querySelectorAll(".mode-card")
  .forEach(function(button) {

    button.addEventListener(
      "click",
      function() {

        resetGameTimer();

      }
    );

  });

document
  .getElementById("shuffleBtn")
  .addEventListener(
    "click",
    function() {

      resetGameTimer();

    }
  );


document
  .getElementById("resetBtn")
  .addEventListener(
    "click",
    function() {

      resetGameTimer();

    }
  );
document
  .getElementById("puzzleBoard")
  .addEventListener(
    "click",
    function() {

      if (
        moveCount > 0 &&
        !timerRunning &&
        !gameCompleted
      ) {

        startGameTimer();

      }

      if (
        typeof isSolved === "function" &&
        isSolved()
      ) {

        finishTimer();

      }

    }
  );

function finishTimer() {

  if (gameCompleted) {
    return;
  }

  gameCompleted = true;

  stopGameTimer();

  updateGameTimerDisplay();

}

const hintButton =
  document.getElementById("hintBtn");

const hintCounter =
  document.getElementById("hintCounter");


let hintsRemaining = 3;

function updateHintDisplay() {

  hintCounter.textContent =
    "Hints: " +
    hintsRemaining;

}

function resetHints() {

  hintsRemaining = 3;

  updateHintDisplay();

  clearHintHighlight();

}

function showMagicHint() {

  if (gameCompleted) {
    return;
  }


  if (hintsRemaining <= 0) {

    alert(
      "You have used all 3 Magic Hints!"
    );

    return;

  }

  const movableIndexes =
    getMovableIndexes(emptyIndex);


  if (movableIndexes.length === 0) {
    return;
  }
  const randomIndex =
    movableIndexes[
      Math.floor(
        Math.random() *
        movableIndexes.length
      )
    ];


  const tiles =
    document.querySelectorAll(
      "#puzzleBoard .tile"
    );


  const tile =
    tiles[randomIndex];


  if (!tile) {
    return;
  }
  hintsRemaining--;

  updateHintDisplay();

  tile.classList.add(
    "magic-hint"
  );

  setTimeout(
    function() {

      tile.classList.remove(
        "magic-hint"
      );

    },
    2000
  );

}

hintButton.addEventListener(
  "click",
  showMagicHint
);

updateHintDisplay();

document
  .querySelectorAll(".mode-card")
  .forEach(function(button) {

    button.addEventListener(
      "click",
      function() {

        resetHints();

      }
    );

  });

document
  .getElementById("shuffleBtn")
  .addEventListener(
    "click",
    function() {

      resetHints();

    }
  );

document
  .getElementById("resetBtn")
  .addEventListener(
    "click",
    function() {

      resetHints();

    }
  );

function clearHintHighlight() {

  document
    .querySelectorAll(".magic-hint")
    .forEach(function(tile) {

      tile.classList.remove(
        "magic-hint"
      );

    });

}

const leaderboardSection =
  document.createElement("section");

leaderboardSection.id =
  "database-leaderboard";

leaderboardSection.className =
  "database-leaderboard";


leaderboardSection.innerHTML = `

  <h2>Leaderboard</h2>

  <p>
    Best Paradise Escape scores
  </p>

  <div id="leaderboardResults">
    Loading leaderboard...
  </div>

`;

document
  .querySelector("main")
  .appendChild(
    leaderboardSection
  );

function saveGameScore() {

  const playerName =
    document
      .getElementById("playerName")
      .value
      .trim();


  if (playerName === "") {
    return;
  }


  const scoreData = {

    playerName:
      playerName,

    mode:
      selectedMode,

    moves:
      moveCount,

    time:
      gameSeconds

  };


  fetch(
    "api.php",
    {

      method:
        "POST",

      headers: {

        "Content-Type":
          "application/json"

      },

      body:
        JSON.stringify(scoreData)

    }
  )

  .then(
    function(response) {

      return response.json();

    }
  )

  .then(
    function(data) {

      if (data.success) {

        loadLeaderboard();

      }

      else {

        console.error(
          data.message
        );

      }

    }
  )

  .catch(
    function(error) {

      console.error(
        "Unable to save score:",
        error
      );

    }
  );

}
function loadLeaderboard() {

  fetch("api.php")

    .then(
      function(response) {

        return response.json();

      }
    )

    .then(
      function(data) {

        const results =
          document.getElementById(
            "leaderboardResults"
          );


        if (!data.success) {

          results.textContent =
            "Unable to load leaderboard.";

          return;

        }


        if (
          !data.scores ||
          data.scores.length === 0
        ) {

          results.textContent =
            "No scores yet. Be the first to play!";

          return;

        }


        results.innerHTML = "";


        const table =
          document.createElement("table");


        table.className =
          "leaderboard-table";


        const header =
          document.createElement("tr");


        const headings = [

          "Rank",

          "Player",

          "Mode",

          "Moves",

          "Time",

          "Date"

        ];


        headings.forEach(
          function(title) {

            const th =
              document.createElement("th");

            th.textContent =
              title;

            header.appendChild(th);

          }
        );


        table.appendChild(header);


        data.scores.forEach(
          function(player, index) {

            const row =
              document.createElement("tr");


            const rank =
              document.createElement("td");

            rank.textContent =
              index + 1;


            const name =
              document.createElement("td");

            name.textContent =
              player.playerName;


            const mode =
              document.createElement("td");

            mode.textContent =
              formatPuzzleMode(
                player.mode
              );


            const moves =
              document.createElement("td");

            moves.textContent =
              player.moves;


            const time =
              document.createElement("td");

            time.textContent =
              formatLeaderboardTime(
                player.time
              );


            const date =
              document.createElement("td");

            date.textContent =
              player.completedAt;


            row.appendChild(rank);

            row.appendChild(name);

            row.appendChild(mode);

            row.appendChild(moves);

            row.appendChild(time);

            row.appendChild(date);


            table.appendChild(row);

          }
        );


        results.appendChild(table);

      }
    )

    .catch(
      function(error) {

        console.error(
          "Unable to load leaderboard:",
          error
        );


        document
          .getElementById(
            "leaderboardResults"
          )
          .textContent =
          "Leaderboard unavailable.";

      }
    );

}
function formatPuzzleMode(mode) {

  if (mode === "tide") {

    return "Tide Mode";

  }


  if (mode === "breeze") {

    return "Ocean Breeze Mode";

  }


  if (mode === "sunshine") {

    return "Sunshine Mode";

  }


  return mode;

}

function formatLeaderboardTime(seconds) {

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;


  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
  );

}

const winObserver =
  new MutationObserver(
    function() {

      if (
        !winMessageEl.hidden &&
        isSolved() &&
        !gameCompleted
      ) {

        finishTimer();

        saveGameScore();

      }

    }
  );
  
winObserver.observe(
  winMessageEl,
  {
    childList: true,
    subtree: true
  }
);

loadLeaderboard();