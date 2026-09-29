const crypto = require('crypto');

// ============================================================
// AUTH HELPERS (sama seperti api/insentif.js)
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

// ============================================================
// BUCKET & TIERING (persis sama seperti api/insentif.js)
// ============================================================
const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240','P241_270'];
function bucketIndex(b) { return BUCKET_ORDER.indexOf(String(b || '').trim()); }
function sipokOf(m) { return typeof m['SIPOK'] === 'number' ? m['SIPOK'] : 0; }

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

// ============================================================
// ACHIEVEMENT HARIAN — persis logic api/insentif.js (hitungFE/MR/BCH),
// tapi menerima masterList & petaKA yang BISA sudah dimodifikasi (counterfactual)
// untuk keperluan simulasi. Kalau dipanggil dengan data asli, hasilnya identik
// dengan api/insentif.js.
// ============================================================
function hitungFESatu(masterList, petaKA, cfg) {
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
}

function hitungMRSatu(masterList, petaKA, cfg) {
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
}

function hitungBCHSatu(masterList, petaKA, cfg) {
  const namaCO = cfg['NAMA_CO'];

  const populasiEver = masterList.filter(m => m['BUCKET AWAL'] === 'P001_030');
  const totalAwal = populasiEver.length;
  const flowEverEscaped = populasiEver.filter(m => {
    const ka = petaKA[m['NO KONTRAK']];
    return ka && bucketIndex(ka['FLOW EVER']) > bucketIndex('P001_030');
  }).length;
  const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

  let sipokFlow = 0, sipokTotalAsal = 0;
  masterList.forEach(m => {
    if (m['BUCKET AWAL'] !== 'P031_060') return;
    sipokTotalAsal += sipokOf(m); if (m['BUCKET UPDATE'] === 'P061_090') sipokFlow += sipokOf(m);
  });
  const flowForwardPct = sipokTotalAsal > 0 ? (sipokFlow / sipokTotalAsal) * 100 : 0;

  let totalSipokBucket = 0, totalSipokAll = 0;
  Object.values(petaKA).forEach(ka => {
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

function hitungSatu(role, masterList, petaKA, cfg) {
  if (role === 'FE') return hitungFESatu(masterList, petaKA, cfg);
  if (role === 'MR') return hitungMRSatu(masterList, petaKA, cfg);
  if (role === 'BCH') return hitungBCHSatu(masterList, petaKA, cfg);
  return null;
}

// Bucket Awal yang benar-benar dipakai di rumus rapor tiap role — di luar bucket ini,
// kontrak gak kebaca sama sekali oleh 3 parameter rapor (flow ever/flow/balance),
// jadi gak usah ditawarkan buat disimulasikan.
function bucketAwalRelevan(role, cfg) {
  if (role === 'FE' || role === 'MR') {
    // FE: BUCKET_ASAL_FLOW=NOOD, BUCKET_PENYELESAIAN=P001_030 -> populasi Flow NOOD & Flow Ever/Balance
    // MR: BUCKET_ASAL_FLOW=P001_030, BUCKET_PENYELESAIAN=P031_060 -> populasi Flow 1-30 & Flow Ever/Balance
    return [cfg['BUCKET_ASAL_FLOW'], cfg['BUCKET_PENYELESAIAN']].filter(Boolean);
  }
  if (role === 'BCH') {
    // persis basis hitungBCHSatu: populasi Flow Ever dari P001_030, populasi Flow Forward dari P031_060
    return ['P001_030', 'P031_060'];
  }
  return [];
}

// MASTER punya kolom KRITERIA ACCT yang udah otomatis mengkategorikan tiap kontrak:
// STAY (belum pindah bucket), FLOW (pindah ke bucket lebih buruk), ROLLBACK (membaik/mundur
// ke bucket lebih baik), BTC (baru aja lunas total), LUNAS (sudah lunas/closed).
// Kontrak yang udah BTC/LUNAS gak usah ditawarkan lagi buat disimulasikan — mereka udah
// "resolved", gak ada gunanya. STAY/FLOW/ROLLBACK masih relevan karena masih di buku piutang.
function masihRelevanDisimulasikan(m) {
  const k = (m['KRITERIA ACCT'] || '').toString().trim().toUpperCase();
  if (!k) return true; // kosong -> tetap tampilkan drpd nyembunyiin yang harusnya kelihatan
  return k !== 'BTC' && k !== 'LUNAS';
}

// ============================================================
// Daftar kontrak yang RELEVAN buat disimulasikan untuk satu CO:
// kontrak yang Bucket Awal-nya termasuk populasi parameter rapor role ini
// (persis bucket yang dipakai hitungFE/MR/BCH) DAN KRITERIA ACCT-nya masih
// STAY/FLOW/ROLLBACK (belum BTC/LUNAS). Ini termasuk kontrak "stay" (belum
// sempat pindah bucket sama sekali), karena tetap ikut mempengaruhi
// Balance/Flow Ever meski belum bergerak.
// ============================================================
function daftarKontrakRelevan(namaCO, role, masterList, petaKA, cfg) {
  const bucketSet = bucketAwalRelevan(role, cfg);
  const poolDasar = role === 'BCH' ? masterList : masterList.filter(m => m['CO ALL'] === namaCO && m['FLEET/NON FLEET'] !== 'FLEET');
  const pool = poolDasar.filter(m => bucketSet.includes(m['BUCKET AWAL']) && masihRelevanDisimulasikan(m));
  const list = [];
  pool.forEach(m => {
    const noKontrak = m['NO KONTRAK'];
    if (!noKontrak) return;
    const bucketAwal = m['BUCKET AWAL'];
    const ka = petaKA[noKontrak];
    const bucketUpdateMaster = m['BUCKET UPDATE'];
    const bucketUpdateKA = ka ? ka['BUCKET UPDATE'] : null;
    const flowEver = ka ? ka['FLOW EVER'] : null;
    const sisaPiutang = ka && typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : sipokOf(m);
    list.push({
      noKontrak,
      namaKonsumen: m['NAMA KONSUMEN'],
      bucketAwal,
      bucketUpdateMaster,
      bucketUpdateKA,
      flowEver,
      sisaPiutang,
      kriteriaAcct: m['KRITERIA ACCT'] || null,
      coAll: m['CO ALL']
    });
  });
  list.sort((a, b) => b.sisaPiutang - a.sisaPiutang);
  return list;
}

// Terapkan simulasi "kontrak X berhasil ketagih & LUNAS/BTC sekarang":
// keluarkan kontrak itu SEPENUHNYA dari masterList & KA HARIAN, seolah-olah
// udah lunas dan keluar dari buku piutang yang masih dipantau.
// Ini otomatis benar buat semua kasus:
// - kontrak NOOD/1-30 yang udah kadung flow ke bucket lebih buruk -> hilang dari
//   pembilang MAUPUN penyebut Flow NOOD/Flow Ever (gak dihitung lagi sama sekali).
// - kontrak yang masih "stay" di bucket balance (misal 1-30) -> keluar dari
//   Balance karena bener2 dianggap gak ada lagi di buku, bukan cuma direset bucket-nya
//   (reset ke Bucket Awal gak akan ngefek buat kontrak yang emang belum pernah pindah).
function terapkanSimulasi(masterList, petaKA, noKontrakList) {
  const set = new Set(noKontrakList);
  const masterList2 = masterList.filter(m => !set.has(m['NO KONTRAK']));
  const petaKA2 = {};
  Object.keys(petaKA).forEach(k => { if (!set.has(k)) petaKA2[k] = petaKA[k]; });
  return { masterList2, petaKA2 };
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
    const kaRows = parseSheetGeneric(kaRaw, 15);
    const petaKA = {};
    kaRows.forEach(r => { if (r['NO KONTRAK']) petaKA[r['NO KONTRAK']] = r; });
    const configRows = parseSheetGeneric(roleRaw, 0).filter(r => ['FE', 'MR', 'BCH'].includes(r['ROLE']));

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    const isAdmin = adminEmails.indexOf(email) > -1;

    let namaCO;
    if (isAdmin) {
      const body = req.method === 'POST' ? (req.body || {}) : (req.query || {});
      namaCO = body.namaCO || (configRows[0] && configRows[0]['NAMA_CO']);
    } else {
      const myRec = masterList.find(m => (m['EMAIL CO'] || '').toString().trim().toLowerCase() === email);
      namaCO = myRec ? myRec['CO ALL'] : null;
    }

    const cfg = configRows.find(r => r['NAMA_CO'] === namaCO);
    if (!namaCO || !cfg) {
      res.status(200).json({ error: 'Kamu tidak punya target rapor (FE/MR/BCH), jadi fitur simulasi ini tidak berlaku untuk akunmu.' });
      return;
    }
    const role = cfg['ROLE'];

    const coList = isAdmin ? configRows.map(c => ({ namaCO: c['NAMA_CO'], role: c['ROLE'] })) : null;

    if (req.method === 'POST') {
      const body = req.body || {};
      const noKontrakList = Array.isArray(body.noKontrakList) ? body.noKontrakList : [];

      const original = hitungSatu(role, masterList, petaKA, cfg);
      const { masterList2, petaKA2 } = terapkanSimulasi(masterList, petaKA, noKontrakList);
      const simulasi = hitungSatu(role, masterList2, petaKA2, cfg);

      res.status(200).json({
        namaCO, role, isAdmin, coList,
        original, simulasi,
        delta: { totalNilai: simulasi.totalNilai - original.totalNilai, insentif: simulasi.insentif - original.insentif },
        tercapaiOriginal: original.totalNilai >= 3.0,
        tercapaiSimulasi: simulasi.totalNilai >= 3.0,
        jumlahKontrakDipilih: noKontrakList.length
      });
      return;
    }

    // GET: kirim status asli + daftar kontrak yang bisa disimulasikan
    const original = hitungSatu(role, masterList, petaKA, cfg);
    const kontrakList = daftarKontrakRelevan(namaCO, role, masterList, petaKA, cfg);

    res.status(200).json({ namaCO, role, isAdmin, coList, original, kontrakList });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
