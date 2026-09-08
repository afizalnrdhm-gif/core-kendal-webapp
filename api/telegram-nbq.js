const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const sharp = require('sharp');

// ============================================================
// AUTH KE GOOGLE SHEETS (sama pola dengan endpoint lain)
// ============================================================
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claimSet));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = unsigned + '.' + signature;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gagal ambil access token: ' + JSON.stringify(data));
  return data.access_token;
}

function parseSheetValues(values) {
  if (!values || !values.length) return [];
  const header = values[0];
  const seen = {}; const keepIdx = [];
  header.forEach((h, i) => { const hh = (h || '').toString().trim(); if (seen[hh]) return; seen[hh] = true; keepIdx.push(i); });
  const finalHeader = keepIdx.map(i => (header[i] || '').toString().trim());
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const raw = values[r] || [];
    const rec = {};
    keepIdx.forEach((idx, j) => { let v = raw[idx]; if (typeof v === 'string') v = v.trim(); rec[finalHeader[j]] = v === undefined ? '' : v; });
    rows.push(rec);
  }
  return rows;
}

// ============================================================
// NAMA CO — alias command -> nama lengkap di sheet
// ============================================================
const CO_ALIAS = {
  rahul: 'ACHMAD RAHUL HIDAYAT',
  ulil: 'MOHAMAD IZZA ULIL WAFA',
  sigit: 'SIGIT KURNIAWAN'
};

