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

// Bucket yang masuk cakupan ENR (NOOD sampai P181_210 saja)
const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210'];
const BUCKET_LABEL = {
  NOOD:'NOOD', P001_030:'Bucket 01-30', P031_060:'Bucket 31-60', P061_090:'Bucket 61-90',
  P091_120:'Bucket 91-120', P121_150:'Bucket 121-150', P151_180:'Bucket 151-180', P181_210:'Bucket 181-210'
};
function sipokOf(m){ return typeof m['SIPOK'] === 'number' ? m['SIPOK'] : 0; }
function sisaOf(k){ return typeof k['SISA PIUTANG'] === 'number' ? k['SISA PIUTANG'] : 0; }
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
    const email = await verifyIdToken(idToken);

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    if (adminEmails.indexOf(email) === -1) {
      res.status(403).json({ error: 'Menu ini khusus admin/head.' });
      return;
    }

    const accessToken = await getAccessToken();
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

      const bucketAmounts = {}; const bucketCounts = {};
      BUCKET_ORDER.forEach(b => { bucketAmounts[b] = 0; bucketCounts[b] = 0; });
      kaRows.forEach(ka => {
        if (!passFleet(ka)) return;
        const b = ka['BUCKET UPDATE'];
        if (BUCKET_ORDER.indexOf(b) > -1) { bucketAmounts[b] += sisaOf(ka); bucketCounts[b] += 1; }
      });
      const enr = BUCKET_ORDER.reduce((s, b) => s + bucketAmounts[b], 0);
      const enrCount = BUCKET_ORDER.reduce((s, b) => s + bucketCounts[b], 0);

      const perBucket = BUCKET_ORDER.map(b => ({
        label: BUCKET_LABEL[b],
        amount: bucketAmounts[b],
        count: bucketCounts[b],
        pct: enr > 0 ? (bucketAmounts[b] / enr) * 100 : 0
      }));

      function cumulativeFrom(startIdx) {
        return {
          amount: BUCKET_ORDER.slice(startIdx).reduce((s, b) => s + bucketAmounts[b], 0),
          count: BUCKET_ORDER.slice(startIdx).reduce((s, b) => s + bucketCounts[b], 0)
        };
      }
      const cumulative = [
        { label: '0+ (TOD)', ...cumulativeFrom(1) },
        { label: '30+ (Delq)', ...cumulativeFrom(2) },
        { label: '60+', ...cumulativeFrom(3) },
        { label: '90+ (NPL)', ...cumulativeFrom(4) },
        { label: '180+', ...cumulativeFrom(7) }
      ].map(r => ({ ...r, pct: enr > 0 ? (r.amount / enr) * 100 : 0 }));

      function flowStat(asal, target) {
        let totalAsal = 0, amt = 0, countAmt = 0;
        masterRows.forEach(m => {
          if (!passFleet(m)) return;
          if (m['BUCKET AWAL'] !== asal) return;
          const sipok = sipokOf(m);
          totalAsal += sipok;
          if (m['BUCKET UPDATE'] === target) { amt += sipok; countAmt += 1; }
        });
        return { amount: amt, count: countAmt, pct: totalAsal > 0 ? (amt / totalAsal) * 100 : 0 };
      }

      const flowBtc = [
        { label: 'Flow NOOD', ...flowStat('NOOD', 'P001_030') },
        { label: 'Flow 1-30', ...flowStat('P001_030', 'P031_060') },
        { label: 'Flow 31-60', ...flowStat('P031_060', 'P061_090') },
        { label: 'Btc 01-30', ...flowStat('P001_030', 'NOOD') },
        { label: 'Btc 31-60', ...flowStat('P031_060', 'NOOD') }
      ];

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

      return { enr, enrCount, perBucket, cumulative, flowBtc, bigCust };
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
