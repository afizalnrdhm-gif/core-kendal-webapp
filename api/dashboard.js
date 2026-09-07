const crypto = require('crypto');

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
    keepIdx.forEach((idx, j) => { let v = raw[idx]; if (typeof v === 'string') v = v.trim(); rec[finalHeader[j]] = v === undefined ? '' : v; });
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

      return { enr, enrCount, perBucket, cumulative, flowBtc };
    }

    res.status(200).json({
      all: computeVariant(true),
      nonfleet: computeVariant(false),
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