// ============================================================
// TANGGAL WIB — rentang Jatuh Tempo (tgl 3 s/d H-1)
// ============================================================
function getWibDateParts() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { year: wib.getUTCFullYear(), month: wib.getUTCMonth(), day: wib.getUTCDate() };
}
function toIsoDate(y, m, d) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}
function getJatuhTempoRange() {
  const { year, month, day } = getWibDateParts();
  return { start: toIsoDate(year, month, 3), end: toIsoDate(year, month, day - 1) };
}
function fmtTanggalIndo(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${d} ${bulan[m - 1]} ${y}`;
}

// ============================================================
// PARSING COMMAND
// ============================================================
function parseCommand(text) {
  const t = (text || '').trim();
  const parts = t.split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase().replace(/@\w+$/, '');
  const arg = (parts[1] || '').toLowerCase();

  if (cmd === '/fpd') return { type: 'mob', mobList: [1], title: 'FPD (First Payment Default)' };
  if (cmd === '/spd') return { type: 'mob', mobList: [2], title: 'SPD (Second Payment Default)' };
  if (cmd !== '/nbq') return null;

  if (CO_ALIAS[arg]) return { type: 'co', co: CO_ALIAS[arg], title: 'NBQ — ' + CO_ALIAS[arg] };
  if (arg === 'mobilku') return { type: 'gp', gpList: ['MOBILKU'], title: 'NBQ — Group Product MOBILKU' };
  if (arg === 'motorku') return { type: 'gp', gpList: ['MOTORKU'], title: 'NBQ — Group Product MOTORKU' };
  if (arg === 'nb') return { type: 'gp', gpList: ['HONDA', 'YAMAHA'], title: 'NBQ — Group Product HONDA & YAMAHA' };

  const rangeMatch = arg.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10), to = parseInt(rangeMatch[2], 10);
    const mobList = [];
    for (let i = from; i <= to; i++) mobList.push(i);
    return { type: 'mob', mobList, title: `NBQ — MOB ${from}-${to}` };
  }
  return { type: 'invalid' };
}

function nbqNum(rec) {
  const v = (rec['NBQ'] || '').toString().trim();
  const m = v.match(/^(\d+)\s*MOB$/i);
  return m ? parseInt(m[1], 10) : null;
}

// ============================================================
// GENERATE GAMBAR TABEL (Satori -> SVG -> PNG)
// ============================================================
let FONT_CACHE = null;
function loadFonts() {
  if (FONT_CACHE) return FONT_CACHE;
  FONT_CACHE = [
    { name: 'PJS', data: fs.readFileSync(path.join(__dirname, 'PJS-Regular.woff')), weight: 400, style: 'normal' },
    { name: 'PJS', data: fs.readFileSync(path.join(__dirname, 'PJS-SemiBold.woff')), weight: 600, style: 'normal' },
    { name: 'PJS', data: fs.readFileSync(path.join(__dirname, 'PJS-Bold.woff')), weight: 700, style: 'normal' }
  ];
  return FONT_CACHE;
}

const COLS = [
  { key: 'NO KONTRAK', label: 'No Kontrak', width: 145 },
  { key: 'NAMA KONSUMEN', label: 'Nama Konsumen', width: 165, bold: true },
  { key: 'KELURAHAN', label: 'Kelurahan', width: 130 },
  { key: 'KECAMATAN', label: 'Kecamatan', width: 100 },
  { key: 'NO HP', label: 'No HP', width: 105 },
  { key: 'NBQ', label: 'MOB', width: 65 },
  { key: 'STATUS NBQ', label: 'Status NBQ', width: 120 },
  { key: 'DPD', label: 'DPD', width: 55, danger: true },
  { key: 'GROUP PRODUCT', label: 'Group Product', width: 105 },
  { key: 'CMO', label: 'CMO', width: 150 }
];

function cellDiv(text, width, opts) {
  opts = opts || {};
  return {
    type: 'div',
    props: {
      style: {
        width, padding: '9px 7px', fontSize: 12.5, display: 'flex',
        color: opts.color || '#1A2530', fontWeight: opts.weight || 400,
        overflow: 'hidden', whiteSpace: 'nowrap'
      },
      children: text === '' || text == null ? '-' : String(text)
    }
  };
}

async function renderTableImage(title, subtitle, rows) {
  const totalWidth = COLS.reduce((s, c) => s + c.width, 0) + 40;

  const headerRow = {
    type: 'div', props: {
      style: { display: 'flex', background: '#0B3D62', color: '#fff' },
      children: COLS.map(c => cellDiv(c.label, c.width, { weight: 700, color: '#fff' }))
    }
  };
  const bodyRows = rows.map((r, idx) => ({
    type: 'div', props: {
      style: { display: 'flex', background: idx % 2 === 0 ? '#ffffff' : '#F5F8FA', borderBottom: '1px solid #E2E9EE' },
      children: COLS.map(c => cellDiv(r[c.key], c.width, { weight: c.bold ? 600 : 400, color: c.danger ? '#B23B2E' : undefined }))
    }
  }));

  const tree = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', width: totalWidth, background: '#fff', padding: 22, fontFamily: 'PJS' },
      children: [
        { type: 'div', props: { style: { fontSize: 21, fontWeight: 700, color: '#0B3D62' }, children: title } },
        { type: 'div', props: { style: { fontSize: 12.5, color: '#66798A', marginTop: 4, marginBottom: 16 }, children: subtitle } },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'column', border: '1px solid #E2E9EE', borderRadius: 8, overflow: 'hidden' }, children: [headerRow, ...bodyRows] } },
        { type: 'div', props: { style: { fontSize: 10.5, color: '#9AA7B0', marginTop: 12 }, children: `Total: ${rows.length} kontrak` } }
      ]
    }
  };

  const svg = await satori(tree, { width: totalWidth, fonts: loadFonts() });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}

// ============================================================
// KIRIM KE TELEGRAM
// ============================================================
async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function sendTelegramPhoto(chatId, pngBuffer) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([pngBuffer], { type: 'image/png' }), 'nbq.png');
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
}

function serialToDateStr(serial) {
  if (typeof serial !== 'number' || serial < 1000) return '';
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ============================================================
// HANDLER UTAMA
// PENTING: response cuma dikirim SETELAH semua proses (termasuk kirim ke
// Telegram) selesai — supaya function-nya nggak dihentikan paksa duluan.
// ============================================================
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') { res.status(200).json({ ok: true }); return; }
    let update = req.body;
    if (typeof update === 'string') { try { update = JSON.parse(update); } catch (e) { res.status(200).json({ ok: true }); return; } }

    const msg = update && update.message;
    if (!msg || !msg.text) { res.status(200).json({ ok: true }); return; }
    const chatId = msg.chat.id;

    const parsed = parseCommand(msg.text);
    if (!parsed) { res.status(200).json({ ok: true }); return; }

    if (parsed.type === 'invalid') {
      await sendTelegramMessage(chatId, 'Command tidak dikenali. Coba: /nbq rahul, /nbq ulil, /nbq mobilku, /nbq motorku, /nbq nb, /nbq 1-3, /nbq 1-6, /nbq 1-9, /fpd, /spd');
      res.status(200).json({ ok: true });
      return;
    }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const masterRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const masterJson = await masterRes.json();
    if (!masterJson.values) { await sendTelegramMessage(chatId, 'Gagal ambil data sheet.'); res.status(200).json({ ok: true }); return; }

    const allRows = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
    allRows.forEach(r => { r['JATUH TEMPO'] = serialToDateStr(r['JATUH TEMPO']); });

    const { start, end } = getJatuhTempoRange();

    let rows = allRows.filter(m =>
      m['FLEET/NON FLEET'] !== 'FLEET' &&
      m['BUCKET AWAL'] === 'NOOD' &&
      (m['KRITERIA ACCT'] || '').toString().trim().toUpperCase() === 'FLOW' &&
      nbqNum(m) !== null && nbqNum(m) <= 12 &&
      m['JATUH TEMPO'] >= start && m['JATUH TEMPO'] <= end
    );

    if (parsed.type === 'co') rows = rows.filter(m => m['CO ALL'] === parsed.co);
    else if (parsed.type === 'gp') rows = rows.filter(m => parsed.gpList.includes((m['GROUP PRODUCT'] || '').toString().trim().toUpperCase()));
    else if (parsed.type === 'mob') rows = rows.filter(m => parsed.mobList.includes(nbqNum(m)));

    rows.sort((a, b) => (typeof b['DPD'] === 'number' ? b['DPD'] : 0) - (typeof a['DPD'] === 'number' ? a['DPD'] : 0));

    if (rows.length === 0) {
      await sendTelegramMessage(chatId, `${parsed.title} sudah bayar semua ✅`);
      res.status(200).json({ ok: true });
      return;
    }

    const subtitle = `Jatuh Tempo: ${fmtTanggalIndo(start)} – ${fmtTanggalIndo(end)}`;
    const png = await renderTableImage(parsed.title, subtitle, rows);
    await sendTelegramPhoto(chatId, png);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.log('Error telegram-nbq:', err.message);
    try { res.status(200).json({ ok: true }); } catch (e) {}
  }
};
