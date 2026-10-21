// Mesin diagnosis untuk tampilan head: menguraikan angka yang ditanyakan atasan menjadi penyumbang per dimensi.
// Fungsi murni (tanpa akses Sheet). Rumus mengikuti spec docs/superpowers/specs/2026-10-21-tampilan-head-design.md §4.4.
const { bucketIndex, sipokOf, isFleet } = require('./_kpi');

const ANGKA = {
  nood: { judul: 'Balance/Flow NOOD', awal: 'NOOD' },
  f130: { judul: 'Flow 1-30', awal: 'P001_030' },
  f3160: { judul: 'Flow 31-60', awal: 'P031_060' },
  btc130: { judul: 'BTC 1-30', awal: 'P001_030' },
  btc3160: { judul: 'BTC 31-60', awal: 'P031_060' },
  nbq: { judul: 'NBQ', awal: null }
};

const teks = v => String(v == null ? '' : v).trim();
const flowRow = r => { const a = bucketIndex(r['BUCKET AWAL']); return a > -1 && bucketIndex(r['BUCKET UPDATE']) > a; };
const statusNbq = r => { const s = teks(r['STATUS NBQ']).toUpperCase(); return !s || s === '#N/A' ? 'NON NBQ' : s; };

function populasi(rows, angka, opsi) {
  const def = ANGKA[angka]; if (!def) throw new Error('Angka tidak dikenal: ' + angka);
  const fleet = !!(opsi && opsi.fleet);
  let isi = (rows || []).filter(r => fleet || !isFleet(r));
  if (angka === 'nbq') isi = isi.filter(r => statusNbq(r) !== 'NON NBQ' && bucketIndex(r['BUCKET AWAL']) > -1);
  else isi = isi.filter(r => teks(r['BUCKET AWAL']) === def.awal);
  const masalah = angka.startsWith('btc') ? (r => teks(r['BUCKET UPDATE']) !== 'NOOD') : flowRow;
  return { rows: isi, masalah };
}

// Hari (1-31) dari serial Excel, "dd/mm/yyyy", "yyyy-mm-dd", atau angka hari 1-31.
function hariDari(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (v >= 1 && v <= 31 && Number.isInteger(v)) return v;
    if (v > 20000) return new Date(Math.round((v - 25569) * 86400000)).getUTCDate();
    return null;
  }
  const s = teks(v);
  if (/^\d{1,2}$/.test(s)) { const n = Number(s); return n >= 1 && n <= 31 ? n : null; }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return Number(m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (m) return Number(m[1]);
  return null;
}

const mobKelompok = v => {
  const m = teks(v).match(/(\d+)/); if (!m) return '-';
  const n = Number(m[1]);
  return n <= 3 ? '1-3' : n <= 6 ? '4-6' : n <= 12 ? '7-12' : '13+';
};
const minggu = h => h == null ? '-' : h <= 7 ? 'W1' : h <= 14 ? 'W2' : h <= 21 ? 'W3' : 'W4';

const DIMENSI = {
  co: { judul: 'CO', nilai: r => teks(r['CO ALL']) || '-' },
  groupProduct: { judul: 'Group product', nilai: r => teks(r['GROUP PRODUCT']).toUpperCase() || '-' },
  typeBarang: { judul: 'Type barang', nilai: r => teks(r['TYPE BARANG']).toUpperCase() || '-' },
  statusNbq: { judul: 'Status approval', nilai: statusNbq },
  segmen: { judul: 'Segmen pekerjaan', nilai: r => teks(r['SEGMEN PEKERJAAN']).toUpperCase() || 'TIDAK DIKETAHUI' },
  mob: { judul: 'MOB', nilai: r => mobKelompok(r['NBQ']) },
  jatuhTempo: { judul: 'Jatuh tempo', nilai: r => minggu(hariDari(r['JATUH TEMPO'])) },
  janjiBayar: { judul: 'Janji bayar', nilai: r => teks(r['JANJI BAYAR']) ? 'ADA JANJI' : 'TANPA JANJI' },
  statusDkh: { judul: 'Status DKH', nilai: (r, ktx) => (ktx && ktx.dkh && ktx.dkh.has(teks(r['NO KONTRAK']))) ? 'ADA DKH' : 'BELUM DKH' },
  kontrakBesar: { judul: 'Nominal', nilai: r => sipokOf(r) >= 100000000 ? '≥100 JT' : '<100 JT' },
  fleet: { judul: 'Fleet', nilai: r => isFleet(r) ? 'FLEET' : 'NON FLEET' }
};

