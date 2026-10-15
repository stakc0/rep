(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const short = value => value ? `${value.slice(0, 6)}…${value.slice(-5)}` : 'unknown';
  let wallets = [];
  function card(row, index) {
    const x = row.twitter ? `<a class="wallet-social" href="${esc(row.twitter)}" target="_blank" rel="noopener">X ↗</a>` : '<span class="dim">no X linked</span>';
    const avatar = row.avatar ? `<img src="${esc(row.avatar)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<span class="wallet-avatar-fallback">${esc((row.name || 'W').slice(0, 1).toUpperCase())}</span>`;
    const pnl = Number(row.profit || 0);
    return `<a class="wallet-row" href="/token?wallet=${encodeURIComponent(row.wallet)}"><span class="wallet-rank">${String(index + 1).padStart(2, '0')}</span><span class="wallet-person">${avatar}<span><b>${esc(row.name || 'unnamed wallet')}</b><small>${short(row.wallet)}</small></span></span><span class="wallet-x">${x}</span><span class="wallet-pnl ${pnl >= 0 ? 'up' : 'dn'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} SOL</span><span class="wallet-open">view REP ↗</span></a>`;
  }
  function render() {
    const query = ($('#indexSearch')?.value || '').toLowerCase().trim();
    const shown = wallets.filter(row => `${row.name || ''} ${row.twitter || ''} ${row.wallet || ''}`.toLowerCase().includes(query));
    $('#walletIndex').innerHTML = shown.length ? shown.map(card).join('') : '<div class="empty">No wallets match that filter.</div>';
    $('#indexStatus').textContent = `${wallets.length} wallets indexed · ${shown.length} shown`;
  }
  async function load() {
    $('#indexStatus').textContent = 'refreshing index…';
    try { const response = await fetch('/api/kolscan', { cache: 'no-store' }); const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'Index unavailable'); wallets = data.wallets || []; render(); } catch (error) { $('#indexStatus').textContent = 'index unavailable'; $('#walletIndex').innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
  }
  $('#indexSearch')?.addEventListener('input', render);
  $('#indexRefresh')?.addEventListener('click', load);
  load(); setInterval(load, 60000);
})();
