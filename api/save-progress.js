const crypto = require('crypto');
const { appendLog } = require('./_tl');

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
    const { noKontrak, rowNumber } = body || {};
    if (!noKontrak || !rowNumber || !Number.isInteger(Number(rowNumber)) || Number(rowNumber) < 2) {
      res.status(400).json({ error: 'Data tidak lengkap (noKontrak/rowNumber kosong).' });
      return;
    }
    // Validasi isi: Janji Bayar = tanggal 1-31 (atau kosong), Kronologis dibatasi panjangnya
    const janjiRaw = body.janjiBayar == null ? '' : String(body.janjiBayar).trim();
    if (janjiRaw !== '' && !(/^\d{1,2}$/.test(janjiRaw) && Number(janjiRaw) >= 1 && Number(janjiRaw) <= 31)) {
      res.status(400).json({ error: 'Janji Bayar harus berupa tanggal 1–31 (misal 07), atau dikosongkan.' });
      return;
    }
    const janjiBayar = janjiRaw;
    // Proyeksi: salah satu dari daftar (atau kosong). Hanya diubah kalau dikirim dari browser.
    const PROYEKSI_OK = ['STAY', 'BTC', 'ROLLBACK', 'FLOW', 'LUNAS'];
    const kirimProyeksi = body.proyeksi !== undefined;
    const proyeksi = body.proyeksi == null ? '' : String(body.proyeksi).trim().toUpperCase();
    if (proyeksi !== '' && PROYEKSI_OK.indexOf(proyeksi) === -1) {
      res.status(400).json({ error: 'Proyeksi harus salah satu dari: ' + PROYEKSI_OK.join(', ') + '.' });
      return;
    }
    let kronologis = body.kronologis == null ? '' : String(body.kronologis).trim();
    if (kronologis.length > 1000) {
      res.status(400).json({ error: 'Kronologis terlalu panjang (maksimal 1000 karakter).' });
      return;
    }
    // Cegah isi yang dibaca Sheets sebagai rumus (=, +, -, @ di awal) — simpan sebagai teks.
    if (/^[=+\-@]/.test(kronologis)) kronologis = "'" + kronologis;

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
    const idxProy = header.findIndex(h => (h || '').toString().trim() === 'PROYEKSI');
    const idxNama = header.findIndex(h => (h || '').toString().trim() === 'NAMA KONSUMEN');

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

    const janjiLama = (targetRow[idxJanji] == null ? '' : targetRow[idxJanji]).toString();
    const kronLama = (targetRow[idxKron] || '').toString();
    const proyLama = idxProy > -1 ? (targetRow[idxProy] || '').toString() : '';
    const janjiCol = colLetter(idxJanji);
    const kronCol = colLetter(idxKron);

    // Kolom PROYEKSI di MASTER dibuat otomatis (judul di baris 1) kalau belum ada.
    const proyCol = colLetter(idxProy > -1 ? idxProy : header.length);
    const proyeksiWrites = [{ range: `MASTER!${proyCol}${rowNumber}`, values: [[proyeksi]] }];
    if (idxProy === -1) proyeksiWrites.push({ range: `MASTER!${proyCol}1`, values: [['PROYEKSI']] });

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            { range: `MASTER!${janjiCol}${rowNumber}`, values: [[janjiBayar]] },
            { range: `MASTER!${kronCol}${rowNumber}`, values: [[kronologis]] }
          ].concat(kirimProyeksi ? proyeksiWrites : [])
        })
      }
    );
    const updateJson = await updateRes.json();
    if (!updateRes.ok || updateJson.error) {
      console.error('Gagal menyimpan ke sheet:', JSON.stringify(updateJson.error || updateJson));
      res.status(500).json({ error: 'Gagal menyimpan ke spreadsheet. Coba lagi, atau hubungi admin.' });
      return;
    }

    // Catat riwayat perubahan. Kegagalan mencatat tidak boleh membatalkan simpan.
    let logged = false;
    try {
      const kronBersih = kronologis.replace(/^'/, '');
      logged = await appendLog(accessToken, sheetId, [
        new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19), email, noKontrak.toString().trim(),
        idxNama > -1 ? (targetRow[idxNama] || '') : '', janjiBayar, kronBersih, janjiLama, kronLama,
        kirimProyeksi ? proyeksi : proyLama, proyLama
      ]);
    } catch (e) { console.error('Gagal catat log tindak lanjut:', e && e.message); }

    res.status(200).json({ success: true, logged });
  } catch (err) {
    console.error('Error save-progress:', err && err.message);
    const m = (err && err.message) || '';
    res.status(500).json({ error: /Token login|Email belum/.test(m) ? m : 'Gagal menyimpan. Coba lagi, atau hubungi admin.' });
  }
};
