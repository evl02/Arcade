# Apple Bobbing — Fixes & Enhancements Plan (v2)

## Top-Level Overview

Five distinct problems need to be resolved across `leaderboard.js`, `quickfire.js`, and `overlay.css`. The read-only constraint on `assets/index-DbgJ57FT.js` (the game engine bundle) applies throughout.

### Hard architectural constraints
- `assets/index-DbgJ57FT.js` — **READ-ONLY.** Contains the 3D water simulation, quiz card logic, fact-card logic, and the game-over timer.
- The bundle's 12 hardcoded facts are entirely separate from the `ALL_QA` array in `leaderboard.js`. They cannot be replaced — only intercepted in the DOM.
- The game ends when the bundle's **run clock** expires (not when apples run out). Apple recycling is built into the bundle's `FactDeck`.
- New Q&A entries added to `ALL_QA` appear **only** in the "All Facts & Answers" modal, **not** as in-game apples.

---

## What the screenshots confirmed

Screenshot 1 (fact card after correct answer):
> **"PLACEHOLDER: Tap the open water to make a splash and watch the apples bob."**

Screenshot 2 (quiz question during gameplay):
> **"PLACEHOLDER: How do you grow capacity and performance in a Ceph cluster?"**

The word "PLACEHOLDER:" is prepended by the bundle to **every** fact body (shown in `#fact-body`) and **every** quiz question (shown in `#quiz-prompt`). It is in the bundle's own internal data and appears at runtime on every single in-game fact card and quiz question. Since the bundle cannot be edited, the fix intercepts both DOM elements with MutationObservers and strips the prefix immediately after each write.

---

## Issues map

| # | Issue | Root cause | Fix location |
|---|-------|-----------|-------------|
| 1 | New Q&A entries not in "All Facts & Answers" | `ALL_QA` in `leaderboard.js` still has the original 12 entries — the 12 new ones from the previous plan have never been applied | `leaderboard.js` |
| 2 | Quick Fire submit pressed multiple times increases score | `qfActive` flag stays `true` for 2 seconds after a correct answer (it is only set `false` inside `endRound()` which fires after a `setTimeout` delay), creating a window where repeat presses re-enter the scoring path | `quickfire.js` — `handleSubmit` |
| 3 | Questions/fire rounds not randomised | Answer order in `ALL_QA` is fixed; the `shuffleAnswers` helper from the previous plan has not been implemented yet. QF word pool IS already shuffled. | `leaderboard.js` |
| 4 | "PLACEHOLDER:" appears on in-game fact card AND quiz question | Baked into the bundle's data — it prepends "PLACEHOLDER:" to every `fact.body` and every `fact.question` string before writing them to `#fact-body` and `#quiz-prompt`. Cannot be removed from the bundle source. | `quickfire.js` — DOM intercept via MutationObserver |
| 5 | Game goes to leaderboard after 12 apples; new questions not mixed in | The game ends when the run clock expires (bundle behaviour, correct). "New questions not mixed in" is confirmed: new `ALL_QA` entries only appear in the modal, **not** in gameplay. The in-game apples are fixed at 12 by the bundle. | Architecture constraint — no fix possible for gameplay mixing; modal is the right vehicle |

---

## ⚠ Clarifications confirmed and flagged

### A — "PLACEHOLDER:" prefix (confirmed from screenshots)
The bundle prepends `"PLACEHOLDER: "` to the text of both:
- `#fact-body` — the fact shown on the gold card after each correct answer
- `#quiz-prompt` — the question shown during the quiz timer

**Fix approach:** A `MutationObserver` watching both elements. When the bundle sets their `textContent` or child text node, the observer immediately strips the `"PLACEHOLDER: "` prefix (case-insensitive, trimmed). This fires in the same microtask queue as the DOM mutation, so the player sees the clean text with no flash.

### B — New questions in gameplay (architectural constraint)
The bundle hard-codes exactly 12 fact objects inside its compiled JS. These cannot be replaced or extended without recompiling the bundle. The new Q&A entries in `ALL_QA` can only appear in the **"All Facts & Answers" modal** (accessible from the game-over screen). This is a hard constraint, not a bug. The plan does NOT attempt to inject new questions into gameplay.

### C — Game continues past 12 apples
Confirmed: the game DOES continue — the bundle's `FactDeck` reshuffles and recycles after all 12 facts are shown. The game ends only when the run clock expires. The player is taken to the leaderboard screen because time ran out, not because the apple count was exhausted. No fix needed here. The HUD "0 facts still lurking" text is a cosmetic issue only — addressed in Phase 3.

