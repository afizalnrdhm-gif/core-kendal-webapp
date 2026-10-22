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

// ============================================================
// MODE HEAD (?mode=head): data layar "Hari ini" dan "Diagnosa" untuk head. Spec: docs/superpowers/specs/2026-10-21-tampilan-head-design.md
// ============================================================
const { flowLebar, btcKe } = require('./_kpi');
const D = require('./_diagnosa');
const { tanggalBayarLPC } = require('./_sheet');
const { bacaSheet } = require('./_cachesheet');
const { bacaLogHarian } = require('./_logharian');
const { segmenGabung, petaKA: petaKASegmen } = require('./_segmen');
const INS = require('./insentif');
const { bayarLPC } = require('./_sheet');
const { terapkanProgres, bacaBaseline, bacaHasil, kunciTanggal } = require('./_tdsnap');
const { susunTargetDailyHead } = require('./_tdhead');

const AMBANG_BERUBAH = 2;
const PASANGAN_IRISAN = [['groupProduct', 'statusNbq'], ['co', 'statusNbq'], ['co', 'groupProduct'], ['segmen', 'statusNbq'], ['typeBarang', 'statusNbq'], ['co', 'segmen']];
const r2h = v => Math.round((Number(v) || 0) * 100) / 100;
const pad2 = n => String(n).padStart(2, '0');

function batasCabang_(kunci, awalan) {
  const p = (INS.TD_PARAMETER.BCH || []).find(x => x.kunci === kunci);
  return p ? `batas akhir bulan ${p.arah === 'naik' ? '≥' : '≤'}${String(p.persen).replace('.', ',')}%` : '';
}

// Nomor kontrak dengan DKH bulan ini (STATUS ASSIGN/DIBUAT di DKH_ASSIGN).
function dkhBulanIni(dkhAssign, bulanIni) {
  const dkh = new Set();
  const dh = (dkhAssign && dkhAssign[0] || []).map(x => String(x || '').trim().toUpperCase());
  const iT = dh.indexOf('UNTUK_TANGGAL'), iN = dh.indexOf('NO_KONTRAK'), iS = dh.indexOf('STATUS');
  (dkhAssign || []).slice(1).forEach(r => {
    const st = String(r[iS] || '').trim().toUpperCase();
    if ((st === 'ASSIGN' || st === 'DIBUAT') && String(r[iT] || '').startsWith(bulanIni)) dkh.add(String(r[iN] || '').trim());
  });
  return dkh;
}

