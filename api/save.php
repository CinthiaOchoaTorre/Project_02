<?php
// ============================================================
// save.php  -  Score WRITE endpoint
// Accepts a completed game as JSON (POST), validates it, and
// inserts one row into the `scores` table. Returns JSON status.
// ============================================================

header("Content-Type: application/json");

require_once "db.php";

// Only POST is allowed here.
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed.",
    ]);
    exit;
}

// Read and decode the JSON body sent by script.js.
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid data."]);
    exit;
}

// ---------- Validate each field ----------
$playerName = trim($data["playerName"] ?? "");
$mode       = $data["mode"] ?? "";
$moves      = filter_var($data["moves"] ?? null, FILTER_VALIDATE_INT);
$time       = filter_var($data["time"] ?? null, FILTER_VALIDATE_INT);
$status     = $data["status"] ?? "completed"; // "completed" or "dnf"

if ($playerName === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Player name is required."]);
    exit;
}

if (strlen($playerName) > 20) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Player name is too long."]);
    exit;
}

$allowedModes = ["tide", "breeze", "sunshine"];
if (!in_array($mode, $allowedModes, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid puzzle mode."]);
    exit;
}

if ($moves === false || $moves < 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid move count."]);
    exit;
}

if ($time === false || $time < 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid completion time."]);
    exit;
}

$allowedStatuses = ["completed", "dnf"];
if (!in_array($status, $allowedStatuses, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid status."]);
    exit;
}

// ---------- Insert with a prepared statement (prevents SQL injection) ----------
try {
    $statement = $pdo->prepare("
        INSERT INTO scores (player_name, puzzle_mode, moves, completion_time, status)
        VALUES (:player_name, :puzzle_mode, :moves, :completion_time, :status)
    ");

    $statement->execute([
        ":player_name"     => $playerName,
        ":puzzle_mode"     => $mode,
        ":moves"           => $moves,
        ":completion_time" => $time,
        ":status"          => $status,
    ]);

    echo json_encode(["success" => true, "message" => "Score saved."]);
} catch (PDOException $error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Could not save score."]);
}
