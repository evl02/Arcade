# Leaderboard Q&A Update Plan

## Top-Level Overview

Extend `leaderboard.js` with one edited fact, 12 new Q&A entries, per-page-load answer shuffling, and three new category colours. No changes to `quickfire.js`, `overlay.css`, or the read-only bundle `assets/index-DbgJ57FT.js`.

### Scope

| File | What changes |
|------|-------------|
| `leaderboard.js` | Edit one fact body; add shuffle helper; shuffle all entries; add 12 new entries; add 3 new CATEGORY_COLOURS |
| `quickfire.js` | **No changes** |
| `overlay.css` | **No changes** — pill colours are applied inline via JS |
| `assets/index-DbgJ57FT.js` | **READ-ONLY — must not be touched** |

### Hard constraints

- The bundle `assets/index-DbgJ57FT.js` is **read-only**. It hard-codes 12 in-game apple questions. The new entries added here will appear **only** in the "All Facts & Answers" modal — they will **not** appear as in-game apples. This is intentional and not a bug.
- Answer shuffling happens **once per page load** (at module load time when `ALL_QA` is defined), not per question-show. Since `ALL_QA` is a static JS array evaluated on load, this is the correct level of randomisation.

### Known data issue flagged

The submitted "Ceph — watsonx.data" entry originally marked **two** answers as TRUE:  
  - "watsonx.data" ← kept as the single correct answer  
  - "IBM Cognos Analytics" ← treated as a false distractor (data entry error)  

This correction is applied in Phase 4.

---

## Phase 1 — Edit ransomware fact text

**Intent**  
Correct the body copy of one existing `ALL_QA` entry to reflect the IBM-attributed framing.

**Expected outcomes**  
- The FlashSystem entry titled `"Ransomware detection on the array"` has its `fact` property updated.  
- The `question`, `answers`, and `correct` fields are untouched.  
- No other entries are affected.

**Todo list**  
- [ ] In `ALL_QA`, locate the entry `title: 'Ransomware detection on the array'`  
- [ ] Replace `fact` value:  
  - **From:** `'FlashSystem can spot ransomware-style write patterns in under a minute using inline data statistics.'`  
  - **To:** `'IBM has demonstrated detection of ransomware-style write patterns in under a minute using inline data statistics.'`

**Relevant context**  
- File: [`leaderboard.js`](leaderboard.js)  
- The entry is the third item in `ALL_QA` (currently around line 36–44).

**Status** `[ ] pending`

---

## Phase 2 — Add shuffle helper function

**Intent**  
Provide a reusable `shuffleAnswers(entry)` function that:
1. Takes a single `ALL_QA` entry object.
2. Builds a list of `{text, isCorrect}` pairs.
3. Applies a Fisher-Yates shuffle.
4. Returns the entry with `answers` replaced by the shuffled texts and `correct` updated to the new index of the originally-correct answer.

The function must be placed **before** the `ALL_QA` definition so it can be called inline during array initialisation in Phase 3.

**Expected outcomes**  
- A function `shuffleAnswers` exists in `leaderboard.js` above the `ALL_QA` declaration.  
- It accepts an entry object and returns a mutated (or new) entry with `answers` shuffled and `correct` pointing to the right answer.

**Todo list**  
- [ ] Insert `shuffleAnswers(entry)` above the `ALL_QA` array using a Fisher-Yates in-place shuffle  
- [ ] The function takes the four strings in `entry.answers` and the original `entry.correct` index, shuffles the array, tracks the correct answer's new position, updates `entry.correct`, and returns `entry`

**Relevant context**  
- File: [`leaderboard.js`](leaderboard.js)  
- `ALL_QA` is defined starting around line 17; the helper must sit above that.  
- The `showFactsModal` function at line 274 renders `qa.correct` and `qa.answers` directly — it requires them to already be correct after the shuffle.

**Status** `[ ] pending`

---

## Phase 3 — Apply shuffle to all existing ALL_QA entries

**Intent**  
Wrap every existing entry literal in `shuffleAnswers({...})` so that on every page load the answer order for all 11 current entries is randomised, with `correct` kept accurate.

**Expected outcomes**  
- Every object literal inside `ALL_QA` is wrapped: `shuffleAnswers({ category: ..., ... })`.  
- The modal still renders the right answer highlighted in green on every page load.  
- The `Tip` entry (which has no quiz relevance) is also wrapped — no harm done.

