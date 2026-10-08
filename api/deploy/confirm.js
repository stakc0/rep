import { directConfirm } from '../../launch-direct.mjs';

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
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    return res.status(200).json(await directConfirm(body));
  } catch (error) {
    return res.status(error.status || 502).json({ ok: false, error: error.message || 'Launch confirmation failed.' });
  }
}
