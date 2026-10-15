/* politic registry: independent fallback renderer for the home coin list */
(function () {
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = value => { const n = Number(value || 0); return n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : n ? '$' + n.toFixed(2) : '—'; };
  const image = coin => coin.image || coin.image_url || '';
  const render = payload => {
    const box = document.querySelector('#coinsBd');
    if (!box) return;
    const coins = Array.isArray(payload && payload.tokens) ? payload.tokens : [];
    const count = document.querySelector('#coinsN'); if (count) count.textContent = payload && payload.ok ? `${coins.length} launched` : '';
    const live = document.querySelector('#stLive'); if (live) live.textContent = payload && payload.ok ? String(coins.length) : '—';
    if (!payload || !payload.ok) { box.innerHTML = '<div class="empty"><span class="off">the token registry is temporarily unavailable · retrying</span></div>'; return; }
    if (!coins.length) { box.innerHTML = '<div class="empty">No coins yet. <a class="u" href="/launch">launch the first one</a>.</div>'; return; }
    box.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>coin</th><th>market cap</th><th>volume 24h</th><th>price</th></tr></thead><tbody>${coins.map(c => `<tr><td><a class="coin" href="/${esc(c.mint)}"><img src="${esc(image(c))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><b>$${esc(c.symbol)}</b><span class="rl">${esc(c.name)}</span></span></a></td><td>${money(c.marketCapUsd)}</td><td>${money(c.volume24hUsd)}</td><td>${c.priceUsd ? '$' + Number(c.priceUsd).toPrecision(4) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  };
  async function load() {
    const key = 'politic:registry:v1';
    try { const cached = JSON.parse(localStorage.getItem(key) || 'null'); if (cached && Date.now() - cached.at < 60000) render(cached.data); } catch {}
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('/api/tokens', { cache: 'no-store', signal: controller.signal }); clearTimeout(timeout);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'registry request failed');
      render(data); try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
    } catch (error) {
      const box = document.querySelector('#coinsBd');
      if (!box || box.querySelector('table')) return;
      box.innerHTML = '<div class="empty"><span class="off">the token registry is temporarily unavailable · retrying</span></div>';
    }
  }
  load(); setInterval(load, 15000);
})();
