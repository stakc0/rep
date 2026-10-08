import { directPrepare, directConfirm, listLaunches } from '../launch-direct.mjs';

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const path = requestUrl.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  try {
    if (path === 'deploy' && req.method === 'POST') return res.status(200).json(await directPrepare(req));
    if (path === 'deploy/confirm' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      return res.status(200).json(await directConfirm(body));
    }
    if (path === 'tokens' && req.method === 'GET') return res.status(200).json({ ok: true, tokens: await listLaunches() });
    if (path === 'politics' && req.method === 'GET') return res.status(200).json(await politicsNews());
    if (path === 'polymarket' && req.method === 'GET') return res.status(200).json(await politicalMarkets());
    if (!['world', 'coins', 'launch', 'tick'].includes(path)) return res.status(404).json({ ok: false, error: 'Not found' });
    const target = new URL(`https://www.wrlddo.trade/api/${path}`);
    for (const [key, value] of Object.entries(req.query)) if (key !== 'path' && value != null) target.searchParams.set(key, Array.isArray(value) ? value[0] : value);
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const upstream = await fetch(target, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body: body?.length ? body : undefined });
    const data = Buffer.from(await upstream.arrayBuffer()); res.status(upstream.status); res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); return res.send(data);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message || 'Service unavailable' }); }
}
