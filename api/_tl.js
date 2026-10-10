// Helper log tindak lanjut (Janji Bayar + Kronologis) per kontrak.
// Disimpan di tab LOG_TINDAK_LANJUT (dibuat otomatis kalau belum ada) supaya ada riwayat,
// tidak cuma satu kotak yang selalu ditimpa. File berawalan "_" tidak dianggap endpoint oleh Vercel.
const LOG_TAB = 'LOG_TINDAK_LANJUT';
const HEADER = ['WAKTU', 'EMAIL', 'NO KONTRAK', 'NAMA KONSUMEN', 'JANJI BAYAR', 'KRONOLOGIS', 'JANJI LAMA', 'KRONOLOGIS LAMA'];

async function sheetsFetch(url, accessToken, opts) {
  const res = await fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' } }, opts || {}));
  let json = {};
  try { json = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, json };
}

async function ensureTab(accessToken, sheetId) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const add = await sheetsFetch(`${base}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: LOG_TAB } } }] })
  });
  // Kalau tab sudah ada, Google balas 400 "already exists" — itu aman diabaikan.
  if (add.ok) {
    await sheetsFetch(`${base}/values/${encodeURIComponent(LOG_TAB + '!A1')}?valueInputOption=RAW`, accessToken, {
      method: 'PUT', body: JSON.stringify({ values: [HEADER] })
    });
  }
}

// Awali dengan apostrof kalau isi diawali karakter rumus, supaya Sheets membacanya sebagai teks.
function safeCell(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

async function appendLog(accessToken, sheetId, row) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(LOG_TAB + '!A:H')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const body = JSON.stringify({ values: [row.map(safeCell)] });
  let r = await sheetsFetch(url, accessToken, { method: 'POST', body });
  if (!r.ok) {
    await ensureTab(accessToken, sheetId);
    r = await sheetsFetch(url, accessToken, { method: 'POST', body });
  }
  return r.ok;
}

async function readLog(accessToken, sheetId, noKontrak, limit) {
  const r = await sheetsFetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(LOG_TAB)}?valueRenderOption=UNFORMATTED_VALUE`, accessToken);
  const values = (r.ok && r.json.values) || [];
  const out = [];
  for (let i = values.length - 1; i >= 1 && out.length < (limit || 30); i--) {
    const v = values[i] || [];
    if ((v[2] || '').toString().trim() === noKontrak) {
      out.push({ waktu: v[0] || '', email: v[1] || '', janji: (v[4] == null ? '' : v[4]).toString(), kronologis: (v[5] || '').toString() });
    }
  }
  return out; // terbaru dulu
}

module.exports = { LOG_TAB, appendLog, readLog };
