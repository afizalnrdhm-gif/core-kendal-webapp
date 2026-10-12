const test = require('node:test');
const assert = require('node:assert');
const { kandidat, cariCO, usulanTerbaru, statusAssign } = require('../api/_dkh.js');

const m = (no, upd, co, extra) => Object.assign({ 'NO KONTRAK': no, 'NAMA KONSUMEN': 'N' + no, 'CO ALL': co, 'EMAIL CO': co.toLowerCase() + '@x.id', 'BUCKET UPDATE': upd, SIPOK: 100, 'FLEET/NON FLEET': 'NON FLEET' }, extra || {});

test('kandidat FE = BUCKET UPDATE 1-30 milik sendiri, bukan fleet; MR = 31-60', () => {
  const master = [m('1', 'P001_030', 'A'), m('2', 'P031_060', 'A'), m('3', 'P001_030', 'A', { 'FLEET/NON FLEET': 'FLEET' }), m('4', 'P001_030', 'B'), m('5', 'NOOD', 'A')];
  const cfg = [{ NAMA_CO: 'A', ROLE: 'FE' }, { NAMA_CO: 'B', ROLE: 'MR' }];
  const fe = cariCO(master, cfg, 'a@x.id');
  assert.deepStrictEqual(kandidat(fe).map(x => x.noKontrak), ['1']);
  const mr = cariCO(master, cfg, 'b@x.id');
  assert.deepStrictEqual(kandidat(mr).map(x => x.noKontrak), []); // B hanya punya kontrak 1-30, bukan 31-60
  assert.strictEqual(cariCO(master, cfg, 'z@x.id'), null);
});

test('usulan terbaru per CO dan status assign terbaru per kontrak', () => {
  const r = (co, no, batch) => ({ UNTUK_TANGGAL: '2026-10-13', CO: co, EMAIL: 'e', ROLE: 'FE', NO_KONTRAK: no, NAMA: 'n', SIPOK: 10, BUCKET: 'P001_030', BATCH: batch, WAKTU: 'w' });
  const per = usulanTerbaru([r('A', '1', 'b1'), r('A', '2', 'b1'), r('A', '3', 'b2')], '2026-10-13');
  assert.deepStrictEqual(per.A.kontrak.map(x => x.noKontrak), ['3']);
  const a = statusAssign([{ UNTUK_TANGGAL: '2026-10-13', NO_KONTRAK: '3', STATUS: 'ASSIGN', OLEH: 'x' }, { UNTUK_TANGGAL: '2026-10-13', NO_KONTRAK: '3', STATUS: 'BATAL', OLEH: 'x' }], '2026-10-13');
  assert.strictEqual(a['3'].status, 'BATAL');
});

test('rekomendasi: janji dekat tanggal DKH dulu, lalu biasa bayar, lalu SIPOK; yang sudah dipakai dibuang', () => {
  const { rekomendasi } = require('../api/_dkh.js');
  const k = (no, sipok, jh, bh) => ({ noKontrak: no, nama: no, sipok, dpd: 1, jh, bh });
  const r = rekomendasi([k('A', 900, 0, 0), k('B', 100, 14, 0), k('C', 200, 0, 13), k('D', 50, 5, 0), k('E', 999, 0, 0)], new Set(['E']), '2026-10-13');
  assert.deepStrictEqual(r.map(x => x.noKontrak), ['B', 'C', 'D', 'A']);
  assert.match(r[0].alasan, /Janji bayar tgl 14/);
});
