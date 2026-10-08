/* politic launcher: political destination → first buy → Pump V2 coin */
(function () {
  const { $, $$, esc, api, post, toast, copy, short } = WRLD;
  const WR = window.WR;
  // Keep the cost panel available while the direct Pump V2 flow prepares the wallet transactions.
  // This page used CFG without defining it, so costs() threw during startup and no launch handler was attached.
  const CFG = { createSol: 0.03, reserveSol: 0.015 };
  WRLD.typePrompt($('#prompt'), 'launch a coin, fees routed to a political destination'); WRLD.tape(); WRLD.nudge();
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === 'launch'));

  const DESTINATIONS = [
    ['Democratic Party', 'https://democrats.org', 'D'], ['Republican Party', 'https://gop.com', 'R'],
    ['Fairshake', 'https://www.fairshakepac.com', 'F'], ['Sentinel Action Fund', 'https://sentinelactionfund.com', 'S'],
    ['Protect Progress', 'https://protectprogresspac.com', 'P'], ['Future Forward', 'https://futureforwardusa.org', 'F'],
    ['NRCC', 'https://www.nrcc.org', 'N'], ['Defend American Jobs', 'https://defendamericanjobs.com', 'D'],
    ['America PAC', 'https://theamericapac.org', 'A'], ['American Blockchain PAC', 'https://americanblockchainpac.org', 'B'],
    ['End Citizens United', 'https://endcitizensunited.org', 'E'], ['Club for Growth', 'https://clubforgrowth.org', 'C'],
    ['Working Families Party', 'https://workingfamilies.org', 'W'], ['Libertarian Party', 'https://lp.org', 'L']
  ];
  $('#partyGrid').innerHTML = DESTINATIONS.map(([name,site,mark]) => `<button class="br sm party" type="button" data-site="${site}" title="${name}"><img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=64" alt=""> ${name}</button>`).join('');
  $('#partyGrid').addEventListener('click', e => { const b=e.target.closest('[data-site]'); if(!b)return; $('#fWeb').value=b.dataset.site; $$('#partyGrid [data-site]').forEach(x=>x.classList.toggle('on',x===b)); toast('Destination set: '+b.title); });


  // ---------- picture ----------
  let IMG = null;
  $('#fImg').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('That picture is over 8 MB'); return; }
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast('Use a PNG, JPEG, WebP, or GIF'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
        const s = Math.max(512 / im.width, 512 / im.height), w = im.width * s, h = im.height * s;
        x.fillStyle = '#f6f3ec'; x.fillRect(0, 0, 512, 512); x.drawImage(im, (512 - w) / 2, (512 - h) / 2, w, h);
        IMG = c.toDataURL('image/jpeg', .88); $('#drop').innerHTML = `<img src="${IMG}" alt="coin picture"><span class="pic-ok">image ready</span>`; $('#drop').classList.add('has-image');
      };
      im.onerror = () => toast('That picture couldn’t be read'); im.src = reader.result;
    };
    reader.onerror = () => toast('That picture couldn’t be read'); reader.readAsDataURL(f);
  });
  $('#drop').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fImg').click(); } });

  // ---------- costs ----------
  function needSol(dev) { return Math.ceil((CFG.createSol + dev * 1.02 + CFG.reserveSol) * 1000) / 1000; }
  function costs() {
    const dev = Number($('#fDev').value); $('#devV').textContent = dev.toFixed(2);
    $('#costs').innerHTML = `<tr><td>first buy (+2% for pump.fun fees and slippage)</td><td>${(dev * 1.02).toFixed(4)} SOL</td></tr>
      <tr><td>pump.fun rent and fees for a new coin (unused part comes back)</td><td>${CFG.createSol.toFixed(3)} SOL</td></tr>
      <tr><td>gas reserve kept in the coin’s wallet</td><td>${CFG.reserveSol.toFixed(3)} SOL</td></tr>
      <tr class="t"><td>one deposit</td><td>${needSol(dev).toFixed(3)} SOL</td></tr>`;
  }
  $('#fDev').addEventListener('input', costs); costs();

  // ---------- wallet ----------
  setInterval(() => { const w = WRLD.wallet(); if (w) $('#walletState').textContent = 'connected · ' + short(w.pk); }, 600);

  // ---------- launch ----------
  const err = m => { const e = $('#err'); e.textContent = m; e.hidden = !m; if (m) e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const STEPS = [['rec', 'destination recorded'], ['dep', 'deposit received'], ['make', 'coin created on pump.fun'], ['back', 'first buy sent back to you'], ['live', 'coin is live']];
  function prog(state) {
    const bad = ['failed', 'refunded', 'expired'].includes(state);
    const at = { waiting: 1, creating: 2, live: 5 }[state] || 1;
    $('#prog').innerHTML = STEPS.map(([k, t], i) => `<div class="s ${bad ? (i === 0 ? 'ok' : i === 1 ? 'bad' : '') : i < at ? 'ok' : i === at ? 'on' : ''}">${esc(t)}</div>`).join('');
  }
  let L = null, poll = null;
  async function sendDeposit() {
    const w = WRLD.wallet() || await WRLD.connect(); if (!w) return;
    if (!L) return;
    try {
      if (!window.solanaWeb3) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/js/web3.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      const { Transaction, SystemProgram, PublicKey } = window.solanaWeb3;
      const bh = await api('/api/launch?op=blockhash'); if (!bh || !bh.ok) throw new Error('Solana didn’t answer. Try again.');
      const from = new PublicKey(w.pk);
      const tx = new Transaction({ feePayer: from, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }).add(SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(L.wallet), lamports: L.need }));
      $('#depMsg').textContent = 'approve the transfer in your wallet…';
      let sig = null;
      if (w.p.signAndSendTransaction) { const r = await w.p.signAndSendTransaction(tx); sig = r && (r.signature || r); }
      else { const s = await w.p.signTransaction(tx); const r = await post('/api/launch?op=relay', { tx: btoa(String.fromCharCode(...s.serialize())) }); if (!r.ok) throw new Error(r.error); sig = r.sig; }
      $('#depMsg').innerHTML = `sent: <a class="u" href="${WRLD.tx(String(sig))}" target="_blank" rel="noopener">${esc(short(String(sig)))}</a>. waiting for it to land…`;
    } catch (e) { $('#depMsg').innerHTML = `<span class="red">${esc((e && e.message) || 'The transfer was cancelled.')}</span> You can also send it from any wallet.`; }
  }
  function depositBox(d) {
    $('#dep').innerHTML = `<div class="box"><div class="bd">
      <div style="margin-bottom:8px">send exactly <b>${d.needSol} SOL</b> to the coin’s wallet:</div>
      <div class="addr"><code>${esc(d.wallet)}</code><button class="br sm" type="button" data-copy="${esc(d.wallet)}" data-what="Wallet copied">copy</button><button class="br sm" type="button" data-copy="${d.needSol}" data-what="Amount copied">copy amount</button></div>
      <div class="cta" style="margin-top:12px"><button class="btn" type="button" id="sendDep">send it with my wallet <span class="k">-&gt;</span></button></div>
      <div id="depMsg" class="dim" style="margin-top:10px;font-size:12.5px">this page checks every few seconds. the engine also checks, so you can close it once the transfer is sent.</div>
      <div class="dim" style="margin-top:8px;font-size:12px">the coin’s address will be <code>${esc(d.mint)}</code>. a launch that isn’t funded within 3 hours is cancelled and anything sent is returned.</div></div></div>`;
    $('#sendDep').addEventListener('click', sendDeposit);
  }
  function done(d) {
    clearInterval(poll); try { localStorage.removeItem('wrld:launch'); } catch {}
    $('#dep').innerHTML = `<div class="msg ok"><b>$${esc(d.symbol)} is live.</b> its political destination is public.<div class="cta" style="margin-top:10px"><a class="btn" href="/coin?m=${esc(d.mint)}">open the coin <span class="k">-&gt;</span></a>
      <a class="br" href="https://pump.fun/coin/${esc(d.mint)}" target="_blank" rel="noopener">pump.fun</a>${d.create_sig ? `<a class="br" href="${WRLD.tx(d.create_sig)}" target="_blank" rel="noopener">creation tx</a>` : ''}</div></div>`;
  }
  async function check() {
    if (!L) return;
    const d = await api('/api/launch?op=status&id=' + encodeURIComponent(L.id)); if (!d || !d.ok) return;
    prog(d.state, d);
    if (d.state === 'waiting' && !$('#sendDep')) depositBox(d);
    if (d.state === 'waiting' && d.balance != null && d.balance > 0 && $('#depMsg')) $('#depMsg').textContent = `${(d.balance / 1e9).toFixed(4)} of ${d.needSol} SOL arrived.`;
    if (d.state === 'creating') $('#dep').innerHTML = '<div class="msg ok">deposit in. creating the coin on pump.fun…</div>';
    if (d.state === 'live') done(d);
    if (['failed', 'expired', 'refunded'].includes(d.state)) { clearInterval(poll); try { localStorage.removeItem('wrld:launch'); } catch {}
      $('#dep').innerHTML = `<div class="msg">the launch ${d.state === 'expired' ? 'expired' : 'didn’t go through'}${d.err ? ': ' + esc(d.err.slice(0, 160)) : ''}. ${d.refund_sig ? `your deposit was returned: <a class="u" href="${WRLD.tx(d.refund_sig)}" target="_blank" rel="noopener">refund tx</a>` : 'anything you sent is being returned automatically.'}</div>`; }
  }
  function track(d) { L = d; $('#flow').hidden = false; prog('waiting', d); depositBox(d); clearInterval(poll); poll = setInterval(check, 3500); check(); try { localStorage.setItem('wrld:launch', JSON.stringify({ id: d.id, wallet: d.wallet, need: d.need, needSol: d.needSol, mint: d.mint, symbol: d.symbol })); } catch {} }
  try { const s = JSON.parse(localStorage.getItem('wrld:launch') || 'null'); if (s && s.id) { track(s); toast('Picking up your launch where it left off'); } } catch {}

  $('#go').addEventListener('click', async e => {
    err('');
    const name = $('#fName').value.trim(), symbol = $('#fSym').value.trim().replace(/^\$/, '').toUpperCase(), domainSite = $('#fWeb').value.trim();
    if (!name) return err('Give the coin a name.');
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return err('The ticker is 1–10 letters or numbers.');
    if (!IMG) return err('Add a picture for the coin.');
    if (!/^https:\/\//i.test(domainSite)) return err('Choose a political destination or paste its HTTPS site link.');
    const b = e.currentTarget;
    b.disabled = true; b.textContent = 'connect wallet…';
    const w = WRLD.wallet() || await WRLD.connect();
    if (!w) { b.disabled = false; b.innerHTML = 'launch <span class="k">-&gt;</span>'; return err('Phantom was not detected or the wallet connection was cancelled. Open this page in Phantom or install the Phantom extension, then connect again.'); }
    b.textContent = 'preparing…'; $('#flow').hidden = false; $('#dep').innerHTML = '<div class="msg">uploading metadata and preparing the two Pump V2 transactions…</div>';
    try {
      const image = await (await fetch(IMG)).blob(); const body = new FormData();
      body.set('launch', JSON.stringify({ wallet:w.pk, name, symbol, description:$('#fDesc').value.trim(), domainUrl:domainSite, initialBuySol:String($('#fDev').value) }));
      body.set('file', image, 'token.jpg'); const prepared = await fetch('/api/deploy', { method:'POST', body }).then(async r => { const j=await r.json(); if(!r.ok) throw Error(j.error||'Launch preparation failed.'); return j; });
      const steps = prepared.transactions || [{ phase:'single', transaction:prepared.transaction }];
      if (!steps[0]?.transaction) throw Error('No Pump V2 transaction was prepared.');
      if (!window.solanaWeb3) await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://unpkg.com/@solana/web3.js@1.98.2/lib/index.iife.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s);});
      for (const step of steps) { const tx=window.solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(step.transaction),c=>c.charCodeAt(0))); $('#dep').innerHTML=`<div class="msg">approve ${step.phase==='buy'?'the initial buy':'the token creation'} in your wallet…</div>`; if(!w.p.signTransaction) throw Error('This wallet cannot sign the launch transaction.'); const signed=await w.p.signTransaction(tx); const encoded=btoa(String.fromCharCode(...signed.serialize())); const confirmed=await fetch('/api/deploy/confirm',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({intentId:prepared.intentId,phase:step.phase,transaction:encoded})}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||'Launch confirmation failed.');return j;}); if(confirmed.status!=='confirmed') throw Error('Launch is still confirming.'); }
      $('#dep').innerHTML=`<div class="msg ok"><b>$${esc(symbol)} is live.</b><div class="cta" style="margin-top:10px"><a class="btn" href="/${esc(prepared.mint)}">open the political token page <span class="k">-&gt;</span></a><a class="br" href="https://pump.fun/coin/${esc(prepared.mint)}" target="_blank" rel="noopener">pump.fun</a></div><div style="margin-top:10px;font-size:12px">destination site: ${esc(domainSite)}<br>metadata: https://politic.fun/${esc(prepared.mint)}</div></div>`; toast('Political destination launch confirmed');
    } catch (ex) { err(ex.message || 'Launch failed.'); $('#dep').innerHTML = `<div class="msg"><span class="red">${esc(ex.message || 'Launch failed.')}</span></div>`; } finally { b.disabled = false; b.innerHTML = 'launch <span class="k">-&gt;</span>'; }
  });
})();
