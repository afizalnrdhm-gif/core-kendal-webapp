const test = require('node:test');
const assert = require('node:assert');
const { segmenDari } = require('../api/_segmen');

test('segmenDari: karyawan, wiraswasta, serabutan, dan yang belum terklasifikasi', () => {
  assert.strictEqual(segmenDari('PT KAYU LAPIS INDONESIA'), 'KARYAWAN');
  assert.strictEqual(segmenDari('PT TOKO ABC'), 'KARYAWAN'); // nama perusahaan = tempat bekerja
  assert.strictEqual(segmenDari('GURU HONORER'), 'KARYAWAN');
  assert.strictEqual(segmenDari('BURUH PABRIK'), 'KARYAWAN');
  assert.strictEqual(segmenDari('WIRASWASTA'), 'WIRASWASTA');
  assert.strictEqual(segmenDari('Pedagang sayur'), 'WIRASWASTA');
  assert.strictEqual(segmenDari('PEMILIK PT MAJU'), 'WIRASWASTA');
  assert.strictEqual(segmenDari('BURUH HARIAN LEPAS'), 'SERABUTAN');
  assert.strictEqual(segmenDari('SOPIR TRUK'), 'SERABUTAN');
  assert.strictEqual(segmenDari('PETANI'), 'SERABUTAN');
  assert.strictEqual(segmenDari('IBU RUMAH TANGGA'), '');
  assert.strictEqual(segmenDari(''), '');
  assert.strictEqual(segmenDari('-'), '');
});
