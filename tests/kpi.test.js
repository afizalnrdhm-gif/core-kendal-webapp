const test = require('node:test'); const assert = require('node:assert');
const { hitungKpi, bucketIndex, sipokOf } = require('../api/_kpi');

const ka = [
  { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 600, 'FLEET/NON FLEET': 'NON FLEET' },
  { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 300, 'FLEET/NON FLEET': 'NON FLEET' },
  { 'BUCKET UPDATE': 'P031_060', 'SISA PIUTANG': 100, 'FLEET/NON FLEET': 'NON FLEET' },
  { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 1000, 'FLEET/NON FLEET': 'FLEET' }
];
const m = (u, s) => ({ 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': u, SIPOK: s, 'FLEET/NON FLEET': 'NON FLEET' });
const master = [m('NOOD', 100), m('NOOD', 100), m('P001_030', 100), m('P031_060', 100), m('NOOD', '1,5')];

test('hitungKpi: balance per bucket dan kumulatif dari KA HARIAN, fleet dibuang', () => {
  const k = hitungKpi([], ka, false);
  assert.strictEqual(k.enr, 1000);
  assert.strictEqual(k.perBucket[0].kunci, 'NOOD');
  assert.strictEqual(k.perBucket[0].pct, 60);
  assert.strictEqual(k.cumulative.find(c => c.label === '30+ (Delq)').amount, 100);
  assert.strictEqual(hitungKpi([], ka, true).enr, 2000);
});

test('hitungKpi: Flow NOOD hanya pindah tepat ke 1-30, SIPOK teks dianggap 0', () => {
  const f = hitungKpi(master, [], false).flowBtc.find(x => x.label === 'Flow NOOD');
  assert.strictEqual(f.amount, 100);
  assert.strictEqual(f.pct, 25);
});

test('helper bucketIndex dan sipokOf', () => {
  assert.strictEqual(bucketIndex(' P031_060 '), 2);
  assert.strictEqual(bucketIndex('X'), -1);
  assert.strictEqual(sipokOf({ SIPOK: '1,5' }), 0);
});

test('hitungKpi: flowByTipe pecah Flow NOOD per TYPE BARANG, urut amount terbesar', () => {
  const masterTipe = [
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 300, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'motor' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 100, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'Motor' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 150, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'mobil' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 200, 'FLEET/NON FLEET': 'FLEET', 'TYPE BARANG': 'mobil' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'NOOD', SIPOK: 999, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'mobil' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 50, 'FLEET/NON FLEET': 'NON FLEET' }
  ];
  const fb = hitungKpi(masterTipe, [], false).flowByTipe['Flow NOOD'];
  assert.strictEqual(fb.totalAsal, 1599); // semua SIPOK bucket awal NOOD non-fleet (300+100+150+999+50), basis sama seperti flowBtc
  assert.strictEqual(fb.flowAmount, 600); // 300+100+150+50, yang sudah pindah ke 1-30
  assert.strictEqual(fb.flowCount, 4);
  assert.strictEqual(fb.flowPct, 600 / 1599 * 100); // harus sama persis dengan pct di flowBtc['Flow NOOD']
  assert.strictEqual(fb.flowPct, hitungKpi(masterTipe, [], false).flowBtc.find(x => x.label === 'Flow NOOD').pct);
  // pct per tipe = kontribusinya ke flowPct (basis totalAsal), BUKAN porsi di antara yang sudah flow —
  // supaya jumlah pct semua baris = flowPct, persis angka yang tampil di kartu KPI.
  assert.deepStrictEqual(fb.rows[0], { label: 'MOTOR', amount: 400, count: 2, pct: 400 / 1599 * 100 });
  assert.deepStrictEqual(fb.rows[1], { label: 'MOBIL', amount: 150, count: 1, pct: 150 / 1599 * 100 });
  assert.deepStrictEqual(fb.rows[2], { label: '(Tidak diketahui)', amount: 50, count: 1, pct: 50 / 1599 * 100 });
  const sumPct = fb.rows.reduce((s, r) => s + r.pct, 0);
  assert.ok(Math.abs(sumPct - fb.flowPct) < 1e-9);
  const fbFleet = hitungKpi(masterTipe, [], true).flowByTipe['Flow NOOD'];
  assert.strictEqual(fbFleet.totalAsal, 1799); // +200 (mobil fleet)
  assert.strictEqual(fbFleet.flowAmount, 800); // termasuk fleet (mobil +200)
});

test('hitungKpi: flowByNbq pecah Flow NOOD per status kolom "NBQ / NON NBQ" di MASTER, urut amount terbesar', () => {
  const masterNbq = [
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 300, 'FLEET/NON FLEET': 'NON FLEET', 'NBQ / NON NBQ': 'NBQ' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 100, 'FLEET/NON FLEET': 'NON FLEET', 'NBQ / NON NBQ': 'nbq' }, // lowercase tetap kehitung
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 150, 'FLEET/NON FLEET': 'NON FLEET', 'NBQ / NON NBQ': 'NON NBQ' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 200, 'FLEET/NON FLEET': 'FLEET', 'NBQ / NON NBQ': 'NON NBQ' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'NOOD', SIPOK: 999, 'FLEET/NON FLEET': 'NON FLEET', 'NBQ / NON NBQ': 'NBQ' },
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 50, 'FLEET/NON FLEET': 'NON FLEET' } // kolom kosong -> belum diisi
  ];
  const fb = hitungKpi(masterNbq, [], false).flowByNbq['Flow NOOD'];
  assert.strictEqual(fb.totalAsal, 1599); // semua SIPOK bucket awal NOOD non-fleet (300+100+150+999+50)
  assert.strictEqual(fb.flowAmount, 600); // 300+100+150+50, yang sudah pindah ke 1-30
  assert.strictEqual(fb.flowCount, 4);
  assert.strictEqual(fb.flowPct, hitungKpi(masterNbq, [], false).flowBtc.find(x => x.label === 'Flow NOOD').pct);
  // NBQ (300+100=400 Angsuran Awal); NON NBQ (150 Lawas, non-fleet); kolom kosong = 50 belum diisi.
  assert.deepStrictEqual(fb.rows[0], { label: 'Angsuran Awal / NBQ', amount: 400, count: 2, pct: 400 / 1599 * 100 });
  assert.deepStrictEqual(fb.rows[1], { label: 'Kontrak Lawas (Non NBQ)', amount: 150, count: 1, pct: 150 / 1599 * 100 });
  assert.deepStrictEqual(fb.rows[2], { label: '(Status NBQ belum diisi)', amount: 50, count: 1, pct: 50 / 1599 * 100 });
  const sumPct = fb.rows.reduce((s, r) => s + r.pct, 0);
  assert.ok(Math.abs(sumPct - fb.flowPct) < 1e-9);
  const fbFleet = hitungKpi(masterNbq, [], true).flowByNbq['Flow NOOD'];
  assert.strictEqual(fbFleet.totalAsal, 1799); // +200 (fleet, NON NBQ)
  assert.strictEqual(fbFleet.flowAmount, 800); // termasuk fleet (+200, masuk kelompok Non NBQ)
  assert.strictEqual(fbFleet.rows.find(r => r.label === 'Kontrak Lawas (Non NBQ)').amount, 350); // 150 + 200
});