const bagi = (a, b) => b > 0 ? a / b : 0;

function ringkas(rows, masalah) {
  let beban = 0, mas = 0;
  rows.forEach(r => { const s = sipokOf(r); beban += s; if (masalah(r)) mas += s; });
  const rate = bagi(mas, beban) * 100;
  return { kontrak: rows.length, beban, masalah: mas, ratePct: rate, penyelesaianPct: 100 - rate };
}

function kolom_(nilai, g, tot) {
  const rate = bagi(g.masalah, g.beban) * 100;
  const porsiBeban = bagi(g.beban, tot.beban) * 100;
  const porsiMasalah = bagi(g.masalah, tot.masalah) * 100;
  const indeks = porsiBeban > 0 ? porsiMasalah / porsiBeban : 0;
  const rataRata = bagi(tot.masalah, tot.beban);
  const pengaruh = bagi(g.masalah - g.beban * rataRata, tot.beban) * 100;
  const pemberat = (indeks >= 1.15 && pengaruh >= 1) || porsiMasalah >= 30;
  return { nilai, kontrak: g.kontrak, beban: g.beban, masalah: g.masalah, rate, porsiBeban, porsiMasalah, indeks, pengaruh, pemberat };
}
function kelompok_(rows, masalah, kunciFn) {
  const tot = { beban: 0, masalah: 0 }, g = new Map();
  rows.forEach(r => {
    const s = sipokOf(r), m = masalah(r), key = kunciFn(r);
    tot.beban += s; if (m) tot.masalah += s;
    if (key == null) return;
    const x = g.get(key) || { kontrak: 0, beban: 0, masalah: 0 };
    x.kontrak += 1; x.beban += s; if (m) x.masalah += s;
    g.set(key, x);
  });
  return { tot, g };
}
const urut_ = (a, b) => (b.pengaruh - a.pengaruh) || (b.masalah - a.masalah);

function urai(rows, masalah, nilaiFn, konteks) {
  const { tot, g } = kelompok_(rows, masalah, r => nilaiFn(r, konteks));
  return [...g.entries()].map(([n, x]) => kolom_(n, x, tot)).sort(urut_);
}

function irisan(rows, masalah, nilaiA, nilaiB, minKontrak, konteks) {
  const min = minKontrak == null ? 3 : minKontrak;
  const { tot, g } = kelompok_(rows, masalah, r => nilaiA(r, konteks) + ' × ' + nilaiB(r, konteks));
  return [...g.entries()].filter(([, x]) => x.kontrak >= min).map(([n, x]) => kolom_(n, x, tot)).sort(urut_).slice(0, 10);
}

function kontrakTeratas(rows, masalah, n) {
  return rows.filter(masalah).sort((a, b) => sipokOf(b) - sipokOf(a)).slice(0, n == null ? 20 : n).map(r => ({
    noKontrak: teks(r['NO KONTRAK']), nama: teks(r['NAMA KONSUMEN']), co: teks(r['CO ALL']), sipok: sipokOf(r),
    bucketAwal: teks(r['BUCKET AWAL']), bucketUpdate: teks(r['BUCKET UPDATE']), statusNbq: statusNbq(r), groupProduct: teks(r['GROUP PRODUCT'])
  }));
}

// Dimensi waktu menggambarkan kapan kontrak jatuh tempo/janji, bukan penyebab: tampil di tabel, tidak dijadikan kalimat penyebab.
const DIMENSI_WAKTU = new Set(['jatuhTempo', 'janjiBayar']);
const BATAS_MINGGU = [7, 14, 21, 31];
const SEGMEN = ['KARYAWAN', 'WIRASWASTA', 'SERABUTAN'];
const r2 = v => Math.round(v * 100) / 100;

// Persen SIPOK populasi yang sudah bayar sampai akhir W1..W4 (kumulatif). hariBayarFn(row) -> 1..31 atau null.
function mingguan(rows, hariBayarFn) {
  let beban = 0; const bayar = [0, 0, 0, 0];
  rows.forEach(r => {
    const s = sipokOf(r); beban += s;
    const h = hariBayarFn(r); if (h == null) return;
    BATAS_MINGGU.forEach((b, i) => { if (h <= b) bayar[i] += s; });
  });
  return bayar.map(x => r2(bagi(x, beban) * 100));
}
function mingguanPerSegmen(rows, hariBayarFn) {
  const out = {};
  SEGMEN.forEach(sg => { out[sg] = mingguan(rows.filter(r => teks(r['SEGMEN PEKERJAAN']).toUpperCase() === sg), hariBayarFn); });
  return out;
}

