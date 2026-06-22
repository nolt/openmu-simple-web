async function checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const t = window.t();

    try {
        const response = await fetch('/api/public/server-status');
        const data = await response.json();

        if (data.online) {
            statusDot.className = 'status-dot online';
            statusText.innerText = t.online || 'Online';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.innerText = t.offline || 'Offline';
        }
    } catch {
        statusDot.className = 'status-dot offline';
        statusText.innerText = t.offline || 'Offline';
    }
}

checkServerStatus();
setInterval(checkServerStatus, 30000);

async function loadRanking() {
    const rankingBody = document.getElementById('rankingBody');
    const t = window.t();

    try {
        const response = await fetch('/api/public/ranking');
        if (!response.ok) throw new Error('Failed to load');

        const data = await response.json();

        if (!data || data.length === 0) {
            rankingBody.innerHTML = `<tr><td colspan="5" style="text-align:center">${t.rankingNone}</td></tr>`;
            return;
        }

        const maxResets = (window.muConfig && window.muConfig.maxResets) || 0;

        rankingBody.innerHTML = data.map((char, index) => `
            <tr>
                <td class="rank-number">${index + 1}</td>
                <td class="char-name">${char.name}</td>
                <td style="color: #aaa; font-size: 0.85rem; font-style: italic;">${char.className}</td>
                <td style="white-space: nowrap;">
                    <span style="color: #fff; font-weight: bold; display: inline-block; width: 32px; text-align: right;">${char.level}</span>
                    <span class="reset-badge${maxResets > 0 && char.resets === maxResets ? ' max-reset' : ''}">${char.resets} RR</span>
                </td>
                <td class="master-level">${char.masterLevel}</td>
            </tr>
        `).join('');

    } catch (error) {
        rankingBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #e74c3c;">${t.rankingError}</td></tr>`;
    }
}

loadRanking();
