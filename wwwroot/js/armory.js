// Equipment slot layout (paper doll): 3 columns x 4 rows.
const SLOTS = [
    { slot: 8, col: 1, row: 1, label: 'Pet' },      // Fenrir / pet - top left
    { slot: 2, col: 2, row: 1, label: 'Helm' },
    { slot: 7, col: 3, row: 1, label: 'Wings' },
    { slot: 0, col: 1, row: 2, label: 'Weapon' },
    { slot: 3, col: 2, row: 2, label: 'Armor' },
    { slot: 1, col: 3, row: 2, label: 'Shield' },
    { slot: 5, col: 1, row: 3, label: 'Gloves' },
    { slot: 4, col: 2, row: 3, label: 'Pants' },
    { slot: 6, col: 3, row: 3, label: 'Boots' },
    { slot: 9, col: 1, row: 4, label: 'Pendant' },  // accessories in one line at the bottom
    { slot: 10, col: 2, row: 4, label: 'Ring' },
    { slot: 11, col: 3, row: 4, label: 'Ring' },
];

function t() {
    return window.muTranslations[window.currentLang()];
}

async function checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    try {
        const response = await fetch('/api/public/server-status');
        const data = await response.json();
        await window.ItemTooltip.load();
        shownCharacter = data;
        statusDot.className = data.online ? 'status-dot online' : 'status-dot offline';
        statusText.innerText = data.online ? (t().online || 'Online') : (t().offline || 'Offline');
    } catch {
        statusDot.className = 'status-dot offline';
        statusText.innerText = t().offline || 'Offline';
    }
}
checkServerStatus();
setInterval(checkServerStatus, 30000);

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Custom, themed item tooltip (replaces the native browser title tooltip). The lines are built
// like the game client's tooltip by item-tooltip.js; the shown character is kept for it.
const itemTooltip = document.getElementById('itemTooltip');
let shownCharacter = null;

function buildTooltip(item) {
    const tip = window.ItemTooltip.build(item, shownCharacter);
    const head = `<div class="tip-head tip-${escapeHtml(tip.titleKind)}">${escapeHtml(tip.title)}</div>`;
    const lines = tip.lines.map(l => l.kind === 'gap'
        ? '<div class="tip-gap"></div>'
        : `<div class="tip-line tip-${escapeHtml(l.kind)}">${escapeHtml(l.text)}</div>`).join('');
    return head + lines;
}

function moveTooltip(e) {
    const pad = 16;
    const rect = itemTooltip.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    itemTooltip.style.left = Math.max(8, x) + 'px';
    itemTooltip.style.top = Math.max(8, y) + 'px';
}

document.addEventListener('mouseover', e => {
    const slot = e.target.closest?.('.armory-slot.filled');
    const item = slot && shownCharacter ? shownCharacter.items[Number(slot.dataset.index)] : null;
    if (!item) return;
    itemTooltip.innerHTML = buildTooltip(item);
    itemTooltip.style.display = 'block';
    moveTooltip(e);
});
document.addEventListener('mousemove', e => {
    if (itemTooltip.style.display === 'block' && e.target.closest?.('.armory-slot.filled')) moveTooltip(e);
});
document.addEventListener('mouseout', e => {
    if (e.target.closest?.('.armory-slot.filled')) itemTooltip.style.display = 'none';
});

function renderEquip(items) {
    const equip = document.getElementById('armoryEquip');
    const bySlot = {};
    items.forEach((it, index) => bySlot[it.slot] = { ...it, index });

    const cells = SLOTS.map(def => {
        const item = bySlot[def.slot];
        const style = `grid-column:${def.col};grid-row:${def.row};`;
        if (!item) {
            return `<div class="armory-slot empty" style="${style}"><span class="slot-label">${def.label}</span></div>`;
        }
        const badges =
            (item.isExcellent ? '<span class="badge exc">EXC</span>' : '') +
            (item.isAncient ? '<span class="badge anc">ANC</span>' : '') +
            (item.sockets > 0 ? `<span class="badge sock">${item.sockets}S</span>` : '');
        return `<div class="armory-slot filled" style="${style}" data-index="${item.index}">
                    <img src="/img/items/${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"
                         onerror="this.classList.add('img-missing')">
                    ${badges}
                </div>`;
    }).join('');

    equip.innerHTML = `<div class="armory-doll">${cells}</div>`;
}

async function loadCharacter(name) {
    const equip = document.getElementById('armoryEquip');
    const charInfo = document.getElementById('charInfo');
    const tr = t();
    equip.innerHTML = `<p class="armory-message">...</p>`;
    charInfo.innerHTML = '';
    shownCharacter = null;

    try {
        const response = await fetch('/api/public/armory/' + encodeURIComponent(name));
        if (response.status === 404) {
            equip.innerHTML = `<p class="armory-message error">${tr.ARMORY_NOT_FOUND}</p>`;
            return;
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            equip.innerHTML = `<p class="armory-message error">${tr[err.code] || tr.rankingError}</p>`;
            return;
        }

        const data = await response.json();
        await window.ItemTooltip.load();
        shownCharacter = data;

        charInfo.innerHTML = `
            <div class="armory-char-name">${escapeHtml(data.name)}</div>
            <div class="armory-char-class">${escapeHtml(data.className)}</div>
            <div class="armory-char-stats">
                <span>${tr.charLvl}: <b>${data.level}</b></span>
                <span>${tr.armoryResets}: <b>${data.resets}</b></span>
                <span>ML: <b>${data.masterLevel}</b></span>
            </div>`;

        if (!data.items || data.items.length === 0) {
            renderEquip([]);
            equip.insertAdjacentHTML('afterbegin', `<p class="armory-message">${tr.armoryNoItems}</p>`);
            return;
        }
        renderEquip(data.items);
    } catch {
        equip.innerHTML = `<p class="armory-message error">${tr.rankingError}</p>`;
    }
}

document.getElementById('armorySearch').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('charInput').value.trim();
    if (name) {
        history.replaceState(null, '', '/armory?name=' + encodeURIComponent(name));
        loadCharacter(name);
    }
});

// Allow deep-linking via ?name=
const params = new URLSearchParams(location.search);
const initial = params.get('name');
if (initial) {
    document.getElementById('charInput').value = initial;
    loadCharacter(initial);
}
