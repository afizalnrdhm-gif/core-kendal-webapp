// Tes otomatis logika CMS & pembersih sel Sheet. Jalankan: npm test
// Data di sini sintetis (bukan data konsumen asli).
const test = require('node:test');
const assert = require('node:assert');
const { compute } = require('../api/cms.js');
const { normBucket, cleanCell } = require('../api/_sheet.js');

test('normBucket menyeragamkan penulisan bucket', () => {
  assert.strictEqual(normBucket('NO OD'), 'NOOD');
  assert.strictEqual(normBucket(' nood '), 'NOOD');
  assert.strictEqual(normBucket('P001-030'), 'P001_030');
  assert.strictEqual(normBucket('P031_060'), 'P031_060');
  assert.strictEqual(normBucket('NA'), 'NA');
});

test('cleanCell: trim, #N/A jadi kosong, angka tidak diubah', () => {
  assert.strictEqual(cleanCell('NAMA', '  Budi '), 'Budi');
  assert.strictEqual(cleanCell('NBQ', '#N/A'), '');
  assert.strictEqual(cleanCell('BUCKET EVER', ' NOOD '), 'NOOD');
  assert.strictEqual(cleanCell('DPD', 12), 12);
});

const MASTER = [
  ['NO KONTRAK', 'NAMA KONSUMEN', 'BUCKET AWAL', 'DPD', 'CO FE'],
  ['K1', 'A', 'NOOD', 5, 'CO1'],      // NOOD -> 1-30, task FE  -> terbentuk
  ['K2', 'B', 'NOOD', 10, 'CO1'],     // NOOD -> 1-30, tanpa task -> tidak terbentuk, fresh flow
  ['K3', 'C', 'P001_030', 20, 'CO2'], // 1-30 -> 1-30, tanpa task -> stay
  ['K4', 'D', 'P031_060', 40, 'CO2'], // 31-60, task MR -> terbentuk balance 31-60
  ['K5', 'E', 'NO OD', 0, 'CO1']      // tidak masuk balance
];
// Excel serial: 46300 = 2026-10-03
const PROD = [
  ['Agreement No', 'Status Task', 'JATUH TEMPO', 'TANGGAL TAGIHAN', 'RISK CODE', 'ACTION CODE'],
  ['K1', 'RELEASED', 46295, 46300, 'B | Bayar sebagian', 'JB | Janji bayar'],
  ['K1', 'RELEASED', 46295, 46290, 'C', 'KPR'],                    // baris lama, diabaikan
  ['K4', 'RELEASED', 46260, 46300, 'D', 'TKK']
];
const CFG = [{ ROLE: 'FE', NAMA_CO: 'CO1' }, { ROLE: 'FE', NAMA_CO: 'CO2' }, { ROLE: 'MR', NAMA_CO: 'MR1' }];

test('CMS: actual, terbentuk, fresh flow, stay, dikerjakan', () => {
  const out = compute(MASTER, PROD, CFG);
  const n = t => out.items.filter(i => i.t.includes(t)).length;
  assert.strictEqual(n('b1|*|actual'), 3);
  assert.strictEqual(n('b1|*|terbentuk'), 1);
  assert.strictEqual(n('b1|*|flow'), 1);
  assert.strictEqual(n('b1|*|stay'), 1);
  assert.strictEqual(n('b1|*|ttl'), 2);
  assert.strictEqual(n('b1|*|dikerjakan'), 1);
  assert.strictEqual(n('b1|*|rcB'), 1);       // pakai baris tagihan terbaru (B, bukan C)
  assert.strictEqual(n('b1|*|bertemu'), 1);
  assert.strictEqual(n('b2|*|actual'), 1);
  assert.strictEqual(n('b2|*|terbentuk'), 1);
  assert.strictEqual(n('b2|*|tidakbertemu'), 1);
  assert.deepStrictEqual(out.urutan.fe, ['CO1', 'CO2']);
});
