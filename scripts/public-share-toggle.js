(() => {
    'use strict';

    const ENTRY = '[data-test-id="file-entry"][data-chonky-file-id]';

    const cache = new Map();
    const working = new Set();

    let scannerBusy = false;
    let rescanTimer;

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    const visible = el =>
        !!el && el.getClientRects().length > 0;


    // =========================================================
    // FILE CHECK
    // =========================================================

    function fileName(entry) {

        const titled = [...entry.querySelectorAll('[title]')]
            .map(node => node.getAttribute('title') || '')
            .find(title => /\.glb$/i.test(title.trim()));

        return titled || (entry.textContent || '').trim();
    }


    function isSupportedFile(entry) {
        return /\.glb$/i.test(fileName(entry));
    }


    function removeFolderControl(entry) {

        entry
            .querySelectorAll('.ijewel-public-control')
            .forEach(control => control.remove());
    }


    // =========================================================
    // STYLE
    // =========================================================

    function addStyle() {

        if (document.querySelector('#ijewel-public-style')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'ijewel-public-style';

        style.textContent = `

            .ijewel-public-control {
                position:absolute;
                top:8px;
                left:8px;
                z-index:50;

                display:flex;
                align-items:center;
                gap:6px;

                padding:5px 7px;

                border-radius:999px;

                background:#fff;
                color:#596273;

                font:700 10px/1 Arial,sans-serif;

                box-shadow:0 2px 8px #0005;

                cursor:pointer;
                user-select:none;
            }

            .ijewel-public-control[data-state="public"] {
                color:#147a45;
            }

            .ijewel-public-control[data-state="error"] {
                color:#bd2929;
            }

            .ijewel-public-control[data-state="checking"] {
                color:#9a6500;
            }

            .ijewel-public-switch {
                position:relative;

                width:30px;
                height:17px;

                border-radius:99px;

                background:#9ba1aa;

                transition:.18s;
            }

            .ijewel-public-switch:after {
                content:"";

                position:absolute;

                width:13px;
                height:13px;

                left:2px;
                top:2px;

                border-radius:50%;

                background:white;

                box-shadow:0 1px 3px #0005;

                transition:.18s;
            }

            [data-state="public"] .ijewel-public-switch {
                background:#19a663;
            }

            [data-state="public"] .ijewel-public-switch:after {
                transform:translateX(13px);
            }

            [data-state="checking"] .ijewel-public-switch,
            [data-state="saving"] .ijewel-public-switch {
                background:#d59b29;

                animation:ijewelPulse .7s infinite alternate;
            }

            @keyframes ijewelPulse {
                to {
                    opacity:.5;
                }
            }

            #ijewel-share-scan {
                position:fixed;

                right:20px;
                bottom:20px;

                z-index:2147483646;

                border:0;
                border-radius:10px;

                padding:10px 14px;

                background:#5f63e8;
                color:#fff;

                font:700 13px Arial,sans-serif;

                box-shadow:0 3px 12px #0004;

                cursor:pointer;
            }

            #ijewel-share-scan:disabled {
                opacity:.65;
                cursor:wait;
            }

            body.ijewel-share-dialog-hidden [role="dialog"] {
                visibility:hidden!important;
                pointer-events:none!important;
            }

        `;

        document.head.appendChild(style);
    }


    // =========================================================
    // PUBLIC / PRIVATE CONTROL
    // =========================================================

    function stateControl(entry, state, label) {

        const host =
            entry.querySelector('[class*="previewContainer"]') ||
            entry;

        if (getComputedStyle(host).position === 'static') {
            host.style.position = 'relative';
        }

        let control =
            host.querySelector(':scope > .ijewel-public-control');


        if (!control) {

            control = document.createElement('div');

            control.className =
                'ijewel-public-control';

            control.setAttribute(
                'role',
                'switch'
            );

            control.innerHTML = `
                <span class="ijewel-public-switch"></span>
                <span class="ijewel-public-label"></span>
            `;


            for (const eventName of [
                'mousedown',
                'mouseup',
                'dblclick',
                'contextmenu'
            ]) {

                control.addEventListener(
                    eventName,
                    event => event.stopPropagation()
                );
            }


            control.addEventListener(
                'click',
                async event => {

                    event.preventDefault();
                    event.stopPropagation();

                    const current =
                        control.dataset.state;

                    if (
                        current === 'checking' ||
                        current === 'saving' ||
                        current === 'error'
                    ) {
                        return;
                    }

                    await setPublic(
                        entry,
                        current !== 'public'
                    );
                }
            );


            host.appendChild(control);
        }


        control.dataset.state = state;

        control.setAttribute(
            'aria-checked',
            state === 'public'
                ? 'true'
                : 'false'
        );


        control.title =
            state === 'public'
                ? 'Click to make private'
                : 'Click to make public';


        control
            .querySelector('.ijewel-public-label')
            .textContent = label;


        return control;
    }


    // =========================================================
    // WAIT FOR ELEMENT
    // =========================================================

    async function waitFor(
        selector,
        timeout = 7000
    ) {

        const end =
            Date.now() + timeout;


        while (Date.now() < end) {

            const element =
                [...document.querySelectorAll(selector)]
                    .find(visible);


            if (element) {
                return element;
            }


            await sleep(80);
        }


        throw new Error(
            `Timed out: ${selector}`
        );
    }


    // =========================================================
    // SHARE BUTTON
    // =========================================================

    function shareButton(entry) {

        const name = button =>
            /share/i.test(
                `${
                    button.getAttribute('aria-label') || ''
                } ${
                    button.title || ''
                } ${
                    button.textContent || ''
                }`
            );


        return (
            [...entry.querySelectorAll('button')]
                .find(
                    button =>
                        name(button) &&
                        visible(button)
                )
            ||
            [...document.querySelectorAll('button')]
                .find(
                    button =>
                        name(button) &&
                        visible(button) &&
                        !button.closest('[role="dialog"]')
                )
        );
    }


    // =========================================================
    // PUBLIC SWITCH
    // =========================================================

    function publicSwitch(dialog) {

        const switches = [
            ...dialog.querySelectorAll(
                '[role="switch"], input[type="checkbox"]'
            )
        ];


        return switches.find(sw => {

            let node = sw;


            for (
                let depth = 0;
                node && depth < 5;
                depth++,
                node = node.parentElement
            ) {

                if (
                    /public access|accessible to everyone|anyone with the link/i
                        .test(
                            `${
                                node.textContent || ''
                            } ${
                                node.title || ''
                            }`
                        )
                ) {
                    return true;
                }
            }


            return false;

        }) || switches[0];
    }


    function checked(sw) {

        return (
            sw.matches(':checked') ||
            sw.getAttribute('aria-checked') === 'true'
        );
    }


    // =========================================================
    // CLOSE SHARE DIALOG
    // =========================================================

    async function closeDialog(dialog) {

        const close =
            [...dialog.querySelectorAll('button')]
                .find(button =>
                    /close|dismiss/i.test(
                        `${
                            button.getAttribute('aria-label') || ''
                        } ${
                            button.title || ''
                        } ${
                            button.textContent || ''
                        }`
                    )
                );


        if (close) {

            close.click();

        } else {

            document.dispatchEvent(
                new KeyboardEvent(
                    'keydown',
                    {
                        key: 'Escape',
                        bubbles: true
                    }
                )
            );
        }


        for (
            let count = 0;
            count < 40 &&
            document.body.contains(dialog);
            count++
        ) {

            await sleep(60);
        }
    }


    // =========================================================
    // OPEN SHARE
    // =========================================================

    async function openShare(entry) {

        entry.click();

        await sleep(180);


        const button =
            shareButton(entry);


        if (!button) {

            throw new Error(
                'Share button not found'
            );
        }


        button.click();


        const dialog =
            await waitFor('[role="dialog"]');


        const sw =
            publicSwitch(dialog);


        if (!sw) {

            throw new Error(
                'Public Access switch not found'
            );
        }


        return {
            dialog,
            sw
        };
    }


    // =========================================================
    // READ PUBLIC STATUS
    // =========================================================

    async function readPublic(entry) {

        if (!isSupportedFile(entry)) {

            removeFolderControl(entry);

            return;
        }


        const id =
            entry.dataset.chonkyFileId;


        if (!id || working.has(id)) {
            return;
        }


        if (cache.has(id)) {

            const on =
                cache.get(id);


            stateControl(
                entry,
                on ? 'public' : 'private',
                on ? 'PUBLIC' : 'PRIVATE'
            );


            return;
        }


        working.add(id);


        stateControl(
            entry,
            'checking',
            'CHECKING'
        );


        try {

            const {
                dialog,
                sw
            } = await openShare(entry);


            const on =
                checked(sw);


            cache.set(
                id,
                on
            );


            stateControl(
                entry,
                on ? 'public' : 'private',
                on ? 'PUBLIC' : 'PRIVATE'
            );


            await closeDialog(dialog);


            entry.click();


        } catch (error) {

            console.warn(
                '[iJewel card toggle] Read failed',
                id,
                error
            );


            stateControl(
                entry,
                'error',
                'RETRY'
            );


            const dialog =
                [...document.querySelectorAll('[role="dialog"]')]
                    .find(visible);


            if (dialog) {
                await closeDialog(dialog);
            }


        } finally {

            working.delete(id);
        }
    }


    // =========================================================
    // CHANGE PUBLIC STATUS
    // =========================================================

    async function setPublic(
        entry,
        desired
    ) {

        if (!isSupportedFile(entry)) {

            removeFolderControl(entry);

            return;
        }


        const id =
            entry.dataset.chonkyFileId;


        if (!id || working.has(id)) {
            return;
        }


        working.add(id);


        document.body.classList.add(
            'ijewel-share-dialog-hidden'
        );


        stateControl(
            entry,
            'saving',
            desired
                ? 'MAKING PUBLIC'
                : 'MAKING PRIVATE'
        );


        try {

            const {
                dialog,
                sw
            } = await openShare(entry);


            if (checked(sw) !== desired) {

                sw.click();


                const end =
                    Date.now() + 5000;


                while (
                    Date.now() < end &&
                    checked(sw) !== desired
                ) {

                    await sleep(100);
                }


                if (checked(sw) !== desired) {

                    throw new Error(
                        'Share setting did not change'
                    );
                }


                await sleep(600);
            }


            cache.set(
                id,
                desired
            );


            stateControl(
                entry,
                desired
                    ? 'public'
                    : 'private',

                desired
                    ? 'PUBLIC'
                    : 'PRIVATE'
            );


            await closeDialog(dialog);


            entry.click();


        } catch (error) {

            console.error(
                '[iJewel card toggle] Save failed',
                id,
                error
            );


            cache.delete(id);


            stateControl(
                entry,
                'error',
                'RETRY'
            );


            const dialog =
                [...document.querySelectorAll('[role="dialog"]')]
                    .find(visible);


            if (dialog) {
                await closeDialog(dialog);
            }


        } finally {

            document.body.classList.remove(
                'ijewel-share-dialog-hidden'
            );


            working.delete(id);
        }
    }


    // =========================================================
    // SCAN CARDS
    // =========================================================

    async function scanVisible(
        force = false
    ) {

        if (scannerBusy) {
            return;
        }


        scannerBusy = true;


        document.body.classList.add(
            'ijewel-share-dialog-hidden'
        );


        const button =
            document.querySelector(
                '#ijewel-share-scan'
            );


        if (button) {

            button.disabled = true;

            button.textContent =
                'Checking…';
        }


        try {

            const allEntries = [
                ...document.querySelectorAll(ENTRY)
            ].filter(visible);


            allEntries
                .filter(
                    entry =>
                        !isSupportedFile(entry)
                )
                .forEach(
                    removeFolderControl
                );


            const entries =
                allEntries.filter(
                    isSupportedFile
                );


            if (force) {

                entries.forEach(entry =>
                    cache.delete(
                        entry.dataset.chonkyFileId
                    )
                );
            }


            for (const entry of entries) {

                await readPublic(entry);
            }


        } finally {

            document.body.classList.remove(
                'ijewel-share-dialog-hidden'
            );


            scannerBusy = false;


            if (button) {

                button.disabled = false;

                button.textContent =
                    'Refresh sharing';
            }
        }
    }


    // =========================================================
    // AUTO RESCAN
    // =========================================================

    function scheduleScan() {

        clearTimeout(rescanTimer);


        rescanTimer =
            setTimeout(
                () => scanVisible(false),
                500
            );
    }


    // =========================================================
    // REFRESH BUTTON
    // =========================================================

    function addRefreshButton() {

        if (
            document.querySelector(
                '#ijewel-share-scan'
            )
        ) {
            return;
        }


        const button =
            document.createElement('button');


        button.id =
            'ijewel-share-scan';


        button.textContent =
            'Refresh sharing';


        button.title =
            'Recheck sharing for all currently visible cards';


        button.addEventListener(
            'click',
            () => scanVisible(true)
        );


        document.body.appendChild(button);
    }


    // =========================================================
    // START
    // =========================================================

    function start() {

        console.log(
            '[HoBrothers] iJewel Public Share Toggle started'
        );


        addStyle();

        addRefreshButton();


        new MutationObserver(
            scheduleScan
        ).observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );


        setTimeout(
            () => scanVisible(false),
            1000
        );
    }


    if (document.readyState === 'loading') {

        document.addEventListener(
            'DOMContentLoaded',
            start,
            {
                once: true
            }
        );

    } else {

        start();
    }

})();
