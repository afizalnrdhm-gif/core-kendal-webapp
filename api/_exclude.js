// Pengecualian kontrak dari perhitungan performance (Rapor/Insentif/Target/KPI BCH & CO).
// Dipakai untuk kontrak yang sudah disetujui lewat pengajuan IM takeout (mis. unit digadaikan,
// konsumen tidak ada kemampuan bayar) -- kontrak TETAP ada di MASTER & tetap kelihatan di daftar
// kontrak CO (biar collection tetap jalan/follow-up), cuma dikeluarkan dari hitungan performance.
//
// Sumber kebenaran: tab KONTRAK_EXCLUDE di spreadsheet (kolom pertama = NO KONTRAK).
// File berawalan "_" tidak dihitung Vercel sebagai function.
//
// Dibaca lewat cache bersama (_cachesheet, 45 detik) -- SAMA seperti MASTER/KA HARIAN --
// supaya tidak nambah kuota Google Sheets API tiap kali menu dibuka/refresh/bot dipanggil.
// (Pernah bikin tampilan kosong/berantakan pas rame karena fetch langsung tanpa cache -- 12 Nov 2026.)
const { bacaSheet } = require('./_cachesheet');

async function ambilSetExclude(sheetId, accessToken) {
  try {
    const values = await bacaSheet(sheetId, 'KONTRAK_EXCLUDE!A:A', accessToken);
    const set = new Set();
    // Baris pertama header ("NO KONTRAK"), mulai dari baris kedua.
    for (let i = 1; i < values.length; i++) {
      const v = (values[i] && values[i][0] != null) ? String(values[i][0]).trim() : '';
      if (v) set.add(v);
    }
    return set;
  } catch (e) {
    // Gagal baca tab exclude jangan sampai bikin endpoint utama error -- anggap tidak ada yang di-exclude.
    return new Set();
  }
}

function saringExclude(rows, excludeSet) {
  if (!excludeSet || excludeSet.size === 0) return rows;
  return (rows || []).filter(r => !excludeSet.has(String(r['NO KONTRAK'] || '').trim()));
}

module.exports = { ambilSetExclude, saringExclude };
