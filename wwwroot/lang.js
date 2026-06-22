// Shared language switcher for every page.
//
// Translations stay in SEPARATE per-language files (en.js, pl.js, de.js, …); each one adds
// its own object to window.muTranslations. To add a language: copy en.js to <code>.js,
// translate the values, and include it with <script src="<code>.js"> on the pages — the
// switch button for it then appears automatically (no per-page button editing).
//
// Mark elements with data-i18n="key" (text/HTML) or data-i18n-placeholder="key". Pages that
// render extra language-dependent content expose a window.onLanguageChanged(lang) hook; it is
// called after every language change, including the initial one.
(function () {
    // Optional pretty labels; languages without an entry fall back to the uppercased code.
    const LABELS = { en: 'EN', pl: 'PL' };

    // Default language for first-time visitors, taken from <script src="lang.js" data-default="pl">.
    // Without the attribute the first included language wins (en.js is included first → English).
    const scriptDefault = document.currentScript ? document.currentScript.dataset.default : null;

    function languages() {
        // Order follows the <script> include order of the language files.
        return Object.keys(window.muTranslations || {});
    }

    function currentLang() {
        const saved = localStorage.getItem('preferred-lang');
        const available = languages();
        if (saved && available.includes(saved)) return saved;
        if (scriptDefault && available.includes(scriptDefault)) return scriptDefault;
        return available[0] || 'en';
    }

    function applyTranslations(lang) {
        const t = window.muTranslations[lang];
        // innerHTML (not innerText) so values containing markup/entities — e.g. the
        // "&lt;command&gt;" hint — render correctly. Translation values are trusted, static.
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const value = t[el.getAttribute('data-i18n')];
            if (value != null) el.innerHTML = value;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const value = t[el.getAttribute('data-i18n-placeholder')];
            if (value != null) el.placeholder = value;
        });
    }

    function renderSwitch(lang) {
        const box = document.getElementById('lang-switch');
        if (!box) return;
        box.innerHTML = languages().map(code =>
            `<span data-lang="${code}"${code === lang ? ' class="active"' : ''}>${LABELS[code] || code.toUpperCase()}</span>`
        ).join(' | ');
        box.querySelectorAll('[data-lang]').forEach(el =>
            el.addEventListener('click', () => setLanguage(el.getAttribute('data-lang'))));
    }

    function setLanguage(lang) {
        if (!window.muTranslations || !window.muTranslations[lang]) return;
        localStorage.setItem('preferred-lang', lang);
        applyTranslations(lang);
        renderSwitch(lang);
        if (typeof window.onLanguageChanged === 'function') window.onLanguageChanged(lang);
    }

    // Exposed globally: page scripts use these; the buttons are wired up in renderSwitch.
    window.setLanguage = setLanguage;
    window.currentLang = currentLang;
    window.t = () => window.muTranslations[currentLang()];

    // Apply the saved/default language once the DOM (and any onLanguageChanged hook) is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setLanguage(currentLang()));
    } else {
        setLanguage(currentLang());
    }
})();
