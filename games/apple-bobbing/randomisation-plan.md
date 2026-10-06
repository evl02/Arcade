# Randomisation Plan — In-game Questions & Quick Fire Word Pool

## What was discovered in the bundle

Reading `assets/index-DbgJ57FT.js` directly reveals the following architecture:

### Bundle facts & questions (module-private)

The bundle contains two **module-scoped** arrays that cannot be accessed or replaced from outside:

- **`th`** — 12 hardcoded fact objects (`{id, category, title, body}`)
- **`sh`** — 12 hardcoded quiz question objects (`{id, factId, prompt, answers, correct}`)

The `FactDeck` class (`eh`) is built by calling `oh()` which reads from `th`. The quiz question list `ie` is built once by calling `dh()` which reads from `sh`. Because the bundle is a JS **module**, both `th` and `sh` are module-private — there is no `window.th` or any other external hook.

**These 12 questions are fixed and cannot be extended from outside the bundle.**

### How the bundle already randomises

- `FactDeck.draw()` uses a Fisher-Yates shuffle on the pile each time it is exhausted — so the fact order is already randomised per cycle.
- `mh(t, Math.random)` shuffles the answer button order for every quiz question shown.
- The `se()` reset function calls `T = new eh(oh())` — a brand-new FactDeck — on each Play Again, giving a fresh shuffle.

### Quick Fire word pool — the real bug

`resetSession()` in `quickfire.js` builds `qfWordPool` like this:

```js
qfWordPool = [...WORD_BANK].sort(() => Math.random() - 0.5);
```

**`Array.sort()` with a random comparator is NOT a uniform shuffle.** It is well-documented to be biased because the sort algorithm calls the comparator fewer than `n*(n-1)/2` times and the result distribution is non-uniform. With 15 words and only 3 QF rounds per game, the same words appear disproportionately often. This is the root cause of "I keep getting the same ones."

The fix is to replace the `.sort()` call with a proper **Fisher-Yates shuffle** — the same algorithm the bundle itself uses for `FactDeck`.

---

## Problems, causes, and what CAN be fixed

| Problem | Root cause | Fixable? |
|---------|-----------|---------|
| New 12 questions never appear in-game | Bundle `th`/`sh` are module-private and hard-coded — cannot be injected into | ❌ Not without rebuilding the bundle |
| In-game question ORDER feels repetitive across game sessions | Bundle's `FactDeck` **already** re-shuffles on each `se()` reset | ✅ Already fixed by the bundle — no action needed |
| Quick Fire rounds repeat the same words | `qfWordPool` uses biased `.sort()` shuffle — not Fisher-Yates | ✅ Fixable in `quickfire.js` |
| All 24 new Q&A entries only visible in the modal | Architectural constraint — modal IS the right place for them | ✅ Already working correctly |

---

## The honest answer on "mixing new questions into the game"

The bundle's 12 in-game apple questions come from its **own private compiled data** (`th` and `sh`). They cannot be replaced, supplemented, or randomised from any external script. The only paths to change the in-game question set are:

1. **Rebuild the bundle from source** — if the original source project (pre-compilation) is available, the new questions can be added to `th` and `sh` there and recompiled.
2. **Replace the bundle entirely** — write a new game engine from scratch. This is a large project.
3. **Accept the current architecture** — in-game apples use the 12 bundle questions (already shuffled per game); the 24 additional Q&A entries are shown in the post-game "All Facts & Answers" modal.

This plan only covers what **can** be improved: the QF word pool shuffle.

---

## Phase 1 — Fix Quick Fire word pool shuffle (biased → Fisher-Yates)

**Intent**
Replace the `Array.sort(() => Math.random() - 0.5)` shuffle in `resetSession()` with a proper Fisher-Yates in-place shuffle. This gives a genuinely uniform distribution across the 15 WORD_BANK entries, so all 3 QF rounds in a game use different words, and across multiple games the word order is properly randomised.

