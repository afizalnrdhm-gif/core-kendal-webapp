// Usulan DKH: CO memilih 12–15 kontrak balance (FE = BUCKET UPDATE 1-30, MR = 31-60) untuk dikunjungi besok.
// Admin/head melihat usulan semua CO lalu meng-assign ke DKH hari berikutnya.
// Tab (dibuat otomatis): USULAN_DKH (append-only, batch terbaru per CO+tanggal yang berlaku) dan DKH_ASSIGN (append-only, baris terbaru per tanggal+kontrak yang berlaku).
// File berawalan "_" tidak dihitung Vercel sebagai function.
const { cleanCell } = require('./_sheet');

const MIN = 12, MAX = 15;
const TAB_USUL = 'USULAN_DKH', TAB_ASSIGN = 'DKH_ASSIGN';
const H_USUL = ['UNTUK_TANGGAL', 'CO', 'EMAIL', 'ROLE', 'NO_KONTRAK', 'NAMA', 'SIPOK', 'BUCKET', 'BATCH', 'WAKTU'];
const H_ASSIGN = ['UNTUK_TANGGAL', 'CO', 'ROLE', 'NO_KONTRAK', 'NAMA', 'SIPOK', 'STATUS', 'OLEH', 'WAKTU'];
const BUCKET_ROLE = { FE: 'P001_030', MR: 'P031_060' };
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

function parse(values) {
  const header = (values[0] || []).map(h => String(h == null ? '' : h).trim());
  return values.slice(1).map(r => { const o = {}; header.forEach((h, i) => { if (h) o[h] = cleanCell(h, r[i] === undefined ? '' : r[i]); }); return o; });
}

