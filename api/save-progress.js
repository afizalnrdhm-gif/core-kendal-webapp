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

// Ubah index kolom (0-based) jadi huruf kolom A1 notation (0->A, 1->B, ..., 26->AA, dst)
function colLetter(index) {
  let s = '';
  index += 1;
  while (index > 0) {
    const rem = (index - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    index = Math.floor((index - 1) / 26);
  }
  return s;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) {
      res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' });
      return;
    }
    const email = await verifyIdToken(idToken);

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { noKontrak, rowNumber, janjiBayar, kronologis } = body || {};
    if (!noKontrak || !rowNumber) {
      res.status(400).json({ error: 'Data tidak lengkap (noKontrak/rowNumber kosong).' });
      return;
    }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    const isAdmin = adminEmails.indexOf(email) > -1;

    // Ambil header (baris 1) + baris target sekaligus, buat cari posisi kolom & verifikasi kepemilikan
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet` +
      `?ranges=${encodeURIComponent('MASTER!1:1')}` +
      `&ranges=${encodeURIComponent('MASTER!' + rowNumber + ':' + rowNumber)}` +
      `&valueRenderOption=UNFORMATTED_VALUE`;
    const batchRes = await fetch(batchUrl, { headers: { Authorization: 'Bearer ' + accessToken } });
    const batchJson = await batchRes.json();
    const ranges = batchJson.valueRanges || [];
    const header = (ranges[0] && ranges[0].values && ranges[0].values[0]) || [];
    const targetRow = (ranges[1] && ranges[1].values && ranges[1].values[0]) || [];

    const idxNoKontrak = header.findIndex(h => (h || '').toString().trim() === 'NO KONTRAK');
    const idxEmailCo = header.findIndex(h => (h || '').toString().trim() === 'EMAIL CO');
    const idxJanji = header.findIndex(h => (h || '').toString().trim() === 'JANJI BAYAR');
    const idxKron = header.findIndex(h => (h || '').toString().trim() === 'KRONOLOGIS');

    if (idxNoKontrak === -1 || idxJanji === -1 || idxKron === -1) {
      res.status(500).json({ error: 'Kolom NO KONTRAK / JANJI BAYAR / KRONOLOGIS tidak ditemukan di sheet MASTER.' });
      return;
    }

    const actualNoKontrak = (targetRow[idxNoKontrak] || '').toString().trim();
    if (actualNoKontrak !== noKontrak.toString().trim()) {
      res.status(409).json({ error: 'Baris tidak cocok dengan kontrak ini (data mungkin sudah berubah). Coba muat ulang halaman.' });
      return;
    }

    if (!isAdmin) {
      const ownerEmail = (targetRow[idxEmailCo] || '').toString().trim().toLowerCase();
      if (ownerEmail !== email) {
        res.status(403).json({ error: 'Kamu tidak punya akses untuk mengubah kontrak ini.' });
        return;
      }
    }

    const janjiCol = colLetter(idxJanji);
    const kronCol = colLetter(idxKron);

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            { range: `MASTER!${janjiCol}${rowNumber}`, values: [[janjiBayar != null ? String(janjiBayar) : '']] },
            { range: `MASTER!${kronCol}${rowNumber}`, values: [[kronologis != null ? String(kronologis) : '']] }
          ]
        })
      }
    );
    const updateJson = await updateRes.json();
    if (!updateRes.ok || updateJson.error) {
      res.status(500).json({ error: 'Gagal menyimpan ke sheet: ' + JSON.stringify(updateJson.error || updateJson) });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
