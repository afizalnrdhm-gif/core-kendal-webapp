const test = require('node:test'); const assert = require('node:assert');
const { infoKontrak } = require('../api/_dkh');

test('infoKontrak: gabung status assign dan hasil inputan PRODUCTIVITY', async () => {
  const prod = [['x'], ['Agreement No', 'Send Date', 'TANGGAL TAGIHAN', 'ACTION CODE', 'RISK CODE', 'TANGGAL JANJI BAYAR', 'TOTAL BAYAR', 'MEMO'],
    ['1063120240504571', '2026-10-14 18:01:00', 46309, 'JB | JANJI BAYAR', 'D | X', '2026-10-19 00:00:00', '', '19-TRANSFER'], ['999', 'a', 1, '', '', '', '', '']];
  const asg = [['UNTUK_TANGGAL', 'CO', 'ROLE', 'NO_KONTRAK', 'NAMA', 'SIPOK', 'STATUS', 'OLEH', 'WAKTU'],
    ['2026-10-13', 'A', 'FE', '1063120240504571', 'N', 1, 'ASSIGN', 'e', 'w'], ['2026-10-14', 'A', 'FE', '1063120240504571', 'N', 1, 'DIBUAT', 'e', 'w']];
  const lama = global.fetch;
  global.fetch = async u => ({ ok: true, json: async () => ({ values: decodeURIComponent(u).includes('PRODUCTIVITY') ? prod : asg }) });
  try {
    const r = await infoKontrak('t', 's', '1063120240504571');
    assert.strictEqual(r.assign.length, 2);
    assert.strictEqual(r.assign[1].status, 'DIBUAT');
    assert.strictEqual(r.prod.baris.length, 1);
    assert.strictEqual(r.prod.baris[0].janji, '2026-10-19');
    assert.strictEqual(r.prod.baris[0].action, 'JB | JANJI BAYAR');
    const kosong = await infoKontrak('t', 's', 'tidak-ada');
    assert.deepStrictEqual([kosong.assign.length, kosong.prod.baris.length], [0, 0]);
  } finally { global.fetch = lama; }
});
