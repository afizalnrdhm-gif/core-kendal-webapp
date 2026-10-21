const test = require('node:test'); const assert = require('node:assert');
const { barisLogHarian, tulisLogHarian, bacaLogHarian, HEADER_LOG_HARIAN } = require('../api/_logharian');
const { flowLebar, btcKe } = require('../api/_kpi');

const ka = [
  { 'BUCKET UPDATE': 'NOOD', 'SISA PIUTANG': 600, 'FLEET/NON FLEET': 'NON FLEET', 'NAMA COLLECTOR': 'FE A' },
  { 'BUCKET UPDATE': 'P001_030', 'SISA PIUTANG': 300, 'FLEET/NON FLEET': 'NON FLEET', 'NAMA COLLECTOR': 'FE A' },
  { 'BUCKET UPDATE': 'P031_060', 'SISA PIUTANG': 100, 'FLEET/NON FLEET': 'NON FLEET', 'NAMA COLLECTOR': 'FE A' }
];
const m = (a, u, s) => ({ 'CO ALL': 'FE A', 'BUCKET AWAL': a, 'BUCKET UPDATE': u, SIPOK: s, 'FLEET/NON FLEET': 'NON FLEET' });
const master = [m('NOOD', 'NOOD', 100), m('NOOD', 'NOOD', 100), m('NOOD', 'P001_030', 100), m('NOOD', 'P031_060', 100), m('P001_030', 'NOOD', 50), m('P001_030', 'P001_030', 150)];

test('flowLebar menghitung semua yang lebih buruk dari bucket awal; btcKe yang kembali ke NOOD', () => {
  assert.deepStrictEqual(flowLebar(master, 'NOOD', false), { amount: 200, count: 2, pct: 50, beban: 400 });
  assert.deepStrictEqual(btcKe(master, 'P001_030', false), { amount: 50, count: 1, pct: 25, beban: 200 });
});

test('barisLogHarian: lingkup cabang dan per CO', () => {
  const b = barisLogHarian('2026-10-21', master, ka);
  const cari = (l, k) => b.find(r => r[1] === l && r[2] === k);
  assert.deepStrictEqual(cari('CABANG', 'BAL NOOD'), ['2026-10-21', 'CABANG', 'BAL NOOD', 600, 60]);
  assert.deepStrictEqual(cari('FE A', 'FLOW NOOD'), ['2026-10-21', 'FE A', 'FLOW NOOD', 200, 50]);
  assert.deepStrictEqual(cari('CABANG', 'BTC 1-30'), ['2026-10-21', 'CABANG', 'BTC 1-30', 50, 25]);
  assert.ok(cari('CABANG', 'ENR') && cari('CABANG', '30+') && cari('CABANG', 'BAL 181-210'));
});

function fetchPalsu(isiAwal, opsi) {
  const panggil = [];
  const f = async (url, init) => {
    panggil.push({ url: decodeURIComponent(url), init });
    if (!init || !init.method || init.method === 'GET') {
      if (opsi && opsi.tidakAda) return { ok: false, status: 400, json: async () => ({ error: { message: 'Unable to parse range' } }) };
      return { ok: true, json: async () => ({ values: isiAwal }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  return { f, panggil };
}

test('tulisLogHarian menimpa baris tanggal yang sama, tidak dobel', async () => {
  const lama = global.fetch;
  const { f, panggil } = fetchPalsu([HEADER_LOG_HARIAN, ['2026-10-21', 'CABANG', 'ENR', 1, 1], ['2026-10-21', 'CABANG', '30+', 1, 1], ['2026-10-20', 'CABANG', 'ENR', 9, 9]]);
  global.fetch = f;
  try {
    const baru = [['2026-10-21', 'CABANG', 'ENR', 5, 5], ['2026-10-21', 'CABANG', '30+', 6, 6], ['2026-10-21', 'FE A', 'ENR', 7, 7]];
    const r = await tulisLogHarian('t', 's', baru);
    assert.strictEqual(r.ditulis, 3);
    const upd = panggil.find(p => p.init && p.init.method === 'PUT');
    assert.deepStrictEqual(JSON.parse(upd.init.body).values, [HEADER_LOG_HARIAN, ['2026-10-20', 'CABANG', 'ENR', 9, 9], ...baru]);
  } finally { global.fetch = lama; }
});

test('tulisLogHarian membuat tab bila belum ada; bacaLogHarian tab tidak ada = {}', async () => {
  const lama = global.fetch;
  const { f, panggil } = fetchPalsu(null, { tidakAda: true });
  global.fetch = f;
  try {
    assert.deepStrictEqual(await bacaLogHarian('t', 's'), {});
    await tulisLogHarian('t', 's', [['2026-10-21', 'CABANG', 'ENR', 5, 5]]);
    assert.ok(panggil.some(p => p.url.includes(':batchUpdate') && p.init.body.includes('addSheet')));
  } finally { global.fetch = lama; }
});

test('bacaLogHarian menyusun peta tanggal > lingkup > kpi', async () => {
  const lama = global.fetch;
  global.fetch = fetchPalsu([HEADER_LOG_HARIAN, ['2026-10-20', 'CABANG', 'FLOW NOOD', 100, 46]]).f;
  try {
    const p = await bacaLogHarian('t', 's');
    assert.deepStrictEqual(p['2026-10-20'].CABANG['FLOW NOOD'], { amt: 100, pct: 46 });
  } finally { global.fetch = lama; }
});

test('tulisLogHarian: tulis isi baru dulu; bila gagal, tab tidak dikosongkan', async () => {
  const lama = global.fetch, panggil = [];
  global.fetch = async (url, init) => {
    panggil.push({ url: decodeURIComponent(url), method: init && init.method });
    if (!init || !init.method) return { ok: true, json: async () => ({ values: [HEADER_LOG_HARIAN, ['2026-10-20', 'CABANG', 'ENR', 9, 9]] }) };
    if (init.method === 'PUT') return { ok: false, json: async () => ({ error: { code: 429 } }) };
    return { ok: true, json: async () => ({}) };
  };
  try {
    await assert.rejects(tulisLogHarian('t', 's', [['2026-10-21', 'CABANG', 'ENR', 5, 5]]));
    assert.ok(!panggil.some(p => p.url.includes(':clear')), 'tidak boleh clear sebelum PUT berhasil');
  } finally { global.fetch = lama; }
});

test('tulisLogHarian: sisa baris lama di bawah isi baru dibersihkan setelah PUT', async () => {
  const lama = global.fetch, panggil = [];
  global.fetch = async (url, init) => {
    panggil.push({ url: decodeURIComponent(url), method: init && init.method });
    if (!init || !init.method) return { ok: true, json: async () => ({ values: [HEADER_LOG_HARIAN, ['2026-10-21', 'CABANG', 'ENR', 1, 1], ['2026-10-21', 'CABANG', '30+', 1, 1], ['2026-10-20', 'CABANG', 'ENR', 9, 9]] }) };
    return { ok: true, json: async () => ({}) };
  };
  try {
    await tulisLogHarian('t', 's', [['2026-10-21', 'CABANG', 'ENR', 5, 5]]);
    const iPut = panggil.findIndex(p => p.method === 'PUT'), iClr = panggil.findIndex(p => p.url.includes(':clear'));
    assert.ok(iPut > -1 && iClr > iPut, 'clear setelah PUT');
    assert.ok(panggil[iClr].url.includes('LOG_HARIAN!A4:E'), panggil[iClr].url);
  } finally { global.fetch = lama; }
});