**Root cause detail**
`resetSession()` line 102:
```js
qfWordPool = [...WORD_BANK].sort(() => Math.random() - 0.5);
```
JavaScript's `Array.sort` is not guaranteed to call the comparator for every pair, and in V8 (Chrome/Node) the comparator is called O(n log n) times — far fewer than the n(n-1)/2 needed for a uniform shuffle. The result: certain words cluster near the front of the pool and appear in almost every game.

**Fix**
Replace with a Fisher-Yates shuffle:
```js
// Fisher-Yates — produces a uniform permutation
function fisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```
Then in `resetSession()`:
```js
qfWordPool = fisherYates(WORD_BANK);
```

**Expected outcomes**
- All 15 words have equal probability of appearing in any given game session
- No word repeats within a game (pool is drawn sequentially, never repeated until the next `resetSession`)
- Across multiple games, the three QF words are different combinations each time
- No change to QF round count (still 3 per game), trigger points (3, 6, 10), or scoring

**Todo list**
- [ ] Add a `fisherYates(arr)` helper function in `quickfire.js` near the other helpers (`scramble`, `buildHint`)
- [ ] In `resetSession()`, replace `[...WORD_BANK].sort(() => Math.random() - 0.5)` with `fisherYates(WORD_BANK)`
- [ ] Verify the WORD_BANK has 15 entries (confirmed: it does) — more than enough for 3 QF rounds without repetition

**Relevant context**
- File: [`quickfire.js`](quickfire.js) line 102 — `qfWordPool = [...]sort(...)` in `resetSession()`
- The `fisherYates` function already exists conceptually as `$m` in the bundle (`$m` is the bundle's own Fisher-Yates used for `FactDeck`) — we just write our own copy in our code

**Status** `[ ] pending`

---

## Phase 2 — Verify in-game question randomness (confirm bundle already handles it)

**Intent**
Confirm that the bundle's existing shuffle is working correctly and no additional changes are needed for in-game question order.

**What the bundle does**
- `FactDeck.draw()`: when `pile` is empty, reshuffles all 12 facts using `$m` (Fisher-Yates) then draws from the top — guarantees every fact appears before any repeats
- `se()` reset: `T = new eh(oh())` creates a brand-new `FactDeck` with a fresh empty `pile` — first game and every Play Again gets a newly shuffled order
- Answer button order: `mh(t, Math.random)` shuffles the 4 answer positions per question independently

**Conclusion**
The in-game question randomisation is already correct. No changes needed.

**Todo list**
- [ ] No code changes — document the finding in a comment in `quickfire.js` if helpful

**Status** `[ ] pending` (documentation only, no code)

---

## Phase 3 — Verify and validate

**Intent**
Confirm the Fisher-Yates fix is applied and no regressions.

**Expected outcomes**
- `qfWordPool` in `resetSession()` uses `fisherYates(WORD_BANK)` not `.sort()`
- QF rounds still trigger at correct apple counts (3, 6, 10)
- Word pool still depletes sequentially (no repeats within a session)
- `assets/index-DbgJ57FT.js` is unchanged

**Todo list**
- [ ] Read `quickfire.js` and confirm `fisherYates` function exists and is used in `resetSession()`
- [ ] Confirm `.sort(() => Math.random()` is no longer present in `resetSession()`
- [ ] Confirm `assets/index-DbgJ57FT.js` modification time is unchanged

**Status** `[ ] pending`

---

## Clarification to communicate to the user

**"Can the 12 new questions appear as in-game apples?"**

No — not without a source rebuild. The bundle's fact and question data is compiled inside `assets/index-DbgJ57FT.js` as module-private variables (`th` for facts, `sh` for questions). They are completely inaccessible from any external script. The new 24 Q&A entries in `ALL_QA` are correctly placed in the "All Facts & Answers" modal on the game-over screen.

If the original source project (pre-build files, e.g. a `src/` folder or a TypeScript/Vite project) is available and can be shared, the new questions can be added to the source and the bundle recompiled. That is the only route to getting them into the live gameplay.
