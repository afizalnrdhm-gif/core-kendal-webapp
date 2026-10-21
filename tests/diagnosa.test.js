const test = require('node:test'); const assert = require('node:assert');
const D = require('../api/_diagnosa');

const k = (no, nbq, upd, extra) => Object.assign({ 'NO KONTRAK': no, 'NAMA KONSUMEN': 'N' + no, 'CO ALL': 'FE A', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': upd, SIPOK: 100, 'STATUS NBQ': nbq, 'FLEET/NON FLEET': 'NON FLEET', 'GROUP PRODUCT': 'MOBILKU' }, extra || {});
const enam = [k('1', 'APPEAL', 'P001_030'), k('2', 'APPEAL', 'P031_060'), k('3', 'APPEAL', 'NOOD'), k('4', 'NORMAL', 'NOOD'), k('5', 'NORMAL', 'NOOD'), k('6', '', 'P001_030')];
const dekat = (a, b) => Math.abs(a - b) < 0.01;

test('populasi nood: bucket awal NOOD, masalah = flow, fleet dibuang', () => {
  const p = D.populasi(enam.concat([k('9', 'APPEAL', 'P001_030', { 'FLEET/NON FLEET': 'FLEET' }), k('8', '', 'NOOD', { 'BUCKET AWAL': 'P001_030' })]), 'nood', { fleet: false });
  assert.strictEqual(p.rows.length, 6);
  assert.strictEqual(p.rows.filter(p.masalah).length, 3);
});

test('populasi btc130: masalah = belum kembali ke NOOD; nbq: hanya kontrak NBQ', () => {
  const rows = [k('1', '', 'NOOD', { 'BUCKET AWAL': 'P001_030' }), k('2', '', 'P001_030', { 'BUCKET AWAL': 'P001_030' })];
  const p = D.populasi(rows, 'btc130', { fleet: false });
  assert.deepStrictEqual(p.rows.map(p.masalah), [false, true]);
  assert.strictEqual(D.populasi(enam, 'nbq', { fleet: false }).rows.length, 5);
});

test('ringkas: beban, masalah, rate dan penyelesaian', () => {
  const p = D.populasi(enam, 'nood', { fleet: false });
  assert.deepStrictEqual(D.ringkas(p.rows, p.masalah), { kontrak: 6, beban: 600, masalah: 300, ratePct: 50, penyelesaianPct: 50 });
});

test('urai per STATUS NBQ: rumus porsi, indeks, pengaruh dan pemberat', () => {
  const p = D.populasi(enam, 'nood', { fleet: false });
  const u = D.urai(p.rows, p.masalah, D.DIMENSI.statusNbq.nilai);
  const a = u[0];
  assert.strictEqual(a.nilai, 'APPEAL');
  assert.strictEqual(a.kontrak, 3);
  assert.ok(dekat(a.rate, 66.67) && dekat(a.porsiMasalah, 66.67) && dekat(a.porsiBeban, 50));
  assert.ok(dekat(a.indeks, 1.333) && dekat(a.pengaruh, 8.33));
  assert.strictEqual(a.pemberat, true);
  const n = u.find(x => x.nilai === 'NORMAL');
  assert.ok(dekat(n.pengaruh, -16.67));
  assert.strictEqual(n.pemberat, false);
  const non = u.find(x => x.nilai === 'NON NBQ');
  assert.strictEqual(non.pemberat, true, 'porsi masalah 33% >= 30%');
});

test('urai: grup beban 0 tidak menghasilkan NaN/Infinity', () => {
  const rows = enam.concat([k('7', 'AUTO APPROVAL', 'P001_030', { SIPOK: '' })]);
  const p = D.populasi(rows, 'nood', { fleet: false });
  const u = D.urai(p.rows, p.masalah, D.DIMENSI.statusNbq.nilai);
  const z = u.find(x => x.nilai === 'AUTO APPROVAL');
  assert.strictEqual(z.rate, 0); assert.strictEqual(z.indeks, 0);
  u.forEach(x => ['beban', 'masalah', 'rate', 'porsiBeban', 'porsiMasalah', 'indeks', 'pengaruh'].forEach(c => assert.ok(Number.isFinite(x[c]), x.nilai + ' ' + c)));
});

test('irisan: hanya kombinasi dengan minimal 3 kontrak', () => {
  const p = D.populasi(enam, 'nood', { fleet: false });
  const ir = D.irisan(p.rows, p.masalah, D.DIMENSI.groupProduct.nilai, D.DIMENSI.statusNbq.nilai, 3);
  assert.deepStrictEqual(ir.map(x => x.nilai), ['MOBILKU × APPEAL']);
});

test('kontrakTeratas: hanya yang bermasalah, SIPOK terbesar dulu', () => {
  const rows = [k('1', 'APPEAL', 'P001_030', { SIPOK: 50 }), k('2', 'APPEAL', 'P001_030', { SIPOK: 300 }), k('3', 'APPEAL', 'NOOD', { SIPOK: 900 })];
  const p = D.populasi(rows, 'nood', { fleet: false });
  const t = D.kontrakTeratas(p.rows, p.masalah, 20);
  assert.deepStrictEqual(t.map(x => x.noKontrak), ['2', '1']);
  assert.strictEqual(t[0].bucketUpdate, 'P001_030');
});

test('DIMENSI: mob, kontrak besar, janji, status DKH', () => {
  assert.strictEqual(D.DIMENSI.mob.nilai({ NBQ: '4 MOB' }), '4-6');
  assert.strictEqual(D.DIMENSI.mob.nilai({ NBQ: '13 MOB' }), '13+');
  assert.strictEqual(D.DIMENSI.mob.nilai({ NBQ: '' }), '-');
  assert.strictEqual(D.DIMENSI.kontrakBesar.nilai({ SIPOK: 100000000 }), '≥100 JT');
  assert.strictEqual(D.DIMENSI.janjiBayar.nilai({ 'JANJI BAYAR': '' }), 'TANPA JANJI');
  assert.strictEqual(D.DIMENSI.statusDkh.nilai({ 'NO KONTRAK': '5' }, { dkh: new Set(['5']) }), 'ADA DKH');
  assert.strictEqual(D.DIMENSI.statusDkh.nilai({ 'NO KONTRAK': '6' }, { dkh: new Set(['5']) }), 'BELUM DKH');
});
