// Segmen pekerjaan konsumen: KARYAWAN, WIRASWASTA, SERABUTAN. Dipakai untuk kolom "SEGMEN PEKERJAAN" di MASTER.
// File berawalan "_" tidak dihitung Vercel sebagai function.
const KOLOM = 'SEGMEN PEKERJAAN';
const SEGMEN = ['KARYAWAN', 'WIRASWASTA', 'SERABUTAN'];

// Urutan penting: SERABUTAN (lepas/harian) dicek dulu supaya "BURUH HARIAN" tidak jatuh ke KARYAWAN, lalu WIRASWASTA, lalu KARYAWAN.
const POLA = [
  ['SERABUTAN', /\b(SERABUTAN|BURUH (HARIAN|LEPAS|TANI|BANGUNAN|KASAR|ANGKUT|BORONG)|KULI|TUKANG|OJEK|OJOL|OJEG|DRIVER|SOPIR|SUPIR|KERNET|PEKERJA (LEPAS|HARIAN|BEBAS)|FREELANCE|FREE LANCE|LEPAS|HARIAN LEPAS|PENGEMUDI|PARKIR|JUKIR|PEMULUNG|PENGAMEN|PETANI|PENAMBANG|PENYADAP|NELAYAN|PEKERJA SERABUTAN|GOJEK|GRAB|MAXIM|INDRIVER|JAS ANGKUT|ANGKUT|PROYEK|PENGGARAP|PENGGARAP PLAFON|SAWAH|LAHAN|KEBUN|TAMBAK|PEKERJA BANGUNAN|PENGEPUL|PEMULUNG|DAUR ULANG)\b/],
  ['WIRASWASTA', /\b(WIRASWASTA|WIRAUSAHA|WIRASWAST|PEDAGANG|DAGANG|BERDAGANG|USAHA|TOKO|WARUNG|WARTEG|BENGKEL|KONVEKSI|PEMILIK|OWNER|KONTRAKTOR|KATERING|CATERING|SALON|LAUNDRY|PETERNAK|PENGUSAHA|PENJUAL|JUALAN|JUAL|KIOS|AGEN|SUPPLIER|DISTRIBUTOR|PRODUSEN|PERAJIN|PENGRAJIN|KERAJINAN|MEBEL|MEUBEL|PERCETAKAN|FOTOCOPY|FOTO COPY|APOTEK|KLINIK|BIDAN PRAKTEK|DOKTER PRAKTEK|CV|UD|PERDAGANGAN|JASA|NOTARIS|PENGACARA|ADVOKAT|KONSULTAN|PENGEPUL|BISNIS|TERNAK|PERTANIAN|PERKEBUNAN|PERIKANAN|PERTUKANGAN|PROPERTI|BORONGAN)\b/],
  ['KARYAWAN', /\b(KARYAWAN|KARYAWATI|PEGAWAI|PNS|ASN|CPNS|PPPK|HONORER|GURU|DOSEN|TNI|POLRI|POLISI|BUMN|BUMD|PERAWAT|BIDAN|DOKTER|SATPAM|SECURITY|STAFF|STAF|OPERATOR|BURUH PABRIK|PEKERJA PABRIK|PABRIK|PT|PERUSAHAAN|BANK|RUMAH SAKIT|RS|DINAS|PEMKAB|PEMDA|PEMERINTAH|KANTOR|SEKOLAH|KEPALA|MANAGER|MANAJER|SUPERVISOR|ADMIN|KASIR|SALES|TEKNISI|MONTIR|PERANGKAT DESA|KADES|LURAH|CAMAT|PENSIUNAN|PENSIUN|SD|SDN|SMP|SMPN|SMA|SMAN|SMK|SMKN|MI|MTS|MA|MIN|MTSN|MAN|TK|PAUD|UNIVERSITAS|PTE|LTD|SERVICES|SERVICE|EXPRESS|LOGISTIK|LOGISTICS|EKSPEDISI|KURIR|KOPERASI|KSP|KONSTRUKSI|KONTRUKSI|SATUAN PELAYANAN|PUSKESMAS|PUSKESMAS|UPT|BPR|BPD|ASURANSI|PEGADAIAN|LEASING|FINANCE|INDUSTRI|GARMENT|KONVEKSI PABRIK|TEXTILE|TEKSTIL|ELEKTRONIK|MANUFAKTUR|TRANSPORTASI|PELAYARAN|PERKEBUNAN PT)\b/]
];

