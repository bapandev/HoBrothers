// ==UserScript==
// @name         Nifty - Ready for Price Quick Action
// @namespace    https://hbusa.nifty.pm/
// @version      1.3.0
// @description  Select CAD CENTRAL in Change Status, then Ready to Price and Confirm.
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
  const TARGET_PROJECT = 'CAD CENTRAL';
  const TARGET_STATUS = 'Ready to Price';
  const TARGET_NORMALIZED = normalize(TARGET_STATUS);
  const STAGE_TIMEOUT = 10_000;
  const VERIFY_TIMEOUT = 15_000;

  let processing = false;
  let scanTimer = 0;
  let lastLoggedTaskId = '';

  const log = (...args) => console.log(PREFIX, ...args);
  const error = (...args) => console.error(`${PREFIX} ERROR:`, ...args);


  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function exactText(root, selector, text, visibleOnly = true) {
    const wanted = normalize(text);
    return [...root.querySelectorAll(selector)].find((element) =>
      normalize(element.textContent) === wanted && (!visibleOnly || isVisible(element))
    ) || null;
  }

  function waitForCondition(test, description, timeout = STAGE_TIMEOUT) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let observer;
      let interval;

      const finish = (value, failure) => {
        if (settled) return;
        settled = true;
        observer?.disconnect();
        clearInterval(interval);
        clearTimeout(timer);
        failure ? reject(failure) : resolve(value);
      };

      const check = () => {
        try {
          const value = test();
          if (value) finish(value);
        } catch (cause) {
          finish(null, cause);
        }
      };

      observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'disabled', 'data-state', 'aria-expanded']
      });
      interval = setInterval(check, 150);
      const timer = setTimeout(
        () => finish(null, new Error(`Timed out waiting for ${description}`)),
        timeout
      );
      check();
    });
  }

  function waitForElement(find, description, timeout = STAGE_TIMEOUT) {
    return waitForCondition(() => {
      const element = find();
      return element && isVisible(element) ? element : null;
    }, description, timeout);
  }

  function getTaskPanel() {
    return [...document.querySelectorAll('.content-panel-main')].find((panel) =>
      isVisible(panel) && panel.querySelector('.content-panel-head .nice-id-holder .nice-id')
    ) || null;
  }

  function getTaskId(panel) {
    return panel?.querySelector('.content-panel-head .nice-id-holder .nice-id')?.textContent?.trim() || '';
  }

  function getCurrentStatus(panel) {
    // Observed status chip beside the task's nice ID in the panel header.
    const headerUtils = panel?.querySelector('.content-panel-head-utils');
    const taskIdHolder = headerUtils?.querySelector('.nice-id-holder');
    if (!headerUtils || !taskIdHolder) return '';

    const chip = [...headerUtils.querySelectorAll('[aria-haspopup="dialog"]')].find((element) =>
      element !== taskIdHolder && element.querySelector('span.truncate')
    );
    return chip?.querySelector('span.truncate')?.textContent?.trim() || '';
  }

  function setButtonState(button, state) {
    if (!button || button.dataset.state === state) return;
    if (state === 'working') {
      button.textContent = 'Working...';
      button.disabled = true;
      button.dataset.state = 'working';
    } else if (state === 'done') {
      button.textContent = '✓ READY FOR PRICE';
      button.disabled = true;
      button.dataset.state = 'done';
    } else {
      button.textContent = 'READY FOR PRICE';
      button.disabled = false;
      button.dataset.state = 'ready';
    }
  }

  function syncButton(panel, button) {
    if (processing || !panel || !button) return;
    setButtonState(button, normalize(getCurrentStatus(panel)) === TARGET_NORMALIZED ? 'done' : 'ready');
  }

  function findHeaderMount(panel) {
    const header = panel?.querySelector('.content-panel-head');
    if (!header) return panel ? { element: panel, location: 'task panel fallback' } : null;

    // Primary: observed container holding "NOX-12 | In Progress" and, on
    // Reporting, the adjacent "Go to project" link.
    const utilities = header.querySelector('.content-panel-head-utils');
    if (utilities) return { element: utilities, location: 'header utilities' };

    // Fallbacks are deliberately scoped to the currently visible task panel.
    const headerTop = header.querySelector('.content-panel-head-top');
    if (headerTop) return { element: headerTop, location: 'header top' };
    return { element: header, location: 'task header' };
  }

 function injectButton() {
  const panel = getTaskPanel();
  if (!panel) return;

  const taskId = getTaskId(panel);
  const currentStatus = normalize(getCurrentStatus(panel));

  // ONLY show button when status is "Complete Ready4Review"
  const ALLOWED_STATUS = normalize('Complete Ready4Review');

  // If status is anything else, remove/hide READY FOR PRICE button
  if (currentStatus !== ALLOWED_STATUS) {
    panel.querySelector(`#${WRAPPER_ID}`)?.remove();
    return;
  }

  if (taskId !== lastLoggedTaskId) {
    lastLoggedTaskId = taskId;
    log('Task panel found');
    log(`Current task: ${taskId || '(unknown ID)'}`);
    log(`Current status: ${getCurrentStatus(panel)}`);
  }

  // Already injected
  const existing = panel.querySelector(`#${BUTTON_ID}`);
  if (existing) {
    syncButton(panel, existing);
    return;
  }

  // Remove orphan button
  document.querySelectorAll(`#${WRAPPER_ID}`).forEach((node) => node.remove());

  const mount = findHeaderMount(panel);
  if (!mount) {
    error('No mount point found');
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.dataset.niftyReadyPrice = '1';
  wrapper.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'flex:0 0 auto',
    'margin-left:8px',
    'position:relative',
    'z-index:2'
  ].join(';');

  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.dataset.niftyReadyPrice = '1';

  button.setAttribute(
    'aria-label',
    'Move this task to CAD CENTRAL — Ready to Price'
  );

  button.title =
    'Change Status → CAD CENTRAL → Ready to Price → Confirm';

  button.style.cssText = [
    'appearance:none',
    'border:1px solid rgba(0,120,105,.38)',
    'border-radius:6px',
    'background:#00a99b',
    'color:#fff',
    'padding:5px 10px',
    'height:26px',
    'font-family:inherit',
    'font-size:11px',
    'font-weight:600',
    'line-height:1.2',
    'letter-spacing:.02em',
    'white-space:nowrap',
    'cursor:pointer',
    'box-shadow:0 1px 2px rgba(0,0,0,.12)'
  ].join(';');

  button.addEventListener('mouseenter', () => {
    if (!button.disabled) button.style.background = '#008f83';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#00a99b';
  });

  button.addEventListener('click', () =>
    moveToReadyForPrice(panel, button)
  );

  wrapper.appendChild(button);
  mount.element.appendChild(wrapper);

  syncButton(panel, button);

  log(`READY FOR PRICE shown for ${taskId}`);
}
  function findOverflowButton(panel) {
    // Observed Nifty overflow icon: three-dot SVG with this stable viewBox, scoped to the active task panel.
    const icon = panel.querySelector('.content-panel-head .content-panel-simple-action svg[viewBox="0 0 60 60"]');
    return icon?.closest('.content-panel-simple-action-inner') || null;
  }

  function findStatusDialog() {
    const input = [...document.querySelectorAll('input[placeholder="Search statuses…"]')].find(isVisible);
    if (!input) return null;
    const popout = input.closest('.popout.visible, .popout') || input.closest('.resource-selector')?.parentElement;
    if (!popout || !isVisible(popout)) return null;
    return { popout, selector: input.closest('.resource-selector') || popout, input };
  }

  function setReactInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function moveToReadyForPrice(panel, button) {
    if (processing || button.disabled) return;
    if (!panel.isConnected || panel !== getTaskPanel()) return;

    const taskId = getTaskId(panel);
    const originalTaskId = taskId;
    if (normalize(getCurrentStatus(panel)) === TARGET_NORMALIZED) {
      setButtonState(button, 'done');
      return;
    }

    processing = true;
    setButtonState(button, 'working');

    try {
      const stillCurrentTask = () => panel.isConnected && panel === getTaskPanel() && getTaskId(panel) === originalTaskId;
      if (!stillCurrentTask()) throw new Error('The opened task changed before processing started');

      const overflow = findOverflowButton(panel);
      if (!overflow || !isVisible(overflow)) throw new Error('Task three-dot menu button not found');
      log('Opening task menu');
      overflow.click();

      const changeStatus = await waitForElement(
        () => exactText(document, '.item-inner, [role="menuitem"], [role="option"]', 'Change Status'),
        'the visible Change Status menu item'
      );
      if (!stillCurrentTask()) throw new Error('The opened task changed while the menu was open');
      changeStatus.click();
      log('Change Status clicked');

      let dialog = await waitForElement(
        () => findStatusDialog()?.popout,
        'the Change Status popup'
      );
      let dialogParts = findStatusDialog();
      if (!dialogParts || dialogParts.popout !== dialog) throw new Error('Change Status popup could not be scoped');
      if (!stillCurrentTask()) throw new Error('The opened task changed while the status popup was open');
      log('Status dialog detected');


      // Change Status has its own project chooser; do not use Move to Project.
      const selectedProject = (parts) => normalize(parts?.popout.querySelector('.popout-resource-selector-extra strong')?.textContent);
      if (selectedProject(dialogParts) !== normalize(TARGET_PROJECT)) {
        const chooser = dialogParts.popout.querySelector('.popout-resource-selector-extra strong');
        if (!chooser || !isVisible(chooser)) throw new Error('In Project chooser not found');
        chooser.click();
        const projectInput = await waitForElement(() => {
          if (!stillCurrentTask()) throw new Error('The opened task changed');
          return [...dialog.querySelectorAll('input[placeholder="Search projects"]')].find(isVisible);
        }, 'the project chooser');
        setReactInput(projectInput, TARGET_PROJECT);
        const projectOption = await waitForElement(() => {
          if (!stillCurrentTask()) throw new Error('The opened task changed');
          const scope = projectInput.closest('.resource-selector');
          if (!scope) return null;
          const matches = [...scope.querySelectorAll('.item h5')].filter(e => normalize(e.textContent) === normalize(TARGET_PROJECT) && isVisible(e));
          if (matches.length > 1) throw new Error('Multiple CAD CENTRAL projects found; choose manually');
          return matches[0]?.closest('.item-inner') || null;
        }, 'the exact CAD CENTRAL project');
        if (!stillCurrentTask()) throw new Error('The opened task changed');
        projectOption.click();
        dialogParts = await waitForCondition(() => {
          if (!stillCurrentTask()) throw new Error('The opened task changed');
          const current = findStatusDialog();
          return current && selectedProject(current) === normalize(TARGET_PROJECT) ? current : null;
        }, 'CAD CENTRAL statuses');
        dialog = dialogParts.popout;
      }
      if (selectedProject(dialogParts) !== normalize(TARGET_PROJECT)) throw new Error('CAD CENTRAL was not selected');
      log('CAD CENTRAL selected');

      const availableStatuses = [...dialogParts.selector.querySelectorAll('.item h5')]
        .map((element) => element.textContent.trim());
      const missingStatusMessage = () => {
        const project = dialogParts.popout.querySelector('.popout-resource-selector-extra strong')?.textContent?.trim();
        return `এই প্রজেক্টে "${TARGET_STATUS}" স্ট্যাটাস পাওয়া যায়নি${project ? ` (${project})` : ''}।\nCAD CENTRAL-এর স্ট্যাটাস ও আপনার access পরীক্ষা করুন।\nAvailable: ${availableStatuses.join(', ') || '(unknown)'}`;
      };
      setReactInput(dialogParts.input, TARGET_STATUS);

      const option = await waitForElement(() => {
        const current = findStatusDialog();
        if (!stillCurrentTask()) throw new Error('The opened task changed');
        if (!current || current.popout !== dialog) return null;
        if (current.selector.textContent.includes('No results matching the filter')) {
          throw new Error(missingStatusMessage());
        }
        const heading = exactText(current.selector, '.item h5, [role="option"]', TARGET_STATUS);
        return heading?.closest('.item, [role="option"]') || null;
      }, 'the exact Ready to Price option');

      if (normalize(option.textContent) !== TARGET_NORMALIZED) {
        throw new Error('Exact Ready to Price option not found');
      }
      if (!stillCurrentTask()) throw new Error('The opened task changed before selecting the status');
      (option.querySelector('.item-inner') || option).click();
      log('Ready to Price selected');

      const selected = await waitForCondition(() => {
        const current = findStatusDialog();
        if (!stillCurrentTask()) throw new Error('The opened task changed');
        if (!current || current.popout !== dialog) return null;
        if (current.selector.textContent.includes('No results matching the filter')) {
          throw new Error(missingStatusMessage());
        }
        const heading = exactText(current.selector, '.item h5, [role="option"]', TARGET_STATUS);
        const item = heading?.closest('.item, [role="option"]');
        const confirm = exactText(current.popout, 'button', 'Confirm');
        const marked = item?.classList.contains('selected') || item?.getAttribute('aria-selected') === 'true';
        return item && marked && confirm && !confirm.disabled ? { current, confirm } : null;
      }, 'Ready to Price to become selected');

      const confirm = selected.confirm || exactText(selected.current.popout, 'button', 'Confirm');
      if (!confirm || confirm.disabled) throw new Error('Scoped Confirm button is missing or disabled');
      if (!stillCurrentTask()) throw new Error('The opened task changed before confirmation');
      if (selectedProject(findStatusDialog()) !== normalize(TARGET_PROJECT)) throw new Error('Project changed before confirmation');
      confirm.click();
      log('Confirm clicked');

      await waitForCondition(() => {
        if (!stillCurrentTask()) throw new Error('Confirm was submitted, but the task panel or ID changed. Check CAD CENTRAL before retrying; the move may have succeeded.');
        return normalize(getCurrentStatus(panel)) === TARGET_NORMALIZED;
      }, 'the task status to update to Ready to Price', VERIFY_TIMEOUT);

      setButtonState(button, 'done');
      log('Status verified');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error(message);
      // Keep failures visible; never silently choose another status or project.
      window.alert(`[Nifty Ready to Price]\n${originalTaskId}\n\n${message}`);
      if (button.isConnected) setButtonState(button, 'ready');
    } finally {
      processing = false;
      scheduleScan();
    }
  }

  function scheduleScan() {
    // Throttle instead of endlessly postponing while other scripts mutate the DOM.
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = 0;
      injectButton();
    }, 120);
  }

  const observer = new MutationObserver((records) => {
    if (records.some(({ target }) => {
      const element = target instanceof Element ? target : target.parentElement;
      return !element?.closest(`#${WRAPPER_ID}`);
    })) scheduleScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

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

  // Also recover from CSS-only panel visibility changes and delayed app startup.
  setInterval(scheduleScan, 1500);
  injectButton();
  scheduleScan();
  log('Version 1.3.0 loaded');
})();
