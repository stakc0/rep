(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = v => v ? `${v.slice(0,6)}…${v.slice(-5)}` : 'unknown';
  const verified = '<img class="verified-check" src="/assets/img/verified-check.png" alt="verified" title="X identity indexed">';
  let wallets = []; let voteCounts = {};
  const score = r => { const state = voteState(r.wallet); const up = Number(r.votes_up || state.up || 0); const down = Number(r.votes_down || state.down || 0); const total = up + down; return total ? Math.round((up / total) * 100) : 50; };
  const avatar = r => r.avatar ? `<img src="/api/avatar?url=${encodeURIComponent(String(r.avatar).replace(/\\+$/, ''))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/assets/img/fav32.png'">` : `<span class="wallet-fallback">${esc((r.name || 'W').slice(0,1).toUpperCase())}</span>`;
  function voteState(wallet) { try { return { ...(voteCounts[wallet] || {}), ...JSON.parse(localStorage.getItem(`rep-vote:${wallet}`) || '{}') }; } catch { return voteCounts[wallet] || {}; } }
  function render() {
    const q = ($('#walletSearch')?.value || '').toLowerCase().trim();
    const rows = wallets.filter(r => `${r.name || ''} ${r.twitter || ''} ${r.wallet || ''}`.toLowerCase().includes(q)).sort((a, b) => score(b) - score(a) || Number(b.x_followers || 0) - Number(a.x_followers || 0));
    $('#walletDirectory').innerHTML = rows.length ? rows.map((r, i) => `<a class="rank-card" href="/token?wallet=${encodeURIComponent(r.wallet)}"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span>${avatar(r)}<span class="rank-identity"><b>${esc(r.name || 'unnamed wallet')} ${r.x_followers != null || r.x_verified ? verified : ''}</b><small>${r.twitter ? `@${esc(r.twitter.split('/').pop())}` : short(r.wallet)}</small><small>${short(r.wallet)}</small></span><span class="rank-score"><strong>${score(r)}</strong><small>REP score</small></span><span class="rank-votes"><button class="vote up" aria-label="thumbs up" data-vote="1" data-wallet="${r.wallet}">👍 <b>${voteState(r.wallet).up || r.votes_up || 0}</b></button><button class="vote down" aria-label="thumbs down" data-vote="-1" data-wallet="${r.wallet}">👎 <b>${voteState(r.wallet).down || r.votes_down || 0}</b></button></span></a>`).join('') : '<div class="empty-state">No wallet matches that search.</div>';
    $('#walletCount').textContent = wallets.length;
    $('#searchCount').textContent = q ? `${rows.length} matches` : 'all wallets';
  }
  async function loadVotes() { try { const res = await fetch('/api/votes', { cache: 'no-store' }); const data = await res.json(); if (res.ok && data.ok) { voteCounts = data.votes || {}; render(); } } catch {} }
  async function load(url, background = false) { try { const res = await fetch(url, { cache: background ? 'no-store' : 'force-cache' }); const data = await res.json(); if (!res.ok || !data.ok) throw Error('index unavailable'); wallets = data.wallets || []; render(); const age = data.cacheAgeMs != null ? Math.max(0, Math.round(data.cacheAgeMs / 1000)) : 0; $('#indexStatus').textContent = background ? 'live index refreshed' : `cached index · ${age ? `${age}s old` : 'ready'}`; } catch (e) { if (!wallets.length) { $('#indexStatus').textContent = 'cached index unavailable'; $('#walletDirectory').innerHTML = '<div class="empty-state">The wallet index is temporarily unavailable.</div>'; } } }
  $('#walletDirectory')?.addEventListener('click', async e => { const button = e.target.closest('[data-vote]'); if (!button) return; e.preventDefault(); e.stopPropagation(); const wallet = button.dataset.wallet; const vote = Number(button.dataset.vote); try { const response = await fetch('/api/vote', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ wallet, vote }) }); const data = await response.json(); if (response.ok && data.ok) { localStorage.setItem(`rep-vote:${wallet}`, JSON.stringify({ up:data.up, down:data.down })); render(); } } catch {} });
  $('#walletSearch')?.addEventListener('input', render);
  $('#clearSearch')?.addEventListener('click', () => { $('#walletSearch').value = ''; render(); $('#walletSearch').focus(); });
  $('#addWalletForm')?.addEventListener('submit', e => { e.preventDefault(); const value = $('#addWalletInput').value.trim(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) location.href = `/token?wallet=${encodeURIComponent(value)}`; else $('#addWalletInput').focus(); });
  window.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); $('#walletSearch')?.focus(); } });
  load('/data/kolscan.json');
  load('/api/kolscan', true);
  loadVotes();
})();
