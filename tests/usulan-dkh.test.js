const test = require('node:test');
const assert = require('node:assert');
const { kandidat, cariCO, usulanTerbaru, statusAssign } = require('../api/_dkh.js');

const m = (no, upd, co, extra) => Object.assign({ 'NO KONTRAK': no, 'NAMA KONSUMEN': 'N' + no, 'CO ALL': co, 'EMAIL CO': co.toLowerCase() + '@x.id', 'BUCKET UPDATE': upd, SIPOK: 100, 'FLEET/NON FLEET': 'NON FLEET', 'JATUH TEMPO': '2020-01-01' }, extra || {});

test('kandidat FE = BUCKET AWAL NOOD & DPD 1-30 milik sendiri; MR = BUCKET AWAL 1-30 & DPD 31-60 se-cabang', () => {
  const k = (no, awal, co, extra) => m(no, 'X', co, Object.assign({ 'BUCKET AWAL': awal, DPD: 5 }, extra || {}));
  const master = [
    k('1', 'NOOD', 'A'), k('2', 'NOOD', 'A', { DPD: 0 }), k('3', 'NOOD', 'A', { 'FLEET/NON FLEET': 'FLEET' }),
    k('4', 'NOOD', 'B'), k('5', 'P001_030', 'A', { DPD: 40 }), k('6', 'P001_030', 'A', { DPD: 20 }),
    k('7', 'NOOD', 'A', { 'JATUH TEMPO': '2999-01-01', DPD: 0 }), k('8', 'P001_030', 'C', { DPD: 31 }),
    k('9', 'NOOD', 'A', { DPD: 45 }), // FE: DPD udah lewat 30 -> gak nyangkut lagi ke FE
    k('10', 'P001_030', 'A', { DPD: 75 }) // MR: DPD udah lewat 60 -> gak nyangkut lagi ke MR
  ];
  const cfg = [{ NAMA_CO: 'A', ROLE: 'FE' }, { NAMA_CO: 'B', ROLE: 'MR' }];
  const fe = cariCO(master, cfg, 'a@x.id');
  assert.deepStrictEqual(kandidat(fe).map(x => x.noKontrak), ['1']); // 2 & 7 DPD 0, 3 fleet, 9 DPD>30
  const mr = cariCO(master, cfg, 'b@x.id');
  assert.deepStrictEqual(kandidat(mr).map(x => x.noKontrak).sort(), ['5', '8']); // DPD 31-60 saja, milik FE mana pun; 10 DPD>60 dibuang
  assert.strictEqual(cariCO(master, cfg, 'z@x.id'), null);
});

test('kandidat juga memuat kontrak BELUM EVER (FE: awal 1-30, MR: awal 31-60), bukan yang sudah ever', () => {
  const k = (no, awal, co, ever, extra) => m(no, 'X', co, Object.assign({ 'BUCKET AWAL': awal, DPD: 5, 'FLOW EVER': ever }, extra || {}));
  const master = [
    k('1', 'P001_030', 'A', 'P001_030'), k('2', 'P001_030', 'A', 'P031_060'), k('3', 'P001_030', 'A', ''),
    k('4', 'P031_060', 'B', 'P031_060'), k('5', 'P031_060', 'B', 'P061_090'), k('6', 'P001_030', 'A', 'P001_030', { 'FLEET/NON FLEET': 'FLEET' })
  ];
  const cfg = [{ NAMA_CO: 'A', ROLE: 'FE' }, { NAMA_CO: 'B', ROLE: 'MR' }];
  assert.deepStrictEqual(kandidat(cariCO(master, cfg, 'a@x.id')).map(x => x.noKontrak), ['1']);
  assert.deepStrictEqual(kandidat(cariCO(master, cfg, 'b@x.id')).map(x => x.noKontrak).sort(), ['4']);
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

test('sudah bayar 1x / stay: JATUH TEMPO bergeser ke depan tapi DPD > 0 -> tetap jadi kandidat', () => {
  const r = m('9', 'P001_030', 'A', { 'BUCKET AWAL': 'P001_030', 'FLOW EVER': 'P001_030', DPD: 12, 'JATUH TEMPO': '2999-01-01' });
  assert.deepStrictEqual(kandidat({ role: 'FE', kontrak: [r] }).map(x => x.noKontrak), ['9']);
});

test('kandidat MR juga memuat kontrak bucket awal 1-30 yang STAY atau SUDAH BAYAR meski DPD < 31, dengan tag', () => {
  const k = (no, extra) => m(no, 'X', 'B', Object.assign({ 'BUCKET AWAL': 'P001_030', DPD: 5 }, extra || {}));
  const master = [
    k('1', { 'KRITERIA ACCT': 'STAY' }), // DPD rendah tapi STAY -> tetap kandidat, tag STAY
    k('2', { 'STATUS BAYAR': 'SUDAH BAYAR' }), // DPD rendah tapi sudah bayar -> tetap kandidat, tag Sudah bayar
    k('3', { 'KRITERIA ACCT': 'FLOW' }), // DPD rendah, bukan STAY/sudah bayar -> tidak ikut (DPD < 31)
    k('4', { 'KRITERIA ACCT': 'STAY', 'FLEET/NON FLEET': 'FLEET' }), // STAY tapi fleet -> tetap dibuang
    k('5', { DPD: 35 }) // DPD >= 31 (jalur normal MR) -> tetap kandidat, tanpa tag
  ];
  const cfg = [{ NAMA_CO: 'B', ROLE: 'MR' }];
  const mr = cariCO(master, cfg, 'b@x.id');
  const hasil = kandidat(mr);
  assert.deepStrictEqual(hasil.map(x => x.noKontrak).sort(), ['1', '2', '5']);
  assert.strictEqual(hasil.find(x => x.noKontrak === '1').tag, 'STAY');
  assert.strictEqual(hasil.find(x => x.noKontrak === '2').tag, 'Sudah bayar');
  assert.strictEqual(hasil.find(x => x.noKontrak === '5').tag, '');
});

test('tag STAY/sudah bayar cuma berlaku buat role MR, bukan FE', () => {
  const r = m('1', 'X', 'A', { 'BUCKET AWAL': 'P001_030', DPD: 5, 'KRITERIA ACCT': 'STAY' });
  // FE awal-nya NOOD, jadi kontrak BUCKET AWAL 1-30 ini bukan kandidat FE sama sekali, STAY atau bukan.
  assert.deepStrictEqual(kandidat({ role: 'FE', kontrak: [r] }).map(x => x.noKontrak), []);
});

test('kaliDKH: jumlah terbentuk dari Map PRODUCTIVITY; null kalau tab tidak terbaca; Set lama tetap jalan', () => {
  const { kaliDKH } = require('../api/_dkh');
  assert.strictEqual(kaliDKH(new Map([['1', 3]]), '1'), 3);
  assert.strictEqual(kaliDKH(new Map([['1', 3]]), '2'), 0);
  assert.strictEqual(kaliDKH(null, '1'), null);
  assert.strictEqual(kaliDKH(new Set(['1']), '1'), 1);
});
