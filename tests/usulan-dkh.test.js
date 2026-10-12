const test = require('node:test');
const assert = require('node:assert');
const { kandidat, cariCO, usulanTerbaru, statusAssign } = require('../api/_dkh.js');

const m = (no, upd, co, extra) => Object.assign({ 'NO KONTRAK': no, 'NAMA KONSUMEN': 'N' + no, 'CO ALL': co, 'EMAIL CO': co.toLowerCase() + '@x.id', 'BUCKET UPDATE': upd, SIPOK: 100, 'FLEET/NON FLEET': 'NON FLEET', 'JATUH TEMPO': '2020-01-01' }, extra || {});

test('kandidat FE = BUCKET UPDATE 1-30 milik sendiri, bukan fleet; MR = 31-60', () => {
  const master = [m('1', 'P001_030', 'A'), m('2', 'P031_060', 'A'), m('3', 'P001_030', 'A', { 'FLEET/NON FLEET': 'FLEET' }), m('4', 'P001_030', 'B'), m('5', 'NOOD', 'A'), m('6', 'P001_030', 'A', { 'JATUH TEMPO': '2999-01-01' }), m('7', 'P001_030', 'A', { 'JATUH TEMPO': '', DPD: 4 })];
  const cfg = [{ NAMA_CO: 'A', ROLE: 'FE' }, { NAMA_CO: 'B', ROLE: 'MR' }];
  const fe = cariCO(master, cfg, 'a@x.id');
  assert.deepStrictEqual(kandidat(fe).map(x => x.noKontrak).sort(), ['1', '7']); // 6 belum jatuh tempo -> tidak tampil; 7 tanpa tanggal tapi DPD>0 -> tampil
  const mr = cariCO(master, cfg, 'b@x.id');
  assert.deepStrictEqual(kandidat(mr).map(x => x.noKontrak), ['2']); // MR memegang 31-60 se-cabang (kontrak '2' milik FE A), bukan hanya miliknya
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

test('rekomendasi: jatuh tempo & belum pernah terbentuk DKH diutamakan (paling lama jatuh tempo dulu)', () => {
  const { rekomendasi } = require('../api/_dkh.js');
  const hariIni = Date.parse(new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10) + 'T00:00:00Z');
  const d = n => hariIni - n * 86400000;
  const k = (no, sipok, jt, jh) => ({ noKontrak: no, nama: no, sipok, dpd: 1, jt, jh: jh || 0, bh: 0 });
  const pernah = new Set(['P']); // P sudah pernah terbentuk
  const r = rekomendasi([k('P', 900, d(5)), k('A', 100, d(3)), k('B', 50, d(9)), k('C', 999, d(-2)), k('D', 800, d(4), 14)], new Set(), '2026-10-13', pernah);
  assert.deepStrictEqual(r.slice(0, 3).map(x => x.noKontrak), ['B', 'D', 'A']);
  assert.match(r[0].alasan, /belum pernah terbentuk DKH/);
  // D punya janji dekat tapi sudah jatuh tempo & belum terbentuk, jadi tetap grup utama; tanpa data PRODUCTIVITY aturan ini dilewati
  const tanpa = rekomendasi([k('A', 100, d(3)), k('C', 999, d(3))], new Set(), '2026-10-13', null);
  assert.strictEqual(tanpa[0].noKontrak, 'C');
});
