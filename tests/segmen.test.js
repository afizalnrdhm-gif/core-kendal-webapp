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

test('segmenGabung: pakai KATEGORI PEKERJAAN & NAMA PEKERJAAN dari KA HARIAN', () => {
  const { segmenGabung, petaKA } = require('../api/_segmen');
  assert.strictEqual(segmenGabung({ np: 'PEDAGANG SEMBAKO/BUAH/SAYUR', kat: 'PEMILIK', tk: 'JUAL SEMBAKO DAN GAS' }, ''), 'WIRASWASTA');
  assert.strictEqual(segmenGabung({ np: 'PEMOTONGAN AYAM', kat: 'PEMILIK', tk: '' }, ''), 'WIRASWASTA');
  assert.strictEqual(segmenGabung({ np: 'CLEANING SERVICE / OFFICE BOY', kat: 'STAFF', tk: 'PT BORINE' }, ''), 'KARYAWAN');
  assert.strictEqual(segmenGabung({ np: 'BURUH PABRIK', kat: 'STAFF', tk: 'PABRIK KAYULAPIS' }, ''), 'KARYAWAN');
  assert.strictEqual(segmenGabung({ np: 'LAINNYA', kat: 'STAFF', tk: 'TUKANG BANGUNAN' }, ''), 'SERABUTAN');
  assert.strictEqual(segmenGabung({ np: 'PETANI', kat: 'PEMILIK', tk: '' }, ''), 'SERABUTAN');
  assert.strictEqual(segmenGabung({ np: 'PENJAGA WARUNG / KIOS', kat: 'STAFF', tk: '' }, ''), 'KARYAWAN');
  assert.strictEqual(segmenGabung(undefined, 'SDN 1 SUMBEREJO'), 'KARYAWAN');
  assert.strictEqual(segmenGabung(undefined, ''), '');
  const v = Array.from({ length: 15 }, () => []).concat([['NO KONTRAK', 'NAMA TEMPAT KERJA KONSUMEN', 'KATEGORI PEKERJAAN', 'SEGMEN USAHA', 'NAMA PEKERJAAN KONSUMEN'], ['111', 'TOKO A', 'PEMILIK', 'PERDAGANGAN', 'PEDAGANG']]);
  assert.deepStrictEqual(petaKA(v)['111'], { np: 'PEDAGANG', kat: 'PEMILIK', tk: 'TOKO A' });
});
