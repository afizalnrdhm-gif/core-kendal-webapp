// Pembersih nilai sel Sheet yang dipakai semua endpoint: trim, #N/A -> kosong,
// dan penulisan bucket diseragamkan (NO OD / NOOD -> NOOD, P001-030 -> P001_030).
function normBucket(v) {
  const u = String(v).trim().toUpperCase();
  if (u.replace(/\s+/g, '') === 'NOOD') return 'NOOD';
  const m = u.match(/^P\s*(\d{3})\s*[-_ ]\s*(\d{3})$/);
  return m ? 'P' + m[1] + '_' + m[2] : String(v).trim();
}
function cleanCell(header, v) {
  if (typeof v !== 'string') return v;
  v = v.trim();
  if (/^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|ERROR!)$/i.test(v)) return '';
  if (header && /BUCKET/i.test(header) && v) return normBucket(v);
  return v;
}

// Kontrak yang sudah bayar angsuran HARI INI menurut sheet LPC (laporan penerimaan, di-update admin beberapa kali sehari).
// Kolom REALISASI di KA HARIAN tidak terisi otomatis di Google Sheet, jadi LPC dipakai sebagai sumber bayar.
// Dihitung hanya baris PEMBIAYAAN ANGSURAN > 0 atau PELUNASAN > 0 (bayar denda saja tidak dihitung).
// TGL BYR di LPC sering terbaca tertukar (12/10 terbaca 10 Des), jadi tanggal dicocokkan di kedua urutan hari/bulan.
function tglParts(v) {
  if (typeof v === 'number' && v > 20000) { const d = new Date(Math.round((v - 25569) * 86400000)); return [d.getUTCDate(), d.getUTCMonth() + 1]; }
  const m = String(v || '').match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
  if (!m) return null;
  return m[1].length === 4 ? [Number(m[3]), Number(m[2])] : [Number(m[1]), Number(m[2])];
}
function bayarLPC(values, hari, bulan) {
  const out = new Map();
  if (!values || !values.length) return out;
  const h = values[0].map(x => String(x || '').trim().toUpperCase());
  const iNo = h.indexOf('NO KONTRAK'), iAng = h.indexOf('PEMBIAYAAN ANGSURAN'), iLun = h.indexOf('PELUNASAN'), iTgl = h.indexOf('TGL BYR');
  if (iNo < 0) return out;
  const num = v => { const n = typeof v === 'number' ? v : Number(String(v || '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
  values.slice(1).forEach(r => {
    const no = String(r[iNo] == null ? '' : r[iNo]).trim(); if (!no) return;
    const ang = iAng > -1 ? num(r[iAng]) : 0, lun = iLun > -1 ? num(r[iLun]) : 0;
    if (ang <= 0 && lun <= 0) return;
    if (hari && iTgl > -1) { const t = tglParts(r[iTgl]); if (t && !((t[0] === hari && t[1] === bulan) || (t[1] === hari && t[0] === bulan))) return; }
    out.set(no, (out.get(no) || 0) + 1);
  });
  return out;
}
// Hari bayar paling awal bulan `bulan` per kontrak menurut LPC (baris angsuran/pelunasan > 0). Urutan hari/bulan tertukar diterima.
function tanggalBayarLPC(values, bulan) {
  const out = new Map();
  if (!values || !values.length) return out;
  const h = values[0].map(x => String(x || '').trim().toUpperCase());
  const iNo = h.indexOf('NO KONTRAK'), iAng = h.indexOf('PEMBIAYAAN ANGSURAN'), iLun = h.indexOf('PELUNASAN'), iTgl = h.indexOf('TGL BYR');
  if (iNo < 0 || iTgl < 0) return out;
  const num = v => { const n = typeof v === 'number' ? v : Number(String(v || '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
  values.slice(1).forEach(r => {
    const no = String(r[iNo] == null ? '' : r[iNo]).trim(); if (!no) return;
    if ((iAng > -1 ? num(r[iAng]) : 0) <= 0 && (iLun > -1 ? num(r[iLun]) : 0) <= 0) return;
    const t = tglParts(r[iTgl]); if (!t) return;
    const hari = t[1] === bulan ? t[0] : t[0] === bulan ? t[1] : null;
    if (!hari || hari > 31) return;
    if (!out.has(no) || out.get(no) > hari) out.set(no, hari);
  });
  return out;
}
module.exports = { normBucket, cleanCell, bayarLPC, tglParts, tanggalBayarLPC };