function segmenDari(pekerjaan) {
  const t = String(pekerjaan == null ? '' : pekerjaan).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t === '-' ) return '';
  if (/^(PT|PERUM|PERSERO|BANK|RS|RSUD|DINAS|PEMKAB|PEMDA)\b/.test(t) && !/\b(WIRASWASTA|WIRAUSAHA|PEMILIK|OWNER)\b/.test(t)) return 'KARYAWAN'; // nama perusahaan = tempat bekerja
  if (/\bBURUH\b/.test(t) && !/\b(PABRIK|GARMENT|TEXTILE|TEKSTIL)\b/.test(t)) return 'SERABUTAN';
  for (const [nama, re] of POLA) if (re.test(t)) return nama;
  return '';
}

// Klasifikasi memakai data KA HARIAN (lebih rapi dari isi MASTER): NAMA PEKERJAAN KONSUMEN, KATEGORI PEKERJAAN (PEMILIK/STAFF),
// NAMA TEMPAT KERJA. Urutan: pekerjaan lepas/harian dulu, lalu PEMILIK = WIRASWASTA, STAFF = KARYAWAN, terakhir tebakan kata kunci.
function segmenGabung(ka, pekerjaanMaster) {
  ka = ka || {};
  const np = ka.np || '', kat = String(ka.kat || '').toUpperCase().trim(), tk = ka.tk || '';
  if (segmenDari(np) === 'SERABUTAN') return 'SERABUTAN';
  if (kat === 'PEMILIK') return 'WIRASWASTA';
  if (kat === 'STAFF') {
    if (segmenDari(tk) === 'SERABUTAN' || segmenDari(pekerjaanMaster) === 'SERABUTAN') return 'SERABUTAN';
    return 'KARYAWAN';
  }
  return segmenDari(np) || segmenDari(tk) || segmenDari(pekerjaanMaster);
}
// values = isi sheet KA HARIAN (header di baris ke-16). Hasil: { noKontrak: {np, kat, tk} }
function petaKA(values) {
  const v = values || [], hdr = (v[15] || []).map(h => String(h == null ? '' : h).trim().toUpperCase());
  const iNo = hdr.indexOf('NO KONTRAK'), iNp = hdr.indexOf('NAMA PEKERJAAN KONSUMEN'), iKat = hdr.indexOf('KATEGORI PEKERJAAN'), iTk = hdr.indexOf('NAMA TEMPAT KERJA KONSUMEN');
  const out = {};
  if (iNo === -1) return out;
  const g = (r, i) => i > -1 && r[i] != null ? String(r[i]).trim() : '';
  v.slice(16).forEach(r => { r = r || []; const no = g(r, iNo); if (no) out[no] = { np: g(r, iNp), kat: g(r, iKat), tk: g(r, iTk) }; });
  return out;
}

const BASE = id => 'https://sheets.googleapis.com/v4/spreadsheets/' + id;
async function sf(url, token, opts) {
  const r = await fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }, opts || {}));
  let json = {}; try { json = await r.json(); } catch (e) {}
  return { ok: r.ok, json };
}
function colLetter(index) { let s = ''; index += 1; while (index > 0) { const rem = (index - 1) % 26; s = String.fromCharCode(65 + rem) + s; index = Math.floor((index - 1) / 26); } return s; }

async function bacaMaster(token, sheetId) {
  const [r, rk] = await Promise.all([
    sf(BASE(sheetId) + '/values/MASTER?valueRenderOption=UNFORMATTED_VALUE', token),
    sf(BASE(sheetId) + '/values/' + encodeURIComponent('KA HARIAN') + '?valueRenderOption=UNFORMATTED_VALUE', token)
  ]);
  const v = r.ok && r.json.values ? r.json.values : [];
  const ka = petaKA(rk.ok && rk.json.values ? rk.json.values : []);
  const header = (v[0] || []).map(h => String(h == null ? '' : h).trim());
  return { v, header, ka, iPek: header.indexOf('PEKERJAAN KONSUMEN'), iSeg: header.indexOf(KOLOM), iNo: header.indexOf('NO KONTRAK') };
}

