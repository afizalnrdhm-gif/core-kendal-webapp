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

// ---- Hasil harian (untuk riwayat & streak "tidak target") ----
const HASIL_TAB = 'LOG_TARGET_HASIL';
const HASIL_HEADER = ['TANGGAL', 'PIC', 'KUNCI', 'TARGET', 'TERCAPAI', 'PERSEN', 'TUNTAS'];

function kemarin(w) { const d = new Date(Date.UTC(w.tahun, w.bulan - 1, w.hari - 1)); return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() }; }

async function bacaHasil(token, sheetId) {
  const r = await sf('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(HASIL_TAB) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  if (!r.ok || !r.json.values) return [];
  return r.json.values.slice(1).filter(x => x[0]).map(x => ({ tanggal: String(x[0]), pic: String(x[1] || ''), kunci: String(x[2] || ''), target: Number(x[3]) || 0, tercapai: Number(x[4]) || 0, persen: Number(x[5]) || 0, tuntas: x[6] === true || String(x[6]).toUpperCase() === 'TRUE' || x[6] === 1 }));
}

// Catat hasil final kemarin. Dipanggil cron pagi: data pagi = kondisi akhir kemarin, jadi progres kemarin dihitung dari baseline kemarin vs data ini.
// Mengembalikan jumlah baris yang ditulis (0 kalau kemarin tidak punya baseline atau sudah pernah dicatat).
async function finalkanKemarin(token, sheetId, td) {
  const kTgl = kunciTanggal(kemarin(td.tanggal));
  const baseKemarin = await bacaBaseline(token, sheetId, kTgl);
  if (!Object.keys(baseKemarin).length) return 0;
  const sudah = await bacaHasil(token, sheetId);
  if (sudah.some(x => x.tanggal === kTgl)) return 0;
  const salinan = JSON.parse(JSON.stringify(td));
  terapkanProgres(salinan, baseKemarin);
  const rows = [];
  salinan.pic.forEach(p => p.poin.forEach(q => {
    const g = q.progres; if (!g) return;
    rows.push([kTgl, safe(p.namaCO), q.kunci, Math.round(g.targetHari), Math.round(g.tercapai), Math.round(g.persen * 10) / 10, (g.targetHari <= 0 || g.tuntas) ? 'TRUE' : 'FALSE']);
  }));
  if (!rows.length) return 0;
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId;
  const add = await sf(base + ':batchUpdate', token, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: HASIL_TAB } } }] }) });
  if (add.ok) await sf(base + '/values/' + encodeURIComponent(HASIL_TAB + '!A1') + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: [HASIL_HEADER] }) });
  const ap = await sf(base + '/values/' + encodeURIComponent(HASIL_TAB + '!A:G') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', token, { method: 'POST', body: JSON.stringify({ values: rows }) });
  if (!ap.ok) throw new Error('Gagal menyimpan hasil harian.');
  return rows.length;
}

// Streak hari berturut-turut TIDAK mencapai target, per PIC + poin, dihitung dari hari terbaru mundur. Hari target 0 dihitung tercapai.
function hitungStreak(hasil) {
  const per = {};
  hasil.forEach(x => { const k = x.pic + '|' + x.kunci; (per[k] = per[k] || []).push(x); });
  const out = [];
  Object.keys(per).forEach(k => {
    const arr = per[k].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    let n = 0; for (const x of arr) { if (x.tuntas) break; n++; }
    const [pic, kunci] = k.split('|');
    out.push({ pic, kunci, hari: n, sejak: n ? arr[n - 1].tanggal : null, terakhirPersen: arr[0] ? arr[0].persen : 0 });
  });
  const tanggal = Array.from(new Set(hasil.map(x => x.tanggal))).sort();
  return { daftar: out.filter(x => x.hari > 0).sort((a, b) => b.hari - a.hari), riwayatHari: tanggal.length };
}

module.exports = { TAB, HASIL_TAB, kemarin, bacaHasil, finalkanKemarin, hitungStreak, kunciTanggal, bacaBaseline, pastikanBaseline, terapkanProgres, barisBaseline };
