// Baseline harian Target Daily. Target hari ini DIBEKUKAN sekali per hari (tab LOG_TARGET_DAILY, dibuat otomatis),
// supaya selama admin update data bayar 3x sehari, target tidak ikut bergeser — yang bergerak hanya progresnya.
// Progres = SIPOK kontrak di daftar yang dikunci pagi yang sudah bayar hari ini (LPC / REALISASI) atau sudah keluar dari daftar belum bayar.
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

// Baca baseline untuk tanggal tertentu → { 'PIC|kunci': { targetHari, baseNilai, kontrak:[[no,sipok,nama],...] } } (baris TERAKHIR menang)
// pembaca opsional (mis. bacaSheet dengan cache 45 detik): (sheetId, range, token) -> values. Dipakai hanya untuk bacaan
// read-only (mis. mode=head) — pastikanBaseline TIDAK memakainya karena perlu baca ulang segar setelah menulis baseline baru.
async function bacaBaseline(token, sheetId, kunciTgl, pembaca) {
  let nilai;
  if (pembaca) { nilai = await pembaca(sheetId, TAB, token).catch(() => null); }
  else { const r = await sf('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(TAB) + '?valueRenderOption=UNFORMATTED_VALUE', token); nilai = r.ok ? r.json.values : null; }
  if (!nilai) return {};
  const out = {};
  nilai.slice(1).forEach(row => {
    if (String(row[0] || '') !== kunciTgl) return;
    const k = row[1] + '|' + row[2];
    // baris terakhir menang: pembekuan ulang (cron 09.00 / tombol admin) menimpa yang lebih awal
    let kontrak = []; try { kontrak = JSON.parse(row[5] || '[]'); } catch (e) {}
    out[k] = { targetHari: Number(row[3]) || 0, baseNilai: Number(row[4]) || 0, kontrak, waktu: String(row[6] || '') };
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
    rows.push([kunciTgl, safe(p.namaCO), q.kunci, Math.round(q.perHari || 0), Math.round(q.nilaiFE !== undefined ? q.nilaiFE : (q.nilaiAmt || 0)), js, waktu]);
  }));
  return rows;
}

// Jam (WIB) mulai baseline boleh dibekukan otomatis. Sebelum jam ini data pagi mungkin belum ditarik admin, jadi baseline ditunda
// supaya hasil tarikan pagi tidak terhitung sebagai "progres". Cron 09.00 WIB selalu membekukan ulang.
const JAM_BEKU = 9;
function jamWIB() { return new Date(Date.now() + 7 * 3600 * 1000).getUTCHours(); }

// Pastikan baseline hari ini ada; kalau belum, bekukan dari kondisi saat ini (hanya setelah JAM_BEKU). Mengembalikan baseline-nya + status.
// opsi.paksa = bekukan ulang sekarang walau sudah ada (cron / tombol admin).
async function pastikanBaseline(token, sheetId, td, baseAwal, opsi) {
  opsi = opsi || {};
  const kunciTgl = kunciTanggal(td.tanggal);
  // baseAwal = hasil baca yang sudah dilakukan paralel oleh pemanggil (hemat 1 round trip); null/undefined = baca di sini
  let base = baseAwal || await bacaBaseline(token, sheetId, kunciTgl);
  if (!opsi.paksa && Object.keys(base).length) return { base, baru: false };
  if (!opsi.paksa && jamWIB() < JAM_BEKU) return { base: {}, baru: false, tertunda: true };
  await ensureTab(token, sheetId);
  const rows = barisBaseline(td, kunciTgl);
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(TAB + '!A:G') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
  const ap = await sf(url, token, { method: 'POST', body: JSON.stringify({ values: rows }) });
  if (!ap.ok) throw new Error('Gagal menyimpan baseline target harian.');
  // Baca ulang supaya semua permintaan memakai baris terakhir yang sama
  base = await bacaBaseline(token, sheetId, kunciTgl);
  return { base, baru: true };
}

// Tempelkan progres ke tiap poin (§7.4 spec project 3). Target dibekukan pagi; realisasi = perubahan posisi parameter dari
// posisi pagi (BASE_NILAI) ke posisi sekarang, positif bila bergerak ke arah yang diinginkan (naik untuk Balance NOOD,
// turun untuk Balance 1-30/31-60/30+ dan Flow). Bisa minus bila posisi memburuk. Daftar kontrak pagi yang sudah bayar/keluar
// tetap disertakan sebagai informasi, tidak dipakai untuk angka.
function terapkanProgres(td, base) {
  td.pic.forEach(p => p.poin.forEach(q => {
    const b = base[p.namaCO + '|' + q.kunci];
    const sekarang = new Set((q.semuaKandidat || []).map(x => String(x[0])));
    const bayarHariIni = new Set((q.realisasi || []).map(x => String(x[0])));
    if (b) {
      const posisi = Number(q.nilaiFE !== undefined ? q.nilaiFE : q.nilaiAmt) || 0;
      const tercapai = q.arah === 'naik' ? posisi - b.baseNilai : b.baseNilai - posisi;
      const dilihat = new Set();
      const bayar = (b.kontrak || []).filter(x => { const k = String(x[0]); if (dilihat.has(k)) return false; dilihat.add(k); return bayarHariIni.has(k) || !sekarang.has(k); });
      q.progres = {
        targetHari: b.targetHari, baseNilai: b.baseNilai, posisiSekarang: posisi, arah: q.arah, tercapai,
        persen: b.targetHari > 0 ? tercapai / b.targetHari * 100 : 100,
        sisa: Math.max(0, b.targetHari - tercapai), tuntas: b.targetHari <= 0 || tercapai >= b.targetHari,
        jumlahBayar: bayar.length, jumlahBase: (b.kontrak || []).length, jumlahSekarang: sekarang.size, waktuBase: b.waktu || '',
        kontrakBayar: bayar.slice().sort((a, c) => c[1] - a[1]).slice(0, 15).map(x => ({ noKontrak: x[0], sipok: x[1], nama: x[2] || '-' }))
      };
    }
    delete q.semuaKandidat; delete q.nilaiFE; delete q.realisasi;
  }));
  return td;
}

// Status dari jumlah hari berturut-turut tidak mencapai target: 1-2 hari waspada, 3 hari atau lebih merah.
function statusStreak(hari) { return hari >= 3 ? 'MERAH' : hari >= 1 ? 'WASPADA' : 'AMAN'; }

// ---- Hasil harian (untuk riwayat & streak "tidak target") ----
const HASIL_TAB = 'LOG_TARGET_HASIL';
const HASIL_HEADER = ['TANGGAL', 'PIC', 'KUNCI', 'TARGET', 'TERCAPAI', 'PERSEN', 'TUNTAS'];

function kemarin(w) { const d = new Date(Date.UTC(w.tahun, w.bulan - 1, w.hari - 1)); return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1, hari: d.getUTCDate() }; }

