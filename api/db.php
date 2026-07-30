<?php
// ============================================================
// db.php  -  MySQL connection (shared by save.php and list.php)
// ------------------------------------------------------------
// These are LOCAL DEVELOPMENT defaults (XAMPP/MAMP style).
// Do NOT commit a real production password here. On a live
// server, change these values or load them from an environment
// variable / untracked config file.
// ============================================================

$host     = "localhost";
$database = "paradise_escape";
$username = "root";
$password = ""; // placeholder: empty local password — replace on deployment

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$database;charset=utf8mb4",
        $username,
        $password
    );

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $error) {
    http_response_code(500);
    header("Content-Type: application/json");
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed.",
    ]);
    exit;
}
