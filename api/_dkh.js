// Usulan DKH: CO memilih 12–15 kontrak balance (FE = BUCKET UPDATE 1-30, MR = 31-60) untuk dikunjungi besok.
// Admin/head melihat usulan semua CO lalu meng-assign ke DKH hari berikutnya.
// Tab (dibuat otomatis): USULAN_DKH (append-only, batch terbaru per CO+tanggal yang berlaku) dan DKH_ASSIGN (append-only, baris terbaru per tanggal+kontrak yang berlaku).
// File berawalan "_" tidak dihitung Vercel sebagai function.
const { cleanCell } = require('./_sheet');

const MIN = 12, MAX = 15, TARGET_DKH = 15;
const TAB_USUL = 'USULAN_DKH', TAB_ASSIGN = 'DKH_ASSIGN';
const H_USUL = ['UNTUK_TANGGAL', 'CO', 'EMAIL', 'ROLE', 'NO_KONTRAK', 'NAMA', 'SIPOK', 'BUCKET', 'BATCH', 'WAKTU'];
const H_ASSIGN = ['UNTUK_TANGGAL', 'CO', 'ROLE', 'NO_KONTRAK', 'NAMA', 'SIPOK', 'STATUS', 'OLEH', 'WAKTU'];
const BUCKET_ROLE = { FE: 'P001_030', MR: 'P031_060' };
const URUT = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210','P211_240'];
const ASAL_FLOW = { FE: 'NOOD', MR: 'P001_030' };
const safe = v => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };

async function sf(url, token, opts) {
  const res = await fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, opts || {}));
  let json = {}; try { json = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, json };
}
const BASE = id => 'https://sheets.googleapis.com/v4/spreadsheets/' + id;

function waktuWIB() { return new Date(Date.now() + 7 * 3600 * 1000); }
function tglStr(d) { return d.toISOString().slice(0, 10); }
// Tanggal "besok" menurut WIB
function besok() { return tglStr(new Date(waktuWIB().getTime() + 86400000)); }
const tglValid = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function hariDariCell(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    if (v >= 1 && v <= 31) return Math.floor(v);
    if (v > 1000) return new Date(Math.floor(v - 25569) * 86400000).getUTCDate();
    return 0;
  }
  const s = String(v).trim();
  let mt = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (mt) return parseInt(mt[3], 10);
  mt = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (mt) return parseInt(mt[1], 10);
  const n = parseInt(s, 10); return n >= 1 && n <= 31 ? n : 0;
}

