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
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
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

// ============================================================
// BUCKET & TIERING (persis sama seperti bot Telegram)
// ============================================================
const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240','P241_270'];
function bucketIndex(b) { return BUCKET_ORDER.indexOf(String(b || '').trim()); }
function sipokOf(m) { return typeof m['SIPOK'] === 'number' ? m['SIPOK'] : 0; }
function isLunas(m) {
  const status = (m['STATUS BAYAR'] || '').toString().toUpperCase();
  const kriteria = (m['KRITERIA ACCT'] || '').toString().toUpperCase();
  return status.includes('LUNAS') || kriteria.includes('LUNAS');
}

function tieringFlowEver1_30(p){ if(p>60)return 0.3; if(p>55)return 0.6; if(p>50)return 0.9; if(p>45)return 1.2; return 1.5; }
function tieringBalance1_30(p){ if(p>10)return 0.3; if(p>9.5)return 0.6; if(p>9)return 0.9; if(p>8.5)return 1.2; return 1.5; }
function tieringFlowNoOD(p){ if(p>4.2)return 0.4; if(p>3.7)return 0.8; if(p>3.2)return 1.2; if(p>2.7)return 1.6; return 2.0; }
function tieringFlowEver31_60(p){ if(p>70)return 0.3; if(p>65)return 0.6; if(p>60)return 0.9; if(p>55)return 1.2; return 1.5; }
function tieringBalance31_60(p){ if(p>2.4)return 0.3; if(p>2.2)return 0.6; if(p>2.0)return 0.9; if(p>1.8)return 1.2; return 1.5; }
function tieringFlow01_30(p){ if(p>9.6)return 0.4; if(p>8.6)return 0.8; if(p>7.6)return 1.2; if(p>6.6)return 1.6; return 2.0; }
function tieringFlowEver1_30_BCH(p){ if(p>60)return 0.4; if(p>55)return 0.8; if(p>50)return 1.2; if(p>45)return 1.6; return 2.0; }
function tieringFlowForward31_60_BCH(p){ if(p>33)return 0.4; if(p>31)return 0.8; if(p>29)return 1.2; if(p>27)return 1.6; return 2.0; }
function tieringBalance1_60_BCH(p){ if(p>12)return 0.2; if(p>11)return 0.4; if(p>10)return 0.6; if(p>9)return 0.8; return 1.0; }

function kategoriRapor(n){ if(n<1.5)return 'UNACCEPTABLE'; if(n<3.0)return 'NEED IMPROVEMENT'; if(n<4.0)return 'ON TARGET'; if(n<4.5)return 'EXCEED TARGET'; return 'EXCEPTIONAL'; }
function insentifRapor(k){ return k==='EXCEPTIONAL'?1000000:k==='EXCEED TARGET'?800000:k==='ON TARGET'?650000:0; }
function insentifRaporBCH(k){ return k==='EXCEPTIONAL'?1200000:k==='EXCEED TARGET'?900000:k==='ON TARGET'?500000:0; }

function getMingguSekarang(){
  const hari = new Date().getDate();
  if(hari<=7) return 1; if(hari<=14) return 2; if(hari<=21) return 3; return 4;
}
function insentifPenyelesaianFE(p,mg){ const t={1:[[40,750000],[35,500000]],2:[[60,750000],[55,500000]],3:[[75,500000],[70,250000]],4:[[95,500000],[90,250000]]}[mg]; for(const [b,n] of t){ if(p>b) return n; } return 0; }
function insentifPenyelesaianMR(p,mg){ const t={1:[[30,750000],[25,500000]],2:[[50,750000],[45,500000]],3:[[65,500000],[60,250000]],4:[[75,500000],[70,250000]]}[mg]; for(const [b,n] of t){ if(p>b) return n; } return 0; }
function insentifPenyelesaianBCH(p,mg){ const t={1:[[32,1000000],[27,500000]],2:[[52,1000000],[47,500000]],3:[[68,500000],[63,250000]],4:[[83,500000],[78,250000]]}[mg]; for(const [b,n] of t){ if(p>b) return n; } return 0; }

