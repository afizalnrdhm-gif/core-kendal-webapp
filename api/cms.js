const { getAccessToken, sendError, verifyIdToken } = require('./_auth');

// ============================================================
// CMS — Collection Monitoring System (Balance 1-30 & 31-60).
// Meniru logika Excel: PRODUCTIVITY (tarikan sistem) -> MASTER (VLOOKUP) -> PIV CMS -> CMS.
// Data: tab MASTER + tab PRODUCTIVITY (tempel tarikan sistem, header ada di baris yang memuat "Agreement No").
// ============================================================
const BUCKET_ORDER = ['NO OD', 'P001_030', 'P031_060', 'P061_090', 'P091_120', 'P121_150', 'P151_180', 'P181_210', 'P211_240', 'P241_270'];
const BUCKET_FROM_OD = [[1, 'P001_030'], [31, 'P031_060'], [61, 'P061_090'], [91, 'P091_120'], [121, 'P121_150'], [151, 'P151_180'], [181, 'P181_210'], [211, 'P211_240'], [241, 'P241_270']];
const RC_OK = ['A', 'B', 'C', 'D', 'E', 'F'];
const AC_BERTEMU = ['JB', 'BYR', 'SBY', 'STB', 'TRB'];
const AC_TIDAK = ['KPR', 'KTD', 'TKK', 'TTP'];
// Balance: bucket aktual yang dilihat & PIC yang membentuk DKH (1-30 oleh FE, 31-60 oleh MR)
const BALANCES = [{ id: 'b1', bucket: 'P001_030', pic: 'FE', judul: 'BALANCE 1-30' }, { id: 'b2', bucket: 'P031_060', pic: 'MR', judul: 'BALANCE 31-60' }];

