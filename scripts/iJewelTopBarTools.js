// ==UserScript==
// @name         iJewel: View ⇄ Playground button
// @namespace    hobrothers-cad
// @version      1.2
// @description  On iJewel Drive file pages: "Open in Playground" on view pages, "Open in View" on playground pages.
// @match        https://ijewel3d.com/*/files/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'hb-view-playground-btn';
  const RE = /^(\/[^/]+\/files\/[^/]+)\/(view|playground)\/?$/;

  // Matches the iJewel "Save" button look
  const BASE_STYLE = {
    height: '34px', padding: '0 13px', background: '#222', color: '#fff',
    border: 'none', borderRadius: '10px', cursor: 'pointer',
    font: '400 14px DMSans-regular, sans-serif', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center'
  };

  function target() {
    const m = location.pathname.match(RE);
    if (!m) return null;
    const to = m[2] === 'view' ? 'playground' : 'view';
    return {
      url: location.origin + m[1] + '/' + to + location.search + location.hash,
      label: to === 'playground' ? 'Open in Playground' : 'Open in View'
    };
  }

  function findSaveButton() {
    return [...document.querySelectorAll('button')]
      .find(b => b.id !== BTN_ID && b.textContent.trim() === 'Save');
  }

  function makeButton() {
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.title = 'Ctrl/Cmd-click or middle-click to open in a new tab';
    Object.assign(btn.style, BASE_STYLE);
    btn.addEventListener('mouseenter', () => (btn.style.background = '#000'));
    btn.addEventListener('mouseleave', () => (btn.style.background = '#222'));
    btn.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) window.open(btn.dataset.url, '_blank');
      else location.href = btn.dataset.url;
    });
    btn.addEventListener('auxclick', (e) => {
      if (e.button === 1) window.open(btn.dataset.url, '_blank');
    });
    return btn;
  }

  function place(btn) {
    const save = findSaveButton();
    if (save) {
      // Playground: sit inline right next to the Save button
      if (btn.nextElementSibling !== save) {
        Object.assign(btn.style, { position: '', top: '', right: '', zIndex: '' });
        save.parentElement.insertBefore(btn, save);
      }
    } else if (btn.parentElement !== document.body) {
      // View page: top-right corner of the header
      Object.assign(btn.style, { position: 'fixed', top: '15px', right: '16px', zIndex: 2147483647 });
      document.body.appendChild(btn);
    }
  }

  function sync() {
    const t = target();
    let btn = document.getElementById(BTN_ID);
    if (!t) { if (btn) btn.remove(); return; }
    if (!btn) btn = makeButton();
    btn.dataset.url = t.url;
    btn.textContent = t.label;
    place(btn);
  }

  // Keep in sync with single-page-app navigation and header re-renders
  setInterval(sync, 500);
  sync();
})();
