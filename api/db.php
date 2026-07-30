<?php

$host = "localhost";

$database = "paradise_escape";

$username = "root";

$password = "";


try {

    $pdo = new PDO(
        "mysql:host=$host;dbname=$database;charset=utf8mb4",
        $username,
        $password
    );


    $pdo->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );


    $pdo->setAttribute(
        PDO::ATTR_DEFAULT_FETCH_MODE,
        PDO::FETCH_ASSOC
    );


} catch (PDOException $error) {

    http_response_code(500);

    header(
        "Content-Type: application/json"
    );


    echo json_encode([

        "success" => false,

        "message" =>
            "Database connection failed."

    ]);


    exit;

}

?>