---

## Phase 1 — Add 12 new Q&A entries, shuffleAnswers helper, ransomware edit, new category colours

**Intent**
Apply all pending `leaderboard.js` changes from `leaderboard-qa-update-plan.md`:
- Edit the ransomware fact body text
- Add `shuffleAnswers()` helper function above `ALL_QA`
- Wrap all 12 existing `ALL_QA` entries in `shuffleAnswers({...})`
- Append 12 new entries (also wrapped in `shuffleAnswers`)
- Add `'Fusion'`, `'VTS'`, `'DS8K'` to `CATEGORY_COLOURS`

**Expected outcomes**
- `ALL_QA.length === 24`
- "All Facts & Answers" modal shows 24 entries; answer order is randomised on each page load
- Ransomware fact reads "IBM has demonstrated detection of ransomware-style write patterns…"
- `CATEGORY_COLOURS` has 9 keys
- Modal pills for Fusion (blue-purple), VTS (teal) and DS8K (steel blue) render in their correct colours

**Todo list**
- [ ] Read `leaderboard-qa-update-plan.md` for verbatim entry data and pre-shuffle correct indices for all 12 new entries
- [ ] Add `shuffleAnswers(entry)` helper using Fisher-Yates shuffle, placed immediately above the `ALL_QA` declaration
- [ ] Edit the `fact` string of the FlashSystem entry titled `'Ransomware detection on the array'`
- [ ] Wrap all 12 existing `ALL_QA` entry objects in `shuffleAnswers({...})`
- [ ] Append 12 new entries each wrapped in `shuffleAnswers({...})`, with pre-shuffle `correct` indices as specified in the plan file
- [ ] Add `'Fusion': '#7c5cd8'`, `'VTS': '#00897b'`, `'DS8K': '#1565c0'` to `CATEGORY_COLOURS`
- [ ] Confirm total entry count is 24 and no JavaScript syntax errors

**Relevant context**
- File: [`leaderboard.js`](leaderboard.js) lines 17–124
- Reference data: [`leaderboard-qa-update-plan.md`](leaderboard-qa-update-plan.md) — Phase 4 contains all 12 new entries verbatim with correct indices
- `showFactsModal` (line 274) requires no changes — it iterates `ALL_QA` directly

**Status** `[ ] pending`

---

## Phase 2 — Quick Fire submit debounce

**Intent**
`handleSubmit` in `quickfire.js` checks `if (!qfActive) return` at entry. However `qfActive` is only set to `false` inside `endRound()`, which is invoked via `setTimeout(endRound, 2000)` after a correct answer. During the 2-second countdown-to-dismiss window, pressing Submit again passes the `qfActive` guard, adds points a second time, and queues a redundant `endRound`. The fix is a local `submitted` boolean that flips immediately on the first correct (or exhausted) answer — before the `setTimeout` fires.

**Expected outcomes**
- Pressing Submit or Enter rapidly after a correct answer only awards points once per QF round
- Behaviour for wrong answers and timeout is unchanged
- The fix is local to `showQuickFire`'s closure — no global state needed

**Todo list**
- [ ] In `showQuickFire`, declare `let submitted = false;` alongside `attempt`, `timeLeft`, and `intervalId`
- [ ] At the top of `handleSubmit`, add `if (submitted) return;` immediately after the existing `if (!qfActive) return;` check
- [ ] In the correct-answer branch, set `submitted = true;` immediately before `clearInterval(intervalId)`
- [ ] In the final-wrong-answer branch (`attempt >= MAX_ATTEMPTS`), set `submitted = true;` immediately before its `setTimeout`

**Relevant context**
- File: [`quickfire.js`](quickfire.js) — `handleSubmit` function inside `showQuickFire`, around lines 228–280
- The outer `qfActive` guard (line 231) is kept as-is — it's the session-level guard
- No changes to `endRound`, `watchAnswers`, or `questionHandled`

**Status** `[ ] pending`

---

## Phase 3 — Strip "PLACEHOLDER:" prefix from in-game fact card and quiz question

**Intent**
The bundle writes "PLACEHOLDER: …" to two DOM elements every time an apple is caught:
- `#fact-body` — the body of the fact card shown after a correct answer
- `#quiz-prompt` — the question shown during the 12-second quiz timer

A `MutationObserver` is attached to each element. Whenever the bundle sets the element's text, the observer fires synchronously and strips the `"PLACEHOLDER: "` prefix (and any leading/trailing whitespace). The player never sees the prefix because the strip happens in the same microtask.

