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

// Custom, themed item tooltip (replaces the native browser title tooltip).
const itemTooltip = document.getElementById('itemTooltip');

function buildTooltip(desc) {
    const lines = desc.split('\n');
    const head = `<div class="tip-head">${escapeHtml(lines[0])}</div>`;
    const opts = lines.slice(1).map(line => {
        let cls = 'tip-line';
        if (line.startsWith('+ Exc')) cls += ' exc';
        else if (line.startsWith('+ Skill')) cls += ' skill';
        else if (line.includes('Socket')) cls += ' sock';
        else cls += ' opt';
        return `<div class="${cls}">${escapeHtml(line)}</div>`;
    }).join('');
    return head + opts;
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
    if (!slot || !slot.dataset.tip) return;
    itemTooltip.innerHTML = buildTooltip(slot.dataset.tip);
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
    items.forEach(it => bySlot[it.slot] = it);

    const cells = SLOTS.map(def => {
        const item = bySlot[def.slot];
        const style = `grid-column:${def.col};grid-row:${def.row};`;
        if (!item) {
            return `<div class="armory-slot empty" style="${style}"><span class="slot-label">${def.label}</span></div>`;
        }
        const badges =
            (item.excellent ? '<span class="badge exc">EXC</span>' : '') +
            (item.ancient ? '<span class="badge anc">ANC</span>' : '') +
            (item.sockets > 0 ? `<span class="badge sock">${item.sockets}S</span>` : '');
        return `<div class="armory-slot filled" style="${style}" data-tip="${escapeHtml(item.description)}">
                    <img src="/img/items/${escapeHtml(item.image)}" alt="${escapeHtml(item.description)}"
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
