
(function () {
    'use strict';

    const IDS = {
        root: 'ijewel-tools-root-v41',
        floating: 'ijewel-tools-floating-v41',
        compareModal: 'ijewel-compare-modal-v41',
        inputPanel: 'ijewel-input-panel-v41',
        input: 'ijewel-input-v41',
        message: 'ijewel-message-v41',
        leftFrame: 'ijewel-left-frame-v41',
        rightFrame: 'ijewel-right-frame-v41'
    };

    let mountTimer = null;

    function isIJewelFilePage() {
        return /\/drive\/files\/[^/]+\/(?:view|playground)\/?$/i.test(location.pathname);
    }

    function normalizeIJewelUrl(rawUrl) {
        if (!rawUrl) return null;

        let text = String(rawUrl).trim();
        if (!text) return null;

        if (text.startsWith('/')) {
            text = location.origin + text;
        } else if (!/^https?:\/\//i.test(text)) {
            text = 'https://' + text;
        }

        try {
            const url = new URL(text);

            const allowedHosts = new Set([
                'customdesign.ijewel3d.com',
                'drive.ijewel3d.com'
            ]);

            if (!allowedHosts.has(url.hostname)) {
                showMessage('Please paste a valid iJewel3D link.', 'error');
                return null;
            }

            if (!/\/drive\/files\/[^/]+(?:\/(?:view|playground))?\/?$/i.test(url.pathname)) {
                showMessage('This does not appear to be an iJewel3D file link.', 'error');
                return null;
            }

            // If only /drive/files/ID is pasted, default to /view
            const clean = url.pathname.replace(/\/+$/, '');
            if (!/\/(?:view|playground)$/i.test(clean)) {
                url.pathname = clean + '/view';
            }

            return url.toString();
        } catch (e) {
            showMessage('The pasted URL is not valid.', 'error');
            return null;
        }
    }

    function convertPageMode(urlString, mode) {
        try {
            const url = new URL(urlString, location.origin);
            let cleanPath = url.pathname.replace(/\/+$/, '');

            if (/\/(?:view|playground)$/i.test(cleanPath)) {
                cleanPath = cleanPath.replace(/\/(?:view|playground)$/i, '/' + mode);
            } else if (/\/drive\/files\/[^/]+$/i.test(cleanPath)) {
                cleanPath += '/' + mode;
            }

            url.pathname = cleanPath;
            return url.toString();
        } catch (e) {
            return urlString;
        }
    }

    function getCurrentMode() {
        return /\/playground\/?$/i.test(location.pathname) ? 'playground' : 'view';
    }

    function getCurrentFileUrl(mode) {
        return convertPageMode(location.href, mode || getCurrentMode());
    }

    function showMessage(message, type = 'success', duration = 6500) {
        document.getElementById(IDS.message)?.remove();

        const box = document.createElement('div');
        box.id = IDS.message;
        box.textContent = message;

        let bg = '#ecfdf5';
        let fg = '#065f46';
        let border = '#10b981';

        if (type === 'error') {
            bg = '#fef2f2';
            fg = '#991b1b';
            border = '#ef4444';
        } else if (type === 'warning') {
            bg = '#fffbeb';
            fg = '#92400e';
            border = '#f59e0b';
        }

        Object.assign(box.style, {
            position: 'fixed',
            top: '18px',
            right: '18px',
            zIndex: '2147483647',
            maxWidth: '430px',
            padding: '13px 15px',
            borderRadius: '10px',
            border: `1px solid ${border}`,
            background: bg,
            color: fg,
            font: '700 13px/1.45 Arial,sans-serif',
            whiteSpace: 'pre-line',
            boxShadow: '0 10px 30px rgba(0,0,0,.25)',
            cursor: 'pointer'
        });

        box.addEventListener('click', () => box.remove());
        document.body.appendChild(box);

        if (duration > 0) {
            setTimeout(() => box.isConnected && box.remove(), duration);
        }
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                Object.assign(ta.style, {
                    position: 'fixed',
                    left: '-99999px',
                    top: '-99999px'
                });
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                ta.remove();
                return ok;
            } catch (err) {
                return false;
            }
        }
    }

    function makeButton(text, bg, handler) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;

        Object.assign(b.style, {
            border: '0',
            borderRadius: '8px',
            padding: '8px 10px',
            minHeight: '36px',
            background: bg,
            color: '#fff',
            cursor: 'pointer',
            font: '700 12px/1.2 Arial,sans-serif',
            boxShadow: '0 2px 7px rgba(0,0,0,.16)',
            whiteSpace: 'nowrap'
        });

        b.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            handler(e);
        });

        return b;
    }

    function openCurrentPlayground() {
        location.href = getCurrentFileUrl('playground');
    }

    function openCurrentView() {
        location.href = getCurrentFileUrl('view');
    }

    async function incognitoHelper() {
        const ok = await copyText(location.href);

        if (ok) {
            showMessage(
                'Link copied.\nPress Ctrl + Shift + N, then Ctrl + V and Enter.',
                'warning',
                10000
            );
        } else {
            showMessage(
                'Chrome blocks opening Incognito directly. Open Incognito manually and paste this URL.',
                'warning',
                10000
            );
        }
    }

    function closeCompareModal() {
        document.getElementById(IDS.compareModal)?.remove();
        document.body.style.overflow = '';
    }

    function smallButton(text, handler) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        Object.assign(b.style, {
            border: '1px solid #475569',
            background: '#1f2937',
            color: '#fff',
            borderRadius: '6px',
            padding: '5px 8px',
            cursor: 'pointer',
            font: '600 11px Arial,sans-serif'
        });
        b.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            handler();
        });
        return b;
    }

    function makeFramePanel(titleText, url, frameId) {
        const panel = document.createElement('div');
        Object.assign(panel.style, {
            flex: '1 1 50%',
            minWidth: '0',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 10px',
            background: '#111827',
            color: '#fff',
            borderBottom: '1px solid #374151',
            font: '600 12px Arial,sans-serif'
        });

        const title = document.createElement('span');
        title.textContent = titleText;
        Object.assign(title.style, {
            marginRight: 'auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        });

        const frame = document.createElement('iframe');
        frame.id = frameId;
        frame.src = url;
        frame.allow = 'fullscreen; clipboard-read; clipboard-write';
        Object.assign(frame.style, {
            width: '100%',
            flex: '1 1 auto',
            border: '0',
            background: '#fff'
        });

        header.append(
            title,
            smallButton('View', () => frame.src = convertPageMode(frame.src, 'view')),
            smallButton('Playground', () => frame.src = convertPageMode(frame.src, 'playground')),
            smallButton('↗', () => window.open(frame.src, '_blank', 'noopener,noreferrer'))
        );

        panel.append(header, frame);
        return panel;
    }

    function openSideBySide(secondUrl) {
        closeCompareModal();

        const modal = document.createElement('div');
        modal.id = IDS.compareModal;

        Object.assign(modal.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2147483000',
            display: 'flex',
            flexDirection: 'column',
            background: '#111827',
            fontFamily: 'Arial,sans-serif'
        });

        const bar = document.createElement('div');
        Object.assign(bar.style, {
            minHeight: '54px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 12px',
            background: '#0f172a',
            color: '#fff'
        });

        const title = document.createElement('div');
        title.textContent = 'iJewel3D Compare';
        Object.assign(title.style, {
            marginRight: 'auto',
            fontWeight: '700'
        });

        const swap = makeButton('⇄ Swap', '#475569', () => {
            const left = document.getElementById(IDS.leftFrame);
            const right = document.getElementById(IDS.rightFrame);
            if (!left || !right) return;
            const tmp = left.src;
            left.src = right.src;
            right.src = tmp;
        });
        swap.style.width = 'auto';

        const tabs = makeButton('↗ Open Both Tabs', '#0369a1', () => {
            const left = document.getElementById(IDS.leftFrame);
            const right = document.getElementById(IDS.rightFrame);
            if (left) window.open(left.src, '_blank', 'noopener,noreferrer');
            if (right) setTimeout(() => window.open(right.src, '_blank', 'noopener,noreferrer'), 150);
        });
        tabs.style.width = 'auto';

        const close = makeButton('✕ Close', '#dc2626', closeCompareModal);
        close.style.width = 'auto';

        bar.append(title, swap, tabs, close);

        const area = document.createElement('div');
        Object.assign(area.style, {
            flex: '1 1 auto',
            minHeight: '0',
            display: 'flex',
            gap: '2px',
            overflow: 'hidden',
            background: '#475569'
        });

        area.append(
            makeFramePanel('Current File', getCurrentFileUrl(getCurrentMode()), IDS.leftFrame),
            makeFramePanel('Pasted File', secondUrl, IDS.rightFrame)
        );

        modal.append(bar, area);
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    function closeInput() {
        document.getElementById(IDS.inputPanel)?.remove();
    }

    function showCompareInput(root) {
        const existing = document.getElementById(IDS.inputPanel);
        if (existing) {
            document.getElementById(IDS.input)?.focus();
            return;
        }

        const panel = document.createElement('div');
        panel.id = IDS.inputPanel;

        Object.assign(panel.style, {
            marginTop: '8px',
            padding: '9px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            background: '#f8fafc'
        });

        const input = document.createElement('input');
        input.id = IDS.input;
        input.type = 'text';
        input.placeholder = 'Paste another iJewel3D link';

        Object.assign(input.style, {
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px',
            border: '1px solid #9ca3af',
            borderRadius: '7px',
            background: '#fff',
            color: '#111827',
            font: '12px Arial,sans-serif'
        });

        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            marginTop: '7px'
        });

        const cancel = makeButton('Cancel', '#6b7280', closeInput);
        const compare = makeButton('Open Compare', '#059669', () => {
            const url = normalizeIJewelUrl(input.value);
            if (!url) return;
            closeInput();
            openSideBySide(url);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') compare.click();
            if (e.key === 'Escape') closeInput();
        });

        row.append(cancel, compare);
        panel.append(input, row);
        root.appendChild(panel);

        setTimeout(() => input.focus(), 50);
    }

    function buildToolRoot() {
        const root = document.createElement('div');
        root.id = IDS.root;

        Object.assign(root.style, {
            boxSizing: 'border-box',
            padding: '8px',
            background: '#f8fafc',
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            fontFamily: 'Arial,sans-serif'
        });

        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px'
        });

        const modeButton = getCurrentMode() === 'playground'
            ? makeButton('👁 View', '#2563eb', openCurrentView)
            : makeButton('✏ Playground', '#2563eb', openCurrentPlayground);

        const compare = makeButton('◫ Compare', '#059669', () => showCompareInput(root));
        const incognito = makeButton('🕶 Incognito', '#374151', incognitoHelper);
        incognito.style.gridColumn = '1 / -1';

        grid.append(modeButton, compare, incognito);
        root.appendChild(grid);

        return root;
    }

    function findSidebarTarget() {
        // Old known selector
        const old = document.querySelector('#scrollable-content');
        if (old && old.getBoundingClientRect().width > 150) {
            return old;
        }

        // Common right-side panels / drawers
        const selectors = [
            '[role="dialog"]',
            '[class*="drawer"]',
            '[class*="sidebar"]',
            '[class*="side-panel"]',
            '[class*="panel"]',
            '[class*="details"]'
        ];

        const candidates = [];

        for (const sel of selectors) {
            document.querySelectorAll(sel).forEach(el => {
                const r = el.getBoundingClientRect();
                const style = getComputedStyle(el);

                if (
                    r.width >= 220 &&
                    r.width <= 520 &&
                    r.height >= 300 &&
                    r.right > innerWidth * 0.65 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                ) {
                    candidates.push({ el, r });
                }
            });
        }

        candidates.sort((a, b) => b.r.right - a.r.right || b.r.height - a.r.height);
        return candidates[0]?.el || null;
    }

    function mountFloating() {
        if (document.getElementById(IDS.floating)) return true;
        if (!document.body) return false;

        const wrap = document.createElement('div');
        wrap.id = IDS.floating;

        Object.assign(wrap.style, {
            position: 'fixed',
            right: '16px',
            bottom: '16px',
            zIndex: '2147482000',
            width: '260px'
        });

        wrap.appendChild(buildToolRoot());
        document.body.appendChild(wrap);
        return true;
    }

    function mountTools() {
        if (!isIJewelFilePage()) return false;

        const existingRoot = document.getElementById(IDS.root);
        if (existingRoot && existingRoot.isConnected) {
            return true;
        }

        document.getElementById(IDS.floating)?.remove();

        const target = findSidebarTarget();

        if (target) {
            const root = buildToolRoot();
            root.style.margin = '8px';

            // Put near the top but don't break the app
            try {
                target.insertBefore(root, target.children[1] || null);
            } catch (e) {
                target.prepend(root);
            }
            return true;
        }

        return mountFloating();
    }

    function scheduleMount() {
        if (mountTimer) clearTimeout(mountTimer);
        mountTimer = setTimeout(mountTools, 180);
    }

    // Initial
    scheduleMount();

    // SPA route / DOM changes
    const observer = new MutationObserver(scheduleMount);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // History API route changes
    const originalPushState = history.pushState;
    history.pushState = function () {
        const result = originalPushState.apply(this, arguments);
        setTimeout(scheduleMount, 50);
        return result;
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function () {
        const result = originalReplaceState.apply(this, arguments);
        setTimeout(scheduleMount, 50);
        return result;
    };

    window.addEventListener('popstate', scheduleMount);
    window.addEventListener('hashchange', scheduleMount);

    // Extra retry while app loads
    let tries = 0;
    const retry = setInterval(() => {
        tries++;
        mountTools();
        if (tries >= 30) clearInterval(retry);
    }, 1000);

    console.log('[iJewel3D Tools v4.1] loaded on:', location.href);
})(); 
