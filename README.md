# Paradise Escape

A beach-themed version of the classic 15-puzzle. Slide the scrambled image
tiles back into place across three summer puzzle modes, race the timer, use a
limited Magic Hint, and save your score to a persistent leaderboard.

## Team
- MaKayla Davis
- Cinthia Ochoa Torre

## Tech Stack
- **HTML5** — page structure
- **CSS3** — Summer Beach theme + responsive layout
- **JavaScript** — puzzle logic (board state, movement, solvable shuffle, reset, timer, Magic Hint)
- **PHP** — REST-style API for saving and reading scores
- **MySQL** — persistent leaderboard storage

## Features
- **Three difficulty levels** — Easy (3×3), Medium (4×4) and Hard (5×5). The
  difficulty also controls how deeply the board is scrambled and how many
  Magic Hints you get (5 / 3 / 2).
- Three summer-themed puzzle modes (Tide, Ocean Breeze, Sunshine), each a real photo sliced into tiles
- Shuffle that is always solvable (random legal moves from the solved board)
- Move counter and game timer
- **Shuffle and Reset do different things** — Shuffle scrambles a brand-new
  puzzle, Reset puts the *current* puzzle back to the exact layout it started
  with and clears your moves, time and hints
- Limited Magic Hint feature (budget depends on difficulty)
- Give Up records the attempt as "Did Not Finish"
- Player name input with automatic score saving
- Persistent MySQL leaderboard ranked by fastest time, then fewest moves
- **Offline fallback** — every score is written to the browser's `localStorage`
  first, then uploaded to MySQL. If PHP or MySQL is unreachable, the game keeps
  working, the leaderboard shows the scores saved on that device, and the
  pending scores are uploaded automatically on the next visit.
- **Self-healing database** — if the `scores` table is missing or out of date,
  the API creates/repairs it and retries instead of failing
- Server-side input validation and prepared statements
- Responsive design

## Project Structure
```
Project_02/
├── index.html          # Page structure
├── style.css           # Theme + responsive styles
├── script.js           # Game logic + leaderboard fetch
├── database.sql        # MySQL table schema
├── images/             # Themed tile images (one per mode)
└── api/
    ├── db.php          # MySQL connection + schema repair helpers
    ├── save.php        # POST — writes a finished game
    ├── list.php        # GET  — returns the ranked leaderboard
    └── health.php      # GET  — database diagnostics (see Troubleshooting)
```

Mode → image mapping (set in `MODE_IMAGES` in `script.js`):
| Mode | Image |
|------|-------|
| Tide | `images/tide_mode.jpg` |
| Ocean Breeze | `images/ocean_waves.jpg` |
| Sunshine | `images/sunshine_mode.jpg` |

## Setup / Run Instructions
This project needs PHP + MySQL, so it must be served through a PHP server
(not opened as a `file://` page, or the API calls will not run).

**1. Create the database**

Import the schema into MySQL (creates the `paradise_escape` database and
`scores` table):
```bash
mysql -u root -p < database.sql
```
Or paste the contents of `database.sql` into phpMyAdmin.

**2. Configure the database connection**

`api/db.php` ships with the GSU (codd) account settings. To run it somewhere
else, either edit those four variables or — better — create an untracked
`api/config.local.php` that overrides them:

```php
<?php
$database = "paradise_escape";
$username = "root";
$password = "";
```

**3. Run the app**

Using XAMPP/MAMP, place the project in your `htdocs` folder and visit
`http://localhost/Project_02/index.html`.

Or use PHP's built-in server from the project root:
```bash
php -S localhost:8000
```
Then open <http://localhost:8000/index.html>.

## How to Play
1. Enter your name, choose a difficulty (Easy 3×3, Medium 4×4, Hard 5×5), and pick a puzzle mode.
2. The board shuffles automatically — slide tiles into the empty space to rebuild the image.
3. The timer starts on your first move; your moves are counted.
4. Use **Magic Hint** to highlight a tile you can move (5 / 3 / 2 hints depending on difficulty).
5. **Reset** restarts the same puzzle from its original scramble; **Shuffle** deals a brand-new one.
6. Solve the puzzle and your score is saved to the leaderboard automatically.

## Troubleshooting the Database
If the leaderboard shows *"Database unavailable — showing the scores saved in
this browser"*, the game is still fully playable (scores are kept locally and
uploaded later). To find out what is wrong with MySQL, open:

```
.../Project_02/api/health.php
```

It answers with JSON showing the PHP version, the connection settings in use,
whether the connection succeeded (and the exact MySQL error if it did not),
whether the `scores` table exists, which columns it has, and the row count.

To create or repair the table automatically:

```
.../Project_02/api/health.php?setup=1
```

`save.php` and `list.php` also self-repair: if the table is missing or lacks the
`status` / `difficulty` columns, they fix it and retry the query once.

> `api/db.php` has `DB_DEBUG` set to `true`, which is what puts the real MySQL
> error text in the API responses. Set it to `false` for a public deployment.

## Live Demo
[https://codd.cs.gsu.edu/~cochoatorre1/wp/Project_02/index.html](https://codd.cs.gsu.edu/~cochoatorre1/wp/Project_02/index.html)

## Repository
https://github.com/CinthiaOchoaTorre/Project_02
