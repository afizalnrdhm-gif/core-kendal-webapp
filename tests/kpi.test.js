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

test('isFleet seragam: " Fleet " dianggap fleet', () => {
  const { isFleet } = require('../api/_kpi');
  assert.strictEqual(isFleet({ 'FLEET/NON FLEET': ' Fleet ' }), true);
  const k = hitungKpi([], [{ 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 500, 'FLEET/NON FLEET': ' Fleet ' }, { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 100, 'FLEET/NON FLEET': 'NON FLEET' }], false);
  assert.strictEqual(k.enr, 100);
});
