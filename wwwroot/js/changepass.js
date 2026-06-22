document.getElementById('changePassForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn'), btnText = document.getElementById('btnText'),
        btnLoader = document.getElementById('btnLoader'), msgDiv = document.getElementById('message'),
        t = window.muTranslations[window.currentLang()];

    msgDiv.style.display = 'none'; btn.disabled = true;
    btnText.style.display = 'none'; btnLoader.style.display = 'block';

    try {
        const response = await fetch('/api/change-password', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: new FormData(e.target) });
        const data = await response.json();
        msgDiv.style.display = 'block'; msgDiv.className = response.ok ? 'success' : 'error';
        msgDiv.innerText = t[data.code] || data.message;
        if (response.ok) e.target.reset();
    } catch (error) {
        msgDiv.style.display = 'block'; msgDiv.className = 'error'; msgDiv.innerText = t.connError;
    } finally {
        btn.disabled = false;
        btnText.style.display = 'block'; btnLoader.style.display = 'none';
    }
});
