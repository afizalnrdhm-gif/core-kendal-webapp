// Snapshot harian KPI cabang dan per CO ke tab LOG_HARIAN (ditulis cron pagi). Satu baris per tanggal per lingkup per KPI.
const { hitungKpi, flowLebar, btcKe } = require('./_kpi');

const TAB = 'LOG_HARIAN';
const HEADER_LOG_HARIAN = ['TANGGAL', 'LINGKUP', 'KPI', 'NILAI_AMT', 'NILAI_PCT'];
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;

function kpiLingkup_(master, ka) {
  const k = hitungKpi(master, ka, false), out = [];
  out.push(['ENR', k.enr, 100]);
  k.perBucket.forEach(b => out.push(['BAL ' + b.label.replace('Bucket ', ''), b.amount, b.pct]));
  const kum = { '0+ (TOD)': '0+', '30+ (Delq)': '30+', '60+': '60+', '90+ (NPL)': '90+', '180+': '180+' };
  k.cumulative.forEach(c => out.push([kum[c.label], c.amount, c.pct]));
  [['FLOW NOOD', flowLebar(master, 'NOOD', false)], ['FLOW 1-30', flowLebar(master, 'P001_030', false)], ['FLOW 31-60', flowLebar(master, 'P031_060', false)],
   ['BTC 1-30', btcKe(master, 'P001_030', false)], ['BTC 31-60', btcKe(master, 'P031_060', false)]].forEach(([n, f]) => out.push([n, f.amount, f.pct]));
  return out;
}

function barisLogHarian(tanggal, masterRows, kaRows) {
  const baris = [];
  const tambah = (lingkup, m, k) => kpiLingkup_(m, k).forEach(([kpi, amt, pct]) => baris.push([tanggal, lingkup, kpi, r2(amt), r2(pct)]));
  tambah('CABANG', masterRows, kaRows);
  const daftarCO = [...new Set((masterRows || []).map(m => String(m['CO ALL'] || '').trim()).filter(Boolean))];
  daftarCO.forEach(co => tambah(co,
    masterRows.filter(m => String(m['CO ALL'] || '').trim() === co),
    (kaRows || []).filter(k => String(k['NAMA COLLECTOR'] || '').trim() === co)));
  return baris;
}

async function req_(url, token, init) {
  const res = await fetch(url, Object.assign({}, init || {}, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }));
  let json = {}; try { json = await res.json(); } catch (e) { json = {}; }
  return { ok: res.ok, json };
}
async function bacaMentah_(token, sheetId) {
  const r = await req_(API + sheetId + '/values/' + encodeURIComponent(TAB) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  return r.ok ? (r.json.values || []) : null;
}

async function tulisLogHarian(token, sheetId, baris) {
  let isi = await bacaMentah_(token, sheetId);
  if (isi === null) {
    const add = await req_(API + sheetId + ':batchUpdate', token, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }) });
    if (!add.ok) throw new Error('Gagal membuat tab ' + TAB + ': ' + JSON.stringify(add.json));
    isi = [];
  }
  const tanggalBaru = new Set(baris.map(b => String(b[0])));
  const sisa = isi.slice(1).filter(r => r && r.length && !tanggalBaru.has(String(r[0])));
  const nilai = [HEADER_LOG_HARIAN, ...sisa, ...baris];
  // Tulis isi baru dulu (menimpa dari A1), baru bersihkan sisa baris lama di bawahnya. Bila PUT gagal, data lama tetap utuh.
  const upd = await req_(API + sheetId + '/values/' + encodeURIComponent(TAB + '!A1') + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: nilai }) });
  if (!upd.ok) throw new Error('Gagal menulis ' + TAB + ': ' + JSON.stringify(upd.json));
  if (isi.length > nilai.length) {
    const clr = await req_(API + sheetId + '/values/' + encodeURIComponent(TAB + '!A' + (nilai.length + 1) + ':E') + ':clear', token, { method: 'POST', body: '{}' });
    if (!clr.ok) throw new Error('Gagal membersihkan sisa ' + TAB + ': ' + JSON.stringify(clr.json));
  }
  return { ditulis: baris.length };
}

async function bacaLogHarian(token, sheetId) {
  const isi = await bacaMentah_(token, sheetId);
  const out = {};
  (isi || []).slice(1).forEach(r => {
    if (!r || !r[0]) return;
    const t = String(r[0]), l = String(r[1] || ''), k = String(r[2] || '');
    ((out[t] = out[t] || {})[l] = out[t][l] || {})[k] = { amt: Number(r[3]) || 0, pct: Number(r[4]) || 0 };
  });
  return out;
}

module.exports = { HEADER_LOG_HARIAN, barisLogHarian, tulisLogHarian, bacaLogHarian };
