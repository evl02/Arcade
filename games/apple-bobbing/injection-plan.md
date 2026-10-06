# In-game Question Injection — Correct Plan

## What we know from reading the bundle source

### Why the last attempt broke the game
The previous injection observed `#quiz-prompt` for `childList` mutations. The problem: `I.show()` writes `prompt.textContent`, `category.textContent`, and four `button.textContent` values **synchronously in one call**. The `#quiz-prompt` MutationObserver fired partway through that sequence — while `I.show()` was still executing. Writing back to `promptEl.textContent` inside that observer triggered further mutations while the bundle was mid-render, corrupting its state.

### The correct injection window
`I.show()` does its writes in this exact order:
1. `category.textContent = e.category`
2. `prompt.textContent = e.prompt`
3. `buttons[0..3].textContent = answers[0..3]`
4. `buttons[0..3].disabled = false`
5. `buttons[0..3].classList.remove('right','wrong')`
6. `bar.classList.remove('urgent')`
7. `this.locked = false`
8. **`this.card.classList.remove('hidden')`** ← quiz card becomes visible
9. `backdrop.classList.remove('hidden')`
10. `this.buttons[0].focus()`

**The `hidden` class removal from `#quiz-card` is the last meaningful write.** Observing `#quiz-card` for `class` attribute changes (already done in `watchAnswers`) fires ONCE, AFTER all button texts and prompt are set. There is zero re-entrancy risk because we are not observing any element we write to.

### How the bundle scores answers
`ue(e)` is called with the button INDEX the player tapped. It checks `e === oe.correct` where `oe.correct` is the shuffled correct index set by `mh()` BEFORE `I.show()`. The scoring is entirely index-based.

**If we swap the displayed text of the button at `oe.correct`'s position to our correct answer, the bundle's scoring still works correctly** — the player clicks the right button, the bundle marks it `.right`.

### How we find `oe.correct` without reading bundle internals
We do not need to read `oe.correct` directly. We know the exact unshuffled text of every correct answer for all 12 bundle questions (from reading `sh[]`). After `I.show()` renders the buttons, we scan all 4 buttons and find which one contains the bundle question's known correct answer text. That button's index IS `oe.correct`.

### How the game ends
`Bh()` ends the game when `collected.size === D` (D=12 total facts). The `collected` set tracks fact IDs like `'flash-01'`. The game ends after all 12 UNIQUE facts are answered correctly — not on a timer. This means the player sees exactly 12 questions per game (modulo wrong answers which `putBack` the fact).

New questions we inject visually do not change which fact ID the bundle thinks was answered. Our injection is cosmetic from the bundle's perspective — the bundle scores the button index, and we arrange our answers so the correct one is at the right index.

---

## The plan

### Phase 1 — Add `injectNewQuestion()` function to `quickfire.js`

**Intent**  
A standalone function that, given the currently displayed quiz card state, may swap the visible question and answers with one of the 12 new questions. It is called ONCE per question, AFTER the bundle has finished all its DOM writes, triggered by the `#quiz-card` `hidden` class removal.

**Logic**
1. Read the current `#quiz-prompt` text (already PLACEHOLDER-stripped by `watchPlaceholderText`)
2. Match it against `BUNDLE_QUESTIONS` lookup to find which bundle question is showing and what its known correct answer text is
3. Scan the 4 `button.answer` elements to find which button holds that correct answer text → that is the correct button slot
4. If the slot is found AND there are new questions in the pool AND random chance allows: pick one new question from the pool, place its correct answer at the found slot, place its 3 wrong answers (Fisher-Yates shuffled) at the remaining slots, update `#quiz-prompt` text, update `#quiz-category` pill
5. If the bundle question cannot be identified (fallback): skip injection for this question — never break the game

**Why this is safe**
- We write to `#quiz-prompt`, `#quiz-category`, and `button.textContent` — none of these are observed by our MutationObservers (we observe `#quiz-card` class, `#fact-body`, and `#quiz-answers` classes — not prompt or button text)
- We write AFTER `I.show()` is completely done
- The bundle's `onAnswer` callback uses button index only — text doesn't matter to scoring
- The bundle's `locked=false` and `disabled=false` states are already set by `I.show()` before we write

