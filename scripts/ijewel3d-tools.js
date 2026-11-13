// ==UserScript==
// @name         Nifty – iJewel View / Copy / Compare
// @namespace    hobrothers.cad
// @version      3.0
// @description  Adds View, Copy Link and Compare-with-previous buttons under every iJewel3D link in Nifty comments. View/Compare open in a separate window.
// @match        https://hbusa.nifty.pm/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__ijInlineLoaded) return;
  window.__ijInlineLoaded = true;

  const st = document.createElement('style');
  st.textContent = `
  .ijBar{display:flex;gap:6px;margin:4px 0 6px}
  .ijBar button{font:600 11px system-ui;padding:3px 9px;border-radius:5px;border:0;cursor:pointer;color:#fff;line-height:16px}
  .ijBar .v{background:#2563eb}.ijBar .c{background:#4b5563}.ijBar .p{background:#7c3aed}
  .ijBar button:hover{filter:brightness(1.15)}`;
  document.head.appendChild(st);

  const clean = h => h.split('#')[0];

  // All iJewel links in the open task, sorted by version (V1, V2, ...)
  function getLinks() {
    const seen = new Map();
    [...document.querySelectorAll('a[href*="ijewel3d.com"]')]
      .filter(a => a.offsetParent !== null)
      .forEach((a, i) => {
        const href = clean(a.href);
        if (seen.has(href)) return;
        const block = a.closest('.nifty-md, p') || a.parentElement;
        const m = (block ? block.textContent : '').replace(href, ' ').match(/\bV\s*-?\s*(\d+)\b/i);
        seen.set(href, { href, ver: m ? +m[1] : null, order: i });
      });
    const list = [...seen.values()];
    list.forEach((l, i) => { if (l.ver == null) l.ver = i + 1; });
    return list.sort((a, b) => a.ver - b.ver || a.order - b.order);
  }

  function getJob() {
    const m = document.body.innerText.match(/\bJ\d{6}\b/g);
    return m ? m[m.length - 1] : '';
  }

  // ---------- separate window viewer ----------
  function openWindow(links, rightIdx, leftIdx) {
    const two = leftIdx != null;
    const job = getJob();
    const name = two ? 'ijCompare' : 'ijView';
    const w = window.open('', name, `width=${screen.availWidth},height=${screen.availHeight},left=0,top=0`);
    if (!w) { alert('Please allow pop-ups for hbusa.nifty.pm'); return; }
    const d = w.document;
    d.open();
    d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${job} – ${two ? 'iJewel Compare' : 'iJewel View'}</title></head>
      <body style="margin:0;height:100vh;display:flex;flex-direction:column;background:#111827;font:13px system-ui;color:#e5e7eb">
      <div id="bar" style="display:flex;gap:10px;align-items:center;padding:8px 12px;background:#1f2937">
        <b style="font-size:15px">${job}</b><span>${two ? 'Compare versions' : 'View'}</span></div>
      <div id="panes" style="flex:1;display:flex;gap:4px;padding:4px;min-height:0"></div></body></html>`);
    d.close();

    const btnStyle = 'background:#374151;color:#fff;border:1px solid #4b5563;border-radius:6px;padding:5px 8px;font:13px system-ui;cursor:pointer';
    const panes = d.getElementById('panes');
    const sides = {};

    function makePane(side, color, title) {
      const p = d.createElement('div');
      p.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0;border-radius:6px;overflow:hidden';
      const head = d.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;background:#273244';
      const tag = d.createElement('span');
      tag.textContent = title;
      tag.style.cssText = `font-weight:700;padding:2px 8px;border-radius:10px;background:${color}`;
      const sel = d.createElement('select');
      sel.style.cssText = btnStyle;
      links.forEach((l, i) => { const o = d.createElement('option'); o.value = i; o.textContent = 'V' + l.ver; sel.appendChild(o); });
      const a = d.createElement('a');
      a.target = '_blank'; a.textContent = 'Open in new tab ↗';
      a.style.cssText = 'color:#93c5fd;margin-left:auto;text-decoration:none';
      const f = d.createElement('iframe');
      f.setAttribute('allow', 'fullscreen; xr-spatial-tracking'); f.allowFullscreen = true;
      f.style.cssText = 'flex:1;border:0;width:100%;background:#fff';
      head.append(tag, sel, a); p.append(head, f); panes.appendChild(p);
      sides[side] = { sel, a, f };
      sel.onchange = () => set(side, +sel.value);
    }
    function set(side, idx) {
      const s = sides[side], l = links[idx];
      s.sel.value = idx; s.f.src = l.href; s.a.href = l.href;
    }

    if (two) makePane('left', '#b45309', 'PREVIOUS');
    makePane('right', '#047857', two ? 'CURRENT' : 'VIEW');
    set('right', rightIdx);
    if (two) {
      set('left', leftIdx);
      const sw = d.createElement('button');
      sw.textContent = '⇄ Swap'; sw.style.cssText = btnStyle;
      sw.onclick = () => { const L = +sides.left.sel.value, R = +sides.right.sel.value; set('left', R); set('right', L); };
      d.getElementById('bar').appendChild(sw);
    }
    w.focus();
  }

  // ---------- 3 small buttons under every link ----------
  function addButtons() {
    document.querySelectorAll('a[href*="ijewel3d.com"]:not([data-ij-done])').forEach(a => {
      if (a.offsetParent === null) return;                 // hidden copy – check again later
      a.setAttribute('data-ij-done', '1');
      if (a.closest('[contenteditable="true"]')) return;   // skip the comment editor box
      const host = a.closest('p') || a;
      if (host.nextElementSibling && host.nextElementSibling.classList.contains('ijBar')) return;
      const href = clean(a.href);
      const bar = document.createElement('div');
      bar.className = 'ijBar';
      bar.innerHTML = '<button class="v">👁 View</button><button class="c">📋 Copy link</button><button class="p">⇆ Compare prev</button>';
      const stop = e => { e.preventDefault(); e.stopPropagation(); };

      bar.querySelector('.v').onclick = e => {
        stop(e);
        const links = getLinks(); const i = links.findIndex(l => l.href === href);
        if (i < 0) openWindow([{ href, ver: 1 }], 0); else openWindow(links, i);
      };
      bar.querySelector('.c').onclick = e => {
        stop(e);
        const b = e.currentTarget;
        navigator.clipboard.writeText(href).then(() => {
          b.textContent = '✔ Copied'; setTimeout(() => (b.textContent = '📋 Copy link'), 1500);
        });
      };
      bar.querySelector('.p').onclick = e => {
        stop(e);
        const b = e.currentTarget;
        const links = getLinks(); const i = links.findIndex(l => l.href === href);
        if (i <= 0) { b.textContent = 'No previous version'; setTimeout(() => (b.textContent = '⇆ Compare prev'), 1500); return; }
        openWindow(links, i, i - 1);
      };
      host.insertAdjacentElement('afterend', bar);
    });
  }

  // light polling instead of a MutationObserver (avoids feedback loops with Nifty's editor)
  addButtons();
  setInterval(addButtons, 1500);
})();