**Expected outcomes**
- In-game fact card body text no longer starts with "PLACEHOLDER:"
- Quiz question text no longer starts with "PLACEHOLDER:"
- No other text content on those elements is altered
- All 12 fact bodies and all 12 quiz questions are cleaned on every occurrence, including after recycling (when the FactDeck reshuffles and replays facts)

**Todo list**
- [ ] In `quickfire.js`, add a `watchPlaceholderText()` function
- [ ] Inside it, attach a `MutationObserver` to `#fact-body` with `{ childList: true, characterData: true, subtree: true }`; in the callback strip `"PLACEHOLDER: "` (case-insensitive, with trailing space/colon variants) from `el.textContent` if present
- [ ] Attach the same pattern to `#quiz-prompt` (same observer or a second one — both elements need the same treatment)
- [ ] The strip must be idempotent — if the text does not start with the prefix, do nothing
- [ ] Call `watchPlaceholderText()` from the `DOMContentLoaded` boot block
- [ ] Use `disconnect()` guard or a flag to avoid the observer triggering itself when we write back the cleaned text

**Relevant context**
- File: [`quickfire.js`](quickfire.js) — boot block at lines ~500–514
- `#fact-body` is in [`index.html`](index.html) line 85
- `#quiz-prompt` is in [`index.html`](index.html) line 75
- The prefix as seen in screenshots: `"PLACEHOLDER: "` (all caps, colon, space before actual text)
- Must handle both `childList` mutations (bundle replaces the text node) and direct `textContent` assignments

**Status** `[ ] pending`

---

## Phase 4 — HUD counter: replace "0 facts still lurking" with "Keep bobbing!"

**Intent**
When the bundle has shown all 12 initial facts, the `#facts-left` span drops to `"0"` and the full `#counter-sub` line reads "0 facts still lurking" — making the game feel over. The game actually continues (the FactDeck recycles). We watch `#facts-left` and replace the parent element's text when it hits zero.

**Expected outcomes**
- When `#facts-left` reads `"0"`, the `#counter-sub` element displays `"Keep bobbing!"` instead
- The run clock continues; the game does not end early
- On game reset (`resetSession`) the counter restores to its original text

**Todo list**
- [ ] In `quickfire.js`, add a `watchFactsLeft()` function that attaches a `MutationObserver` to `#facts-left` (or polls its parent) watching for `textContent === "0"`
- [ ] When it hits `"0"`, set the `#counter-sub` element's `textContent` to `"Keep bobbing!"`
- [ ] In `resetSession()`, restore `#counter-sub` to its original text (e.g. `<span id="facts-left">12</span> facts still lurking`) by setting its `innerHTML` back — or alternatively just leave it for the bundle to reset on new game
- [ ] Call `watchFactsLeft()` from the `DOMContentLoaded` boot block

**Relevant context**
- File: [`quickfire.js`](quickfire.js)
- HUD structure: [`index.html`](index.html) lines 49–56 — `#counter-sub` contains `#facts-left` as a child `<span>`
- Original text: `<span id="facts-left">12</span> facts still lurking`

**Status** `[ ] pending`

---

## Phase 5 — Verify and validate

**Intent**
Confirm all four phases are complete and the file is syntactically valid.

**Expected outcomes**
- `ALL_QA.length === 24` in `leaderboard.js`
- "All Facts & Answers" modal shows 24 entries with randomised answer order
- Ransomware fact body reads "IBM has demonstrated…"
- `CATEGORY_COLOURS` has 9 keys
- QF Submit pressed rapidly after correct answer does not multiply points
- In-game fact card body and quiz prompt never show "PLACEHOLDER:"
- HUD shows "Keep bobbing!" when `#facts-left` reaches 0
- `assets/index-DbgJ57FT.js` is unchanged
- `quickfire.js`, `leaderboard.js`, and `overlay.css` have no syntax errors

**Todo list**
- [ ] Confirm `ALL_QA.length === 24` by counting entries in `leaderboard.js`
- [ ] Confirm `submitted` flag is present in `showQuickFire` and set before `clearInterval` in correct-answer branch
- [ ] Confirm `watchPlaceholderText()` is defined and called from `DOMContentLoaded` boot block
- [ ] Confirm `watchFactsLeft()` is defined and called from `DOMContentLoaded` boot block
- [ ] Confirm `CATEGORY_COLOURS` has 9 keys
- [ ] Confirm `assets/index-DbgJ57FT.js` is unchanged (check git status or file modification time)

**Status** `[ ] pending`
