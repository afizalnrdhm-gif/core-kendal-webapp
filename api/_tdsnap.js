// Baseline harian Target Daily. Target hari ini DIBEKUKAN sekali per hari (tab LOG_TARGET_DAILY, dibuat otomatis),
// supaya selama admin update data bayar 3x sehari, target tidak ikut bergeser — yang bergerak hanya progresnya.
// Progres = jumlah SIPOK kontrak yang pagi tadi masih belum bayar (ada di baseline) dan sekarang sudah tidak ada di daftar belum bayar.
// File berawalan "_" tidak dihitung Vercel sebagai function.
const TAB = 'LOG_TARGET_DAILY';
const HEADER = ['TANGGAL', 'PIC', 'KUNCI', 'TARGET_HARI', 'BASE_NILAI', 'KONTRAK', 'WAKTU'];
const MAKS_CELL = 45000;

async function sf(url, token, opts) {
  const res = await fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, opts || {}));
  let json = {}; try { json = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, json };
}

function kunciTanggal(w) { return w.tahun + '-' + String(w.bulan).padStart(2, '0') + '-' + String(w.hari).padStart(2, '0'); }
const safe = v => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };

async function ensureTab(token, sheetId) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId;
  const add = await sf(base + ':batchUpdate', token, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }) });
  if (add.ok) {
    await sf(base + '/values/' + encodeURIComponent(TAB + '!A1') + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: [HEADER] }) });
  }
}

// Baca baseline untuk tanggal tertentu → { 'PIC|kunci': { targetHari, baseNilai, kontrak:[[no,sipok,nama],...] } } (baris pertama menang)
async function bacaBaseline(token, sheetId, kunciTgl) {
  const r = await sf('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(TAB) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  if (!r.ok || !r.json.values) return {};
  const out = {};
  r.json.values.slice(1).forEach(row => {
    if (String(row[0] || '') !== kunciTgl) return;
    const k = row[1] + '|' + row[2];
    if (out[k]) return;
    let kontrak = []; try { kontrak = JSON.parse(row[5] || '[]'); } catch (e) {}
    out[k] = { targetHari: Number(row[3]) || 0, baseNilai: Number(row[4]) || 0, kontrak };
  });
  return out;
}

function barisBaseline(td, kunciTgl) {
  const waktu = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const rows = [];
  td.pic.forEach(p => p.poin.forEach(q => {
    let kontrak = (q.semuaKandidat || []).map(x => [x[0], Math.round(x[1]), String(x[2] || '').slice(0, 40)]);
    let js = JSON.stringify(kontrak);
    while (js.length > MAKS_CELL && kontrak.length) { kontrak = kontrak.slice(0, Math.floor(kontrak.length * 0.9)); js = JSON.stringify(kontrak); }
    rows.push([kunciTgl, safe(p.namaCO), q.kunci, Math.round(q.perHari || 0), Math.round(q.nilaiAmt || 0), js, waktu]);
  }));
  return rows;
}

// Pastikan baseline hari ini ada; kalau belum, bekukan dari kondisi saat ini. Mengembalikan baseline-nya + status.
async function pastikanBaseline(token, sheetId, td) {
  const kunciTgl = kunciTanggal(td.tanggal);
  let base = await bacaBaseline(token, sheetId, kunciTgl);
  if (Object.keys(base).length) return { base, baru: false };
  await ensureTab(token, sheetId);
  const rows = barisBaseline(td, kunciTgl);
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(TAB + '!A:G') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  const ap = await sf(url, token, { method: 'POST', body: JSON.stringify({ values: rows }) });
  if (!ap.ok) throw new Error('Gagal menyimpan baseline target harian.');
  // Baca ulang supaya kalau ada dua permintaan bersamaan, semuanya memakai baris pertama yang sama
  base = await bacaBaseline(token, sheetId, kunciTgl);
  return { base, baru: true };
}

// Tempelkan progres ke tiap poin: target dibekukan dari baseline, tercapai = SIPOK kontrak baseline yang sekarang sudah tidak belum-bayar.
function terapkanProgres(td, base) {
  td.pic.forEach(p => p.poin.forEach(q => {
    const b = base[p.namaCO + '|' + q.kunci];
    const sekarang = new Set((q.semuaKandidat || []).map(x => x[0]));
    if (b) {
      const bayar = (b.kontrak || []).filter(x => !sekarang.has(x[0]));
      const tercapai = bayar.reduce((t, x) => t + (Number(x[1]) || 0), 0);
      q.progres = {
        targetHari: b.targetHari, baseNilai: b.baseNilai, tercapai,
        persen: b.targetHari > 0 ? tercapai / b.targetHari * 100 : (tercapai > 0 ? 100 : 0),
        sisa: Math.max(0, b.targetHari - tercapai), tuntas: tercapai >= b.targetHari,
        jumlahBayar: bayar.length, kontrakBayar: bayar.slice().sort((a, c) => c[1] - a[1]).slice(0, 15).map(x => ({ noKontrak: x[0], sipok: x[1], nama: x[2] || '-' }))
      };
    }
    delete q.semuaKandidat;
  }));
  return td;
}

module.exports = { TAB, kunciTanggal, bacaBaseline, pastikanBaseline, terapkanProgres, barisBaseline };
