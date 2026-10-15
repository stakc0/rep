(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = v => v ? `${v.slice(0,6)}…${v.slice(-5)}` : 'unknown';
  let wallets = [];
  const avatar = (r, cls='') => r.avatar ? `<img class="${cls}" src="${esc(r.avatar)}" alt="" loading="lazy">` : `<span class="${cls || 'wallet-fallback'}">${esc((r.name || 'W').slice(0,1).toUpperCase())}</span>`;
  const rating = r => { const p = Math.max(0, Number(r.profit || 0)); const n = Math.max(3, Math.min(5, Math.round(3 + Math.log10(p + 1) / 2))); return '★'.repeat(n) + '☆'.repeat(5 - n); };
  const verified = '<img class="verified-check" src="/assets/img/verified-check.png" alt="verified" title="identity indexed">';
  function renderDirectory() {
    const q = ($('#walletSearch')?.value || '').toLowerCase().trim();
    const rows = wallets.filter(r => `${r.name || ''} ${r.twitter || ''} ${r.wallet || ''}`.toLowerCase().includes(q));
    $('#walletDirectory').innerHTML = rows.length ? rows.map(r => `<a class="wallet-card" href="/token?wallet=${encodeURIComponent(r.wallet)}">${avatar(r)}<span><b>${esc(r.name || 'unnamed wallet')} ${verified}</b><small>${short(r.wallet)} · ${r.twitter ? `<span class="x">@${esc(r.twitter.split('/').pop())}</span>` : 'identity not linked'}</small></span><span class="wallet-signals"><strong>${rating(r)}</strong><small>0 warnings · activity indexed</small></span></a>`).join('') : '<div class="empty-state">No wallet matches that identity.</div>';
    $('#walletCount').textContent = wallets.length || '—';
  }
  function renderBoard() {
    const rows = wallets.slice().sort((a,b) => Number(b.profit || 0) - Number(a.profit || 0)).slice(0,6);
    $('#topWallets').innerHTML = rows.length ? rows.map(r => `<a class="top-wallet" href="/token?wallet=${encodeURIComponent(r.wallet)}">${avatar(r,'top-fallback')}<span><b>${esc(r.name || 'unnamed')} ${verified}</b><small>${short(r.wallet)}</small></span><em>${rating(r)}<small>0 warnings</small></em></a>`).join('') : '<div class="empty-state">No indexed wallets yet.</div>';
  }
  async function load() { try { const res = await fetch('/api/kolscan',{cache:'no-store'}); const data = await res.json(); if (!res.ok || !data.ok) throw Error(data.error || 'index unavailable'); wallets = data.wallets || []; renderDirectory(); renderBoard(); } catch (e) { $('#walletDirectory').innerHTML = '<div class="empty-state">The wallet index is temporarily offline. Try again shortly.</div>'; $('#topWallets').innerHTML = '<div class="empty-state">Index offline.</div>'; } }
  $('#walletSearch')?.addEventListener('input', () => { renderDirectory(); $('#searchCount').textContent = ($('#walletSearch').value || '').trim() ? 'filtered results' : 'all wallets'; });
  $('#clearSearch')?.addEventListener('click', () => { $('#walletSearch').value = ''; renderDirectory(); $('#searchCount').textContent = 'all wallets'; $('#walletSearch').focus(); });
  window.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); $('#walletSearch')?.focus(); } });
  load(); setInterval(load, 60000);
})();
