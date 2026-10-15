(function () {
  const { $, esc, api, hhmm } = WRLD;
  const icon = domain => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  const bar = value => `<span class="odds-bar"><i style="width:${Math.max(3, Math.min(100, value))}%"></i></span>`;
  async function news() {
    const r = await api('/api/politics');
    if (!r || !r.ok) { $('#politicsAt').innerHTML = '<span class="off">sources offline · retrying</span>'; $('#politicsNews').innerHTML = '<div class="empty">political desks are temporarily unavailable.</div>'; return; }
    $('#politicsAt').textContent = `${r.sources} sources · ${hhmm(r.at)}`;
    $('#politicsNews').innerHTML = r.items.map(item => `<a class="news-item" href="${esc(item.url)}" target="_blank" rel="noopener"><img src="${icon(item.domain)}" alt=""><span><b>${esc(item.title)}</b><small>${esc(item.source)} · ${esc(item.published || 'latest')}</small></span><em>↗</em></a>`).join('') || '<div class="empty">no political headlines right now.</div>';
  }
  async function odds() {
    const r = await api('/api/polymarket');
    if (!r || !r.ok) { $('#oddsAt').innerHTML = '<span class="off">markets offline · retrying</span>'; $('#politicsOdds').innerHTML = '<div class="empty">Polymarket is temporarily unavailable.</div>'; return; }
    $('#oddsAt').textContent = `live · ${hhmm(r.at)}`;
    $('#politicsOdds').innerHTML = r.markets.map(m => `<a class="odds-item" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="odds-q">${esc(m.question)}</span><span class="odds-line">${bar(m.yes)} <b>${m.yes}%</b><em>YES ↗</em></span></a>`).join('') || '<div class="empty">no political markets right now.</div>';
  }
  $('#politicsRe').addEventListener('click', news); news(); odds();
  setInterval(() => { if (!document.hidden) { news(); odds(); } }, 120000);
})();
