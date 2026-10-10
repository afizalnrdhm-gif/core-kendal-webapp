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

test('flow: target harian = (belum bayar - batas) / sisa hari', () => {
  const master = [
    { 'NO KONTRAK': '1', 'CO ALL': 'X', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 600, 'FLEET/NON FLEET': 'NON FLEET' },
    { 'NO KONTRAK': '2', 'CO ALL': 'X', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'NOOD', SIPOK: 400, 'FLEET/NON FLEET': 'NON FLEET' }
  ];
  const cfg = [{ NAMA_CO: 'X', ROLE: 'FE', BUCKET_PENYELESAIAN: 'P001_030', BUCKET_ASAL_FLOW: 'NOOD', BUCKET_BALANCE: 'P001_030' }];
  const t = hitungTargetDaily(master, {}, cfg);
  const flow = t.pic[0].poin.find(p => p.kunci === 'flow');
  assert.strictEqual(flow.bebanAmt, 1000);
  assert.strictEqual(flow.nilaiAmt, 600);
  assert.strictEqual(flow.bolehAmt, 20); // 2% FE
  assert.ok(Math.abs(flow.perHari - 580 / t.tanggal.sisaHari) < 1e-9);
});

test('FE balance NOOD: target 88% cabang dibagi sesuai beban awal FE', () => {
  const master = [
    { 'NO KONTRAK': '1', 'CO ALL': 'A', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 600, 'FLEET/NON FLEET': 'NON FLEET' },
    { 'NO KONTRAK': '2', 'CO ALL': 'B', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 200, 'FLEET/NON FLEET': 'NON FLEET' }
  ];
  const ka = { '1': { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 600, 'NAMA COLLECTOR': 'A', 'FLEET/NON FLEET': 'NON FLEET' },
               '2': { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 200, 'NAMA COLLECTOR': 'B', 'FLEET/NON FLEET': 'NON FLEET' },
               '3': { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 200, 'NAMA COLLECTOR': 'A', 'FLEET/NON FLEET': 'NON FLEET' } };
  const cfg = [{ NAMA_CO: 'A', ROLE: 'FE', BUCKET_PENYELESAIAN: 'P001_030', BUCKET_ASAL_FLOW: 'NOOD', BUCKET_BALANCE: 'P001_030' },
               { NAMA_CO: 'B', ROLE: 'FE', BUCKET_PENYELESAIAN: 'P001_030', BUCKET_ASAL_FLOW: 'NOOD', BUCKET_BALANCE: 'P001_030' }];
  const t = hitungTargetDaily(master, ka, cfg);
  const a = t.pic[0].poin[0], b = t.pic[1].poin[0];
  assert.strictEqual(a.judul, 'Balance NOOD');
  // total AR 1000, NOOD 200 -> perlu 880-200 = 680; A beban 600 (75%), B 200 (25%)
  assert.ok(Math.abs(a.perluAmt - 510) < 1e-9);
  assert.ok(Math.abs(b.perluAmt - 170) < 1e-9);
});

test('progres target harian: dihitung dari kontrak baseline yang sudah tidak belum-bayar', () => {
  const { terapkanProgres } = require('../api/_tdsnap');
  const td = { pic: [{ namaCO: 'A', poin: [{ kunci: 'flow', perHari: 100, semuaKandidat: [['K2', 40, 'Dua'], ['K3', 30, 'Tiga']] }] }] };
  const base = { 'A|flow': { targetHari: 100, baseNilai: 170, kontrak: [['K1', 60, 'Satu'], ['K2', 40, 'Dua'], ['K3', 30, 'Tiga']] } };
  terapkanProgres(td, base);
  const q = td.pic[0].poin[0];
  assert.equal(q.progres.tercapai, 60);
  assert.equal(q.progres.persen, 60);
  assert.equal(q.progres.sisa, 40);
  assert.equal(q.progres.tuntas, false);
  assert.equal(q.progres.kontrakBayar[0].noKontrak, 'K1');
  assert.equal(q.semuaKandidat, undefined);
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

test('Flow: masih BUCKET UPDATE 1-30 = belum realisasi; kembali NOOD = realisasi (progres dari baseline)', () => {
  const { terapkanProgres } = require('../api/_tdsnap');
  const mk = (no, upd) => ({ 'NO KONTRAK': no, 'NAMA KONSUMEN': no, 'CO ALL': 'FE1', 'FLEET/NON FLEET': 'NON FLEET', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': upd, SIPOK: 100 });
  const ka = (no, upd) => ({ 'NO KONTRAK': no, 'BUCKET UPDATE': upd, 'SISA PIUTANG': 100, 'NAMA COLLECTOR': 'FE1' });
  const cfg = [{ NAMA_CO: 'FE1', ROLE: 'FE', BUCKET_PENYELESAIAN: 'P001_030', BUCKET_ASAL_FLOW: 'NOOD', BUCKET_BALANCE: 'P001_030' }];
  // pagi: A, B, C masih 1-30. Siang: A dan B sudah kembali NOOD, C masih 1-30
  const td = hitungTargetDaily([mk('A', 'NOOD'), mk('B', 'NOOD'), mk('C', 'P001_030')], { A: ka('A', 'NOOD'), B: ka('B', 'NOOD'), C: ka('C', 'P001_030') }, cfg);
  const base = { 'FE1|flow': { targetHari: 200, baseNilai: 300, kontrak: [['A', 100, 'A'], ['B', 100, 'B'], ['C', 100, 'C']] } };
  terapkanProgres(td, base);
  const flow = td.pic[0].poin[1];
  assert.equal(flow.progres.tercapai, 200);
  assert.equal(flow.progres.jumlahBayar, 2);
  assert.equal(flow.progres.tuntas, true);
});

test('Balance NOOD FE: tercapai = kenaikan NOOD milik FE dari baseline (KA HARIAN, BUCKET UPDATE NOOD)', () => {
  const { terapkanProgres } = require('../api/_tdsnap');
  const mk = no => ({ 'NO KONTRAK': no, 'NAMA KONSUMEN': no, 'CO ALL': 'FE1', 'FLEET/NON FLEET': 'NON FLEET', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'NOOD', SIPOK: 100 });
  const ka = (no, upd, sisa) => ({ 'NO KONTRAK': no, 'BUCKET UPDATE': upd, 'SISA PIUTANG': sisa, 'NAMA COLLECTOR': 'FE1' });
  const cfg = [{ NAMA_CO: 'FE1', ROLE: 'FE', BUCKET_PENYELESAIAN: 'P001_030', BUCKET_ASAL_FLOW: 'NOOD', BUCKET_BALANCE: 'P001_030' }];
  const td = hitungTargetDaily([mk('A'), mk('B')], { A: ka('A', 'NOOD', 100), B: ka('B', 'NOOD', 150) }, cfg);
  assert.equal(td.pic[0].poin[0].nilaiFE, 250);
  const base = { 'FE1|balance': { targetHari: 500, baseNilai: 100, kontrak: [] }, 'FE1|flow': { targetHari: 0, baseNilai: 0, kontrak: [] } };
  terapkanProgres(td, base);
  assert.equal(td.pic[0].poin[0].progres.tercapai, 150);
  assert.equal(td.pic[0].poin[0].progres.persen, 30);
  assert.equal(td.pic[0].poin[0].nilaiFE, undefined);
});
