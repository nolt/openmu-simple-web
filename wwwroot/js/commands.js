// Player (Normal) chat commands only. Descriptions live in the translation files
// (keyed by descKey); this table only holds the command signature.
const COMMAND_SECTIONS = [
    {
        titleKey: 'cmdSecStats',
        commands: [
            { key: '/add', args: '&lt;stat&gt; &lt;amount&gt;', descKey: 'cmdAddDesc' },
        ]
    },
    {
        titleKey: 'cmdSecReset',
        commands: [
            { key: '/reset', args: '', descKey: 'cmdResetDesc' },
            { key: '/resetinfo', args: '', descKey: 'cmdResetInfoDesc' },
            { key: '/resetstats', args: '', descKey: 'cmdResetStatsDesc' },
        ]
    },
    {
        titleKey: 'cmdSecChar',
        commands: [
            { key: '/move', args: '&lt;place&gt;', descKey: 'cmdMoveDesc' },
            { key: '/clearinv', args: '', descKey: 'cmdClearInvDesc' },
            { key: '/npc', args: '', descKey: 'cmdNpcDesc' },
            { key: '/openware', args: '', descKey: 'cmdOpenWareDesc' },
            { key: '/offlevel', args: '', descKey: 'cmdOffLevelDesc' },
            { key: '/language', args: '&lt;code&gt;', descKey: 'cmdLanguageDesc' },
        ]
    },
    {
        titleKey: 'cmdSecSocial',
        commands: [
            { key: '/post', args: '&lt;text&gt;', descKey: 'cmdPostDesc' },
            { key: '/war', args: '&lt;guild&gt;', descKey: 'cmdWarDesc' },
            { key: '/battlesoccer', args: '&lt;guild&gt;', descKey: 'cmdBattleSoccerDesc' },
        ]
    },
    {
        titleKey: 'cmdSecHelp',
        commands: [
            { key: '/list', args: '', descKey: 'cmdListDesc' },
            { key: '/help', args: '&lt;command&gt;', descKey: 'cmdHelpDesc' },
        ]
    },
];

function renderCommands(lang) {
    const t = window.muTranslations[lang];
    const html = COMMAND_SECTIONS.map(section => {
        const rows = section.commands.map(c => `
            <div class="cmd-card">
                <div class="cmd-signature">
                    <span class="cmd-key">${c.key}</span>${c.args ? `<span class="cmd-args">${c.args}</span>` : ''}
                </div>
                <div class="cmd-desc">${t[c.descKey] || c.descKey}</div>
            </div>
        `).join('');
        return `
            <div class="cmd-section">
                <div class="cmd-section-title">${t[section.titleKey] || section.titleKey}</div>
                ${rows}
            </div>
        `;
    }).join('');
    document.getElementById('commandsContainer').innerHTML = html;
}

// lang.js applies the data-i18n text and renders the language buttons; re-render the
// command list (its descriptions live in the translation files) on every change.
window.onLanguageChanged = renderCommands;