// ============================================================
// ACHIEVEMENT HARIAN (persis logic hitungFE/MR/BCH di bot)
// ============================================================
function hitungFE(masterList, petaKA, configRows) {
  return configRows.filter(r => r['ROLE'] === 'FE').map(cfg => {
    const namaCO = cfg['NAMA_CO'];
    const bucketPenyelesaian = cfg['BUCKET_PENYELESAIAN'];
    const bucketAsalFlow = cfg['BUCKET_ASAL_FLOW'];
    const bucketBalanceList = (cfg['BUCKET_BALANCE'] || '').split(',').map(s => s.trim());

    const kontrakCO = masterList.filter(m => m['CO ALL'] === namaCO && m['FLEET/NON FLEET'] !== 'FLEET');
    const kontrakAwalTarget = kontrakCO.filter(m => m['BUCKET AWAL'] === bucketPenyelesaian);
    const totalAwal = kontrakAwalTarget.length;
    const flowEverEscaped = kontrakAwalTarget.filter(m => {
      const ka = petaKA[m['NO KONTRAK']];
      return ka && bucketIndex(ka['FLOW EVER']) > bucketIndex(bucketPenyelesaian);
    }).length;
    const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

    const kontrakNOOD = kontrakCO.filter(m => m['BUCKET AWAL'] === bucketAsalFlow);
    let sipokFlowNoOD = 0, sipokTotalNOOD = 0;
    kontrakNOOD.forEach(m => { sipokTotalNOOD += sipokOf(m); if (m['BUCKET UPDATE'] === bucketPenyelesaian) sipokFlowNoOD += sipokOf(m); });
    const flowNoODPct = sipokTotalNOOD > 0 ? (sipokFlowNoOD / sipokTotalNOOD) * 100 : 0;

    let totalSipokBucket = 0, totalSipokAll = 0;
    Object.values(petaKA).forEach(ka => {
      if (ka['NAMA COLLECTOR'] !== namaCO || ka['FLEET/NON FLEET'] === 'FLEET') return;
      const bucket = ka['BUCKET UPDATE']; const idx = bucketIndex(bucket);
      const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0;
      if (idx !== -1 && idx <= bucketIndex('P181_210')) { totalSipokAll += sisa; if (bucketBalanceList.includes(bucket)) totalSipokBucket += sisa; }
    });
    const balancePct = totalSipokAll > 0 ? (totalSipokBucket / totalSipokAll) * 100 : 0;

    const nilaiBalance = tieringBalance1_30(balancePct);
    const nilaiFlowEver = tieringFlowEver1_30(flowEverPct);
    const nilaiFlowNoOD = tieringFlowNoOD(flowNoODPct);
    const totalNilai = nilaiBalance + nilaiFlowEver + nilaiFlowNoOD;
    const kategori = kategoriRapor(totalNilai);
    return { namaCO, role: 'FE', balancePct, flowEverPct, flowNoODPct, totalNilai, kategori, insentif: insentifRapor(kategori), totalAwal, flowEverEscaped };
  });
}

function hitungMR(masterList, petaKA, configRows) {
  return configRows.filter(r => r['ROLE'] === 'MR').map(cfg => {
    const namaCO = cfg['NAMA_CO'];
    const bucketPenyelesaian = cfg['BUCKET_PENYELESAIAN'];
    const bucketAsalFlow = cfg['BUCKET_ASAL_FLOW'];
    const bucketBalanceList = (cfg['BUCKET_BALANCE'] || '').split(',').map(s => s.trim());

    const kontrakCO = masterList.filter(m => m['CO ALL'] === namaCO && m['FLEET/NON FLEET'] !== 'FLEET');
    const kontrakAwalTarget = kontrakCO.filter(m => m['BUCKET AWAL'] === bucketPenyelesaian);
    const totalAwal = kontrakAwalTarget.length;
    const flowEverEscaped = kontrakAwalTarget.filter(m => {
      const ka = petaKA[m['NO KONTRAK']];
      return ka && bucketIndex(ka['FLOW EVER']) > bucketIndex(bucketPenyelesaian);
    }).length;
    const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

    let sipokFlow = 0, sipokTotalAsal = 0;
    masterList.forEach(m => {
      if (m['FLEET/NON FLEET'] === 'FLEET') return;
      if (m['BUCKET AWAL'] !== bucketAsalFlow) return;
      sipokTotalAsal += sipokOf(m); if (m['BUCKET UPDATE'] === bucketPenyelesaian) sipokFlow += sipokOf(m);
    });
    const flowPct = sipokTotalAsal > 0 ? (sipokFlow / sipokTotalAsal) * 100 : 0;

    let totalSipokBucket = 0, totalSipokAll = 0;
    Object.values(petaKA).forEach(ka => {
      if (ka['FLEET/NON FLEET'] === 'FLEET') return;
      const bucket = ka['BUCKET UPDATE']; const idx = bucketIndex(bucket);
      const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0;
      if (idx !== -1 && idx <= bucketIndex('P181_210')) { totalSipokAll += sisa; if (bucketBalanceList.includes(bucket)) totalSipokBucket += sisa; }
    });
    const balancePct = totalSipokAll > 0 ? (totalSipokBucket / totalSipokAll) * 100 : 0;

    const nilaiBalance = tieringBalance31_60(balancePct);
    const nilaiFlowEver = tieringFlowEver31_60(flowEverPct);
    const nilaiFlow = tieringFlow01_30(flowPct);
    const totalNilai = nilaiBalance + nilaiFlowEver + nilaiFlow;
    const kategori = kategoriRapor(totalNilai);
    return { namaCO, role: 'MR', balancePct, flowEverPct, flowPct, totalNilai, kategori, insentif: insentifRapor(kategori), totalAwal, flowEverEscaped };
  });
}