**Todo list**  
- [ ] For each of the 11 existing entries in `ALL_QA`, wrap the object literal with `shuffleAnswers({ ... })`

**Relevant context**  
- File: [`leaderboard.js`](leaderboard.js), lines 17–114.  
- Entries: `'One family, one software stack'`, `'FlashCore Modules compress inline'`, `'Ransomware detection on the array'` (already edited in Phase 1), `'Global data platform'`, `'Built for AI pipelines'`, `'Copies you can trust'`, `'Safeguarded Copy'`, `'Software-defined and open'`, `'Scale out, not up'`, `'Tape is still the cheapest bit'`, `'Physical air gap'`, `'Try tapping the water'`.

**Status** `[ ] pending`

---

## Phase 4 — Add 12 new Q&A entries

**Intent**  
Append 12 new entries to `ALL_QA`. Each entry is written with answers in the **order given in the specification**, wrapped in `shuffleAnswers({...})` so the final stored order is randomised at page load. The `correct` index is set to match the answer designated TRUE in the spec (before shuffling — `shuffleAnswers` will update it).

The entries are listed below with their pre-shuffle `correct` index (0-based, matching the order in the spec):

| # | Category | Title | Pre-shuffle correct index |
|---|----------|-------|--------------------------|
| 1 | FlashSystem | Swap sides without an outage | 1 |
| 2 | Storage Scale | One copy, every protocol | 1 |
| 3 | Storage Defender | Try before you commit | 2 |
| 4 | Ceph | The lakehouse foundation | 1 |
| 5 | Ceph | Beyond S3: unified Ceph | 1 |
| 6 | Fusion | HCI vs software-defined | 1 |
| 7 | Tape | Near-perfect bit error rate | 2 |
| 8 | Tape | Tape as a file system | 1 |
| 9 | VTS | TS7700 Transparent Cloud Tiering | 1 |
| 10 | VTS | Dual control cyber resilience | 1 |
| 11 | DS8K | Disaster recovery at 1,000 miles | 1 |
| 12 | DS8K | Co-designed with IBM Z | 1 |

**Data correction note**  
Entry #4 (Ceph — The lakehouse foundation): the source spec marked both `"watsonx.data"` (index 1) and `"IBM Cognos Analytics"` (index 3) as TRUE. Only `"watsonx.data"` is kept as correct. `"IBM Cognos Analytics"` is treated as a false distractor.

**Expected outcomes**  
- `ALL_QA` grows from 12 entries to 24 entries.  
- All 12 new entries appear in the modal when "All Facts & Answers" is opened.  
- The three new categories (`Fusion`, `VTS`, `DS8K`) show coloured pills (colours added in Phase 5; the fallback `#ff8a2a` is used until then).

**Todo list**  
- [ ] Append 12 new `shuffleAnswers({...})` entry objects to `ALL_QA`  
- [ ] Verify pre-shuffle `correct` indices match the TRUE answer for each entry as tabulated above  
- [ ] Confirm the `Ceph — The lakehouse foundation` entry uses only `"watsonx.data"` as correct (index 1 pre-shuffle)

**Relevant context**  
- File: [`leaderboard.js`](leaderboard.js)  
- Answers for each entry (in spec order, TRUE highlighted):

**FlashSystem — Swap sides without an outage**
```
answers: ['Only migrate overnight with downtime', "Move a host's whole storage non disruptively", 'Export it to tape first', 'Nothing, the host must be rebuilt'],
correct: 1
```

**Storage Scale — One copy, every protocol**
```
answers: ['NFS, SMB and iSCSI', 'POSIX, NFS, SMB and S3', 'NFS, SMB, S3 and FTP', 'POSIX, SMB, S3 and NVMe-oF'],
correct: 1
```

**Storage Defender — Try before you commit**
```
answers: ['7 days', '14 days', '60 days', 'There is no trial'],
correct: 2
```

**Ceph — The lakehouse foundation** *(data correction applied)*
```
answers: ['IBM Cloud Pak for Data (Db2 Warehouse)', 'watsonx.data', 'IBM Storage Fusion', 'IBM Cognos Analytics'],
correct: 1
```

