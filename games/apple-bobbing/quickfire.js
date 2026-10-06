/**
 * quickfire.js — Apple Bobbing overlay v2
 *
 * Responsibilities:
 *  1. Quick Fire rounds (up to 3 per game, triggered after apples 3, 6, 10)
 *  2. Correct/wrong sound hooks on quiz answers
 *  3. Click sounds on all buttons
 *  4. Green bubble + tint visual on wrong answers
 *  5. Periodic water disturbance (makes apples bob more actively)
 *  6. Best-effort question deduplication (auto-skips already-correct questions)
 *  7. Music start/stop on game begin/end
 *  8. Mute button wiring
 */

import {
  initAudio, playCorrect, playWrong, playQuickFireAlert, playClick,
  startMusic, stopMusic, toggleMute, isMuted
} from './audio.js';

/* ─── IBM Storage word bank ─────────────────────────────────────────────── */
// Words with underscores are displayed with a space; accepted either way
const WORD_BANK = [
  { word: 'FLASHSYSTEM',        display: 'FLASHSYSTEM' },
  { word: 'DEFENDER',           display: 'DEFENDER' },
  { word: 'CEPH',               display: 'CEPH' },
  { word: 'FUSION',             display: 'FUSION' },
  { word: 'TAPE_LIBRARY',       display: 'TAPE LIBRARY' },
  { word: 'SCALE',              display: 'SCALE' },
  { word: 'STORAGE_VIRTUALIZE', display: 'STORAGE VIRTUALIZE' },
  { word: 'STORAGE_PROTECT',    display: 'STORAGE PROTECT' },
  { word: 'STORAGE_INSIGHTS',   display: 'STORAGE INSIGHTS' },
  { word: 'SNAPSHOTS',          display: 'SNAPSHOTS' },
  { word: 'REPLICATION',        display: 'REPLICATION' },
  { word: 'POLICY_BASED_REPLICATION', display: 'POLICY BASED REPLICATION' },
  { word: 'FLASHGRID',               display: 'FLASHGRID' },
  { word: 'DEDUPLICATION',      display: 'DEDUPLICATION' },
  { word: 'COMPRESSION',        display: 'COMPRESSION' },
];

/* ─── State ─────────────────────────────────────────────────────────────── */
// Quick Fire
const QF_TRIGGERS = [3, 6, 10];   // fire after apple N is correctly answered
let qfRoundsCompleted = 0;         // 0–3
let qfWordPool = [];               // shuffled pool for this game session
let qfActive = false;

// Answer counting
let correctAnswerCount = 0;
let wrongAnswerCount = 0;          // for green tint intensity

// Guard: prevents the answer observer firing more than once per question
let questionHandled = false;

// Disturbance timer
let disturbanceTimer = null;

/* ─── Fisher-Yates shuffle (unbiased) ──────────────────────────────────── */
// Array.sort(() => Math.random() - 0.5) is biased — V8's sort calls the
// comparator fewer times than needed for a uniform permutation.
// Fisher-Yates guarantees every permutation is equally likely.
function fisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ─── Normalise a guess for comparison ─────────────────────────────────── */
function normalise(s) {
  return s.trim().toUpperCase().replace(/[\s_-]+/g, '_');
}

/* ─── Scramble a word, preserving word-boundary structure ───────────────── */
// For multi-word entries (e.g. TAPE_LIBRARY → two segments), each segment is
// scrambled independently so the player can see how many words there are and
// how long each word is (shown as letter-count hint below the scrambled word).
function scramble(word) {
  const segments = word.split('_');
  const scrambledSegments = segments.map(seg => {
    const letters = seg.split('');
    let result;
    let tries = 0;
    do {
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      result = letters.join('');
      tries++;
    } while (result === seg && tries < 30);
    return result;
  });
  return scrambledSegments.join(' ');
}

/* ─── Build a letter-count hint for multi-word entries ──────────────────── */
// e.g. STORAGE_VIRTUALIZE → "7 + 10 letters"
function buildHint(word) {
  const segments = word.split('_');
  if (segments.length === 1) return '';
  return segments.map(s => s.length).join(' + ') + ' letters';
}