function toMs(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return v > 20000 ? Math.round((v - 25569) * 86400000) : null;
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function labelTgl(ms) { const d = new Date(ms); return d.getUTCDate() + ' ' + BLN[d.getUTCMonth()]; }

// Berapa kali tiap kontrak terbentuk DKH = jumlah baris di tab PRODUCTIVITY (tarikan sistem, header "Agreement No"; kalau ada kolom
// TANGGAL TAGIHAN dihitung per tanggal berbeda). Mengembalikan Map noKontrak -> jumlah; null kalau tab belum ada/kosong.
async function bacaPernahTerbentuk(token, sheetId) {
  const r = await sf(BASE(sheetId) + '/values/' + encodeURIComponent('PRODUCTIVITY') + '?valueRenderOption=UNFORMATTED_VALUE', token);
  const v = r.ok && r.json.values ? r.json.values : [];
  let h = -1;
  for (let i = 0; i < Math.min(8, v.length); i++) if ((v[i] || []).some(c => String(c == null ? '' : c).trim().toUpperCase() === 'AGREEMENT NO')) { h = i; break; }
  if (h === -1) return null;
  const hdr = v[h].map(c => String(c == null ? '' : c).trim().toUpperCase());
  const idx = hdr.indexOf('AGREEMENT NO'), iTgl = hdr.indexOf('TANGGAL TAGIHAN');
  const uniq = {};
  for (let i = h + 1; i < v.length; i++) {
    let k = String((v[i] || [])[idx] == null ? '' : v[i][idx]).trim(); const m = k.match(/^="(.*)"$/); if (m) k = m[1];
    if (!k) continue;
    const t = iTgl > -1 ? String((v[i] || [])[iTgl] == null ? '' : v[i][iTgl]).trim() : String(i);
    (uniq[k] = uniq[k] || new Set()).add(t);
  }
  const peta = new Map();
  Object.keys(uniq).forEach(k => peta.set(k, uniq[k].size));
  return peta;
}
const kaliDKH = (pernah, no) => (pernah ? (pernah.get ? (pernah.get(String(no)) || 0) : (pernah.has(String(no)) ? 1 : 0)) : null);

function parse(values) {
  const header = (values[0] || []).map(h => String(h == null ? '' : h).trim());
  return values.slice(1).map(r => { const o = {}; header.forEach((h, i) => { if (h) o[h] = cleanCell(h, r[i] === undefined ? '' : r[i]); }); return o; });
}

async function bacaTab(token, sheetId, tab) {
  const r = await sf(BASE(sheetId) + '/values/' + encodeURIComponent(tab) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  return r.ok && r.json.values ? parse(r.json.values) : [];
}

// MASTER + FLOW EVER dari KA HARIAN (header baris ke-16), ditempel sebagai r['FLOW EVER'] untuk menentukan "belum ever".
async function bacaMaster(token, sheetId) {
  const [master, ka] = await Promise.all([
    bacaTab(token, sheetId, 'MASTER'),
    sf(BASE(sheetId) + '/values/' + encodeURIComponent('KA HARIAN') + '?valueRenderOption=UNFORMATTED_VALUE', token)
  ]);
  const v = ka.ok && ka.json.values ? ka.json.values : [];
  const hdr = (v[15] || []).map(h => String(h == null ? '' : h).trim());
  const iNo = hdr.indexOf('NO KONTRAK'), iEv = hdr.indexOf('FLOW EVER');
  const peta = {};
  if (iNo > -1 && iEv > -1) for (let i = 16; i < v.length; i++) { const r = v[i] || []; if (r[iNo]) peta[String(r[iNo]).trim()] = String(r[iEv] == null ? '' : r[iEv]).trim(); }
  master.forEach(m => { m['FLOW EVER'] = peta[String(m['NO KONTRAK']).trim()] || ''; });
  return master;
}

async function pastikanTab(token, sheetId, tab, header) {
  const add = await sf(BASE(sheetId) + ':batchUpdate', token, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }) });
  if (add.ok) await sf(BASE(sheetId) + '/values/' + encodeURIComponent(tab + '!A1') + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: [header] }) });
}

