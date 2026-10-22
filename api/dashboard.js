const { getAccessToken, sendError, verifyIdToken } = require('./_auth');
const { cleanCell } = require('./_sheet');

function parseSheetValues(values, headerRowIndex) {
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
    keepIdx.forEach((idx, j) => { let v = raw[idx]; v = cleanCell(finalHeader[j], v); rec[finalHeader[j]] = v === undefined ? '' : v; });
    rows.push(rec);
  }
  return rows;
}

const { BUCKET_ORDER, BUCKET_LABEL, sipokOf, hitungKpi } = require('./_kpi');
function isSudahBayar(m){
  const st = (m['STATUS BAYAR'] || '').toString().trim().toUpperCase();
  return st.includes('SUDAH') || st.includes('LUNAS');
}
const BIGCUST_THRESHOLD = 100000000;
const BIGCUST_BUCKETS = ['NOOD', 'P001_030', 'P031_060'];

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan.' }); return; }
    // verifikasi login & token Sheets tidak saling bergantung: jalankan bersamaan
    const [email, accessToken] = await Promise.all([verifyIdToken(idToken), getAccessToken()]);

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    if (adminEmails.indexOf(email) === -1) {
      res.status(403).json({ error: 'Menu ini khusus admin/head.' });
      return;
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;

    const [masterRes, kaRes] = await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('KA HARIAN')}?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } })
    ]);
    const masterJson = await masterRes.json();
    const kaJson = await kaRes.json();

    const masterRows = parseSheetValues(masterJson.values || []).filter(r => r['NO KONTRAK']);
    const kaRows = parseSheetValues(kaJson.values || [], 15).filter(r => r['NO KONTRAK']); // header KA HARIAN di baris 16

    function computeVariant(includeFleet) {
      const passFleet = (row) => includeFleet || row['FLEET/NON FLEET'] !== 'FLEET';

      const kpi = hitungKpi(masterRows, kaRows, includeFleet);

      const bigCust = BIGCUST_BUCKETS.map(b => {
        const rows = masterRows.filter(m => passFleet(m) && m['BUCKET AWAL'] === b && sipokOf(m) > BIGCUST_THRESHOLD);
        const isBelum = m => (m['KRITERIA ACCT'] || '').toString().trim().toUpperCase() === 'FLOW';
        const belumRows = rows.filter(isBelum);
        const sudahRows = rows.filter(m => !isBelum(m));
        const sum = arr => arr.reduce((s, m) => s + sipokOf(m), 0);
        const perCO = {};
        belumRows.forEach(m => {
          const co = m['CO ALL'] || '(Tidak diketahui)';
          if (!perCO[co]) perCO[co] = { count: 0, amount: 0 };
          perCO[co].count += 1;
          perCO[co].amount += sipokOf(m);
        });
        const detailBelum = belumRows
          .slice().sort((a, b2) => sipokOf(b2) - sipokOf(a))
          .slice(0, 10)
          .map(m => ({ nama: m['NAMA KONSUMEN'] || '-', noKontrak: m['NO KONTRAK'] || '-', co: m['CO ALL'] || '-', sipok: sipokOf(m) }));
        return {
          label: BUCKET_LABEL[b],
          total: { count: rows.length, amount: sum(rows) },
          sudah: { count: sudahRows.length, amount: sum(sudahRows) },
          belum: { count: belumRows.length, amount: sum(belumRows) },
          belumPerCO: Object.keys(perCO).map(co => ({ co, count: perCO[co].count, amount: perCO[co].amount })).sort((a, b) => b.amount - a.amount),
          detailBelum
        };
      });

      return { ...kpi, bigCust };
    }

    res.status(200).json({
      all: computeVariant(true),
      nonfleet: computeVariant(false),
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    sendError(res, err);
  }
};
