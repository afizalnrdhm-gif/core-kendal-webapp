const test = require('node:test'); const assert = require('node:assert');
const { susunHead } = require('../api/dashboard').__test;

const k = (no, nbq, upd, extra) => Object.assign({ 'NO KONTRAK': no, 'NAMA KONSUMEN': 'N' + no, 'CO ALL': 'FE A', 'BUCKET AWAL': 'NOOD', 'BUCKET UPDATE': upd, SIPOK: 100,
  'STATUS NBQ': nbq, 'FLEET/NON FLEET': 'NON FLEET', 'GROUP PRODUCT': 'MOBILKU', 'SEGMEN PEKERJAAN': 'KARYAWAN', 'STATUS BAYAR': 'BELUM BAYAR', 'JATUH TEMPO': '', 'JANJI BAYAR': '' }, extra || {});
const master = [k('1', 'APPEAL', 'P001_030', { 'JATUH TEMPO': 5 }), k('2', 'APPEAL', 'P031_060', { 'JATUH TEMPO': 10, 'JANJI BAYAR': '21/10/2026' }), k('3', 'APPEAL', 'NOOD', { 'JATUH TEMPO': 25 }),
  k('4', 'NORMAL', 'NOOD'), k('5', 'NORMAL', 'NOOD'), k('6', '', 'P001_030')];
const ka = master.map((m, i) => ({ 'NO KONTRAK': m['NO KONTRAK'], 'BUCKET UPDATE': m['BUCKET UPDATE'], 'SISA PIUTANG': 100, 'FLEET/NON FLEET': 'NON FLEET', 'NAMA COLLECTOR': 'FE A', 'TGL BYR M1': i < 3 ? String(3 + i * 7).padStart(2, '0') + '/09/2026' : '' }));
const lpc = [['NO KONTRAK', 'TGL BYR', 'PEMBIAYAAN ANGSURAN', 'PELUNASAN'], ['4', '02/10/2026', 500, 0], ['5', '16/10/2026', 500, 0]];
const dkhAssign = [['UNTUK_TANGGAL', 'CO', 'ROLE', 'NO_KONTRAK', 'NAMA', 'SIPOK', 'STATUS', 'OLEH', 'WAKTU'], ['2026-10-06', 'FE A', 'FE', '1', 'N1', 100, 'DIBUAT', 'e', 'w']];
const config = [{ ROLE: 'FE', NAMA_CO: 'FE A', BUCKET_PENYELESAIAN: 'NOOD' }];
const dasar = { master, ka, lpc, dkhAssign, config, hariIni: { tahun: 2026, bulan: 10, hari: 21 }, minggu: 3 };

test('susunHead: diagnosa NOOD menguraikan status approval', () => {
  const h = susunHead(Object.assign({ logHarian: {} }, dasar));
  assert.strictEqual(h.tanggal, '2026-10-21');
  assert.strictEqual(h.diagnosa.nood.urai.statusNbq[0].nilai, 'APPEAL');
  assert.deepStrictEqual(h.diagnosa.nood.mingguan.ini, [16.67, 16.67, 33.33, null]);
  assert.deepStrictEqual(h.diagnosa.nood.mingguan.lalu, [16.67, 33.33, 50, 50]);
  assert.ok(h.diagnosa.nood.kalimat.length >= 2);
  assert.strictEqual(h.kartu.length, 6);
});

test('susunHead: perbandingan dengan snapshot kemarin', () => {
  const h = susunHead(Object.assign({ logHarian: { '2026-10-20': { CABANG: { 'FLOW NOOD': { amt: 100, pct: 46 } } } } }, dasar));
  assert.strictEqual(h.riwayatCukup, true);
  const f = h.kartu.find(x => x.kunci === 'flowNood');
  assert.strictEqual(f.pct, 50);
  assert.strictEqual(f.arah, 'memburuk');
  const b = h.berubah.find(x => x.kunci === 'flowNood');
  assert.strictEqual(b.selisih, 4);
});

test('susunHead: tanpa riwayat, berubah kosong dan arah null', () => {
  const h = susunHead(Object.assign({ logHarian: {} }, dasar));
  assert.strictEqual(h.riwayatCukup, false);
  assert.deepStrictEqual(h.berubah, []);
  h.kartu.forEach(x => assert.strictEqual(x.arah, null));
});

test('susunHead: kerja dan tim', () => {
  const h = susunHead(Object.assign({ logHarian: {} }, dasar));
  assert.strictEqual(h.kerja.jatuhTempoBelumDkh, 1, 'kontrak 2: jatuh tempo tgl 10, belum DKH; kontrak 1 sudah DKH; kontrak 3 belum jatuh tempo');
  assert.strictEqual(h.kerja.janjiHariIni, 1);
  assert.strictEqual(h.tim[0].co, 'FE A');
  assert.strictEqual(h.tim[0].penyelesaianPct, 50);
  assert.strictEqual(h.tim[0].targetPct, 75);
  assert.strictEqual(h.tim[0].janjiHariIni, 1);
});

test('susunHead: snapshot bulan lalu tidak dipakai sebagai pembanding "kemarin"', () => {
  const h = susunHead(Object.assign({}, dasar, { logHarian: { '2026-09-30': { CABANG: { 'FLOW NOOD': { amt: 1, pct: 5 } } } } }));
  assert.strictEqual(h.riwayatCukup, false);
  assert.deepStrictEqual(h.berubah, []);
});

test('susunHead: minggu yang belum terjadi bernilai null di garis bulan ini', () => {
  const h = susunHead(Object.assign({ logHarian: {} }, dasar, { minggu: 2 }));
  assert.deepStrictEqual(h.diagnosa.nood.mingguan.ini, [16.67, 16.67, null, null]);
  assert.strictEqual(h.diagnosa.nood.segmen.ini.KARYAWAN[2], null);
  assert.strictEqual(h.diagnosa.nood.mingguan.lalu[3], 50, 'bulan lalu tetap lengkap');
});

test('susunHead: tanggal 1 sisa hari 0 dan penyebab membawa dimensi', () => {
  const h1 = susunHead(Object.assign({ logHarian: {} }, dasar, { hariIni: { tahun: 2026, bulan: 11, hari: 1 }, minggu: 4 }));
  assert.strictEqual(h1.minggu.sisaHari, 0);
  const h = susunHead(Object.assign({ logHarian: {} }, dasar));
  assert.ok(h.penyebab.length > 0);
  assert.strictEqual(typeof h.penyebab[0].dim, 'string');
  assert.ok(Object.keys(h.diagnosa[h.penyebab[0].angka].urai).includes(h.penyebab[0].dim));
});

test('susunHead: menyertakan targetDaily dan tindakan bila tdHead diberikan', () => {
  const tdHead = { adaBaseline: true, pic: [{ co: 'FE A', poin: [{ judul: 'Flow NOOD', target: 500, realisasi: 100, kurangRp: 400, status: 'MERAH', belumKontrak: ['2'] }] }], kalimat: [], total: {}, belum: {}, teratas: [], tren: {} };
  const h = susunHead(Object.assign({ logHarian: {}, tdHead }, dasar));
  assert.strictEqual(h.targetDaily, tdHead);
  assert.strictEqual(h.tindakan[0].dampakRp, 400);
  const tanpa = susunHead(Object.assign({ logHarian: {} }, dasar));
  assert.strictEqual(tanpa.targetDaily, null);
});
