CREATE DATABASE IF NOT EXISTS paradise_escape;

USE paradise_escape;


CREATE TABLE IF NOT EXISTS scores (

    id INT AUTO_INCREMENT PRIMARY KEY,

    player_name VARCHAR(20) NOT NULL,

    puzzle_mode VARCHAR(20) NOT NULL,

    moves INT NOT NULL,

    completion_time INT NOT NULL,

    -- 'completed' = puzzle solved, 'dnf' = player gave up (Did Not Finish)
    status VARCHAR(12) NOT NULL DEFAULT 'completed',

    completed_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


-- If the scores table already existed before the status column was added,
-- run this ONCE to add it (skip if the column is already there):
-- ALTER TABLE scores ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'completed';