const fmt2 = v => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
const juta = v => 'Rp ' + (Math.round((Number(v) || 0) / 1e6) || 0).toLocaleString('id-ID') + ' jt';

// 2-4 kalimat jawaban dari ringkasan dan tabel penguraian per dimensi.
function kalimat(judul, rk, uraiPerDimensi) {
  const out = [`${judul}: penyelesaian ${fmt2(rk.penyelesaianPct)}% (${juta(rk.masalah)} bermasalah dari beban ${juta(rk.beban)}).`];
  const calon = [];
  Object.keys(uraiPerDimensi || {}).filter(dim => !DIMENSI_WAKTU.has(dim)).forEach(dim => (uraiPerDimensi[dim] || []).forEach(u => { if (u.pemberat && u.pengaruh > 0) calon.push({ dim, u }); }));
  calon.sort((a, b) => b.u.pengaruh - a.u.pengaruh);
  const dipakai = [];
  for (const c of calon) {
    if (dipakai.length >= 2) break;
    if (dipakai.some(d => d.dim === c.dim)) continue;
    dipakai.push(c);
  }
  dipakai.forEach((c, i) => {
    const dj = (DIMENSI[c.dim] && DIMENSI[c.dim].judul) || c.dim, u = c.u;
    out.push(`${i === 0 ? 'Pemberat terbesar' : 'Pemberat berikutnya'}: ${dj} ${u.nilai} — ${fmt2(u.porsiBeban)}% beban tapi ${fmt2(u.porsiMasalah)}% masalah (rate ${fmt2(u.rate)}% vs rata-rata ${fmt2(rk.ratePct)}%). Seandainya setara rata-rata, penyelesaian naik ${fmt2(u.pengaruh)} poin.`);
  });
  if (!dipakai.length) out.push('Tidak ada kelompok yang menyimpang jauh dari rata-rata.');
  return out;
}

// Maksimal 5 tindakan hari ini dari kekurangan Target Daily per PIC/poin dan dari penyebab diagnosa, urut dampak rupiah.
const COCOK_TERATAS = { co: 'co', statusNbq: 'statusNbq', groupProduct: 'groupProduct' };
function tindakan(penyebab, tdHead, diagnosa) {
  const out = [];
  if (tdHead && tdHead.adaBaseline) (tdHead.pic || []).forEach(p => (p.poin || []).forEach(q => {
    if (!(q.kurangRp > 0)) return;
    out.push({ judul: `Kejar target ${q.judul} ${p.co}`, temuan: `Realisasi ${juta(q.realisasi)} dari target ${juta(q.target)} hari ini.`,
      alasan: `Kurang ${juta(q.kurangRp)}${q.status && q.status !== 'AMAN' ? '; status ' + q.status.toLowerCase() + ' (' + q.streakHari + ' hari meleset)' : ''}.`,
      kontrak: (q.belumKontrak || []).slice(0, 5), pic: p.co, dampakRp: q.kurangRp });
  }));
  (penyebab || []).forEach(p => {
    const g = diagnosa && diagnosa[p.angka]; if (!g || !p.dim || !g.urai || !g.urai[p.dim]) return;
    const u = g.urai[p.dim].filter(x => x.pemberat).sort((a, b) => b.pengaruh - a.pengaruh)[0]; if (!u) return;
    const f = COCOK_TERATAS[p.dim];
    const kontrak = (g.teratas || []).filter(t => !f || String(t[f]) === String(u.nilai)).slice(0, 5).map(t => t.noKontrak);
    const dj = (DIMENSI[p.dim] && DIMENSI[p.dim].judul) || p.dim;
    out.push({ judul: `Tangani ${dj} ${u.nilai} di ${g.judul}`, temuan: p.kalimat, alasan: `Pengaruh ${fmt2(u.pengaruh)} poin penyelesaian.`,
      kontrak, pic: p.dim === 'co' ? u.nilai : '-', dampakRp: Math.round(u.pengaruh * ((g.ringkas && g.ringkas.beban) || 0) / 100) });
  });
  return out.sort((a, b) => b.dampakRp - a.dampakRp).slice(0, 5);
}

module.exports = { tindakan, ANGKA, DIMENSI, DIMENSI_WAKTU, SEGMEN, populasi, ringkas, urai, irisan, kontrakTeratas, hariDari, mingguan, mingguanPerSegmen, kalimat };