**Pool management**
- 12 new questions stored in `NEW_QUESTIONS` array
- Pool is a Fisher-Yates shuffled array of indices, consumed one at a time
- When pool empties it refills with a fresh shuffle — player sees all 12 new questions before any repeats
- Pool resets when `#quiz-card` transitions hidden→visible AND `#caught-count` is `'0'` (new game started)

**Injection rate**  
Configurable constant `INJECT_EVERY_N = 2` — inject a new question every 2nd apple on average (alternates bundle question / new question). This ensures variety without showing only new questions.

**Todo list**
- [ ] Add `BUNDLE_QUESTIONS` lookup array (12 entries, stripped prompts + correct answer texts)
- [ ] Add `NEW_QUESTIONS` array (the 12 new entries)
- [ ] Add `_newQPool` management (`_refillPool`, pool reset on game restart)
- [ ] Add `injectNewQuestion()` function with safe slot detection and DOM swap
- [ ] Add `watchQuizCard()` function that observes `#quiz-card` class changes and calls `injectNewQuestion()` only on hidden→visible transitions
- [ ] Call `watchQuizCard()` from `DOMContentLoaded` boot block

### Phase 2 — Keep `watchPlaceholderText` as-is

The existing PLACEHOLDER strip on `#fact-body` and `#quiz-prompt` is correct and safe. It remains unchanged. The injection happens AFTER the strip (since both are triggered by different events — strip fires on text mutation, injection fires on card visibility change).

**Note:** when we swap `#quiz-prompt` text in `injectNewQuestion()`, the strip observer will NOT re-fire because the new text does not contain "PLACEHOLDER:" — the reentrancy guard in the strip observer is a safety net but won't even be needed.

### Phase 3 — Verify

- New questions appear in-game (roughly every other apple)
- Correct answer always highlighted green
- Wrong answer always highlighted red  
- Score increases correctly on right answer
- Game ends correctly after 12 apples (bundle's cleared condition unaffected)
- PLACEHOLDER: never shown
- Fisher-Yates QF word shuffle still in place
- Bundle MD5 unchanged

---

## Key data: BUNDLE_QUESTIONS lookup

These are the 12 stripped prompts and their known-correct answer texts from the bundle's `sh[]`:

| Prompt (stripped) | Correct answer text |
|-------------------|---------------------|
| Which software runs on every IBM FlashSystem model? | Storage Virtualize |
| Where do FlashCore Modules compress and encrypt data? | In hardware on the module |
| Roughly how fast can FlashSystem flag ransomware-style write patterns? | Under a minute |
| IBM Storage Scale presents the same data through which access methods? | File, object and HDFS |
| What is Storage Scale System 6000 designed to keep fed? | GPUs |
| What does IBM Storage Defender check about your backup copies? | That they are clean and trustworthy |
| What can an admin NOT do to a Safeguarded Copy before it expires? | Delete it |
| IBM Storage Ceph runs on what kind of hardware? | Commodity servers |
| How do you grow capacity and performance in a Ceph cluster? | Add nodes |
| What archival life is quoted for LTO tape? | 30 years |
| Why can't a network attacker reach a tape cartridge on a shelf? | It is physically air-gapped |
| What happens when you tap the open water? | You make a splash |

This lookup is the bridge: after the bundle renders, we find the correct button by matching the button text to the "Correct answer text" column — no bundle internals needed.

---

## What will NOT change

- `assets/index-DbgJ57FT.js` — read-only, untouched
- `watchPlaceholderText` — unchanged
- `watchAnswers`, `watchClicks`, `watchMusic`, `watchMuteButton`, `watchFactsLeft` — unchanged
- `leaderboard.js` — unchanged
- Scoring logic — bundle owns it completely
- Game-over condition — bundle's 12-fact cleared condition unchanged
