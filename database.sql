-- ============================================================
-- Paradise Escape - leaderboard schema
-- ------------------------------------------------------------
-- On a shared/university server (e.g. GSU codd) the database is
-- already created for you, so start at the CREATE TABLE below.
-- For a local XAMPP/MAMP install, uncomment the two lines first.
-- ============================================================

-- CREATE DATABASE IF NOT EXISTS paradise_escape;
-- USE paradise_escape;


CREATE TABLE IF NOT EXISTS scores (

    id INT AUTO_INCREMENT PRIMARY KEY,

    player_name VARCHAR(20) NOT NULL,

    puzzle_mode VARCHAR(20) NOT NULL,

    -- 'easy' (3x3), 'medium' (4x4) or 'hard' (5x5)
    difficulty VARCHAR(10) NOT NULL DEFAULT 'medium',

    moves INT NOT NULL,

    completion_time INT NOT NULL,

    -- 'completed' = puzzle solved, 'dnf' = player gave up (Did Not Finish)
    status VARCHAR(12) NOT NULL DEFAULT 'completed',

    completed_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


-- ------------------------------------------------------------
-- Upgrading an older copy of this table?
-- Run whichever of these columns you are missing (an error just
-- means the column is already there, which is fine).
-- The API also repairs these automatically - see api/health.php?setup=1
-- ------------------------------------------------------------
-- ALTER TABLE scores ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'completed';
-- ALTER TABLE scores ADD COLUMN difficulty VARCHAR(10) NOT NULL DEFAULT 'medium';
