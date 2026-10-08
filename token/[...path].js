export default function handler(req, res) {
  const raw = req.query?.path;
  const mint = Array.isArray(raw) ? raw[0] : String(raw || '');
  res.writeHead(302, { Location: `/token?m=${encodeURIComponent(mint)}` });
  res.end();
}
