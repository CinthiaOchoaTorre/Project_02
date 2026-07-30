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
- Three summer-themed puzzle modes (Tide, Ocean Breeze, Sunshine), each a real photo sliced into tiles
- 4×4 sliding puzzle using image tiles
- Shuffle that is always solvable (random legal moves from the solved board)
- Move counter and game timer
- Shuffle and Reset buttons
- Limited Magic Hint feature (3 per game)
- Player name input with automatic score saving
- Persistent MySQL leaderboard ranked by fastest time, then fewest moves
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
    ├── db.php          # MySQL connection config
    ├── save.php        # POST — writes a completed score
    └── list.php        # GET  — returns the ranked leaderboard
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

Open `api/db.php` and make sure `$host`, `$database`, `$username`, and
`$password` match your local MySQL. The defaults assume XAMPP/MAMP
(`root` with an empty password).

**3. Run the app**

Using XAMPP/MAMP, place the project in your `htdocs` folder and visit
`http://localhost/Project_02/index.html`.

Or use PHP's built-in server from the project root:
```bash
php -S localhost:8000
```
Then open <http://localhost:8000/index.html>.

## How to Play
1. Enter your name and pick a puzzle mode.
2. The board shuffles automatically — slide tiles into the empty space to rebuild the image.
3. The timer starts on your first move; your moves are counted.
4. Use **Magic Hint** (3 max) to highlight a tile you can move.
5. Solve the puzzle and your score is saved to the leaderboard automatically.

## Live Demo
[https://codd.cs.gsu.edu/~cochoatorre1/wp/Project_02/index.html](https://codd.cs.gsu.edu/~cochoatorre1/wp/Project_02/index.html)

## Repository
https://github.com/CinthiaOchoaTorre/Project_02