function bucketFromOd(od) {
  let b = 'NO OD';
  BUCKET_FROM_OD.forEach(([t, n]) => { if (od >= t) b = n; });
  return b;
}
function clean(v) {
  if (v === undefined || v === null) return '';
  let s = String(v).trim();
  const m = s.match(/^="(.*)"$/); if (m) s = m[1];
  return s;
}
function toMs(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v > 20000 ? Math.round((v - 25569) * 86400000) : null;
  const s = clean(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function isoDay(ms) { return ms === null ? '' : new Date(ms).toISOString().slice(0, 10); }
// MASTER Google menulis 'NOOD', Excel menulis 'NO OD' -> samakan
function normBucket(b) { const u = String(b || '').trim().toUpperCase(); return u.replace(/\s+/g, '') === 'NOOD' ? 'NO OD' : u; }
function idxOf(header, name) { return header.findIndex(h => clean(h).toUpperCase() === name); }
function firstWord(v) { return clean(v).split('|')[0].trim().toUpperCase(); }

function compute(masterValues, prodValues, cfgRows) {
  const meta = { kolomHilang: [], peringatan: [] };
  const mh = (masterValues[0] || []).map(clean);
  const iK = idxOf(mh, 'NO KONTRAK'), iNama = idxOf(mh, 'NAMA KONSUMEN'), iAwal = idxOf(mh, 'BUCKET AWAL'), iCoAll = idxOf(mh, 'CO ALL');
  let iOd = idxOf(mh, 'OD KA'); meta.odSumber = 'OD KA';
  if (iOd === -1) { iOd = idxOf(mh, 'DPD'); meta.odSumber = 'DPD'; }
  let iCoFe = idxOf(mh, 'CO FE'); meta.coFeAda = iCoFe > -1;
  if (iCoFe === -1) iCoFe = iCoAll;
  if (iK === -1) meta.kolomHilang.push('MASTER: NO KONTRAK');
  if (iAwal === -1) meta.kolomHilang.push('MASTER: BUCKET AWAL');
  if (iOd === -1) { meta.kolomHilang.push('MASTER: OD KA (atau DPD)'); meta.odSumber = ''; }
  if (iCoFe === -1) meta.kolomHilang.push('MASTER: CO FE (atau CO ALL)');
  if (!meta.coFeAda && iCoFe > -1) meta.peringatan.push('Kolom CO FE tidak ada di MASTER, pakai CO ALL. Kontrak milik MR yang turun ke bucket 1-30 bisa terhitung di CO yang salah.');

  // PRODUCTIVITY: cari baris header, pilih baris TERBARU (tanggal tagihan terbesar) per kontrak
  let hRow = -1;
  for (let r = 0; r < Math.min(8, prodValues.length); r++) if ((prodValues[r] || []).some(c => clean(c).toUpperCase() === 'AGREEMENT NO')) { hRow = r; break; }
  const ph = hRow > -1 ? prodValues[hRow].map(clean) : [];
  const pA = idxOf(ph, 'AGREEMENT NO'), pTagih = idxOf(ph, 'TANGGAL TAGIHAN'), pJt = idxOf(ph, 'JATUH TEMPO'), pRisk = idxOf(ph, 'RISK CODE'), pAct = idxOf(ph, 'ACTION CODE'), pStatus = idxOf(ph, 'STATUS TASK');
  if (hRow === -1) meta.kolomHilang.push('PRODUCTIVITY: baris judul (Agreement No) tidak ditemukan');
  else [['AGREEMENT NO', pA], ['TANGGAL TAGIHAN', pTagih], ['JATUH TEMPO', pJt], ['RISK CODE', pRisk], ['ACTION CODE', pAct]].forEach(([n, i]) => { if (i === -1) meta.kolomHilang.push('PRODUCTIVITY: ' + n); });
  const prod = {}; let prodBaris = 0, tglMax = null;
  if (hRow > -1 && pA > -1) {
    for (let r = hRow + 1; r < prodValues.length; r++) {
      const v = prodValues[r] || []; const k = clean(v[pA]); if (!k) continue;
      prodBaris++;
      const tg = pTagih > -1 ? toMs(v[pTagih]) : null, jt = pJt > -1 ? toMs(v[pJt]) : null;
      if (tg !== null && (tglMax === null || tg > tglMax)) tglMax = tg;
      const cur = prod[k];
      if (!cur || (tg !== null && (cur.tg === null || tg > cur.tg))) {
        prod[k] = { tg, dpd: (tg !== null && jt !== null) ? Math.round((tg - jt) / 86400000) : null,
          rc: pRisk > -1 ? firstWord(v[pRisk]) : '', ac: pAct > -1 ? firstWord(v[pAct]) : '', status: pStatus > -1 ? clean(v[pStatus]).toUpperCase() : '' };
      }
    }
  }
  meta.prodBaris = prodBaris; meta.prodKontrak = Object.keys(prod).length; meta.tglTagihanTerbaru = isoDay(tglMax);

  const items = []; let masterBaris = 0, tanpaOD = 0, tanpaTask = 0;
  if (iK > -1) {
    for (let r = 1; r < masterValues.length; r++) {
      const v = masterValues[r] || []; const k = clean(v[iK]); if (!k) continue;
      masterBaris++;
      const awal = iAwal > -1 ? normBucket(clean(v[iAwal])) : '';
      const odRaw = iOd > -1 ? v[iOd] : null;
      const od = (typeof odRaw === 'number') ? odRaw : (clean(odRaw) !== '' && isFinite(Number(clean(odRaw))) ? Number(clean(odRaw)) : null);
      const aktual = od === null ? null : bucketFromOd(od);
      if (od === null) tanpaOD++;
      const co = clean(v[iCoFe]) || '-';
      const p = prod[k];
      const pic = p && p.dpd !== null ? (p.dpd > 30 ? 'MR' : 'FE') : '0';
      const rc = p && RC_OK.indexOf(p.rc) > -1 ? p.rc : '';
      const ac = p && (AC_BERTEMU.indexOf(p.ac) > -1 || AC_TIDAK.indexOf(p.ac) > -1) ? p.ac : '';
      const tags = [];
      const add = (bal, metric) => { tags.push(bal.id + '|' + co + '|' + metric); tags.push(bal.id + '|*|' + metric); };
      let kr = '';
      BALANCES.forEach(bal => {
        if (awal === bal.bucket) add(bal, 'awal');
        if (aktual !== bal.bucket) return;
        add(bal, 'actual');
        const terbentuk = pic === bal.pic;
        const iA = BUCKET_ORDER.indexOf(awal), iB = BUCKET_ORDER.indexOf(aktual);
        if (!terbentuk) {
          if (iA > -1) { kr = iB === iA ? 'stay' : (iB < iA ? 'rollback' : 'flow'); add(bal, 'ttl'); add(bal, kr); }
          return;
        }
        // terbentuk = actual - (tidak terbentuk yang punya kriteria) -> kontrak "tidak terbentuk" tanpa bucket awal valid ikut terhitung (sama dengan Excel)
        add(bal, 'terbentuk');
        if (!p) tanpaTask++;
        if (rc) {
          add(bal, 'dikerjakan'); add(bal, 'rc' + rc);
          if (ac) { add(bal, 'ac' + ac); add(bal, AC_BERTEMU.indexOf(ac) > -1 ? 'bertemu' : 'tidakbertemu'); }
        }
      });
      if (!tags.length) continue;
      // kontrak "tidak terbentuk" tanpa kriteria valid tetap terhitung terbentuk
      BALANCES.forEach(bal => {
        if (aktual === bal.bucket && pic !== bal.pic && BUCKET_ORDER.indexOf(awal) === -1) { tags.push(bal.id + '|' + co + '|terbentuk'); tags.push(bal.id + '|*|terbentuk'); }
      });
      items.push({ k, n: iNama > -1 ? clean(v[iNama]) : '', co, ba: awal, bu: aktual || '', kr, pic, rc, ac, od, tg: p ? isoDay(p.tg) : '', st: p ? p.status : '', t: tags });
    }
  }
  meta.masterBaris = masterBaris; meta.kontrakTanpaOD = tanpaOD; meta.terbentukTanpaTask = tanpaTask;
  if (prodBaris > 0 && meta.prodKontrak < prodBaris * 0.9) meta.info = 'Satu kontrak bisa punya beberapa baris tugas. Yang dipakai: baris dengan Tanggal Tagihan paling baru.';

  // urutan CO: FE dari CONFIG_ROLE, MR terpisah
  const feNames = [], mrNames = [];
  (cfgRows || []).forEach(r => { const role = clean(r['ROLE']).toUpperCase(), n = clean(r['NAMA_CO']); if (role === 'FE' && n) feNames.push(n); if (role === 'MR' && n) mrNames.push(n); });
  const dataCo = [...new Set(items.map(i => i.co))];
  dataCo.forEach(c => { if (feNames.indexOf(c) === -1 && c !== '-') feNames.push(c); });
  return { items, meta, urutan: { fe: feNames, mr: mrNames[0] || 'MR' }, balances: BALANCES };
}

async function fetchRange(sheetId, name, accessToken) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(name)}?valueRenderOption=UNFORMATTED_VALUE`, { headers: { Authorization: 'Bearer ' + accessToken } });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, values: j.values || [] };
}

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) { res.status(401).json({ error: 'Token login tidak ditemukan. Silakan login ulang.' }); return; }
    const email = await verifyIdToken(idToken);
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase());
    if (adminEmails.indexOf(email) === -1) { res.status(403).json({ error: 'Menu ini khusus admin/head.' }); return; }

    const accessToken = await getAccessToken();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const [master, prod, cfg] = await Promise.all([
      fetchRange(sheetId, 'MASTER', accessToken), fetchRange(sheetId, 'PRODUCTIVITY', accessToken), fetchRange(sheetId, 'CONFIG_ROLE', accessToken)
    ]);
    if (!master.ok || !master.values.length) { res.status(500).json({ error: 'Data MASTER belum bisa dibaca. Coba lagi sebentar.' }); return; }
    if (!prod.ok || !prod.values.length) {
      res.status(200).json({ tersedia: false, pesan: 'Tab PRODUCTIVITY belum ada atau masih kosong. Buat tab bernama PRODUCTIVITY lalu tempel tarikan sistem (judul kolom "Agreement No" dst).' });
      return;
    }
    const cfgHeader = (cfg.values[0] || []).map(clean);
    const cfgRows = cfg.values.slice(1).map(v => { const o = {}; cfgHeader.forEach((h, i) => { o[h] = v[i]; }); return o; });
    const out = compute(master.values, prod.values, cfgRows);
    res.status(200).json(Object.assign({ tersedia: true, generatedAt: new Date().toISOString() }, out));
  } catch (err) {
    console.error('Error cms:', err && err.message);
    const m = (err && err.message) || '';
    sendError(res, err, 'Gagal memuat CMS.');
  }
};
module.exports.compute = compute;
