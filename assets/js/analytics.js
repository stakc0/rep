(function () {
  const { $, esc, api, toast } = WRLD;
  const money = v => { const n = Number(v || 0); return n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : n ? '$' + n.toFixed(2) : '—'; };
  async function load() {
    const r = await api('/api/tokens');
    if (!r || !r.ok) { $('#table').innerHTML = '<div class="empty"><span class="off">analytics unavailable · retrying</span></div>'; return; }
    const tokens = r.tokens || [], mc = tokens.reduce((n, x) => n + Number(x.marketCapUsd || 0), 0), vol = tokens.reduce((n, x) => n + Number(x.volume24hUsd || 0), 0);
    const cards = $('#stats').querySelectorAll('.metric b'); cards[0].textContent = money(mc); cards[1].textContent = money(vol); cards[2].textContent = String(tokens.length); cards[3].textContent = new Date().toISOString().slice(11, 16) + ' UTC';
    $('#updated').textContent = 'updated now';
    $('#table').innerHTML = tokens.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>coin</th><th>market cap</th><th>volume 24h</th><th>price</th><th>market</th></tr></thead><tbody>${tokens.map(x => `<tr><td><a class="coin" href="/${esc(x.mint)}"><img src="${esc(x.image || '')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><b>$${esc(x.symbol)}</b><span class="rl">${esc(x.name)}</span></span></a></td><td>${money(x.marketCapUsd)}</td><td>${money(x.volume24hUsd)}</td><td>${x.priceUsd ? '$' + Number(x.priceUsd).toPrecision(4) : '—'}</td><td>${x.dexUrl ? `<a class="u" href="${esc(x.dexUrl)}" target="_blank" rel="noopener">DexScreener</a>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No confirmed launches yet.</div>';
  }
  $('#refresh').addEventListener('click', () => { load(); toast('Analytics refreshed'); }); load(); setInterval(() => { if (!document.hidden) load(); }, 15000);
})();
