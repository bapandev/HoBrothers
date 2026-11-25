// ==UserScript==
// @name         Nifty - Ready for Price Quick Action
// @namespace    https://hbusa.nifty.pm/
// @version      1.4.0
// @description  Button beside REMOVE IN PROGRESS: Change status → CAD CENTRAL → Ready to Price → Confirm.
// @match        https://hbusa.nifty.pm/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX = '[Nifty Ready Price]';
  const BUTTON_ID = 'nifty-ready-for-price-btn';
  const WRAPPER_ID = 'nifty-ready-for-price-control';
  const REMOVE_IN_PROGRESS_ID = 'nqt-in-progress-toggle'; // button from the other script
  const TARGET_PROJECT = 'CAD CENTRAL';
  const TARGET_STATUS = 'Ready to Price';
  const ALLOWED_STATUS = 'Complete Ready4Review';
  const STAGE_TIMEOUT = 10_000;
  const VERIFY_TIMEOUT = 15_000;

  let processing = false;
  let scanTimer = 0;
  let lastLoggedTaskId = '';

  const log = (...a) => console.log(PREFIX, ...a);
  const warn = (...a) => console.warn(PREFIX, ...a);
  const error = (...a) => console.error(`${PREFIX} ERROR:`, ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function normalize(v) {
    return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(el) {
    if (!(el instanceof Element) || !el.isConnected) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }

  function waitForCondition(test, description, timeout = STAGE_TIMEOUT) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value, failure) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearInterval(interval);
        clearTimeout(timer);
        failure ? reject(failure) : resolve(value);
      };
      const check = () => {
        try {
          const v = test();
          if (v) finish(v);
        } catch (cause) {
          finish(null, cause);
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'disabled', 'data-state', 'aria-expanded', 'aria-selected', 'data-selected']
      });
      const interval = setInterval(check, 150);
      const timer = setTimeout(() => finish(null, new Error(`Timed out waiting for ${description}`)), timeout);
      check();
    });
  }

  function setReactInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------------- Task panel helpers ---------------- */

  function getTaskPanel() {
    return [...document.querySelectorAll('.content-panel-main')].find((p) =>
      isVisible(p) && p.querySelector('.content-panel-head .nice-id-holder .nice-id')
    ) || null;
  }

  function getTaskId(panel) {
    return panel?.querySelector('.content-panel-head .nice-id-holder .nice-id')?.textContent?.trim() || '';
  }

  function getCurrentStatus(panel) {
    const utils = panel?.querySelector('.content-panel-head-utils');
    if (!utils) return '';
    const idHolder = utils.querySelector('.nice-id-holder');
    const chip = [...utils.querySelectorAll('[aria-haspopup="dialog"]')].find((el) =>
      el !== idHolder && !el.closest(`#${WRAPPER_ID}`) && el.querySelector('span.truncate')
    );
    return chip?.querySelector('span.truncate')?.textContent?.trim() || '';
  }

  function findOverflowButton(panel) {
    // Nifty now labels it "More options: Next: Hold, Collapse, ..."
    return panel.querySelector('.content-panel-head button[aria-label^="More options"]') || null;
  }

  /* ---------------- Menu helpers (Radix / cmdk) ---------------- */

  function visibleMenus() {
    return [...document.querySelectorAll('[role="menu"]')].filter(isVisible);
  }

  function findChangeStatusItem() {
    return [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
      isVisible(el) && normalize(el.textContent) === 'change status'
    ) || null;
  }

  function findStatusMenu() {
    const input = [...document.querySelectorAll('input')].find((i) =>
      isVisible(i) && normalize(i.placeholder).startsWith('search statuses')
    );
    const menu = input?.closest('[role="menu"]');
    return input && menu ? { menu, input } : null;
  }

  function findProjectSearch() {
    return [...document.querySelectorAll('input')].find((i) =>
      isVisible(i) && normalize(i.placeholder).startsWith('search projects')
    ) || null;
  }

  const selectedProject = (menu) =>
    normalize(menu?.querySelector('.popout-resource-selector-extra strong')?.textContent);

  function findOptions(scope, text) {
    const want = normalize(text);
    return [...scope.querySelectorAll('[role="option"]')].filter((o) =>
      isVisible(o) && (normalize(o.textContent) === want || normalize(o.getAttribute('data-value')) === want)
    );
  }

  function findButton(scope, text) {
    return [...scope.querySelectorAll('button')].find((b) => isVisible(b) && normalize(b.textContent) === normalize(text)) || null;
  }

  function closeMenus() {
    const status = findStatusMenu();
    if (status) findButton(status.menu, 'Cancel')?.click();
    setTimeout(() => {
      // Escape on the menu itself closes only the menu, not the task panel.
      visibleMenus().forEach((m) =>
        m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      );
    }, 250);
  }

  /* ---------------- Button ---------------- */

  function setButtonState(button, state) {
    if (!button || button.dataset.state === state) return;
    button.dataset.state = state;
    if (state === 'working') {
      button.textContent = 'Working...';
      button.disabled = true;
    } else if (state === 'done') {
      button.textContent = '✓ READY FOR PRICE';
      button.disabled = true;
    } else {
      button.textContent = 'READY FOR PRICE';
      button.disabled = false;
    }
  }

  function findMount(panel) {
    // Primary: right beside the REMOVE IN PROGRESS button in the Comments header.
    const toggle = panel.querySelector(`#${REMOVE_IN_PROGRESS_ID}`);
    if (toggle && toggle.parentElement) return { parent: toggle.parentElement, before: toggle, beside: true };
    // Fallback: task header utilities (old position).
    const utils = panel.querySelector('.content-panel-head .content-panel-head-utils')
      || panel.querySelector('.content-panel-head');
    return utils ? { parent: utils, before: null, beside: false } : null;
  }

  function createControl(panel) {
    const wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.style.cssText = 'display:inline-flex;align-items:center;flex:0 0 auto;position:relative;z-index:2';

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.setAttribute('aria-label', 'Move this task to CAD CENTRAL — Ready to Price');
    button.title = 'Change status → CAD CENTRAL → Ready to Price → Confirm';
    button.style.cssText = [
      'appearance:none', 'border:1px solid rgba(0,120,105,.38)', 'border-radius:6px',
      'background:#00a99b', 'color:#fff', 'padding:4px 10px', 'height:26px',
      'font-family:inherit', 'font-size:11px', 'font-weight:600', 'line-height:1.2',
      'letter-spacing:.02em', 'white-space:nowrap', 'cursor:pointer',
      'box-shadow:0 1px 2px rgba(0,0,0,.12)'
    ].join(';');
    button.addEventListener('mouseenter', () => { if (!button.disabled) button.style.background = '#008f83'; });
    button.addEventListener('mouseleave', () => { button.style.background = '#00a99b'; });
    button.addEventListener('click', () => moveToReadyForPrice(getTaskPanel() || panel, button));
    setButtonState(button, 'ready');

    wrapper.appendChild(button);
    return wrapper;
  }

  function placeControl(wrapper, mount) {
    if (mount.beside) {
      // margin-left:auto keeps it packed next to REMOVE IN PROGRESS (header uses justify-between)
      wrapper.style.marginLeft = 'auto';
      wrapper.style.marginRight = '8px';
    } else {
      wrapper.style.marginLeft = '8px';
      wrapper.style.marginRight = '0';
    }
    if (mount.before) {
      if (wrapper.parentElement !== mount.parent || wrapper.nextElementSibling !== mount.before) {
        mount.parent.insertBefore(wrapper, mount.before);
      }
    } else if (wrapper.parentElement !== mount.parent) {
      mount.parent.appendChild(wrapper);
    }
  }

  function injectButton() {
    if (processing) return;
    const panel = getTaskPanel();
    if (!panel) {
      document.querySelectorAll(`#${WRAPPER_ID}`).forEach((n) => n.remove());
      return;
    }

    const taskId = getTaskId(panel);
    const status = getCurrentStatus(panel);

    // Only show on "Complete Ready4Review"
    if (normalize(status) !== normalize(ALLOWED_STATUS)) {
      document.querySelectorAll(`#${WRAPPER_ID}`).forEach((n) => n.remove());
      return;
    }

    if (taskId !== lastLoggedTaskId) {
      lastLoggedTaskId = taskId;
      log(`Task ${taskId || '(unknown)'} — status: ${status}`);
    }

    const mount = findMount(panel);
    if (!mount) return;

    let wrapper = panel.querySelector(`#${WRAPPER_ID}`);
    if (!wrapper) {
      document.querySelectorAll(`#${WRAPPER_ID}`).forEach((n) => n.remove()); // orphan from another panel
      wrapper = createControl(panel);
      log(`READY FOR PRICE shown for ${taskId}`);
    }
    placeControl(wrapper, mount);
  }

  /* ---------------- Action ---------------- */

  async function moveToReadyForPrice(panel, button) {
    if (processing || button.disabled) return;
    if (!panel?.isConnected) return;

    const originalTaskId = getTaskId(panel);
    const stillCurrentTask = () =>
      panel.isConnected && panel === getTaskPanel() && getTaskId(panel) === originalTaskId;

    processing = true;
    setButtonState(button, 'working');
    let confirmed = false;

    try {
      // 1. Open the task's three-dot menu
      const overflow = findOverflowButton(panel);
      if (!overflow) throw new Error('Task "More options" (three-dot) button not found');
      if (overflow.getAttribute('aria-expanded') !== 'true') {
        overflow.click();
        await sleep(300);
        if (overflow.getAttribute('aria-expanded') !== 'true') {
          overflow.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
        }
      }
      log('Task menu opened');

      // 2. Open "Change status" submenu
      const changeStatus = await waitForCondition(findChangeStatusItem, 'the Change status menu item');
      if (!stillCurrentTask()) throw new Error('The opened task changed while the menu was open');
      changeStatus.click();
      let parts = await waitForCondition(findStatusMenu, 'the Change status submenu');
      log('Change status submenu opened');

      // 3. Choose CAD CENTRAL project
      if (selectedProject(parts.menu) !== normalize(TARGET_PROJECT)) {
        const chooser = parts.menu.querySelector('.popout-resource-selector-extra strong');
        if (!chooser) throw new Error('"In Project" chooser not found');
        chooser.click();
        const projectInput = await waitForCondition(findProjectSearch, 'the project search box');
        setReactInput(projectInput, TARGET_PROJECT);
        const projectOption = await waitForCondition(() => {
          if (!stillCurrentTask()) throw new Error('The opened task changed');
          const scope = projectInput.closest('[role="menu"]') || document;
          const matches = findOptions(scope, TARGET_PROJECT);
          if (matches.length > 1) throw new Error('Multiple CAD CENTRAL projects found; choose manually');
          return matches[0] || null;
        }, 'the CAD CENTRAL project option');
        projectOption.click();
        parts = await waitForCondition(() => {
          const p = findStatusMenu();
          return p && selectedProject(p.menu) === normalize(TARGET_PROJECT) ? p : null;
        }, 'CAD CENTRAL statuses to load');
      }
      log('CAD CENTRAL selected');

      // 4. Choose "Ready to Price"
      let option = findOptions(parts.menu, TARGET_STATUS)[0];
      if (!option) {
        setReactInput(parts.input, TARGET_STATUS);
        option = await waitForCondition(() => findOptions(findStatusMenu()?.menu || parts.menu, TARGET_STATUS)[0], 'the Ready to Price option')
          .catch(() => {
            const avail = [...parts.menu.querySelectorAll('[role="option"]')].map((o) => o.textContent.trim());
            throw new Error(`"${TARGET_STATUS}" not found in CAD CENTRAL.\nAvailable: ${avail.join(', ') || '(none)'}`);
          });
      }
      if (!stillCurrentTask()) throw new Error('The opened task changed before selecting the status');
      option.click();
      log('Ready to Price clicked');

      const confirm = await waitForCondition(() => {
        const p = findStatusMenu();
        if (!p) return null;
        const opt = findOptions(p.menu, TARGET_STATUS)[0];
        const marked = opt && (opt.getAttribute('aria-selected') === 'true' || opt.getAttribute('data-selected') === 'true');
        const btn = findButton(p.menu, 'Confirm');
        return marked && btn && !btn.disabled ? btn : null;
      }, 'Confirm to become enabled');

      // 5. Final safety checks, then Confirm
      const finalParts = findStatusMenu();
      if (!stillCurrentTask()) throw new Error('The opened task changed before confirmation');
      if (selectedProject(finalParts?.menu) !== normalize(TARGET_PROJECT)) throw new Error('Project changed before confirmation');
      confirm.click();
      confirmed = true;
      log('Confirm clicked');

      // 6. Verify
      const result = await waitForCondition(() => {
        if (!stillCurrentTask()) return 'panel-changed';
        return normalize(getCurrentStatus(panel)) === normalize(TARGET_STATUS) ? 'verified' : null;
      }, 'the status to update to Ready to Price', VERIFY_TIMEOUT);

      if (result === 'panel-changed') {
        warn(`${originalTaskId}: Confirm sent; task panel closed/changed (task moved to CAD CENTRAL).`);
      } else {
        log('Status verified: Ready to Price');
      }
      setButtonState(button, 'done');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error(message);
      if (!confirmed) closeMenus();
      window.alert(`[Nifty Ready to Price]\n${originalTaskId}\n\n${message}` +
        (confirmed ? '\n\nConfirm was already clicked — check CAD CENTRAL before retrying.' : ''));
      if (button.isConnected) setButtonState(button, 'ready');
    } finally {
      processing = false;
      scheduleScan();
    }
  }

  /* ---------------- Watchers ---------------- */

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      injectButton();
    }, 120);
  }

  new MutationObserver((records) => {
    if (records.some(({ target }) => {
      const el = target instanceof Element ? target : target.parentElement;
      return !el?.closest(`#${WRAPPER_ID}`);
    })) scheduleScan();
  }).observe(document.documentElement, { childList: true, subtree: true });

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      scheduleScan();
      return result;
    };
  }
  addEventListener('popstate', scheduleScan);
  addEventListener('hashchange', scheduleScan);
  setInterval(scheduleScan, 1500);

  injectButton();
  log('Version 1.4.0 loaded');
})();
