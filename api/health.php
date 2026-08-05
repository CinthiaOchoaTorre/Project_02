<?php
// ============================================================
// health.php  -  Database diagnostic endpoint
// ------------------------------------------------------------
// Open this in a browser to see exactly what the database is
// doing:   .../Project_02/api/health.php
// Add ?setup=1 to create/repair the `scores` table:
//          .../Project_02/api/health.php?setup=1
//
// It answers with JSON describing the PHP version, the MySQL
// connection, whether the table and its columns exist, and how
// many rows are stored.
// ============================================================

header("Content-Type: application/json");

require_once "db.php";

$report = [
    "php_version"   => PHP_VERSION,
    "pdo_mysql"     => extension_loaded("pdo_mysql"),
    "host"          => $host,
    "database"      => $database,
    "user"          => $username,
    "connected"     => $pdo instanceof PDO,
];

// ---------- No connection: report why and stop ----------
if (!$pdo instanceof PDO) {
    http_response_code(503);
    $report["success"] = false;
    $report["message"] = "Could not connect to MySQL.";
    $report["error"] = DB_DEBUG ? $dbError : "(enable DB_DEBUG in db.php for details)";
    $report["hint"] = "Check \$host / \$database / \$username / \$password in api/db.php, "
                    . "or create api/config.local.php with the right values.";
    echo json_encode($report, JSON_PRETTY_PRINT);
    exit;
}

// ---------- Optional repair pass ----------
if (isset($_GET["setup"])) {
    try {
        $report["setup_actions"] = ensure_scores_table($pdo);
    } catch (PDOException $error) {
        http_response_code(500);
        $report["success"] = false;
        $report["message"] = "Could not create or repair the `scores` table.";
        $report["error"] = DB_DEBUG ? $error->getMessage() : null;
        $report["hint"] = "This MySQL user may not have CREATE/ALTER rights. "
                        . "Import database.sql through phpMyAdmin instead.";
        echo json_encode($report, JSON_PRETTY_PRINT);
        exit;
    }
}

// ---------- Inspect the table ----------
try {
    $tableExists = $pdo->query("SHOW TABLES LIKE 'scores'")->fetch() !== false;
    $report["table_exists"] = $tableExists;

    if ($tableExists) {
        $columns = [];
        foreach ($pdo->query("SHOW COLUMNS FROM scores") as $column) {
            $columns[] = $column["Field"];
        }
        $report["columns"] = $columns;

        $required = [
            "player_name", "puzzle_mode", "difficulty",
            "moves", "completion_time", "status", "completed_at",
        ];
        $report["missing_columns"] = array_values(array_diff($required, $columns));

        $report["row_count"] = (int) $pdo->query("SELECT COUNT(*) FROM scores")->fetchColumn();

        if (!empty($report["missing_columns"])) {
            $report["hint"] = "Columns are missing. Reload this page with ?setup=1 to add them.";
        }
    } else {
        $report["hint"] = "Table `scores` does not exist. "
                        . "Reload this page with ?setup=1 to create it, "
                        . "or import database.sql through phpMyAdmin.";
    }

    $report["success"] = $tableExists && empty($report["missing_columns"]);
    $report["message"] = $report["success"]
        ? "Database is connected and the scores table is ready."
        : "Connected to MySQL, but the scores table needs attention.";

    echo json_encode($report, JSON_PRETTY_PRINT);
} catch (PDOException $error) {
    http_response_code(500);
    $report["success"] = false;
    $report["message"] = "Connected, but could not inspect the database.";
    $report["error"] = DB_DEBUG ? $error->getMessage() : null;
    echo json_encode($report, JSON_PRETTY_PRINT);
}
