const crypto = require('crypto');

// ============================================================
// AUTH HELPERS (sama seperti di api/data.js)
// ============================================================
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  const signature = signer.sign(privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  if (!data.email || data.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Token login tidak valid.');
  if (data.email_verified !== 'true' && data.email_verified !== true) throw new Error('Email belum terverifikasi Google.');
  return data.email.toLowerCase();
}

async function fetchSheetRange(sheetId, range, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const json = await res.json();
  if (!json.values) throw new Error('Gagal baca range ' + range + ': ' + JSON.stringify(json));
  return json.values;
}

function parseSheetGeneric(values, headerRowIndex) {
  headerRowIndex = headerRowIndex || 0;
  if (!values || values.length <= headerRowIndex) return [];
  const header = values[headerRowIndex];
  const seen = {}; const keepIdx = [];
  header.forEach((h, i) => { const hh = (h || '').toString().trim(); if (seen[hh]) return; seen[hh] = true; keepIdx.push(i); });
  const finalHeader = keepIdx.map(i => (header[i] || '').toString().trim());
  const rows = [];
  for (let r = headerRowIndex + 1; r < values.length; r++) {
    const raw = values[r] || [];
    const rec = {};
    keepIdx.forEach((idx, j) => { let v = raw[idx]; if (typeof v === 'string') v = v.trim(); rec[finalHeader[j]] = v === undefined ? '' : v; });
    rows.push(rec);
  }
  return rows;
}

const YEAR_COLS = ['2026','2025','2024','2023','2022','2021','2020','2019','2018','2017','2016','2015','2014','2013','2012','2011','2010'];

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' }); return; }
    await verifyIdToken(idToken);

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const mode = (req.query && req.query.mode) || 'list-types';

    if (mode === 'list-types') {
      // Kirim daftar Type ID sistem (buat autocomplete di form) — TIDAK kirim harga, biar payload kecil.
      const mappingRaw = await fetchSheetRange(sheetId, 'TYPE_ID_MAPPING', accessToken);
      const mapping = parseSheetGeneric(mappingRaw, 0)
        .filter(r => r['TYPE_ID_SISTEM'] && (r['VALIDATION'] || '').toString().trim() === '√');
      const seen = {};
      const list = [];
      mapping.forEach(r => {
        const key = (r['TYPE_ID_SISTEM'] || '').toString().trim().toUpperCase();
        if (!key || seen[key]) return;
        seen[key] = true;
        list.push({
          typeIdSistem: r['TYPE_ID_SISTEM'],
          modelSistem: r['MODEL_ID_SISTEM'] || '',
          merk: r['MERK'] || ''
        });
      });
      res.status(200).json({ types: list, generatedAt: new Date().toISOString() });
      return;
    }

    if (mode === 'lookup') {
      const typeId = ((req.query && req.query.typeId) || '').toString().trim().toUpperCase();
      if (!typeId) { res.status(400).json({ error: 'typeId wajib diisi.' }); return; }

      const [mappingRaw, priceRaw] = await Promise.all([
        fetchSheetRange(sheetId, 'TYPE_ID_MAPPING', accessToken),
        fetchSheetRange(sheetId, 'OTR_PRICELIST', accessToken)
      ]);
      const mapping = parseSheetGeneric(mappingRaw, 0);

      // Sheet aslinya (Excel) pakai cell gabungan (merge) buat TYPE_ID_HARGA/MODEL_ID_HARGA di banyak baris
      // sekaligus. Pas di-copy ke Google Sheets, cuma baris pertama tiap grup yang kebawa nilainya, baris
      // lain jadi kosong. Di sini kita "isi turun" (forward-fill) niru perilaku merge itu, reset tiap ada
      // baris kosong (pemisah antar grup/model).
      let lastTypeIdHarga = '', lastModelIdHarga = '';
      mapping.forEach(r => {
        if (!r['TYPE_ID_SISTEM']) { lastTypeIdHarga = ''; lastModelIdHarga = ''; return; }
        if (r['TYPE_ID_HARGA']) { lastTypeIdHarga = r['TYPE_ID_HARGA']; lastModelIdHarga = r['MODEL_ID_HARGA']; }
        else { r['TYPE_ID_HARGA'] = lastTypeIdHarga; r['MODEL_ID_HARGA'] = lastModelIdHarga; }
      });

      const mapRow = mapping.find(r =>
        (r['TYPE_ID_SISTEM'] || '').toString().trim().toUpperCase() === typeId &&
        (r['VALIDATION'] || '').toString().trim() === '√'
      );
      if (!mapRow) { res.status(404).json({ error: 'Type ID tidak ditemukan.' }); return; }

      const typeIdHarga = (mapRow['TYPE_ID_HARGA'] || '').toString().trim();
      const priceList = parseSheetGeneric(priceRaw, 0);
      const priceRow = priceList.find(r => (r['TYPE_ID'] || '').toString().trim().toUpperCase() === typeIdHarga.toUpperCase());
      if (!priceRow) { res.status(404).json({ error: `Type ID ditemukan (grup harga "${typeIdHarga}") tapi kode itu tidak ada di kolom TYPE_ID sheet OTR_PRICELIST.` }); return; }

      const priceByYear = {};
      YEAR_COLS.forEach(y => {
        const v = priceRow[y];
        const raw = typeof v === 'number' ? v : (parseFloat(v) || 0);
        priceByYear[y] = raw * 1000; // sheet OTR_PRICELIST nyimpen harga dalam satuan ribuan
      });

      res.status(200).json({
        typeIdSistem: mapRow['TYPE_ID_SISTEM'],
        modelSistem: mapRow['MODEL_ID_SISTEM'] || '',
        modelHarga: priceRow['MODEL_ID'] || mapRow['MODEL_ID_HARGA'] || '',
        priceByYear
      });
      return;
    }

    res.status(400).json({ error: 'mode tidak dikenali.' });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
