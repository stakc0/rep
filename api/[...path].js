import { directPrepare, directConfirm, listLaunches } from '../launch-direct.mjs';

export const config = { api: { bodyParser: false } };

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
    if (!['world', 'coins', 'launch', 'tick'].includes(path)) return res.status(404).json({ ok: false, error: 'Not found' });
    const target = new URL(`https://www.wrlddo.trade/api/${path}`);
    for (const [key, value] of Object.entries(req.query)) if (key !== 'path' && value != null) target.searchParams.set(key, Array.isArray(value) ? value[0] : value);
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const upstream = await fetch(target, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' }, body: body?.length ? body : undefined });
    const data = Buffer.from(await upstream.arrayBuffer()); res.status(upstream.status); res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); return res.send(data);
  } catch (error) { return res.status(error.status || 502).json({ ok: false, error: error.message || 'Service unavailable' }); }
}
