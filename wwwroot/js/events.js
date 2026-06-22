async function checkServerStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const t = window.muTranslations[window.currentLang()];

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

function formatCountdown(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return String(h).padStart(2, '0') + ':' +
           String(m).padStart(2, '0') + ':' +
           String(s).padStart(2, '0');
}

const EVENT_STYLES = {
    'Red Dragon Invasion': { css: 'event-red-dragon', icon: '🐉' },
    'Golden Invasion': { css: 'event-golden', icon: '👑' },
    'Blood Castle': { css: 'event-blood-castle', icon: '🏰' },
    'Chaos Castle': { css: 'event-chaos-castle', icon: '⚡' },
    'Devil Square': { css: 'event-devil-square', icon: '👹' },
    'Happy Hour': { css: 'event-happy-hour', icon: '🎉' },
};

function renderEvent(event) {
    const style = EVENT_STYLES[event.name] || { css: '', icon: '📅' };
    const lang = window.currentLang();

    const countdownSeconds = event.countdownSeconds;
    const nextTimeStr = event.nextRunLocal || null;
    const timetableHtml = event.timetable.map(t =>
        `<span class="event-time-badge${t === nextTimeStr ? ' next' : ''}">${t}</span>`
    ).join('');

    const t = window.muTranslations[lang];
    const durationLabel = (t.eventsDuration || 'Czas trwania') + ': ' + event.durationMinutes + ' ' + (t.eventsMin || 'min');

    const descHtml = event.experienceMultiplier
        ? `<div class="event-description">${(t.eventsXpMult || 'Experience')} x${event.experienceMultiplier.toFixed(1)}</div>`
        : '';

    return `
        <div class="event-card ${style.css}" data-event="${event.name}">
            <div class="event-header">
                <div class="event-name">
                    <span class="event-icon">${style.icon}</span>
                    ${event.name}
                </div>
                <div class="event-duration">${durationLabel}</div>
            </div>
            ${descHtml}
            <div class="event-body">
                <div class="event-left">
                    <div class="event-countdown">
                        <div class="countdown-number" data-seconds="${countdownSeconds}">
                            ${formatCountdown(countdownSeconds)}
                        </div>
                        <div class="countdown-label" data-i18n="eventsRemaining">${t.eventsRemaining || 'remaining'}</div>
                    </div>
                </div>
                <div class="event-right">
                    <div class="event-timetable">${timetableHtml}</div>
                </div>
            </div>
        </div>
    `;
}

function updateCountdowns() {
    document.querySelectorAll('.countdown-number').forEach(el => {
        let sec = parseInt(el.getAttribute('data-seconds'));
        if (sec > 0) {
            sec--;
            el.setAttribute('data-seconds', sec);
            el.innerText = formatCountdown(sec);
        }
    });
}

const EVENT_ORDER = ['Happy Hour', 'Chaos Castle', 'Blood Castle', 'Devil Square', 'Red Dragon Invasion', 'Golden Invasion'];

async function loadEvents() {
    const container = document.getElementById('eventsContainer');
    const lang = window.currentLang();
    const t = window.muTranslations[lang];

    try {
        const response = await fetch('/api/public/events');
        if (!response.ok) throw new Error('Failed to load');

        const data = await response.json();

        if (!data || data.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;">' + (t.eventsNone || 'No events configured.') + '</div>';
            return;
        }

        data.sort((a, b) => EVENT_ORDER.indexOf(a.name) - EVENT_ORDER.indexOf(b.name));

        container.innerHTML = data.map(renderEvent).join('');
        setLanguage(lang);

    } catch (error) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:#e74c3c;">' + (t.connError || 'Connection error.') + '</div>';
    }
}

loadEvents();
setInterval(loadEvents, 60000);
setInterval(updateCountdowns, 1000);
