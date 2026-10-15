import { directPrepare, directConfirm, listLaunches } from '../launch-direct.mjs';
import { PublicKey } from '@solana/web3.js';

export const config = { api: { bodyParser: false } };

const RSS_SOURCES = [
  ['NYT Politics', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'nytimes.com'],
  ['Politico', 'https://rss.politico.com/politics-news.xml', 'politico.com'],
  ['The Hill', 'https://thehill.com/homenews/feed/', 'thehill.com'],
  ['BBC US', 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', 'bbc.com']
];
function stripTags(value = '') { return String(value).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
function xmlTag(item, tag) { return stripTags((item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')) || [])[1] || ''); }
async function politicsNews() {
  const settled = await Promise.allSettled(RSS_SOURCES.map(async ([source, url, domain]) => {
    const r = await fetch(url, { headers: { 'user-agent': 'politic.fun/1.0' }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error(`${source} returned ${r.status}`);
    const xml = await r.text();
    return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, 6).map(item => ({ source, domain, title: xmlTag(item[0], 'title'), url: xmlTag(item[0], 'link'), published: xmlTag(item[0], 'pubDate') })).filter(x => x.title && x.url);
  }));
  const items = settled.flatMap(x => x.status === 'fulfilled' ? x.value : []).sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 12);
  return { ok: items.length > 0, at: Date.now(), items, sources: settled.filter(x => x.status === 'fulfilled').length };
}
async function politicalMarkets() {
  const r = await fetch('https://gamma-api.polymarket.com/events?active=true&closed=false&limit=60&order=volume24hr&ascending=false&tag_slug=politics', { headers: { accept: 'application/json', 'user-agent': 'politic.fun/1.0', origin: 'https://polymarket.com' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Polymarket returned ${r.status}`);
  const events = await r.json(), markets = [];
  for (const event of Array.isArray(events) ? events : []) for (const market of (event.markets || []).slice(0, 3)) {
    let prices = []; try { prices = JSON.parse(market.outcomePrices || '[]'); } catch {}
    const yes = Number(prices[0]); if (!market.question || !Number.isFinite(yes)) continue;
    markets.push({ question: market.question, yes: Math.round(yes * 100), volume: Number(market.volume24hr || market.volume || 0), url: `https://polymarket.com/event/${event.slug || market.slug || event.id}` });
  }
  return { ok: true, at: Date.now(), markets: markets.sort((a, b) => b.volume - a.volume).slice(0, 8) };
}

let tokenCache = { at: 0, tokens: [] };
const CREATOR_FEE_WALLET = '1iqoin4QcFPeVusTYdmQFZoonbZAXAhucvLxhpf78gN';
async function tokenImage(uri) {
  if (!uri) return '';
  try { const r = await fetch(uri, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) }); const j = await r.json(); return j.image || j.image_url || ''; } catch { return ''; }
}
async function tokenMarkets() {
  const rows = await listLaunches();
  const tokens = await Promise.all(rows.slice(0, 100).map(async row => {
    let market = {};
    try {
      const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(row.mint)}`, { headers: { accept: 'application/json', 'user-agent': 'politic.fun/1.0' }, signal: AbortSignal.timeout(6000) });
      const j = await r.json();
      const pairs = (j.pairs || []).filter(x => x.chainId === 'solana').sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
      const pair = pairs[0];
      if (pair) market = { marketCapUsd: Number(pair.marketCap || pair.fdv || 0), volume24hUsd: Number(pair.volume?.h24 || 0), priceUsd: Number(pair.priceUsd || 0), dexUrl: pair.url || '' };
    } catch {}
    const image = row.image_url || await tokenImage(row.metadata_uri);
    return { ...row, image, ...market, creatorFeeWallet: CREATOR_FEE_WALLET };
  }));
  return tokens;
}
async function listedTokens() {
  if (Date.now() - tokenCache.at < 10000) return tokenCache.tokens;
  tokenCache = { at: Date.now(), tokens: await tokenMarkets() }; return tokenCache.tokens;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const CIELO_BASE = 'https://feed-api.cielo.finance/api/v1';
const SUPABASE_URL = process.env.DEFAULT_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.DEFAULT_SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SVS_RPC = process.env.SVS_RPC_HTTPS_ENDPOINT || process.env.PUMP_RPC_URL || 'https://api.mainnet-beta.solana.com';
const walletMemoryCache = new Map();
const CACHE_TTL_MS = 45_000;

function validWallet(value) {
  try { return new PublicKey(String(value || '')).toBase58(); } catch { throw Object.assign(new Error('Enter a valid Solana wallet address.'), { status: 400 }); }
}
async function cielo(path, params = {}) {
  if (!process.env.CIELO_API_KEY) throw Object.assign(new Error('Cielo API is not configured.'), { status: 503 });
  const u = new URL(`${CIELO_BASE}/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') u.searchParams.set(key, value);
  const r = await fetch(u, { headers: { accept: 'application/json', 'X-API-KEY': process.env.CIELO_API_KEY }, signal: AbortSignal.timeout(15000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || `Cielo returned ${r.status}`), { status: r.status });
  return data;
}
async function rpc(method, params) {
  const r = await fetch(SVS_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), signal: AbortSignal.timeout(10000) });
  const data = await r.json(); if (data.error) throw new Error(data.error.message || 'RPC error'); return data.result;
}
async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { ...options, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json', ...(options.headers || {}) }, signal: AbortSignal.timeout(10000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Supabase returned ${r.status}`);
  return r.status === 204 ? null : r.json();
}
async function cachedWalletRow(wallet) {
  const rows = await supabase(`rep_wallets?wallet=eq.${encodeURIComponent(wallet)}&select=*`).catch(() => null);
  return Array.isArray(rows) ? rows[0] || null : null;
}
async function cachedProfile(wallet) {
  const memory = walletMemoryCache.get(wallet);
  if (memory && Date.now() - memory.cachedAt < CACHE_TTL_MS) return memory.profile;
  const row = await cachedWalletRow(wallet);
  if (!row?.transactions || !row.last_seen_at || Date.now() - Date.parse(row.last_seen_at) >= CACHE_TTL_MS) return null;
  const reviews = (await supabase(`rep_reviews?wallet=eq.${encodeURIComponent(wallet)}&select=*&order=created_at.desc&limit=50`).catch(() => [])) || [];
  const profile = { ...row.profile, wallet, score: row.score, grade: row.grade, indicators: row.indicators || {}, balanceSol: Number(row.last_balance_sol || 0), transactions: row.transactions || [], performance: row.performance || null, reviews, indexedAt: Date.parse(row.last_seen_at) };
  walletMemoryCache.set(wallet, { cachedAt: Date.now(), profile });
  return profile;
}
function scoreWallet({ performance, reviews = [] }) {
  const p = performance?.data || performance || {};
  const winRate = Number(p.win_rate ?? p.winRate ?? p.metrics?.win_rate ?? 0);
  const pnl = Number(p.total_pnl ?? p.realized_pnl ?? p.realizedPnl ?? p.metrics?.total_pnl ?? 0);
  const trades = Number(p.total_trades ?? p.trade_count ?? p.metrics?.total_trades ?? 0);
  const warnings = reviews.filter(r => ['warning', 'exploitative', 'scam'].includes(String(r.category || '').toLowerCase())).length;
  const positive = reviews.filter(r => ['positive', 'reliable', 'helpful'].includes(String(r.category || '').toLowerCase())).length;
  const base = Math.round(Math.min(55, Math.max(0, winRate * .55)) + Math.min(25, Math.max(0, Math.log10(Math.max(1, Math.abs(pnl) + 1)) * 8)) + Math.min(15, trades / 20) + Math.min(10, positive * 2) - Math.min(35, warnings * 7));
  const total = Math.max(0, Math.min(100, base));
  return { score: total, grade: total >= 85 ? 'A+' : total >= 75 ? 'A' : total >= 65 ? 'B+' : total >= 52 ? 'B' : total >= 38 ? 'C' : 'D', indicators: { winRate, pnl, trades, warnings, positive } };
}
function normalizeTx(item) {
  const x = item?.tx || item?.transaction || item;
  return { signature: x?.tx_hash || x?.signature || x?.hash || x?.transaction_hash || '', type: x?.tx_type || x?.type || x?.event_type || 'activity', token: x?.token_symbol || x?.token?.symbol || x?.token_name || '', valueUsd: Number(x?.value_usd || x?.amount_usd || x?.value || 0), timestamp: x?.timestamp || x?.block_timestamp || x?.datetime || null, source: 'cielo' };
}
function stripHtml(value = '') { return String(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim(); }
async function kolscanLeaderboard() {
  const r = await fetch('https://kolscan.io/leaderboard', { headers: { 'user-agent': 'REP reputation index/1.0', accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Object.assign(new Error(`Kolscan returned ${r.status}`), { status: 502 });
  const html = await r.text(); const wallets = new Map();
  const accounts = /href="\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})\?timeframe=1"/g;
  let match;
  while ((match = accounts.exec(html))) {
    const wallet = match[1]; const chunk = html.slice(match.index, match.index + 2600); const name = stripHtml((chunk.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1] || ''); const avatar = (chunk.match(/https:\/\/kolscan-images\.pump\.fun\/profiles\/[^" ]+/) || [])[0] || '';
    const marker = `wallet_address\\":\\"${wallet}`; const dataPos = html.indexOf(marker); const dataChunk = dataPos >= 0 ? html.slice(dataPos, dataPos + 1800).replaceAll('\\"', '"') : ''; const xPos = dataChunk.indexOf('"twitter":"'); const xEnd = xPos >= 0 ? dataChunk.indexOf('"', xPos + 11) : -1; const twitter = xPos >= 0 && xEnd > xPos ? dataChunk.slice(xPos + 11, xEnd) : '';
    const profit = Number(dataChunk.match(/\"profit\":(-?[0-9.]+)/)?.[1] || 0);
    wallets.set(wallet, { wallet, name, avatar, twitter, profit, source: 'kolscan' });
  }
  return [...wallets.values()];
}
async function indexKolscan() {
  const rows = await kolscanLeaderboard();
  let indexed = 0;
  for (const row of rows) {
    const handle = row.twitter.match(/x\.com\/([A-Za-z0-9_]+)/)?.[1] || null;
    await supabase('rep_wallets', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ wallet: row.wallet, display_name: row.name || null, avatar_url: row.avatar || null, kolscan_profit: row.profit, profile: { source: row.source }, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }).catch(() => null);
    await supabase('rep_profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ wallet: row.wallet, x_handle: handle, display_name: row.name || null, avatar_url: row.avatar || null, updated_at: new Date().toISOString() }) }).catch(() => null);
    indexed++;
  }
  return { source: 'kolscan', found: rows.length, indexed, at: Date.now() };
}
async function walletProfile(wallet) {
  const cached = await cachedProfile(wallet);
  if (cached) return cached;
  const [portfolio, feed, performance, reviews, balance] = await Promise.all([
    cielo(`${wallet}/portfolio`).catch(() => null),
    cielo('feed', { wallet, chains: 'solana', limit: 5 }).catch(() => null),
    cielo(`${wallet}/enhanced-stats/profitability-performance`, { days: 'max' }).catch(() => null),
    supabase(`rep_reviews?wallet=eq.${encodeURIComponent(wallet)}&select=*&order=created_at.desc&limit=50`).catch(() => []),
    rpc('getBalance', [wallet, { commitment: 'confirmed' }]).catch(() => null),
  ]);
  const portfolioData = portfolio?.data || portfolio || {};
  const feedItems = feed?.data?.items || feed?.data?.transactions || feed?.items || feed?.transactions || [];
  const sol = balance?.value != null ? Number(balance.value) / 1e9 : Number(portfolioData.native_balance || portfolioData.sol_balance || 0);
  const txs = feedItems.slice(0, 5).map(normalizeTx);
  const rep = scoreWallet({ performance, reviews: reviews || [] });
  const indexedAt = new Date().toISOString();
  const profile = { wallet, balanceSol: sol, portfolioUsd: Number(portfolioData.total_usd_value || 0), transactions: txs, performance: performance?.data || performance || null, score: rep.score, grade: rep.grade, indicators: rep.indicators, reviews: reviews || [], indexedAt: Date.parse(indexedAt) };
  walletMemoryCache.set(wallet, { cachedAt: Date.now(), profile });
  await supabase('rep_wallets', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ wallet, score: rep.score, grade: rep.grade, indicators: rep.indicators, last_balance_sol: sol, performance: profile.performance, transactions: txs, profile: { portfolioUsd: profile.portfolioUsd }, last_seen_at: indexedAt, updated_at: indexedAt }) }).catch(() => null);
  await supabase('rep_score_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ wallet, score: rep.score, grade: rep.grade, indicators: rep.indicators, reason: 'index_refresh' }) }).catch(() => null);
  if (txs.length) await supabase('rep_wallet_transactions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(txs.map(tx => ({ wallet, signature: tx.signature || `${wallet}:${tx.timestamp || Date.now()}`, payload: tx, observed_at: indexedAt }))) }).catch(() => null);
  return profile;
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const path = requestUrl.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  try {
    if (path === 'deploy' && req.method === 'POST') return res.status(200).json(await directPrepare(req));
    if (path === 'deploy-confirm' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      return res.status(200).json(await directConfirm(body));
    }
    if (path === 'deploy/confirm' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      return res.status(200).json(await directConfirm(body));
    }
    if (path === 'tokens' && req.method === 'GET') { res.setHeader('cache-control', 'public, s-maxage=15, stale-while-revalidate=60'); return res.status(200).json({ ok: true, at: Date.now(), creatorFeeWallet: CREATOR_FEE_WALLET, tokens: await listedTokens() }); }
    if (path === 'politics' && req.method === 'GET') return res.status(200).json(await politicsNews());
    if (path === 'polymarket' && req.method === 'GET') return res.status(200).json(await politicalMarkets());
    if (path === 'kolscan' && req.method === 'GET') { const wallets = await kolscanLeaderboard(); res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300'); return res.status(200).json({ ok: true, source: 'kolscan', wallets, indexedAt: Date.now() }); }
    if (path === 'index/kolscan' && (req.method === 'POST' || req.method === 'GET')) return res.status(200).json({ ok: true, ...(await indexKolscan()) });
    if (path === 'wallet' && req.method === 'GET') {
      const wallet = validWallet(requestUrl.searchParams.get('address'));
      res.setHeader('cache-control', 'public, s-maxage=20, stale-while-revalidate=60');
      return res.status(200).json({ ok: true, ...(await walletProfile(wallet)) });
    }
    if (path === 'profile' && req.method === 'GET') {
      const wallet = validWallet(requestUrl.searchParams.get('wallet'));
      return res.status(200).json({ ok: true, profile: (await supabase(`rep_profiles?wallet=eq.${encodeURIComponent(wallet)}&select=*`).catch(() => []))?.[0] || null });
    }
    if (path === 'profile' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const wallet = validWallet(body.wallet); const handle = String(body.x_handle || '').replace(/^@/, '').trim().slice(0, 64); const displayName = String(body.display_name || '').trim().slice(0, 80); const bio = String(body.bio || '').trim().slice(0, 500);
      if (!handle && !displayName) throw Object.assign(new Error('Add an X handle or display name.'), { status: 400 });
      await supabase('rep_wallets', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ wallet }) });
      const rows = await supabase('rep_profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ wallet, x_handle: handle || null, display_name: displayName || null, bio: bio || null, updated_at: new Date().toISOString() }) });
      return res.status(200).json({ ok: true, profile: rows?.[0] || null });
    }
    if (path === 'reviews' && req.method === 'GET') {
      const wallet = validWallet(requestUrl.searchParams.get('wallet'));
      return res.status(200).json({ ok: true, reviews: (await supabase(`rep_reviews?wallet=eq.${encodeURIComponent(wallet)}&select=*&order=created_at.desc&limit=50`)) || [] });
    }
    if (path === 'reviews' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const wallet = validWallet(body.wallet); const category = String(body.category || 'observation').slice(0, 40); const text = String(body.text || '').trim().slice(0, 1200); const authorWallet = body.author_wallet ? validWallet(body.author_wallet) : null;
      if (text.length < 12) throw Object.assign(new Error('Review must contain at least 12 characters.'), { status: 400 });
      if (!SUPABASE_URL || !SUPABASE_KEY) throw Object.assign(new Error('Review database is not configured.'), { status: 503 });
      const rows = await supabase('rep_reviews', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ wallet, author_wallet: authorWallet, category, text, evidence_url: String(body.evidence_url || '').slice(0, 500) || null }) });
      walletMemoryCache.delete(wallet);
      return res.status(201).json({ ok: true, review: rows?.[0] || null });
    }
    if (path === 'links' && req.method === 'GET') {
      const wallet = validWallet(requestUrl.searchParams.get('wallet')); const links = (await supabase(`rep_wallet_links?or=(main_wallet.eq.${encodeURIComponent(wallet)},linked_wallet.eq.${encodeURIComponent(wallet)})&select=*&order=created_at.desc&limit=50`)) || [];
      return res.status(200).json({ ok: true, links });
    }
    if (path === 'links' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}'); const mainWallet = validWallet(body.main_wallet || body.wallet); const linkedWallet = validWallet(body.linked_wallet);
      if (mainWallet === linkedWallet) throw Object.assign(new Error('A wallet cannot link to itself.'), { status: 400 });
      const relation = String(body.relation || 'suspected_bundle').slice(0, 40); const rows = await supabase('rep_wallet_links', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ main_wallet: mainWallet, linked_wallet: linkedWallet, relation, evidence_url: String(body.evidence_url || '').slice(0, 500) || null }) });
      return res.status(201).json({ ok: true, link: rows?.[0] || null });
    }
    if (!['world', 'coins', 'launch', 'tick'].includes(path)) return res.status(404).json({ ok: false, error: 'Not found' });
    const target = new URL(`https://www.wrlddo.trade/api/${path}`);
    for (const [key, value] of Object.entries(req.query)) if (key !== 'path' && value != null) target.searchParams.set(key, Array.isArray(value) ? value[0] : value);
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const upstream = await fetch(target, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body: body?.length ? body : undefined });
    const data = Buffer.from(await upstream.arrayBuffer()); res.status(upstream.status); res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); return res.send(data);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message || 'Service unavailable' }); }
}
