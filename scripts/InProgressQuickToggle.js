// ==UserScript==
// @name         Nifty – In Progress Quick Toggle
// @namespace    https://hbusa.nifty.pm/
// @version      1.4.0
// @description  One-click In Progress tag toggle in the Comments header (beside Show activity). No pop-up alerts.
// @match        https://hbusa.nifty.pm/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const ID = 'nqt-in-progress-toggle';
  const TAG = 'In Progress';
  const TIMEOUT = 7000;

  // Button labels
  const LABEL_OFF = 'IN PROGRESS';          // tag NOT on task → click to add
  const LABEL_ON = 'REMOVE IN PROGRESS';    // tag on task → click to remove

  let busy = false;
  let timer = 0;

  const norm = v => (v || '').replace(/\s+/g, ' ').trim();
  const visible = el =>
    !!(el?.isConnected && el.getClientRects().length &&
       getComputedStyle(el).visibility !== 'hidden');
  const all = (root, sel) => [...root.querySelectorAll(sel)];
  const exact = (el, text) => norm(el?.textContent) === text;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function tagsBlock(panel) {
    const blocks = all(panel, '.task-panel-fact, .control').filter(block =>
      all(block, ':scope > * .task-panel-fact-text, .control-text')
        .some(el => exact(el, 'Tags')) &&
      block.querySelector('.labels-list')
    );
    const inner = blocks.filter(b => !blocks.some(o => o !== b && b.contains(o)));
    return inner.length === 1 ? inner[0] : null;
  }

  function context() {
    const panels = all(document, '.content-panel-main')
      .filter(visible)
      .filter(p => p.querySelector('.content-panel-head'));
    if (panels.length !== 1) return null;

    const panel = panels[0];
    const control = tagsBlock(panel);
    if (!control) return null;

    const list = control.querySelector('.labels-list');
    const key = norm(panel.querySelector('.content-panel-head .nice-id')?.textContent);
    if (!list || !/^[A-Z][A-Z0-9]*-\d+$/i.test(key)) return null;

    return { panel, control, list, key, url: location.href };
  }

  function current(original) {
    const c = context();
    if (!c || c.panel !== original.panel || c.key !== original.key || c.url !== original.url) {
      throw new Error('Task changed or closed.');
    }
    return c;
  }

  // The element in the task's Tags list that shows "In Progress"
  function tagChip(c) {
    const hits = all(c.list, '.status-chip, .labels-list-item-text, .labels-list-item')
      .filter(el => exact(el, TAG));
    // outermost chip (so we can find its remove "x" inside)
    return hits.find(el => !hits.some(o => o !== el && o.contains(el))) || null;
  }

  const hasTag = c => !!tagChip(c);

  const isAddText = el => /^\+?\s*Add$/i.test(norm(el?.textContent));
  const addControl = c =>
    all(c.list, '.action-text, button, [role="button"]')
      .find(el => el.id !== ID && isAddText(el));

  const searches = () =>
    all(document, 'input').filter(el =>
      visible(el) && /^search tags(?:\.{3}|…)?$/i.test(norm(el.placeholder)));

  const picker = input => input.closest('.label-picker, .popout-inner, [role="dialog"]');

  function optionIn(root) {
    if (!root) return null;
    const matches = all(root, '[role="option"], .color-block, [role="menuitem"], li')
      .filter(el => visible(el) &&
        (exact(el, TAG) || all(el, '.name, span').some(n => exact(n, TAG))));
    const rows = matches.filter(el => !matches.some(o => o !== el && el.contains(o)));
    return rows.length === 1 ? rows[0] : null;
  }

  async function waitFor(read, original) {
    const start = Date.now();
    while (Date.now() - start < TIMEOUT) {
      current(original);
      const r = read();
      if (r) return r;
      await sleep(120);
    }
    throw new Error('Timed out.');
  }

  // Fast path for removing: click the chip's own "x" if Nifty shows one.
  function chipRemoveButton(c) {
    const chip = tagChip(c);
    if (!chip) return null;
    const scope = chip.closest('.labels-list-item, .status-chip') || chip;
    return scope.querySelector(
      '[aria-label*="remove" i], [title*="remove" i], .remove, .close, ' +
      'svg.lucide-x, svg[class*="lucide-x"], .icon-close, .icon-x'
    );
  }

  // Toggle via the native "+ Add" tag picker (works for add and remove).
  async function toggleViaPicker(original) {
    const add = addControl(original);
    if (!add) throw new Error('Tags "+ Add" not found.');

    // Close any picker left open
    if (searches().length) { add.click(); await sleep(200); }

    let search;
    try {
      add.click();
      search = await waitFor(() => {
        const inputs = searches();
        return inputs.length === 1 && inputs[0];
      }, original);

      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter.call(search, TAG);
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new Event('change', { bubbles: true }));

      const option = await waitFor(() => optionIn(picker(search)), original);
      (option.querySelector('.color-block-click-overlay') || option).click();
    } finally {
      // Wait a moment for Nifty to apply, then close only the picker (not the task).
      await sleep(250);
      if (search?.isConnected && visible(search)) {
        try { addControl(current(original))?.click(); } catch { /* task changed */ }
      }
    }
  }

  function paint(button, c) {
    if (busy) return;
    const active = hasTag(c);
    const label = active ? LABEL_ON : LABEL_OFF;
    if (button.textContent !== label) button.textContent = label;
    if (button.dataset.active !== String(active)) button.dataset.active = String(active);
    const title = active ? 'Click to remove the In Progress tag' : 'Click to add the In Progress tag';
    if (button.title !== title) button.title = title;
    if (button.getAttribute('aria-pressed') !== String(active)) button.setAttribute('aria-pressed', String(active));
    button.disabled = false;
  }

  function scan() {
    timer = 0;
    if (busy) return;

    const c = context();
    let button = document.getElementById(ID);

    if (!c) { button?.remove(); return; }

    if (!button) {
      button = document.createElement('button');
      button.id = ID;
      button.type = 'button';
      button.addEventListener('click', toggle);
    }

    const commentsHead = c.panel.querySelector('.section-comments .section-head');
    const activity = commentsHead
      ? [...commentsHead.children].find(el =>
          el !== button && /^(show|hide) activity$/i.test(norm(el.textContent)))
      : null;

    if (activity) {
      button.classList.add('nqt-in-comments');
      if (activity.previousElementSibling !== button) activity.before(button);
    } else {
      button.classList.remove('nqt-in-comments');
      const ready = c.panel.querySelector('#nifty-ready-for-price-control');
      const anchor = ready || c.panel.querySelector('.content-panel-head-utils a');
      const parent = anchor?.parentElement || c.panel.querySelector('.content-panel-head-utils');
      if (!parent) { button.remove(); return; }
      if (anchor) {
        if (anchor.nextElementSibling !== button) anchor.after(button);
      } else if (button.parentElement !== parent) {
        parent.append(button);
      }
    }

    paint(button, c);
  }

  function schedule() {
    if (!timer) timer = setTimeout(scan, 150);
  }

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const original = context();
    if (!original) return;

    const button = event.currentTarget;
    const before = hasTag(original);

    busy = true;
    button.disabled = true;
    button.textContent = before ? 'REMOVING…' : 'ADDING…';

    try {
      if (before) {
        // Remove: try the chip's own "x" first, else use the picker.
        const x = chipRemoveButton(original);
        if (x) {
          (x.closest('button, [role="button"], a') || x)
            .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          try {
            await waitFor(() => !hasTag(current(original)), original);
          } catch {
            if (hasTag(current(original))) await toggleViaPicker(original);
          }
        } else {
          await toggleViaPicker(original);
        }
      } else {
        await toggleViaPicker(original);
      }

      await waitFor(() => hasTag(current(original)) === !before, original);
      console.info('[Nifty Quick Tag]', original.key, before ? 'removed' : 'added');
    } catch (error) {
      // No pop-up: log it and flash the button briefly.
      console.warn('[Nifty Quick Tag]', error);
      button.textContent = 'TRY AGAIN';
      await sleep(1200);
    } finally {
      busy = false;
      button.disabled = false;
      schedule();
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    #${ID} {
      appearance: none;
      flex: 0 0 auto;
      border: 1px solid #d92179;
      border-radius: 6px;
      background: #fff;
      color: #be1767;
      height: 26px;
      padding: 5px 10px;
      margin-left: 8px;
      font: 600 11px/1.2 sans-serif;
      white-space: nowrap;
      cursor: pointer;
    }
    #${ID}.nqt-in-comments { margin-left: auto; margin-right: 8px; }
    #${ID}[data-active="true"] { background: #d92179; color: #fff; }
    #${ID}:focus-visible { outline: 2px solid #ff81be; outline-offset: 2px; }
    #${ID}:disabled { opacity: .65; cursor: wait; }
  `;
  document.head.append(style);

  new MutationObserver(records => {
    if (records.some(r => !(r.target instanceof Element && r.target.closest(`#${ID}`)))) schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);

  scan();
})();