async function tangani(req, res, ctx) {
  const { token, sheetId, isAdmin, mode } = ctx;
  if (!isAdmin) { res.status(403).json({ error: 'Menu ini khusus admin/head.' }); return; }
  const m = await bacaMaster(token, sheetId);
  if (m.iPek === -1) { res.status(400).json({ error: 'Kolom PEKERJAAN KONSUMEN tidak ditemukan di sheet MASTER.' }); return; }
  const baris = m.v.slice(1).filter(r => r && r[m.iNo > -1 ? m.iNo : 0]);

  if (mode === 'cek') {
    const hitung = {}, per = { KARYAWAN: 0, WIRASWASTA: 0, SERABUTAN: 0, BELUM: 0 };
    let sudahIsi = 0;
    baris.forEach(r => {
      const p = String(r[m.iPek] == null ? '' : r[m.iPek]).trim();
      const manual = m.iSeg > -1 ? String(r[m.iSeg] == null ? '' : r[m.iSeg]).trim().toUpperCase() : '';
      if (manual) sudahIsi++;
      const seg = SEGMEN.indexOf(manual) > -1 ? manual : segmenGabung(m.ka[String(r[m.iNo > -1 ? m.iNo : 0]).trim()], p);
      per[seg || 'BELUM']++;
      const k = p || '(kosong)';
      const h = hitung[k] = hitung[k] || { pekerjaan: k, n: 0, segmen: seg };
      h.n++;
    });
    const daftar = Object.values(hitung).sort((a, b) => b.n - a.n);
    res.status(200).json({
      total: baris.length, perSegmen: per, kolomAda: m.iSeg > -1, sudahIsi,
      belum: daftar.filter(x => !x.segmen).slice(0, 80),
      contoh: { KARYAWAN: daftar.filter(x => x.segmen === 'KARYAWAN').slice(0, 12), WIRASWASTA: daftar.filter(x => x.segmen === 'WIRASWASTA').slice(0, 12), SERABUTAN: daftar.filter(x => x.segmen === 'SERABUTAN').slice(0, 12) },
      jenisPekerjaan: daftar.length
    });
    return;
  }

  if (mode === 'isi') {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Metode tidak didukung.' }); return; }
    let iSeg = m.iSeg;
    if (iSeg === -1) {
      // Tambah kolom baru di paling kanan (perluas grid kalau perlu), judul di baris 1.
      iSeg = m.header.length;
      const meta = await sf(BASE(sheetId) + '?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))', token);
      const sh = ((meta.json && meta.json.sheets) || []).map(x => x.properties).find(x => x && x.title === 'MASTER');
      if (sh && sh.gridProperties && sh.gridProperties.columnCount <= iSeg) {
        await sf(BASE(sheetId) + ':batchUpdate', token, { method: 'POST', body: JSON.stringify({ requests: [{ appendDimension: { sheetId: sh.sheetId, dimension: 'COLUMNS', length: iSeg + 1 - sh.gridProperties.columnCount } }] }) });
      }
      const h = await sf(BASE(sheetId) + '/values/' + encodeURIComponent('MASTER!' + colLetter(iSeg) + '1') + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: [[KOLOM]] }) });
      if (!h.ok) { res.status(500).json({ error: 'Gagal membuat kolom ' + KOLOM + ' di MASTER.' }); return; }
    }
    // Isi hanya sel yang masih kosong; isian manual tidak pernah ditimpa. Seluruh kolom ditulis sekali supaya baris tetap sejajar.
    let diisi = 0, belum = 0;
    const kolom = m.v.slice(1).map(r => {
      r = r || [];
      const lama = r[iSeg] == null ? '' : String(r[iSeg]).trim();
      if (lama) return [lama];
      const seg = segmenGabung(m.ka[String(r[m.iNo > -1 ? m.iNo : 0] == null ? '' : r[m.iNo > -1 ? m.iNo : 0]).trim()], r[m.iPek]);
      if (seg) { diisi++; return [seg]; }
      if (r[m.iNo > -1 ? m.iNo : 0]) belum++;
      return [''];
    });
    if (kolom.length) {
      const L = colLetter(iSeg);
      const w = await sf(BASE(sheetId) + '/values/' + encodeURIComponent('MASTER!' + L + '2:' + L + (kolom.length + 1)) + '?valueInputOption=RAW', token, { method: 'PUT', body: JSON.stringify({ values: kolom }) });
      if (!w.ok) { res.status(500).json({ error: 'Gagal menulis kolom ' + KOLOM + ' ke MASTER.' }); return; }
    }
    res.status(200).json({ ok: true, diisi, belumTerklasifikasi: belum, kolom: KOLOM });
    return;
  }
  res.status(400).json({ error: 'Mode tidak dikenal.' });
}

module.exports = { segmenDari, segmenGabung, petaKA, tangani, KOLOM, SEGMEN };