/* ─── Reset all session state (called on new game) ──────────────────────── */
export function resetSession() {
  qfRoundsCompleted = 0;
  correctAnswerCount = 0;
  wrongAnswerCount = 0;
  qfActive = false;
  questionHandled = false;
  window.__qfBonus = 0;
  // Shuffle a fresh word pool (Fisher-Yates — uniform distribution)
  qfWordPool = fisherYates(WORD_BANK);
  // Reset green tint
  const tint = document.getElementById('green-tint');
  if (tint) tint.style.opacity = '0';
  // Clear any stale QF overlay
  document.getElementById('qf-overlay')?.remove();
  // Restart disturbance loop
  startDisturbance();
}

/* ─── Add Quick Fire bonus to live #score display ───────────────────────── */
function addBonusToDisplay(points) {
  const el = document.getElementById('score');
  if (!el) return;
  el.textContent = String((parseInt(el.textContent, 10) || 0) + points);
  window.__qfBonus = (window.__qfBonus ?? 0) + points;
}

/* ─── Show the Quick Fire overlay ───────────────────────────────────────── */
function showQuickFire() {
  if (qfActive || qfRoundsCompleted >= 3) return;
  if (qfWordPool.length === 0) return; // all words used

  qfActive = true;
  qfRoundsCompleted++;

  initAudio();
  playQuickFireAlert();

  const entry = qfWordPool.pop();
  const { word, display } = entry;
  const scrambled = scramble(word);

  // Time-based scoring: base 10 pts, ×3 if solved in ≤10 s, ×2 if ≤20 s, ×1 otherwise
  const BASE_PTS = 10;
  const MAX_ATTEMPTS = 3;
  let attempt = 0;
  let timeLeft = 60;
  let intervalId = null;
  let submitted = false;  // debounce: prevents repeat taps scoring twice

  // ── Freeze the quiz card timer and block ALL background interaction ───────
  // The bundle's quiz timer runs as a CSS animation on #quiz-bar. Pausing it
  // stops the visible countdown. We also block pointer events on every element
  // the bundle listens to so no accidental taps reach the game underneath.
  const quizBar     = document.getElementById('quiz-bar');
  const quizCard    = document.getElementById('quiz-card');
  const appEl       = document.getElementById('app');
  const backdropEl  = document.getElementById('backdrop');
  const canvas      = document.querySelector('#app canvas');

  if (quizBar)    quizBar.style.animationPlayState    = 'paused';
  if (quizCard)   quizCard.style.pointerEvents        = 'none';
  if (appEl)      appEl.style.pointerEvents           = 'none';
  if (canvas)     canvas.style.pointerEvents          = 'none';
  if (backdropEl) backdropEl.style.pointerEvents      = 'none';

  // Build overlay
  const overlay = document.createElement('div');
  overlay.id = 'qf-overlay';
  overlay.innerHTML = `
    <div id="qf-card">
      <div id="qf-badge">⚡ QUICK FIRE — Round ${qfRoundsCompleted} of 3</div>
      <div id="qf-timer-bar"><div id="qf-timer-fill"></div></div>
      <div id="qf-seconds">60</div>
      <p id="qf-instruction">Unscramble this IBM Storage product or concept:</p>
      <div id="qf-scrambled">${scrambled}</div>
      ${buildHint(word) ? `<p id="qf-hint">💡 ${buildHint(word)}</p>` : ''}
      <div id="qf-bonus-row">
        <span class="qf-bonus-zone qf-zone-triple">⚡ ×3 under 10 s</span>
        <span class="qf-bonus-zone qf-zone-double">×2 under 20 s</span>
        <span class="qf-bonus-zone qf-zone-normal">×1 otherwise</span>
      </div>
      <div id="qf-input-row">
        <input
          id="qf-input"
          type="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="Type your answer…"
          maxlength="${word.length + 6}"
        />
        <button id="qf-submit" type="button">Submit</button>
      </div>
      <p id="qf-attempts-left">${MAX_ATTEMPTS} attempt${MAX_ATTEMPTS !== 1 ? 's' : ''} remaining</p>
      <div id="qf-feedback"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => document.getElementById('qf-input')?.focus());

  function updateBonusZones() {
    const elapsed = 60 - timeLeft;
    document.querySelector('.qf-zone-triple')?.classList.toggle('qf-zone-active', elapsed <= 10);
    document.querySelector('.qf-zone-double')?.classList.toggle('qf-zone-active', elapsed > 10 && elapsed <= 20);
    document.querySelector('.qf-zone-normal')?.classList.toggle('qf-zone-active', elapsed > 20);
  }
  updateBonusZones();

  // Timer
  function tick() {
    timeLeft--;
    const secEl = document.getElementById('qf-seconds');
    const fill = document.getElementById('qf-timer-fill');
    if (secEl) secEl.textContent = String(timeLeft);
    if (fill) {
      fill.style.width = `${(timeLeft / 60) * 100}%`;
      fill.classList.toggle('qf-urgent', timeLeft <= 10);
    }
    updateBonusZones();
    if (timeLeft <= 0) endRound(false, `Time's up! The answer was: ${display}.`);
  }
  intervalId = setInterval(tick, 1000);

  function calcPoints() {
    const elapsed = 60 - timeLeft;
    if (elapsed <= 10) return BASE_PTS * 3;   // triple
    if (elapsed <= 20) return BASE_PTS * 2;   // double
    return BASE_PTS;                           // normal
  }

  function updateAttemptsLeft() {
    const el = document.getElementById('qf-attempts-left');
    const left = MAX_ATTEMPTS - attempt;
    if (el) el.textContent = `${left} attempt${left !== 1 ? 's' : ''} remaining`;
  }

  function handleSubmit() {
    if (!qfActive) return;
    if (submitted) return;
    const input = document.getElementById('qf-input');
    const feedback = document.getElementById('qf-feedback');
    const guess = normalise(input?.value ?? '');
    if (!guess) return;

    playClick();

    const isCorrect =
      guess === normalise(word) ||
      guess === word.replace(/_/g, '').toUpperCase();

    if (isCorrect) {
      submitted = true;
      clearInterval(intervalId);
      const pts = calcPoints();
      const multiplier = pts / BASE_PTS;
      const multiplierLabel = multiplier === 3 ? ' (×3 — Triple speed bonus!)' :
                              multiplier === 2 ? ' (×2 — Double speed bonus!)' : '';
      playCorrect();
      addBonusToDisplay(pts);
      if (feedback) {
        feedback.textContent = `✓ Correct! ${display}. +${pts} pts${multiplierLabel}`;
        feedback.className = 'qf-feedback-correct';
      }
      setTimeout(() => endRound(true), 2000);
    } else {
      playWrong();
      attempt++;
      updateAttemptsLeft();
      if (attempt >= MAX_ATTEMPTS) {
        submitted = true;
        if (feedback) {
          feedback.textContent = `No more attempts. The answer was: ${display}.`;
          feedback.className = 'qf-feedback-wrong';
        }
        setTimeout(() => endRound(false, ''), 2000);
      } else {
        if (feedback) {
          const left = MAX_ATTEMPTS - attempt;
          feedback.textContent = `Not quite — ${left} attempt${left !== 1 ? 's' : ''} remaining.`;
          feedback.className = 'qf-feedback-wrong';
        }
        if (input) { input.value = ''; input.focus(); }
      }
    }
  }

  function endRound(success, message) {
    qfActive = false;
    clearInterval(intervalId);
    // Restore all blocked elements
    if (quizBar)    quizBar.style.animationPlayState = '';
    if (quizCard)   quizCard.style.pointerEvents     = '';
    if (appEl)      appEl.style.pointerEvents        = '';
    if (canvas)     canvas.style.pointerEvents       = '';
    if (backdropEl) backdropEl.style.pointerEvents   = '';

    // If there's a non-empty message (timeout/no-attempts with answer reveal), show briefly
    const feedback = document.getElementById('qf-feedback');
    if (!success && message && feedback) {
      feedback.textContent = message;
      feedback.className = 'qf-feedback-wrong';
    }

    const ovEl = document.getElementById('qf-overlay');
    if (ovEl) {
      ovEl.classList.add('qf-fade-out');
      setTimeout(() => ovEl.remove(), 700);
    }
  }

  document.getElementById('qf-submit')?.addEventListener('click', handleSubmit);
  document.getElementById('qf-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
  });
}

