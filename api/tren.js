const { getAccessToken, sendError, verifyIdToken } = require('./_auth');

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
    sendError(res, err, 'Gagal memuat tren.');
  }
};