function hitungBCH(masterList, petaKA, configRows) {
  const bchRow = configRows.find(r => r['ROLE'] === 'BCH');
  if (!bchRow) return null;
  const namaCO = bchRow['NAMA_CO'];

  const populasiEver = masterList.filter(m => m['FLEET/NON FLEET'] !== 'FLEET' && m['BUCKET AWAL'] === 'P001_030');
  const totalAwal = populasiEver.length;
  const flowEverEscaped = populasiEver.filter(m => {
    const ka = petaKA[m['NO KONTRAK']];
    return ka && bucketIndex(ka['FLOW EVER']) > bucketIndex('P001_030');
  }).length;
  const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

  let sipokFlow = 0, sipokTotalAsal = 0;
  masterList.forEach(m => {
    if (m['FLEET/NON FLEET'] === 'FLEET') return;
    if (m['BUCKET AWAL'] !== 'P031_060') return;
    sipokTotalAsal += sipokOf(m); if (m['BUCKET UPDATE'] === 'P061_090') sipokFlow += sipokOf(m);
  });
  const flowForwardPct = sipokTotalAsal > 0 ? (sipokFlow / sipokTotalAsal) * 100 : 0;

  let totalSipokBucket = 0, totalSipokAll = 0;
  Object.values(petaKA).forEach(ka => {
    if (ka['FLEET/NON FLEET'] === 'FLEET') return;
    const bucket = ka['BUCKET UPDATE']; const idx = bucketIndex(bucket);
    const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0;
    if (idx !== -1 && idx <= bucketIndex('P181_210')) { totalSipokAll += sisa; if (bucket === 'P001_030' || bucket === 'P031_060') totalSipokBucket += sisa; }
  });
  const balancePct = totalSipokAll > 0 ? (totalSipokBucket / totalSipokAll) * 100 : 0;

  const nilaiFlowEver = tieringFlowEver1_30_BCH(flowEverPct);
  const nilaiFlowForward = tieringFlowForward31_60_BCH(flowForwardPct);
  const nilaiBalance = tieringBalance1_60_BCH(balancePct);
  const totalNilai = nilaiFlowEver + nilaiFlowForward + nilaiBalance;
  const kategori = kategoriRapor(totalNilai);
  return { namaCO, role: 'BCH', flowEverPct, flowForwardPct, balancePct, totalNilai, kategori, insentif: insentifRaporBCH(kategori), totalAwal, flowEverEscaped };
}

// ============================================================
// INSENTIF PENYELESAIAN MINGGUAN (persis logic bot)
// ============================================================
function hitungPenyelesaianPct(masterList, filterFn, bucketAwalSet) {
  let sipokFlow = 0, sipokTotal = 0;
  masterList.forEach(m => {
    if (m['FLEET/NON FLEET'] === 'FLEET') return;
    if (!filterFn(m)) return;
    if (!bucketAwalSet.includes(m['BUCKET AWAL'])) return;
    sipokTotal += sipokOf(m);
    if (bucketIndex(m['BUCKET UPDATE']) > bucketIndex(m['BUCKET AWAL'])) sipokFlow += sipokOf(m);
  });
  const flowPct = sipokTotal > 0 ? (sipokFlow / sipokTotal) * 100 : 0;
  return { pct: 100 - flowPct, sipokTotal };
}

const TABEL_BATAS = {
  FE: { 1: [40, 35], 2: [60, 55], 3: [75, 70], 4: [95, 90] },
  MR: { 1: [30, 25], 2: [50, 45], 3: [65, 60], 4: [75, 70] },
  BCH: { 1: [32, 27], 2: [52, 47], 3: [68, 63], 4: [83, 78] }
};