/* ─── Green bubble effect on wrong answer ───────────────────────────────── */
function spawnBubbles() {
  wrongAnswerCount = Math.min(wrongAnswerCount + 1, 10);

  // Update green tint intensity
  const tint = document.getElementById('green-tint');
  if (tint) tint.style.opacity = String(wrongAnswerCount * 0.04); // max ~40%

  // Spawn 4–6 bubbles
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'green-bubble';
    const size = 10 + Math.floor(Math.random() * 20);
    const left = 5 + Math.random() * 90; // % across viewport
    const dur = 1.2 + Math.random() * 0.8;
    const delay = Math.random() * 0.4;
    b.style.cssText = `
      width:${size}px;height:${size}px;
      left:${left}%;
      bottom: 0;
      animation-duration:${dur}s;
      animation-delay:${delay}s;
    `;
    document.getElementById('bubble-container')?.appendChild(b);
    setTimeout(() => b.remove(), (dur + delay + 0.2) * 1000);
  }
}

/* ─── Periodic water disturbance (makes apples bob more actively) ────────── */
function startDisturbance() {
  if (disturbanceTimer) clearTimeout(disturbanceTimer);

  function disturb() {
    const canvas = document.querySelector('#app canvas');
    if (!canvas) { scheduleNext(); return; }

    // Fire a synthetic pointermove (not pointerdown — avoids triggering apple tap)
    // The bundle's drag handler calls addDrop on pointermove, causing ripples
    const rect = canvas.getBoundingClientRect();
    // Target a random point away from edges (water surface area)
    const x = rect.left + rect.width * (0.2 + Math.random() * 0.6);
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

    // Use a move event — this triggers the water ripple without starting an apple grab
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: x, clientY: y,
      bubbles: true, cancelable: true,
      pointerId: 99, pointerType: 'touch',
      isPrimary: true
    }));

    scheduleNext();
  }

  function scheduleNext() {
    const interval = 1800 + Math.random() * 2200; // every 1.8–4 s
    disturbanceTimer = setTimeout(disturb, interval);
  }

  scheduleNext();
}

