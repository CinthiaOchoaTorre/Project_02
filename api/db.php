<?php
// db.php  -  MySQL connection (shared by save.php, list.php,
//            and health.php)
define("DB_DEBUG", true);

// ---------- Connection settings ----------
// Defaults below are the GSU (codd) account settings.
$host     = "localhost";
$database = "cochoatorre1";
$username = "cochoatorre1";
$password = "cochoatorre1";


if (file_exists(__DIR__ . "/config.local.php")) {
    require __DIR__ . "/config.local.php";
}

$pdo = null;
$dbError = null;

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$database;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $error) {
    $pdo = null;
    $dbError = $error->getMessage();
}

// ------------------------------------------------------------
// Build a JSON error body, attaching the real cause when
// DB_DEBUG is on.
// ------------------------------------------------------------
function json_error($message, $detail = null)
{
    $body = ["success" => false, "message" => $message];

    if (DB_DEBUG && $detail !== null) {
        $body["detail"] = $detail;
    }

    return json_encode($body);
}

// ------------------------------------------------------------
// Answer with 503 + JSON when there is no database connection.
// Endpoints call this immediately after requiring db.php.
// ------------------------------------------------------------
function require_db($pdo, $dbError)
{
    if ($pdo instanceof PDO) {
        return;
    }

    http_response_code(503);
    echo json_error("Database connection failed.", $dbError);
    exit;
}

// ------------------------------------------------------------
// Make sure the `scores` table exists and has every column this
// app needs. Older copies of the table are missing `status` and
// `difficulty`, which makes every INSERT fail - this repairs them.
// Returns an array of the actions it performed.
// ------------------------------------------------------------
function ensure_scores_table(PDO $pdo)
{
    $actions = [];

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player_name VARCHAR(20) NOT NULL,
            puzzle_mode VARCHAR(20) NOT NULL,
            difficulty VARCHAR(10) NOT NULL DEFAULT 'medium',
            moves INT NOT NULL,
            completion_time INT NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'completed',
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $actions[] = "checked table exists";

    // Which columns are actually there right now?
    $existing = [];
    foreach ($pdo->query("SHOW COLUMNS FROM scores") as $column) {
        $existing[] = $column["Field"];
    }

    $required = [
        "difficulty" => "ALTER TABLE scores ADD COLUMN difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'",
        "status"     => "ALTER TABLE scores ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'completed'",
    ];

    foreach ($required as $column => $alterSql) {
        if (!in_array($column, $existing, true)) {
            $pdo->exec($alterSql);
            $actions[] = "added missing column `$column`";
        }
    }

    return $actions;
}
