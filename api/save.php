<?php

header(
    "Content-Type: application/json"
);


require_once "db.php";

if ($_SERVER["REQUEST_METHOD"] === "GET") {

    try {

        $query = $pdo->query("

            SELECT
                player_name,
                puzzle_mode,
                moves,
                completion_time,
                completed_at

            FROM scores

            ORDER BY
                completion_time ASC,
                moves ASC

            LIMIT 10

        ");


        $scores =
            $query->fetchAll();


        echo json_encode([

            "success" => true,

            "scores" => array_map(
                function($score) {

                    return [

                        "playerName" =>
                            $score["player_name"],

                        "mode" =>
                            $score["puzzle_mode"],

                        "moves" =>
                            (int)
                            $score["moves"],

                        "time" =>
                            (int)
                            $score["completion_time"],

                        "completedAt" =>
                            $score["completed_at"]

                    ];

                },

                $scores

            )

        ]);

    }


    catch (PDOException $error) {

        http_response_code(500);

        echo json_encode([

            "success" => false,

            "message" =>
                "Could not load leaderboard."

        ]);

    }


    exit;

}

if ($_SERVER["REQUEST_METHOD"] === "POST") {


    $data =
        json_decode(
            file_get_contents(
                "php://input"
            ),
            true
        );


    if (!is_array($data)) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Invalid data."

        ]);

        exit;

    }

    $playerName =
        trim(
            $data["playerName"] ?? ""
        );

    $mode =
        $data["mode"] ?? "";

    $moves =
        filter_var(
            $data["moves"] ?? null,
            FILTER_VALIDATE_INT
        );

    $time =
        filter_var(
            $data["time"] ?? null,
            FILTER_VALIDATE_INT
        );

    if ($playerName === "") {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Player name is required."

        ]);

        exit;

    }


    if (strlen($playerName) > 20) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Player name is too long."

        ]);

        exit;

    }


    $allowedModes = [

        "tide",

        "breeze",

        "sunshine"

    ];


    if (
        !in_array(
            $mode,
            $allowedModes,
            true
        )
    ) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Invalid puzzle mode."

        ]);

        exit;

    }


    if (
        $moves === false ||
        $moves < 0
    ) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Invalid move count."

        ]);

        exit;

    }


    if (
        $time === false ||
        $time < 0
    ) {

        http_response_code(400);

        echo json_encode([

            "success" => false,

            "message" =>
                "Invalid completion time."

        ]);

        exit;

    }

    try {

        $statement =
            $pdo->prepare("

                INSERT INTO scores

                (
                    player_name,
                    puzzle_mode,
                    moves,
                    completion_time
                )

                VALUES

                (
                    :player_name,
                    :puzzle_mode,
                    :moves,
                    :completion_time
                )

            ");


        $statement->execute([

            ":player_name" =>
                $playerName,

            ":puzzle_mode" =>
                $mode,

            ":moves" =>
                $moves,

            ":completion_time" =>
                $time

        ]);


        echo json_encode([

            "success" => true,

            "message" =>
                "Score saved."

        ]);

    }


    catch (PDOException $error) {

        http_response_code(500);

        echo json_encode([

            "success" => false,

            "message" =>
                "Could not save score."

        ]);

    }


    exit;

}

http_response_code(405);

echo json_encode([

    "success" => false,

    "message" =>
        "Method not allowed."

]);

?>