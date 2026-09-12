const crypto = require('crypto');

const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240'];
function bucketIdx(b) { return BUCKET_ORDER.indexOf(b); }

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Tukar kredensial Service Account jadi access token, tanpa library eksternal.
async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claimSet));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = unsigned + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gagal ambil access token service account: ' + JSON.stringify(data));
  return data.access_token;
}

// Verifikasi ID token yang dikirim dari tombol "Sign in with Google" di browser.
async function verifyIdToken(idToken) {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  const data = await res.json();
  if (!data.email || data.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Token login tidak valid.');
  }
  if (data.email_verified !== 'true' && data.email_verified !== true) {
    throw new Error('Email belum terverifikasi Google.');
  }
  return data.email.toLowerCase();
}

function serialToDateStr(serial) {
  if (typeof serial !== 'number' || serial < 1000) return '';
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const y = dateInfo.getUTCFullYear();
  const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dateInfo.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DATE_FIELDS = new Set(['JATUH TEMPO', 'TANGGAL BAYAR BULAN LALU']);

function parseSheetValues(values, headerRowIndex) {
  headerRowIndex = headerRowIndex || 0;
  if (!values || values.length <= headerRowIndex) return [];
  const header = values[headerRowIndex];
  const seen = {};
  const keepIdx = [];
  header.forEach((h, i) => {
    const hh = (h || '').toString().trim();
    if (seen[hh]) return;
    seen[hh] = true;
    keepIdx.push(i);
  });
  const finalHeader = keepIdx.map(i => (header[i] || '').toString().trim());
  const rows = [];
  for (let r = headerRowIndex + 1; r < values.length; r++) {
    const raw = values[r] || [];
    const rec = {};
    keepIdx.forEach((idx, j) => {
      let v = raw[idx];
      if (typeof v === 'string') v = v.trim();
      const colName = finalHeader[j];
      if (DATE_FIELDS.has(colName) && typeof v === 'number') {
        v = serialToDateStr(v);
      }
      rec[colName] = v === undefined ? '' : v;
    });
    rec['_rowNumber'] = r + 1;
    if (rec['NO KONTRAK'] || finalHeader.indexOf('NO KONTRAK') === -1) rows.push(rec);
  }
  return rows;
}

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) {
      res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' });
      return;
    }
    const email = await verifyIdToken(idToken);

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    const [masterRes, roleRes, kaRes] = await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/MASTER?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/CONFIG_ROLE?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('KA HARIAN')}?valueRenderOption=UNFORMATTED_VALUE`, {
        headers: { Authorization: 'Bearer ' + accessToken }
      })
    ]);
    const masterJson = await masterRes.json();
    const roleJson = await roleRes.json();
    const kaJson = await kaRes.json();

    if (!masterJson.values) {
      throw new Error('Gagal baca sheet MASTER: ' + JSON.stringify(masterJson));
    }

    const allRecords = parseSheetValues(masterJson.values).filter(r => r['NO KONTRAK']);
    const roleRows = parseSheetValues(roleJson.values || []);
    const roleMap = {};
    const roleByEmail = {};
    roleRows.forEach(r => {
      const cfg = {
        role: r['ROLE'],
        penyelesaian: (r['BUCKET_PENYELESAIAN'] || '').split(',').map(x => x.trim()),
        asalFlow: (r['BUCKET_ASAL_FLOW'] || '').split(',').map(x => x.trim())
      };
      if (r['NAMA_CO']) roleMap[r['NAMA_CO']] = cfg;
      if (r['EMAIL']) {
        // Normalisasi role (uppercase+trim) khusus di sini, biar deteksi DESKCALL gak sensitif
        // huruf besar/kecil pas ditulis di sheet — tanpa ubah cfg asli yang dipakai roleMap (MR/FE/BCH).
        const cfgByEmail = Object.assign({}, cfg, { role: (r['ROLE'] || '').toString().trim().toUpperCase() });
        roleByEmail[r['EMAIL'].toString().trim().toLowerCase()] = cfgByEmail;
      }
    });

    // KA HARIAN: header ada di baris ke-16 (index 15)
    const kaRows = kaJson.values ? parseSheetValues(kaJson.values, 15) : [];
    const petaKA = {};
    kaRows.forEach(r => { if (r['NO KONTRAK']) petaKA[r['NO KONTRAK']] = r; });

    // Tempelkan STATUS EVER ke tiap kontrak yang berada di bucket "penyelesaian" milik role-nya sendiri
    allRecords.forEach(m => {
      const roleCfg = roleMap[m['CO ALL']];
      m['STATUS EVER'] = '';
      if (!roleCfg) return;
      const targetBucket = roleCfg.penyelesaian[0];
      if (m['BUCKET AWAL'] !== targetBucket) return;
      const ka = petaKA[m['NO KONTRAK']];
      if (!ka || !ka['FLOW EVER']) return;
      m['STATUS EVER'] = bucketIdx(ka['FLOW EVER']) > bucketIdx(targetBucket) ? 'SUDAH EVER' : 'BELUM EVER';
    });

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    const isAdmin = adminEmails.indexOf(email) > -1;

    function computeEscalations() {
      const mrEntry = Object.values(roleMap).find(r => r.role === 'MR');
      if (!mrEntry) return [];
      const asal = mrEntry.asalFlow[0];
      return allRecords.filter(r =>
        r['BUCKET AWAL'] === asal &&
        typeof r['DPD'] === 'number' && r['DPD'] > 31 &&
        ['SUDAH BAYAR', 'LUNAS'].indexOf((r['STATUS BAYAR'] || '').toString().toUpperCase()) === -1
      );
    }

    if (isAdmin) {
      res.status(200).json({
        email, isAdmin: true, records: allRecords, roleInfo: null, escalations: computeEscalations(),
        generatedAt: new Date().toISOString()
      });
      return;
    }

    // DESKCALL: bukan CO (tidak punya kontrak atas nama sendiri), dikenali via EMAIL di CONFIG_ROLE.
    // Dapat akses ke seluruh data (kayak admin) tapi menu di frontend dibatasi (lihat index.html).
    const emailRoleCfg = roleByEmail[email];
    if (emailRoleCfg && (emailRoleCfg.role || '').toString().trim().toUpperCase() === 'DESKCALL') {
      res.status(200).json({
        email, isAdmin: false, records: allRecords, roleInfo: emailRoleCfg, escalations: [],
        generatedAt: new Date().toISOString()
      });
      return;
    }

    const myRecords = allRecords.filter(r => (r['EMAIL CO'] || '').toString().trim().toLowerCase() === email);
    const myName = myRecords.length ? myRecords[0]['CO ALL'] : null;
    const roleCfg = myName ? roleMap[myName] : null;

    const escalations = (roleCfg && roleCfg.role === 'MR') ? computeEscalations() : [];

    res.status(200).json({
      email, isAdmin: false, records: myRecords, roleInfo: roleCfg, escalations,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
