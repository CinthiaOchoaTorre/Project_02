<?php
// ============================================================
// list.php  -  Leaderboard READ endpoint
// Returns the top 10 scores as JSON, ranked by fastest time
// then fewest moves. Called by the game with a GET request.
// ============================================================

header("Content-Type: application/json");

require_once "db.php";
require_db($pdo, $dbError);

// Only GET is allowed here.
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    http_response_code(405);
    echo json_error("Method not allowed.");
    exit;
}

function fetch_scores(PDO $pdo)
{
    $query = $pdo->query("
        SELECT
            player_name,
            puzzle_mode,
            difficulty,
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

    return $query->fetchAll();
}

try {
    try {
        $scores = fetch_scores($pdo);
    } catch (PDOException $error) {
        // Table missing or missing the newer columns - repair and retry
        // so a fresh install returns an empty leaderboard, not an error.
        ensure_scores_table($pdo);
        $scores = fetch_scores($pdo);
    }

    echo json_encode([
        "success" => true,
        "scores" => array_map(function ($score) {
            return [
                "playerName"  => $score["player_name"],
                "mode"        => $score["puzzle_mode"],
                "difficulty"  => $score["difficulty"],
                "moves"       => (int) $score["moves"],
                "time"        => (int) $score["completion_time"],
                "status"      => $score["status"],
                "completedAt" => $score["completed_at"],
            ];
        }, $scores),
    ]);
} catch (PDOException $error) {
    http_response_code(500);
    echo json_error("Could not load leaderboard.", $error->getMessage());
}
