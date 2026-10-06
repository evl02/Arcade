# Arcade Games Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a GitHub Pages site at `https://triippiing.github.io/Arcade/` that lists playable browser games on a generated index and hosts the IBM Safeguarded Copy game.

**Architecture:** Static site, no server. Each game is a self-contained folder `games/<slug>/index.html` that declares itself through `<head>` meta tags. A stdlib Python builder scans those folders and rewrites only the card grid between generated markers in `index.html`. A GitHub Actions workflow runs the builder on push and commits the result back, which retriggers the Pages deploy.

**Tech Stack:** HTML, CSS, vanilla JS (in the game only), Python 3 standard library for the builder, `unittest` for builder tests, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-29-arcade-games-site-design.md`

## Global Constraints

- **Relative paths only.** Every URL the site emits is relative (`games/safeguarded-copy/`, `assets/css/arcade.css`, `../../`). Root-relative paths such as `/Arcade/assets/...` are forbidden: they break under a different repo name, under a root domain, and under `file://`. This is what lets a colleague clone the repo and host it at their own address.
- **Python standard library only** in `scripts/`. No pip installs. Must run on macOS default `python3` and on `ubuntu-latest` with Python 3.11.
- **No em dashes or en dashes** in any code, comment, copy, commit message, or generated markup. A repo hook enforces this on every write.
- **The builder writes to exactly one file:** `index.html`. Nothing else.
- **`index.html` is committed**, so the site works even if Actions never runs.
- Slugs are lowercase kebab-case and are the URL segment.

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Hand authored page shell plus one generated region between markers |
| `assets/css/arcade.css` | All index page styling. Not shared with the Wiki repo |
| `games/safeguarded-copy/index.html` | The SGC game, self contained |
| `scripts/build_index.py` | Scan, validate, render, splice. The only build logic |
| `scripts/test_build_index.py` | `unittest` suite for the builder |
| `.github/workflows/build-index.yml` | Run the builder on push, commit result back |
| `serve.sh` | Local preview on `http://localhost:8000` |
| `README.md` | What this is, how to add a game, how to fork it |
| `.gitignore` | `.DS_Store` and Python cruft |

---

### Task 1: Repo skeleton and page shell

Creates everything the later tasks splice into. No game and no builder yet.

**Files:**
- Create: `.gitignore`
- Create: `serve.sh`
- Create: `index.html`
- Create: `assets/css/arcade.css`
- Create: `games/.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: `index.html` containing the exact marker strings `<!-- BEGIN GENERATED GAMES -->` and `<!-- END GENERATED GAMES -->`, which Task 5 splices between. `assets/css/arcade.css`, which Task 6 replaces wholesale.

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
__pycache__/
*.pyc
```

- [ ] **Step 2: Create `serve.sh` and make it executable**

```bash
#!/usr/bin/env bash
# Preview the site locally. Relative paths mean this behaves exactly like
# GitHub Pages does, just on a different origin.
set -euo pipefail
cd "$(dirname "$0")"
echo "Arcade on http://localhost:8000/"
python3 -m http.server 8000
```

Then run:

```bash
chmod +x serve.sh
```

- [ ] **Step 3: Create `index.html`**

This is the hand authored shell. Task 5's builder only ever rewrites the region between the two markers, so everything else here survives a rebuild.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arcade</title>
<meta name="description" content="Playable browser games. Built for fun, mostly about storage.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/arcade.css">
</head>
<body>
<header class="site-head">
  <div class="kicker">Cyber Resilience Arcade</div>
  <h1>ARCADE</h1>
  <p class="lede">Playable browser games. Pick a cabinet.</p>
</header>

<main>
  <!-- BEGIN GENERATED GAMES -->
  <!-- END GENERATED GAMES -->
</main>

<footer class="site-foot">
  <p>Everything here runs entirely in your browser. Scores are saved locally to your own machine and are never uploaded.</p>
