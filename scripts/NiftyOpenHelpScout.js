(function () {
  'use strict';

  const BTN_ID = 'nifty-open-helpscout-btn';
  const HS_SEARCH = 'https://secure.helpscout.net/search/?query=';
  const J_REGEX = /\bJ\d{5,7}\b/i;

  // Find the J number from the task title (fallback: subtitle / panel text)
  function getJobNumber() {
    const title = document.querySelector('.content-panel-field-input.multi-line-input');
    let m = title && (title.textContent || '').match(J_REGEX);
    if (m) return m[0].toUpperCase();

    const head = document.querySelector('.content-panel-head-utils');
    const panel = head && head.closest('[class*="content-panel"]')?.parentElement;
    m = panel && (panel.innerText || '').match(J_REGEX);
    return m ? m[0].toUpperCase() : null;
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = 'OPEN HELP SCOUT';
    btn.title = 'Search this J number in Help Scout';
    btn.style.cssText = [
      'appearance:none', 'border:1px solid rgba(20,70,160,.4)', 'border-radius:6px',
      'background:#1f6feb', 'color:#fff', 'padding:5px 10px', 'height:26px',
      'font-family:inherit', 'font-size:11px', 'font-weight:600', 'line-height:1.2',
      'letter-spacing:.02em', 'white-space:nowrap', 'cursor:pointer',
      'box-shadow:0 1px 2px rgba(0,0,0,.12)', 'margin-left:8px', 'flex:0 0 auto',
      'position:relative', 'z-index:2'
    ].join(';');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const job = getJobNumber();
      if (!job) {
        alert('J number not found on this task.');
        return;
      }
      // Named target -> reuses the same Help Scout tab on later clicks
      const w = window.open(HS_SEARCH + encodeURIComponent(job), 'nifty_helpscout');
      if (w) w.focus();
    });
    return btn;
  }

  function inject() {
    const utils = document.querySelector('.content-panel-head-utils');
    if (!utils || utils.querySelector('#' + BTN_ID)) return;

    const btn = makeButton();
    const anchor = utils.querySelector('#nqt-in-progress-toggle') ||
                   utils.querySelector('#nifty-ready-for-price-control');
    if (anchor) anchor.insertAdjacentElement('afterend', btn);
    else utils.appendChild(btn);
  }

  // Nifty is a SPA: keep watching for task panels opening/changing
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; inject(); });
  }).observe(document.body, { childList: true, subtree: true });

  inject();
})();
