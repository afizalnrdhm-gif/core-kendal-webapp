const crypto = require('crypto');

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

// Target tier-1 / tier-2 insentif penyelesaian per minggu (sama dengan api/insentif.js & log-snapshot.js)
const TARGETS = {
  FE:  { 1: [40, 35], 2: [60, 55], 3: [75, 70], 4: [95, 90] },
  MR:  { 1: [30, 25], 2: [50, 45], 3: [65, 60], 4: [75, 70] },
  BCH: { 1: [32, 27], 2: [52, 47], 3: [68, 63], 4: [83, 78] }
};

// Bulan "efektif" = H-1 dalam WIB (data MASTER ditarik pagi hari dan mencerminkan kemarin)
function bulanEfektif() {
  const t = new Date(Date.now() + 7 * 3600 * 1000 - 24 * 3600 * 1000);
  return { tahun: t.getUTCFullYear(), bulan: t.getUTCMonth() + 1 };
}

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' }); return; }
    const email = await verifyIdToken(idToken);
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    if (adminEmails.indexOf(email) === -1) { res.status(403).json({ error: 'Menu ini khusus admin/head.' }); return; }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('LOG_MINGGUAN')}?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } });
    const j = await r.json();
    const values = j.values || [];
    const header = (values[0] || []).map(h => (h || '').toString().trim());
    const ix = k => header.indexOf(k);
    const cur = bulanEfektif();
    const prev = cur.bulan === 1 ? { tahun: cur.tahun - 1, bulan: 12 } : { tahun: cur.tahun, bulan: cur.bulan - 1 };
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const v = values[i] || [];
      const tahun = Number(v[ix('TAHUN')]), bulan = Number(v[ix('BULAN')]);
      const ok = (tahun === cur.tahun && bulan === cur.bulan) || (tahun === prev.tahun && bulan === prev.bulan);
      if (!ok) continue;
      rows.push({
        tahun, bulan, minggu: Number(v[ix('MINGGU')]), role: (v[ix('ROLE')] || '').toString(),
        namaCO: (v[ix('NAMA_CO')] || '').toString(), pct: Number(v[ix('PCT')])
      });
    }
    res.status(200).json({ cur, prev, rows, targets: TARGETS, tersedia: header.length > 0 });
  } catch (err) {
    console.error('Error tren:', err && err.message);
    const m = (err && err.message) || '';
    res.status(500).json({ error: /Token login|Email belum/.test(m) ? m : 'Gagal memuat tren.' });
  }
};