function stopDisturbance() {
  if (disturbanceTimer) { clearTimeout(disturbanceTimer); disturbanceTimer = null; }
}

/* ─── Watch quiz answers: sounds + QF counting ──────────────────────────── */
function watchAnswers() {
  const answersContainer = document.getElementById('quiz-answers');
  const quizCard = document.getElementById('quiz-card');
  if (!answersContainer || !quizCard) return;

  // Reset the per-question guard whenever the quiz card visibility changes.
  // We reset on BOTH transitions so we never get stuck with a stale true:
  //  • hidden → visible : a fresh question just appeared
  //  • visible → hidden : question dismissed (answer given / timed out)
  let quizWasHidden = quizCard.classList.contains('hidden');
  new MutationObserver(() => {
    const quizIsHidden = quizCard.classList.contains('hidden');
    if (quizWasHidden !== quizIsHidden) {
      questionHandled = false;
    }
    quizWasHidden = quizIsHidden;
  }).observe(quizCard, { attributes: true, attributeFilter: ['class'] });

  new MutationObserver(() => {
    // Only ever handle one answer event per question
    if (questionHandled) return;

    const rightBtn = answersContainer.querySelector('.answer.right');
    if (rightBtn) {
      questionHandled = true;
      initAudio();
      playCorrect();
      // Count for QF trigger
      correctAnswerCount++;
      const roundIdx = qfRoundsCompleted;
      if (roundIdx < 3 && correctAnswerCount === QF_TRIGGERS[roundIdx] && !qfActive) {
        setTimeout(showQuickFire, 900);
      }
      return;
    }

    const wrongBtn = answersContainer.querySelector('.answer.wrong');
    if (wrongBtn) {
      questionHandled = true;
      initAudio();
      playWrong();
      spawnBubbles();
    }
  }).observe(answersContainer, { attributes: true, subtree: true, attributeFilter: ['class'] });
}

/* ─── Click sounds on all buttons ───────────────────────────────────────── */
function watchClicks() {
  document.body.addEventListener('pointerdown', e => {
    const target = e.target;
    if (
      target.tagName === 'BUTTON' ||
      target.classList.contains('answer') ||
      target.closest('button')
    ) {
      initAudio();
      playClick();
    }
  }, { capture: true });
}

/* ─── Music: watch attract screen + first tap for start/stop ────────────── */
function watchMusic() {
  const attract = document.getElementById('attract');
  if (!attract) return;
  let wasHidden = attract.classList.contains('hidden');

  new MutationObserver(() => {
    const isHidden = attract.classList.contains('hidden');
    if (!wasHidden && isHidden) {
      // Attract hid → game started — music triggered by first tap (see below)
      startDisturbance();
    } else if (wasHidden && !isHidden) {
      // Attract shown → game over / reset
      stopMusic();
      stopDisturbance();
      resetSession();
    }
    wasHidden = isHidden;
  }).observe(attract, { attributes: true, attributeFilter: ['class'] });

  // Start music on the very first user tap — this is inside a gesture so
  // AudioContext.resume() is guaranteed to succeed on all browsers
  document.addEventListener('pointerdown', () => {
    initAudio();
    startMusic();
  }, { once: true });
}

