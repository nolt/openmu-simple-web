// lang.js fills in the data-i18n text and renders the language buttons; this hook adds
// the index-only content (welcome text + rates table) from content.js on each switch.
window.onLanguageChanged = function (lang) {
    const c = window.muContent[lang];

    document.getElementById('welcomeTitle').innerText = c.welcomeTitle;
    document.getElementById('welcomeText').innerText = c.welcomeText;
    renderDownloads();

    const list = document.getElementById('detailsList');
    list.innerHTML = c.rows.map(row =>
        '<div class="details-row">' + row.map(d =>
            d.url
                ? `<li><span class="detail-label">${d.label}:</span> <a href="${d.url}" target="_blank">${d.value}</a></li>`
                : `<li><span class="detail-label">${d.label}:</span> ${d.value}</li>`
        ).join('') + '</div>'
    ).join('');
};

async function checkServerStatus() {
    const dot = document.getElementById('indexStatusDot');
    const text = document.getElementById('indexStatusText');
    const t = window.t();

    try {
        const res = await fetch('/api/public/server-status');
        const data = await res.json();
        if (data.online) {
            dot.className = 'status-dot-box online';
            text.className = 'status-value online';
            text.innerText = t.online || 'Online';
        } else {
            dot.className = 'status-dot-box offline';
            text.className = 'status-value offline';
            text.innerText = t.offline || 'Offline';
        }
    } catch {
        dot.className = 'status-dot-box offline';
        text.className = 'status-value offline';
        text.innerText = t.offline || 'Offline';
    }
}

async function checkOnlinePlayers() {
    const text = document.getElementById('indexPlayersText');

    try {
        const res = await fetch('/api/public/online-players');
        const data = await res.json();
        text.innerText = data.playerCount !== null ? data.playerCount : '---';
    } catch {
        text.innerText = '---';
    }
}

// Download dropdown: a single "Download" button that reveals the targets from
// muConfig.downloads. The recommended one (Launcher) is highlighted; nothing
// downloads on its own — every entry is an explicit pick. Re-rendered on each
// language change so the generic labels translate.
function renderDownloads() {
    const area = document.getElementById('downloadArea');
    if (!area) return;
    const t = window.t();
    const items = (window.muConfig.downloads || []).map(d => {
        const cls = d.recommended ? 'recommended' : (d.soon ? 'soon' : '');
        const tag = d.recommended ? `<span class="dlC-tag">${t.dlRecommended}</span>`
            : (d.soon ? `<span class="dlC-tag">${t.dlSoon}</span>` : '');
        return `<a class="dlC-item ${cls}" href="${d.soon ? '#' : d.url}"><span>${d.icon}</span> <span>${d.name}</span> ${tag}</a>`;
    }).join('');

    area.innerHTML = `
        <div class="dlC-wrap" id="dlCWrap">
            <div class="dlC-trigger dl-gold" id="dlCTrigger">
                <span>⬇ ${t.dlDownload}</span><span class="dlC-caret">▼</span>
            </div>
            <div class="dlC-menu">${items}</div>
        </div>`;

    document.getElementById('dlCTrigger').addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('dlCWrap').classList.toggle('open');
    });
}

// Attach the outside-click close once (not per render, to avoid stacking listeners).
document.addEventListener('click', () => {
    const wrap = document.getElementById('dlCWrap');
    if (wrap) wrap.classList.remove('open');
});

checkServerStatus();
checkOnlinePlayers();
setInterval(checkServerStatus, 30000);
setInterval(checkOnlinePlayers, 30000);