</footer>
</body>
</html>
```

- [ ] **Step 4: Create a minimal `assets/css/arcade.css`**

Deliberately plain. Task 6 does the real visual pass; this exists so the shell is legible in the meantime.

```css
:root{
  --bg:#070b12;
  --ink:#e8f1ff;
  --muted:#7e93b3;
  --hair:#1b2940;
  --accent:#36e0c8;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  --sans:'IBM Plex Sans',system-ui,-apple-system,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);padding:32px}
h1{font-family:var(--mono);letter-spacing:.12em;margin:4px 0}
.kicker{font-family:var(--mono);font-size:12px;color:var(--accent);letter-spacing:.18em;text-transform:uppercase}
.lede,.site-foot{color:var(--muted)}
.grid{list-style:none;padding:0;display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.card{border:1px solid var(--hair);padding:16px}
.card-link{color:inherit;text-decoration:none;display:block}
.tile{width:100%;height:auto;display:block}
.chips{list-style:none;padding:0;display:flex;gap:8px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;color:var(--muted)}
```

- [ ] **Step 5: Create `games/.gitkeep`**

Empty file. Git does not track empty directories and the builder needs `games/` to exist.

```bash
touch games/.gitkeep
```

- [ ] **Step 6: Verify the shell loads**

Run:

```bash
./serve.sh
```

Open `http://localhost:8000/`. Expected: the ARCADE heading, the lede, and the footer render on a dark background. The main region is empty. Stop the server with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add .gitignore serve.sh index.html assets/css/arcade.css games/.gitkeep
git commit -m "feat: repo skeleton, page shell, local preview script"
```

---

### Task 2: Move the SGC game into the repo

**Files:**
- Create: `games/safeguarded-copy/index.html` (copied from `~/Desktop/sgc-leaderboard.html`)
- Modify: `games/safeguarded-copy/index.html` head and header

**Interfaces:**
- Consumes: the marker shell from Task 1 (the back link points at it).
- Produces: a game folder satisfying the contract Task 3 parses. Meta values: title `IBM ServiceExpress SGC Game`, accent `#36e0c8`, added `2026-07-29`.

- [ ] **Step 1: Copy the file in**

Copy, do not move. The Desktop file stays as a backup until the live site is confirmed working in Task 8.

```bash
mkdir -p games/safeguarded-copy
cp ~/Desktop/sgc-leaderboard.html games/safeguarded-copy/index.html
```

- [ ] **Step 2: Confirm it still plays from its new home**

Run `./serve.sh`, open `http://localhost:8000/games/safeguarded-copy/`. Expected: the game loads and is playable. It is fully self contained apart from Google Fonts, so nothing should have broken. Stop the server.

- [ ] **Step 3: Add the meta tags**

In `games/safeguarded-copy/index.html`, immediately after the existing `<title>IBM ServiceExpress SGC Game</title>` line, insert:

```html
<meta name="description" content="Clear the production volume while four threat actors hunt your I/O head. Bank immutable Safeguarded Copies and roll back when you get hit.">
<meta name="keywords" content="arcade, storage, ransomware, IBM, educational">
<meta name="added" content="2026-07-29">
<meta name="game-accent" content="#36e0c8">
<meta name="game-controls" content="Arrows or WASD, P to pause, swipe on mobile">
```

- [ ] **Step 4: Add the back link**

The game's header is at roughly line 273, `<header class="top">` containing `<div class="brand">`. Add a back link as the first child of that header, before `<div class="brand">`:

```html
    <a class="back-link" href="../../">&larr; Arcade</a>
```

Then add its styling to the game's own `<style>` block, next to the existing `.brand` rule (roughly line 65):

```css
  .back-link{position:absolute;top:14px;left:14px;font-family:var(--mono);font-size:12px;color:var(--muted);text-decoration:none;letter-spacing:.08em;border:1px solid var(--hair);padding:4px 10px;border-radius:2px}
  .back-link:hover{color:var(--copy);border-color:var(--copy)}
```

The `.wrap` container needs `position:relative` for the absolute positioning to anchor correctly. Check the existing `.wrap` rule at roughly line 59 and add `position:relative` to it if it is not already there.

- [ ] **Step 5: Verify the back link and the game together**

Run `./serve.sh`, open `http://localhost:8000/games/safeguarded-copy/`. Expected:
- The back link sits top left of the game frame and does not overlap the SAFEGUARDED COPY heading at desktop width.
- Clicking it lands on the index page.
- The game still starts, the leaderboard panel still opens, and the header layout is not disturbed at narrow width (resize to roughly 400px wide and check).

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add games/safeguarded-copy/index.html
git commit -m "feat: add the Safeguarded Copy game with index metadata and a back link"
```

**Note for the reviewer, not a step:** the game's copy contains two long dashes of the kind the repo hook bans, in the `.tag` blurb at roughly line 277 and in the volume status string at roughly line 284. Because the hook rejects any write containing them, editing that file may be blocked until they are recast. They are Jack's existing approved copy, so raise it with him and let him choose the rewording rather than changing his words unasked.

---

### Task 3: Builder parsing and validation

The first half of `scripts/build_index.py`: find game files, read their meta, validate, report every problem at once.

**Files:**
- Create: `scripts/build_index.py`
- Create: `scripts/test_build_index.py`

**Interfaces:**
- Consumes: the game contract from Task 2.
- Produces, relied on by Tasks 4 and 5:
  - `ROOT: Path`, `GAMES_DIR: Path`, `INDEX: Path`, `BEGIN_MARKER: str`, `END_MARKER: str`, `DEFAULT_ACCENT: str`, `COVER_NAMES: tuple[str, ...]`
  - `@dataclass Game` with fields `slug: str`, `title: str`, `description: str`, `added: date`, `tags: list[str]`, `accent: str`, `controls: str`, `cover: str | None`
  - `find_games(games_dir: Path = GAMES_DIR) -> list[Path]`
  - `find_cover(game_dir: Path) -> str | None`
  - `parse_game(path: Path) -> tuple[Game | None, list[str]]`
  - `esc(value: str) -> str`

- [ ] **Step 1: Write the failing tests**

Create `scripts/test_build_index.py`:

```python
"""Tests for build_index. Standard library only: python3 -m unittest."""
import tempfile
import unittest
from datetime import date
from pathlib import Path

import build_index


HEAD = """<!DOCTYPE html>
<html><head>
<title>{title}</title>
{meta}
</head><body>ok</body></html>
"""


def write_game(root, slug, title="Test Game", meta=None):
    """Create root/games/<slug>/index.html and return its path."""
    if meta is None:
        meta = (
            '<meta name="description" content="A test game.">\n'
            '<meta name="added" content="2026-01-15">'
        )
    game_dir = root / "games" / slug
    game_dir.mkdir(parents=True, exist_ok=True)
    path = game_dir / "index.html"
    path.write_text(HEAD.format(title=title, meta=meta), encoding="utf-8")
    return path


class BuilderTestCase(unittest.TestCase):
    """Points build_index at a throwaway tree instead of the real repo."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self._real_root = build_index.ROOT
        self._real_games = build_index.GAMES_DIR
        build_index.ROOT = self.root
        build_index.GAMES_DIR = self.root / "games"
        (self.root / "games").mkdir()

    def tearDown(self):
        build_index.ROOT = self._real_root
        build_index.GAMES_DIR = self._real_games
        self._tmp.cleanup()


class TestFindGames(BuilderTestCase):
    def test_finds_one_level_of_game_folders(self):
        write_game(self.root, "alpha")
        write_game(self.root, "beta")
        found = build_index.find_games(self.root / "games")
        self.assertEqual([p.parent.name for p in found], ["alpha", "beta"])

    def test_ignores_deeper_nesting(self):
        deep = self.root / "games" / "alpha" / "nested"
        deep.mkdir(parents=True)
        (deep / "index.html").write_text("<title>x</title>", encoding="utf-8")
        found = build_index.find_games(self.root / "games")
        self.assertEqual(found, [])

    def test_missing_games_dir_is_not_an_error(self):
        self.assertEqual(build_index.find_games(self.root / "nope"), [])


class TestParseGame(BuilderTestCase):
    def test_parses_a_complete_game(self):
        path = write_game(
            self.root,
            "safeguarded-copy",
            title="SGC Game",
            meta=(
                '<meta name="description" content="Roll it back.">\n'
                '<meta name="added" content="2026-07-29">\n'
                '<meta name="keywords" content="arcade, storage ,  IBM">\n'
                '<meta name="game-accent" content="#36e0c8">\n'
                '<meta name="game-controls" content="Arrows or WASD">'
            ),
        )
        game, errors = build_index.parse_game(path)
        self.assertEqual(errors, [])
        self.assertEqual(game.slug, "safeguarded-copy")
        self.assertEqual(game.title, "SGC Game")
        self.assertEqual(game.description, "Roll it back.")
        self.assertEqual(game.added, date(2026, 7, 29))
        self.assertEqual(game.tags, ["arcade", "storage", "IBM"])
        self.assertEqual(game.accent, "#36e0c8")
        self.assertEqual(game.controls, "Arrows or WASD")
        self.assertIsNone(game.cover)

    def test_optional_fields_fall_back(self):
        path = write_game(self.root, "plain")
        game, errors = build_index.parse_game(path)
        self.assertEqual(errors, [])
        self.assertEqual(game.tags, [])
        self.assertEqual(game.accent, build_index.DEFAULT_ACCENT)
        self.assertEqual(game.controls, "")

    def test_missing_description_is_an_error(self):
        path = write_game(
            self.root, "bad", meta='<meta name="added" content="2026-01-15">'
        )
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertEqual(len(errors), 1)
        self.assertIn("description", errors[0])
        self.assertIn("games/bad/index.html", errors[0])

    def test_collects_every_error_not_just_the_first(self):
        path = write_game(self.root, "bad", title="", meta="")
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertEqual(len(errors), 3)

    def test_unparseable_added_date_is_an_error(self):
        path = write_game(
            self.root,
            "bad",
            meta=(
                '<meta name="description" content="d">\n'
                '<meta name="added" content="last Tuesday">'
            ),
        )
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertIn("YYYY-MM-DD", errors[0])

    def test_non_hex_accent_is_an_error(self):
        path = write_game(
            self.root,
            "bad",
            meta=(
                '<meta name="description" content="d">\n'
                '<meta name="added" content="2026-01-15">\n'
                '<meta name="game-accent" content="cyan">'
            ),
        )
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertIn("hex colour", errors[0])

    def test_entities_in_meta_are_decoded(self):
        path = write_game(
            self.root,
            "amp",
            title="Snapshot &amp; Recover",
            meta=(
                '<meta name="description" content="Back &amp; forth.">\n'
                '<meta name="added" content="2026-01-15">'
            ),
        )
        game, errors = build_index.parse_game(path)
        self.assertEqual(errors, [])
        self.assertEqual(game.title, "Snapshot & Recover")
        self.assertEqual(game.description, "Back & forth.")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'build_index'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/build_index.py`:

```python
#!/usr/bin/env python3
"""Regenerate the games grid inside index.html.

Scans games/<slug>/index.html, reads each game's <head> metadata, and rewrites
only the region between the generated markers in index.html. Pure standard
library: runs on macOS default python3 and on ubuntu-latest.
"""
from __future__ import annotations

import html
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "games"
INDEX = ROOT / "index.html"

BEGIN_MARKER = "<!-- BEGIN GENERATED GAMES -->"
END_MARKER = "<!-- END GENERATED GAMES -->"

# House cyan, the SGC game's own --data colour. Used when a game does not
# declare game-accent.
DEFAULT_ACCENT = "#36e0c8"
COVER_NAMES = ("cover.png", "cover.jpg", "cover.webp")

TITLE_RE = re.compile(r"<title>([\s\S]*?)</title>", re.IGNORECASE)
HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def meta_re(name: str) -> re.Pattern[str]:
    return re.compile(
        r'<meta\s+name=["\']' + re.escape(name) + r'["\']\s+content=["\']([\s\S]*?)["\']\s*/?>',
        re.IGNORECASE,
    )


DESC_RE = meta_re("description")
KEYWORDS_RE = meta_re("keywords")
ADDED_RE = meta_re("added")
ACCENT_RE = meta_re("game-accent")
CONTROLS_RE = meta_re("game-controls")


@dataclass
class Game:
    slug: str
    title: str
    description: str
    added: date
    tags: list[str]
    accent: str
    controls: str
    cover: str | None


def esc(value: str) -> str:
    """Escape a value for use in HTML text or a quoted attribute."""
    return html.escape(value, quote=True)


def first_group(pattern: re.Pattern[str], text: str) -> str:
    match = pattern.search(text)
    return html.unescape(match.group(1)).strip() if match else ""


def parse_tags(raw: str) -> list[str]:
    return [tag.strip() for tag in raw.split(",") if tag.strip()]


def find_games(games_dir: Path = GAMES_DIR) -> list[Path]:
    """Every games/<slug>/index.html, sorted by slug. One level only."""
    if not games_dir.is_dir():
        return []
    return sorted(p for p in games_dir.glob("*/index.html") if p.is_file())


def find_cover(game_dir: Path) -> str | None:
    for name in COVER_NAMES:
        if (game_dir / name).is_file():
            return name
    return None


def parse_game(path: Path) -> tuple[Game | None, list[str]]:
    """Read one game's metadata.

    Returns (game, []) on success or (None, errors) with every problem found,
    so one build reports all the mistakes rather than one per run.
    """
    rel = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding="utf-8")
    errors: list[str] = []

    title = first_group(TITLE_RE, text)
    description = first_group(DESC_RE, text)
    added_raw = first_group(ADDED_RE, text)
    accent = first_group(ACCENT_RE, text) or DEFAULT_ACCENT
    controls = first_group(CONTROLS_RE, text)
    tags = parse_tags(first_group(KEYWORDS_RE, text))

    if not title:
        errors.append(f"{rel}: missing <title>")
    if not description:
        errors.append(f'{rel}: missing <meta name="description">')

    added: date | None = None
    if not added_raw:
        errors.append(f'{rel}: missing <meta name="added">')
    else:
        try:
            added = date.fromisoformat(added_raw)
        except ValueError:
            errors.append(
                f'{rel}: <meta name="added"> is not a YYYY-MM-DD date: {added_raw!r}'
            )

    if not HEX_RE.match(accent):
        errors.append(
            f'{rel}: <meta name="game-accent"> is not a hex colour: {accent!r}'
        )

    if errors:
        return None, errors

    return (
        Game(
            slug=path.parent.name,
            title=title,
            description=description,
            added=added,
            tags=tags,
            accent=accent,
            controls=controls,
            cover=find_cover(path.parent),
        ),
        [],
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_index.py scripts/test_build_index.py
git commit -m "feat: builder game discovery, metadata parsing, and validation"
```

---

### Task 4: Cover art and fallback tiles

**Files:**
- Modify: `scripts/build_index.py` (append `monogram` and `fallback_tile`)
- Modify: `scripts/test_build_index.py` (append three test classes)

**Interfaces:**
- Consumes: `Game`, `esc`, `find_cover`, `COVER_NAMES` from Task 3.
- Produces, relied on by Task 5:
  - `monogram(slug: str) -> str`
  - `fallback_tile(game: Game) -> str` returning inline SVG markup

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test_build_index.py`, above the `if __name__` block:

```python
class TestFindCover(BuilderTestCase):
    def test_returns_none_when_no_cover_present(self):
        write_game(self.root, "bare")
        self.assertIsNone(build_index.find_cover(self.root / "games" / "bare"))

    def test_prefers_png_over_jpg_and_webp(self):
        write_game(self.root, "arty")
        game_dir = self.root / "games" / "arty"
        for name in ("cover.webp", "cover.jpg", "cover.png"):
            (game_dir / name).write_bytes(b"")
        self.assertEqual(build_index.find_cover(game_dir), "cover.png")

    def test_falls_through_to_webp(self):
        write_game(self.root, "arty")
        game_dir = self.root / "games" / "arty"
        (game_dir / "cover.webp").write_bytes(b"")
        self.assertEqual(build_index.find_cover(game_dir), "cover.webp")

    def test_cover_is_picked_up_by_parse_game(self):
        path = write_game(self.root, "arty")
        (path.parent / "cover.png").write_bytes(b"")
        game, errors = build_index.parse_game(path)
        self.assertEqual(errors, [])
        self.assertEqual(game.cover, "cover.png")


class TestMonogram(unittest.TestCase):
    def test_two_word_slug_uses_both_initials(self):
        self.assertEqual(build_index.monogram("safeguarded-copy"), "SC")

    def test_single_word_slug_uses_first_two_letters(self):
        self.assertEqual(build_index.monogram("tetris"), "TE")

    def test_extra_segments_are_ignored(self):
        self.assertEqual(build_index.monogram("one-two-three"), "OT")

    def test_degenerate_slug_does_not_crash(self):
        self.assertEqual(build_index.monogram("---"), "??")


class TestFallbackTile(unittest.TestCase):
    def make_tile_game(self, slug="safeguarded-copy", accent="#36e0c8", title="SGC"):
        return build_index.Game(
            slug=slug,
            title=title,
            description="d",
            added=date(2026, 1, 15),
            tags=[],
            accent=accent,
            controls="",
            cover=None,
        )

    def test_tile_carries_the_accent_and_monogram(self):
        svg = build_index.fallback_tile(self.make_tile_game())
        self.assertIn("<svg", svg)
        self.assertIn("#36e0c8", svg)
        self.assertIn(">SC<", svg)

    def test_tile_title_is_escaped(self):
        svg = build_index.fallback_tile(self.make_tile_game(title='Quote " & <tag>'))
        self.assertNotIn("<tag>", svg)
        self.assertIn("&amp;", svg)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Expected: the four `TestFindCover` tests pass, because `find_cover` already exists from Task 3. The `TestMonogram` and `TestFallbackTile` tests FAIL with `AttributeError: module 'build_index' has no attribute 'monogram'`.

- [ ] **Step 3: Write the implementation**

Append to `scripts/build_index.py`, after `parse_game`:

```python
def monogram(slug: str) -> str:
    """Two letters standing in for a game with no cover art.

    Taken from the slug rather than the title, because slugs are short and
    predictable: safeguarded-copy gives SC, tetris gives TE.
    """
    parts = [p for p in re.split(r"[^0-9A-Za-z]+", slug) if p]
    if not parts:
        return "??"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def fallback_tile(game: Game) -> str:
    """Inline SVG card art for a game that has no cover image."""
    return (
        f'<svg class="tile" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" '
        f'role="img" aria-label="{esc(game.title)} placeholder art">'
        f'<rect width="320" height="180" fill="{game.accent}" fill-opacity="0.10"/>'
        f'<rect x="0.5" y="0.5" width="319" height="179" fill="none" '
        f'stroke="{game.accent}" stroke-opacity="0.40"/>'
        f'<text x="160" y="112" text-anchor="middle" font-size="72" font-weight="700" '
        f'font-family="IBM Plex Mono, ui-monospace, monospace" letter-spacing="6" '
        f'fill="{game.accent}" fill-opacity="0.85">{esc(monogram(game.slug))}</text>'
        f"</svg>"
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/build_index.py scripts/test_build_index.py
git commit -m "feat: cover art resolution and generated fallback tiles"
```

---

### Task 5: Render, splice, and run the builder for real

**Files:**
- Modify: `scripts/build_index.py` (append rendering, splicing, `main`)
- Modify: `scripts/test_build_index.py` (append three test classes and a helper)
- Modify: `index.html` (regenerated by running the builder)

**Interfaces:**
- Consumes: everything from Tasks 3 and 4.
- Produces:
  - `NEW_DAYS: int`
  - `sort_games(games: list[Game]) -> list[Game]`
  - `render_card(game: Game, today: date) -> str`
  - `render_grid(games: list[Game], today: date) -> str`
  - `splice(index_text: str, block: str) -> str`, raising `ValueError` when the markers are missing or reversed
  - `main() -> int`, the process exit code
  - CSS class names Task 6 must style: `grid`, `card`, `card-link`, `art`, `tile`, `card-body`, `card-title`, `badge`, `blurb`, `chips`, `chip`, `controls`, `empty`. Each card carries `style="--accent:<hex>"`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test_build_index.py`, above the `if __name__` block:

```python
def make_game(slug="alpha", title="Alpha", added=date(2026, 1, 15),
              tags=None, accent="#36e0c8", controls="", cover=None,
              description="A game."):
    return build_index.Game(
        slug=slug, title=title, description=description, added=added,
        tags=tags or [], accent=accent, controls=controls, cover=cover,
    )


class TestSortGames(unittest.TestCase):
    def test_newest_first(self):
        old = make_game(slug="old", title="Old", added=date(2025, 1, 1))
        new = make_game(slug="new", title="New", added=date(2026, 6, 1))
        self.assertEqual(
            [g.slug for g in build_index.sort_games([old, new])], ["new", "old"]
        )

    def test_same_date_falls_back_to_title(self):
        b = make_game(slug="b", title="Banana", added=date(2026, 1, 1))
        a = make_game(slug="a", title="apple", added=date(2026, 1, 1))
        self.assertEqual(
            [g.slug for g in build_index.sort_games([b, a])], ["a", "b"]
        )


class TestRenderCard(unittest.TestCase):
    TODAY = date(2026, 7, 29)

    def test_links_to_the_game_folder_with_a_relative_path(self):
        card = build_index.render_card(make_game(slug="safeguarded-copy"), self.TODAY)
        self.assertIn('href="games/safeguarded-copy/"', card)
        self.assertNotIn('href="/', card)

    def test_uses_the_cover_image_when_present(self):
        card = build_index.render_card(
            make_game(slug="arty", cover="cover.png"), self.TODAY
        )
        self.assertIn('src="games/arty/cover.png"', card)
        self.assertNotIn("<svg", card)

    def test_uses_a_fallback_tile_when_no_cover(self):
        card = build_index.render_card(make_game(), self.TODAY)
        self.assertIn("<svg", card)

    def test_accent_is_exposed_as_a_css_variable(self):
        card = build_index.render_card(make_game(accent="#ff0055"), self.TODAY)
        self.assertIn("--accent:#ff0055", card)

    def test_tags_become_chips(self):
        card = build_index.render_card(make_game(tags=["arcade", "IBM"]), self.TODAY)
        self.assertIn(">arcade<", card)
        self.assertIn(">IBM<", card)

    def test_no_chip_list_when_there_are_no_tags(self):
        self.assertNotIn("chips", build_index.render_card(make_game(), self.TODAY))

    def test_controls_line_only_appears_when_declared(self):
        with_controls = build_index.render_card(
            make_game(controls="Arrows or WASD"), self.TODAY
        )
        self.assertIn("Arrows or WASD", with_controls)
        self.assertNotIn("controls", build_index.render_card(make_game(), self.TODAY))

    def test_recent_games_get_a_new_badge(self):
        fresh = build_index.render_card(
            make_game(added=date(2026, 7, 20)), self.TODAY
        )
        stale = build_index.render_card(
            make_game(added=date(2025, 1, 1)), self.TODAY
        )
        self.assertIn("badge", fresh)
        self.assertNotIn("badge", stale)

    def test_title_and_blurb_are_escaped(self):
        card = build_index.render_card(
            make_game(title="A & B", description='He said "go" <now>'), self.TODAY
        )
        self.assertIn("A &amp; B", card)
        self.assertNotIn("<now>", card)


class TestRenderGridAndSplice(unittest.TestCase):
    TODAY = date(2026, 7, 29)

    def test_empty_library_renders_an_empty_state(self):
        grid = build_index.render_grid([], self.TODAY)
        self.assertIn("empty", grid)
        self.assertNotIn("<ul", grid)

    def test_grid_wraps_every_card(self):
        grid = build_index.render_grid(
            [make_game(slug="a"), make_game(slug="b")], self.TODAY
        )
        self.assertEqual(grid.count('<li class="card"'), 2)

    def test_splice_replaces_only_between_the_markers(self):
        page = (
            "<header>keep me</header>\n"
            f"{build_index.BEGIN_MARKER}\n"
            "<p>stale</p>\n"
            f"{build_index.END_MARKER}\n"
            "<footer>keep me too</footer>\n"
        )
        out = build_index.splice(page, "<p>fresh</p>")
        self.assertIn("keep me", out)
        self.assertIn("keep me too", out)
        self.assertIn("<p>fresh</p>", out)
        self.assertNotIn("stale", out)

    def test_splice_is_idempotent(self):
        page = f"a\n{build_index.BEGIN_MARKER}\nx\n{build_index.END_MARKER}\nb\n"
        once = build_index.splice(page, "<p>fresh</p>")
        twice = build_index.splice(once, "<p>fresh</p>")
        self.assertEqual(once, twice)

    def test_missing_markers_raise(self):
        with self.assertRaises(ValueError):
            build_index.splice("<html>no markers here</html>", "<p>x</p>")

    def test_reversed_markers_raise(self):
        page = f"{build_index.END_MARKER}\n{build_index.BEGIN_MARKER}"
        with self.assertRaises(ValueError):
            build_index.splice(page, "<p>x</p>")


class TestMain(BuilderTestCase):
    def setUp(self):
        super().setUp()
        self._real_index = build_index.INDEX
        build_index.INDEX = self.root / "index.html"
        build_index.INDEX.write_text(
            f"<main>\n{build_index.BEGIN_MARKER}\n{build_index.END_MARKER}\n</main>\n",
            encoding="utf-8",
        )

    def tearDown(self):
        build_index.INDEX = self._real_index
        super().tearDown()

    def test_writes_the_grid_and_returns_zero(self):
        write_game(self.root, "alpha", title="Alpha")
        self.assertEqual(build_index.main(), 0)
        self.assertIn(
            'href="games/alpha/"', build_index.INDEX.read_text(encoding="utf-8")
        )

    def test_running_twice_changes_nothing(self):
        write_game(self.root, "alpha")
        build_index.main()
        first = build_index.INDEX.read_text(encoding="utf-8")
        build_index.main()
        self.assertEqual(build_index.INDEX.read_text(encoding="utf-8"), first)

    def test_a_broken_game_fails_the_build_and_writes_nothing(self):
        before = build_index.INDEX.read_text(encoding="utf-8")
        write_game(self.root, "broken", meta="")
        self.assertEqual(build_index.main(), 1)
        self.assertEqual(build_index.INDEX.read_text(encoding="utf-8"), before)

    def test_missing_markers_fail_the_build(self):
        build_index.INDEX.write_text("<main></main>", encoding="utf-8")
        write_game(self.root, "alpha")
        self.assertEqual(build_index.main(), 1)
```

Note the `main()` tests rely on `find_games(GAMES_DIR)` reading the module global that `BuilderTestCase` repoints, so `main` must call `find_games(GAMES_DIR)` explicitly rather than relying on the default argument, which is bound at import time.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Expected: FAIL with `AttributeError: module 'build_index' has no attribute 'sort_games'`.

- [ ] **Step 3: Write the implementation**

Append to `scripts/build_index.py`, after `fallback_tile`:

```python
# A game added within this many days is badged as new on the index.
NEW_DAYS = 30


def sort_games(games: list[Game]) -> list[Game]:
    """Newest first, then title, so the output is stable run to run."""
    return sorted(games, key=lambda g: (-g.added.toordinal(), g.title.lower()))


def render_card(game: Game, today: date) -> str:
    if game.cover:
        art = (
            f'<img class="tile" src="games/{game.slug}/{game.cover}" '
            f'alt="{esc(game.title)} cover" loading="lazy">'
        )
    else:
        art = fallback_tile(game)

    badge = ""
    if (today - game.added).days <= NEW_DAYS:
        badge = '<span class="badge">New</span>'

    chips = ""
    if game.tags:
        items = "".join(f'<li class="chip">{esc(tag)}</li>' for tag in game.tags)
        chips = f'\n  <ul class="chips">{items}</ul>'

    controls = ""
    if game.controls:
        controls = (
            f'\n  <p class="controls"><span>Controls</span> {esc(game.controls)}</p>'
        )

    return (
        f'<li class="card" style="--accent:{game.accent}">\n'
        f'  <a class="card-link" href="games/{game.slug}/">\n'
        f'    <span class="art">{art}</span>\n'
        f'    <span class="card-body">\n'
        f'      <span class="card-title">{esc(game.title)}{badge}</span>\n'
        f'      <span class="blurb">{esc(game.description)}</span>\n'
        f"    </span>\n"
        f"  </a>{chips}{controls}\n"
        f"</li>"
    )


def render_grid(games: list[Game], today: date) -> str:
    if not games:
        return '<p class="empty">No games yet.</p>'
    cards = "\n".join(render_card(game, today) for game in games)
    return f'<ul class="grid">\n{cards}\n</ul>'


def splice(index_text: str, block: str) -> str:
    """Replace the region between the markers, leaving the rest untouched."""
    start = index_text.find(BEGIN_MARKER)
    end = index_text.find(END_MARKER)
    if start == -1 or end == -1 or end < start:
        raise ValueError(
            f"index.html must contain {BEGIN_MARKER} then {END_MARKER}"
        )
    head = index_text[: start + len(BEGIN_MARKER)]
    tail = index_text[end:]
    return f"{head}\n{block}\n{tail}"


def main() -> int:
    games: list[Game] = []
    errors: list[str] = []
    for path in find_games(GAMES_DIR):
        game, problems = parse_game(path)
        if problems:
            errors.extend(problems)
        else:
            games.append(game)

    if errors:
        for problem in errors:
            print(f"error: {problem}", file=sys.stderr)
        print(
            f"{len(errors)} problem(s) found, index.html not written",
            file=sys.stderr,
        )
        return 1

    block = render_grid(sort_games(games), date.today())
    text = INDEX.read_text(encoding="utf-8")
    try:
        updated = splice(text, block)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if updated == text:
        print(f"index.html already current, {len(games)} game(s)")
    else:
        INDEX.write_text(updated, encoding="utf-8")
        print(f"index.html updated, {len(games)} game(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Expected: PASS, 41 tests.

- [ ] **Step 5: Run the builder against the real repo**

Run:

```bash
python3 scripts/build_index.py
git diff --stat index.html
```

Expected: prints `index.html updated, 1 game(s)`, and the diff shows one card added between the markers, linking to `games/safeguarded-copy/` with an SC fallback tile and a New badge.

- [ ] **Step 6: Prove it is deterministic**

Run:

```bash
python3 scripts/build_index.py
git diff --quiet index.html && echo "stable" || echo "NOT STABLE"
```

The `git diff --quiet` check compares against the last commit, so run this only after Step 5's output has been staged or expect it to report the Step 5 change. The reliable form:

```bash
cp index.html /tmp/arcade-index-1.html
python3 scripts/build_index.py
diff -q /tmp/arcade-index-1.html index.html && echo "stable" || echo "NOT STABLE"
```

Expected: prints `index.html already current, 1 game(s)` then `stable`. If it prints NOT STABLE, the rendering is order dependent and must be fixed before moving on.

- [ ] **Step 7: Prove a broken game fails the build**

Run:

```bash
cp games/safeguarded-copy/index.html /tmp/sgc-backup.html
python3 - <<'PY'
from pathlib import Path
p = Path("games/safeguarded-copy/index.html")
p.write_text(p.read_text().replace('<meta name="added" content="2026-07-29">', ''), encoding="utf-8")
PY
python3 scripts/build_index.py; echo "exit=$?"
cp /tmp/sgc-backup.html games/safeguarded-copy/index.html
git diff --quiet games/safeguarded-copy/index.html && echo "restored"
```

Expected: an error naming `games/safeguarded-copy/index.html` and the missing `added` tag, `exit=1`, then `restored`.

- [ ] **Step 8: Look at it in a browser**

Run `./serve.sh` and open `http://localhost:8000/`. Expected: one card with the SC tile, the title, the blurb, five tag chips, the controls line, and a New badge. Clicking it opens the game. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add scripts/build_index.py scripts/test_build_index.py index.html
git commit -m "feat: render the games grid and splice it into index.html"
```

---

### Task 6: The arcade visual design

The index is functional but plain. This task gives it its own identity.

**REQUIRED SUB-SKILL:** Use the `frontend-design` skill before writing any CSS in this task.

**Files:**
- Modify: `assets/css/arcade.css` (replaced wholesale)
- Modify: `index.html` (hand authored regions only, never between the markers)

**Interfaces:**
- Consumes: the class names Task 5 emits: `grid`, `card`, `card-link`, `art`, `tile`, `card-body`, `card-title`, `badge`, `blurb`, `chips`, `chip`, `controls`, `empty`, plus the per-card `--accent` custom property. Do not rename any of them without changing `render_card` and its tests in the same commit.
- Produces: the finished look. Nothing downstream depends on it.

**Design direction (agreed, not open for reinterpretation):** dark, neon, cabinet select. Its own identity, deliberately not the Wiki's stone and paper theme. Do not copy `tokens.css`, `sidebar.css`, or `chrome.js` from the Wiki repo, and do not build an IPL boot sequence: that is the Wiki's trick and repeating it cheapens both.

Starting tokens, lifted from the SGC game so the index and the game feel like one property:

```css
:root{
  --bg:#070b12;
  --panel:#0c121d;
  --hair:#1b2940;
  --ink:#e8f1ff;
  --muted:#7e93b3;
  --accent:#36e0c8;
  --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:'IBM Plex Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
}
```

- [ ] **Step 1: Invoke the frontend-design skill**

Read it before writing CSS. It exists to stop the output reading as a templated default.

- [ ] **Step 2: Write `assets/css/arcade.css`**

Replace the file completely. Requirements, all of which are checked in Step 4:

- Responsive card grid: multiple columns on desktop, one column below roughly 600px, no horizontal page scroll at 360px.
- Each card uses its own `--accent` for at least one visible detail (edge, glow, or hover state) so games are visually distinguishable from each other.
- Hover and keyboard focus states on `.card-link` are both visible. Focus must not be removed.
- `.tile` fills the card's art area at a consistent aspect ratio whether it is an `<img>` cover or an inline `<svg>` fallback, so a card does not jump in size when a screenshot is added later.
- `.badge` reads as a small marker beside the title, not a shout.
- `.chip` list is compact monospace.
- `.empty` state is styled, since a fresh clone with no games hits it.
- Respect `prefers-reduced-motion: reduce` by dropping any transitions.

- [ ] **Step 3: Refine the hand authored regions of `index.html`**

Header, lede, and footer copy and structure may change. The two marker comments and everything between them must not.

- [ ] **Step 4: Verify in a browser**

Run `./serve.sh` and open `http://localhost:8000/`. Check every one of these:

```
[ ] Desktop width: grid renders in multiple columns, nothing overflows
[ ] 360px width: one column, no horizontal scrollbar
[ ] Tab key reaches the card link and the focus ring is clearly visible
[ ] Hover on the card shows a state change
[ ] Card art holds its aspect ratio
[ ] Clicking the card opens the game, back link returns
[ ] Page still renders if opened directly as a file:// URL
```

- [ ] **Step 5: Confirm the builder still owns the grid**

Run:

```bash
cp index.html /tmp/arcade-index-2.html
python3 scripts/build_index.py
diff -q /tmp/arcade-index-2.html index.html && echo "grid intact" || echo "CHECK: builder rewrote the grid"
```

Expected: `grid intact`. If the builder rewrote something, the hand edits strayed inside the markers.

- [ ] **Step 6: Run the tests**

Run:

```bash
python3 -m unittest discover -s scripts -t scripts
```

Expected: PASS, 41 tests. A renamed class would break `render_card`'s tests here.

- [ ] **Step 7: Commit**

```bash
git add assets/css/arcade.css index.html
git commit -m "feat: arcade visual design for the index"
```

---

### Task 7: Refresh workflow and documentation

**Files:**
- Create: `.github/workflows/build-index.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: `scripts/build_index.py` exit codes from Task 5. Non-zero fails the job.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create `.github/workflows/build-index.yml`**

```yaml
name: Build index

on:
  push:
    branches: [main]
    paths:
      - 'games/**'
      - 'scripts/build_index.py'
      - '.github/workflows/build-index.yml'
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: build-index
  cancel-in-progress: true

jobs:
  build:
    if: "!contains(github.event.head_commit.message, '[skip ci]')"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Test the builder
        run: python3 -m unittest discover -s scripts -t scripts

      - name: Rebuild the games grid
        run: python3 scripts/build_index.py

      - name: Commit the regenerated index
        run: |
          git config user.name  'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          if git diff --quiet -- index.html; then
            echo "index.html already current"
          else
            git add index.html
            git commit -m "build: regenerate index.html [skip ci]"
            git push
          fi
```

The builder's tests run before the build, so a broken builder fails the job rather than committing a mangled index.

- [ ] **Step 2: Sanity check the workflow file**

There is no YAML parser in the standard library, so this is a structural check only. Real validation happens when Actions runs it in Task 8.

```bash
python3 - <<'PY'
from pathlib import Path
text = Path(".github/workflows/build-index.yml").read_text(encoding="utf-8")
assert "\t" not in text, "YAML must not contain tab characters"
for needed in ("name:", "on:", "jobs:", "runs-on: ubuntu-latest", "unittest discover"):
    assert needed in text, f"missing {needed}"
print("workflow looks structurally sound")
PY
```

Expected: `workflow looks structurally sound`.

- [ ] **Step 3: Create `README.md`**

````markdown
# Arcade

Playable browser games, hosted on GitHub Pages: https://triippiing.github.io/Arcade/

Everything runs client side. There is no server, no database, and no analytics.
High scores are saved in each player's own browser via localStorage and are never
uploaded, so scores are per person and per browser.

## Adding a game

1. Create `games/<slug>/index.html`. The slug is lowercase kebab-case and becomes
   the URL: `games/space-mines/` serves at `/Arcade/games/space-mines/`.
2. Declare the game in its `<head>`:

   | Tag | Required | Notes |
   |---|---|---|
   | `<title>` | yes | Card title |
   | `<meta name="description">` | yes | One line blurb |
   | `<meta name="added" content="YYYY-MM-DD">` | yes | Sort key, and a New badge for 30 days |
   | `<meta name="keywords">` | no | Comma separated, rendered as chips |
   | `<meta name="game-accent" content="#36e0c8">` | no | Card accent colour |
   | `<meta name="game-controls">` | no | For example `Arrows or WASD` |

3. Optionally drop a `cover.png`, `cover.jpg`, or `cover.webp` in the same folder.
   Without one the index generates a monogram tile from the slug.
4. Push to `main`. The Build index workflow regenerates `index.html` and commits
   it back, which redeploys the site.

A missing required tag fails the build rather than producing a half empty card.
Run `python3 scripts/build_index.py` locally to see the errors before pushing.

## Local preview

```bash
./serve.sh     # http://localhost:8000/
```

## Tests

```bash
python3 -m unittest discover -s scripts -t scripts -v
```

Standard library only. No dependencies to install.

## Hosting your own copy

Fork or clone this repo into your own account, then enable Pages in Settings with
the source set to the `main` branch, root folder. Your copy will serve at
`https://<your-user>.github.io/<your-repo-name>/`.

Every path in this site is relative, so it works under any repo name, under a
custom domain, and straight off the filesystem. Nothing is tied to this account.

Two notes for a fork:

- GitHub disables Actions on forks by default. Enable them under the Actions tab
  if you want the index to rebuild automatically. Nothing breaks if you do not:
  `index.html` is a committed file, it just will not refresh on its own.
- Scores are stored per origin, so your visitors' leaderboards are separate from
  this site's.
````

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build-index.yml README.md
git commit -m "feat: index refresh workflow and repo documentation"
```

---

### Task 8: Publish

**This task takes actions visible to the outside world. Confirm with Jack before Step 1 and do not run it unprompted.**

**Files:**
- No repo files change except through the workflow.

**Interfaces:**
- Consumes: the whole repo.
- Produces: a live site.

- [ ] **Step 1: Confirm with Jack, then create the remote**

Ask first. This creates a public repo under his account.

```bash
gh repo create triippiing/Arcade --public --source=. --remote=origin --push
```

- [ ] **Step 2: Enable GitHub Pages**

```bash
gh api -X POST repos/triippiing/Arcade/pages -f "source[branch]=main" -f "source[path]=/"
```

A 409 response means the site already exists, which is fine. Confirm with:

```bash
gh api repos/triippiing/Arcade/pages --jq '.html_url, .status'
```

- [ ] **Step 3: Watch the first workflow run**

```bash
gh run list --repo triippiing/Arcade --limit 5
gh run watch --repo triippiing/Arcade
```

Expected: the Build index job passes. It reports `index.html already current`, since Task 5 committed a current index.

- [ ] **Step 4: Verify the live site**

Open `https://triippiing.github.io/Arcade/`. Check:

```
[ ] Index renders with the SGC card
[ ] Card links to https://triippiing.github.io/Arcade/games/safeguarded-copy/
[ ] The game loads, starts, and is playable
[ ] Score entry works and the leaderboard persists across a reload
[ ] The back link returns to the index
[ ] It all works on a phone
```

- [ ] **Step 5: Prove the refresh loop works end to end**

Add a second tag to the game's `<meta name="keywords">`, push, and confirm the workflow runs and commits a regenerated `index.html`.

```bash
git pull
git log --oneline -3
```

Expected: a `build: regenerate index.html [skip ci]` commit authored by `github-actions[bot]`, with the new chip visible on the live index.

- [ ] **Step 6: Retire the Desktop copy**

Only once the live site is confirmed working, and only with Jack's say so.

```bash
ls -la ~/Desktop/sgc-leaderboard.html
```

The repo is now the source of truth. Future edits happen in `games/safeguarded-copy/index.html`.

---

## Notes for the executor

**The New badge is time dependent.** `main()` calls `date.today()`, so a game crosses the 30 day boundary at some point and the next workflow run produces a diff. That is expected, not a determinism bug. The determinism checks in Tasks 5 and 6 are valid because both runs happen on the same day.

**Do not add dependencies.** If a task feels like it wants PyYAML, Jinja2, or a bundler, it is being over-built. The whole builder is under 200 lines of standard library.

**Do not touch the Wiki repo.** These are separate properties that deliberately do not share assets.

**The dash hook is repo-wide.** A write containing a long dash character is rejected outright, including in commit messages and in copy quoted from elsewhere. Recast the sentence rather than reaching for the escape hatch.