async function bacaTab(token, sheetId, tab) {
  const r = await sf(BASE(sheetId) + '/values/' + encodeURIComponent(tab) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  return r.ok && r.json.values ? parse(r.json.values) : [];
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
  return { nama, role, kontrak: mine };
}

// Kontrak yang boleh diusulkan: milik CO, bukan FLEET, BUCKET UPDATE masih di bucket balance role-nya
function kandidat(co) {
  const b = BUCKET_ROLE[co.role];
  if (!b) return [];
  return co.kontrak.filter(r => r['BUCKET UPDATE'] === b && r['FLEET/NON FLEET'] !== 'FLEET')
    .map(r => ({ noKontrak: String(r['NO KONTRAK']), nama: String(r['NAMA KONSUMEN'] || '-'), sipok: Number(r['SIPOK']) || 0, dpd: r['DPD'] === undefined || r['DPD'] === '' ? null : Number(r['DPD']), janji: r['JANJI BAYAR'] ? String(r['JANJI BAYAR']) : '', proyeksi: r['PROYEKSI'] ? String(r['PROYEKSI']) : '' }))
    .sort((a, c) => c.sipok - a.sipok);
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
  rows.forEach(r => { if (String(r['UNTUK_TANGGAL']) === untuk) out[String(r['NO_KONTRAK'])] = { status: String(r['STATUS']), oleh: String(r['OLEH'] || ''), waktu: String(r['WAKTU'] || '') }; });
  return out;
}

// ---- Handler dipanggil dari cms.js ----
async function tangani(req, res, ctx) {
  const { email, token, sheetId, isAdmin, mode } = ctx;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const untukDefault = besok();

  if (mode === 'saya') {
    const [master, cfg, usul, asg] = await Promise.all([bacaTab(token, sheetId, 'MASTER'), bacaTab(token, sheetId, 'CONFIG_ROLE'), bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN)]);
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
    const [master, cfg, usul, asg] = await Promise.all([bacaTab(token, sheetId, 'MASTER'), bacaTab(token, sheetId, 'CONFIG_ROLE'), bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN)]);
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
    if (lama && lama.kontrak.some(x => asgS[x.noKontrak] && asgS[x.noKontrak].status === 'ASSIGN')) { res.status(409).json({ error: 'Usulan ini sudah mulai di-assign admin, jadi tidak bisa diubah lagi.' }); return; }
    const batch = new Date().toISOString(); const waktu = waktuWIB().toISOString().replace('T', ' ').slice(0, 19);
    const rows = pilih.map(n => [untuk, safe(co.nama), email, co.role, safe(n), safe(peta[n].nama), Math.round(peta[n].sipok), BUCKET_ROLE[co.role], batch, waktu]);
    await tambahBaris(token, sheetId, TAB_USUL, H_USUL, rows);
    res.status(200).json({ ok: true, untuk, jumlah: pilih.length });
    return;
  }

  // Selanjutnya khusus admin/head
  if (!isAdmin) { res.status(403).json({ error: 'Menu ini khusus admin/head.' }); return; }

  if (mode === 'admin') {
    const untuk = tglValid(req.query && req.query.tanggal) ? req.query.tanggal : untukDefault;
    const [master, cfg, usul, asg] = await Promise.all([bacaTab(token, sheetId, 'MASTER'), bacaTab(token, sheetId, 'CONFIG_ROLE'), bacaTab(token, sheetId, TAB_USUL), bacaTab(token, sheetId, TAB_ASSIGN)]);
    const per = usulanTerbaru(usul, untuk); const asgS = statusAssign(asg, untuk);
    // Bucket kontrak saat ini, supaya terlihat kalau sudah berubah sejak diusulkan
    const bucketNow = {}; master.forEach(r => { bucketNow[String(r['NO KONTRAK'])] = r['BUCKET UPDATE']; });
    const picList = cfg.filter(r => BUCKET_ROLE[String(r['ROLE'] || '').trim().toUpperCase()] && r['NAMA_CO']).map(r => ({ nama: String(r['NAMA_CO']), role: String(r['ROLE']).trim().toUpperCase() }));
    const dataCO = picList.map(p => {
      const u = per[p.nama];
      return {
        nama: p.nama, role: p.role, sudahKirim: !!u, waktu: u ? u.waktu : '',
        kontrak: u ? u.kontrak.map(x => ({ noKontrak: x.noKontrak, nama: x.nama, sipok: x.sipok, bucketSekarang: bucketNow[x.noKontrak] || '', assign: !!(asgS[x.noKontrak] && asgS[x.noKontrak].status === 'ASSIGN') })) : []
      };
    });
    const tanggalTersedia = Array.from(new Set(usul.map(r => String(r['UNTUK_TANGGAL'])).filter(tglValid))).sort().reverse().slice(0, 14);
    if (tanggalTersedia.indexOf(untuk) === -1) tanggalTersedia.unshift(untuk);
    res.status(200).json({ untuk, tanggalTersedia, co: dataCO });
    return;
  }

  if (mode === 'assign') {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Metode tidak didukung.' }); return; }
    const untuk = body.untuk, aksi = body.aksi === 'batal' ? 'BATAL' : 'ASSIGN';
    const daftar = Array.isArray(body.kontrak) ? body.kontrak.slice(0, 300) : [];
    if (!tglValid(untuk) || !daftar.length) { res.status(400).json({ error: 'Data assign tidak lengkap.' }); return; }
    const usul = await bacaTab(token, sheetId, TAB_USUL);
    const per = usulanTerbaru(usul, untuk);
    const sah = {};
    Object.keys(per).forEach(co => per[co].kontrak.forEach(x => { sah[x.noKontrak] = { co, role: per[co].role, nama: x.nama, sipok: x.sipok }; }));
    const waktu = waktuWIB().toISOString().replace('T', ' ').slice(0, 19);
    const rows = [];
    daftar.map(x => String(x)).forEach(n => { const s = sah[n]; if (s) rows.push([untuk, safe(s.co), s.role, safe(n), safe(s.nama), Math.round(s.sipok), aksi, email, waktu]); });
    if (!rows.length) { res.status(400).json({ error: 'Kontrak tidak ada di usulan CO untuk tanggal itu.' }); return; }
    await tambahBaris(token, sheetId, TAB_ASSIGN, H_ASSIGN, rows);
    res.status(200).json({ ok: true, jumlah: rows.length, aksi });
    return;
  }

  res.status(400).json({ error: 'Mode tidak dikenal.' });
}

module.exports = { tangani, MIN, MAX, BUCKET_ROLE, kandidat, cariCO, usulanTerbaru, statusAssign, besok };
