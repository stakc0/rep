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
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path || '');
  if (!['world', 'coins', 'launch', 'tick'].includes(path)) {
    res.status(404).json({ ok: false, error: 'Not found' });
    return;
  }
  const target = new URL(`https://www.wrlddo.trade/api/${path}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path' && value != null) target.searchParams.set(key, Array.isArray(value) ? value[0] : value);
  }
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    const upstream = await fetch(target, {
      method: req.method,
      headers: { 'content-type': req.headers['content-type'] || 'application/json' },
      body: body?.length ? body : undefined
    });
    const data = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.send(data);
  } catch (error) {
    res.status(502).json({ ok: false, error: error instanceof Error ? error.message : 'Upstream unavailable' });
  }
}
