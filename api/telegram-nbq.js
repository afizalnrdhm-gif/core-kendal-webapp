const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const sharp = require('sharp');
const { SCOPE_SHEETS_RO, getAccessToken } = require('./_auth');
const { cleanCell } = require('./_sheet');

// ============================================================
// AUTH KE GOOGLE SHEETS (sama pola dengan endpoint lain)
// ============================================================

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

// ============================================================
// NAMA CO — alias command -> nama lengkap di sheet
// ============================================================
const CO_ALIAS = {
  rahul: 'ACHMAD RAHUL HIDAYAT',
  ulil: 'MOHAMAD IZZA ULIL WAFA',
  sigit: 'SIGIT KURNIAWAN'
};

// ============================================================
// TANGGAL WIB — rentang Jatuh Tempo (tgl 3 s/d H-1)
// ============================================================
function getWibDateParts() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { year: wib.getUTCFullYear(), month: wib.getUTCMonth(), day: wib.getUTCDate() };
}
function toIsoDate(y, m, d) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}
function getJatuhTempoRange() {
  const { year, month, day } = getWibDateParts();
  return { start: toIsoDate(year, month, 3), end: toIsoDate(year, month, day - 1) };
}
function fmtTanggalIndo(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d} ${bulan[m - 1]} ${y}`;
}
function fmtRupiah(n) {
  n = Math.round(n || 0);
  return 'Rp' + n.toLocaleString('id-ID');
}
function fmtPct(n) {
  return (n || 0).toFixed(2) + '%';
}

// ============================================================
// PARSING COMMAND
// ============================================================
function parseCommand(text) {
  const t = (text || '').trim();
  const parts = t.split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase().replace(/@\w+$/, '');
  const arg = (parts[1] || '').toLowerCase();

  if (cmd === '/fpd') return { type: 'mob', mobList: [1], title: 'FPD (First Payment Default)' };
  if (cmd === '/spd') return { type: 'mob', mobList: [2], title: 'SPD (Second Payment Default)' };
  if (cmd === '/realisasi') return { type: 'realisasi', title: 'Realisasi Hari Ini' };

  if (cmd === '/dashboard') {
    const rest = parts.slice(1).join(' ').toLowerCase();
    if (/\bnon\b|nonfleet/.test(rest)) return { type: 'dashboard', includeFleet: false, title: 'Dashboard — Data Aktual (Non-Fleet)' };
    if (/\ball\b/.test(rest)) return { type: 'dashboard', includeFleet: true, title: 'Dashboard — Data Aktual (Semua + Fleet)' };
    return { type: 'invalid' };
  }

  if (cmd === '/perform') {
    const rest = parts.slice(1).join(' ').toLowerCase();
    if (rest === 'all') return { type: 'perform', scope: 'all' };
    if (rest === 'co') return { type: 'perform', scope: 'co' };
    return { type: 'invalid' };
  }

  if (cmd !== '/nbq') return null;

  if (CO_ALIAS[arg]) return { type: 'co', co: CO_ALIAS[arg], title: 'NBQ — ' + CO_ALIAS[arg] };
  if (arg === 'mobilku') return { type: 'gp', gpList: ['MOBILKU'], title: 'NBQ — Group Product MOBILKU' };
  if (arg === 'motorku') return { type: 'gp', gpList: ['MOTORKU'], title: 'NBQ — Group Product MOTORKU' };
  if (arg === 'nb') return { type: 'gp', gpList: ['HONDA', 'YAMAHA'], title: 'NBQ — Group Product HONDA & YAMAHA' };

  // "/nbq 1-30" -> minta khusus Kepala Cabang: kontrak NBQ 1-12 yang Bucket Awal-nya 1-30 DAN
  // Kriteria Acct-nya masih STAY (bukan follow-up tunggakan seperti /nbq default, ini justru buat
  // mantau kontrak yang lagi "aman" di bucket 1-30 secara proaktif). Sengaja dicek SEBELUM
  // rangeMatch di bawah, karena "1-30" kalau lolos ke rangeMatch bakal kebaca sebagai MOB 1..30
  // (tidak berarti apa-apa, MOB asli cuma sampai 12) -- jadi gak nabrak makna MOB range yang udah
  // dipakai buat /nbq 1-3, /nbq 1-6, /nbq 1-9 (semua itu MOB beneran di bawah 12).
  if (arg === '1-30') return { type: 'bucket_stay', bucketAwal: 'P001_030', title: 'NBQ 1-12 — Bucket Awal 1-30 (STAY)' };

  const rangeMatch = arg.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10), to = parseInt(rangeMatch[2], 10);
    const mobList = [];
    for (let i = from; i <= to; i++) mobList.push(i);
    return { type: 'mob', mobList, title: `NBQ — MOB ${from}-${to}` };
  }
  return { type: 'invalid' };
}

function nbqNum(rec) {
  const v = (rec['NBQ'] || '').toString().trim();
  const m = v.match(/^(\d+)\s*MOB$/i);
  return m ? parseInt(m[1], 10) : null;
}

// ============================================================
// LABEL BUCKET (buat tabel /realisasi)
// ============================================================
const BUCKET_LABEL = {
  NOOD: 'NOOD',
  P001_030: '1-30',
  P031_060: '31-60',
  P061_090: '61-90',
  P091_120: '91-120',
  P121_150: '121-150',
  P151_180: '151-180',
  P181_210: '181-210',
  P211_240: '211-240'
};
function fmtBucketLabel(b) { return BUCKET_LABEL[b] || b || '-'; }

const REALISASI_COLS = [
  { key: 'NO KONTRAK', label: 'No Kontrak', width: 190 },
  { key: 'NAMA KONSUMEN', label: 'Nama Konsumen', width: 260, bold: true },
  { key: 'NAMA CO', label: 'Nama CO', width: 260 },
  { key: 'BUCKET AWAL', label: 'Bucket Awal', width: 140 }
];

// Kolom khusus /nbq 1-30. Dasarnya sesuai request Kepala Cabang (No Kontrak, Nama Konsumen,
// Group Product, CMO, Nama CO), ditambah MOB & Status NBQ (dikelompokkan deket Nama Konsumen,
// ngikutin pola tabel /nbq default) plus Angsuran (nominal, ditaruh paling belakang). "CO ALL"
// adalah nama kolom asli di sheet MASTER buat pemilik kontrak, dikasih label tampilan "Nama CO".
const BUCKET_STAY_COLS = [
  { key: 'NO KONTRAK', label: 'No Kontrak', width: 150 },
  { key: 'NAMA KONSUMEN', label: 'Nama Konsumen', width: 190, bold: true },
  { key: 'NBQ', label: 'MOB', width: 65 },
  { key: 'STATUS NBQ', label: 'Status NBQ', width: 120 },
  { key: 'GROUP PRODUCT', label: 'Group Product', width: 130 },
  { key: 'CMO', label: 'CMO', width: 160 },
  { key: 'CO ALL', label: 'Nama CO', width: 200 },
  { key: 'ANGSURAN_FMT', label: 'Angsuran', width: 130 }
];

const DASHBOARD_COLS = [
  { key: 'label', label: 'Metrik', width: 230, bold: true },
  { key: 'countFmt', label: 'Jumlah Akun', width: 150 },
  { key: 'amountFmt', label: 'Amount', width: 220 },
  { key: 'pctFmt', label: 'Percentage', width: 140 }
];

// ============================================================
// GENERATE GAMBAR TABEL (Satori -> SVG -> PNG)
// ============================================================
let FONT_CACHE = null;
function loadFonts() {
  if (FONT_CACHE) return FONT_CACHE;
  FONT_CACHE = [
    { name: 'PJS', data: fs.readFileSync(path.join(__dirname, 'PJS-Regular.woff')), weight: 400, style: 'normal' },
    { name: 'PJS', data: fs.readFileSync(path.join(__dirname, 'PJS-SemiBold.woff')), weight: 600, style: 'normal' },
    { name: 'PJS', data: fs.readFileSync(path.join(__dirname, 'PJS-Bold.woff')), weight: 700, style: 'normal' }
  ];
  return FONT_CACHE;
}

const COLS = [
  { key: 'NO KONTRAK', label: 'No Kontrak', width: 145 },
  { key: 'NAMA KONSUMEN', label: 'Nama Konsumen', width: 165, bold: true },
  { key: 'KELURAHAN', label: 'Kelurahan', width: 130 },
  { key: 'KECAMATAN', label: 'Kecamatan', width: 100 },
  { key: 'NO HP', label: 'No HP', width: 105 },
  { key: 'NBQ', label: 'MOB', width: 65 },
  { key: 'STATUS NBQ', label: 'Status NBQ', width: 120 },
  { key: 'DPD', label: 'DPD', width: 55, danger: true },
  { key: 'GROUP PRODUCT', label: 'Group Product', width: 105 },
  { key: 'CMO', label: 'CMO', width: 150 }
];

function cellDiv(text, width, opts) {
  opts = opts || {};
  if (Array.isArray(text)) {
    // Cell multi-baris (dipakai tabel Insentif Weekly: baris 1 = persen, baris 2 = rupiah)
    return {
      type: 'div',
      props: {
        style: { width, padding: '9px 7px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        children: text.map((line, i) => ({
          type: 'div',
          props: {
            style: {
              fontSize: i === 0 ? 12.5 : 11,
              fontWeight: i === 0 ? (opts.weight || 400) : 400,
              color: i === 0 ? (opts.color || '#1A2530') : '#66798A',
              whiteSpace: 'nowrap'
            },
            children: line === '' || line == null ? '-' : String(line)
          }
        }))
      }
    };
  }
  return {
    type: 'div',
    props: {
      style: {
        width, padding: '9px 7px', fontSize: 12.5, display: 'flex',
        color: opts.color || '#1A2530', fontWeight: opts.weight || 400,
        overflow: 'hidden', whiteSpace: 'nowrap'
      },
      children: text === '' || text == null ? '-' : String(text)
    }
  };
}

async function renderTableImage(title, subtitle, rows, cols, footerText) {
  cols = cols || COLS;
  const totalWidth = cols.reduce((s, c) => s + c.width, 0) + 40;

  const headerRow = {
    type: 'div', props: {
      style: { display: 'flex', background: '#0B3D62', color: '#fff' },
      children: cols.map(c => cellDiv(c.label, c.width, { weight: 700, color: '#fff' }))
    }
  };
  const bodyRows = rows.map((r, idx) => ({
    type: 'div', props: {
      style: { display: 'flex', background: idx % 2 === 0 ? '#ffffff' : '#F5F8FA', borderBottom: '1px solid #E2E9EE' },
      children: cols.map(c => cellDiv(r[c.key], c.width, { weight: c.bold ? 600 : 400, color: c.danger ? '#B23B2E' : undefined }))
    }
  }));

  const tree = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', width: totalWidth, background: '#fff', padding: 22, fontFamily: 'PJS' },
      children: [
        { type: 'div', props: { style: { fontSize: 21, fontWeight: 700, color: '#0B3D62' }, children: title } },
        { type: 'div', props: { style: { fontSize: 12.5, color: '#66798A', marginTop: 4, marginBottom: 16 }, children: subtitle } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', border: '1px solid #E2E9EE', borderRadius: 8, overflow: 'hidden' }, children: [headerRow, ...bodyRows] } },
        { type: 'div', props: { style: { fontSize: 10.5, color: '#9AA7B0', marginTop: 12 }, children: footerText || `Total: ${rows.length} kontrak` } }
      ]
    }
  };

  const svg = await satori(tree, { width: totalWidth, fonts: loadFonts() });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}

// ============================================================
// KIRIM KE TELEGRAM
// ============================================================
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    console.log('Telegram sendMessage GAGAL:', res.status, JSON.stringify(body));
  }
}

async function sendTelegramPhoto(chatId, pngBuffer) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'nbq.png');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    console.log('Telegram sendPhoto GAGAL:', res.status, JSON.stringify(body));
  }
}

function serialToDateStr(serial) {
  if (typeof serial !== 'number' || serial < 1000) return '';
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ============================================================
// DASHBOARD — data aktual real-time (replikasi logic api/dashboard.js)
// ============================================================
const DASH_BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210'];
function dashSipokOf(m) { return typeof m['SIPOK'] === 'number' ? m['SIPOK'] : 0; }
function dashSisaOf(k) { return typeof k['SISA PIUTANG'] === 'number' ? k['SISA PIUTANG'] : 0; }

function computeDashboardMetrics(masterRows, kaRows, includeFleet) {
  const passFleet = (row) => includeFleet || row['FLEET/NON FLEET'] !== 'FLEET';

  const bucketAmounts = {}; const bucketCounts = {};
  DASH_BUCKET_ORDER.forEach(b => { bucketAmounts[b] = 0; bucketCounts[b] = 0; });
  kaRows.forEach(ka => {
    if (!passFleet(ka)) return;
    const b = ka['BUCKET UPDATE'];
    if (DASH_BUCKET_ORDER.indexOf(b) > -1) { bucketAmounts[b] += dashSisaOf(ka); bucketCounts[b] += 1; }
  });
  const enr = DASH_BUCKET_ORDER.reduce((s, b) => s + bucketAmounts[b], 0);

  function balanceRow(label, b) {
    return { label, count: bucketCounts[b], amount: bucketAmounts[b], pct: enr > 0 ? (bucketAmounts[b] / enr) * 100 : 0 };
  }

  function cumulativeFrom(startIdx) {
    const amount = DASH_BUCKET_ORDER.slice(startIdx).reduce((s, b) => s + bucketAmounts[b], 0);
    const count = DASH_BUCKET_ORDER.slice(startIdx).reduce((s, b) => s + bucketCounts[b], 0);
    return { amount, count };
  }
  const delq30 = cumulativeFrom(2); // mulai dari P031_060 (30+)
  const delqRow = { label: 'Delq 30+', count: delq30.count, amount: delq30.amount, pct: enr > 0 ? (delq30.amount / enr) * 100 : 0 };

  function flowStat(asal, target) {
    let totalAsal = 0, amt = 0, countAmt = 0;
    masterRows.forEach(m => {
      if (!passFleet(m)) return;
      if (m['BUCKET AWAL'] !== asal) return;
      const sipok = dashSipokOf(m);
      totalAsal += sipok;
      if (m['BUCKET UPDATE'] === target) { amt += sipok; countAmt += 1; }
    });
    return { amount: amt, count: countAmt, pct: totalAsal > 0 ? (amt / totalAsal) * 100 : 0 };
  }

  return [
    balanceRow('Balance NOOD', 'NOOD'),
    balanceRow('Balance 1-30', 'P001_030'),
    balanceRow('Balance 31-60', 'P031_060'),
    delqRow,
    { label: 'Flow NOOD', ...flowStat('NOOD', 'P001_030') },
    { label: 'Flow 1-30', ...flowStat('P001_030', 'P031_060') },
    { label: 'Flow 31-60', ...flowStat('P031_060', 'P061_090') },
    { label: 'Btc 1-30', ...flowStat('P001_030', 'NOOD') },
    { label: 'Btc 31-60', ...flowStat('P031_060', 'NOOD') },
    { label: 'Rollback 31-60 -> 1-30', ...flowStat('P031_060', 'P001_030') }
  ];
}

// ============================================================
// PERFORMANCE / RAPOR — replikasi persis formula di api/insentif.js
// ============================================================
const RAPOR_BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240','P241_270'];
function raporBucketIndex(b) { return RAPOR_BUCKET_ORDER.indexOf(String(b || '').trim()); }
function raporSipokOf(m) { return typeof m['SIPOK'] === 'number' ? m['SIPOK'] : 0; }

const RAPOR_BUCKET_SHORT = {
  NOOD: 'NoOD',
  P001_030: '1-30',
  P031_060: '31-60',
  P061_090: '61-90',
  P091_120: '91-120',
  P121_150: '121-150',
  P151_180: '151-180',
  P181_210: '181-210',
  P211_240: '211-240',
  P241_270: '241-270'
};
function shortBucket(b) { return RAPOR_BUCKET_SHORT[b] || b || '-'; }

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

function hitungFERapor(masterList, petaKA, configRows) {
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
      return ka && raporBucketIndex(ka['FLOW EVER']) > raporBucketIndex(bucketPenyelesaian);
    }).length;
    const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

    const kontrakNOOD = kontrakCO.filter(m => m['BUCKET AWAL'] === bucketAsalFlow);
    let sipokFlowNoOD = 0, sipokTotalNOOD = 0;
    kontrakNOOD.forEach(m => { sipokTotalNOOD += raporSipokOf(m); if (m['BUCKET UPDATE'] === bucketPenyelesaian) sipokFlowNoOD += raporSipokOf(m); });
    const flowNoODPct = sipokTotalNOOD > 0 ? (sipokFlowNoOD / sipokTotalNOOD) * 100 : 0;

    let totalSipokBucket = 0, totalSipokAll = 0;
    Object.values(petaKA).forEach(ka => {
      if (ka['NAMA COLLECTOR'] !== namaCO || ka['FLEET/NON FLEET'] === 'FLEET') return;
      const bucket = ka['BUCKET UPDATE']; const idx = raporBucketIndex(bucket);
      const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0;
      if (idx !== -1 && idx <= raporBucketIndex('P181_210')) { totalSipokAll += sisa; if (bucketBalanceList.includes(bucket)) totalSipokBucket += sisa; }
    });
    const balancePct = totalSipokAll > 0 ? (totalSipokBucket / totalSipokAll) * 100 : 0;

    const nilaiBalance = tieringBalance1_30(balancePct);
    const nilaiFlowEver = tieringFlowEver1_30(flowEverPct);
    const nilaiFlowNoOD = tieringFlowNoOD(flowNoODPct);
    const totalNilai = nilaiBalance + nilaiFlowEver + nilaiFlowNoOD;
    const kategori = kategoriRapor(totalNilai);
    return { namaCO, role: 'FE', balancePct, flowEverPct, flowAsalPct: flowNoODPct, totalNilai, kategori, insentif: insentifRapor(kategori), totalAwal, flowEverEscaped, bucketPenyelesaian, bucketAsalFlow };
  });
}

function hitungMRRapor(masterList, petaKA, configRows) {
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
      return ka && raporBucketIndex(ka['FLOW EVER']) > raporBucketIndex(bucketPenyelesaian);
    }).length;
    const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

    let sipokFlow = 0, sipokTotalAsal = 0;
    masterList.forEach(m => {
      if (m['FLEET/NON FLEET'] === 'FLEET') return;
      if (m['BUCKET AWAL'] !== bucketAsalFlow) return;
      sipokTotalAsal += raporSipokOf(m); if (m['BUCKET UPDATE'] === bucketPenyelesaian) sipokFlow += raporSipokOf(m);
    });
    const flowPct = sipokTotalAsal > 0 ? (sipokFlow / sipokTotalAsal) * 100 : 0;

    let totalSipokBucket = 0, totalSipokAll = 0;
    Object.values(petaKA).forEach(ka => {
      if (ka['FLEET/NON FLEET'] === 'FLEET') return;
      const bucket = ka['BUCKET UPDATE']; const idx = raporBucketIndex(bucket);
      const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0;
      if (idx !== -1 && idx <= raporBucketIndex('P181_210')) { totalSipokAll += sisa; if (bucketBalanceList.includes(bucket)) totalSipokBucket += sisa; }
    });
    const balancePct = totalSipokAll > 0 ? (totalSipokBucket / totalSipokAll) * 100 : 0;

    const nilaiBalance = tieringBalance31_60(balancePct);
    const nilaiFlowEver = tieringFlowEver31_60(flowEverPct);
    const nilaiFlow = tieringFlow01_30(flowPct);
    const totalNilai = nilaiBalance + nilaiFlowEver + nilaiFlow;
    const kategori = kategoriRapor(totalNilai);
    return { namaCO, role: 'MR', balancePct, flowEverPct, flowAsalPct: flowPct, totalNilai, kategori, insentif: insentifRapor(kategori), totalAwal, flowEverEscaped, bucketPenyelesaian, bucketAsalFlow };
  });
}

function hitungBCHRapor(masterList, petaKA, configRows) {
  const bchRow = configRows.find(r => r['ROLE'] === 'BCH');
  if (!bchRow) return null;
  const namaCO = bchRow['NAMA_CO'];

  const populasiEver = masterList.filter(m => m['BUCKET AWAL'] === 'P001_030');
  const totalAwal = populasiEver.length;
  const flowEverEscaped = populasiEver.filter(m => {
    const ka = petaKA[m['NO KONTRAK']];
    return ka && raporBucketIndex(ka['FLOW EVER']) > raporBucketIndex('P001_030');
  }).length;
  const flowEverPct = totalAwal > 0 ? (flowEverEscaped / totalAwal) * 100 : 0;

  let sipokFlow = 0, sipokTotalAsal = 0;
  masterList.forEach(m => {
    if (m['BUCKET AWAL'] !== 'P031_060') return;
    sipokTotalAsal += raporSipokOf(m); if (m['BUCKET UPDATE'] === 'P061_090') sipokFlow += raporSipokOf(m);
  });
  const flowForwardPct = sipokTotalAsal > 0 ? (sipokFlow / sipokTotalAsal) * 100 : 0;

  let totalSipokBucket = 0, totalSipokAll = 0;
  Object.values(petaKA).forEach(ka => {
    const bucket = ka['BUCKET UPDATE']; const idx = raporBucketIndex(bucket);
    const sisa = typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : 0;
    if (idx !== -1 && idx <= raporBucketIndex('P181_210')) { totalSipokAll += sisa; if (bucket === 'P001_030' || bucket === 'P031_060') totalSipokBucket += sisa; }
  });
  const balancePct = totalSipokAll > 0 ? (totalSipokBucket / totalSipokAll) * 100 : 0;

  const nilaiFlowEver = tieringFlowEver1_30_BCH(flowEverPct);
  const nilaiFlowForward = tieringFlowForward31_60_BCH(flowForwardPct);
  const nilaiBalance = tieringBalance1_60_BCH(balancePct);
  const totalNilai = nilaiFlowEver + nilaiFlowForward + nilaiBalance;
  const kategori = kategoriRapor(totalNilai);
  return { namaCO, role: 'BCH', flowEverPct, flowForwardPct, balancePct, totalNilai, kategori, insentif: insentifRaporBCH(kategori), totalAwal, flowEverEscaped };
}

function feMrRowFor(h) {
  const balBucket = shortBucket(h.bucketPenyelesaian);
  const asalBucket = shortBucket(h.bucketAsalFlow);
  return {
    nama: h.namaCO,
    balance: `${balBucket}: ${fmtPct(h.balancePct)}`,
    flowEver: `${balBucket}: ${fmtPct(h.flowEverPct)} (${h.flowEverEscaped}/${h.totalAwal})`,
    flowAsal: `${asalBucket}: ${fmtPct(h.flowAsalPct)}`,
    nilai: h.totalNilai.toFixed(2),
    kategori: h.kategori
  };
}

function bchRowFor(h) {
  return {
    nama: h.namaCO,
    balance: `1-60: ${fmtPct(h.balancePct)}`,
    flowEver: `1-30: ${fmtPct(h.flowEverPct)} (${h.flowEverEscaped}/${h.totalAwal})`,
    flowAsal: `Fwd 31-60: ${fmtPct(h.flowForwardPct)}`,
    nilai: h.totalNilai.toFixed(2),
    kategori: h.kategori
  };
}

// ============================================================
// INSENTIF PENYELESAIAN MINGGUAN — replikasi persis formula di api/insentif.js
// ============================================================
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

function hitungPenyelesaianPct(masterList, filterFn, bucketAwalSet, includeFleet) {
  let sipokFlow = 0, sipokTotal = 0;
  masterList.forEach(m => {
    if (!includeFleet && m['FLEET/NON FLEET'] === 'FLEET') return;
    if (!filterFn(m)) return;
    if (!bucketAwalSet.includes(m['BUCKET AWAL'])) return;
    sipokTotal += raporSipokOf(m);
    if (raporBucketIndex(m['BUCKET UPDATE']) > raporBucketIndex(m['BUCKET AWAL'])) sipokFlow += raporSipokOf(m);
  });
  const flowPct = sipokTotal > 0 ? (sipokFlow / sipokTotal) * 100 : 0;
  return { pct: 100 - flowPct, sipokTotal };
}

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
    return { role, namaCO, minggu, pct: hasil.pct, sipokTotal: hasil.sipokTotal, nilai };
  });
}

// ============================================================
// GAMBAR RAPOR — tabel per section (FE / MR / BCH) dalam 1 gambar
// ============================================================
const RAPOR_COLS = [
  { key: 'nama', label: 'Nama CO', width: 200, bold: true },
  { key: 'balance', label: 'Balance', width: 120 },
  { key: 'flowEver', label: 'Flow Ever', width: 170 },
  { key: 'flowAsal', label: 'Flow', width: 130 },
  { key: 'nilai', label: 'Nilai Rapor', width: 90 },
  { key: 'kategori', label: 'Kategori', width: 155 }
];

function makeRaporHeaderRow() {
  return {
    type: 'div', props: {
      style: { display: 'flex', background: '#0B3D62', color: '#fff' },
      children: RAPOR_COLS.map(c => cellDiv(c.label, c.width, { weight: 700, color: '#fff' }))
    }
  };
}

// ============================================================
// TABEL INSENTIF WEEKLY (W1-W4) — dari log historis sheet LOG_MINGGUAN
// ============================================================
const WEEKLY_COLS = [
  { key: 'nama', label: 'Nama CO', width: 200, bold: true },
  { key: 'role', label: 'Role', width: 75 },
  { key: 'insentifRapor', label: 'Insentif Rapor', width: 145 },
  { key: 'w1', label: 'W1', width: 150 },
  { key: 'w2', label: 'W2', width: 150 },
  { key: 'w3', label: 'W3', width: 150 },
  { key: 'w4', label: 'W4', width: 150 },
  { key: 'total', label: 'Total Insentif', width: 165 }
];

function weeklyRowFor(namaCO, role, logByWeek, insentifRapor) {
  logByWeek = logByWeek || {};
  insentifRapor = insentifRapor || 0;
  function cellFor(w) {
    const d = logByWeek[w];
    if (!d) return ['Belum ada data', ''];
    return [fmtPct(d.pct), fmtRupiah(d.nilai)];
  }
  const totalWeekly = [1, 2, 3, 4].reduce((s, w) => s + (logByWeek[w] ? logByWeek[w].nilai : 0), 0);
  const total = insentifRapor + totalWeekly;
  return {
    nama: namaCO,
    role,
    insentifRapor: fmtRupiah(insentifRapor),
    w1: cellFor(1),
    w2: cellFor(2),
    w3: cellFor(3),
    w4: cellFor(4),
    total: fmtRupiah(total)
  };
}

function makeWeeklyHeaderRow() {
  return {
    type: 'div', props: {
      style: { display: 'flex', background: '#0B3D62', color: '#fff' },
      children: WEEKLY_COLS.map(c => cellDiv(c.label, c.width, { weight: 700, color: '#fff' }))
    }
  };
}

function buildWeeklyTableBlock(heading, rows) {
  const bodyRows = rows.map((r, idx) => ({
    type: 'div', props: {
      style: { display: 'flex', background: idx % 2 === 0 ? '#ffffff' : '#F5F8FA', borderBottom: '1px solid #E2E9EE' },
      children: WEEKLY_COLS.map(c => cellDiv(r[c.key], c.width, { weight: c.key === 'nama' ? 600 : 400 }))
    }
  }));
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', marginTop: 26 },
      children: [
        { type: 'div', props: { style: { fontSize: 14, fontWeight: 700, color: '#0B3D62', marginBottom: 8 }, children: heading } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', border: '1px solid #E2E9EE', borderRadius: 8, overflow: 'hidden' }, children: [makeWeeklyHeaderRow(), ...bodyRows] } }
      ]
    }
  };
}

async function renderRaporImage(title, subtitle, sections, weeklySection) {
  const totalWidth = Math.max(
    RAPOR_COLS.reduce((s, c) => s + c.width, 0),
    weeklySection ? WEEKLY_COLS.reduce((s, c) => s + c.width, 0) : 0
  ) + 40;

  function buildSectionBlock(section) {
    const bodyRows = section.rows.map((r, idx) => ({
      type: 'div', props: {
        style: { display: 'flex', background: idx % 2 === 0 ? '#ffffff' : '#F5F8FA', borderBottom: '1px solid #E2E9EE' },
        children: RAPOR_COLS.map(c => cellDiv(r[c.key], c.width, { weight: c.key === 'nama' ? 600 : 400 }))
      }
    }));
    return {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', marginTop: 18 },
        children: [
          { type: 'div', props: { style: { fontSize: 14, fontWeight: 700, color: '#0B3D62', marginBottom: 8 }, children: section.heading } },
          { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', border: '1px solid #E2E9EE', borderRadius: 8, overflow: 'hidden' }, children: [makeRaporHeaderRow(), ...bodyRows] } }
        ]
      }
    };
  }

  const children = [
    { type: 'div', props: { style: { fontSize: 21, fontWeight: 700, color: '#0B3D62' }, children: title } },
    { type: 'div', props: { style: { fontSize: 12.5, color: '#66798A', marginTop: 4 }, children: subtitle } },
    ...sections.map(buildSectionBlock)
  ];
  if (weeklySection) children.push(buildWeeklyTableBlock(weeklySection.heading, weeklySection.rows));

  const tree = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', width: totalWidth, background: '#fff', padding: 22, fontFamily: 'PJS' },
      children
    }
  };

  const svg = await satori(tree, { width: totalWidth, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ============================================================
// HANDLER UTAMA
// PENTING: response cuma dikirim SETELAH semua proses (termasuk kirim ke
// Telegram) selesai — supaya function-nya nggak dihentikan paksa duluan.
// ============================================================
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(200).json({ ok: true }); return; }
    // Pengaman (opsional, aktif kalau env var diisi di Vercel):
    // TELEGRAM_WEBHOOK_SECRET = secret_token yang didaftarkan di setWebhook
    // TELEGRAM_ALLOWED_CHAT_IDS = daftar chat id yang boleh memakai bot, pisahkan koma
    const whSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (whSecret && req.headers['x-telegram-bot-api-secret-token'] !== whSecret) {
      res.status(401).json({ ok: false }); return;
    }
    const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    let update = req.body;
    if (typeof update === 'string') { try { update = JSON.parse(update); } catch (e) { res.status(200).json({ ok: true }); return; } }

    const msg = update && update.message;
    if (!msg || !msg.text) { res.status(200).json({ ok: true }); return; }
    const chatId = msg.chat.id;
    if (allowed.length && !allowed.includes(String(chatId))) { res.status(200).json({ ok: true }); return; }

    const parsed = parseCommand(msg.text);
    if (!parsed) { res.status(200).json({ ok: true }); return; }

    if (parsed.type === 'invalid') {
      await sendTelegramMessage(chatId, 'Command tidak dikenali. Coba: /nbq rahul, /nbq ulil, /nbq mobilku, /nbq motorku, /nbq nb, /nbq 1-3, /nbq 1-6, /nbq 1-9, /nbq 1-30, /fpd, /spd, /realisasi, /dashboard all, /dashboard nonfleet, /perform all, /perform co');
      res.status(200).json({ ok: true });
      return;
    }

    if (parsed.type === 'realisasi') {
      const accessToken = await getAccessToken(SCOPE_SHEETS_RO);
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const [masterRes, kaRes] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        }),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('KA HARIAN')}?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        })
      ]);
      const masterJson = await masterRes.json();
      const kaJson = await kaRes.json();
      if (!masterJson.values || !kaJson.values) {
        await sendTelegramMessage(chatId, 'Gagal ambil data sheet.');
        res.status(200).json({ ok: true });
        return;
      }

      const allRows = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
      const bucketAwalMap = {};
      allRows.forEach(r => {
        bucketAwalMap[r['NO KONTRAK']] = {
          bucketAwal: r['BUCKET AWAL'],
          coAll: r['CO ALL'],
          namaKonsumen: r['NAMA KONSUMEN'],
          isFleet: r['FLEET/NON FLEET'] === 'FLEET'
        };
      });

      // KA HARIAN: header ada di baris ke-16 (index 15)
      const kaRows = parseSheetValues(kaJson.values, 15);

      const realisasiRows = kaRows
        .filter(r => r['NO KONTRAK'] && Number(r['REALISASI']) > 0)
        .map(r => {
          const master = bucketAwalMap[r['NO KONTRAK']] || {};
          return {
            'NO KONTRAK': r['NO KONTRAK'],
            'NAMA KONSUMEN': master.namaKonsumen || r['NAMA KONSUMEN'] || '-',
            'NAMA CO': master.coAll || r['NAMA COLLECTOR'] || '-',
            'BUCKET AWAL': fmtBucketLabel(master.bucketAwal),
            _isFleet: !!master.isFleet
          };
        })
        .filter(r => !r._isFleet);

      if (realisasiRows.length === 0) {
        await sendTelegramMessage(chatId, 'Belum ada realisasi hari ini.');
        res.status(200).json({ ok: true });
        return;
      }

      const { year, month, day } = getWibDateParts();
      const subtitle = `Update per: ${fmtTanggalIndo(toIsoDate(year, month, day))}`;
      const png = await renderTableImage(parsed.title, subtitle, realisasiRows, REALISASI_COLS);
      await sendTelegramPhoto(chatId, png);
      res.status(200).json({ ok: true });
      return;
    }

    if (parsed.type === 'dashboard') {
      const accessToken = await getAccessToken(SCOPE_SHEETS_RO);
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const [masterRes, kaRes] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        }),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('KA HARIAN')}?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        })
      ]);
      const masterJson = await masterRes.json();
      const kaJson = await kaRes.json();
      if (!masterJson.values || !kaJson.values) {
        await sendTelegramMessage(chatId, 'Gagal ambil data sheet.');
        res.status(200).json({ ok: true });
        return;
      }

      const masterRows = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
      const kaRowsDash = parseSheetValues(kaJson.values, 15).filter(r => r['NO KONTRAK']);

      const metrics = computeDashboardMetrics(masterRows, kaRowsDash, parsed.includeFleet);
      const rows = metrics.map(m => ({
        label: m.label,
        countFmt: String(m.count),
        amountFmt: fmtRupiah(m.amount),
        pctFmt: fmtPct(m.pct)
      }));

      const { year, month, day } = getWibDateParts();
      const subtitle = `Update per: ${fmtTanggalIndo(toIsoDate(year, month, day))}`;
      const png = await renderTableImage(parsed.title, subtitle, rows, DASHBOARD_COLS, 'Data aktual real-time dari sheet');
      await sendTelegramPhoto(chatId, png);
      res.status(200).json({ ok: true });
      return;
    }

    if (parsed.type === 'perform') {
      const accessToken = await getAccessToken(SCOPE_SHEETS_RO);
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const [masterRes, kaRes, roleRes, logRes] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        }),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('KA HARIAN')}?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        }),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/CONFIG_ROLE?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        }),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('LOG_MINGGUAN')}?valueRenderOption=UNFORMATTED_VALUE`, {
          headers: { Authorization: 'Bearer ' + accessToken }
        })
      ]);
      const masterJson = await masterRes.json();
      const kaJson = await kaRes.json();
      const roleJson = await roleRes.json();
      const logJson = await logRes.json(); // LOG_MINGGUAN opsional — kalau belum dibuat, tetap lanjut tanpa data W1-W4
      if (!masterJson.values || !kaJson.values || !roleJson.values) {
        await sendTelegramMessage(chatId, 'Gagal ambil data sheet.');
        res.status(200).json({ ok: true });
        return;
      }

      const masterList = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
      const kaRowsRapor = parseSheetValues(kaJson.values, 15);
      const petaKA = {};
      kaRowsRapor.forEach(r => { if (r['NO KONTRAK']) petaKA[r['NO KONTRAK']] = r; });
      const configRows = parseSheetValues(roleJson.values);

      const hasilFE = hitungFERapor(masterList, petaKA, configRows);
      const hasilMR = hitungMRRapor(masterList, petaKA, configRows);
      const hasilBCH = hitungBCHRapor(masterList, petaKA, configRows);

      const sections = [];
      if (hasilFE.length) sections.push({ heading: 'FRONT END (FE)', rows: hasilFE.map(h => feMrRowFor(h)) });
      if (hasilMR.length) sections.push({ heading: 'MID RANGE (MR)', rows: hasilMR.map(h => feMrRowFor(h)) });
      if (parsed.scope === 'all' && hasilBCH) sections.push({ heading: 'BRANCH COLLECTION HEAD (BCH)', rows: [bchRowFor(hasilBCH)] });

      if (sections.length === 0) {
        await sendTelegramMessage(chatId, 'Data rapor belum tersedia.');
        res.status(200).json({ ok: true });
        return;
      }

      // Insentif Rapor per CO — digabung ke tabel Insentif Weekly biar bisa ditotal jadi satu
      const raporInsentifMap = {};
      hasilFE.forEach(h => { raporInsentifMap[h.namaCO] = h.insentif; });
      hasilMR.forEach(h => { raporInsentifMap[h.namaCO] = h.insentif; });
      if (parsed.scope === 'all' && hasilBCH) raporInsentifMap[hasilBCH.namaCO] = hasilBCH.insentif;

      // Rekap historis W1-W4 dari sheet LOG_MINGGUAN (diisi otomatis tiap hari oleh cron log-snapshot)
      const { tahun: curTahun, bulan: curBulan } = tanggalEfektif();
      const logRows = logJson.values ? parseSheetValues(logJson.values) : [];
      const logMap = {};
      logRows.forEach(r => {
        if (Number(r['TAHUN']) !== curTahun || Number(r['BULAN']) !== curBulan) return;
        const namaCO = r['NAMA_CO'];
        const mgg = Number(r['MINGGU']);
        if (!namaCO || !mgg) return;
        if (!logMap[namaCO]) logMap[namaCO] = {};
        logMap[namaCO][mgg] = { pct: Number(r['PCT']) || 0, nilai: Number(r['NILAI']) || 0 };
      });
      const configRowsWeekly = configRows.filter(cfg => cfg['ROLE'] === 'FE' || cfg['ROLE'] === 'MR' || (parsed.scope === 'all' && cfg['ROLE'] === 'BCH'));
      const weeklySection = {
        heading: 'Insentif Weekly (W1 - W4)',
        rows: configRowsWeekly.map(cfg => weeklyRowFor(cfg['NAMA_CO'], cfg['ROLE'], logMap[cfg['NAMA_CO']], raporInsentifMap[cfg['NAMA_CO']]))
      };

      const title = parsed.scope === 'all' ? 'Performance Rapor — Semua (FE, MR, BCH)' : 'Performance Rapor — CO (FE & MR)';
      const { year, month, day } = getWibDateParts();
      const subtitle = `Update per: ${fmtTanggalIndo(toIsoDate(year, month, day))}`;

      const png = await renderRaporImage(title, subtitle, sections, weeklySection);
      await sendTelegramPhoto(chatId, png);
      res.status(200).json({ ok: true });
      return;
    }

    // /nbq 1-30 — populasi kontrak NBQ 1-12, Bucket Awal 1-30, Kriteria Acct STAY (proaktif,
    // BUKAN follow-up tunggakan kayak /nbq default -- makanya gak dibatasin JATUH TEMPO, dan cuma
    // butuh MASTER, gak perlu KA HARIAN).
    if (parsed.type === 'bucket_stay') {
      const accessToken = await getAccessToken(SCOPE_SHEETS_RO);
      const sheetId = process.env.GOOGLE_SHEET_ID;
      const masterRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      const masterJson = await masterRes.json();
      if (!masterJson.values) { await sendTelegramMessage(chatId, 'Gagal ambil data sheet.'); res.status(200).json({ ok: true }); return; }

      const allRows = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
      let rows = allRows.filter(m =>
        m['FLEET/NON FLEET'] !== 'FLEET' &&
        m['BUCKET AWAL'] === parsed.bucketAwal &&
        (m['KRITERIA ACCT'] || '').toString().trim().toUpperCase() === 'STAY' &&
        nbqNum(m) !== null && nbqNum(m) <= 12
      );
      rows.sort((a, b) => (nbqNum(a) || 0) - (nbqNum(b) || 0));

      if (rows.length === 0) {
        await sendTelegramMessage(chatId, `${parsed.title}: tidak ada kontrak yang cocok saat ini.`);
        res.status(200).json({ ok: true });
        return;
      }
      // Angsuran-nya di MASTER angka mentah -- diformat ke Rupiah dulu di field terpisah
      // (ANGSURAN_FMT) biar kolom aslinya gak ketiban, walau di sini gak dipakai lagi.
      rows = rows.map(r => Object.assign({}, r, { ANGSURAN_FMT: fmtRupiah(r['ANGSURAN']) }));

      const { year, month, day } = getWibDateParts();
      const subtitle = `Update per: ${fmtTanggalIndo(toIsoDate(year, month, day))}`;
      const png = await renderTableImage(parsed.title, subtitle, rows, BUCKET_STAY_COLS);
      await sendTelegramPhoto(chatId, png);
      res.status(200).json({ ok: true });
      return;
    }

    const accessToken = await getAccessToken(SCOPE_SHEETS_RO);
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const masterRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const masterJson = await masterRes.json();
    if (!masterJson.values) { await sendTelegramMessage(chatId, 'Gagal ambil data sheet.'); res.status(200).json({ ok: true }); return; }

    const allRows = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
    allRows.forEach(r => { r['JATUH TEMPO'] = serialToDateStr(r['JATUH TEMPO']); });

    const { start, end } = getJatuhTempoRange();

    let rows = allRows.filter(m =>
      m['FLEET/NON FLEET'] !== 'FLEET' &&
      m['BUCKET AWAL'] === 'NOOD' &&
      (m['KRITERIA ACCT'] || '').toString().trim().toUpperCase() === 'FLOW' &&
      nbqNum(m) !== null && nbqNum(m) <= 12 &&
      m['JATUH TEMPO'] >= start && m['JATUH TEMPO'] <= end
    );

    if (parsed.type === 'co') rows = rows.filter(m => m['CO ALL'] === parsed.co);
    else if (parsed.type === 'gp') rows = rows.filter(m => parsed.gpList.includes((m['GROUP PRODUCT'] || '').toString().trim().toUpperCase()));
    else if (parsed.type === 'mob') rows = rows.filter(m => parsed.mobList.includes(nbqNum(m)));

    rows.sort((a, b) => (typeof b['DPD'] === 'number' ? b['DPD'] : 0) - (typeof a['DPD'] === 'number' ? a['DPD'] : 0));

    if (rows.length === 0) {
      await sendTelegramMessage(chatId, `${parsed.title} sudah bayar semua ✅`);
      res.status(200).json({ ok: true });
      return;
    }

    const subtitle = `Jatuh Tempo: ${fmtTanggalIndo(start)} – ${fmtTanggalIndo(end)}`;
    const png = await renderTableImage(parsed.title, subtitle, rows);
    await sendTelegramPhoto(chatId, png);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.log('Error telegram-nbq:', err.message);
    try { res.status(200).json({ ok: true }); } catch (e) {}
  }
};
