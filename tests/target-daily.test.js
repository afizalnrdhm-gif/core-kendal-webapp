const test = require('node:test');
const assert = require('node:assert');
const { tdHariDariCell, tdSusunKontrak, hitungTargetDaily } = require('../api/insentif.js').__test;

test('hari dari berbagai format tanggal', () => {
  assert.strictEqual(tdHariDariCell(14), 14);
  assert.strictEqual(tdHariDariCell('2026-09-05'), 5);
  assert.strictEqual(tdHariDariCell(46270), new Date(Math.floor(46270 - 25569) * 86400000).getUTCDate());
  assert.strictEqual(tdHariDariCell(''), 0);
  assert.strictEqual(tdHariDariCell('abc'), 0);
});

test('kontrak potensial urut tgl bayar lalu JB, rekomendasi saat kurang', () => {
  const D = 10;
  const rows = [
    { 'NO KONTRAK': 'A', 'NAMA KONSUMEN': 'A', SIPOK: 100, 'TGL BYR': 10, 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030' },
    { 'NO KONTRAK': 'B', 'NAMA KONSUMEN': 'B', SIPOK: 500, 'TGL BYR': 3, 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030' },
    { 'NO KONTRAK': 'C', 'NAMA KONSUMEN': 'C', SIPOK: 50, 'JANJI BAYAR': '10', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030' },
    { 'NO KONTRAK': 'D', 'NAMA KONSUMEN': 'D', SIPOK: 900, 'JANJI BAYAR': '25', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030' },
    { 'NO KONTRAK': 'E', 'NAMA KONSUMEN': 'E', SIPOK: 70, 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030' }
  ];
  const r = tdSusunKontrak(rows, 1000, D, 31);
  assert.deepStrictEqual(r.potensial.map(x => x.noKontrak), ['A', 'C', 'B']); // hari ini dulu (A,C), lalu pola lewat (B)
  assert.strictEqual(r.totalPotensial, 650);
  assert.strictEqual(r.kurang, 350);
  assert.strictEqual(r.tercukupi, false);
  assert.strictEqual(r.rekomendasi[0].noKontrak, 'D'); // sudah janji tgl 25 -> diminta dipercepat
  const ok = tdSusunKontrak(rows, 120, D, 31);
  assert.strictEqual(ok.tercukupi, true);
  assert.strictEqual(ok.jumlahUntukTarget, 2);
});

const mk = (no, co, awal, upd, sipok, fleet) => ({ 'NO KONTRAK': no, 'NAMA KONSUMEN': no, 'CO ALL': co, 'CO FE': co, 'BUCKET AWAL': awal, 'BUCKET UPDATE': upd, SIPOK: sipok, 'FLEET/NON FLEET': fleet || 'NON FLEET' });
const cfgFE = [{ NAMA_CO: 'X', ROLE: 'FE' }];

test('FE punya 4 poin sesuai konfigurasi project 3', () => {
  const t = hitungTargetDaily([mk('1', 'X', 'NOOD', 'NOOD', 100)], {}, cfgFE);
  assert.deepStrictEqual(t.pic[0].poin.map(p => p.kunci), ['balance_nood', 'balance_1_30', 'flow_nood', 'flow_1_30']);
  const mr = hitungTargetDaily([], {}, [{ NAMA_CO: 'M', ROLE: 'MR' }]);
  assert.deepStrictEqual(mr.pic[0].poin.map(p => p.kunci), ['balance_31_60', 'balance_30plus', 'flow_31_60']);
  const bch = hitungTargetDaily([], {}, [{ NAMA_CO: 'B', ROLE: 'BCH' }]);
  assert.deepStrictEqual(bch.pic[0].poin.map(p => p.kunci), ['balance_nood', 'balance_1_30', 'flow_nood', 'flow_1_30', 'flow_31_60']);
});

test('flow NOOD FE: target harian = (belum bayar - 2,7% beban) / sisa hari', () => {
  const master = [mk('1', 'X', 'NOOD', 'P001_030', 600), mk('2', 'X', 'NOOD', 'NOOD', 400)];
  const t = hitungTargetDaily(master, {}, cfgFE);
  const flow = t.pic[0].poin.find(p => p.kunci === 'flow_nood');
  assert.strictEqual(flow.bebanAmt, 1000);
  assert.strictEqual(flow.nilaiAmt, 600);
  assert.ok(Math.abs(flow.bolehAmt - 27) < 1e-9);
  assert.ok(Math.abs(flow.perHari - 573 / t.tanggal.sisaHari) < 1e-9);
});

test('Balance NOOD FE: batas 95% dari beban awal FE sendiri (bukan porsi cabang)', () => {
  const master = [mk('1', 'A', 'NOOD', 'P001_030', 600), mk('2', 'B', 'NOOD', 'P001_030', 200)];
  const ka = { '1': { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 600, 'NAMA COLLECTOR': 'A' },
               '2': { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 200, 'NAMA COLLECTOR': 'B' },
               '3': { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 200, 'NAMA COLLECTOR': 'A' } };
  const cfg = [{ NAMA_CO: 'A', ROLE: 'FE' }, { NAMA_CO: 'B', ROLE: 'FE' }];
  const t = hitungTargetDaily(master, ka, cfg);
  const a = t.pic[0].poin[0];
  assert.strictEqual(a.judul, 'Balance NOOD');
  assert.strictEqual(a.arah, 'naik');
  assert.strictEqual(a.bebanAmt, 600);           // beban awal total milik A
  assert.strictEqual(a.nilaiAmt, 200);           // NOOD milik A (NAMA COLLECTOR)
  assert.ok(Math.abs(a.bolehAmt - 570) < 1e-9);  // 95% x 600
  assert.ok(Math.abs(a.perluAmt - 370) < 1e-9);  // 570 - 200
});

test('Balance 1-30 FE turun ke 8,5% dan Balance cabang NOOD 88% untuk BCH', () => {
  const master = [mk('1', 'A', 'P001_030', 'P001_030', 1000), mk('2', 'A', 'NOOD', 'NOOD', 9000)];
  const ka = { '1': { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 1000, 'NAMA COLLECTOR': 'A' }, '2': { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 9000, 'NAMA COLLECTOR': 'A' } };
  const t = hitungTargetDaily(master, ka, [{ NAMA_CO: 'A', ROLE: 'FE' }, { NAMA_CO: 'B', ROLE: 'BCH' }]);
  const b130 = t.pic[0].poin.find(p => p.kunci === 'balance_1_30');
  assert.ok(Math.abs(b130.bolehAmt - 850) < 1e-9);      // 8,5% x 10000
  assert.ok(Math.abs(b130.perluAmt - 150) < 1e-9);      // 1000 - 850
  const nood = t.pic[1].poin.find(p => p.kunci === 'balance_nood');
  assert.ok(Math.abs(nood.bolehAmt - 8800) < 1e-9);     // 88% x 10000
  assert.strictEqual(nood.perluAmt, 0);                 // NOOD 9000 sudah di atas
});

test('streak tidak target: hitung hari berturut-turut dari yang terbaru', () => {
  const { hitungStreak, kemarin } = require('../api/_tdsnap');
  const h = (tanggal, pic, tuntas) => ({ tanggal, pic, kunci: 'flow', target: 100, tercapai: tuntas ? 100 : 10, persen: tuntas ? 100 : 10, tuntas });
  const r = hitungStreak([h('2026-10-07', 'A', true), h('2026-10-08', 'A', false), h('2026-10-09', 'A', false), h('2026-10-10', 'A', false), h('2026-10-08', 'B', false), h('2026-10-09', 'B', true), h('2026-10-10', 'B', false)]);
  assert.equal(r.daftar.find(x => x.pic === 'A').hari, 3);
  assert.equal(r.daftar.find(x => x.pic === 'B').hari, 1);
  assert.equal(r.riwayatHari, 4);
  assert.deepEqual(kemarin({ tahun: 2026, bulan: 11, hari: 1 }), { tahun: 2026, bulan: 10, hari: 31 });
});

test('baseline tidak dibekukan sebelum jam 09.00 WIB (data pagi belum tentu masuk)', async () => {
  const { pastikanBaseline } = require('../api/_tdsnap');
  const asli = Date.now;
  Date.now = () => Date.UTC(2026, 9, 12, 1, 0, 0); // 08.00 WIB
  try {
    const r = await pastikanBaseline('x', 'y', { tanggal: { tahun: 2026, bulan: 10, hari: 12 }, pic: [] }, {});
    assert.strictEqual(r.tertunda, true);
    assert.deepStrictEqual(r.base, {});
  } finally { Date.now = asli; }
});

test('LPC: bayar angsuran hari ini (tanggal tertukar pun cocok), denda saja tidak dihitung', () => {
  const { bayarLPC } = require('../api/_sheet');
  const serial = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 25569;
  const v = [['NAMA KONSUMEN', 'NO KONTRAK', 'TGL BYR', 'PEMBIAYAAN ANGSURAN', 'PEMBAYARAN DENDA', 'PELUNASAN'],
    ['a', '111', serial(2026, 12, 10), 500, 0, 0],   // 12/10 terbaca 10 Des -> tetap 12 Okt
    ['b', '222', '12/10/2026', 0, 2000, 0],          // denda saja
    ['c', '333', serial(2026, 11, 10), 700, 0, 0],    // 11 Okt (kemarin)
    ['d', '444', serial(2026, 10, 12), 0, 0, 9000]];  // pelunasan
  const m = bayarLPC(v, 12, 10);
  assert.deepStrictEqual(Array.from(m.keys()).sort(), ['111', '444']);
});

test('§7.4 realisasi = perubahan posisi ke arah yang diinginkan (flow turun)', () => {
  const { terapkanProgres } = require('../api/_tdsnap');
  const td = { pic: [{ namaCO: 'A', poin: [{ kunci: 'flow_nood', arah: 'turun', nilaiAmt: 450, semuaKandidat: [['K2', 40, 'Dua']], realisasi: [] }] }] };
  terapkanProgres(td, { 'A|flow_nood': { targetHari: 100, baseNilai: 600, kontrak: [['K1', 150, 'Satu'], ['K2', 40, 'Dua']] } });
  const g = td.pic[0].poin[0].progres;
  assert.strictEqual(g.tercapai, 150);
  assert.strictEqual(g.persen, 150);
  assert.strictEqual(g.tuntas, true);
  assert.strictEqual(g.posisiSekarang, 450);
  assert.strictEqual(g.kontrakBayar[0].noKontrak, 'K1', 'daftar kontrak yang keluar tetap sebagai informasi');
  assert.strictEqual(td.pic[0].poin[0].semuaKandidat, undefined);
});

test('§7.4 posisi memburuk (Balance NOOD turun) = realisasi minus, tidak tuntas', () => {
  const { terapkanProgres } = require('../api/_tdsnap');
  const td = { pic: [{ namaCO: 'A', poin: [{ kunci: 'balance_nood', arah: 'naik', nilaiAmt: 940, semuaKandidat: [] }] }] };
  terapkanProgres(td, { 'A|balance_nood': { targetHari: 50, baseNilai: 1000, kontrak: [] } });
  const g = td.pic[0].poin[0].progres;
  assert.strictEqual(g.tercapai, -60);
  assert.strictEqual(g.tuntas, false);
  assert.strictEqual(g.sisa, 110);
});

test('§7.4 posisi dari nilaiFE bila ada (sama dengan yang dibekukan); tanpa baseline tidak ada progres', () => {
  const { terapkanProgres } = require('../api/_tdsnap');
  const td = { pic: [{ namaCO: 'A', poin: [{ kunci: 'balance_nood', arah: 'naik', nilaiAmt: 5000, nilaiFE: 1100 }, { kunci: 'flow_nood', arah: 'turun', nilaiAmt: 10 }] }] };
  terapkanProgres(td, { 'A|balance_nood': { targetHari: 50, baseNilai: 1000, kontrak: [] } });
  assert.strictEqual(td.pic[0].poin[0].progres.tercapai, 100);
  assert.strictEqual(td.pic[0].poin[1].progres, undefined);
});

test('statusStreak: 0 aman, 1-2 waspada, 3+ merah', () => {
  const { statusStreak } = require('../api/_tdsnap');
  assert.deepStrictEqual([0, 1, 2, 3, 7].map(statusStreak), ['AMAN', 'WASPADA', 'WASPADA', 'MERAH', 'MERAH']);
});

test('hasil harian mencatat nilai terbaru walau realisasi turun (posisi bisa memburuk)', async () => {
  const { catatHasilHariIni } = require('../api/_tdsnap');
  const lama = global.fetch, kirim = [];
  global.fetch = async (url, init) => { if (init && init.body && String(url).includes(':append')) kirim.push(JSON.parse(init.body).values); return { ok: true, status: 200, json: async () => ({}) }; };
  try {
    const td = { tanggal: { tahun: 2026, bulan: 10, hari: 21 }, pic: [{ namaCO: 'A', poin: [{ kunci: 'flow_nood', progres: { targetHari: 100, tercapai: 80, persen: 80, tuntas: false } }] }] };
    const n = await catatHasilHariIni('t', 's', td, [{ tanggal: '2026-10-21', pic: 'A', kunci: 'flow_nood', tercapai: 150 }]);
    assert.strictEqual(n, 1);
    assert.strictEqual(kirim[0][0][4], 80);
    const sama = await catatHasilHariIni('t', 's', td, [{ tanggal: '2026-10-21', pic: 'A', kunci: 'flow_nood', tercapai: 80 }]);
    assert.strictEqual(sama, 0, 'nilai sama tidak ditulis ulang');
  } finally { global.fetch = lama; }
});
