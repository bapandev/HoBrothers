// ==UserScript==
// @name         iJewel3D Top Bar Tools (Show/Hide, Quick Tools, Box Select)
// @namespace    hobrothers.cad
// @version      3.1
// @description  Small top-bar buttons in the iJewel3D Playground: Show/Hide all & selected, Clear selection, Render Preset, Reset Camera, Logo Search, Box Select.
// @match        https://ijewel3d.com/*
// @match        https://*.ijewel3d.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
// Picking panel: Ctrl+click names = mark (orange), Ctrl+Shift+click = mark range, Shift+click tick boxes = range.
// Box Select: B = toggle, Esc = off. Drag L→R = window, R→L = crossing. Shift+drag add, Ctrl+drag remove.
// v3.1: Render Preset always leaves Ground > Visible UNCHECKED (never toggles it back on).

(function () {
  'use strict';

  const sleep = t => new Promise(r => setTimeout(r, t));

  /* =====================================================================
     STYLES
     ===================================================================== */
  const style = document.createElement('style');
  style.textContent = `
    .treejs li.cc-sel > .treejs-label{background:#ffb84d!important;color:#000!important;border-radius:3px}
    #cc-topbar{display:flex;align-items:center;gap:5px;flex:none;flex-wrap:nowrap}
    #cc-topbar button{height:28px;padding:0 9px;border:0;border-radius:8px;background:#222;color:#fff;
      font:400 12px DMSans-regular,sans-serif;cursor:pointer;white-space:nowrap;transition:background .15s}
    #cc-topbar button:hover{background:#444}
    #cc-topbar button:active{background:#000}
    #cc-topbar button.cc-on{background:#2563eb}
    #cc-topbar .cc-div{width:1px;height:20px;background:#ccc;margin:0 3px}
  `;
  document.head.appendChild(style);

  /* =====================================================================
     1) PICKING PANEL – SHOW / HIDE / SELECT
     ===================================================================== */
  const TREE = '.treejs';
  let busy = false, lastBox = null, lastMark = null;

  const tree = () => document.querySelector(TREE);
  const isOn = li => li.classList.contains('treejs-node__checked');            // ticked = visible
  const leaves = t => [...t.querySelectorAll('li.treejs-node')].filter(li => !li.querySelector('ul'));
  const setState = (li, on) => { if (isOn(li) !== on) li.querySelector(':scope > .treejs-checkbox')?.click(); };
  const applyAll = (list, on) => { busy = true; try { list.forEach(li => setState(li, on)); } finally { busy = false; } refreshCount(); };
  // orange marks; if none, the viewer's blue picks
  const selected = t => {
    let s = [...t.querySelectorAll('li.cc-sel')];
    if (!s.length) s = [...t.querySelectorAll('li.treejs-node-selected')];
    return s.filter(li => !li.querySelector('ul'));
  };

  function refreshCount() {
    const t = tree(), b = document.querySelector('#cc-topbar [data-k="clear"]');
    if (!t || !b) return;
    const n = t.querySelectorAll('li.cc-sel').length;
    b.textContent = n ? `Clear (${n})` : 'Clear';
  }

  document.addEventListener('click', e => {
    if (busy) return;
    const lab = e.target.closest?.(`${TREE} .treejs-label`);
    if (lab && (e.ctrlKey || e.metaKey)) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const li = lab.parentElement;
      if (e.shiftKey && lastMark && lastMark.parentElement === li.parentElement) {
        const sibs = [...li.parentElement.children];
        const [a, b] = [sibs.indexOf(lastMark), sibs.indexOf(li)].sort((x, y) => x - y);
        sibs.slice(a, b + 1).forEach(s => s.classList.add('cc-sel'));
      } else li.classList.toggle('cc-sel');
      lastMark = li; refreshCount(); return;
    }
    const box = e.target.closest?.(`${TREE} .treejs-checkbox`);
    if (box) {
      const li = box.parentElement;
      if (e.shiftKey && lastBox && lastBox !== li && lastBox.parentElement === li.parentElement) {
        const target = !isOn(li);
        const sibs = [...li.parentElement.children];
        const [a, b] = [sibs.indexOf(lastBox), sibs.indexOf(li)].sort((x, y) => x - y);
        setTimeout(() => applyAll(sibs.slice(a, b + 1).filter(s => s !== li), target), 0);
      }
      lastBox = li;
    }
  }, true);

  /* =====================================================================
     2) QUICK TOOLS – Render preset / Camera reset / Hierarchy / Logo search
     ===================================================================== */
  const toast = (msg, bg = '#222') => {
    let t = document.getElementById('aro-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'aro-toast';
      t.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1000000;color:#fff;font:14px Arial;padding:10px 16px;border-radius:8px;max-width:360px;box-shadow:0 8px 30px rgba(0,0,0,.25)';
      document.body.appendChild(t);
    }
    t.style.background = bg; t.textContent = msg; return t;
  };
  function res(t) {
    if (t.startsWith('xpath=')) return document.evaluate(t.slice(6), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (t.startsWith('css=')) return document.querySelector(t.slice(4));
    return null;
  }
  function ti(el, v) {
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Find the "Ground" panel's "Visible" checkbox and make sure it is UNCHECKED (never toggles it back on)
  async function ensureGroundHidden() {
    const fld = [...document.querySelectorAll('.tp-fldv')].find(f =>
      (f.querySelector(':scope > .tp-fldv_b .tp-fldv_t')?.textContent || '').trim() === 'Ground');
    const row = fld && [...fld.querySelectorAll('.tp-lblv')].find(l =>
      (l.querySelector('.tp-lblv_l')?.textContent || '').trim() === 'Visible');
    const input = row?.querySelector('input[type="checkbox"]');
    if (!input) return false;
    if (input.checked) {
      (input.closest('label') || input).click();
      await sleep(150);
      if (input.checked) {               // fallback if the click didn't take
        input.checked = false;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return true;
  }

  async function runCmds(cmds, label, delay) {
    const tt = toast(label + ' starting...');
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      tt.textContent = `${label} step ${i + 1}/${cmds.length}: ${cmd.type}...`;
      await sleep(delay);
      if (cmd.type === 'groundOff') {
        if (!await ensureGroundHidden()) { tt.textContent = `${label}: Ground "Visible" not found, skipping`; await sleep(delay); }
        continue;
      }
      const el = res(cmd.target);
      if (!el) { tt.textContent = `${label} step ${i + 1}: not found, skipping`; await sleep(delay); continue; }
      if (cmd.type === 'click') el.click();
      else if (cmd.type === 'type') { el.focus(); ti(el, cmd.value); }
      else if (cmd.type === 'uncheck') {
        const lb = el.closest('label') || el.parentElement;
        const inp = lb?.querySelector('input[type="checkbox"]');
        if (!inp || inp.checked) (lb || el).click();   // only click if currently checked
      }
    }
    return tt;
  }

  const TP = 'xpath=//*[@id="tweakpaneUiContainer"]/div/div[2]';
  const OPEN_CAM = { type: 'click', target: 'xpath=//*[@id="editor-tabs"]/div[2]/div/div/div/div/div[33]/div/div/img' };
  const CAMERA_CMDS = [
    { type: 'type', target: TP + '/div[3]/div[2]/div/div[2]/div/div[3]/div/input', value: '75' },
    { type: 'type', target: TP + '/div[3]/div[2]/div[3]/div[2]/div/div[2]/div/input', value: '1.8' },
    { type: 'type', target: TP + '/div[3]/div[2]/div/div[2]/div/div/div/input', value: '0' },
    { type: 'type', target: TP + '/div[3]/div[2]/div/div[2]/div/div[2]/div/input', value: '0' },
    { type: 'type', target: TP + '/div[3]/div[2]/div[2]/div[2]/div/div/div/input', value: '0' },
    { type: 'type', target: TP + '/div[3]/div[2]/div[2]/div[2]/div/div[2]/div/input', value: '0' },
    { type: 'type', target: TP + '/div[3]/div[2]/div[2]/div[2]/div/div[3]/div/input', value: '0' },
  ];

  async function runRenderPreset() {
    const cmds = [
      OPEN_CAM,
      { type: 'type', target: TP + '/div[6]/div[2]/div[5]/div[2]/div/div[2]/div/input', value: '5' },
      { type: 'groundOff' },   // Ground > Visible always OFF
      { type: 'type', target: TP + '/div[2]/div[2]/div[4]/div[2]/div/div[2]/div/input', value: '3' },
      ...CAMERA_CMDS,
      { type: 'type', target: TP + '/div[12]/div[2]/div[2]/div[2]/div/div[2]/div/input', value: '.1' },
    ];
    const tt = await runCmds(cmds, 'Render', 600);
    await ensureGroundHidden();   // final safety check
    tt.style.background = '#1a6e3c'; tt.textContent = 'Done! Opening Hierarchy Helper...';
    setTimeout(() => tt.remove(), 3000);
    setTimeout(() => runHierarchy(true), 700);
  }

  async function runCameraReset() {
    const tt = await runCmds([OPEN_CAM, ...CAMERA_CMDS], 'Camera', 500);
    tt.style.background = '#1a6e3c'; tt.textContent = 'Camera reset done.';
    setTimeout(() => tt.remove(), 2500);
  }

  function runHierarchy(auto = false) {
    const root = document.querySelector('#tpHierarchyContainer');
    if (!root) {
      if (auto) toast('Hierarchy panel not open. Open Hierarchy panel first, then Apply Render Preset.', '#92400e');
      else alert('Hierarchy container not found. Please open Hierarchy panel first.');
      return;
    }
    document.querySelector('#tp-hierarchy-helper')?.remove();
    document.querySelector('#tph-style')?.remove();
    const box = document.createElement('div');
    box.id = 'tp-hierarchy-helper';
    box.style.cssText = 'position:sticky;top:0;z-index:999999;background:#111;color:#fff;padding:10px;margin:6px;border:1px solid #444;border-radius:8px;font:12px Arial;box-shadow:0 4px 12px rgba(0,0,0,.35)';
    box.innerHTML = '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;"><b style="font-size:13px;">Hierarchy Helper</b><button id="tph-close" style="margin-left:auto;">×</button></div><input id="tph-search" placeholder="Search object name e.g. mesh / otherview" style="width:100%;box-sizing:border-box;padding:6px;border-radius:5px;border:1px solid #555;margin-bottom:8px;"><div style="display:flex;gap:6px;margin-bottom:8px;"><button id="tph-show-search">Show Search</button><button id="tph-hide-search">Hide Search</button><button id="tph-clear">Clear</button></div><div id="tph-groups"></div>';
    root.prepend(box);
    const css = document.createElement('style'); css.id = 'tph-style';
    css.textContent = '#tp-hierarchy-helper button{background:#2d2d2d;color:#fff;border:1px solid #666;border-radius:5px;padding:4px 7px;cursor:pointer;font-size:11px}#tp-hierarchy-helper button:hover{background:#444}.tph-hit>.treejs-label{background:#ffe66d!important;color:#000!important;border-radius:4px;padding:1px 4px}';
    document.head.appendChild(css);

    const getNodes = () => [...root.querySelectorAll('.treejs-node')].filter(n => n.querySelector(':scope > .treejs-label') && n.querySelector(':scope > .treejs-checkbox'));
    const getName = n => (n.querySelector(':scope > .treejs-label')?.textContent || '').trim();
    const baseName = name => name.replace(/[_\-\s]*\d+$/, '').replace(/[_\-\s]*v\d+$/i, '').trim() || name;
    const clickIf = (node, want) => { if (isOn(node) !== want) node.querySelector(':scope > .treejs-checkbox')?.click(); };
    const highlight = nodes => { getNodes().forEach(n => n.classList.remove('tph-hit')); nodes.forEach(n => n.classList.add('tph-hit')); };
    const groupWrap = box.querySelector('#tph-groups');
    const groupStatus = nodes => {
      const on = nodes.filter(isOn).length;
      if (on === nodes.length) return { text: 'ON', bg: '#dcfce7', color: '#166534' };
      if (on === 0) return { text: 'OFF', bg: '#fee2e2', color: '#991b1b' };
      return { text: 'MIXED', bg: '#fef3c7', color: '#92400e' };
    };
    const refreshGroupStatuses = () => {
      box.querySelectorAll('[data-tph-key]').forEach(row => {
        const nodes = (window.__tphGroups || {})[row.dataset.tphKey] || [];
        const st = groupStatus(nodes), b = row.querySelector('[data-tph-status]');
        if (b) { b.textContent = st.text; b.style.background = st.bg; b.style.color = st.color; }
      });
    };
    const groups = {};
    getNodes().forEach(n => { const name = getName(n); if (name) (groups[baseName(name)] ??= []).push(n); });
    window.__tphGroups = groups;
    Object.entries(groups).sort((a, b) => b[1].length - a[1].length).forEach(([key, nodes]) => {
      const st = groupStatus(nodes);
      const row = document.createElement('div');
      row.dataset.tphKey = key;
      row.style.cssText = 'display:flex;align-items:center;gap:5px;margin:5px 0;padding:5px;background:#1b1b1b;border-radius:6px;';
      row.innerHTML = '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span><span data-tph-status style="font-size:10px;font-weight:800;border-radius:999px;padding:3px 7px;min-width:42px;text-align:center"></span><button data-act="on">On</button><button data-act="off">Off</button><button data-act="hi">Find</button>';
      row.firstElementChild.innerHTML = `${key.replace(/</g, '&lt;')} <small style="color:#aaa;">(${nodes.length})</small>`;
      const s = row.querySelector('[data-tph-status]'); s.textContent = st.text; s.style.background = st.bg; s.style.color = st.color;
      row.querySelector('[data-act="on"]').onclick = () => { nodes.forEach(n => clickIf(n, true)); setTimeout(refreshGroupStatuses, 180); };
      row.querySelector('[data-act="off"]').onclick = () => { nodes.forEach(n => clickIf(n, false)); setTimeout(refreshGroupStatuses, 180); };
      row.querySelector('[data-act="hi"]').onclick = () => highlight(nodes);
      groupWrap.appendChild(row);
    });
    const q = () => box.querySelector('#tph-search').value.trim().toLowerCase();
    box.querySelector('#tph-search').addEventListener('input', () => { const v = q(); highlight(v ? getNodes().filter(n => getName(n).toLowerCase().includes(v)) : []); });
    box.querySelector('#tph-show-search').onclick = () => { const v = q(); if (!v) return alert('Type search text first'); getNodes().filter(n => getName(n).toLowerCase().includes(v)).forEach(n => clickIf(n, true)); };
    box.querySelector('#tph-hide-search').onclick = () => { const v = q(); if (!v) return alert('Type search text first'); getNodes().filter(n => getName(n).toLowerCase().includes(v)).forEach(n => clickIf(n, false)); };
    box.querySelector('#tph-clear').onclick = () => { box.querySelector('#tph-search').value = ''; highlight([]); };
    box.querySelector('#tph-close').onclick = () => { box.remove(); css.remove(); };
  }

  async function runLogoSearch() {
    const fireClick = el => {
      if (!el) return false;
      try {
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const topEl = document.elementFromPoint(x, y) || el;
        ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type =>
          topEl.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })));
        return true;
      } catch (e) { try { el.click(); return true; } catch (e2) { return false; } }
    };
    const clickSafe = el => { try { el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); } catch (e) {} return fireClick(el); };
    const ensureChecked = sel => {
      const input = document.querySelector(sel);
      if (!input || input.checked) return !!input;
      clickSafe(input.closest('label') || input.parentElement || input);
      setTimeout(() => {
        if (!input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 120);
      return true;
    };
    const waitFor = async (fn, timeout = 9000, delay = 300) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) { const r = fn(); if (r) return r; await sleep(delay); }
      return null;
    };
    const isBrandingOpen = () => [...document.querySelectorAll('p,h1,h2,h3,div,span')].find(el => {
      if ((el.textContent || '').trim().toLowerCase() !== 'branding') return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    });

    if (document.getElementById('aro-logo-search-panel')) { document.getElementById('aro-logo-search-panel').remove(); return; }

    if (!isBrandingOpen()) {
      const tab = await waitFor(() => document.querySelector('button[data-key="branding"],button[id$="-tab-branding"],button[aria-controls$="-tabpanel-branding"],button[role="tab"][data-key="branding"]'), 5000, 250);
      if (!tab) return alert('Branding sidebar tab not found.');
      clickSafe(tab);
      if (!await waitFor(isBrandingOpen, 7000, 250)) return alert('Branding panel did not open. Please click Branding once manually, then try again.');
      await sleep(700);
    } else {
      const bt = toast('Branding already open. Logo search starting...', '#1f2937');
      setTimeout(() => bt.remove(), 1200);
      await sleep(350);
    }
    ensureChecked("#enable input[type='checkbox']");
    await sleep(400);
    ensureChecked("#isPreview input[type='checkbox']");

    const imgs = await waitFor(() => {
      const list = [...document.querySelectorAll('img')].filter(img => (img.getAttribute('src') || img.getAttribute('data-src') || '').includes('/files/'));
      return list.length ? list : null;
    }, 9000, 300);
    if (!imgs) return alert('No branding logo images found. Branding opened, but logos may still be loading.');

    if (!document.getElementById('aro-logo-search-style')) {
      const st = document.createElement('style'); st.id = 'aro-logo-search-style';
      st.textContent = '.aro-logo-force-highlight{outline:4px solid #2563eb!important;outline-offset:5px!important;border-radius:10px!important;box-shadow:0 0 0 6px rgba(37,99,235,.18)!important;z-index:999998!important;position:relative!important}.aro-logo-row:hover{background:#f8fafc!important}';
      document.head.appendChild(st);
    }
    const items = imgs.map((img, i) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      const file = (src.split('/files/')[1] || src).split('?')[0].split('/').pop() || '';
      let name = file.replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '').replace(/_[a-f0-9]{8,}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      name = name.replace(/\b\w/g, c => c.toUpperCase());
      const trigger = img.closest('[data-slot="trigger"]') || img.closest('button') || img.closest('a') || img.closest('label') ||
        img.closest("[role='button']") || img.closest("[role='tab']") || img.closest('[tabindex]') || img.parentElement || img;
      return { name: name || 'Logo ' + (i + 1), src, trigger, img, index: i };
    });

    const wrap = document.createElement('div');
    wrap.id = 'aro-logo-search-panel';
    wrap.innerHTML = '<div style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;font-family:Inter,Arial,sans-serif"><div style="width:min(580px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(15,23,42,.25);overflow:hidden;border:1px solid #e5e7eb"><div style="padding:14px 16px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between;gap:10px"><div><div style="font-size:15px;font-weight:700;color:#111827">Search Branding Logo</div><div id="aro-logo-count" style="font-size:12px;color:#6b7280;margin-top:2px"></div></div><button id="aro-logo-close" style="border:0;background:#f3f4f6;border-radius:10px;padding:7px 10px;cursor:pointer;font-size:13px;color:#111827">Close</button></div><div style="padding:12px 14px"><input id="aro-logo-search-input" placeholder="Type customer / brand name..." style="width:100%;height:42px;border:1px solid #d1d5db;border-radius:12px;padding:0 12px;font-size:14px;outline:none;box-sizing:border-box"><div id="aro-logo-results" style="max-height:420px;overflow:auto;margin-top:10px;border:1px solid #eef0f3;border-radius:12px"></div></div></div></div>';
    document.body.appendChild(wrap);
    const input = wrap.querySelector('#aro-logo-search-input'), results = wrap.querySelector('#aro-logo-results'), count = wrap.querySelector('#aro-logo-count');
    let hlTimer = null;
    const clearHL = () => { document.querySelectorAll('.aro-logo-force-highlight').forEach(el => el.classList.remove('aro-logo-force-highlight')); clearTimeout(hlTimer); };
    const highlightItem = item => {
      clearHL();
      const target = item.trigger || item.img;
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setTimeout(() => {
        target.classList.add('aro-logo-force-highlight'); item.img.classList.add('aro-logo-force-highlight');
        try { target.focus?.({ preventScroll: true }); } catch (e) {}
        setTimeout(() => fireClick(target), 350);
        hlTimer = setTimeout(clearHL, 3000);
      }, 500);
    };
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const render = q => {
      q = (q || '').toLowerCase().trim();
      const list = items.filter(x => x.name.toLowerCase().includes(q));
      count.textContent = q ? `${list.length} matched out of ${items.length} logos` : `${items.length} logos found`;
      if (!list.length) { results.innerHTML = '<div style="padding:18px;text-align:center;color:#6b7280;font-size:13px">No logo found</div>'; return; }
      results.innerHTML = list.map(x => `<div class="aro-logo-row" data-i="${x.index}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:pointer;border-bottom:1px solid #f1f3f5"><div style="width:64px;height:42px;flex:0 0 64px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px"><img src="${esc(x.src)}" style="max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;display:block"></div><div style="flex:1;min-width:0"><div style="font-size:14px;color:#111827;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.name)}</div><div style="font-size:11px;color:#6b7280;margin-top:1px">Click to scroll, highlight & auto select</div></div></div>`).join('');
    };
    const closeWrap = () => { wrap.remove(); document.removeEventListener('keydown', onEsc); };
    const onEsc = e => { if (e.key === 'Escape') closeWrap(); };
    render(''); input.focus();
    input.addEventListener('input', e => render(e.target.value));
    results.addEventListener('click', e => {
      const row = e.target.closest('.aro-logo-row'); if (!row) return;
      const item = items.find(x => String(x.index) === row.dataset.i); if (!item) return;
      closeWrap(); setTimeout(() => highlightItem(item), 100);
    });
    wrap.querySelector('#aro-logo-close').onclick = closeWrap;
    wrap.addEventListener('click', e => { if (e.target === wrap.firstElementChild) closeWrap(); });
    document.addEventListener('keydown', onEsc);
  }

  /* ---------- open a right-sidebar tab + expand one of its folders ---------- */
  const fireTab = el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t =>
      el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t,
        { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, pointerType: 'mouse', isPrimary: true })));
  };
  async function openPanel(tabKey, folderTitle) {
    const tab = document.querySelector(`button[role="tab"][data-key="${tabKey}"]`);
    if (!tab) { toast(`"${tabKey}" tab not found`, '#92400e'); return null; }
    if (tab.getAttribute('aria-selected') !== 'true') { fireTab(tab); await sleep(500); }
    let fb = null;
    for (let i = 0; i < 20 && !fb; i++) {
      fb = [...document.querySelectorAll('.tp-fldv_b')].find(b =>
        b.getBoundingClientRect().width > 0 && b.querySelector('.tp-fldv_t')?.firstChild?.textContent.trim() === folderTitle);
      if (!fb) await sleep(200);
    }
    if (!fb) { toast(`"${folderTitle}" panel not found`, '#92400e'); return null; }
    const f = fb.closest('.tp-fldv');
    if (!f.classList.contains('tp-fldv-expanded')) { fb.click(); await sleep(350); }
    fb.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return f;
  }
  async function openHierarchy() {
    if (!await openPanel('Picking', 'Hierarchy')) return;
    for (let i = 0; i < 15 && !document.querySelector('#tpHierarchyContainer'); i++) await sleep(200);
    runHierarchy(false); // same Hierarchy Helper as the Quick Tools bookmarklet
  }

  /* =====================================================================
     3) BOX SELECT
     ===================================================================== */
  let boxActive = false;
  const setBoxActive = v => {
    boxActive = v;
    document.querySelector('#cc-topbar [data-k="box"]')?.classList.toggle('cc-on', v);
    if (window.__boxSel) window.__boxSel.canvas.style.cursor = v ? 'crosshair' : '';
  };

  window.addEventListener('keydown', e => {
    if (!window.__boxSel) return;
    if (e.target.matches?.('input,textarea,select,[contenteditable],[contenteditable] *')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'b' || e.key === 'B') setBoxActive(!boxActive);
    if (e.key === 'Escape') setBoxActive(false);
  });

  function installBox(vw) {
    if (window.__boxSel) window.__boxSel.destroy();
    const pk = vw.plugins.Picking.picker, canvas = vw._canvas;
    let start = null, rectEl = null, last = null;
    const stop = e => { e.stopImmediatePropagation(); e.stopPropagation(); };

    const down = e => {
      if (!boxActive || e.button !== 0 || start) return; stop(e);
      start = { x: e.clientX, y: e.clientY, r: canvas.getBoundingClientRect(), add: e.shiftKey, sub: e.ctrlKey || e.metaKey };
      last = { x: e.clientX, y: e.clientY };
      rectEl = document.createElement('div');
      Object.assign(rectEl.style, { position: 'fixed', pointerEvents: 'none', zIndex: 9999, border: '1px solid #2563eb', background: 'rgba(37,99,235,.12)' });
      document.body.appendChild(rectEl);
    };
    const move = e => {
      if (!start) return; stop(e); last = { x: e.clientX, y: e.clientY };
      const cross = e.clientX < start.x;
      Object.assign(rectEl.style, {
        left: Math.min(start.x, e.clientX) + 'px', top: Math.min(start.y, e.clientY) + 'px',
        width: Math.abs(e.clientX - start.x) + 'px', height: Math.abs(e.clientY - start.y) + 'px',
        borderStyle: cross ? 'dashed' : 'solid', borderColor: cross ? '#16a34a' : '#2563eb',
        background: cross ? 'rgba(22,163,74,.12)' : 'rgba(37,99,235,.12)'
      });
    };
    const up = e => {
      if (!start) return; stop(e);
      const s = start; start = null; rectEl.remove();
      const ex = e.clientX ?? last.x, ey = e.clientY ?? last.y;
      const x1 = Math.min(s.x, ex), x2 = Math.max(s.x, ex), y1 = Math.min(s.y, ey), y2 = Math.max(s.y, ey);
      if (x2 - x1 < 4 && y2 - y1 < 4) return;
      const crossing = ex < s.x, ac = vw.scene.activeCamera, cam = ac.cameraObject || ac, r = s.r, hits = [];
      cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      vw.scene.modelRoot.traverse(o => {
        if (!o.isMesh) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox, V = b.min.constructor;
        let inAll = true, inAny = false, front = false;
        for (let i = 0; i < 8; i++) {
          const v = new V(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld).project(cam);
          const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height, z = v.z < 1 && v.z > -1;
          if (z) front = true;
          const inside = z && sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2;
          inAll = inAll && inside; inAny = inAny || inside;
        }
        if (front && (crossing ? inAny : inAll)) hits.push(o);
      });
      let sel = hits;
      if (s.add) sel = [...new Set([...pk.selectedObjects, ...hits])];
      else if (s.sub) sel = pk.selectedObjects.filter(o => !hits.includes(o));
      pk.setSelected(sel.length ? sel : null); vw.setDirty();
    };

    const L = [[canvas, 'pointerdown', down], [canvas, 'mousedown', down], [window, 'pointermove', move], [window, 'mousemove', move], [window, 'pointerup', up], [window, 'mouseup', up], [window, 'pointercancel', up]];
    L.forEach(([t, n, f]) => t.addEventListener(n, f, true));
    window.__boxSel = {
      viewer: vw, canvas,
      destroy() { L.forEach(([t, n, f]) => t.removeEventListener(n, f, true)); canvas.style.cursor = ''; window.__boxSel = null; }
    };
    setBoxActive(boxActive);
  }

  setInterval(() => {
    const vw = window.webGiViewers && window.webGiViewers[0];
    const ok = vw && vw._canvas && vw._canvas.isConnected && vw.plugins?.Picking?.picker && vw.scene?.modelRoot;
    if (!ok) { if (window.__boxSel) window.__boxSel.destroy(); return; }
    if (!window.__boxSel || window.__boxSel.viewer !== vw || window.__boxSel.canvas !== vw._canvas) installBox(vw);
  }, 1000);

  /* =====================================================================
     TOP BAR
     ===================================================================== */
  const BUTTONS = [
    ['show',   'Show all',       'Show every item in Picking',          () => { const t = tree(); t && applyAll(leaves(t), true); }],
    ['hide',   'Hide all',       'Hide every item in Picking',          () => { const t = tree(); t && applyAll(leaves(t), false); }],
    ['hsel',   'Hide selected',  'Orange marks (Ctrl+click in Picking); if none, the blue picks', () => { const t = tree(); t && applyAll(selected(t), false); }],
    ['ssel',   'Show selected',  'Orange marks (Ctrl+click in Picking); if none, the blue picks', () => { const t = tree(); t && applyAll(selected(t), true); }],
    ['clear',  'Clear',          'Clear orange marks',                  () => { const t = tree(); t?.querySelectorAll('li.cc-sel').forEach(li => li.classList.remove('cc-sel')); refreshCount(); }],
    '|',
    ['render', 'Render Preset',  'Auto set camera/render values (Ground hidden) + open Hierarchy Helper', runRenderPreset],
    ['camera', 'Reset Camera',   'Only reset camera/focal/rotation values', runCameraReset],
    ['logo',   'Logo Search',    'Open Branding tab and search logos',  runLogoSearch],
    '|',
    ['hier',   'Hierarchy',      'Open Hierarchy Helper (from your Quick Tools code)', openHierarchy],
    '|',
    ['box',    '▭ Box Select',   'B = toggle, Esc = off. L→R window, R→L crossing. Shift add, Ctrl remove.', () => setBoxActive(!boxActive)],
  ];

  function buildBar(openBtn) {
    const bar = document.createElement('div');
    bar.id = 'cc-topbar';
    BUTTONS.forEach(b => {
      if (b === '|') { const d = document.createElement('span'); d.className = 'cc-div'; bar.appendChild(d); return; }
      const [k, text, tip, fn] = b;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.dataset.k = k; btn.textContent = text; btn.title = tip;
      btn.addEventListener('click', e => { e.stopPropagation(); fn(); });
      bar.appendChild(btn);
    });
    openBtn.parentElement.insertBefore(bar, openBtn);
    refreshCount(); setBoxActive(boxActive);
  }

  const ensure = () => {
    const openBtn = [...document.querySelectorAll('button,a')].find(el => {
      if (el.textContent.trim() !== 'Open in View') return false;
      const r = el.getBoundingClientRect(); return r.width > 0 && r.top < 120;
    });
    if (!openBtn) return;
    const bar = document.getElementById('cc-topbar');
    if (bar && bar.nextElementSibling === openBtn) return;
    if (bar) { openBtn.parentElement.insertBefore(bar, openBtn); refreshCount(); }
    else buildBar(openBtn);
  };
  let pending = false;
  new MutationObserver(() => { if (!pending) { pending = true; setTimeout(() => { pending = false; ensure(); }, 300); } })
    .observe(document.body, { childList: true, subtree: true });
  setInterval(ensure, 1500);
  ensure();
})();