function susunHead(o) {
  const { master, ka, lpc, dkhAssign, logHarian, config, hariIni, minggu, tdHead } = o;
  const tanggal = `${hariIni.tahun}-${pad2(hariIni.bulan)}-${pad2(hariIni.hari)}`;
  const bulanIni = `${hariIni.tahun}-${pad2(hariIni.bulan)}`;

  const dkh = dkhBulanIni(dkhAssign, bulanIni);
  const konteks = { dkh };

  // Riwayat: snapshot terakhir sebelum hari ini
  // Snapshot tanggal T berisi data H-1 (T-1). Pembanding hanya snapshot yang bulan datanya sama dengan data sekarang,
  // supaya awal bulan tidak dibandingkan dengan penutupan bulan lalu (flow sudah di-reset).
  const bulanData = t => { const d = new Date(t + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 7); };
  const tglLalu = Object.keys(logHarian || {}).filter(t => t < tanggal && bulanData(t) === bulanData(tanggal)).sort().pop();
  const kemarin = tglLalu ? ((logHarian[tglLalu] || {}).CABANG || {}) : null;
  const riwayatCukup = !!(kemarin && Object.keys(kemarin).length);

  const kpi = hitungKpi(master, ka, false);
  const kum = l => kpi.cumulative.find(c => c.label === l) || { amount: 0, pct: 0 };
  const defKartu = [
    { kunci: 'balNood', judul: 'Balance NOOD', log: 'BAL NOOD', naikBaik: true, v: { amount: kpi.perBucket[0].amount, pct: kpi.perBucket[0].pct }, batasTeks: batasCabang_('balance_nood') },
    { kunci: 'flowNood', judul: 'Flow NOOD', log: 'FLOW NOOD', naikBaik: false, v: flowLebar(master, 'NOOD', false), batasTeks: batasCabang_('flow_nood') },
    { kunci: 'flow130', judul: 'Flow 1-30', log: 'FLOW 1-30', naikBaik: false, v: flowLebar(master, 'P001_030', false), batasTeks: batasCabang_('flow_1_30') },
    { kunci: 'flow3160', judul: 'Flow 31-60', log: 'FLOW 31-60', naikBaik: false, v: flowLebar(master, 'P031_060', false), batasTeks: batasCabang_('flow_31_60') },
    { kunci: 'btc130', judul: 'BTC 1-30', log: 'BTC 1-30', naikBaik: true, v: btcKe(master, 'P001_030', false), batasTeks: '' },
    { kunci: 'delq', judul: '30+ (Delq)', log: '30+', naikBaik: false, v: kum('30+ (Delq)'), batasTeks: batasCabang_('balance_30plus') }
  ];
  const kartu = defKartu.map(d => {
    const pct = r2h(d.v.pct), kmr = riwayatCukup && kemarin[d.log] ? r2h(kemarin[d.log].pct) : null;
    let arah = null;
    if (kmr !== null) { const s = pct - kmr; arah = Math.abs(s) < 0.005 ? 'tetap' : ((s > 0) === d.naikBaik ? 'membaik' : 'memburuk'); }
    return { kunci: d.kunci, judul: d.judul, pct, amt: Math.round(d.v.amount || 0), batasTeks: d.batasTeks, kemarin: kmr, arah };
  });
  const berubah = kartu.filter(c => c.kemarin !== null && Math.abs(c.pct - c.kemarin) >= AMBANG_BERUBAH)
    .map(c => ({ kunci: c.kunci, judul: c.judul, dari: c.kemarin, ke: c.pct, selisih: r2h(c.pct - c.kemarin), arah: c.arah }))
    .sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih)).slice(0, 3);

  // Diagnosa per angka
  const kaPorNo = new Map((ka || []).map(r => [String(r['NO KONTRAK'] || '').trim(), r]));
  const bayarIni = tanggalBayarLPC(lpc, hariIni.bulan);
  const hariIniFn = r => bayarIni.has(String(r['NO KONTRAK']).trim()) ? bayarIni.get(String(r['NO KONTRAK']).trim()) : null;
  const hariLaluFn = r => { const k = kaPorNo.get(String(r['NO KONTRAK']).trim()); return k ? D.hariDari(k['TGL BYR M1']) : null; };
  // Minggu yang belum terjadi di bulan berjalan = null (garis berhenti di minggu berjalan).
  const potong = arr => arr.map((v, i) => i + 1 > minggu ? null : v);
  const potongSeg = o => { const x = {}; Object.keys(o).forEach(k => { x[k] = potong(o[k]); }); return x; };
  const diagnosa = {}, kandidatPenyebab = [];
  Object.keys(D.ANGKA).forEach(angka => {
    const p = D.populasi(master, angka, { fleet: false });
    const rk = D.ringkas(p.rows, p.masalah);
    const urai = {};
    Object.keys(D.DIMENSI).forEach(dim => { urai[dim] = D.urai(p.rows, p.masalah, D.DIMENSI[dim].nilai, konteks); });
    const ir = [];
    PASANGAN_IRISAN.forEach(([a, b]) => D.irisan(p.rows, p.masalah, D.DIMENSI[a].nilai, D.DIMENSI[b].nilai, 3, konteks).forEach(x => ir.push(x)));
    ir.sort((a, b) => (b.pengaruh - a.pengaruh) || (b.masalah - a.masalah));
    const kal = D.kalimat(D.ANGKA[angka].judul, rk, urai);
    diagnosa[angka] = {
      judul: D.ANGKA[angka].judul, ringkas: rk, kalimat: kal,
      mingguan: { ini: potong(D.mingguan(p.rows, hariIniFn)), lalu: D.mingguan(p.rows, hariLaluFn) },
      segmen: { ini: potongSeg(D.mingguanPerSegmen(p.rows, hariIniFn)), lalu: D.mingguanPerSegmen(p.rows, hariLaluFn) },
      urai, irisan: ir.slice(0, 10), teratas: D.kontrakTeratas(p.rows, p.masalah, 20)
    };
    let terbesar = 0, dimUtama = null;
    Object.keys(urai).filter(dim => !D.DIMENSI_WAKTU.has(dim)).forEach(dim => urai[dim].forEach(u => { if (u.pemberat && u.pengaruh > terbesar) { terbesar = u.pengaruh; dimUtama = dim; } }));
    if (terbesar > 0 && kal[1]) kandidatPenyebab.push({ angka, judul: D.ANGKA[angka].judul, kalimat: kal[1], pengaruh: r2h(terbesar), dim: dimUtama });
  });
  const penyebab = kandidatPenyebab.sort((a, b) => b.pengaruh - a.pengaruh).slice(0, 3);

  // Tim dan kerja hari ini
  const janjiHariIni = r => D.hariDari(r['JANJI BAYAR']) === hariIni.hari;
  const cfg = (config || []).filter(c => ['FE', 'MR', 'BCH'].includes(String(c['ROLE'] || '').trim()));
  const pny = INS.hitungPenyelesaianSemua(master, cfg);
  const tim = pny.map(p => ({
    co: p.namaCO, role: p.role, penyelesaianPct: r2h(p.pct),
    targetPct: ((INS.TABEL_BATAS[p.role] || {})[minggu] || [null])[0],
    janjiHariIni: master.filter(m => janjiHariIni(m) && (p.role !== 'FE' || m['CO ALL'] === p.namaCO)).length
  }));
  const sudahBayar = m => /SUDAH|LUNAS/.test(String(m['STATUS BAYAR'] || '').toUpperCase());
  const kerja = {
    jatuhTempoBelumDkh: master.filter(m => m['FLEET/NON FLEET'] !== 'FLEET' && ['NOOD', 'P001_030', 'P031_060'].includes(String(m['BUCKET AWAL']).trim())
      && !sudahBayar(m) && (h => h !== null && h <= hariIni.hari)(D.hariDari(m['JATUH TEMPO'])) && !dkh.has(String(m['NO KONTRAK']).trim())).length,
    janjiHariIni: master.filter(janjiHariIni).length
  };

  // Tanggal 1: data masih penutupan bulan lalu (W4 bulan lalu) — tidak ada sisa hari.
  const sisaHari = hariIni.hari === 1 && minggu === 4 ? 0 : (minggu === 4 ? new Date(Date.UTC(hariIni.tahun, hariIni.bulan, 0)).getUTCDate() : minggu * 7) - hariIni.hari + 1;
  return { tanggal, minggu: { ke: minggu, sisaHari },
    riwayatCukup, kartu, berubah, penyebab, tim, kerja, diagnosa,
    targetDaily: tdHead || null, tindakan: D.tindakan(penyebab, tdHead, diagnosa) };
}

