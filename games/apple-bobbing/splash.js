/**
 * splash.js — Apple Bobbing cover screen
 *
 * Shows a full-screen splash using cover.png before the game loads.
 * Dismissed by any tap/click/keypress → fades out, then the bundle's
 * own attract screen takes over as normal.
 */

function buildSplash() {
  // Don't show after a Play Again (game already running)
  if (sessionStorage.getItem('apple-bobbing:splash-shown')) return;
  sessionStorage.setItem('apple-bobbing:splash-shown', '1');

  const splash = document.createElement('div');
  splash.id = 'splash-screen';
  splash.innerHTML = `
    <div id="splash-bg"></div>
    <div id="splash-vignette"></div>
    <div id="splash-content">
      <div id="splash-kicker">The IBM Storage</div>
      <h1 id="splash-title">Apple Bobbing</h1>
      <p id="splash-sub">Twelve apples. Twelve facts.<br>How many can you bob?</p>
      <div id="splash-cta">
        <span id="splash-cta-text">Tap anywhere to begin</span>
        <span id="splash-cta-cursor"></span>
      </div>
    </div>
    <a id="splash-arcade-link" href="../../">&larr; Arcade</a>
  `;
  document.body.appendChild(splash);

  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    splash.classList.add('splash-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Safety: remove after 700 ms even if transitionend doesn't fire
    setTimeout(() => splash.remove(), 700);
  }

  // Capture phase: dismiss first, then stop the event reaching the game.
  // Both handlers must be capture so they fire even when a child element
  // (e.g. #splash-bg) is the event target.
  splash.addEventListener('pointerdown', e => {
    if (e.target.id === 'splash-arcade-link') return;
    dismiss();
    e.stopPropagation(); // don't let the tap also trigger the game beneath
  }, { capture: true });

  splash.addEventListener('click', e => {
    if (e.target.id === 'splash-arcade-link') return;
    e.stopPropagation();
  }, { capture: true });

  // Keyboard fallback
  document.addEventListener('keydown', dismiss, { once: true });
}

document.addEventListener('DOMContentLoaded', buildSplash);