**Ceph — Beyond S3: unified Ceph**
```
answers: ['Block (RBD), file and FICON', 'Block (RBD), file, NFS and NVMe-oF', 'File, NFS and LTFS tape', 'Block (RBD) and SMB only'],
correct: 1
```

**Fusion — HCI vs software-defined**
```
answers: ['IBM Storage Scale ECE (the same engine)', 'Red Hat OpenShift Data Foundation (ODF)', 'IBM Storage Ceph', 'Red Hat OpenShift Container Storage Classic (OCS)'],
correct: 1
```

**Tape — Near-perfect bit error rate**
```
answers: ['1 error in 10²¹ bits (same as enterprise HDD)', '1 error in 10¹⁸ bits', '1 error in 10²¹ bits (~1 per exabyte)', '1 error in 10²⁴ bits'],
correct: 2
```

**Tape — Tape as a file system**
```
answers: ['Only stream it sequentially', 'Access it like an open-format file system', 'Encrypt it twice', 'Run applications directly on it'],
correct: 1
```

**VTS — TS7700 Transparent Cloud Tiering**
```
answers: ['It eliminates the need for any physical tape', 'It offloads data movement, cutting Z CPU and I/O cost', 'It compresses data more than FICON tape can', 'It replaces Copy Services replication'],
correct: 1
```

**VTS — Dual control cyber resilience**
```
answers: ['rsyslog tamperproof logging', 'Dual control on sensitive settings', 'AES-256 disk encryption', 'Granular roles and permissions'],
correct: 1
```

**DS8K — Disaster recovery at 1,000 miles**
```
answers: ['RPO ~2 min, RTO ~5 min', 'RPO ~2 sec, RTO under ~60 sec', 'RPO zero, RTO ~2 sec', 'RPO ~2 sec, RTO ~15 min'],
correct: 1
```

**DS8K — Co-designed with IBM Z**
```
answers: ['IBM restricts them to its largest banking clients first', 'They are co-designed, developed and tested with the IBM Z team', 'They are standardised through an open industry consortium', 'They reuse mature features already shipped by rivals'],
correct: 1
```

**Status** `[ ] pending`

---

## Phase 5 — Add new CATEGORY_COLOURS entries

**Intent**  
Add colour values for the three new categories introduced in Phase 4 so that the modal pills render in distinct, branded colours instead of the orange fallback.

**Expected outcomes**  
- `CATEGORY_COLOURS` contains entries for `'Fusion'`, `'VTS'`, and `'DS8K'`.  
- All new category pills render with their correct colours in the modal.

**Todo list**  
- [ ] Add `'Fusion': '#7c5cd8'` (blue-purple) to `CATEGORY_COLOURS`  
- [ ] Add `'VTS': '#00897b'` (teal) to `CATEGORY_COLOURS`  
- [ ] Add `'DS8K': '#1565c0'` (steel blue) to `CATEGORY_COLOURS`

**Relevant context**  
- File: [`leaderboard.js`](leaderboard.js), lines 117–124.  
- The `showFactsModal` function reads `CATEGORY_COLOURS[qa.category]` and falls back to `'#ff8a2a'`; no CSS changes are needed.

**Status** `[ ] pending`

---

## Phase 6 — Verification

**Intent**  
Confirm the file is syntactically valid and functionally correct after all edits.

**Expected outcomes**  
- No JavaScript syntax errors (brace/bracket balance, no stale text).  
- `ALL_QA.length === 24`.  
- Every entry has exactly 4 answers and a `correct` value of 0–3.  
- The ransomware fact no longer contains the old text.  
- The modal renders all 24 entries with correct green/red highlighting.  
- `CATEGORY_COLOURS` has 9 keys (6 original + 3 new).  
- `quickfire.js`, `overlay.css`, and `assets/index-DbgJ57FT.js` are unmodified.

**Todo list**  
- [ ] Read `leaderboard.js` and confirm total entry count is 24  
- [ ] Confirm `CATEGORY_COLOURS` has all 9 keys  
- [ ] Confirm the ransomware fact body is the new IBM-attributed text  
- [ ] Confirm no entry has `correct` outside range 0–3  
- [ ] Confirm `quickfire.js`, `overlay.css`, and `assets/index-DbgJ57FT.js` are unchanged  
- [ ] Open the game in a browser (or review the rendered modal output) to verify pill colours and answer highlighting

**Status** `[ ] pending`
