const crypto = require('crypto');
const { readLog } = require('./_tl');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claimSet));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gagal ambil access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function verifyIdToken(idToken) {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  const data = await res.json();
  if (!data.email || data.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Token login tidak valid.');
  }
  if (data.email_verified !== 'true' && data.email_verified !== true) {
    throw new Error('Email belum terverifikasi Google.');
  }
  return data.email.toLowerCase();
}

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' }); return; }
    const email = await verifyIdToken(idToken);

    const noKontrak = String((req.query && req.query.noKontrak) || '').trim();
    if (!noKontrak) { res.status(400).json({ error: 'noKontrak kosong.' }); return; }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    const isAdmin = adminEmails.indexOf(email) > -1;

    if (!isAdmin) {
      // Non-admin hanya boleh melihat riwayat kontrak miliknya sendiri
      const mr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } });
      const mj = await mr.json();
      const values = mj.values || [];
      const header = (values[0] || []).map(h => (h || '').toString().trim());
      const iK = header.indexOf('NO KONTRAK'), iE = header.indexOf('EMAIL CO');
      const row = values.find((v, i) => i > 0 && (v[iK] || '').toString().trim() === noKontrak);
      const owner = row && iE > -1 ? (row[iE] || '').toString().trim().toLowerCase() : '';
      if (owner !== email) { res.status(403).json({ error: 'Tidak punya akses ke riwayat kontrak ini.' }); return; }
    }

    const items = await readLog(accessToken, sheetId, noKontrak, 30);
    res.status(200).json({ items });
  } catch (err) {
    console.error('Error riwayat:', err && err.message);
    const m = (err && err.message) || '';
    res.status(500).json({ error: /Token login|Email belum/.test(m) ? m : 'Gagal memuat riwayat.' });
  }
};
