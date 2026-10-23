// Proyeksi Cabang — simulasi berdiri sendiri (bukan bagian dari Simulasi Rapor), cabang-wide (bukan per-CO).
// Dua input digabung lalu dihitung ulang pakai mesin hitungKpi yang sama persis dipakai Ringkasan:
//   1) Pergerakan kontrak existing, dipilih per KATEGORI di UI (Flow NOOD, Flow 1-30, Flow 31-60,
//      BTC 1-30, BTC 31-60, Rollback 31-60, Lunas) — tiap kategori punya bucket kandidat & target
//      bucket tetap sendiri (lihat PC_STEPS di index.html), jadi di backend cukup terima noKontrak ->
//      TARGET (kode bucket atau 'LUNAS') dan paksa BUCKET UPDATE-nya = TARGET itu (lihat terapkanProyeksi).
//   2) Plan Sales — nominal rencana pencairan yang BELUM golive (bukan actual; begitu golive otomatis
//      muncul sendiri di KA HARIAN). Nominal ini disuntikkan sebagai baris KA HARIAN sintetis di bucket
//      NOOD, jadi otomatis kena hitung ke ENR (pembagi) & Balance NOOD (pembilang) lewat hitungKpi yang
//      sudah teruji (tests/kpi.test.js) tanpa perlu duplikasi rumus Balance/Delq di sini.
const { getAccessToken, sendError, verifyIdToken } = require('./_auth');
const { cleanCell } = require('./_sheet');
const { BUCKET_ORDER, isFleet, sipokOf, hitungKpi } = require('./_kpi');

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

// Kontrak yang Kriteria Acct-nya udah BTC/LUNAS dianggap sudah "resolved" bulan ini, gak usah
// ditawarkan lagi buat diproyeksikan (sama seperti simulasi-rapor.js).
function masihRelevan(m) {
  const k = (m['KRITERIA ACCT'] || '').toString().trim().toUpperCase();
  return k !== 'BTC' && k !== 'LUNAS';
}

// Daftar kontrak yang bisa dipilih: cabang penuh, siapapun CO-nya, selama posisinya SEKARANG
// (KA HARIAN) masih di cakupan ENR (NOOD..P181_210) — kontrak yang sudah lewat dari situ dianggap
// di luar cakupan balance/delq yang dilihat Ringkasan.
function daftarKontrakCabang(masterRows, kaRows) {
  const petaKA = {};
  kaRows.forEach(r => { if (r['NO KONTRAK']) petaKA[r['NO KONTRAK']] = r; });
  const list = [];
  masterRows.forEach(m => {
    const noKontrak = m['NO KONTRAK']; if (!noKontrak) return;
    if (!masihRelevan(m)) return;
    const ka = petaKA[noKontrak];
    const bucketSekarang = ((ka ? ka['BUCKET UPDATE'] : m['BUCKET UPDATE']) || '').toString().trim();
    if (BUCKET_ORDER.indexOf(bucketSekarang) === -1) return;
    const bucketAwal = (m['BUCKET AWAL'] || '').toString().trim();
    list.push({
      noKontrak,
      namaKonsumen: m['NAMA KONSUMEN'],
      bucketAwal,
      bucketSekarang,
      sisaPiutang: ka && typeof ka['SISA PIUTANG'] === 'number' ? ka['SISA PIUTANG'] : sipokOf(m),
      kriteriaAcct: m['KRITERIA ACCT'] || null,
      // STATUS BAYAR beda sama KRITERIA ACCT: KRITERIA ACCT cuma soal pindah bucket apa nggak (STAY
      // bisa aja artinya belum pindah TAPI udah ada pembayaran bulan ini — makanya dia "tertahan" di
      // bucket yang sama). Field ini yang jadi sinyal asli belum/sudah ada pembayaran, dipakai buat
      // nyaring kandidat Flow (lihat getPCStepKontrakFiltered_ & pcSudahBayar_ di index.html).
      statusBayar: m['STATUS BAYAR'] || null,
      coAll: m['CO ALL'] || null,
      fleet: isFleet(m)
    });
  });
  list.sort((a, b) => {
    const ia = BUCKET_ORDER.indexOf(a.bucketSekarang), ib = BUCKET_ORDER.indexOf(b.bucketSekarang);
    if (ia !== ib) return ia - ib;
    return b.sisaPiutang - a.sisaPiutang;
  });
  return list;
}