// Target Daily untuk head: target & daftar pagi dari baseline (tidak membekukan, tidak menulis hasil), realisasi §7.4.
function bangunTdHead({ mRaw, master, ka, lpc, prodRaw, config, base, hasil, hariIni, dkhAssign }) {
  const petaKA = {}; (ka || []).forEach(r => { petaKA[r['NO KONTRAK']] = r; });
  const td = INS.__test.hitungTargetDaily(master, petaKA, config, bayarLPC(lpc || [], hariIni.hari, hariIni.bulan));
  td.pic.forEach(p => p.poin.forEach(q => { q.belum = (q.semuaKandidat || []).slice(); }));
  terapkanProgres(td, base || {});
  let cmsItems = [];
  try { if (prodRaw && prodRaw.length) cmsItems = require('./cms').compute(mRaw, prodRaw, config).items || []; } catch (e) { cmsItems = []; }
  // dkhAssign null berarti DKH_ASSIGN gagal dibaca (bukan "tidak ada DKH bulan ini") — teruskan null agar
  // _tdhead.js tidak menyimpulkan BELUM DKH dari data yang sebenarnya tidak tersedia.
  const dkh = dkhAssign == null ? null : dkhBulanIni(dkhAssign, `${hariIni.tahun}-${String(hariIni.bulan).padStart(2, '0')}`);
  return susunTargetDailyHead({ td, base: base || {}, hasil: hasil || [], cmsItems, master, hariIni, dkh });
}

function hariIniWIB_() { const w = new Date(Date.now() + 7 * 3600 * 1000); return { tahun: w.getUTCFullYear(), bulan: w.getUTCMonth() + 1, hari: w.getUTCDate() }; }

async function handleHead(res, accessToken, sheetId) {
  const opsional = p => p.catch(() => null);
  const [mRaw, kRaw, lpc, dkhAssign, roleRaw, logHarian, prodRaw, base, hasil] = await Promise.all([
    bacaSheet(sheetId, 'MASTER', accessToken), bacaSheet(sheetId, 'KA HARIAN', accessToken),
    opsional(bacaSheet(sheetId, 'LPC', accessToken)), opsional(bacaSheet(sheetId, 'DKH_ASSIGN', accessToken)),
    bacaSheet(sheetId, 'CONFIG_ROLE', accessToken), bacaLogHarian(accessToken, sheetId, bacaSheet).catch(() => ({})),
    opsional(bacaSheet(sheetId, 'PRODUCTIVITY', accessToken)),
    bacaBaseline(accessToken, sheetId, kunciTanggal(hariIniWIB_()), bacaSheet).catch(() => ({})), bacaHasil(accessToken, sheetId).catch(() => [])
  ]);
  const master = parseSheetValues(mRaw).filter(r => r['NO KONTRAK']);
  const ka = parseSheetValues(kRaw, 15).filter(r => r['NO KONTRAK']);
  const seg = petaKASegmen(kRaw || []);
  master.forEach(r => { const s = String(r['SEGMEN PEKERJAAN'] || '').trim().toUpperCase(); r['SEGMEN PEKERJAAN'] = s || segmenGabung(seg[String(r['NO KONTRAK']).trim()], r['PEKERJAAN KONSUMEN']); });
  const hariIni = hariIniWIB_();
  const config = parseSheetValues(roleRaw);
  let tdHead = null;
  try { tdHead = bangunTdHead({ mRaw, master, ka, lpc, prodRaw, config, base, hasil, hariIni, dkhAssign }); } catch (e) { console.error('Target Daily head gagal:', e.message); }
  res.status(200).json(susunHead({ master, ka, lpc: lpc || [], dkhAssign: dkhAssign || [], logHarian: logHarian || {}, config, hariIni, minggu: INS.getMingguSekarang(), tdHead }));
}

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
    if (req.query && req.query.mode === 'head') { await handleHead(res, accessToken, sheetId); return; }

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
module.exports.__test = { susunHead, bangunTdHead };