async function bacaHasil(token, sheetId) {
  const r = await sf('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/' + encodeURIComponent(HASIL_TAB) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  if (!r.ok || !r.json.values) return [];
  const peta = {};
  r.json.values.slice(1).filter(x => x[0]).forEach(x => { peta[x[0] + '|' + x[1] + '|' + x[2]] = x; });
  return Object.values(peta).map(x => ({ tanggal: String(x[0]), pic: String(x[1] || ''), kunci: String(x[2] || ''), target: Number(x[3]) || 0, tercapai: Number(x[4]) || 0, persen: Number(x[5]) || 0, tuntas: x[6] === true || String(x[6]).toUpperCase() === 'TRUE' || x[6] === 1 }));
}

// LPC berganti tiap hari, jadi hasil harian TIDAK bisa dihitung ulang esok harinya.
// Hasil hari ini dicatat saat halaman Target Daily dibuka (baris pertama hari itu, lalu setiap kali TERCAPAI berubah); baris terakhir menang saat dibaca.
async function catatHasilHariIni(token, sheetId, td, hasilAda) {
  const tgl = kunciTanggal(td.tanggal);
  const ada = {}; (hasilAda || []).filter(x => x.tanggal === tgl).forEach(x => { ada[x.pic + '|' + x.kunci] = x; });
  const rows = [];
  td.pic.forEach(p => p.poin.forEach(q => {
    const g = q.progres; if (!g) return;
    const lama = ada[p.namaCO + '|' + q.kunci];
    if (lama && Math.round(g.tercapai) === Math.round(lama.tercapai)) return; // realisasi posisi bisa naik-turun: catat nilai terbaru bila berubah
    rows.push([tgl, safe(p.namaCO), q.kunci, Math.round(g.targetHari), Math.round(g.tercapai), Math.round(g.persen * 10) / 10, (g.targetHari <= 0 || g.tuntas) ? 'TRUE' : 'FALSE']);
  }));
  if (!rows.length) return 0;
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId;
  const add = await sf(base + ':batchUpdate', token, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: HASIL_TAB } } }] }) });
  if (add.ok) await sf(base + '/values/' + encodeURIComponent(HASIL_TAB + '!A1') + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: [HASIL_HEADER] }) });
  const ap = await sf(base + '/values/' + encodeURIComponent(HASIL_TAB + '!A:G') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', token, { method: 'POST', body: JSON.stringify({ values: rows }) });
  if (!ap.ok) throw new Error('Gagal menyimpan hasil harian.');
  return rows.length;
}
// Dipertahankan agar cron lama tetap jalan: hasil kemarin sudah dicatat harian oleh catatHasilHariIni.
async function finalkanKemarin() { return 0; }

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

module.exports = { statusStreak, catatHasilHariIni, JAM_BEKU, jamWIB, TAB, HASIL_TAB, kemarin, bacaHasil, finalkanKemarin, hitungStreak, kunciTanggal, bacaBaseline, pastikanBaseline, terapkanProgres, barisBaseline };
