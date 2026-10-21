// Mesin diagnosis untuk tampilan head: menguraikan angka yang ditanyakan atasan menjadi penyumbang per dimensi.
// Fungsi murni (tanpa akses Sheet). Rumus mengikuti spec docs/superpowers/specs/2026-10-21-tampilan-head-design.md §4.4.
const { bucketIndex, sipokOf } = require('./_kpi');

const ANGKA = {
  nood: { judul: 'Balance/Flow NOOD', awal: 'NOOD' },
  f130: { judul: 'Flow 1-30', awal: 'P001_030' },
  f3160: { judul: 'Flow 31-60', awal: 'P031_060' },
  btc130: { judul: 'BTC 1-30', awal: 'P001_030' },
  btc3160: { judul: 'BTC 31-60', awal: 'P031_060' },
  nbq: { judul: 'NBQ', awal: null }
};

const teks = v => String(v == null ? '' : v).trim();
const isFleet = r => teks(r['FLEET/NON FLEET']).toUpperCase() === 'FLEET';
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

module.exports = { ANGKA, DIMENSI, populasi, ringkas, urai, irisan, kontrakTeratas, hariDari };
