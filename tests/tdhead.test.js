const test = require('node:test'); const assert = require('node:assert');
const { susunTargetDailyHead } = require('../api/_tdhead');

const hariIni = { tahun: 2026, bulan: 10, hari: 21 };
function fixture(opsi) {
  opsi = opsi || {};
  const td = { pic: [{ namaCO: 'X', role: 'FE', poin: [{ kunci: 'flow_nood', judul: 'Flow NOOD', arah: 'turun',
    progres: { targetHari: 100, tercapai: 40, persen: 40, tuntas: false }, belum: [['A', 200, 'nA'], ['B', 100, 'nB']] }] }] };
  const base = opsi.tanpaBase ? {} : { 'X|flow_nood': { targetHari: 100, baseNilai: 500, kontrak: [['A', 200, 'nA'], ['B', 100, 'nB'], ['C', 50, 'nC']] } };
  if (opsi.tanpaBase) delete td.pic[0].poin[0].progres;
  const hasil = ['2026-10-18', '2026-10-19', '2026-10-20'].map(t => ({ tanggal: t, pic: 'X', kunci: 'flow_nood', target: 100, tercapai: 10, persen: 10, tuntas: false }));
  const cmsItems = [{ k: 'A', t: ['b1|X|terbentuk', 'b1|*|terbentuk'], ac: '' }];
  const master = [{ 'NO KONTRAK': 'A', 'JANJI BAYAR': '21/10/2026', 'SEGMEN PEKERJAAN': 'KARYAWAN', 'JATUH TEMPO': 5, 'CO ALL': 'X' },
    { 'NO KONTRAK': 'B', 'JANJI BAYAR': '', 'SEGMEN PEKERJAAN': 'SERABUTAN', 'JATUH TEMPO': 18, 'CO ALL': 'X' }];
  return { td, base, hasil, cmsItems, master, hariIni };
}

test('ringkasan total dan per poin dengan status dari streak', () => {
  const r = susunTargetDailyHead(fixture());
  assert.strictEqual(r.adaBaseline, true);
  assert.strictEqual(r.total.capaianPct, 40);
  const q = r.pic[0].poin[0];
  assert.deepStrictEqual([q.target, q.realisasi, q.kurangRp, q.status, q.streakHari], [100, 40, 60, 'MERAH', 3]);
  assert.deepStrictEqual(q.belumKontrak, ['A', 'B']);
  assert.ok(r.kalimat[0].includes('(40,00%)'), r.kalimat[0]);
  assert.ok(r.kalimat.some(k => k.includes('merah')), r.kalimat.join(' | '));
});

test('penguraian kontrak belum bayar: status kerja, janji, hasil kunjungan', () => {
  const r = susunTargetDailyHead(fixture());
  assert.strictEqual(r.belum.kontrak, 2);
  assert.strictEqual(r.belum.sipok, 300);
  const sk = r.belum.urai.statusKerja;
  assert.deepStrictEqual(sk.find(x => x.nilai === 'DKH, BELUM DIKERJAKAN'), { nilai: 'DKH, BELUM DIKERJAKAN', kontrak: 1, sipok: 200, porsiPct: 66.67 });
  assert.strictEqual(sk.find(x => x.nilai === 'TIDAK ADA DATA').sipok, 100);
  const j = r.belum.urai.janji.map(x => x.nilai).sort();
  assert.deepStrictEqual(j, ['JANJI HARI INI', 'TANPA JANJI']);
  assert.strictEqual(r.belum.urai.hasil.find(x => x.nilai === 'BELUM ADA HASIL').kontrak, 2);
  assert.strictEqual(r.teratas[0].noKontrak, 'A');
  assert.strictEqual(r.teratas[0].statusKerja, 'DKH, BELUM DIKERJAKAN');
});

test('kontrak di luar baseline pagi tidak ikut; tren dari hasil harian', () => {
  const f = fixture(); f.td.pic[0].poin[0].belum.push(['Z', 999, 'baru siang']);
  const r = susunTargetDailyHead(f);
  assert.strictEqual(r.belum.kontrak, 2);
  assert.deepStrictEqual(r.tren.X.map(x => x.tanggal), ['2026-10-18', '2026-10-19', '2026-10-20']);
  assert.strictEqual(r.tren.X[0].persen, 10);
});

test('hasil kunjungan dari action code dan tanpa baseline aman', () => {
  const f = fixture(); f.cmsItems = [{ k: 'A', t: ['b1|X|terbentuk', 'b1|X|dikerjakan'], ac: 'KTD | KONSUMEN TIDAK DITEMPAT' }, { k: 'B', t: [], ac: 'JB | JANJI BAYAR' }];
  const r = susunTargetDailyHead(f);
  assert.strictEqual(r.belum.urai.hasil.find(x => x.nilai === 'TIDAK BERTEMU: KTD').kontrak, 1);
  assert.strictEqual(r.belum.urai.hasil.find(x => x.nilai === 'BERTEMU: JB').kontrak, 1);
  assert.strictEqual(r.belum.urai.statusKerja.find(x => x.nilai === 'SUDAH DIKUNJUNGI').kontrak, 1);
  assert.strictEqual(r.belum.urai.statusKerja.find(x => x.nilai === 'BELUM DKH').kontrak, 1);
  const kosong = susunTargetDailyHead(fixture({ tanpaBase: true }));
  assert.strictEqual(kosong.adaBaseline, false);
  assert.strictEqual(kosong.belum.kontrak, 0);
  assert.ok(Number.isFinite(kosong.total.capaianPct));
});
