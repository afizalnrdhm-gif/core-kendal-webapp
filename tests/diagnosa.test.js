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

const { tanggalBayarLPC } = require('../api/_sheet');

test('hariDari: serial Excel, dd/mm/yyyy, yyyy-mm-dd, teks lain null', () => {
  assert.strictEqual(D.hariDari(46316), new Date((46316 - 25569) * 864e5).getUTCDate());
  assert.strictEqual(D.hariDari('19/09/2026'), 19);
  assert.strictEqual(D.hariDari('2026-09-19'), 19);
  assert.strictEqual(D.hariDari('abc'), null);
});

test('mingguan: persen SIPOK yang sudah bayar kumulatif W1-W4', () => {
  const rows = [3, 10, 25, null].map((h, i) => ({ SIPOK: 100, H: h, 'SEGMEN PEKERJAAN': i < 2 ? 'KARYAWAN' : 'SERABUTAN' }));
  assert.deepStrictEqual(D.mingguan(rows, r => r.H), [25, 50, 50, 75]);
  const s = D.mingguanPerSegmen(rows, r => r.H);
  assert.deepStrictEqual(s.KARYAWAN, [50, 100, 100, 100]);
  assert.deepStrictEqual(s.SERABUTAN, [0, 0, 0, 50]);
  assert.deepStrictEqual(s.WIRASWASTA, [0, 0, 0, 0]);
});

test('tanggalBayarLPC: hari bayar paling awal bulan itu, baris denda saja diabaikan', () => {
  const v = [['NO KONTRAK', 'TGL BYR', 'PEMBIAYAAN ANGSURAN', 'PELUNASAN'],
    ['A', '12/10/2026', 500, 0], ['A', '05/10/2026', 500, 0], ['B', '03/10/2026', 0, 0], ['C', '10/07/2026', 500, 0]];
  const m = tanggalBayarLPC(v, 10, 2026);
  assert.strictEqual(m.get('A'), 5);
  assert.strictEqual(m.has('B'), false);
  assert.strictEqual(m.get('C'), 7, 'urutan hari/bulan tertukar tetap diterima');
});

test('kalimat: memuat pemberat terbesar dan pengaruhnya dalam poin', () => {
  const p = D.populasi(enam, 'nood', { fleet: false });
  const k1 = D.kalimat('Balance/Flow NOOD', D.ringkas(p.rows, p.masalah), { statusNbq: D.urai(p.rows, p.masalah, D.DIMENSI.statusNbq.nilai) });
  assert.ok(k1.length >= 2 && k1.length <= 4);
  assert.ok(k1[0].includes('penyelesaian 50,00%'));
  assert.ok(k1[1].includes('APPEAL') && k1[1].includes('naik 8,33 poin'), k1[1]);
  const rata = [k('1', 'APPEAL', 'NOOD'), k('2', 'NORMAL', 'NOOD')];
  const p2 = D.populasi(rata, 'nood', { fleet: false });
  const k2 = D.kalimat('X', D.ringkas(p2.rows, p2.masalah), { statusNbq: D.urai(p2.rows, p2.masalah, D.DIMENSI.statusNbq.nilai) });
  assert.ok(k2[k2.length - 1].includes('Tidak ada kelompok'));
});

test('kalimat: dimensi waktu (jatuh tempo, janji bayar) tidak dijadikan penyebab', () => {
  const rows = [k('1', 'APPEAL', 'P001_030', { 'JATUH TEMPO': 18 }), k('2', 'APPEAL', 'P001_030', { 'JATUH TEMPO': 19 }), k('3', 'APPEAL', 'NOOD', { 'JATUH TEMPO': 2 }), k('4', 'APPEAL', 'NOOD', { 'JATUH TEMPO': 3 })];
  const p = D.populasi(rows, 'nood', { fleet: false });
  const u = D.urai(p.rows, p.masalah, D.DIMENSI.jatuhTempo.nilai);
  assert.strictEqual(u[0].pemberat, true);
  const kal = D.kalimat('X', D.ringkas(p.rows, p.masalah), { jatuhTempo: u });
  assert.ok(kal[kal.length - 1].includes('Tidak ada kelompok'), kal.join(' | '));
});