/* ─── Mute button ────────────────────────────────────────────────────────── */
function watchMuteButton() {
  const btn = document.getElementById('mute-btn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    initAudio();
    const nowMuted = toggleMute();
    btn.textContent = nowMuted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', nowMuted ? 'Unmute sound' : 'Mute sound');
    localStorage.setItem('apple-bobbing:muted', nowMuted ? '1' : '0');
  });

  // Restore muted state from previous session
  if (localStorage.getItem('apple-bobbing:muted') === '1') {
    document.addEventListener('pointerdown', () => {
      initAudio();
      if (!isMuted()) {
        toggleMute();
        btn.textContent = '🔇';
      }
    }, { once: true });
  }
}

/* ─── Inject persistent DOM helpers (green tint layer, bubble container) ── */
function injectVisualHelpers() {
  if (!document.getElementById('green-tint')) {
    const tint = document.createElement('div');
    tint.id = 'green-tint';
    document.body.appendChild(tint);
  }
  if (!document.getElementById('bubble-container')) {
    const bc = document.createElement('div');
    bc.id = 'bubble-container';
    document.body.appendChild(bc);
  }
}

/* ─── Strip "PLACEHOLDER: " prefix from in-game fact card and quiz prompt ── */
// The bundle prepends "PLACEHOLDER: " to every fact body and every quiz
// question string. Since the bundle is read-only we intercept both DOM writes
// with MutationObservers and strip the prefix as soon as it appears.
function watchPlaceholderText() {
  const PREFIX_RE = /^PLACEHOLDER:\s*/i;

  function stripPrefix(el) {
    if (!el) return;
    const raw = el.textContent;
    if (PREFIX_RE.test(raw)) {
      el.textContent = raw.replace(PREFIX_RE, '');
    }
  }

  function observeElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    // Strip once immediately in case the bundle has already written to it
    stripPrefix(el);
    // Watch for future writes
    let observing = true;
    const obs = new MutationObserver(() => {
      if (!observing) return;
      observing = false;      // prevent the observer re-firing on our own write
      stripPrefix(el);
      observing = true;
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  observeElement('fact-body');
  observeElement('quiz-prompt');
}

/* ─── Update HUD when all initial facts have been shown ─────────────────── */
// The bundle counts down #facts-left to 0. When it hits zero the game still
// continues (FactDeck recycles), but the "0 facts still lurking" text makes
// it feel finished. We replace it with "Keep bobbing!".
function watchFactsLeft() {
  const el = document.getElementById('facts-left');
  const sub = document.getElementById('counter-sub');
  if (!el || !sub) return;

  new MutationObserver(() => {
    if (el.textContent.trim() === '0') {
      sub.textContent = 'Keep bobbing!';
    }
  }).observe(el, { childList: true, characterData: true, subtree: true });
}

/* ─── New-question injection via quiz-card visibility change ─────────────── */
//
// HOW IT WORKS
// ────────────
// The bundle's I.show() writes prompt, answers, and category to the DOM, then
// removes 'hidden' from #quiz-card as its very last action. Observing that class
// change fires exactly ONCE per question, AFTER every bundle DOM write is done.
// We then optionally replace the visible text with one of our 12 new questions.
//
// HOW CORRECT-ANSWER TRACKING IS PRESERVED
// ─────────────────────────────────────────
// The bundle scores by button INDEX: ue(e) checks e === oe.correct.
// We identify the correct button slot by searching the 4 rendered buttons for
// the known correct-answer TEXT for the current bundle question (derived from
// the sh[] data we read from the bundle source).
// We place OUR correct answer at that same slot → bundle's index check still fires.
//
// INJECTION RATE
// ──────────────
// Each question is randomly either a bundle question or a new question (50/50).
// The 12 new questions are Fisher-Yates shuffled into a pool; the pool is consumed
// one at a time and refilled with a fresh shuffle when empty. This guarantees that
// every new question is seen before any repeats, across many plays.

// Known correct-answer text for each of the 12 bundle questions (unshuffled).
// We match the stripped prompt to identify the question, then find which of the
// 4 rendered buttons holds this text — that is the correct button slot.
const BUNDLE_CORRECT = {
  'Which software runs on every IBM FlashSystem model?':               'Storage Virtualize',
  'Where do FlashCore Modules compress and encrypt data?':             'In hardware on the module',
  'Roughly how fast can FlashSystem flag ransomware-style write patterns?': 'Under a minute',
  'IBM Storage Scale presents the same data through which access methods?': 'File, object and HDFS',
  'What is Storage Scale System 6000 designed to keep fed?':           'GPUs',
  'What does IBM Storage Defender check about your backup copies?':    'That they are clean and trustworthy',
  'What can an admin NOT do to a Safeguarded Copy before it expires?': 'Delete it',
  'IBM Storage Ceph runs on what kind of hardware?':                   'Commodity servers',
  'How do you grow capacity and performance in a Ceph cluster?':       'Add nodes',
  'What archival life is quoted for LTO tape?':                        '30 years',
  "Why can't a network attacker reach a tape cartridge on a shelf?":   'It is physically air-gapped',
  'What happens when you tap the open water?':                         'You make a splash',
};

// The 12 new questions to inject (50% of the time, in random order).
const NEW_QUESTIONS = [
  { category: 'FlashSystem',
    question: 'What do IBM Storage Partitions let you do during a hardware refresh?',
    answers:  ['Only migrate overnight with downtime', "Move a host's whole storage non disruptively", 'Export it to tape first', 'Nothing, the host must be rebuilt'],
    correct:  1 },
  { category: 'Storage Scale',
    question: 'Which set of protocols can Storage Scale serve concurrently from one filesystem?',
    answers:  ['NFS, SMB and iSCSI', 'POSIX, NFS, SMB and S3', 'NFS, SMB, S3 and FTP', 'POSIX, SMB, S3 and NVMe-oF'],
    correct:  1 },
  { category: 'Storage Defender',
    question: "How long is the free trial of Storage Defender's Data Resiliency Service?",
    answers:  ['7 days', '14 days', '60 days', 'There is no trial'],
    correct:  2 },
  { category: 'Ceph',
    question: 'Which IBM platform does Storage Ceph underpin as the object storage layer in a data lakehouse?',
    answers:  ['IBM Cloud Pak for Data (Db2 Warehouse)', 'watsonx.data', 'IBM Storage Fusion', 'IBM Cognos Analytics'],
    correct:  1 },
  { category: 'Ceph',
    question: 'Which access methods does IBM Storage Ceph support alongside S3 object?',
    answers:  ['Block (RBD), file and FICON', 'Block (RBD), file, NFS and NVMe-oF', 'File, NFS and LTFS tape', 'Block (RBD) and SMB only'],
    correct:  1 },
  { category: 'Fusion',
    question: 'The HCI form of Fusion runs on IBM Storage Scale ECE. What backs the software-defined form?',
    answers:  ['IBM Storage Scale ECE (the same engine)', 'Red Hat OpenShift Data Foundation (ODF)', 'IBM Storage Ceph', 'Red Hat OpenShift Container Storage Classic (OCS)'],
    correct:  1 },
  { category: 'Tape',
    question: 'IBM enterprise tape is quoted at a bit error rate of about which figure?',
    answers:  ['1 error in 10¹⁵ bits (same as enterprise HDD)', '1 error in 10¹⁸ bits', '1 error in 10²¹ bits (~1 per exabyte)', '1 error in 10²⁴ bits'],
    correct:  2 },
  { category: 'Tape',
    question: 'What does LTFS let you do with a tape cartridge?',
    answers:  ['Only stream it sequentially', 'Access it like an open-format file system', 'Encrypt it twice', 'Run applications directly on it'],
    correct:  1 },
  { category: 'VTS',
    question: 'What is the main benefit of TS7700 Transparent Cloud Tiering for an IBM Z shop?',
    answers:  ['It eliminates the need for any physical tape', 'It offloads data movement, cutting Z CPU and I/O cost', 'It compresses data more than FICON tape can', 'It replaces Copy Services replication'],
    correct:  1 },
  { category: 'VTS',
    question: 'Which TS7700 control prevents a single administrator from weakening data protection?',
    answers:  ['rsyslog tamperproof logging', 'Dual control on sensitive settings', 'AES-256 disk encryption', 'Granular roles and permissions'],
    correct:  1 },
  { category: 'DS8K',
    question: "At 1,000+ miles, DS8900F's quoted disaster recovery objectives are approximately:",
    answers:  ['RPO ~2 min, RTO ~5 min', 'RPO ~2 sec, RTO under ~60 sec', 'RPO zero, RTO ~2 sec', 'RPO ~2 sec, RTO ~15 min'],
    correct:  1 },
  { category: 'DS8K',
    question: 'DS8900F synergy features reach IBM Z customers ahead of competitors chiefly because:',
    answers:  ['IBM restricts them to its largest banking clients first', 'They are co-designed, developed and tested with the IBM Z team', 'They are standardised through an open industry consortium', 'They reuse mature features already shipped by rivals'],
    correct:  1 },
];

// Pool state: shuffled indices into NEW_QUESTIONS, drained one per injection.
let _nqPool = [];

function _refillPool() {
  _nqPool = fisherYates(NEW_QUESTIONS.map((_, i) => i));
}
_refillPool(); // initial fill at module load

function watchQuizCard() {
  const quizCard    = document.getElementById('quiz-card');
  const promptEl    = document.getElementById('quiz-prompt');
  const categoryEl  = document.getElementById('quiz-category');
  const answersEl   = document.getElementById('quiz-answers');
  if (!quizCard || !promptEl || !answersEl) return;

  // Track whether the card was hidden last time we saw it.
  let wasHidden = quizCard.classList.contains('hidden');

  // Also watch #caught-count to detect game restart (resets to "0").
  const caughtEl = document.getElementById('caught-count');
  if (caughtEl) {
    new MutationObserver(() => {
      if (caughtEl.textContent.trim() === '0') _refillPool();
    }).observe(caughtEl, { childList: true, characterData: true, subtree: true });
  }

  new MutationObserver(() => {
    const isHidden = quizCard.classList.contains('hidden');

    // Only act on hidden→visible transition (new question just fully rendered).
    if (!wasHidden || isHidden) {
      wasHidden = isHidden;
      return;
    }
    wasHidden = false;

    // ── 50/50 decision: inject a new question or leave the bundle question. ──
    // Always try injection if there are questions left in the pool; the coin
    // flip ensures roughly half the apples show bundle questions.
    if (_nqPool.length === 0 || Math.random() >= 0.5) return;

    // Read current prompt (already PLACEHOLDER-stripped by watchPlaceholderText).
    const currentPrompt = promptEl.textContent.trim();

    // Find the correct-answer text for this bundle question.
    const correctText = BUNDLE_CORRECT[currentPrompt];
    if (!correctText) return; // unknown question — skip safely

    // Identify which button the bundle put its correct answer in.
    const buttons = Array.from(answersEl.querySelectorAll('button.answer'));
    if (buttons.length !== 4) return;

    const correctSlot = buttons.findIndex(
      b => b.textContent.trim() === correctText
    );
    if (correctSlot < 0) return; // couldn't find it — skip safely

    // Pick and consume the next new question from the pool.
    const newQ = NEW_QUESTIONS[_nqPool.pop()];
    if (_nqPool.length === 0) _refillPool(); // pre-refill for next cycle

    // Shuffle the 3 wrong answers for this new question.
    const wrongs = fisherYates(
      newQ.answers.filter((_, i) => i !== newQ.correct)
    );

    // Write new answers: correct at correctSlot, wrongs at the other 3 slots.
    let wi = 0;
    buttons.forEach((btn, i) => {
      btn.textContent = (i === correctSlot)
        ? newQ.answers[newQ.correct]
        : wrongs[wi++];
    });

    // Swap prompt text and category pill.
    promptEl.textContent   = newQ.question;
    if (categoryEl) categoryEl.textContent = newQ.category;

  }).observe(quizCard, { attributes: true, attributeFilter: ['class'] });
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
window.__qfBonus = 0;

document.addEventListener('DOMContentLoaded', () => {
  injectVisualHelpers();
  resetSession();        // initialise word pool and state
  watchAnswers();
  watchClicks();
  watchMusic();
  watchMuteButton();
  watchPlaceholderText();
  watchFactsLeft();
  watchQuizCard();       // 50/50 new-question injection after bundle renders
});
