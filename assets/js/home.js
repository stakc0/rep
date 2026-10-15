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
  function renderReviews(reviews) { const el = $('#latestReviews'); if (!el) return; el.innerHTML = reviews.length ? reviews.slice(0,8).map(r => `<article class="review-item"><b>${esc(r.category || 'observation')}</b><small>wallet ${short(r.wallet)}${r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}</small><p>${esc(r.text)}</p>${r.evidence_url ? `<a class="full-link" href="${esc(r.evidence_url)}" target="_blank" rel="noopener">open evidence ↗</a>` : ''}</article>`).join('') : '<div class="empty-state">No ledger entries yet. Reviews will appear here.</div>'; }
  async function loadReviews() { try { const res = await fetch('/api/reviews',{cache:'no-store'}); const data = await res.json(); if (res.ok && data.ok) renderReviews(data.reviews || []); } catch {} }
  async function load() { try { const res = await fetch('/api/kolscan',{cache:'no-store'}); const data = await res.json(); if (!res.ok || !data.ok) throw Error(data.error || 'index unavailable'); wallets = data.wallets || []; const age = data.cacheAgeMs != null ? Math.max(0, Math.round(data.cacheAgeMs / 1000)) : 0; if ($('#indexStatus')) $('#indexStatus').innerHTML = `<i></i> ${wallets.length} wallets · refreshed ${age}s ago`; renderDirectory(); renderBoard(); } catch (e) { if ($('#indexStatus')) $('#indexStatus').innerHTML = '<i></i> index temporarily offline'; $('#walletDirectory').innerHTML = '<div class="empty-state">The wallet index is temporarily offline. Try again shortly.</div>'; $('#topWallets').innerHTML = '<div class="empty-state">Index offline.</div>'; } }
  $('#addWalletForm')?.addEventListener('submit', e => { e.preventDefault(); const value = $('#addWalletInput').value.trim(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) location.href = `/token?wallet=${encodeURIComponent(value)}`; else $('#addWalletInput').focus(); });
  $('#walletSearch')?.addEventListener('input', () => { renderDirectory(); $('#searchCount').textContent = ($('#walletSearch').value || '').trim() ? 'filtered results' : 'all wallets'; });
  $('#clearSearch')?.addEventListener('click', () => { $('#walletSearch').value = ''; renderDirectory(); $('#searchCount').textContent = 'all wallets'; $('#walletSearch').focus(); });
  window.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); $('#walletSearch')?.focus(); } });
  load(); loadReviews(); setInterval(load, 60000); setInterval(loadReviews, 30000);
})();
