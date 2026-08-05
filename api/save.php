<?php
// ============================================================
// save.php  -  Score WRITE endpoint
// Accepts a finished game as JSON (POST), validates it, and
// inserts one row into the `scores` table. Returns JSON status.
// If the table is missing or out of date, it repairs the schema
// once and retries the insert instead of just failing.
// ============================================================

header("Content-Type: application/json");

require_once "db.php";
require_db($pdo, $dbError);

// Only POST is allowed here.
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_error("Method not allowed.");
    exit;
}

// Read and decode the JSON body sent by script.js.
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_error("Invalid data.");
    exit;
}

// ---------- Validate each field ----------
$playerName = trim($data["playerName"] ?? "");
$mode       = $data["mode"] ?? "";
$difficulty = $data["difficulty"] ?? "medium";
$moves      = filter_var($data["moves"] ?? null, FILTER_VALIDATE_INT);
$time       = filter_var($data["time"] ?? null, FILTER_VALIDATE_INT);
$status     = $data["status"] ?? "completed"; // "completed" or "dnf"

if ($playerName === "") {
    http_response_code(400);
    echo json_error("Player name is required.");
    exit;
}

if (strlen($playerName) > 20) {
    http_response_code(400);
    echo json_error("Player name is too long.");
    exit;
}

$allowedModes = ["tide", "breeze", "sunshine"];
if (!in_array($mode, $allowedModes, true)) {
    http_response_code(400);
    echo json_error("Invalid puzzle mode.");
    exit;
}

$allowedDifficulties = ["easy", "medium", "hard"];
if (!in_array($difficulty, $allowedDifficulties, true)) {
    http_response_code(400);
    echo json_error("Invalid difficulty.");
    exit;
}

if ($moves === false || $moves < 0) {
    http_response_code(400);
    echo json_error("Invalid move count.");
    exit;
}

if ($time === false || $time < 0) {
    http_response_code(400);
    echo json_error("Invalid completion time.");
    exit;
}

$allowedStatuses = ["completed", "dnf"];
if (!in_array($status, $allowedStatuses, true)) {
    http_response_code(400);
    echo json_error("Invalid status.");
    exit;
}

// ---------- Insert with a prepared statement (prevents SQL injection) ----------
function insert_score(PDO $pdo, $playerName, $mode, $difficulty, $moves, $time, $status)
{
    $statement = $pdo->prepare("
        INSERT INTO scores
            (player_name, puzzle_mode, difficulty, moves, completion_time, status)
        VALUES
            (:player_name, :puzzle_mode, :difficulty, :moves, :completion_time, :status)
    ");

    $statement->execute([
        ":player_name"     => $playerName,
        ":puzzle_mode"     => $mode,
        ":difficulty"      => $difficulty,
        ":moves"           => $moves,
        ":completion_time" => $time,
        ":status"          => $status,
    ]);
}

try {
    insert_score($pdo, $playerName, $mode, $difficulty, $moves, $time, $status);
    echo json_encode(["success" => true, "message" => "Score saved."]);
} catch (PDOException $error) {
    // Most likely cause: the table does not exist yet, or it predates
    // the `status` / `difficulty` columns. Repair it and try once more.
    try {
        ensure_scores_table($pdo);
        insert_score($pdo, $playerName, $mode, $difficulty, $moves, $time, $status);
        echo json_encode([
            "success" => true,
            "message" => "Score saved (database schema was repaired first).",
        ]);
    } catch (PDOException $retryError) {
        http_response_code(500);
        echo json_error("Could not save score.", $retryError->getMessage());
    }
}
