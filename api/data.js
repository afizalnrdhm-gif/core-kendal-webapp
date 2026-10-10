const { getAccessToken, verifyIdToken, SCOPE_DRIVE_META } = require('./_auth');
const { cleanCell } = require('./_sheet');

const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240'];
function bucketIdx(b) { return BUCKET_ORDER.indexOf(b); }

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

// Kolom yang TIDAK dikirim ke akun non-admin (tidak dipakai layar mereka / data internal).
// DESKCALL ditambah kolom identitas yang tidak dibutuhkan untuk telepon (alamat, email CO).
const HIDE_NON_ADMIN = ['CMO', 'CO TAMBAHAN', 'PEKERJAAN KONSUMEN'];
const HIDE_DESKCALL = HIDE_NON_ADMIN.concat(['EMAIL CO', 'ALAMAT', 'KELURAHAN']);
function stripFields(records, hideList) {
  return records.map(r => {
    const c = Object.assign({}, r);
    hideList.forEach(k => { delete c[k]; });
    return c;
  });
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
      v = cleanCell(finalHeader[j], v);
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

// Pesan error untuk browser: pesan yang memang ditulis untuk user diteruskan,
// detail teknis (token, respons Google) cukup di log server.
function publicError(err) {
  const m = (err && err.message) || '';
  if (/Token login|Email belum|Gagal membaca data/.test(m)) return m;
  return 'Terjadi kendala di server. Coba muat ulang, atau hubungi admin kalau terus berulang.';
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

    // ?check=1 -> hanya cek kapan Sheet terakhir diubah (dulu endpoint check-update, digabung supaya slot function lega)
    if (req.query && req.query.check) {
      const driveToken = await getAccessToken(SCOPE_DRIVE_META);
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${process.env.GOOGLE_SHEET_ID}?fields=modifiedTime`, { headers: { Authorization: 'Bearer ' + driveToken } });
      const driveJson = await driveRes.json();
      if (!driveJson.modifiedTime) { console.error('check-update gagal:', JSON.stringify(driveJson)); res.status(500).json({ error: 'Gagal ambil info update.' }); return; }
      res.status(200).json({ modifiedTime: driveJson.modifiedTime });
      return;
    }

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
      console.error('Gagal baca sheet MASTER:', JSON.stringify(masterJson));
      throw new Error('Gagal membaca data dari spreadsheet. Coba lagi sebentar, atau hubungi admin.');
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

    // % pengaruh kontrak ke Flow bucket awalnya (SIPOK / total SIPOK non-fleet bucket awal yang sama).
    // FE: penyebut per CO; selain itu se-cabang. Dihitung di server dari SELURUH data supaya akurat
    // untuk akun non-admin yang hanya menerima sebagian baris.
    (function(){
      const org = {}, perCO = {};
      allRecords.forEach(r => {
        if (r['FLEET/NON FLEET'] === 'FLEET') return;
        const v = typeof r['SIPOK'] === 'number' ? r['SIPOK'] : 0;
        const b = r['BUCKET AWAL'];
        org[b] = (org[b] || 0) + v;
        const k = b + '|' + r['CO ALL'];
        perCO[k] = (perCO[k] || 0) + v;
      });
      allRecords.forEach(r => {
        r['PENGARUH FLOW'] = '';
        if (r['FLEET/NON FLEET'] === 'FLEET') return;
        const v = typeof r['SIPOK'] === 'number' ? r['SIPOK'] : 0;
        const cfg = roleMap[r['CO ALL']];
        const den = (cfg && cfg.role === 'FE') ? perCO[r['BUCKET AWAL'] + '|' + r['CO ALL']] : org[r['BUCKET AWAL']];
        if (den) r['PENGARUH FLOW'] = Math.round(v / den * 10000) / 100;
      });
    })();

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
        email, isAdmin: false, records: stripFields(allRecords, HIDE_DESKCALL), roleInfo: emailRoleCfg, escalations: [],
        generatedAt: new Date().toISOString()
      });
      return;
    }

    const myRecords = allRecords.filter(r => (r['EMAIL CO'] || '').toString().trim().toLowerCase() === email);
    const myName = myRecords.length ? myRecords[0]['CO ALL'] : null;
    const roleCfg = myName ? roleMap[myName] : null;

    const escalations = (roleCfg && roleCfg.role === 'MR') ? computeEscalations() : [];

    res.status(200).json({
      email, isAdmin: false, records: stripFields(myRecords, HIDE_NON_ADMIN), roleInfo: roleCfg, escalations: stripFields(escalations, HIDE_DESKCALL),
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error data:', err && err.message);
    res.status(err.status || 500).json({ error: publicError(err) });
  }
};
