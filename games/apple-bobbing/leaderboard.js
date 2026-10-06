/**
 * leaderboard.js — Apple Bobbing shared leaderboard v3
 *
 * Game-over screen layout:
 *  1. Score + reason (from bundle)
 *  2. Leaderboard shown IMMEDIATELY (top-10 from Firestore)
 *  3. Name input inline — typing does NOT hide the board
 *  4. "Save Score" button → updates board with player's entry highlighted
 *  5. "Play Again" button (replaces bundle's "Tap anywhere" behaviour)
 *  6. "View All Facts & Answers" button → opens a modal with all Q&A
 */

import { initAudio, playFanfare } from './audio.js';
import { resetSession } from './quickfire.js';

/* ─── Shuffle helper — randomises answer order at page-load time ─────────── */
// Accepts an ALL_QA entry object, shuffles its answers array in-place using
// Fisher-Yates, and updates the `correct` index to track the right answer.
function shuffleAnswers(entry) {
  const answers = entry.answers.slice();
  const correctText = answers[entry.correct];
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  entry.answers = answers;
  entry.correct = answers.indexOf(correctText);
  return entry;
}

/* ─── All facts + correct answers ───────────────────────────────────────── */
// Answers are shuffled at page-load time by shuffleAnswers().
const ALL_QA = [
  // ── Original 12 entries ──────────────────────────────────────────────────
  shuffleAnswers({
    category: 'FlashSystem',
    title: 'One family, one software stack',
    fact: 'Every IBM FlashSystem model runs the same Storage Virtualize software, so skills and automation carry across the whole range.',
    question: 'Which software runs on every IBM FlashSystem model?',
    answers: ['Storage Virtualize', 'Storage Scale', 'Storage Defender', 'Storage Ceph'],
    correct: 0,
  }),
  shuffleAnswers({
    category: 'FlashSystem',
    title: 'FlashCore Modules compress inline',
    fact: 'FlashCore Modules compress and encrypt data in hardware, so capacity savings don\'t cost host performance.',
    question: 'Where do FlashCore Modules compress and encrypt data?',
    answers: ['In the host operating system', 'In hardware on the module', 'In a backup appliance', 'In the cloud'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'FlashSystem',
    title: 'Ransomware detection on the array',
    fact: 'IBM has demonstrated detection of ransomware-style write patterns in under a minute using inline data statistics.',
    question: 'Roughly how fast can FlashSystem flag ransomware-style write patterns?',
    answers: ['Within a day', 'Within an hour', 'Under a minute', 'Only after a restore'],
    correct: 2,
  }),
  shuffleAnswers({
    category: 'Storage Scale',
    title: 'Global data platform',
    fact: 'IBM Storage Scale presents file, object and HDFS access to the same data, on premises or in the cloud.',
    question: 'IBM Storage Scale presents the same data through which access methods?',
    answers: ['File only', 'Block and tape', 'File, object and HDFS', 'Email and FTP'],
    correct: 2,
  }),
  shuffleAnswers({
    category: 'Storage Scale',
    title: 'Built for AI pipelines',
    fact: 'Storage Scale System 6000 is designed to feed GPUs with hundreds of gigabytes per second per node.',
    question: 'What is Storage Scale System 6000 designed to keep fed?',
    answers: ['GPUs', 'Printers', 'Mainframe tape drives', 'Web caches'],
    correct: 0,
  }),
  shuffleAnswers({
    category: 'Storage Defender',
    title: 'Copies you can trust',
    fact: 'IBM Storage Defender validates backup copies and safeguarded snapshots so you know which point in time is clean.',
    question: 'What does IBM Storage Defender check about your backup copies?',
    answers: ['That they are the largest', 'That they are the oldest', 'That they are clean and trustworthy', 'That they are stored on tape'],
    correct: 2,
  }),
  shuffleAnswers({
    category: 'Storage Defender',
    title: 'Safeguarded Copy',
    fact: 'Safeguarded Copy takes immutable, logically air-gapped snapshots that admins cannot delete before their expiry.',
    question: 'What can an admin NOT do to a Safeguarded Copy before it expires?',
    answers: ['Read it', 'Delete it', 'Restore from it', 'Report on it'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Ceph',
    title: 'Software-defined and open',
    fact: 'IBM Storage Ceph provides block, file and S3 object storage on commodity servers with an open-source core.',
    question: 'IBM Storage Ceph runs on what kind of hardware?',
    answers: ['Proprietary appliances only', 'Commodity servers', 'Mainframes only', 'Tape libraries'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Ceph',
    title: 'Scale out, not up',
    fact: 'Add nodes to grow Ceph capacity and performance together, with data rebalanced automatically.',
    question: 'How do you grow capacity and performance in a Ceph cluster?',
    answers: ['Buy a bigger controller', 'Add nodes', 'Add more tape', 'Reformat the volumes'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Tape',
    title: 'Tape is still the cheapest bit',
    fact: 'LTO tape stores cold data at a fraction of the cost per terabyte of disk, with a 30-year archival life.',
    question: 'What archival life is quoted for LTO tape?',
    answers: ['3 years', '10 years', '30 years', '100 years'],
    correct: 2,
  }),
  shuffleAnswers({
    category: 'Tape',
    title: 'Physical air gap',
    fact: 'A tape cartridge on a shelf cannot be reached by an attacker on the network. That\'s the original air gap.',
    question: 'Why can\'t a network attacker reach a tape cartridge on a shelf?',
    answers: ['It is encrypted', 'It is physically air-gapped', 'It is compressed', 'It is read-only'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Tip',
    title: 'Try tapping the water',
    fact: 'Tap the open water to make a splash and watch the apples bob.',
    question: 'What happens when you tap the open water?',
    answers: ['An apple sinks', 'The lights go out', 'You make a splash', 'The cauldron empties'],
    correct: 2,
  }),

  // ── 12 new entries ───────────────────────────────────────────────────────
  shuffleAnswers({
    category: 'FlashSystem',
    title: 'Swap sides without an outage',
    fact: 'Storage Partitions package everything a host needs (front end config and back end data) into a logical group that can be migrated non-disruptively for a hardware refresh or workload rebalance.',
    question: 'What do IBM Storage Partitions let you do during a hardware refresh?',
    answers: ['Only migrate overnight with downtime', "Move a host's whole storage non disruptively", 'Export it to tape first', 'Nothing, the host must be rebuilt'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Storage Scale',
    title: 'One copy, every protocol',
    fact: 'Storage Scale offers concurrent multi-protocol access (POSIX, NFS, SMB and S3) to the same data, not a separate copy per protocol. FTP, iSCSI and NVMe-oF aren\'t part of that gateway set.',
    question: 'Which set of protocols can Storage Scale serve concurrently from one filesystem with no separate copy per protocol?',
    answers: ['NFS, SMB and iSCSI', 'POSIX, NFS, SMB and S3', 'NFS, SMB, S3 and FTP', 'POSIX, SMB, S3 and NVMe-oF'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Storage Defender',
    title: 'Try before you commit',
    fact: 'IBM offers Storage Defender\'s Data Resiliency Service with a free 60-day trial for evaluation.',
    question: 'How long is the free trial of Storage Defender\'s Data Resiliency Service?',
    answers: ['7 days', '14 days', '60 days', 'There is no trial'],
    correct: 2,
  }),
  shuffleAnswers({
    category: 'Ceph',
    title: 'The lakehouse foundation',
    fact: 'IBM Storage Ceph provides the S3 object foundation under a data lakehouse built on watsonx.data, for hybrid multi-cloud analytics.',
    question: 'Which IBM platform does Storage Ceph provide the object storage foundation for in a lakehouse architecture?',
    answers: ['IBM Cloud Pak for Data (Db2 Warehouse)', 'watsonx.data', 'IBM Storage Fusion', 'IBM Cognos Analytics'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Ceph',
    title: 'Beyond S3: unified Ceph',
    fact: 'Beyond S3, Ceph is unified storage exposing block (RBD), file, NFS and NVMe-oF. FICON and LTFS belong to mainframe and tape worlds, not Ceph.',
    question: 'Which combination of access methods does IBM Storage Ceph support alongside S3 object?',
    answers: ['Block (RBD), file and FICON', 'Block (RBD), file, NFS and NVMe-oF', 'File, NFS and LTFS tape', 'Block (RBD) and SMB only'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Fusion',
    title: 'HCI vs software-defined',
    fact: 'The HCI System uses IBM Storage Scale Erasure Coding Edition, whilst the software-defined version uses Red Hat OpenShift Data Foundation (ODF) — ODF being the current name for what was once OCS.',
    question: 'The HCI form of Fusion runs on IBM Storage Scale ECE. What backs the software-defined form?',
    answers: ['IBM Storage Scale ECE (the same engine)', 'Red Hat OpenShift Data Foundation (ODF)', 'IBM Storage Ceph', 'Red Hat OpenShift Container Storage Classic (OCS)'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'Tape',
    title: 'Near-perfect bit error rate',
    fact: 'IBM tape runs at roughly 1 error in 10²¹ bits — about one error per exabyte, far better than enterprise HDD at around 10¹⁵.',
    question: 'IBM enterprise tape is quoted at a bit error rate of about which figure?',
    answers: ['1 error in 10¹⁵ bits (same as enterprise HDD)', '1 error in 10¹⁸ bits', '1 error in 10²¹ bits (~1 per exabyte)', '1 error in 10²⁴ bits'],
    correct: 2,
  }),
  shuffleAnswers({
    category: 'Tape',
    title: 'Tape as a file system',
    fact: 'IBM tape supports LTFS (the Linear Tape File System), an open data format that lets tape be read like a file system.',
    question: 'What does LTFS let you do with a tape cartridge?',
    answers: ['Only stream it sequentially', 'Access it like an open-format file system', 'Encrypt it twice', 'Run applications directly on it'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'VTS',
    title: 'TS7700 Transparent Cloud Tiering',
    fact: 'Transparent Cloud Tiering offloads data movement from IBM Z, reducing Z CPU and I/O load while sending compressed, encrypted data to tape or cloud.',
    question: 'What is the main benefit of TS7700 Transparent Cloud Tiering for an IBM Z shop?',
    answers: ['It eliminates the need for any physical tape', 'It offloads data movement, cutting Z CPU and I/O cost', 'It compresses data more than FICON tape can', 'It replaces Copy Services replication'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'VTS',
    title: 'Dual control cyber resilience',
    fact: 'TS7700 cyber resilience bundles several controls, but dual control on sensitive settings stops any single admin acting alone.',
    question: 'Which TS7700 control specifically prevents a single administrator from unilaterally weakening data protection?',
    answers: ['rsyslog tamperproof logging', 'Dual control on sensitive settings', 'AES-256 disk encryption', 'Granular roles and permissions'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'DS8K',
    title: 'Disaster recovery at 1,000 miles',
    fact: 'DS8900F delivers roughly a 2-second RPO and under 60-second RTO at over 1,000 miles — cited as 15× faster than the industry.',
    question: 'At 1,000+ miles, DS8900F\'s quoted disaster recovery objectives are approximately:',
    answers: ['RPO ~2 min, RTO ~5 min', 'RPO ~2 sec, RTO under ~60 sec', 'RPO zero, RTO ~2 sec', 'RPO ~2 sec, RTO ~15 min'],
    correct: 1,
  }),
  shuffleAnswers({
    category: 'DS8K',
    title: 'Co-designed with IBM Z',
    fact: 'Every DS8900F synergy feature is designed, developed and tested jointly with the IBM Z team — which is why they arrive months to years ahead of the competition.',
    question: 'DS8900F synergy features reach IBM Z customers ahead of competitors chiefly because:',
    answers: ['IBM restricts them to its largest banking clients first', 'They are co-designed, developed and tested with the IBM Z team', 'They are standardised through an open industry consortium', 'They reuse mature features already shipped by rivals'],
    correct: 1,
  }),
];

/* ─── Category colours ───────────────────────────────────────────────────── */
const CATEGORY_COLOURS = {
  'FlashSystem':      '#ff8a2a',
  'Storage Scale':    '#42a5f5',
  'Storage Defender': '#ab47bc',
  'Ceph':             '#26a69a',
  'Tape':             '#8d6e63',
  'Tip':              '#78909c',
  'Fusion':           '#7c5cd8',
  'VTS':              '#00897b',
  'DS8K':             '#1565c0',
};

// Expose ALL_QA on window so quickfire.js can look up facts without a circular import
window.__allQA = ALL_QA;

/* ─── Firebase ───────────────────────────────────────────────────────────── */
let db = null;
const COLLECTION = 'apple-bobbing-scores';
const MAX_BOARD = 10;

async function initFirestore() {
  if (db) return db;
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || cfg.apiKey?.startsWith('REPLACE')) {
    console.warn('[Leaderboard] Firebase not configured — offline mode.');
    return null;
  }
  try {
    const { initializeApp, getApps } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
    );
    const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } =
      await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const app = getApps().length ? getApps()[0] : initializeApp(cfg);
    const firestore = getFirestore(app);
    db = {
      _fs:      firestore,
      _col:     (name) => collection(firestore, name),
      _addDoc:  addDoc,
      _getDocs: getDocs,
      _query:   query,
      _orderBy: orderBy,
      _limit:   limit,
    };
    return db;
  } catch (err) {
    console.error('[Leaderboard] Firebase init failed:', err);
    return null;
  }
}

async function fetchTopScores() {
  const store = await initFirestore();
  if (!store) return getLocalScores();
  try {
    const q = store._query(
      store._col(COLLECTION),
      store._orderBy('score', 'desc'),
      store._limit(MAX_BOARD)
    );
    const snap = await store._getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (err) {
    console.error('[Leaderboard] fetch failed:', err);
    return getLocalScores();
  }
}

async function saveScore(name, score) {
  const entry = { name: (name.trim().slice(0, 20)) || 'Anonymous', score, ts: Date.now() };
  saveLocalScore(entry);
  const store = await initFirestore();
  if (!store) return;
  try {
    await store._addDoc(store._col(COLLECTION), entry);
  } catch (err) {
    console.error('[Leaderboard] save failed:', err);
  }
}

/* ─── Local fallback ─────────────────────────────────────────────────────── */
const LOCAL_KEY = 'apple-bobbing:named-scores';

function getLocalScores() {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveLocalScore(entry) {
  try {
    const arr = getLocalScores();
    arr.push(entry);
    arr.sort((a, b) => b.score - a.score);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(0, 20)));
  } catch { /* storage full */ }
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5)     return 'just now';
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Render leaderboard rows into #lb-list ──────────────────────────────── */
async function renderBoard(highlightScore, highlightName) {
  const list = document.getElementById('lb-list');
  if (!list) return;

  list.innerHTML = '<li class="lb-loading"><span style="grid-column:1/-1">Loading…</span></li>';

  const scores = await fetchTopScores();
  list.innerHTML = '';

  if (scores.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="lb-empty" style="grid-column:1/-1">No scores yet — be the first!</span>';
    list.appendChild(li);
    return;
  }

  // Find rank of the just-saved player (match by both score AND name)
  let currentRank = -1;
  if (highlightName) {
    for (let i = scores.length - 1; i >= 0; i--) {
      if (scores[i].score === highlightScore && scores[i].name === highlightName) {
        currentRank = i; break;
      }
    }
  }

  scores.forEach((entry, idx) => {
    const li = document.createElement('li');
    if (idx === currentRank) li.classList.add('placed');

    const rank  = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = `${idx + 1}.`;

    const name  = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = entry.name || 'Anonymous';

    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = `${entry.score} pts`;

    const time  = document.createElement('span');
    time.className = 'lb-time';
    time.textContent = relativeTime(entry.ts);

    li.append(rank, name, score, time);
    list.appendChild(li);
  });
}

/* ─── Facts & Answers modal ──────────────────────────────────────────────── */
function showFactsModal() {
  if (document.getElementById('facts-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'facts-modal';

  const inner = document.createElement('div');
  inner.id = 'facts-modal-inner';

  const heading = document.createElement('h2');
  heading.id = 'facts-modal-title';
  heading.textContent = '📚 All Facts & Answers';
  inner.appendChild(heading);

  const closeBtn = document.createElement('button');
  closeBtn.id = 'facts-modal-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '✕ Close';
  closeBtn.addEventListener('click', () => modal.remove());
  inner.appendChild(closeBtn);

  ALL_QA.forEach((qa, i) => {
    const card = document.createElement('div');
    card.className = 'fact-qa-card';

    const colour = CATEGORY_COLOURS[qa.category] ?? '#ff8a2a';

    card.innerHTML = `
      <div class="fact-qa-header">
        <span class="fact-qa-pill" style="background:${colour}22;border-color:${colour}55;color:${colour}">${qa.category}</span>
        <span class="fact-qa-num">#${i + 1}</span>
      </div>
      <h3 class="fact-qa-title">${qa.title}</h3>
      <p class="fact-qa-body">${qa.fact}</p>
      <div class="fact-qa-q">❓ ${qa.question}</div>
      <ul class="fact-qa-answers">
        ${qa.answers.map((a, ai) => `
          <li class="${ai === qa.correct ? 'fact-qa-correct' : 'fact-qa-wrong'}">
            ${ai === qa.correct ? '✓' : '✗'} ${a}
          </li>`).join('')}
      </ul>
    `;
    inner.appendChild(card);
  });

  modal.appendChild(inner);
  document.body.appendChild(modal);

  // Stop all events inside the modal from reaching the game-over card
  inner.addEventListener('pointerdown', e => e.stopPropagation());
  inner.addEventListener('pointerup',   e => e.stopPropagation());
  inner.addEventListener('click',       e => e.stopPropagation());

  // Close on backdrop click (outside inner panel)
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/* ─── Helper: remove all card/backdrop capture-phase blockers ────────────── */
function _removeCardBlockers(card) {
  if (card._stopUnlessOurs) {
    const fn = card._stopUnlessOurs;
    card.removeEventListener('pointerdown', fn, { capture: true });
    card.removeEventListener('pointerup',   fn, { capture: true });
    card.removeEventListener('click',       fn, { capture: true });
    delete card._stopUnlessOurs;
  }
  if (card._stopAll) {
    const fn = card._stopAll;
    if (card._hasBackdrop) {
      const bd = document.getElementById('backdrop');
      bd?.removeEventListener('pointerdown', fn, { capture: true });
      bd?.removeEventListener('pointerup',   fn, { capture: true });
      bd?.removeEventListener('click',       fn, { capture: true });
    }
    delete card._stopAll;
    delete card._hasBackdrop;
  }
}

/* ─── Build the full game-over overlay ───────────────────────────────────── */
function buildGameOverOverlay(totalScore) {
  const card = document.getElementById('game-over-card');
  if (!card || document.getElementById('lb-overlay-built')) return;
  card.dataset.lbBuilt = '1';

  // Hide bundle's own bare list and "tap anywhere" prompt
  const bundleList   = document.getElementById('game-over-scores');
  const bundlePrompt = document.getElementById('game-over-prompt');
  if (bundleList)   bundleList.style.display   = 'none';
  if (bundlePrompt) bundlePrompt.style.display = 'none';

  // ── Block pointer events on the bare card / backdrop so the bundle's restart
  //    listener cannot fire — but let events targeting our own #lb-wrap content
  //    through so buttons, inputs and links still work.
  const stopUnlessOurs = e => {
    const wrap = document.getElementById('lb-wrap');
    if (wrap && wrap.contains(e.target)) return; // our UI — let it through
    e.stopImmediatePropagation();
  };

  card.addEventListener('pointerdown', stopUnlessOurs, { capture: true });
  card.addEventListener('pointerup',   stopUnlessOurs, { capture: true });
  card.addEventListener('click',       stopUnlessOurs, { capture: true });

  const backdrop = document.getElementById('backdrop');
  // Backdrop is never inside #lb-wrap so always block it fully
  const stopAll = e => e.stopImmediatePropagation();
  backdrop?.addEventListener('pointerdown', stopAll, { capture: true });
  backdrop?.addEventListener('pointerup',   stopAll, { capture: true });
  backdrop?.addEventListener('click',       stopAll, { capture: true });

  // Store references for cleanup
  card._stopUnlessOurs = stopUnlessOurs;
  card._stopAll        = stopAll;
  card._hasBackdrop    = !!backdrop;

  // ── Container for everything we inject
  const wrap = document.createElement('div');
  wrap.id = 'lb-wrap';

  // ── Leaderboard section (shown immediately)
  const boardSection = document.createElement('div');
  boardSection.id = 'lb-board-section';
  boardSection.innerHTML = `
    <p id="lb-heading">🏆 Leaderboard</p>
    <ol id="lb-list"></ol>
  `;
  wrap.appendChild(boardSection);

  // ── Name entry (inline, board stays visible)
  const savedName = localStorage.getItem('apple-bobbing:player-name') || '';
  const nameSection = document.createElement('div');
  nameSection.id = 'lb-name-section';
  nameSection.innerHTML = `
    <label id="lb-name-label" for="lb-name-input">Add your name to the board:</label>
    <div id="lb-name-row">
      <input
        id="lb-name-input"
        type="text"
        maxlength="20"
        placeholder="Your name"
        value="${savedName.replace(/"/g, '&quot;')}"
        autocomplete="nickname"
        autocorrect="off"
        spellcheck="false"
      />
      <button id="lb-save-btn" type="button">Save</button>
    </div>
    <p id="lb-save-status"></p>
  `;
  wrap.appendChild(nameSection);

  // ── Action buttons
  const actions = document.createElement('div');
  actions.id = 'lb-actions';

  const playAgainBtn = document.createElement('button');
  playAgainBtn.id = 'lb-play-again';
  playAgainBtn.type = 'button';
  playAgainBtn.textContent = '▶ Play Again';
  // Tap the game-over card to restart (that's what the bundle listens for)
  playAgainBtn.addEventListener('click', () => {
    resetSession();
    // Remove capture-phase blockers so the bundle's restart listener fires
    _removeCardBlockers(card);
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });

  const factsBtn = document.createElement('button');
  factsBtn.id = 'lb-facts-btn';
  factsBtn.type = 'button';
  factsBtn.textContent = '📚 All Facts & Answers';
  factsBtn.addEventListener('click', showFactsModal);

  const arcadeBtn = document.createElement('a');
  arcadeBtn.id = 'lb-arcade-btn';
  arcadeBtn.href = '../../';
  arcadeBtn.textContent = '← Back to Arcade';

  actions.appendChild(playAgainBtn);
  actions.appendChild(factsBtn);
  actions.appendChild(arcadeBtn);
  wrap.appendChild(actions);

  // Insert before game-over-prompt (or append to card)
  card.insertBefore(wrap, bundlePrompt ?? null);

  // ── CRITICAL: stop ALL pointer events inside our overlay from bubbling up
  // to the bundle's #game-over-card pointerdown listener (which restarts the game).
  // Only the explicit "Play Again" button is allowed to trigger a restart.
  wrap.addEventListener('pointerdown', e => e.stopPropagation());
  wrap.addEventListener('pointerup',   e => e.stopPropagation());
  wrap.addEventListener('click',       e => e.stopPropagation());

  // ── Wire up save button
  document.getElementById('lb-save-btn').addEventListener('click', async () => {
    const input   = document.getElementById('lb-name-input');
    const status  = document.getElementById('lb-save-status');
    const saveBtn = document.getElementById('lb-save-btn');
    const name    = (input?.value || '').trim() || 'Anonymous';

    localStorage.setItem('apple-bobbing:player-name', name);
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    await saveScore(name, totalScore);

    const rank = (await fetchTopScores()).findIndex(
      s => s.score === totalScore && s.name === name
    ) + 1;

    if (rank > 0 && rank <= 3) {
      playFanfare();
      status.textContent = rank === 1 ? '🏆 New #1 High Score!' : `🎉 You ranked #${rank}!`;
      status.className = 'lb-status-top';
    } else {
      status.textContent = '✓ Score saved!';
      status.className = 'lb-status-ok';
    }

    saveBtn.textContent = 'Saved ✓';
    // Re-render board with the player's entry highlighted
    await renderBoard(totalScore, name);
  });

  // Render board immediately (before save — shows existing scores)
  renderBoard(totalScore, null);
}

/* ─── Watch for game-over card becoming visible ──────────────────────────── */
function watchGameOver() {
  const card = document.getElementById('game-over-card');
  if (!card) return;

  let wasHidden = card.classList.contains('hidden');

  new MutationObserver(() => {
    const isHidden = card.classList.contains('hidden');

    if (wasHidden && !isHidden) {
      // Game over — read score and build overlay
      initAudio();
      const scoreEl   = document.getElementById('game-over-score');
      const qfBonus   = window.__qfBonus ?? 0;
      window.__qfBonus = 0;
      const rawScore  = parseInt(scoreEl?.textContent ?? '0', 10) || 0;
      const totalScore = rawScore + qfBonus;
      if (qfBonus > 0 && scoreEl) scoreEl.textContent = String(totalScore);

      // Small delay so the bundle finishes its own DOM writes first
      setTimeout(() => buildGameOverOverlay(totalScore), 80);
    }

    if (!wasHidden && isHidden) {
      // New game started — reset session state and tear down everything we injected
      resetSession();
      document.getElementById('lb-wrap')?.remove();
      document.getElementById('facts-modal')?.remove();
      delete card.dataset.lbBuilt;

      // Remove all capture-phase blockers if still attached
      _removeCardBlockers(card);

      // Restore bundle elements
      const bundleList   = document.getElementById('game-over-scores');
      const bundlePrompt = document.getElementById('game-over-prompt');
      if (bundleList)   bundleList.style.display   = '';
      if (bundlePrompt) bundlePrompt.style.display = '';
    }

    wasHidden = isHidden;
  }).observe(card, { attributes: true, attributeFilter: ['class'] });
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', watchGameOver);
