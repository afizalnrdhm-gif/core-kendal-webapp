const { readLog } = require('./_tl');
const { getAccessToken, sendError, verifyIdToken } = require('./_auth');

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
    sendError(res, err, 'Gagal memuat riwayat.');
  }
};
