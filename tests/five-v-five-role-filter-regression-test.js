const assert = require('node:assert/strict');
const fs = require('node:fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const filterLoop = 'document.querySelectorAll("[data-five-filter]").forEach((button) => button.addEventListener("click"';
assert(!appJs.includes(filterLoop), '5v5 role filters must not bind one click handler per chip');
assert(!/\[data-five-filter\][\s\S]{0,240}renderFiveVFive\(options\)/.test(appJs), '5v5 role filter clicks must not call renderFiveVFive');
assert(appJs.includes('const selector = document.querySelector(".five-selector");') && appJs.includes('selector?.addEventListener("click", (event) => {'), '5v5 selector must use one delegated listener');
assert(appJs.includes('const filterButton = event.target.closest("[data-five-filter]");'), 'delegated selector listener must recognize role filter chips');
assert(appJs.includes('ui.fiveVFiveRoleFilter = filterButton.dataset.fiveFilter || "all";'), 'role filter state must be updated as UI-local state');
assert(appJs.includes('filterButton.focus?.({ preventScroll: true });'), 'role filter focus must not reset scroll');
assert(appJs.includes('list.replaceChildren(fragment);'), 'role filter updates must atomically replace only the candidate list');
assert(appJs.includes('const fragment = document.createDocumentFragment();'), 'role filter candidates must be built in a DocumentFragment');
assert(appJs.includes('filterButton.setAttribute("aria-selected", active ? "true" : "false")'), 'role filter chips must update aria-selected locally');
assert(!/filterButton[\s\S]{0,260}global\.RunState\.save\(run\)/.test(appJs), 'role filter clicks must not write run state to storage');

assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-field \{ min-height:\s*470px;/.test(css), 'mobile 5v5 match field must provide enough vertical space');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-field-side--mobile \{ height:\s*470px;/.test(css), 'mobile 5v5 field side must match the taller field height');
assert(/\.five-match-line \{[^}]*gap:\s*clamp\(10px, 3vw, 16px\)/.test(css), 'mobile 5v5 match lines must use wider horizontal gaps without changing cards');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-card \{[^}]*width:\s*var\(--five-mobile-card-width, 96px\)[^}]*height:\s*92px/.test(css), 'mobile card dimensions must remain unchanged');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-line\[data-row-count="2"\] \{ --five-mobile-card-width: 96px; \}/.test(css), 'two-card rows must retain the same card width');

console.log('5v5 role filter and spacing regression test passed.');
