export default function handler(req, res) {
  const raw = req.query?.path;
  const fromUrl = String(req.url || '').split('?')[0].split('/').filter(Boolean).pop() || '';
  const mint = Array.isArray(raw) ? raw[0] : String(raw || fromUrl);
  res.writeHead(302, { Location: `/token?m=${encodeURIComponent(mint)}` });
  res.end();
}
