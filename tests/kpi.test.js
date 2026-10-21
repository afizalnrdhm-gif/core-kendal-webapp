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

test('isFleet seragam: " Fleet " dianggap fleet', () => {
  const { isFleet } = require('../api/_kpi');
  assert.strictEqual(isFleet({ 'FLEET/NON FLEET': ' Fleet ' }), true);
  const k = hitungKpi([], [{ 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 500, 'FLEET/NON FLEET': ' Fleet ' }, { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 100, 'FLEET/NON FLEET': 'NON FLEET' }], false);
  assert.strictEqual(k.enr, 100);
});
