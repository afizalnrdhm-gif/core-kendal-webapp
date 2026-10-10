const { getAccessToken, sendError, verifyIdToken } = require('./_auth');
const { cleanCell } = require('./_sheet');

// ============================================================
// AUTH HELPERS (sama seperti di api/data.js)
// ============================================================

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
    keepIdx.forEach((idx, j) => { let v = raw[idx]; v = cleanCell(finalHeader[j], v); rec[finalHeader[j]] = v === undefined ? '' : v; });
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

// Tanggal "efektif" data: data MASTER ditarik tiap pagi (~08:30 WIB) dan isinya kondisi akhir KEMARIN (H-1).
// Jadi data pagi tgl 8 = penutup W1 (tgl 1-7), pagi tgl 15 = penutup W2, pagi tgl 22 = penutup W3,
// dan pagi tgl 1 bulan berikutnya = penutup W4 bulan sebelumnya. Dihitung pakai WIB (UTC+7) supaya
// tidak geser walau server Vercel jalan di UTC.
function tanggalEfektif(){
  const t = new Date(Date.now() + 7*3600*1000 - 24*3600*1000);
  return { tahun: t.getUTCFullYear(), bulan: t.getUTCMonth() + 1, hari: t.getUTCDate() };
}
function getMingguSekarang(){
  const hari = tanggalEfektif().hari;
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

// ============================================================
// INSENTIF PENYELESAIAN MINGGUAN (persis logic bot)
// ============================================================
function hitungPenyelesaianPct(masterList, filterFn, bucketAwalSet, includeFleet) {
  let sipokFlow = 0, sipokTotal = 0;
  masterList.forEach(m => {
    if (!includeFleet && m['FLEET/NON FLEET'] === 'FLEET') return;
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
    const includeFleet = role === 'BCH';
    const hasil = hitungPenyelesaianPct(masterList, filterFn, bucketSet, includeFleet);
    const tabelFn = role === 'FE' ? insentifPenyelesaianFE : role === 'MR' ? insentifPenyelesaianMR : insentifPenyelesaianBCH;
    const nilai = tabelFn(hasil.pct, minggu);

    const batas = (TABEL_BATAS[role] || {})[minggu] || [];
    let batasBerikutnya = null;
    for (const b of batas) { if (hasil.pct <= b) { batasBerikutnya = b; break; } }
    let gapPct = null, gapRupiah = null;
    if (batasBerikutnya !== null) { gapPct = batasBerikutnya - hasil.pct + 0.01; gapRupiah = (gapPct / 100) * hasil.sipokTotal; }

    const kandidat = masterList.filter(m => {
      if (!includeFleet && m['FLEET/NON FLEET'] === 'FLEET') return false;
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
// TARGET DAILY (menu "Target Daily")
// Meniru REPORT DAILY di Excel: target harian = (belum bayar - batas flow yang masih boleh) / sisa hari.
// Dua poin per PIC mengikuti KPI rapor: Balance dan Flow.
//   FE  : Balance NOOD (target cabang 88%, dibagi sesuai beban) + Flow NOOD   | MR : Balance 31-60 + Flow 1-30 | BCH : Balance 1-60 + Flow 31-60
// Data MASTER/KA HARIAN adalah kondisi H-1, jadi "hari ini" ikut dihitung sebagai hari yang tersisa.
// ============================================================
const TD_BATAS_FLOW = { FE: 2, MR: 6, BCH: 28 };       // % beban awal yang boleh flow (parameter J di Excel REPORT DAILY)
const TD_BATAS_BALANCE = { MR: 1.8, BCH: 9 };       // % AR (batas poin maksimal tiering KPI rapor)
const TD_TARGET_NOOD = 88;                          // FE: target porsi NOOD cabang terhadap total AR (bukan KPI rapor), dibagi ke FE sesuai beban awal
const TD_LABEL = { NOOD: 'NOOD', P001_030: '1-30', P031_060: '31-60', P061_090: '61-90' };
const tdLbl = b => TD_LABEL[b] || String(b || '').replace(/^P0*/, '').replace('_', '-');

function tdHariIni() {
  const t = new Date(Date.now() + 7 * 3600 * 1000);
  const y = t.getUTCFullYear(), m = t.getUTCMonth(), d = t.getUTCDate();
  const akhir = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { tahun: y, bulan: m + 1, hari: d, akhirBulan: akhir, sisaHari: Math.max(1, akhir - d + 1) };
}
function tdHariDariCell(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    if (v >= 1 && v <= 31) return Math.floor(v);
    if (v > 1000) return new Date(Math.floor(v - 25569) * 86400000).getUTCDate();
    return 0;
  }
  const s = String(v).trim();
  let mt = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (mt) return parseInt(mt[3], 10);
  mt = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (mt) return parseInt(mt[1], 10);
  const n = parseInt(s, 10); return n >= 1 && n <= 31 ? n : 0;
}
function tdSudahBayar(m) {
  const u = (m['STATUS BAYAR'] || '').toString().toUpperCase();
  return u.includes('LUNAS') || u.includes('SUDAH');
}

// Susun daftar kontrak potensial (urut: tgl bayar bulan lalu, lalu JB) + rekomendasi tambahan sampai target harian tertutup.
function tdSusunKontrak(kandidat, perHari, D, akhirBulan) {
  const jarak = (hari) => { // jarak kalender ke depan (0 = hari ini; negatif = sudah lewat)
    if (!hari) return null; return hari - D;
  };
  const baris = kandidat.map(m => {
    const tb = tdHariDariCell(m['TANGGAL BAYAR BULAN LALU'] !== undefined && m['TANGGAL BAYAR BULAN LALU'] !== '' ? m['TANGGAL BAYAR BULAN LALU'] : m['TGL BYR']);
    const jb = tdHariDariCell(m['JANJI BAYAR']);
    const dTb = jarak(tb), dJb = jarak(jb);
    let grup = 9, alasan = [];
    if (dTb === 0) { grup = Math.min(grup, 1); alasan.push('Biasa bayar tgl ' + tb + ' (hari ini)'); }
    if (dJb === 0) { grup = Math.min(grup, 1); alasan.push('Janji bayar hari ini'); }
    if (grup > 2 && dTb !== null && dTb < 0) { grup = Math.min(grup, 2); alasan.push('Biasa bayar tgl ' + tb + ' (sudah lewat)'); }
    if (grup > 2 && dJb !== null && dJb < 0) { grup = Math.min(grup, 2); alasan.push('Janji tgl ' + jb + ' terlewat'); }
    if (grup > 3 && dTb !== null && dTb > 0 && dTb <= 3) { grup = 3; alasan.push('Biasa bayar tgl ' + tb + ' (' + dTb + ' hari lagi)'); }
    if (grup > 3 && dJb !== null && dJb > 0 && dJb <= 3) { grup = 3; alasan.push('Janji bayar tgl ' + jb + ' (' + dJb + ' hari lagi)'); }
    return {
      noKontrak: m['NO KONTRAK'], nama: m['NAMA KONSUMEN'] || '-', sipok: sipokOf(m), bucketAwal: m['BUCKET AWAL'], bucket: m['BUCKET UPDATE'],
      dpd: typeof m['DPD'] === 'number' ? m['DPD'] : null, tglBayarLalu: tb || null, jb: jb || null, proyeksi: (m['PROYEKSI'] || '').toString().trim().toUpperCase(),
      co: m['CO ALL'] || '', grup, alasan: alasan.join(' · '), _dTb: dTb, _dJb: dJb
    };
  });
  const potensial = baris.filter(b => b.grup <= 3).sort((a, b) => a.grup - b.grup || b.sipok - a.sipok);
  let kum = 0;
  potensial.forEach(b => { kum += b.sipok; b.kumulatif = kum; });
  const totalPotensial = kum;
  const untukTarget = perHari > 0 ? (potensial.findIndex(b => b.kumulatif >= perHari) + 1 || null) : 0;
  const kurang = Math.max(0, perHari - totalPotensial);

  // Rekomendasi tambahan: yang paling mungkin ditarik maju. Prioritas: janji bayar di depan (konsumen sudah berkomitmen),
  // lalu kebiasaan bayar terdekat dengan hari ini, lalu sisanya (SIPOK besar dulu supaya sedikit kontak menutup selisih).
  let rekom = [];
  if (kurang > 0) {
    const sisa = baris.filter(b => b.grup > 3).map(b => {
      let skor, alasan;
      if (b._dJb !== null && b._dJb > 3) { skor = 1000 + b._dJb; alasan = 'Sudah janji tgl ' + b.jb + ' — minta dipercepat'; }
      else if (b._dTb !== null && b._dTb > 3) { skor = 2000 + b._dTb; alasan = 'Biasa bayar tgl ' + b.tglBayarLalu + ' — ajak bayar lebih awal'; }
      else { skor = 3000; alasan = 'Belum ada pola/janji — prioritaskan nominal besar'; }
      return Object.assign({}, b, { skor, alasan });
    }).sort((a, b) => a.skor - b.skor || b.sipok - a.sipok);
    let sisaKurang = kurang;
    for (const r of sisa) { if (sisaKurang <= 0 || rekom.length >= 10) break; rekom.push(r); sisaKurang -= r.sipok; }
  }
  const bersih = b => { const o = Object.assign({}, b); delete o._dTb; delete o._dJb; delete o.skor; return o; };
  return {
    potensial: potensial.slice(0, 30).map(bersih), jumlahPotensial: potensial.length, totalPotensial,
    kurang, jumlahUntukTarget: untukTarget, rekomendasi: rekom.map(bersih), tercukupi: kurang <= 0
  };
}

function hitungTargetDaily(masterList, petaKA, configRows) {
  const w = tdHariIni(); const D = w.hari;
  const arAll = (filterKA) => { let t = 0; Object.values(petaKA).forEach(ka => { if (!filterKA(ka)) return; const i = bucketIndex(ka['BUCKET UPDATE']); const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0; if (i !== -1 && i <= bucketIndex('P181_210')) t += sisa; }); return t; };
  // Balance NOOD cabang (non-fleet): target 88% dari total AR, selisihnya dibagi ke FE sesuai beban awal masing-masing
  const nonFleet = ka => ka['FLEET/NON FLEET'] !== 'FLEET';
  const arCab = arAll(nonFleet);
  let noodCab = 0;
  Object.values(petaKA).forEach(ka => { if (nonFleet(ka) && ka['BUCKET UPDATE'] === 'NOOD') noodCab += (typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0); });
  const gapNood = Math.max(0, arCab * TD_TARGET_NOOD / 100 - noodCab);
  const feList = configRows.filter(r => r['ROLE'] === 'FE').map(r => r['NAMA_CO']);
  const bebanFE = {}; let bebanFETotal = 0;
  feList.forEach(n => { bebanFE[n] = masterList.filter(m => m['CO ALL'] === n && m['FLEET/NON FLEET'] !== 'FLEET').reduce((t, m) => t + sipokOf(m), 0); bebanFETotal += bebanFE[n]; });
  const hasil = configRows.filter(r => ['FE', 'MR', 'BCH'].includes(r['ROLE'])).map(cfg => {
    const role = cfg['ROLE'], namaCO = cfg['NAMA_CO'];
    const penyelesaian = (cfg['BUCKET_PENYELESAIAN'] || '').toString().split(',').map(x => x.trim()).filter(Boolean);
    let asal = (cfg['BUCKET_ASAL_FLOW'] || '').toString().trim();
    let balBuckets = (cfg['BUCKET_BALANCE'] || '').toString().split(',').map(x => x.trim()).filter(Boolean);
    if (role === 'BCH') { asal = 'P031_060'; balBuckets = ['P001_030', 'P031_060']; }
    const incFleet = role === 'BCH';
    const scopeM = m => (incFleet || m['FLEET/NON FLEET'] !== 'FLEET') && (role !== 'FE' || m['CO ALL'] === namaCO);
    const scopeKA = ka => (incFleet || ka['FLEET/NON FLEET'] !== 'FLEET') && (role !== 'FE' || ka['NAMA COLLECTOR'] === namaCO);

    // ---- Poin 1: BALANCE (porsi AR bucket terhadap total AR) ----
    const arTotal = arAll(scopeKA);
    let arBucket = 0;
    Object.values(petaKA).forEach(ka => { if (!scopeKA(ka)) return; if (balBuckets.includes(ka['BUCKET UPDATE'])) arBucket += (typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0); });
    const batasBal = TD_BATAS_BALANCE[role] || 0;
    const pctBal = arTotal > 0 ? arBucket / arTotal * 100 : 0;
    const perluBal = Math.max(0, arBucket - arTotal * batasBal / 100);
    const kandBal = masterList.filter(m => scopeM(m) && (role === 'FE' ? m['BUCKET UPDATE'] === 'P001_030' : balBuckets.includes(m['BUCKET UPDATE'])) && !tdSudahBayar(m));
    let balance;
    if (role === 'FE') {
      const porsi = bebanFETotal > 0 ? bebanFE[namaCO] / bebanFETotal : 0;
      const perlu = gapNood * porsi;
      balance = {
        kunci: 'balance', arah: 'naik', judul: 'Balance NOOD',
        keterangan: 'Target porsi NOOD cabang ' + TD_TARGET_NOOD + '% dari total AR. Kekurangannya dibagi ke FE sesuai beban awal (porsi ' + Math.round(porsi * 1000) / 10 + '%)',
        nilaiAmt: noodCab, nilaiPct: arCab > 0 ? noodCab / arCab * 100 : 0, batasPct: TD_TARGET_NOOD, bolehAmt: arCab * TD_TARGET_NOOD / 100,
        porsiPct: porsi * 100, bebanAmt: bebanFE[namaCO], gapCabang: gapNood, perluAmt: perlu, perHari: perlu / w.sisaHari,
        ...tdSusunKontrak(kandBal, perlu / w.sisaHari, D, w.akhirBulan)
      };
    } else {
      balance = {
        kunci: 'balance', judul: 'Balance ' + balBuckets.map(tdLbl).join(' + '),
        keterangan: 'Porsi AR bucket ' + balBuckets.map(tdLbl).join(' + ') + ' terhadap total AR; batas poin maksimal ' + batasBal + '%',
        nilaiAmt: arBucket, nilaiPct: pctBal, batasPct: batasBal, perluAmt: perluBal, perHari: perluBal / w.sisaHari,
        ...tdSusunKontrak(kandBal, perluBal / w.sisaHari, D, w.akhirBulan)
      };
    }

    // ---- Poin 2: FLOW (belum bayar di bucket asal yang masih bisa flow) ----
    const bAsal = role === 'BCH' ? 'P031_060' : (role === 'FE' ? (asal || 'NOOD') : (asal || 'P001_030'));
    let beban = 0, unpaid = 0; const kandFlow = [];
    masterList.forEach(m => {
      if (!scopeM(m) || m['BUCKET AWAL'] !== bAsal) return;
      // MR: flow 1-30 dihitung se-cabang (sama seperti rapor); FE hanya kontrak miliknya
      beban += sipokOf(m);
      if (bucketIndex(m['BUCKET UPDATE']) > bucketIndex(m['BUCKET AWAL'])) { unpaid += sipokOf(m); kandFlow.push(m); }
    });
    const batasFlow = TD_BATAS_FLOW[role];
    const boleh = beban * batasFlow / 100;
    const perluFlow = Math.max(0, unpaid - boleh);
    const flow = {
      kunci: 'flow', judul: 'Flow ' + tdLbl(bAsal),
      keterangan: 'Kontrak bucket ' + tdLbl(bAsal) + ' yang belum bayar (berpotensi flow); yang boleh flow maks ' + batasFlow + '% dari beban awal',
      bebanAmt: beban, nilaiAmt: unpaid, nilaiPct: beban > 0 ? unpaid / beban * 100 : 0, batasPct: batasFlow, bolehAmt: boleh,
      perluAmt: perluFlow, perHari: perluFlow / w.sisaHari, jumlahBelumBayar: kandFlow.length,
      ...tdSusunKontrak(kandFlow, perluFlow / w.sisaHari, D, w.akhirBulan)
    };
    return { namaCO, role, poin: [balance, flow] };
  });
  return { tanggal: w, pic: hasil };
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

    // LOG_MINGGUAN opsional — kalau belum ada/gagal dibaca, lanjut tanpa data historis W1-W4
    let logRows = [];
    try {
      const logRaw = await fetchSheetRange(sheetId, 'LOG_MINGGUAN', accessToken);
      logRows = parseSheetGeneric(logRaw, 0);
    } catch (e) { logRows = []; }

    const masterList = parseSheetGeneric(masterRaw, 0).filter(m => m['NO KONTRAK']);
    const kaRows = parseSheetGeneric(kaRaw, 15); // header KA HARIAN ada di baris ke-16
    const petaKA = {};
    kaRows.forEach(r => { if (r['NO KONTRAK']) petaKA[r['NO KONTRAK']] = r; });
    const configRows = parseSheetGeneric(roleRaw, 0);

    if (req.query && req.query.target) {
      const adminList = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
      const admin = adminList.indexOf(email) > -1;
      const td = hitungTargetDaily(masterList, petaKA, configRows);
      if (admin) { res.status(200).json(Object.assign({ isAdmin: true }, td)); return; }
      const rec = masterList.find(m => (m['EMAIL CO'] || '').toString().trim().toLowerCase() === email);
      const nama = rec ? rec['CO ALL'] : null;
      res.status(200).json({ isAdmin: false, tanggal: td.tanggal, pic: td.pic.filter(p => p.namaCO === nama) });
      return;
    }

    const hasilFE = hitungFE(masterList, petaKA, configRows);
    const hasilMR = hitungMR(masterList, petaKA, configRows);
    const hasilBCH = hitungBCH(masterList, petaKA, configRows);
    const hasilPenyelesaian = hitungPenyelesaianSemua(masterList, configRows);
    const minggu = getMingguSekarang();

    // Total Insentif per CO = Insentif Rapor (achievement harian) + akumulasi Insentif Penyelesaian dari W1 s.d. minggu berjalan
    // Hanya untuk CO yang punya target rapor (FE/MR/BCH via CONFIG_ROLE) — role lain (misal DESKCALL) tidak ada target, jadi dilewati.
    const { tahun: curTahun, bulan: curBulan } = tanggalEfektif();
    const weeklyTotalMap = {}; // namaCO -> jumlah NILAI dari semua minggu (W1-W4) yang sudah tercatat di LOG_MINGGUAN bulan ini
    logRows.forEach(r => {
      if (Number(r['TAHUN']) !== curTahun || Number(r['BULAN']) !== curBulan) return;
      const namaCO = r['NAMA_CO'];
      if (!namaCO) return;
      weeklyTotalMap[namaCO] = (weeklyTotalMap[namaCO] || 0) + (Number(r['NILAI']) || 0);
    });

    const raporMap = {};
    [...hasilFE, ...hasilMR, hasilBCH].filter(Boolean).forEach(h => { raporMap[h.namaCO] = h.insentif; });
    const totalInsentif = hasilPenyelesaian
      .filter(p => Object.prototype.hasOwnProperty.call(raporMap, p.namaCO))
      .map(p => {
        const insentifRapor = raporMap[p.namaCO] || 0;
        // Kalau sudah ada histori di LOG_MINGGUAN bulan ini, pakai akumulasinya. Kalau belum sama sekali, fallback ke nilai minggu berjalan (live).
        const insentifWeekly = Object.prototype.hasOwnProperty.call(weeklyTotalMap, p.namaCO) ? weeklyTotalMap[p.namaCO] : p.nilai;
        return { namaCO: p.namaCO, role: p.role, minggu: p.minggu, insentifRapor, insentifWeekly, total: insentifRapor + insentifWeekly };
      });

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    const isAdmin = adminEmails.indexOf(email) > -1;

    if (isAdmin) {
      res.status(200).json({ isAdmin: true, achievement: { FE: hasilFE, MR: hasilMR, BCH: hasilBCH }, penyelesaian: hasilPenyelesaian, totalInsentif, minggu });
      return;
    }

    const myRec = masterList.find(m => (m['EMAIL CO'] || '').toString().trim().toLowerCase() === email);
    const myName = myRec ? myRec['CO ALL'] : null;
    const semuaAchievement = [...hasilFE, ...hasilMR, hasilBCH].filter(Boolean);
    const myAchievement = semuaAchievement.find(h => h.namaCO === myName) || null;
    const myPenyelesaian = hasilPenyelesaian.find(h => h.namaCO === myName) || null;
    const myTotalInsentif = totalInsentif.find(t => t.namaCO === myName) || null;

    res.status(200).json({ isAdmin: false, achievement: myAchievement, penyelesaian: myPenyelesaian, totalInsentif: myTotalInsentif, minggu });
  } catch (err) {
    sendError(res, err);
  }
};

module.exports.__test = { hitungTargetDaily, tdHariDariCell, tdSusunKontrak };
