// ==UserScript==
// @name         iJewel Individual Quick Tool Buttons
// @namespace    adhikaryarts
// @version      2.2.0
// @description  Shows individual iJewel tools beside Save, including a one-click camera angle preset.
// @match        https://customdesign.ijewel3d.com/*
// @match        https://drive.ijewel3d.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const HEADER_ACTIONS_ID = 'aro-individual-tools-header-actions';
    const HEADER_STYLE_ID = 'aro-individual-tools-header-style';

    const HEADER_TOOLS = [
        {
            id: 'aro-header-apply-preset',
            label: 'Apply Preset',
            title: 'Apply Render Preset',
            target: '#aro-render',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
            </svg>`
        },
        {
            id: 'aro-header-reset-camera',
            label: 'Reset Camera',
            title: 'Reset Camera Only',
            target: '#aro-camera',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12a8 8 0 1 0 2.35-5.65M4 5v5h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        },
        {
            id: 'aro-header-set-camera-angle',
            label: 'Set Camera',
            title: 'Set Camera Position, Target and Field of View',
            target: '#aro-camera-angle',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 8h11l3 3v5H4zM8 8l2-3h4l2 3M12 11v5M9.5 13.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        },
        {
            id: 'aro-header-hierarchy',
            label: 'Hierarchy',
            title: 'Open Hierarchy Helper',
            target: '#aro-hierarchy',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v4M6 19v-4h12v4M6 15v-3h12v3M9 5h6v4H9z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        },
        {
            id: 'aro-header-hide-range',
            label: 'Hide Range',
            title: 'Hide Parts By Range',
            target: '#aro-part-hide',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M7 12h10M10 17h4M18 15l3 3m0-3l-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`
        },
        {
            id: 'aro-header-hide-name',
            label: 'Hide Name',
            title: 'Hide Parts By Name',
            target: '#aro-part-name',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="5" stroke="currentColor" stroke-width="1.8"/>
                <path d="m14 14 5 5M5 19h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>`
        },
        {
            id: 'aro-header-search-logo',
            label: 'Search Logo',
            title: 'Search Branding Logo',
            target: '#aro-logo',
            icon: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 6h16v12H4zM7 9h4v4H7zM14 10h3M14 14h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`
        }
    ];

    function installHeaderStyles() {
        if (document.getElementById(HEADER_STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = HEADER_STYLE_ID;
        style.textContent = `
            #${HEADER_ACTIONS_ID} {
                display: inline-flex;
                align-items: center;
                flex-direction: row;
                gap: 6px;
                height: 100%;
                margin-left: 6px;
                white-space: nowrap;
                flex-shrink: 1;
                min-width: 0;
                overflow-x: auto;
                scrollbar-width: none;
            }

            #${HEADER_ACTIONS_ID}::-webkit-scrollbar {
                display: none;
            }

            #${HEADER_ACTIONS_ID} .aro-individual-tool-btn {
                height: 32px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 0 11px;
                border: 0;
                border-radius: 14px;
                background: rgb(99, 102, 241);
                color: #fff;
                font: 600 12px/1 Arial, sans-serif;
                cursor: pointer;
                white-space: nowrap;
                flex: 0 0 auto;
                box-shadow: none;
                transition: opacity .15s ease, transform .15s ease;
            }

            #${HEADER_ACTIONS_ID} .aro-individual-tool-btn:hover {
                opacity: .88;
            }

            #${HEADER_ACTIONS_ID} .aro-individual-tool-btn:active {
                transform: scale(.97);
            }

            #${HEADER_ACTIONS_ID} .aro-individual-tool-btn svg {
                width: 14px;
                height: 14px;
                flex: 0 0 14px;
            }

            @media (max-width: 1100px) {
                #${HEADER_ACTIONS_ID} {
                    gap: 4px;
                    max-width: 66vw;
                }

                #${HEADER_ACTIONS_ID} .aro-individual-tool-btn {
                    padding: 0 8px;
                    font-size: 11px;
                }
            }

            @media (max-width: 720px) {
                #${HEADER_ACTIONS_ID} {
                    max-width: 58vw;
                }

                #${HEADER_ACTIONS_ID} .aro-individual-tool-btn {
                    padding: 0 7px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function findVisibleSaveButton() {
        return [...document.querySelectorAll('button')].find(button => {
            const text = (button.textContent || '').trim();
            const rect = button.getBoundingClientRect();

            return (
                text === 'Save' &&
                rect.width > 0 &&
                rect.height > 0
            );
        });
    }

    function openMasterTools() {
        const old=document.getElementById("aro-master-tools");if(old){old.remove();document.getElementById("aro-master-tools-style")?.remove();return;}const st=document.createElement("style");st.id="aro-master-tools-style";st.textContent="#aro-master-tools button{cursor:pointer;border:0;border-radius:10px;padding:11px 12px;font:600 13px Arial;background:#111827;color:#fff;width:100%;text-align:left}#aro-master-tools button:hover{background:#374151}.aro-tool-small{font-size:11px;color:#6b7280;margin-top:3px;font-weight:400}";document.head.appendChild(st);const panel=document.createElement("div");panel.id="aro-master-tools";panel.innerHTML='<div style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;font-family:Arial,sans-serif"><div style="width:min(420px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;border:1px solid #e5e7eb"><div style="padding:14px 16px;border-bottom:1px solid #eef0f3;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:16px;font-weight:800;color:#111827">IJEWEL QUICK TOOLS</div><div style="font-size:12px;color:#6b7280;margin-top:2px">Individual tools are available in the page header</div></div><button id="aro-close" style="width:auto;background:#f3f4f6;color:#111827;padding:7px 10px;text-align:center">×</button></div><div style="padding:14px;display:grid;gap:10px"><button id="aro-render">Apply Render Preset<div class="aro-tool-small">Auto set camera/render values + auto open hierarchy helper</div></button><button id="aro-camera">Reset Camera Only<div class="aro-tool-small">Only reset camera/focal/rotation values</div></button><button id="aro-camera-angle">Set Camera Angle<div class="aro-tool-small">Position -15, 40, 20 · Target 0, -0.50, 0 · FOV 1.80</div></button><button id="aro-hierarchy">Open Hierarchy Helper<div class="aro-tool-small">Open helper only, without applying render preset</div></button><button id="aro-part-hide">Hide Parts By Range<div class="aro-tool-small">Example: Diamond_Round from 5 to 13</div></button><button id="aro-part-name">Hide Parts By Name<div class="aro-tool-small">Paste one or many names; partial matching supported</div></button><button id="aro-logo">Search Branding Logo<div class="aro-tool-small">Auto open Branding tab, wait logos, then search</div></button></div></div></div>';document.body.appendChild(panel);const close=()=>{panel.remove();document.getElementById("aro-master-tools-style")?.remove();};panel.querySelector("#aro-close").onclick=close;panel.firstElementChild.onclick=e=>{if(e.target===panel.firstElementChild)close();};document.addEventListener("keydown",function aroMasterEsc(e){if(e.key==="Escape"&&document.getElementById("aro-master-tools")){close();document.removeEventListener("keydown",aroMasterEsc);}});const sleep=t=>new Promise(r=>setTimeout(r,t));const toast=(msg,bg="#222")=>{let t=document.getElementById("aro-toast");if(!t){t=document.createElement("div");t.id="aro-toast";t.style.cssText="position:fixed;top:16px;right:16px;z-index:1000000;color:#fff;font:14px Arial;padding:10px 16px;border-radius:8px;max-width:360px;box-shadow:0 8px 30px rgba(0,0,0,.25)";document.body.appendChild(t);}t.style.background=bg;t.textContent=msg;return t;};function res(t){if(t.startsWith("xpath=")){var r=document.evaluate(t.slice(6),document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);return r.singleNodeValue}else if(t.startsWith("css=")){return document.querySelector(t.slice(4))}return null}function ti(el,v){if(!el)return;var ns=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;ns.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}function runRenderPreset(){close();var cmds=[{"type":"click","target":"xpath=//*[@id=\"editor-tabs\"]/div[2]/div/div/div/div/div[33]/div/div/img"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[6]/div[2]/div[5]/div[2]/div/div[2]/div/input","value":"5"},{"type":"uncheck","target":"css=#tweakpaneUiContainer > div > div.tp-brkv.tp-rotv_c > div:nth-child(15) > div.tp-brkv.tp-fldv_c > div.tp-lblv.tp-v-fst > div.tp-lblv_v > div > label > div > svg"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[2]/div[2]/div[4]/div[2]/div/div[2]/div/input","value":"3"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div/div[2]/div/div[3]/div/input","value":"75"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[3]/div[2]/div/div[2]/div/input","value":"1.8"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div/div[2]/div/div/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div/div[2]/div/div[2]/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[2]/div[2]/div/div/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[2]/div[2]/div/div[2]/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[2]/div[2]/div/div[3]/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[12]/div[2]/div[2]/div[2]/div/div[2]/div/input","value":".1"}];async function run(){var tt=toast("Render preset starting...");for(var i=0;i<cmds.length;i++){var cmd=cmds[i];tt.textContent="Step "+(i+1)+"/"+cmds.length+": "+cmd.type+"...";await sleep(600);var el=res(cmd.target);if(!el){tt.textContent="Step "+(i+1)+": not found, skipping";await sleep(700);continue}if(cmd.type==="click"){el.click()}else if(cmd.type==="type"){el.focus();ti(el,cmd.value)}else if(cmd.type==="uncheck"){var lb=el.closest("label")||el.parentElement;if(lb)lb.click();else el.click()}}tt.style.background="#1a6e3c";tt.textContent="Done! Opening Hierarchy Helper...";setTimeout(()=>tt.remove(),3000);setTimeout(()=>runHierarchy(true),700)}run()}function runCameraReset(){close();var cmds=[{"type":"click","target":"xpath=//*[@id=\"editor-tabs\"]/div[2]/div/div/div/div/div[33]/div/div/img"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div/div[2]/div/div[3]/div/input","value":"75"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[3]/div[2]/div/div[2]/div/input","value":"1.8"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div/div[2]/div/div/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div/div[2]/div/div[2]/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[2]/div[2]/div/div/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[2]/div[2]/div/div[2]/div/input","value":"0"},{"type":"type","target":"xpath=//*[@id=\"tweakpaneUiContainer\"]/div/div[2]/div[3]/div[2]/div[2]/div[2]/div/div[3]/div/input","value":"0"}];async function run(){var tt=toast("Reset camera starting...");for(var i=0;i<cmds.length;i++){var cmd=cmds[i];tt.textContent="Camera step "+(i+1)+"/"+cmds.length+"...";await sleep(500);var el=res(cmd.target);if(!el){tt.textContent="Camera step "+(i+1)+": not found, skipping";await sleep(500);continue}if(cmd.type==="click"){el.click()}else if(cmd.type==="type"){el.focus();ti(el,cmd.value)}}tt.style.background="#1a6e3c";tt.textContent="Camera reset done.";setTimeout(()=>tt.remove(),2500)}run()}function runCameraAnglePreset(){close();const values={position:["-15.00","40.00","20.00"],target:["0.00","-0.50","0.00"],fov:"1.80"};const norm=s=>(s||"").replace(/\s+/g," ").trim().toLowerCase();const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};const nativeSet=(el,value)=>{if(!el)return false;const proto=el.tagName==="INPUT"?window.HTMLInputElement.prototype:window.HTMLTextAreaElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set;if(setter)setter.call(el,value);else el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));el.blur();return true};const findRow=label=>{const wanted=norm(label);const candidates=[...document.querySelectorAll("#tweakpaneUiContainer *")].filter(el=>visible(el)&&norm(el.textContent)===wanted);for(const labelEl of candidates){let row=labelEl;for(let i=0;i<6&&row;i++,row=row.parentElement){const inputs=[...row.querySelectorAll("input")].filter(visible);if(inputs.length)return{row,inputs,labelEl}}}return null};const setVector=(label,vals)=>{const found=findRow(label);if(!found||found.inputs.length<3)return false;found.inputs.slice(0,3).forEach((input,i)=>nativeSet(input,vals[i]));return true};const setSingle=(label,val)=>{const found=findRow(label);if(!found||!found.inputs.length)return false;return nativeSet(found.inputs[found.inputs.length-1],val)};async function run(){const tt=toast("Setting camera angle...");const cameraTab=[...document.querySelectorAll("#tweakpaneUiContainer *")].find(el=>visible(el)&&norm(el.textContent)==="camera");if(cameraTab){const section=cameraTab.closest(".tp-brkv")||cameraTab.parentElement;if(section&&!section.classList.contains("tp-brkv_exp")){cameraTab.click();await sleep(300)}}const results=[setVector("Position",values.position),setVector("Target",values.target),setSingle("Field Of View",values.fov)];if(results.every(Boolean)){tt.style.background="#1a6e3c";tt.textContent="Camera set: Position -15, 40, 20 | Target 0, -0.50, 0 | FOV 1.80";}else{tt.style.background="#92400e";tt.textContent="Some camera fields were not found. Open Viewer > Camera and try again.";}setTimeout(()=>tt.remove(),3500)}run()}function runHierarchy(auto=false){const root=document.querySelector("#tpHierarchyContainer");if(!root){if(auto){toast("Hierarchy panel not open. Open Hierarchy panel first, then Apply Render Preset.","#92400e")}else{alert("Hierarchy container not found. Please open Hierarchy panel first.")}return}document.querySelector("#tp-hierarchy-helper")?.remove();document.querySelector("#tph-style")?.remove();const box=document.createElement("div");box.id="tp-hierarchy-helper";box.style.cssText="position:sticky;top:0;z-index:999999;background:#111;color:#fff;padding:10px;margin:6px;border:1px solid #444;border-radius:8px;font:12px Arial;box-shadow:0 4px 12px rgba(0,0,0,.35)";box.innerHTML='<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;"><b style="font-size:13px;">Hierarchy Helper</b><button id="tph-close" style="margin-left:auto;">×</button></div><input id="tph-search" placeholder="Search object name e.g. mesh / otherview" style="width:100%;box-sizing:border-box;padding:6px;border-radius:5px;border:1px solid #555;margin-bottom:8px;"><div style="display:flex;gap:6px;margin-bottom:8px;"><button id="tph-show-search">Show Search</button><button id="tph-hide-search">Hide Search</button><button id="tph-clear">Clear</button></div><div id="tph-groups"></div>';root.prepend(box);const css=document.createElement("style");css.id="tph-style";css.textContent="#tp-hierarchy-helper button{background:#2d2d2d;color:#fff;border:1px solid #666;border-radius:5px;padding:4px 7px;cursor:pointer;font-size:11px}#tp-hierarchy-helper button:hover{background:#444}.tph-hit>.treejs-label{background:#ffe66d!important;color:#000!important;border-radius:4px;padding:1px 4px}";document.head.appendChild(css);const getNodes=()=>[...root.querySelectorAll(".treejs-node")].filter(n=>n.querySelector(":scope > .treejs-label")&&n.querySelector(":scope > .treejs-checkbox"));const getName=n=>(n.querySelector(":scope > .treejs-label")?.textContent||"").trim();const baseName=name=>name.replace(/[_\-\s]*\d+$/,"").replace(/[_\-\s]*v\d+$/i,"").trim()||name;const clickIf=(node,wantChecked)=>{const checked=node.classList.contains("treejs-node__checked");if(checked!==wantChecked){node.querySelector(":scope > .treejs-checkbox")?.click()}};const highlight=nodes=>{getNodes().forEach(n=>n.classList.remove("tph-hit"));nodes.forEach(n=>n.classList.add("tph-hit"))};const groupWrap=document.querySelector("#tph-groups");const isOn=n=>n.classList.contains("treejs-node__checked");const groupStatus=nodes=>{const on=nodes.filter(isOn).length;if(on===nodes.length)return{text:"ON",bg:"#dcfce7",color:"#166534"};if(on===0)return{text:"OFF",bg:"#fee2e2",color:"#991b1b"};return{text:"MIXED",bg:"#fef3c7",color:"#92400e"}};const refreshGroupStatuses=()=>{document.querySelectorAll("[data-tph-key]").forEach(row=>{const nodes=(window.__tphGroups||{})[row.dataset.tphKey]||[];const st=groupStatus(nodes);const b=row.querySelector("[data-tph-status]");if(b){b.textContent=st.text;b.style.background=st.bg;b.style.color=st.color}})};const renderGroups=()=>{const groups={};getNodes().forEach(n=>{const name=getName(n);if(!name)return;const key=baseName(name);(groups[key]??=[]).push(n)});window.__tphGroups=groups;groupWrap.innerHTML="";Object.entries(groups).sort((a,b)=>b[1].length-a[1].length).forEach(([key,nodes])=>{const st=groupStatus(nodes);const row=document.createElement("div");row.dataset.tphKey=key;row.style.cssText="display:flex;align-items:center;gap:5px;margin:5px 0;padding:5px;background:#1b1b1b;border-radius:6px;";row.innerHTML='<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+key+' <small style="color:#aaa;">('+nodes.length+')</small></span><span data-tph-status style="font-size:10px;font-weight:800;border-radius:999px;padding:3px 7px;background:'+st.bg+';color:'+st.color+';min-width:42px;text-align:center">'+st.text+'</span><button data-act="on">On</button><button data-act="off">Off</button><button data-act="hi">Find</button>';row.querySelector('[data-act="on"]').onclick=()=>{nodes.forEach(n=>clickIf(n,true));setTimeout(refreshGroupStatuses,180)};row.querySelector('[data-act="off"]').onclick=()=>{nodes.forEach(n=>clickIf(n,false));setTimeout(refreshGroupStatuses,180)};row.querySelector('[data-act="hi"]').onclick=()=>highlight(nodes);groupWrap.appendChild(row)})};renderGroups();document.querySelector("#tph-search").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();if(!q){highlight([]);return}highlight(getNodes().filter(n=>getName(n).toLowerCase().includes(q)))});document.querySelector("#tph-show-search").onclick=()=>{const q=document.querySelector("#tph-search").value.trim().toLowerCase();if(!q)return alert("Type search text first");getNodes().filter(n=>getName(n).toLowerCase().includes(q)).forEach(n=>clickIf(n,true))};document.querySelector("#tph-hide-search").onclick=()=>{const q=document.querySelector("#tph-search").value.trim().toLowerCase();if(!q)return alert("Type search text first");getNodes().filter(n=>getName(n).toLowerCase().includes(q)).forEach(n=>clickIf(n,false))};document.querySelector("#tph-clear").onclick=()=>{document.querySelector("#tph-search").value="";highlight([])};document.querySelector("#tph-close").onclick=()=>{box.remove();document.querySelector("#tph-style")?.remove()}}function runPartRangeHider(){close();const root=document.querySelector("#tpHierarchyContainer");if(!root){alert("Hierarchy container not found. Please open Hierarchy panel first, then try Hide Parts By Range.");return}document.querySelector("#aro-part-range-hider")?.remove();document.querySelector("#aro-part-range-style")?.remove();const st=document.createElement("style");st.id="aro-part-range-style";st.textContent=".aro-part-range-highlight>.treejs-label{background:#fde68a!important;color:#111827!important;border-radius:4px;padding:1px 4px}.aro-part-range-btn{border:0;border-radius:9px;padding:9px 10px;font:700 12px Arial;cursor:pointer}.aro-part-range-btn:hover{filter:brightness(.95)}";document.head.appendChild(st);const wrap=document.createElement("div");wrap.id="aro-part-range-hider";wrap.innerHTML='<div style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;font-family:Arial,sans-serif"><div style="width:min(560px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;border:1px solid #e5e7eb"><div style="padding:14px 16px;border-bottom:1px solid #eef0f3;display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div style="font-size:16px;font-weight:800;color:#111827">Hide Parts By Range</div><div style="font-size:12px;color:#6b7280;margin-top:2px">Dynamic dropdown from numbered hierarchy names</div></div><button id="aro-range-close" style="border:0;background:#f3f4f6;color:#111827;border-radius:10px;padding:7px 10px;cursor:pointer">×</button></div><div style="padding:14px"><label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px">Part name group</label><div style="display:flex;gap:8px"><select id="aro-range-base-select" style="flex:1;height:42px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:0 10px;font:13px Arial;outline:none;background:#fff"></select><button id="aro-range-refresh" class="aro-part-range-btn" style="background:#e5e7eb;color:#111827;white-space:nowrap">Refresh</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><div><label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px">From</label><input id="aro-range-from" type="number" style="width:100%;height:40px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:0 10px;font:13px Arial;outline:none"></div><div><label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px">To</label><input id="aro-range-to" type="number" style="width:100%;height:40px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:0 10px;font:13px Arial;outline:none"></div></div><div id="aro-range-status" style="font-size:12px;color:#6b7280;margin-top:8px">Ready.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button id="aro-range-hide" class="aro-part-range-btn" style="background:#991b1b;color:#fff">Hide / Uncheck Range</button><button id="aro-range-show" class="aro-part-range-btn" style="background:#166534;color:#fff">Show / Check Range</button><button id="aro-range-find" class="aro-part-range-btn" style="background:#111827;color:#fff">Find / Highlight Range</button><button id="aro-range-clear" class="aro-part-range-btn" style="background:#e5e7eb;color:#111827">Clear Highlight</button></div><div style="font-size:11px;color:#6b7280;margin-top:10px;line-height:1.45">Example: if hierarchy has <b>Diamond_Round_5</b>, <b>Diamond_Round_6</b>, dropdown will show <b>Diamond_Round</b>. Then type range 5 to 13.</div></div></div></div>';document.body.appendChild(wrap);const select=wrap.querySelector("#aro-range-base-select"),fromEl=wrap.querySelector("#aro-range-from"),toEl=wrap.querySelector("#aro-range-to"),status=wrap.querySelector("#aro-range-status");let groups={};const html=x=>String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));const getNodes=()=>[...root.querySelectorAll(".treejs-node")].filter(n=>n.querySelector(":scope > .treejs-label")&&n.querySelector(":scope > .treejs-checkbox"));const getName=n=>(n.querySelector(":scope > .treejs-label")?.textContent||"").trim();const parsePart=name=>{let m=name.match(/^(.*?)[_\-\s]+0*(\d+)$/);if(!m)m=name.match(/^(.+?)(\d+)$/);if(!m)return null;let base=m[1].replace(/[_\-\s]+$/,"").trim();let num=parseInt(m[2],10);if(!base||Number.isNaN(num))return null;return{base,num}};const scanGroups=()=>{groups={};getNodes().forEach(node=>{const p=parsePart(getName(node));if(!p)return;(groups[p.base]??={nums:new Set(),items:[]}).nums.add(p.num);groups[p.base].items.push({node,num:p.num,name:getName(node)})});Object.values(groups).forEach(g=>{g.min=Math.min(...g.nums);g.max=Math.max(...g.nums);g.count=g.items.length})};const fillDropdown=(keep)=>{scanGroups();const keys=Object.keys(groups).sort((a,b)=>a.localeCompare(b));if(!keys.length){select.innerHTML='<option value="">No numbered groups found</option>';fromEl.value="";toEl.value="";status.textContent="No numbered hierarchy names found. Example needed: Diamond_Round_1.";status.style.color="#991b1b";return}select.innerHTML=keys.map(k=>'<option value="'+html(k)+'">'+html(k)+' ('+groups[k].min+'-'+groups[k].max+', '+groups[k].count+' parts)</option>').join("");if(keep&&groups[keep])select.value=keep;updateRangeFromSelect();status.textContent=keys.length+" dynamic part group(s) found.";status.style.color="#166534"};const updateRangeFromSelect=()=>{const g=groups[select.value];if(!g)return;fromEl.value=g.min;toEl.value=g.max};const isOn=n=>n.classList.contains("treejs-node__checked");const clickIf=(node,wantChecked)=>{if(isOn(node)!==wantChecked){node.querySelector(":scope > .treejs-checkbox")?.click()}};const rangeInfo=()=>{const base=select.value;let a=parseInt(fromEl.value,10),b=parseInt(toEl.value,10);if(!base||!groups[base]||Number.isNaN(a)||Number.isNaN(b))return null;if(a>b){const t=a;a=b;b=t}return{base,a,b}};const matches=()=>{const r=rangeInfo();if(!r)return[];return groups[r.base].items.filter(x=>x.num>=r.a&&x.num<=r.b).map(x=>x.node)};const clearHi=()=>getNodes().forEach(n=>n.classList.remove("aro-part-range-highlight"));const hi=list=>{clearHi();list.forEach(n=>n.classList.add("aro-part-range-highlight"));if(list[0]){try{list[0].scrollIntoView({behavior:"smooth",block:"center"})}catch(e){}}};const apply=want=>{const r=rangeInfo();if(!r){status.textContent="Please select group and enter From/To number.";status.style.color="#991b1b";return}const list=matches();if(!list.length){status.textContent="No matching parts found for "+r.base+" "+r.a+"-"+r.b+".";status.style.color="#991b1b";return}list.forEach(n=>clickIf(n,want));hi(list);status.textContent=(want?"Show/checked ":"Hide/unchecked ")+list.length+" part(s): "+r.base+" "+r.a+"-"+r.b+".";status.style.color=want?"#166534":"#991b1b"};select.onchange=updateRangeFromSelect;wrap.querySelector("#aro-range-refresh").onclick=()=>fillDropdown(select.value);wrap.querySelector("#aro-range-hide").onclick=()=>apply(false);wrap.querySelector("#aro-range-show").onclick=()=>apply(true);wrap.querySelector("#aro-range-find").onclick=()=>{const r=rangeInfo();if(!r){status.textContent="Please select group and enter From/To number.";status.style.color="#991b1b";return}const list=matches();if(!list.length){status.textContent="No matching parts found for "+r.base+" "+r.a+"-"+r.b+".";status.style.color="#991b1b";return}hi(list);status.textContent=list.length+" matching part(s) highlighted.";status.style.color="#111827"};wrap.querySelector("#aro-range-clear").onclick=()=>{clearHi();status.textContent="Highlight cleared.";status.style.color="#6b7280"};wrap.querySelector("#aro-range-close").onclick=()=>{clearHi();wrap.remove();document.querySelector("#aro-part-range-style")?.remove()};wrap.firstElementChild.onclick=e=>{if(e.target===wrap.firstElementChild){clearHi();wrap.remove();document.querySelector("#aro-part-range-style")?.remove()}};fillDropdown()}function runPartNameHider(){close();const root=document.querySelector("#tpHierarchyContainer");if(!root){alert("Hierarchy container not found. Please open Hierarchy panel first, then try Hide Parts By Name.");return}document.querySelector("#aro-part-name-hider")?.remove();document.querySelector("#aro-part-hide-style")?.remove();const st=document.createElement("style");st.id="aro-part-hide-style";st.textContent=".aro-part-force-highlight>.treejs-label{background:#fde68a!important;color:#111827!important;border-radius:4px;padding:1px 4px}.aro-part-hide-btn{border:0;border-radius:9px;padding:9px 10px;font:700 12px Arial;cursor:pointer}.aro-part-hide-btn:hover{filter:brightness(.95)}";document.head.appendChild(st);const wrap=document.createElement("div");wrap.id="aro-part-name-hider";wrap.innerHTML='<div style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;font-family:Arial,sans-serif"><div style="width:min(520px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;border:1px solid #e5e7eb"><div style="padding:14px 16px;border-bottom:1px solid #eef0f3;display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div style="font-size:16px;font-weight:800;color:#111827">Hide Parts By Name</div><div style="font-size:12px;color:#6b7280;margin-top:2px">Paste one or many part names. It will match partial names also.</div></div><button id="aro-part-close" style="border:0;background:#f3f4f6;color:#111827;border-radius:10px;padding:7px 10px;cursor:pointer">×</button></div><div style="padding:14px"><textarea id="aro-part-names" placeholder="Example:\nmesh\notherview\nstone_01\nor paste comma separated names" style="width:100%;height:140px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:12px;padding:10px;font:13px Arial;resize:vertical;outline:none"></textarea><div id="aro-part-status" style="font-size:12px;color:#6b7280;margin-top:8px">Ready.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button id="aro-part-hide-match" class="aro-part-hide-btn" style="background:#991b1b;color:#fff">Hide / Uncheck Match</button><button id="aro-part-show-match" class="aro-part-hide-btn" style="background:#166534;color:#fff">Show / Check Match</button><button id="aro-part-find-match" class="aro-part-hide-btn" style="background:#111827;color:#fff">Find / Highlight</button><button id="aro-part-clear-hi" class="aro-part-hide-btn" style="background:#e5e7eb;color:#111827">Clear Highlight</button></div><div style="font-size:11px;color:#6b7280;margin-top:10px;line-height:1.45">Tip: write only important part of name. Example: <b>logo</b> will match Logo_01, left_logo, customer logo etc.</div></div></div></div>';document.body.appendChild(wrap);const box=wrap.querySelector("#aro-part-names"),status=wrap.querySelector("#aro-part-status");const getNodes=()=>[...root.querySelectorAll(".treejs-node")].filter(n=>n.querySelector(":scope > .treejs-label")&&n.querySelector(":scope > .treejs-checkbox"));const getName=n=>(n.querySelector(":scope > .treejs-label")?.textContent||"").trim();const isOn=n=>n.classList.contains("treejs-node__checked");const clickIf=(node,wantChecked)=>{if(isOn(node)!==wantChecked){node.querySelector(":scope > .treejs-checkbox")?.click()}};const names=()=>box.value.split(/[\n,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);const matches=()=>{const q=names();if(!q.length)return[];return getNodes().filter(n=>{const nm=getName(n).toLowerCase();return q.some(x=>nm.includes(x))})};const clearHi=()=>getNodes().forEach(n=>n.classList.remove("aro-part-force-highlight"));const hi=list=>{clearHi();list.forEach(n=>n.classList.add("aro-part-force-highlight"));if(list[0]){try{list[0].scrollIntoView({behavior:"smooth",block:"center"})}catch(e){}}};const apply=want=>{const list=matches();if(!names().length){status.textContent="Please type at least one part name.";status.style.color="#991b1b";return}if(!list.length){status.textContent="No matching parts found.";status.style.color="#991b1b";return}list.forEach(n=>clickIf(n,want));hi(list);status.textContent=(want?"Show/checked ":"Hide/unchecked ")+list.length+" matching part(s).";status.style.color=want?"#166534":"#991b1b"};wrap.querySelector("#aro-part-hide-match").onclick=()=>apply(false);wrap.querySelector("#aro-part-show-match").onclick=()=>apply(true);wrap.querySelector("#aro-part-find-match").onclick=()=>{const list=matches();if(!names().length){status.textContent="Please type at least one part name.";status.style.color="#991b1b";return}if(!list.length){status.textContent="No matching parts found.";status.style.color="#991b1b";return}hi(list);status.textContent=list.length+" matching part(s) highlighted.";status.style.color="#111827"};wrap.querySelector("#aro-part-clear-hi").onclick=()=>{clearHi();status.textContent="Highlight cleared.";status.style.color="#6b7280"};wrap.querySelector("#aro-part-close").onclick=()=>{clearHi();wrap.remove();document.querySelector("#aro-part-hide-style")?.remove()};wrap.firstElementChild.onclick=e=>{if(e.target===wrap.firstElementChild){clearHi();wrap.remove();document.querySelector("#aro-part-hide-style")?.remove()}};box.focus()}async function runLogoSearch(){close();const clickSafe=el=>{if(!el)return false;try{el.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})}catch(e){}try{const r=el.getBoundingClientRect();const x=r.left+r.width/2;const y=r.top+r.height/2;const topEl=document.elementFromPoint(x,y)||el;["pointerdown","mousedown","mouseup","click"].forEach(type=>{topEl.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y}))});return true}catch(e){try{el.click();return true}catch(e2){return false}}};const realClickAtCenter=el=>{if(!el)return false;try{const r=el.getBoundingClientRect();const x=r.left+r.width/2;const y=r.top+r.height/2;const topEl=document.elementFromPoint(x,y)||el;["pointerdown","mousedown","mouseup","click"].forEach(type=>{topEl.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y}))});return true}catch(e){try{el.click();return true}catch(e2){return false}}};const ensureChecked=selector=>{const input=document.querySelector(selector);if(!input)return false;if(input.checked)return true;const label=input.closest("label")||input.parentElement||input;clickSafe(label);setTimeout(()=>{if(!input.checked){input.checked=true;input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}},120);return true};const waitFor=async(fn,timeout=9000,delay=300)=>{const end=Date.now()+timeout;let result=null;while(Date.now()<end){result=fn();if(result)return result;await sleep(delay)}return null};const isBrandingOpen=()=>[...document.querySelectorAll("p,h1,h2,h3,div,span")].find(el=>{const txt=(el.textContent||"").trim().toLowerCase();if(txt!=="branding")return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0});let brandingTitle=isBrandingOpen();if(!brandingTitle){const brandingTab=await waitFor(()=>document.querySelector('button[data-key="branding"],button[id$="-tab-branding"],button[aria-controls$="-tabpanel-branding"],button[role="tab"][data-key="branding"]'),5000,250);if(!brandingTab){alert("Branding sidebar tab not found.");return}clickSafe(brandingTab);brandingTitle=await waitFor(()=>isBrandingOpen(),7000,250);if(!brandingTitle){alert("Branding panel did not open. Please click Branding once manually, then try again.");return}await sleep(700)}else{const brandingToast=toast("Branding already open. Logo search starting...","#1f2937");setTimeout(()=>brandingToast?.remove(),1200);await sleep(350)}ensureChecked("#enable input[type='checkbox']");await sleep(400);ensureChecked("#isPreview input[type='checkbox']");const imgs=await waitFor(()=>{const list=[...document.querySelectorAll("img")].filter(img=>{const src=img.getAttribute("src")||img.getAttribute("data-src")||"";return src.includes("/files/")||src.includes("customdesign.ijewel3d.com/files/")});return list.length?list:null},9000,300);if(!imgs||!imgs.length){alert("No branding logo images found. Branding opened, but logos may still be loading.");return}const old=document.getElementById("aro-logo-search-panel");if(old){old.remove();return}const styleId="aro-logo-search-style";if(!document.getElementById(styleId)){const st=document.createElement("style");st.id=styleId;st.textContent=".aro-logo-force-highlight{outline:4px solid #2563eb!important;outline-offset:5px!important;border-radius:10px!important;box-shadow:0 0 0 6px rgba(37,99,235,.18)!important;z-index:999998!important;position:relative!important}.aro-logo-row:hover{background:#f8fafc!important}";document.head.appendChild(st)}const items=imgs.map((img,i)=>{let src=img.getAttribute("src")||img.getAttribute("data-src")||"";let file=(src.split("/files/")[1]||src).split("?")[0].split("/").pop()||"";let name=file.replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i,"").replace(/_[a-f0-9]{8,}$/i,"").replace(/_/g," ").replace(/\s+/g," ").trim();name=name.replace(/\b\w/g,c=>c.toUpperCase());let trigger=img.closest('[data-slot="trigger"]')||img.closest("button")||img.closest("a")||img.closest("label")||img.closest("[role='button']")||img.closest("[role='tab']")||img.closest("[tabindex]")||img.parentElement||img;return{name:name||"Logo "+(i+1),src,trigger,img,index:i}});const wrap=document.createElement("div");wrap.id="aro-logo-search-panel";wrap.innerHTML='<div style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;font-family:Inter,Arial,sans-serif"><div style="width:min(580px,92vw);background:#fff;border-radius:16px;box-shadow:0 24px 80px rgba(15,23,42,.25);overflow:hidden;border:1px solid #e5e7eb"><div style="padding:14px 16px;border-bottom:1px solid #edf0f4;display:flex;align-items:center;justify-content:space-between;gap:10px"><div><div style="font-size:15px;font-weight:700;color:#111827">Search Branding Logo</div><div id="aro-logo-count" style="font-size:12px;color:#6b7280;margin-top:2px">'+items.length+' logos found</div></div><button id="aro-logo-close" style="border:0;background:#f3f4f6;border-radius:10px;padding:7px 10px;cursor:pointer;font-size:13px;color:#111827">Close</button></div><div style="padding:12px 14px"><input id="aro-logo-search-input" placeholder="Type customer / brand name..." style="width:100%;height:42px;border:1px solid #d1d5db;border-radius:12px;padding:0 12px;font-size:14px;outline:none;box-sizing:border-box"><div id="aro-logo-results" style="max-height:420px;overflow:auto;margin-top:10px;border:1px solid #eef0f3;border-radius:12px"></div></div></div></div>';document.body.appendChild(wrap);const input=wrap.querySelector("#aro-logo-search-input"),results=wrap.querySelector("#aro-logo-results"),closeBtn=wrap.querySelector("#aro-logo-close"),count=wrap.querySelector("#aro-logo-count");let highlightTimer=null;const clearHighlights=()=>{document.querySelectorAll(".aro-logo-force-highlight").forEach(el=>el.classList.remove("aro-logo-force-highlight"));if(highlightTimer){clearTimeout(highlightTimer);highlightTimer=null}};const highlightItem=item=>{clearHighlights();const target=item.trigger||item.img;target.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});setTimeout(()=>{target.classList.add("aro-logo-force-highlight");item.img.classList.add("aro-logo-force-highlight");try{target.focus&&target.focus({preventScroll:true})}catch(e){}setTimeout(()=>{realClickAtCenter(target)},350);highlightTimer=setTimeout(clearHighlights,3000)},500)};const render=q=>{q=(q||"").toLowerCase().trim();let list=items.filter(x=>x.name.toLowerCase().includes(q));count.textContent=q?list.length+" matched out of "+items.length+" logos":items.length+" logos found";if(!list.length){results.innerHTML='<div style="padding:18px;text-align:center;color:#6b7280;font-size:13px">No logo found</div>';return}results.innerHTML=list.map(x=>'<div class="aro-logo-row" data-i="'+x.index+'" style="display:flex;align-items:center;gap:12px;padding:10px 12px;cursor:pointer;border-bottom:1px solid #f1f3f5"><div style="width:64px;height:42px;flex:0 0 64px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px"><img src="'+x.src+'" style="max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;display:block;background:#fff;border-radius:0"></div><div style="flex:1;min-width:0"><div style="font-size:14px;color:#111827;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+x.name+'</div><div style="font-size:11px;color:#6b7280;margin-top:1px">Click to scroll, highlight & auto select</div></div></div>').join("")};render("");input.focus();input.addEventListener("input",e=>render(e.target.value));results.addEventListener("click",e=>{const row=e.target.closest(".aro-logo-row");if(!row)return;const item=items.find(x=>String(x.index)===row.dataset.i);if(!item)return;wrap.remove();setTimeout(()=>highlightItem(item),100)});closeBtn.onclick=()=>wrap.remove();wrap.addEventListener("click",e=>{if(e.target===wrap.firstElementChild)wrap.remove()});document.addEventListener("keydown",function esc(e){if(e.key==="Escape"){wrap.remove();document.removeEventListener("keydown",esc)}})}panel.querySelector("#aro-render").onclick=runRenderPreset;panel.querySelector("#aro-camera").onclick=runCameraReset;panel.querySelector("#aro-camera-angle").onclick=runCameraAnglePreset;panel.querySelector("#aro-hierarchy").onclick=()=>{close();setTimeout(()=>runHierarchy(false),100)};panel.querySelector("#aro-part-hide").onclick=runPartRangeHider;panel.querySelector("#aro-part-name").onclick=runPartNameHider;panel.querySelector("#aro-logo").onclick=runLogoSearch;
    }


    function removeTemporaryMasterPanel() {
        document.getElementById('aro-master-tools')?.remove();
        document.getElementById('aro-master-tools-style')?.remove();
    }

    function triggerTool(targetSelector) {
        removeTemporaryMasterPanel();

        // Reuse the tested tool functions from the master panel,
        // but click them instantly so the panel is not shown to the user.
        openMasterTools();

        const actionButton = document.querySelector(targetSelector);

        if (!actionButton) {
            removeTemporaryMasterPanel();
            alert('Requested iJewel tool could not be opened.');
            return;
        }

        actionButton.click();
    }

    function createHeaderButton(tool) {
        const button = document.createElement('button');

        button.id = tool.id;
        button.type = 'button';
        button.className = 'aro-individual-tool-btn';
        button.title = tool.title;
        button.innerHTML = `${tool.icon}<span>${tool.label}</span>`;

        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            triggerTool(tool.target);
        });

        return button;
    }

    function mountHeaderButtons() {
        installHeaderStyles();

        if (document.getElementById(HEADER_ACTIONS_ID)) {
            return true;
        }

        const saveButton = findVisibleSaveButton();
        if (!saveButton) return false;

        const saveGroup = saveButton.parentElement;
        const rightControls = saveGroup?.parentElement;
        if (!rightControls) return false;

        const wrapper = document.createElement('div');
        wrapper.id = HEADER_ACTIONS_ID;

        HEADER_TOOLS.forEach(tool => {
            wrapper.appendChild(createHeaderButton(tool));
        });

        const profileButton = [...rightControls.children].find(element =>
            element !== saveGroup &&
            element.matches?.('button') &&
            element.querySelector('img[alt="Profile"]')
        );

        if (profileButton) {
            rightControls.insertBefore(wrapper, profileButton);
        } else {
            saveGroup.insertAdjacentElement('afterend', wrapper);
        }

        return true;
    }

    mountHeaderButtons();

    const observer = new MutationObserver(() => {
        if (!document.getElementById(HEADER_ACTIONS_ID)) {
            mountHeaderButtons();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    let retries = 0;

    const retryTimer = setInterval(() => {
        retries += 1;
        mountHeaderButtons();

        if (
            document.getElementById(HEADER_ACTIONS_ID) ||
            retries >= 30
        ) {
            clearInterval(retryTimer);
        }
    }, 1000);
})();
