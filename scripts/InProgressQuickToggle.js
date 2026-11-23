// ==UserScript==
// @name         Nifty – In Progress Quick Toggle
// @namespace    https://hbusa.nifty.pm/
// @version      1.3.0
// @description  Toggle the In Progress tag from the Comments header (beside Show activity).
// @match        https://hbusa.nifty.pm/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const ID = 'nqt-in-progress-toggle';
  const TAG = 'In Progress';
  const TIMEOUT = 7000;

  let busy = false;
  let timer = 0;

  const norm = value =>
    (value || '').replace(/\s+/g, ' ').trim();

  const visible = element =>
    !!(
      element?.isConnected &&
      element.getClientRects().length &&
      getComputedStyle(element).visibility !== 'hidden'
    );

  const all = (root, selector) =>
    [...root.querySelectorAll(selector)];

  const exact = (element, text) =>
    norm(element?.textContent) === text;

  // Nifty's new task panel shows Tags as a "fact" cell:
  //   .task-panel-fact > .task-panel-fact-label > .task-panel-fact-text "Tags"
  // The old layout used .control / .control-text. Support both.
  function tagsBlock(panel) {
    const blocks = all(panel, '.task-panel-fact, .control').filter(block =>
      all(block, ':scope > * .task-panel-fact-text, .control-text').some(
        element => exact(element, 'Tags')
      ) && block.querySelector('.labels-list')
    );

    // Keep the innermost match only.
    const inner = blocks.filter(block =>
      !blocks.some(other => other !== block && block.contains(other))
    );

    return inner.length === 1 ? inner[0] : null;
  }

  function context() {
    const panels = all(document, '.content-panel-main')
      .filter(visible)
      .filter(panel => panel.querySelector('.content-panel-head'));

    if (panels.length !== 1) return null;

    const panel = panels[0];
    const control = tagsBlock(panel);
    if (!control) return null;

    const list = control.querySelector('.labels-list');
    const head = panel.querySelector('.content-panel-head');

    const key = norm(
      head?.querySelector('.nice-id')?.textContent
    );

    if (!list || !/^[A-Z][A-Z0-9]*-\d+$/i.test(key)) {
      return null;
    }

    return {
      panel,
      control,
      list,
      key,
      url: location.href
    };
  }

  function current(original) {
    const c = context();

    if (
      !c ||
      c.panel !== original.panel ||
      c.key !== original.key ||
      c.url !== original.url
    ) {
      throw new Error(
        'Task changed or closed. Check its tags before trying again.'
      );
    }

    return c;
  }

  // New layout: each tag is a .status-chip. Old: .labels-list-item.
  const hasTag = c =>
    all(
      c.list,
      '.status-chip, .labels-list-item-text, .labels-list-item'
    ).some(element => exact(element, TAG));

  // New layout label is "+ Add"; old was "Add".
  const isAddText = element =>
    /^\+?\s*Add$/i.test(norm(element?.textContent));

  const addControl = c =>
    all(
      c.list,
      '.action-text, button, [role="button"]'
    ).find(element =>
      element.id !== ID && isAddText(element)
    );

  const searches = () =>
    all(document, 'input').filter(element =>
      visible(element) &&
      /^search tags(?:\.{3}|…)?$/i.test(
        norm(element.placeholder)
      )
    );

  function picker(input) {
    return input.closest(
      '.label-picker, .popout-inner, [role="dialog"]'
    );
  }

  function optionIn(root) {
    if (!root) return null;

    const matches = all(
      root,
      '[role="option"], .color-block, [role="menuitem"], li'
    ).filter(element =>
      visible(element) &&
      (
        exact(element, TAG) ||
        all(element, '.name, span').some(name =>
          exact(name, TAG)
        )
      )
    );

    const rows = matches.filter(element =>
      !matches.some(other =>
        other !== element && element.contains(other)
      )
    );

    return rows.length === 1 ? rows[0] : null;
  }

  // Is the tag ticked in the picker? null = unknown.
  // New picker: a lucide "check" svg appears in the row when selected.
  // (aria-selected on these rows is only the keyboard highlight.)
  function optionSelected(option) {
    if (option.matches('[role="option"]')) {
      return !!option.querySelector(
        'svg.lucide-check, svg[class*="check"]'
      );
    }

    if (option.matches('.color-block')) {
      return option.classList.contains('selected');
    }

    const checkbox = option.querySelector(
      'input[type="checkbox"], [aria-checked]'
    );

    if (!checkbox) return null;

    return checkbox.matches('input')
      ? checkbox.checked
      : checkbox.getAttribute('aria-checked') === 'true';
  }

  async function waitFor(read, original) {
    const start = Date.now();

    while (Date.now() - start < TIMEOUT) {
      current(original);

      const result = read();
      if (result) return result;

      await new Promise(resolve =>
        setTimeout(resolve, 120)
      );
    }

    throw new Error(
      'Timed out. Check the native Tags list before retrying.'
    );
  }

  function paint(button, c) {
    if (busy) return;

    const active = hasTag(c);

    const label = active
      ? 'REMOVE IN PROGRESS'
      : 'START IN PROGRESS';

    if (button.textContent !== label) {
      button.textContent = label;
    }

    if (button.dataset.active !== String(active)) {
      button.dataset.active = String(active);
    }

    const title =
      `${active ? 'Remove' : 'Add'} the In Progress tag; ` +
      'task status stays unchanged';

    if (button.title !== title) {
      button.title = title;
    }

    if (button.getAttribute('aria-pressed') !== String(active)) {
      button.setAttribute('aria-pressed', String(active));
    }

    button.disabled = false;
  }

  function scan() {
    timer = 0;

    if (busy) return;

    const c = context();
    let button = document.getElementById(ID);

    if (!c) {
      button?.remove();
      return;
    }

    if (!button) {
      button = document.createElement('button');
      button.id = ID;
      button.type = 'button';
      button.addEventListener('click', toggle);
    }

    // Preferred spot: Comments header, just left of "Show activity".
    const commentsHead = c.panel.querySelector(
      '.section-comments .section-head'
    );

    const activity = commentsHead
      ? [...commentsHead.children].find(element =>
          element !== button &&
          /^(show|hide) activity$/i.test(norm(element.textContent))
        )
      : null;

    if (activity) {
      button.classList.add('nqt-in-comments');

      if (activity.previousElementSibling !== button) {
        activity.before(button);
      }
    } else {
      // Fallback: task header, beside READY FOR PRICE.
      button.classList.remove('nqt-in-comments');

      const ready = c.panel.querySelector(
        '#nifty-ready-for-price-control'
      );

      const anchor =
        ready ||
        c.panel.querySelector('.content-panel-head-utils a');

      const parent =
        anchor?.parentElement ||
        c.panel.querySelector('.content-panel-head-utils');

      if (!parent) {
        button.remove();
        return;
      }

      if (anchor) {
        if (anchor.nextElementSibling !== button) {
          anchor.after(button);
        }
      } else if (button.parentElement !== parent) {
        parent.append(button);
      }
    }

    paint(button, c);
  }

  function schedule() {
    if (!timer) {
      timer = setTimeout(scan, 150);
    }
  }

  async function toggle(event) {
    event.preventDefault();
    event.stopPropagation();

    if (busy) return;

    const original = context();
    if (!original) return;

    const button = event.currentTarget;
    const add = addControl(original);

    if (!add) {
      alert(
        'Nifty: native Tags > Add was not found. ' +
        'Open the Tags control and try again.'
      );
      return;
    }

    if (searches().length) {
      alert('Close the open tag picker, then try again.');
      return;
    }

    const before = hasTag(original);

    busy = true;
    button.disabled = true;
    button.textContent = before
      ? 'REMOVING…'
      : 'ADDING…';

    let search;
    let clicked = false;

    try {
      add.click();

      search = await waitFor(() => {
        const inputs = searches();
        return inputs.length === 1 && inputs[0];
      }, original);

      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;

      if (!setter) {
        throw new Error(
          'Cannot update the native tag search.'
        );
      }

      setter.call(search, TAG);

      search.dispatchEvent(
        new Event('input', { bubbles: true })
      );

      search.dispatchEvent(
        new Event('change', { bubbles: true })
      );

      const option = await waitFor(
        () => optionIn(picker(search)),
        original
      );

      const c = current(original);

      if (hasTag(c) !== before) {
        throw new Error(
          'Tags changed while opening the picker. ' +
          'Check the current tag state.'
        );
      }

      if (!search.isConnected || !option.isConnected) {
        throw new Error('Tag picker closed.');
      }

      const selected = optionSelected(option);

      if (selected != null && selected !== before) {
        throw new Error(
          'Picker and task disagree about the tag. ' +
          'Refresh and try again.'
        );
      }

      (
        option.querySelector('.color-block-click-overlay') ||
        option
      ).click();

      clicked = true;

      await waitFor(
        () => hasTag(current(original)) === !before,
        original
      );

      console.info(
        '[Nifty Quick Tag]',
        original.key,
        before ? 'Tag removed in UI' : 'Tag added in UI'
      );
    } catch (error) {
      console.warn('[Nifty Quick Tag]', error);

      alert(
        `Nifty In Progress: ${error.message}` +
        (
          clicked
            ? '\nA click was sent. Verify the tag before retrying.'
            : ''
        )
      );
    } finally {
      // Escape can close the entire task panel.
      // Close only this picker using the native "+ Add" toggle.
      if (search?.isConnected && visible(search)) {
        try {
          addControl(current(original))?.click();
        } catch {
          // Task changed: leave its UI alone.
        }
      }

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

    /* In the Comments header: push to the right, sit before Show activity */
    #${ID}.nqt-in-comments {
      margin-left: auto;
      margin-right: 8px;
    }

    #${ID}[data-active="true"] {
      background: #d92179;
      color: white;
    }

    #${ID}:focus-visible {
      outline: 2px solid #ff81be;
      outline-offset: 2px;
    }

    #${ID}:disabled {
      opacity: .65;
      cursor: wait;
    }
  `;

  document.head.append(style);

  new MutationObserver(records => {
    const externalChange = records.some(record =>
      !(
        record.target instanceof Element &&
        record.target.closest(`#${ID}`)
      )
    );

    if (externalChange) schedule();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);

  scan();
})();
