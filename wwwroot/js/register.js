document.getElementById('regForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn'), btnText = document.getElementById('btnText'),
        btnLoader = document.getElementById('btnLoader'), msgDiv = document.getElementById('message'),
        t = window.muTranslations[window.currentLang()];

    btn.disabled = true; btnText.style.display = 'none'; btnLoader.style.display = 'block';
    try {
        const formData = new FormData(e.target);
        formData.append('language', window.currentLang());
        const response = await fetch('/api/register', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: formData });
        const data = await response.json();
        msgDiv.className = response.ok ? 'success' : 'error';
        msgDiv.innerText = t[data.code] || data.message;
        msgDiv.style.display = 'block';
        if (response.ok) e.target.reset();
    } catch (error) {
        msgDiv.className = 'error'; msgDiv.innerText = t.connError; msgDiv.style.display = 'block';
    } finally {
        btn.disabled = false; btnText.style.display = 'block'; btnLoader.style.display = 'none';
    }
});
