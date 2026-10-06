/**
 * audio.js — Apple Bobbing sound layer v2
 * All sounds synthesised with Web Audio API; no external files needed.
 * Exports: initAudio(), playCorrect(), playWrong(), playFanfare(),
 *          playClick(), playQuickFireAlert(),
 *          startMusic(), stopMusic(), toggleMute(), isMuted()
 */

let ctx = null;
let masterGain = null;
let musicNodes = [];
let muted = false;
let musicRunning = false;

/* ── Initialise AudioContext on first user gesture ───────────────────────── */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
  masterGain.connect(ctx.destination);
}

/* ── Toggle mute ─────────────────────────────────────────────────────────── */
export function toggleMute() {
  if (!ctx) return;
  muted = !muted;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
  return muted;
}

export function isMuted() { return muted; }

/* ── Helper: envelope gain node ──────────────────────────────────────────── */
function makeEnv(attackTime, decayTime, peakGain = 0.6) {
  const g = ctx.createGain();
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peakGain, now + attackTime);
  g.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime);
  g.connect(masterGain);
  return g;
}

/* ── Button click: short tactile tick ────────────────────────────────────── */
export function playClick() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = makeEnv(0.002, 0.06, 0.25);
  osc.type = 'square';
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);
  osc.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.07);
}

/* ── Correct answer: ascending two-note chime (C5 → E5) ─────────────────── */
export function playCorrect() {
  if (!ctx) return;
  const notes = [523.25, 659.25];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const env = makeEnv(0.01, 0.35, 0.55);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
    osc.connect(env);
    osc.start(ctx.currentTime + i * 0.18);
    osc.stop(ctx.currentTime + i * 0.18 + 0.4);
  });
}

/* ── Wrong answer: descending buzz ───────────────────────────────────────── */
export function playWrong() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = makeEnv(0.005, 0.32, 0.5);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.32);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.32);
  osc.connect(filter);
  filter.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.36);
}

/* ── Victory fanfare: 5-note ascending chime ────────────────────────────── */
export function playFanfare() {
  if (!ctx) return;
  const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const env = makeEnv(0.01, 0.5, 0.6);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
    osc.connect(env);
    osc.start(ctx.currentTime + i * 0.14);
    osc.stop(ctx.currentTime + i * 0.14 + 0.55);
  });
}

/* ── Quick Fire alert: urgent rising pulse ───────────────────────────────── */
export function playQuickFireAlert() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const env = makeEnv(0.01, 0.4, 0.7);
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.15);
  osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + 0.3);
  osc.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.45);
}

/* ── Halloween background music ─────────────────────────────────────────── */
export function startMusic() {
  if (!ctx) return;
  // Always resume — AudioContext may be suspended if created before a gesture
  ctx.resume().then(() => _startMusicNodes());
}

function _startMusicNodes() {
  if (musicRunning) return;
  musicRunning = true;

  /* ── Master music bus (quiet — background only) */
  const musicBus = ctx.createGain();
  musicBus.gain.setValueAtTime(0, ctx.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 4);
  musicBus.connect(masterGain);
  musicNodes.push(musicBus);

  /* ── 1. Deep bass drone — two detuned sines */
  [40, 40.6].forEach(freq => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0.55, ctx.currentTime);
    osc.connect(g); g.connect(musicBus);
    osc.start();
    musicNodes.push(osc, g);
  });

  /* ── 2. Wind layer — filtered noise */
  const bufSize = ctx.sampleRate * 3; // 3 s of noise, looped
  const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.setValueAtTime(700, ctx.currentTime);
  windFilter.Q.setValueAtTime(1.2, ctx.currentTime);

  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.18, ctx.currentTime);

  noise.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(musicBus);
  noise.start();
  musicNodes.push(noise, windFilter, windGain);

  /* ── Wind gust LFO — slowly sweeps filter freq and gain */
  const gustLfo = ctx.createOscillator();
  const gustLfoGain = ctx.createGain();
  gustLfo.frequency.setValueAtTime(0.08, ctx.currentTime); // ~1 cycle / 12 s
  gustLfoGain.gain.setValueAtTime(320, ctx.currentTime);    // sweeps ±320 Hz
  gustLfo.connect(gustLfoGain);
  gustLfoGain.connect(windFilter.frequency);
  gustLfo.start();
  musicNodes.push(gustLfo, gustLfoGain);

  /* Volume LFO for gusts rising/falling */
  const volLfo = ctx.createOscillator();
  const volLfoGain = ctx.createGain();
  volLfo.frequency.setValueAtTime(0.05, ctx.currentTime);
  volLfoGain.gain.setValueAtTime(0.12, ctx.currentTime);
  volLfo.connect(volLfoGain);
  volLfoGain.connect(windGain.gain);
  volLfo.start();
  musicNodes.push(volLfo, volLfoGain);

  /* ── 3. Ghostly wail — fires randomly every 8–16 s */
  function scheduleWail() {
    if (!musicRunning) return;
    const delay = 8 + Math.random() * 8;
    const wailTimer = setTimeout(() => {
      if (!ctx || !musicRunning) return;
      const wailOsc = ctx.createOscillator();
      const wailEnv = ctx.createGain();
      const wailDur = 2.5 + Math.random() * 1.5;
      const startFreq = 180 + Math.random() * 60;
      const peakFreq = startFreq + 80 + Math.random() * 60;

      wailOsc.type = 'sine';
      wailOsc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      wailOsc.frequency.linearRampToValueAtTime(peakFreq, ctx.currentTime + wailDur * 0.4);
      wailOsc.frequency.linearRampToValueAtTime(startFreq - 30, ctx.currentTime + wailDur);

      wailEnv.gain.setValueAtTime(0, ctx.currentTime);
      wailEnv.gain.linearRampToValueAtTime(0.22, ctx.currentTime + wailDur * 0.2);
      wailEnv.gain.linearRampToValueAtTime(0.18, ctx.currentTime + wailDur * 0.6);
      wailEnv.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + wailDur);

      /* Subtle vibrato on the wail */
      const vibLfo = ctx.createOscillator();
      const vibGain = ctx.createGain();
      vibLfo.frequency.setValueAtTime(4.5, ctx.currentTime);
      vibGain.gain.setValueAtTime(6, ctx.currentTime);
      vibLfo.connect(vibGain);
      vibGain.connect(wailOsc.frequency);
      vibLfo.start(ctx.currentTime);
      vibLfo.stop(ctx.currentTime + wailDur + 0.1);

      wailOsc.connect(wailEnv);
      wailEnv.connect(musicBus);
      wailOsc.start(ctx.currentTime);
      wailOsc.stop(ctx.currentTime + wailDur + 0.1);

      scheduleWail();
    }, delay * 1000);
    musicNodes.push({ _timer: wailTimer }); // store so stopMusic can cancel
  }
  scheduleWail();
}

export function stopMusic() {
  if (!musicRunning) return;
  musicRunning = false;
  const now = ctx?.currentTime ?? 0;
  musicNodes.forEach(n => {
    if (!n) return;
    if (n._timer != null) { clearTimeout(n._timer); return; }
    try {
      if (n instanceof GainNode) {
        n.gain.cancelScheduledValues(now);
        n.gain.setTargetAtTime(0, now, 0.4);
      }
      if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) n.stop(now + 1.5);
    } catch (_) {}
  });
  musicNodes = [];
}