test('hariDari: angka hari yang tersimpan sebagai teks', () => {
  assert.strictEqual(D.hariDari('21'), 21);
  assert.strictEqual(D.hariDari(' 5 '), 5);
  assert.strictEqual(D.hariDari('32'), null);
});

test('tindakan: gabungan kekurangan target daily dan penyebab diagnosa, urut dampak rupiah, maks 5', () => {
  const tdHead = { adaBaseline: true, pic: [{ co: 'X', poin: [{ judul: 'Flow NOOD', target: 500, realisasi: 200, kurangRp: 300, status: 'AMAN', belumKontrak: ['A'] }, { judul: 'Flow 1-30', target: 10, realisasi: 10, kurangRp: 0, status: 'AMAN', belumKontrak: [] }] }] };
  const penyebab = [{ angka: 'nood', dim: 'statusNbq', kalimat: 'k', pengaruh: 2 }];
  const diagnosa = { nood: { judul: 'Balance/Flow NOOD', ringkas: { beban: 10000 }, urai: { statusNbq: [{ nilai: 'APPEAL', pemberat: true, pengaruh: 2 }] },
    teratas: [{ noKontrak: 'K1', statusNbq: 'APPEAL' }, { noKontrak: 'K2', statusNbq: 'NORMAL' }] } };
  const t = D.tindakan(penyebab, tdHead, diagnosa);
  assert.deepStrictEqual(t.map(x => x.dampakRp), [300, 200]);
  assert.deepStrictEqual(t[0].kontrak, ['A']);
  assert.strictEqual(t[0].pic, 'X');
  assert.deepStrictEqual(t[1].kontrak, ['K1']);
  assert.ok(t[1].judul.includes('APPEAL'));
  const banyak = { adaBaseline: true, pic: [{ co: 'X', poin: Array.from({ length: 8 }, (_, i) => ({ judul: 'P' + i, target: 100, realisasi: 0, kurangRp: 100 + i, status: 'AMAN', belumKontrak: [] })) }] };
  assert.strictEqual(D.tindakan([], banyak, {}).length, 5);
  assert.deepStrictEqual(D.tindakan([], { adaBaseline: false, pic: [] }, {}), []);
});

test('tindakan: poin BCH (cabang) dikecualikan bila ada kekurangan FE/MR, supaya tidak duplikat', () => {
  const tdHead = { adaBaseline: true, pic: [
    { co: 'X', role: 'FE', poin: [{ judul: 'Flow NOOD', target: 500, realisasi: 200, kurangRp: 300, status: 'AMAN', belumKontrak: ['A'] }] },
    { co: 'BOSS', role: 'BCH', poin: [{ judul: 'Flow NOOD', target: 2000, realisasi: 500, kurangRp: 1500, status: 'AMAN', belumKontrak: ['A', 'B'] }] }
  ] };
  const t = D.tindakan([], tdHead, {});
  assert.strictEqual(t.length, 1, 'poin BCH dibuang karena sudah ada kekurangan FE');
  assert.strictEqual(t[0].pic, 'X');
});

test('tindakan: poin BCH tetap dipakai bila tidak ada kekurangan FE/MR sama sekali', () => {
  const tdHead = { adaBaseline: true, pic: [
    { co: 'X', role: 'FE', poin: [{ judul: 'Flow NOOD', target: 500, realisasi: 500, kurangRp: 0, status: 'AMAN', belumKontrak: [] }] },
    { co: 'BOSS', role: 'BCH', poin: [{ judul: 'Flow NOOD', target: 2000, realisasi: 500, kurangRp: 1500, status: 'AMAN', belumKontrak: ['A', 'B'] }] }
  ] };
  const t = D.tindakan([], tdHead, {});
  assert.strictEqual(t.length, 1);
  assert.strictEqual(t[0].pic, 'BOSS');
});

test('tindakan: rupiah nyaris nol tidak tampil "-0 jt"', () => {
  const td = { adaBaseline: true, pic: [{ co: 'X', poin: [{ judul: 'P', target: 5e8, realisasi: -4e5, kurangRp: 5e8, status: 'AMAN', belumKontrak: [] }] }] };
  assert.ok(!D.tindakan([], td, {})[0].temuan.includes('-0 jt'));
});
