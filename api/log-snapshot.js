// ============================================================
// LOG SNAPSHOT MINGGUAN — dipanggil otomatis tiap hari oleh Vercel Cron
// (lihat "crons" di vercel.json). Menghitung persen & insentif penyelesaian
// mingguan (formula sama persis dengan api/insentif.js) lalu menyimpannya
// ke sheet LOG_MINGGUAN, supaya /perform bisa nampilin rekap W1-W4.
//
// Upsert per (TAHUN, BULAN, MINGGU, NAMA_CO): selama minggu itu masih
// berjalan, barisnya terus di-update tiap hari cron ini jalan. Begitu
// minggu baru mulai, baris minggu sebelumnya berhenti diupdate dan jadi
// riwayat permanen.
// ============================================================
const crypto = require('crypto');

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Scope full (bukan readonly) karena endpoint ini perlu MENULIS ke sheet.
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
    rec['_rowNumber'] = r + 1;
    rows.push(rec);
  }
  return rows;
}

// ============================================================
// BUCKET & FORMULA PENYELESAIAN MINGGUAN (persis sama dengan api/insentif.js)
// ============================================================
const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240','P241_270'];
function bucketIndex(b) { return BUCKET_ORDER.indexOf(String(b || '').trim()); }
function sipokOf(m) { return typeof m['SIPOK'] === 'number' ? m['SIPOK'] : 0; }

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
function getTahunBulanSekarang() {
  const e = tanggalEfektif();
  return { tahun: e.tahun, bulan: e.bulan };
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
    sipokTotal += sipokOf(m);
    if (bucketIndex(m['BUCKET UPDATE']) > bucketIndex(m['BUCKET AWAL'])) sipokFlow += sipokOf(m);
  });
  const flowPct = sipokTotal > 0 ? (sipokFlow / sipokTotal) * 100 : 0;
  return { pct: 100 - flowPct, sipokTotal };
}

function hitungPenyelesaianSemua(masterList, configRows, minggu) {
  // Cuma role FE/MR/BCH yang punya target & tabel insentif — role lain (mis. DESKCALL) dilewati
  return configRows.filter(cfg => cfg['ROLE'] === 'FE' || cfg['ROLE'] === 'MR' || cfg['ROLE'] === 'BCH').map(cfg => {
    const role = cfg['ROLE'];
    const namaCO = cfg['NAMA_CO'];
    const bucketSet = (cfg['BUCKET_PENYELESAIAN'] || '').split(',').map(s => s.trim());
    const filterFn = role === 'FE' ? (m => m['CO ALL'] === namaCO) : (() => true);
    const includeFleet = role === 'BCH';
    const hasil = hitungPenyelesaianPct(masterList, filterFn, bucketSet, includeFleet);
    const tabelFn = role === 'FE' ? insentifPenyelesaianFE : role === 'MR' ? insentifPenyelesaianMR : insentifPenyelesaianBCH;
    const nilai = tabelFn(hasil.pct, minggu);
    return { role, namaCO, pct: hasil.pct, sipokTotal: hasil.sipokTotal, nilai };
  });
}

// ============================================================
// HANDLER — dipanggil oleh Vercel Cron (GET), bisa juga dites manual di browser
// ============================================================
const LOG_SHEET = 'LOG_MINGGUAN';

module.exports = async (req, res) => {
  try {
    // Proteksi opsional: kalau CRON_SECRET di-set di Vercel, endpoint ini cuma
    // mau jalan kalau dipanggil pakai secret itu (Vercel Cron otomatis kirim
    // header ini kalau CRON_SECRET di-set). Kalau env var-nya kosong, dilewati.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) console.log('PERINGATAN: CRON_SECRET belum diisi — endpoint ini terbuka untuk umum.');
    if (cronSecret) {
      const authHeader = req.headers['authorization'] || '';
      if (authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({ ok: false, error: 'Unauthorized' });
        return;
      }
    }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const [masterRes, roleRes, logRes] = await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/CONFIG_ROLE?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(LOG_SHEET)}?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      })
    ]);
    const masterJson = await masterRes.json();
    const roleJson = await roleRes.json();
    const logJson = await logRes.json();

    if (!masterJson.values || !roleJson.values) {
      console.log('Gagal baca MASTER/CONFIG_ROLE:', JSON.stringify({ masterJson, roleJson }));
      res.status(500).json({ ok: false, error: 'Gagal baca sheet MASTER/CONFIG_ROLE (detail ada di log Vercel).' });
      return;
    }
    if (!logJson.values) {
      res.status(500).json({
        ok: false,
        error: `Sheet "${LOG_SHEET}" belum ada atau gagal dibaca. Buat dulu sheet baru bernama persis "${LOG_SHEET}" dengan header baris pertama: TAHUN, BULAN, MINGGU, ROLE, NAMA_CO, PCT, SIPOK_TOTAL, NILAI, UPDATE_TERAKHIR`
      });
      return;
    }

    const masterList = parseSheetValues(masterJson.values).filter(m => m['NO KONTRAK']);
    // Cuma role yang punya target rapor (FE/MR/BCH) yang disnapshot — role lain (misal DESKCALL) tidak ada target insentif.
    const configRows = parseSheetValues(roleJson.values).filter(r => ['FE', 'MR', 'BCH'].includes(r['ROLE']));
    const logRows = parseSheetValues(logJson.values);

    const { tahun, bulan } = getTahunBulanSekarang();
    const minggu = getMingguSekarang();
    const hasil = hitungPenyelesaianSemua(masterList, configRows, minggu);

    // Index baris LOG_MINGGUAN yang sudah ada, key = tahun|bulan|minggu|namaCO
    const existingIndex = {};
    logRows.forEach(r => {
      const key = [r['TAHUN'], r['BULAN'], r['MINGGU'], r['NAMA_CO']].join('|');
      existingIndex[key] = r['_rowNumber'];
    });

    const nowIso = new Date().toISOString();
    const toUpdate = [];
    const toAppend = [];

    hasil.forEach(h => {
      const key = [tahun, bulan, minggu, h.namaCO].join('|');
      const rowValues = [tahun, bulan, minggu, h.role, h.namaCO, h.pct, h.sipokTotal, h.nilai, nowIso];
      const rowNumber = existingIndex[key];
      if (rowNumber) {
        toUpdate.push({ range: `${LOG_SHEET}!A${rowNumber}:I${rowNumber}`, values: [rowValues] });
      } else {
        toAppend.push(rowValues);
      }
    });

    if (toUpdate.length > 0) {
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: toUpdate })
      });
      const updateJson = await updateRes.json();
      if (!updateRes.ok) throw new Error('Gagal update LOG_MINGGUAN: ' + JSON.stringify(updateJson));
    }

    if (toAppend.length > 0) {
      const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(LOG_SHEET)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: toAppend })
      });
      const appendJson = await appendRes.json();
      if (!appendRes.ok) throw new Error('Gagal tambah baris LOG_MINGGUAN: ' + JSON.stringify(appendJson));
    }

    res.status(200).json({
      ok: true,
      tahun, bulan, minggu,
      updated: toUpdate.length,
      appended: toAppend.length,
      total: hasil.length
    });
  } catch (err) {
    console.log('Error log-snapshot:', err.message);
    res.status(500).json({ ok: false, error: 'Gagal menjalankan snapshot (detail ada di log Vercel).' });
  }
};