async function tambahBaris(token, sheetId, tab, header, rows) {
  if (!rows.length) return;
  await pastikanTab(token, sheetId, tab, header);
  const last = String.fromCharCode(64 + header.length);
  const ap = await sf(BASE(sheetId) + '/values/' + encodeURIComponent(tab + '!A:' + last) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', token, { method: 'POST', body: JSON.stringify({ values: rows }) });
  if (!ap.ok) throw new Error('Gagal menyimpan ke Google Sheet. Coba lagi sebentar.');
}

// Identitas CO dari MASTER (EMAIL CO) + role dari CONFIG_ROLE
function cariCO(master, cfg, email) {
  const mine = master.filter(r => String(r['EMAIL CO'] || '').trim().toLowerCase() === email);
  if (!mine.length) return null;
  const nama = mine[0]['CO ALL'];
  const c = cfg.find(r => r['NAMA_CO'] === nama);
  const role = c ? String(c['ROLE'] || '').trim().toUpperCase() : '';
  // MR memegang balance 31-60 SE-CABANG (kontrak FE yang sudah naik ke 31-60 juga jadi tanggung jawab MR), FE hanya kontraknya sendiri
  return { nama, role, kontrak: role === 'MR' ? master : mine };
}

// Kontrak yang boleh diusulkan: milik CO, bukan FLEET, BUCKET UPDATE masih di bucket balance role-nya, dan SUDAH jatuh tempo
// (JATUH TEMPO <= hari ini WIB; kalau tanggalnya kosong, dianggap jatuh tempo bila DPD > 0). Yang belum jatuh tempo tidak ditampilkan.
function sudahJatuhTempo(r) {
  const jt = toMs(r['JATUH TEMPO']);
  // DPD > 0 = masih menunggak (mis. sudah bayar 1x atau stay, JATUH TEMPO sudah bergeser ke depan) -> tetap tampil.
  if (Number(r['DPD']) > 0) return true;
  if (jt !== null) return jt <= Date.parse(tglStr(waktuWIB()) + 'T00:00:00Z');
  return false;
}
function kandidat(co) {
  const b = BUCKET_ROLE[co.role];
  if (!b) return [];
  // Logika sama dengan KPI Flow: FE = bucket awal NOOD dengan DPD > 0; MR = bucket awal 1-30 dengan DPD >= 31.
  const awal = ASAL_FLOW[co.role], minDpd = co.role === 'MR' ? 31 : 1;
  // Ditambah kontrak BELUM EVER: bucket awal = bucket penyelesaian role-nya (FE 1-30, MR 31-60) dan FLOW EVER belum melewati bucket itu.
  const belumEver = r => r['BUCKET AWAL'] === b && r['FLOW EVER'] && URUT.indexOf(r['FLOW EVER']) > -1 && URUT.indexOf(r['FLOW EVER']) <= URUT.indexOf(b);
  return co.kontrak.filter(r => ((r['BUCKET AWAL'] === awal && Number(r['DPD']) >= minDpd) || belumEver(r)) && r['FLEET/NON FLEET'] !== 'FLEET' && sudahJatuhTempo(r))
    .map(r => ({ jt: toMs(r['JATUH TEMPO']), jh: hariDariCell(r['JANJI BAYAR']), bh: hariDariCell(r['TGL BYR']), noKontrak: String(r['NO KONTRAK']), nama: String(r['NAMA KONSUMEN'] || '-'), sipok: Number(r['SIPOK']) || 0, dpd: r['DPD'] === undefined || r['DPD'] === '' ? null : Number(r['DPD']), janji: r['JANJI BAYAR'] ? String(r['JANJI BAYAR']) : '', proyeksi: r['PROYEKSI'] ? String(r['PROYEKSI']) : '' }))
    .sort((a, c) => c.sipok - a.sipok);
}

function cariCOByNama(master, cfg, nama) {
  const mine = master.filter(r => String(r['CO ALL'] || '') === nama);
  if (!mine.length) return null;
  const c = cfg.find(r => r['NAMA_CO'] === nama);
  const role = c ? String(c['ROLE'] || '').trim().toUpperCase() : '';
  return { nama, role, kontrak: role === 'MR' ? master : mine };
}

// Rekomendasi tambahan untuk DKH tanggal `untuk`: prioritas janji bayar yang jatuh pada/dekat tanggal DKH,
// lalu kontrak yang bulan lalu biasa bayar di sekitar tanggal itu, lalu SIPOK terbesar.
function rekomendasi(kand, dipakai, untuk, pernah) {
  const hari = parseInt(String(untuk).slice(8, 10), 10) || 0;
  const hariIni = Date.parse(tglStr(waktuWIB()) + 'T00:00:00Z');
  const dekat = (h) => h > 0 && h >= hari && h <= hari + 3;
  return kand.filter(x => !dipakai.has(x.noKontrak)).map(x => {
    let grup = 4, alasan = 'SIPOK besar';
    if (pernah && x.jt !== null && x.jt !== undefined && x.jt <= hariIni && !pernah.has(x.noKontrak)) { grup = 0; alasan = 'Jatuh tempo ' + labelTgl(x.jt) + ', belum pernah terbentuk DKH'; }
    else if (dekat(x.jh)) { grup = 1; alasan = 'Janji bayar tgl ' + x.jh; }
    else if (x.bh > 0 && Math.abs(x.bh - hari) <= 2) { grup = 2; alasan = 'Biasa bayar tgl ' + x.bh; }
    else if (x.jh > 0 && x.jh < hari) { grup = 3; alasan = 'Janji tgl ' + x.jh + ' sudah lewat, kejar'; }
    return { noKontrak: x.noKontrak, nama: x.nama, sipok: x.sipok, dpd: x.dpd, alasan, grup, jt: x.jt || 0 };
  }).sort((a, b) => a.grup - b.grup || (a.grup === 0 ? a.jt - b.jt : 0) || b.sipok - a.sipok);
}

// Batch terbaru per CO untuk satu tanggal
function usulanTerbaru(rows, untuk) {
  const per = {};
  rows.filter(r => String(r['UNTUK_TANGGAL']) === untuk).forEach(r => {
    const co = String(r['CO']); const b = String(r['BATCH']);
    if (!per[co] || b > per[co].batch) per[co] = { batch: b, waktu: String(r['WAKTU'] || ''), role: String(r['ROLE'] || ''), email: String(r['EMAIL'] || ''), kontrak: [] };
  });
  rows.filter(r => String(r['UNTUK_TANGGAL']) === untuk).forEach(r => {
    const p = per[String(r['CO'])];
    if (p && String(r['BATCH']) === p.batch) p.kontrak.push({ noKontrak: String(r['NO_KONTRAK']), nama: String(r['NAMA'] || '-'), sipok: Number(r['SIPOK']) || 0 });
  });
  return per;
}

// Status assign terbaru per kontrak untuk satu tanggal → { noKontrak: {status, oleh} }
function statusAssign(rows, untuk) {
  const out = {};
  rows.forEach(r => { if (String(r['UNTUK_TANGGAL']) === untuk) out[String(r['NO_KONTRAK'])] = { status: String(r['STATUS']), oleh: String(r['OLEH'] || ''), waktu: String(r['WAKTU'] || ''), co: String(r['CO'] || ''), role: String(r['ROLE'] || ''), nama: String(r['NAMA'] || '-'), sipok: Number(r['SIPOK']) || 0 }; });
  return out;
}

// ---- Handler dipanggil dari cms.js ----
async function tangani(req, res, ctx) {
  const { email, token, sheetId, isAdmin, mode } = ctx;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const untukDefault = besok();

  if (mode === 'saya') {
    const [master, cfg, usul, asg] = await Promise.all([bacaMaster(token, sheetId), bacaTab(token, sheetId, 'CONFIG_ROLE'), bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN)]);
    const co = cariCO(master, cfg, email);
    if (!co) { res.status(200).json({ bisa: false, pesan: 'Akun ini tidak terdaftar sebagai CO di data MASTER.' }); return; }
    if (!BUCKET_ROLE[co.role]) { res.status(200).json({ bisa: false, pesan: 'Usulan DKH hanya untuk CO Front End dan Mid Range.' }); return; }
    const untuk = untukDefault;
    const k = kandidat(co);
    const sudah = usulanTerbaru(usul, untuk)[co.nama] || null;
    const asgS = statusAssign(asg, untuk);
    res.status(200).json({
      bisa: true, nama: co.nama, role: co.role, bucket: BUCKET_ROLE[co.role], untuk, min: MIN, max: MAX,
      minEfektif: Math.min(MIN, k.length), kandidat: k,
      sudahKirim: sudah ? { waktu: sudah.waktu, kontrak: sudah.kontrak.map(x => Object.assign({}, x, { assign: asgS[x.noKontrak] && asgS[x.noKontrak].status === 'ASSIGN' })) } : null
    });
    return;
  }

  if (mode === 'kirim') {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Metode tidak didukung.' }); return; }
    const pilih = Array.isArray(body.kontrak) ? Array.from(new Set(body.kontrak.map(x => String(x)))) : [];
    const [master, cfg, usul, asg] = await Promise.all([bacaMaster(token, sheetId), bacaTab(token, sheetId, 'CONFIG_ROLE'), bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN)]);
    const co = cariCO(master, cfg, email);
    if (!co || !BUCKET_ROLE[co.role]) { res.status(403).json({ error: 'Akun ini tidak bisa mengirim usulan DKH.' }); return; }
    const k = kandidat(co); const peta = {}; k.forEach(x => { peta[x.noKontrak] = x; });
    const minEf = Math.min(MIN, k.length);
    if (pilih.length < minEf || pilih.length > MAX) { res.status(400).json({ error: 'Pilih minimal ' + minEf + ' dan maksimal ' + MAX + ' kontrak.' }); return; }
    const salah = pilih.filter(n => !peta[n]);
    if (salah.length) { res.status(400).json({ error: 'Ada kontrak yang tidak memenuhi syarat (bukan milikmu atau bucket sudah berubah). Muat ulang halaman lalu pilih lagi.' }); return; }
    const untuk = untukDefault;
    // Kalau admin sudah meng-assign sebagian, usulan tidak boleh diubah lagi
    const lama = usulanTerbaru(usul, untuk)[co.nama];
    const asgS = statusAssign(asg, untuk);
    if (lama && lama.kontrak.some(x => asgS[x.noKontrak] && (asgS[x.noKontrak].status === 'ASSIGN' || asgS[x.noKontrak].status === 'DIBUAT'))) { res.status(409).json({ error: 'Usulan ini sudah mulai di-assign head, jadi tidak bisa diubah lagi.' }); return; }
    const batch = new Date().toISOString(); const waktu = waktuWIB().toISOString().replace('T', ' ').slice(0, 19);
    const rows = pilih.map(n => [untuk, safe(co.nama), email, co.role, safe(n), safe(peta[n].nama), Math.round(peta[n].sipok), BUCKET_ROLE[co.role], batch, waktu]);
    await tambahBaris(token, sheetId, TAB_USUL, H_USUL, rows);
    res.status(200).json({ ok: true, untuk, jumlah: pilih.length });
    return;
  }

  // Silvi (DESKCALL) atau admin/head: melihat daftar yang sudah di-assign head dan menandai yang sudah dibuat di DKH.
  if (mode === 'silvi' || mode === 'selesai') {
    const cfgAkses = await bacaTab(token, sheetId, 'CONFIG_ROLE');
    const deskcall = cfgAkses.some(r => String(r['EMAIL'] || '').trim().toLowerCase() === email && String(r['ROLE'] || '').trim().toUpperCase() === 'DESKCALL');
    if (!isAdmin && !deskcall) { res.status(403).json({ error: 'Menu ini khusus admin DKH.' }); return; }
    if (mode === 'silvi') {
      const untuk = tglValid(req.query && req.query.tanggal) ? req.query.tanggal : untukDefault;
      const [asg, pernah] = await Promise.all([bacaTab(token, sheetId, TAB_ASSIGN), bacaPernahTerbentuk(token, sheetId)]);
      const asgS = statusAssign(asg, untuk);
      const per = {};
      Object.keys(asgS).forEach(no => {
        const a = asgS[no]; if (a.status !== 'ASSIGN' && a.status !== 'DIBUAT') return;
        const c = per[a.co] = per[a.co] || { nama: a.co, role: a.role, kontrak: [] };
        c.kontrak.push({ noKontrak: no, nama: a.nama, sipok: a.sipok, dibuat: a.status === 'DIBUAT', kali: kaliDKH(pernah, no) });
      });
      const co = Object.keys(per).sort().map(k => per[k]);
      const tanggalTersedia = Array.from(new Set(asg.map(r => String(r['UNTUK_TANGGAL'])).filter(tglValid))).sort().reverse().slice(0, 14);
      if (tanggalTersedia.indexOf(untuk) === -1) tanggalTersedia.unshift(untuk);
      res.status(200).json({ untuk, tanggalTersedia, produktivitasAda: !!pernah, co });
      return;
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Metode tidak didukung.' }); return; }
    const untuk = body.untuk, status = body.aksi === 'kembali' ? 'ASSIGN' : 'DIBUAT';
    const daftar = Array.isArray(body.kontrak) ? Array.from(new Set(body.kontrak.map(x => String(x)))).slice(0, 300) : [];
    if (!tglValid(untuk) || !daftar.length) { res.status(400).json({ error: 'Data tidak lengkap.' }); return; }
    const asgS = statusAssign(await bacaTab(token, sheetId, TAB_ASSIGN), untuk);
    const waktu = waktuWIB().toISOString().replace('T', ' ').slice(0, 19);
    const rows = [];
    daftar.forEach(n => { const a = asgS[n]; if (a && (a.status === 'ASSIGN' || a.status === 'DIBUAT')) rows.push([untuk, safe(a.co), a.role, safe(n), safe(a.nama), Math.round(a.sipok), status, email, waktu]); });
    if (!rows.length) { res.status(400).json({ error: 'Kontrak itu belum di-assign head atau sudah dibatalkan.' }); return; }
    await tambahBaris(token, sheetId, TAB_ASSIGN, H_ASSIGN, rows);
    res.status(200).json({ ok: true, jumlah: rows.length, status });
    return;
  }

  // Selanjutnya khusus admin/head
  if (!isAdmin) { res.status(403).json({ error: 'Menu ini khusus admin/head.' }); return; }

  if (mode === 'admin') {
    const untuk = tglValid(req.query && req.query.tanggal) ? req.query.tanggal : untukDefault;
    const [master, cfg, usul, asg, pernah] = await Promise.all([bacaMaster(token, sheetId), bacaTab(token, sheetId, 'CONFIG_ROLE'), bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN), bacaPernahTerbentuk(token, sheetId)]);
    const per = usulanTerbaru(usul, untuk); const asgS = statusAssign(asg, untuk);
    // Bucket kontrak saat ini, supaya terlihat kalau sudah berubah sejak diusulkan
    const bucketNow = {}; master.forEach(r => { bucketNow[String(r['NO KONTRAK'])] = r['BUCKET UPDATE']; });
    const picList = cfg.filter(r => BUCKET_ROLE[String(r['ROLE'] || '').trim().toUpperCase()] && r['NAMA_CO']).map(r => ({ nama: String(r['NAMA_CO']), role: String(r['ROLE']).trim().toUpperCase() }));
    const dataCO = picList.map(p => {
      const u = per[p.nama];
      const kontrak = u ? u.kontrak.map(x => ({ noKontrak: x.noKontrak, nama: x.nama, sipok: x.sipok, bucketSekarang: bucketNow[x.noKontrak] || '', assign: !!(asgS[x.noKontrak] && (asgS[x.noKontrak].status === 'ASSIGN' || asgS[x.noKontrak].status === 'DIBUAT')), dibuat: !!(asgS[x.noKontrak] && asgS[x.noKontrak].status === 'DIBUAT'), kali: kaliDKH(pernah, x.noKontrak), tambahan: false })) : [];
      const ada = new Set(kontrak.map(x => x.noKontrak));
      // Kontrak tambahan dari admin/head (di-assign tapi tidak ada di usulan CO)
      Object.keys(asgS).forEach(no => { const a = asgS[no]; if (a.co === p.nama && (a.status === 'ASSIGN' || a.status === 'DIBUAT') && !ada.has(no)) { kontrak.push({ noKontrak: no, nama: a.nama, sipok: a.sipok, bucketSekarang: bucketNow[no] || '', assign: true, dibuat: a.status === 'DIBUAT', kali: kaliDKH(pernah, no), tambahan: true }); ada.add(no); } });
      const total = kontrak.length;
      const kurang = Math.max(0, TARGET_DKH - total);
      const co = cariCOByNama(master, cfg, p.nama);
      const rek = kurang > 0 && co ? rekomendasi(kandidat(co), ada, untuk, pernah).slice(0, Math.max(kurang + 5, 8)).map(x => Object.assign(x, { kali: kaliDKH(pernah, x.noKontrak) })) : [];
      return { nama: p.nama, role: p.role, sudahKirim: !!u, waktu: u ? u.waktu : '', kontrak, kurang, rekomendasi: rek };
    });
    const tanggalTersedia = Array.from(new Set(usul.map(r => String(r['UNTUK_TANGGAL'])).filter(tglValid))).sort().reverse().slice(0, 14);
    if (tanggalTersedia.indexOf(untuk) === -1) tanggalTersedia.unshift(untuk);
    res.status(200).json({ untuk, tanggalTersedia, target: TARGET_DKH, produktivitasAda: !!pernah, co: dataCO });
    return;
  }

  if (mode === 'assign') {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Metode tidak didukung.' }); return; }
    const untuk = body.untuk, aksi = body.aksi === 'batal' ? 'BATAL' : 'ASSIGN';
    const daftar = Array.isArray(body.kontrak) ? body.kontrak.slice(0, 300) : [];
    if (!tglValid(untuk) || !daftar.length) { res.status(400).json({ error: 'Data assign tidak lengkap.' }); return; }
    const [usul, asgRows] = await Promise.all([bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN)]);
    const per = usulanTerbaru(usul, untuk);
    const sah = {};
    const asgS0 = statusAssign(asgRows, untuk);
    Object.keys(asgS0).forEach(no => { const a = asgS0[no]; sah[no] = { co: a.co, role: a.role, nama: a.nama, sipok: a.sipok }; });
    Object.keys(per).forEach(co => per[co].kontrak.forEach(x => { sah[x.noKontrak] = { co, role: per[co].role, nama: x.nama, sipok: x.sipok }; }));
    const waktu = waktuWIB().toISOString().replace('T', ' ').slice(0, 19);
    const rows = [];
    daftar.map(x => String(x)).forEach(n => { const s = sah[n]; if (s) rows.push([untuk, safe(s.co), s.role, safe(n), safe(s.nama), Math.round(s.sipok), aksi, email, waktu]); });
    if (!rows.length) { res.status(400).json({ error: 'Kontrak tidak ada di usulan CO untuk tanggal itu.' }); return; }
    await tambahBaris(token, sheetId, TAB_ASSIGN, H_ASSIGN, rows);
    res.status(200).json({ ok: true, jumlah: rows.length, aksi });
    return;
  }

  if (mode === 'tambah') {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Metode tidak didukung.' }); return; }
    const untuk = body.untuk, namaCO = String(body.co || '');
    const daftar = Array.isArray(body.kontrak) ? Array.from(new Set(body.kontrak.map(x => String(x)))).slice(0, 30) : [];
    if (!tglValid(untuk) || !namaCO || !daftar.length) { res.status(400).json({ error: 'Data tambahan tidak lengkap.' }); return; }
    const [master, cfg] = await Promise.all([bacaMaster(token, sheetId), bacaTab(token, sheetId, 'CONFIG_ROLE')]);
    const co = cariCOByNama(master, cfg, namaCO);
    if (!co || !BUCKET_ROLE[co.role]) { res.status(400).json({ error: 'CO tidak ditemukan atau bukan FE/MR.' }); return; }
    const peta = {}; kandidat(co).forEach(x => { peta[x.noKontrak] = x; });
    const waktu = waktuWIB().toISOString().replace('T', ' ').slice(0, 19);
    const rows = [];
    daftar.forEach(n => { const k = peta[n]; if (k) rows.push([untuk, safe(co.nama), co.role, safe(n), safe(k.nama), Math.round(k.sipok), 'ASSIGN', email, waktu]); });
    if (!rows.length) { res.status(400).json({ error: 'Kontrak tidak memenuhi syarat balance milik CO tersebut.' }); return; }
    await tambahBaris(token, sheetId, TAB_ASSIGN, H_ASSIGN, rows);
    res.status(200).json({ ok: true, jumlah: rows.length });
    return;
  }

  res.status(400).json({ error: 'Mode tidak dikenal.' });
}

module.exports = { kaliDKH, rekomendasi, cariCOByNama, hariDariCell, TARGET_DKH, tangani, MIN, MAX, BUCKET_ROLE, kandidat, cariCO, usulanTerbaru, statusAssign, besok };
