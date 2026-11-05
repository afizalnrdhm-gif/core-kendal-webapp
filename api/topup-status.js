// Update status tindak lanjut penawaran top up pinjaman (menu "Jualan Top Up").
// Cuma email yang ada di TOPUP_OWNER_EMAILS yang boleh baca/tulis tab TOPUP_STATUS —
// dicek di sini juga, bukan cuma disembunyikan di UI, karena ini data privat milik BCH.
const { getAccessToken, sendError, verifyIdToken } = require('./_auth');

const STATUS_OK = ['BELUM DIHUBUNGI', 'SUDAH DITAWARI', 'TERTARIK', 'TIDAK TERTARIK'];

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

    const ownerEmails = (process.env.TOPUP_OWNER_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (ownerEmails.indexOf(email) === -1) {
      res.status(403).json({ error: 'Kamu tidak punya akses ke fitur ini.' });
      return;
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const noKontrak = (body && body.noKontrak || '').toString().trim();
    const status = (body && body.status || '').toString().trim().toUpperCase();
    if (!noKontrak) {
      res.status(400).json({ error: 'noKontrak wajib diisi.' });
      return;
    }
    if (STATUS_OK.indexOf(status) === -1) {
      res.status(400).json({ error: 'Status harus salah satu dari: ' + STATUS_OK.join(', ') + '.' });
      return;
    }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/TOPUP_STATUS?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: 'Bearer ' + accessToken } });
    const readJson = await readRes.json();
    if (readJson.error) {
      throw new Error('Gagal baca tab TOPUP_STATUS (pastikan tabnya sudah dibuat): ' + JSON.stringify(readJson.error));
    }
    const values = readJson.values || [];
    const header = values[0] || ['NO KONTRAK', 'STATUS', 'UPDATED_AT', 'UPDATED_BY'];
    const idxKontrak = header.findIndex(h => (h || '').toString().trim() === 'NO KONTRAK');
    const idxStatus = header.findIndex(h => (h || '').toString().trim() === 'STATUS');
    const idxUpdatedAt = header.findIndex(h => (h || '').toString().trim() === 'UPDATED_AT');
    const idxUpdatedBy = header.findIndex(h => (h || '').toString().trim() === 'UPDATED_BY');

    const now = new Date().toISOString();
    let rowIndex = -1; // 0-based, relatif ke `values` (termasuk header di index 0)
    for (let i = 1; i < values.length; i++) {
      if ((values[i][idxKontrak] || '').toString().trim() === noKontrak) { rowIndex = i; break; }
    }

    if (rowIndex > -1) {
      const sheetRow = rowIndex + 1; // 1-based buat A1 notation
      const writes = [
        { range: `TOPUP_STATUS!${colLetter(idxStatus)}${sheetRow}`, values: [[status]] },
        { range: `TOPUP_STATUS!${colLetter(idxUpdatedAt)}${sheetRow}`, values: [[now]] },
        { range: `TOPUP_STATUS!${colLetter(idxUpdatedBy)}${sheetRow}`, values: [[email]] }
      ];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: writes })
      });
    } else {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/TOPUP_STATUS!A:D:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[noKontrak, status, now, email]] })
      });
    }

    res.status(200).json({ ok: true, status, updatedAt: now });
  } catch (err) {
    console.error('Error topup-status:', err && err.message);
    sendError(res, err);
  }
};
