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
module.exports = { normBucket, cleanCell };
