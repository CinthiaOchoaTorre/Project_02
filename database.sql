CREATE DATABASE IF NOT EXISTS paradise_escape;

USE paradise_escape;


CREATE TABLE IF NOT EXISTS scores (

    id INT AUTO_INCREMENT PRIMARY KEY,

    player_name VARCHAR(20) NOT NULL,

    puzzle_mode VARCHAR(20) NOT NULL,

    moves INT NOT NULL,

    completion_time INT NOT NULL,

    completed_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);