function hitungPenyelesaianSemua(masterList, configRows) {
  const minggu = getMingguSekarang();
  return configRows.map(cfg => {
    const role = cfg['ROLE'];
    const namaCO = cfg['NAMA_CO'];
    const bucketSet = (cfg['BUCKET_PENYELESAIAN'] || '').split(',').map(s => s.trim());
    const filterFn = role === 'FE' ? (m => m['CO ALL'] === namaCO) : (() => true);
    const hasil = hitungPenyelesaianPct(masterList, filterFn, bucketSet);
    const tabelFn = role === 'FE' ? insentifPenyelesaianFE : role === 'MR' ? insentifPenyelesaianMR : insentifPenyelesaianBCH;
    const nilai = tabelFn(hasil.pct, minggu);

    const batas = (TABEL_BATAS[role] || {})[minggu] || [];
    let batasBerikutnya = null;
    for (const b of batas) { if (hasil.pct <= b) { batasBerikutnya = b; break; } }
    let gapPct = null, gapRupiah = null;
    if (batasBerikutnya !== null) { gapPct = batasBerikutnya - hasil.pct + 0.01; gapRupiah = (gapPct / 100) * hasil.sipokTotal; }

    const kandidat = masterList.filter(m => {
      if (m['FLEET/NON FLEET'] === 'FLEET') return false;
      if (!bucketSet.includes(m['BUCKET AWAL'])) return false;
      if (!filterFn(m)) return false;
      return bucketIndex(m['BUCKET UPDATE']) > bucketIndex(m['BUCKET AWAL']);
    }).sort((a, b) => sipokOf(b) - sipokOf(a)).slice(0, 10).map(k => ({
      namaKonsumen: k['NAMA KONSUMEN'], noKontrak: k['NO KONTRAK'], sipok: sipokOf(k),
      pengaruhPct: hasil.sipokTotal > 0 ? (sipokOf(k) / hasil.sipokTotal) * 100 : 0
    }));

    return { role, namaCO, minggu, pct: hasil.pct, sipokTotal: hasil.sipokTotal, nilai, gapPct, gapRupiah, rekomendasi: kandidat };
  });
}

// ============================================================
// HANDLER UTAMA
// ============================================================
module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' }); return; }
    const email = await verifyIdToken(idToken);

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const [masterRaw, kaRaw, roleRaw] = await Promise.all([
      fetchSheetRange(sheetId, 'MASTER', accessToken),
      fetchSheetRange(sheetId, 'KA HARIAN', accessToken),
      fetchSheetRange(sheetId, 'CONFIG_ROLE', accessToken)
    ]);

    const masterList = parseSheetGeneric(masterRaw, 0).filter(m => m['NO KONTRAK']);
    const kaRows = parseSheetGeneric(kaRaw, 15); // header KA HARIAN ada di baris ke-16
    const petaKA = {};
    kaRows.forEach(r => { if (r['NO KONTRAK']) petaKA[r['NO KONTRAK']] = r; });
    const configRows = parseSheetGeneric(roleRaw, 0);

    const hasilFE = hitungFE(masterList, petaKA, configRows);
    const hasilMR = hitungMR(masterList, petaKA, configRows);
    const hasilBCH = hitungBCH(masterList, petaKA, configRows);
    const hasilPenyelesaian = hitungPenyelesaianSemua(masterList, configRows);
    const minggu = getMingguSekarang();

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    const isAdmin = adminEmails.indexOf(email) > -1;

    if (isAdmin) {
      res.status(200).json({ isAdmin: true, achievement: { FE: hasilFE, MR: hasilMR, BCH: hasilBCH }, penyelesaian: hasilPenyelesaian, minggu });
      return;
    }

    const myRec = masterList.find(m => (m['EMAIL CO'] || '').toString().trim().toLowerCase() === email);
    const myName = myRec ? myRec['CO ALL'] : null;
    const semuaAchievement = [...hasilFE, ...hasilMR, hasilBCH].filter(Boolean);
    const myAchievement = semuaAchievement.find(h => h.namaCO === myName) || null;
    const myPenyelesaian = hasilPenyelesaian.find(h => h.namaCO === myName) || null;

    res.status(200).json({ isAdmin: false, achievement: myAchievement, penyelesaian: myPenyelesaian, minggu });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
