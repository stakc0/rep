(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = v => v ? `${v.slice(0,6)}…${v.slice(-5)}` : 'unknown';
  const verified = '<img class="verified-check" src="/assets/img/verified-check.png" alt="verified" title="X identity indexed">';
  let wallets = [];
  const stars = r => { const p = Math.max(0, Number(r.profit || 0)); const n = Math.max(3, Math.min(5, Math.round(3 + Math.log10(p + 1) / 2))); return '★'.repeat(n) + '☆'.repeat(5 - n); };
  const avatar = r => r.avatar ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">` : `<span class="wallet-fallback">${esc((r.name || 'W').slice(0,1).toUpperCase())}</span>`;
  function render() {
    const q = ($('#walletSearch')?.value || '').toLowerCase().trim();
    const rows = wallets.filter(r => `${r.name || ''} ${r.twitter || ''} ${r.wallet || ''}`.toLowerCase().includes(q));
    $('#walletDirectory').innerHTML = rows.length ? rows.map((r, i) => `<a class="rank-card" href="/token?wallet=${encodeURIComponent(r.wallet)}"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span>${avatar(r)}<span class="rank-identity"><b>${esc(r.name || 'unnamed wallet')} ${r.x_verified ? verified : ''}</b><small>${r.twitter ? `@${esc(r.twitter.split('/').pop())}` : short(r.wallet)}</small><small>${short(r.wallet)}</small></span><span class="rank-rep"><strong>${stars(r)}</strong><small>REP rating</small></span><span class="rank-warning"><b>0</b><small>warnings</small></span><span class="rank-open">view profile</span></a>`).join('') : '<div class="empty-state">No wallet matches that search.</div>';
    $('#walletCount').textContent = wallets.length;
    $('#searchCount').textContent = q ? `${rows.length} matches` : 'all wallets';
  }
  async function load(url, background = false) { try { const res = await fetch(url, { cache: background ? 'no-store' : 'force-cache' }); const data = await res.json(); if (!res.ok || !data.ok) throw Error('index unavailable'); wallets = data.wallets || []; render(); const age = data.cacheAgeMs != null ? Math.max(0, Math.round(data.cacheAgeMs / 1000)) : 0; $('#indexStatus').textContent = background ? 'live index refreshed' : `cached index · ${age ? `${age}s old` : 'ready'}`; } catch (e) { if (!wallets.length) { $('#indexStatus').textContent = 'cached index unavailable'; $('#walletDirectory').innerHTML = '<div class="empty-state">The wallet index is temporarily unavailable.</div>'; } } }
  $('#walletSearch')?.addEventListener('input', render);
  $('#clearSearch')?.addEventListener('click', () => { $('#walletSearch').value = ''; render(); $('#walletSearch').focus(); });
  $('#addWalletForm')?.addEventListener('submit', e => { e.preventDefault(); const value = $('#addWalletInput').value.trim(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) location.href = `/token?wallet=${encodeURIComponent(value)}`; else $('#addWalletInput').focus(); });
  window.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); $('#walletSearch')?.focus(); } });
  load('/data/kolscan.json');
  load('/api/kolscan', true);
})();
