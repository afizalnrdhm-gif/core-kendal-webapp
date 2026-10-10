// Helper bersama untuk semua endpoint: token service account Google, verifikasi login,
// dan pesan error yang aman. File berawalan "_" tidak dihitung Vercel sebagai function.
const crypto = require('crypto');

const SCOPE_SHEETS = 'https://www.googleapis.com/auth/spreadsheets';
const SCOPE_SHEETS_RO = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPE_DRIVE_META = 'https://www.googleapis.com/auth/drive.metadata.readonly';

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Token service account berlaku 1 jam; disimpan selama instance function masih hangat.
const tokenCache = {};
async function getAccessToken(scope) {
  scope = scope || SCOPE_SHEETS;
  const hit = tokenCache[scope];
  if (hit && hit.exp - 120 > Date.now() / 1000) return hit.token;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = { iss: email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claimSet));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + unsigned + '.' + signature
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('Gagal ambil access token service account:', JSON.stringify(data));
    throw new Error('Gagal ambil access token service account.');
  }
  tokenCache[scope] = { token: data.access_token, exp: now + (Number(data.expires_in) || 3600) };
  return data.access_token;
}

function authError(message) { const e = new Error(message); e.status = 401; return e; }

// Hasil verifikasi login disimpan maks 5 menit (dan tidak melewati masa berlaku token).
const idCache = new Map();
async function verifyIdToken(idToken) {
  const nowS = Date.now() / 1000;
  const hit = idCache.get(idToken);
  if (hit && hit.until > nowS) return hit.email;

  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  const data = await res.json();
  if (!data.email || data.aud !== process.env.GOOGLE_CLIENT_ID) throw authError('Token login tidak valid.');
  if (data.email_verified !== 'true' && data.email_verified !== true) throw authError('Email belum terverifikasi Google.');
  const email = data.email.toLowerCase();
  const exp = Number(data.exp) || nowS + 300;
  if (idCache.size > 300) idCache.clear();
  idCache.set(idToken, { email, until: Math.min(exp, nowS + 300) });
  return email;
}

// Pesan error yang aman dikirim ke browser: pesan login apa adanya, sisanya umum (detail ke log Vercel).
function sendError(res, err, fallback) {
  const m = (err && err.message) || String(err);
  const status = (err && err.status) || 500;
  if (status >= 500) console.error(m);
  const pub = status < 500 || /Token login|Email belum/.test(m) ? m : (fallback || 'Terjadi kendala di server. Coba muat ulang, atau hubungi admin kalau terus berulang.');
  res.status(/Token login|Email belum/.test(m) ? 401 : status).json({ error: pub });
}

module.exports = { base64url, getAccessToken, verifyIdToken, sendError, SCOPE_SHEETS, SCOPE_SHEETS_RO, SCOPE_DRIVE_META };
