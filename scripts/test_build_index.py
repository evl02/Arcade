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

    def test_valid_slug_passes(self):
        path = write_game(self.root, "space-mines")
        game, errors = build_index.parse_game(path)
        self.assertEqual(errors, [])
        self.assertEqual(game.slug, "space-mines")

    def test_uppercase_slug_is_an_error(self):
        path = write_game(self.root, "SpaceMines")
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertIn("kebab-case", errors[0])

    def test_slug_with_a_space_is_an_error(self):
        path = write_game(self.root, "space mines")
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertIn("kebab-case", errors[0])

    def test_slug_with_a_quote_is_an_error(self):
        path = write_game(self.root, 'space"mines')
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertIn("kebab-case", errors[0])

    def test_slug_with_a_leading_or_trailing_hyphen_is_an_error(self):
        path = write_game(self.root, "-space-mines-")
        game, errors = build_index.parse_game(path)
        self.assertIsNone(game)
        self.assertIn("kebab-case", errors[0])

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

    def test_tile_is_decorative(self):
        """The tile is inside the card link, which already names the game, so the
        SVG itself must not be announced: aria-hidden, and no aria-label repeating
        the title."""
        svg = build_index.fallback_tile(self.make_tile_game(title='Quote " & <tag>'))
        self.assertIn('aria-hidden="true"', svg)
        self.assertNotIn("aria-label", svg)


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

    def test_cover_image_is_decorative(self):
        """The card link already names the game via its title, so the cover art
        must not repeat it: empty alt, not a copy of the title."""
        card = build_index.render_card(
            make_game(title="Arty", cover="cover.png"), self.TODAY
        )
        self.assertIn('alt=""', card)
        self.assertNotIn("Arty cover", card)

    def test_card_title_is_a_heading(self):
        card = build_index.render_card(make_game(title="Alpha"), self.TODAY)
        self.assertIn('<h2 class="card-title">', card)
        self.assertIn("</h2>", card)

    def test_grid_and_chips_expose_list_role(self):
        card = build_index.render_card(make_game(tags=["arcade"]), self.TODAY)
        self.assertIn('<ul class="chips" role="list">', card)

    def test_slug_is_escaped_at_both_interpolation_sites(self):
        """Defence in depth: parse_game rejects a slug like this before it ever
        reaches render_card, but the escaping here must hold on its own too."""
        game = make_game(slug='x" onmouseover="alert(1)', cover="cover.png")
        card = build_index.render_card(game, self.TODAY)
        self.assertNotIn('onmouseover="alert(1)"', card)
        self.assertIn("&quot;", card)

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
        self.assertIn("&quot;go&quot;", card)


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

    def test_grid_exposes_list_role(self):
        grid = build_index.render_grid([make_game()], self.TODAY)
        self.assertIn('<ul class="grid" role="list">', grid)

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


if __name__ == "__main__":
    unittest.main()
