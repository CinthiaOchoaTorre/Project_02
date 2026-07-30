<?php
// ============================================================
// list.php  -  Leaderboard READ endpoint
// Returns the top 10 scores as JSON, ranked by fastest time
// then fewest moves. Called by the game with a GET request.
// ============================================================

header("Content-Type: application/json");

require_once "db.php";

// Only GET is allowed here.
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed.",
    ]);
    exit;
}

try {
    $query = $pdo->query("
        SELECT
            player_name,
            puzzle_mode,
            moves,
            completion_time,
            status,
            completed_at
        FROM scores
        ORDER BY
            (status = 'completed') DESC,  -- completed games first
            completion_time ASC,          -- then fastest time
            moves ASC                     -- then fewest moves
        LIMIT 10
    ");

    $scores = $query->fetchAll();

    echo json_encode([
        "success" => true,
        "scores" => array_map(function ($score) {
            return [
                "playerName"  => $score["player_name"],
                "mode"        => $score["puzzle_mode"],
                "moves"       => (int) $score["moves"],
                "time"        => (int) $score["completion_time"],
                "status"      => $score["status"],
                "completedAt" => $score["completed_at"],
            ];
        }, $scores),
    ]);
} catch (PDOException $error) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Could not load leaderboard.",
    ]);
}