test('hitungKpi: flowByTipeNbq silang Tipe Barang x status "NBQ / NON NBQ" per Flow NOOD, sub-baris NBQ jumlahnya pas ke pct Tipe Barang-nya', () => {
  const masterCross = [
    // MOBIL, NBQ
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 200, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'mobil', 'NBQ / NON NBQ': 'NBQ' },
    // MOBIL, Non NBQ/Lawas
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 150, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'mobil', 'NBQ / NON NBQ': 'NON NBQ' },
    // MOBIL, kolom belum diisi
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 50, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'mobil' },
    // MOTOR, NBQ
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 300, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'motor', 'NBQ / NON NBQ': 'NBQ' },
    // MOTOR, Non NBQ (fleet, dibuang kalau includeFleet=false)
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'P001_030', SIPOK: 999, 'FLEET/NON FLEET': 'FLEET', 'TYPE BARANG': 'motor', 'NBQ / NON NBQ': 'NON NBQ' },
    // tidak flow (tetap di NOOD), ikut basis totalAsal
    { 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': 'NOOD', SIPOK: 300, 'FLEET/NON FLEET': 'NON FLEET', 'TYPE BARANG': 'mobil', 'NBQ / NON NBQ': 'NBQ' }
  ];
  const fb = hitungKpi(masterCross, [], false).flowByTipeNbq['Flow NOOD'];
  assert.strictEqual(fb.totalAsal, 1000); // semua SIPOK bucket awal NOOD non-fleet: 200+150+50+300+300
  assert.strictEqual(fb.flowAmount, 700); // 200+150+50+300, yang sudah pindah ke 1-30 (non-fleet)
  assert.strictEqual(fb.flowCount, 4);
  assert.strictEqual(fb.flowPct, hitungKpi(masterCross, [], false).flowBtc.find(x => x.label === 'Flow NOOD').pct);

  const mobil = fb.rows.find(r => r.label === 'MOBIL');
  assert.strictEqual(mobil.amount, 400); // 200+150+50
  assert.strictEqual(mobil.pct, 400 / 1000 * 100);
  const mobilSumPct = mobil.nbqRows.reduce((s, r) => s + r.pct, 0);
  assert.ok(Math.abs(mobilSumPct - mobil.pct) < 1e-9); // sub-baris NBQ mobil jumlahnya pas ke pct MOBIL
  assert.deepStrictEqual(mobil.nbqRows.find(r => r.label === 'Angsuran Awal / NBQ'), { label: 'Angsuran Awal / NBQ', amount: 200, count: 1, pct: 200 / 1000 * 100 });
  assert.deepStrictEqual(mobil.nbqRows.find(r => r.label === 'Kontrak Lawas (Non NBQ)'), { label: 'Kontrak Lawas (Non NBQ)', amount: 150, count: 1, pct: 150 / 1000 * 100 });
  assert.deepStrictEqual(mobil.nbqRows.find(r => r.label === '(Status NBQ belum diisi)'), { label: '(Status NBQ belum diisi)', amount: 50, count: 1, pct: 50 / 1000 * 100 });

  const motor = fb.rows.find(r => r.label === 'MOTOR');
  assert.strictEqual(motor.amount, 300); // fleet (999) dibuang
  assert.strictEqual(motor.nbqRows.length, 1);
  assert.deepStrictEqual(motor.nbqRows[0], { label: 'Angsuran Awal / NBQ', amount: 300, count: 1, pct: 300 / 1000 * 100 });

  const sumAllPct = fb.rows.reduce((s, r) => s + r.pct, 0);
  assert.ok(Math.abs(sumAllPct - fb.flowPct) < 1e-9); // total Tipe Barang = flowPct, persis angka Flow di kartu KPI

  const fbFleet = hitungKpi(masterCross, [], true).flowByTipeNbq['Flow NOOD'];
  assert.strictEqual(fbFleet.totalAsal, 1999); // +999 (motor fleet)
  const motorFleet = fbFleet.rows.find(r => r.label === 'MOTOR');
  assert.strictEqual(motorFleet.amount, 1299); // 300 + 999
  assert.strictEqual(motorFleet.nbqRows.find(r => r.label === 'Kontrak Lawas (Non NBQ)').amount, 999);
});

test('isFleet seragam: " Fleet " dianggap fleet', () => {
  const { isFleet } = require('../api/_kpi');
  assert.strictEqual(isFleet({ 'FLEET/NON FLEET': ' Fleet ' }), true);
  const k = hitungKpi([], [{ 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 500, 'FLEET/NON FLEET': ' Fleet ' }, { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 100, 'FLEET/NON FLEET': 'NON FLEET' }], false);
  assert.strictEqual(k.enr, 100);
});