// Terapkan proyeksi ke masterRows & kaRows. `proyeksi` di sini adalah noKontrak -> TARGET, di mana
// TARGET adalah salah satu kode bucket (NOOD/P001_030/P031_060/P061_090 dst, lihat BUCKET_ORDER) atau
// string 'LUNAS'. Ini dipilih lewat UI per-kategori (Flow NOOD, Flow 1-30, BTC 1-30, Rollback 31-60,
// dst) yang masing-masing kategori sudah punya target bucket tetap sendiri — jadi di sini tinggal:
//   TARGET bucket -> BUCKET UPDATE (masterRows & kaRows) dipaksa = TARGET itu (piutang tetap ada).
//   'LUNAS'       -> kontrak dibuang total dari masterRows & kaRows (keluar dari buku).
function terapkanProyeksi(masterRows, kaRows, proyeksi) {
  const lunasSet = new Set(); const targetMap = {};
  Object.keys(proyeksi || {}).forEach(k => {
    const v = proyeksi[k];
    if (v === 'LUNAS') lunasSet.add(k);
    else if (BUCKET_ORDER.indexOf(v) > -1) targetMap[k] = v;
  });

  const masterRows2 = masterRows
    .filter(m => !lunasSet.has(m['NO KONTRAK']))
    .map(m => {
      const nk = m['NO KONTRAK'];
      return targetMap[nk] ? Object.assign({}, m, { 'BUCKET UPDATE': targetMap[nk] }) : m;
    });

  const kaRows2 = kaRows
    .filter(r => !lunasSet.has(r['NO KONTRAK']))
    .map(r => {
      const nk = r['NO KONTRAK'];
      return targetMap[nk] ? Object.assign({}, r, { 'BUCKET UPDATE': targetMap[nk] }) : r;
    });

  return { masterRows2, kaRows2 };
}

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan.' }); return; }
    const [email, accessToken] = await Promise.all([verifyIdToken(idToken), getAccessToken()]);

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    if (adminEmails.indexOf(email) === -1) { res.status(403).json({ error: 'Menu ini khusus admin/head.' }); return; }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const [masterRes, kaRes] = await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('KA HARIAN')}?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } })
    ]);
    const masterJson = await masterRes.json();
    const kaJson = await kaRes.json();
    const masterRows = parseSheetValues(masterJson.values || []).filter(r => r['NO KONTRAK']);
    const kaRows = parseSheetValues(kaJson.values || [], 15).filter(r => r['NO KONTRAK']); // header KA HARIAN di baris 16

    if (req.method === 'POST') {
      const body = req.body || {};
      const proyeksiRaw = (body.proyeksi && typeof body.proyeksi === 'object' && !Array.isArray(body.proyeksi)) ? body.proyeksi : {};
      const proyeksi = {};
      Object.keys(proyeksiRaw).forEach(k => { const v = proyeksiRaw[k]; if (v === 'LUNAS' || BUCKET_ORDER.indexOf(v) > -1) proyeksi[k] = v; });
      const includeFleet = !!body.includeFleet;
      const planSales = Math.max(0, Number(body.planSales) || 0);

      const { masterRows2, kaRows2 } = terapkanProyeksi(masterRows, kaRows, proyeksi);
      if (planSales > 0) {
        // Plan sales = kontrak belum golive, jadi otomatis anggap non-fleet (mayoritas kasus) dan
        // langsung masuk bucket NOOD — begitu golive beneran, nanti muncul sendiri di KA HARIAN.
        kaRows2.push({ 'NO KONTRAK': '__PLAN_SALES__', 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': planSales, 'FLEET/NON FLEET': 'NON FLEET' });
      }

      const original = hitungKpi(masterRows, kaRows, includeFleet);
      const proyeksiHasil = hitungKpi(masterRows2, kaRows2, includeFleet);

      res.status(200).json({
        original,
        proyeksi: proyeksiHasil,
        jumlahKontrakDipilih: Object.keys(proyeksi).length,
        planSales
      });
      return;
    }

    // GET: daftar kontrak yang bisa dipilih buat diproyeksikan.
    const kontrakList = daftarKontrakCabang(masterRows, kaRows);
    res.status(200).json({ kontrakList, generatedAt: new Date().toISOString() });
  } catch (err) {
    sendError(res, err);
  }
};
