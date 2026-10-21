// Baca range Google Sheet dengan cache singkat di memori instance (45 detik). Permintaan bersamaan berbagi satu bacaan.
const CACHE_SHEET_MS = 45 * 1000;
const cacheSheet = new Map();
async function bacaLangsung_(sheetId, range, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const json = await res.json();
  if (!json.values) throw new Error('Gagal baca range ' + range + ': ' + JSON.stringify(json));
  return json.values;
}
async function bacaSheet(sheetId, range, accessToken, tanpaCache) {
  if (tanpaCache) return bacaLangsung_(sheetId, range, accessToken);
  const key = sheetId + '|' + range;
  const hit = cacheSheet.get(key);
  if (hit && Date.now() - hit.t < CACHE_SHEET_MS) return hit.p;
  const p = bacaLangsung_(sheetId, range, accessToken);
  cacheSheet.set(key, { t: Date.now(), p });
  p.catch(() => { const c = cacheSheet.get(key); if (c && c.p === p) cacheSheet.delete(key); });
  return p;
}
module.exports = { bacaSheet };
