# Tampilan Head — Rencana 2: Target Daily §7.4, Diagnosa Target Daily, Tindak lanjut, Teks Laporan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realisasi Target Daily mengikuti §7.4 project 3 (untuk head dan CO), head bisa menjawab "kenapa target daily tidak achieve" di Diagnosa, punya layar Tindak lanjut, dan bisa menyalin teks laporan untuk atasan.

**Architecture:** `terapkanProgres` di `api/_tdsnap.js` menghitung realisasi dari perubahan posisi (`nilaiAmt` sekarang vs `baseNilai` pagi). Ringkasan Target Daily untuk head disusun oleh fungsi murni baru di `api/_tdhead.js` dari keluaran `hitungTargetDaily`, baseline, hasil harian, dan item CMS (`cms.compute`). `?mode=head` menambahkan blok `targetDaily` dan `tindakan` ke `HeadData`. Frontend menambah chip "Target Daily" di Diagnosa, menu baru "Tindak lanjut" dan "Laporan".

**Tech Stack:** Node (Vercel serverless, CommonJS), Google Sheets API v4, `node:test`, HTML/CSS/JS tanpa framework, Playwright (python).

**Spec:** `docs/superpowers/specs/2026-10-21-tampilan-head-design.md` (§4.6, §5, §6, §8)

**Di luar rencana ini (Rencana 3):** gambar laporan (satori) dan kirim ke grup Telegram (spec §8 poin 3), alur setuju/ubah/tolak tindakan (spec §6 poin 1 versi penuh), pemindahan menu lama ke "Lainnya" (spec §2).

## Global Constraints

- Logic realisasi §7.4 berlaku untuk head **dan** CO (keputusan Head, 21 Okt). Tampilan CO lain tidak diubah.
- `realisasi(D) = posisi_sekarang − posisi_awal`, positif bila bergerak ke arah yang diinginkan (Balance NOOD naik; Balance 1-30/31-60/30+ dan Flow turun). Bisa negatif (memburuk).
- `capaian = realisasi / target`. Tuntas bila `realisasi ≥ target` atau target ≤ 0.
- Status: meleset 1–2 hari berturut-turut = `WASPADA`, ≥ 3 hari = `MERAH`, selain itu `AMAN`.
- Jumlah function Vercel tetap 11. Tidak ada data dikirim ke layanan luar.
- Semua yang diteruskan dari Rencana 1 Global Constraints tetap berlaku (admin via `ADMIN_EMAILS`, header KA baris 16, minggu W1–W4, tampilan 390 px tanpa geser horizontal halaman).
- Commit diakhiri baris `Co-Authored-By` dan `Claude-Session`; branch `fitur/head-rencana-2`, PR, merge hanya bila Head menulis "merge".

## Review Focus

- Baseline pagi belum ada (sebelum jam 9 atau tab baru): realisasi tidak dihitung, layar menampilkan "target belum dibekukan", tidak ada angka negatif palsu.
- Posisi memburuk setelah pagi (realisasi negatif): tampil sebagai minus, bukan 0, dan tidak dihitung tuntas.
- Tab PRODUCTIVITY kosong/tidak ada: status kerja kontrak = "TIDAK ADA DATA", diagnosa tetap tampil.
- CO tanpa poin target (DESKCALL) atau PIC tanpa baseline: dilewati tanpa error.
- `LOG_TARGET_HASIL` kosong: status semua `AMAN`, tren kosong dengan catatan.

---

### Task 1: Perbaikan kecil dari review Rencana 1

**Files:**
- Modify: `api/_kpi.js`, `api/_diagnosa.js`, `api/dashboard.js`, `api/_logharian.js`, `index.html`
- Test: `tests/kpi.test.js`, `tests/diagnosa.test.js`, `tests/head.test.js`

**Interfaces:**
- Produces: `isFleet(row) -> boolean` di `api/_kpi.js` (trim + uppercase `=== 'FLEET'`), dipakai `hitungKpi`, `rasio_`, dan `_diagnosa`. `penyebab[i].dim` (kunci dimensi pemberat terbesar) di `HeadData`.

- [ ] **Step 1: Tes gagal**:
  - `hitungKpi` dengan baris `'FLEET/NON FLEET': ' Fleet '` membuang baris itu bila `includeFleet` false.
  - `D.hariDari('21') === 21`, `D.hariDari(' 5 ') === 5`, `D.hariDari('32') === null`.
  - `susunHead` dengan `hariIni` tgl 1 dan `minggu: 4` → `minggu.sisaHari === 0`, bukan panjang bulan baru.
  - `susunHead(...).penyebab[0].dim` bernilai kunci dimensi (mis. `'statusNbq'`).
- [ ] **Step 2: Jalankan** `npm test` → yang baru FAIL.
- [ ] **Step 3: Implementasi.** `sisaHari` tgl 1 = 0 (data masih penutupan bulan lalu). `kalimat` mengembalikan juga dimensi terpakai lewat properti `kalimat.dimUtama` (array diberi properti) atau `susunHead` menghitung dim terbesar sendiri — pilih yang terakhir. `bacaLogHarian` dibungkus `bacaSheet` (cache 45 detik) lewat parameter opsional `pembaca`.
- [ ] **Step 4: Frontend:** klik penyebab menyetel `DIAG_DIM = p.dim` sebelum membuka Diagnosa.
- [ ] **Step 5: Jalankan** `npm test` → PASS. **Commit** `"Perbaikan kecil review Rencana 1"`.

### Task 2: Realisasi Target Daily §7.4 dan status Waspada/Merah

**Files:**
- Modify: `api/_tdsnap.js` (`terapkanProgres`, tambah `statusStreak`), `api/insentif.js` (mode target menempelkan status)
- Modify: `index.html` (menu Target Daily: tampilkan realisasi minus, label status)
- Test: `tests/target-daily.test.js`

**Interfaces:**
- Produces:
  - `terapkanProgres(td, base)` — `q.progres = { targetHari, baseNilai, posisiSekarang, tercapai, persen, sisa, tuntas, arah, jumlahBase, kontrakBayar, waktuBase }` dengan `tercapai = arah === 'naik' ? nilaiAmt − baseNilai : baseNilai − nilaiAmt` (posisi sekarang dari `q.nilaiFE ?? q.nilaiAmt`, sama seperti yang dibekukan `barisBaseline`), `persen = targetHari > 0 ? tercapai / targetHari × 100 : 100`, `tuntas = targetHari <= 0 || tercapai >= targetHari`, `sisa = max(0, targetHari − tercapai)`. `kontrakBayar` tetap daftar kontrak baseline yang sudah keluar dari daftar (informasi), tidak lagi dipakai untuk angka.
  - `statusStreak(hari: number) -> 'AMAN'|'WASPADA'|'MERAH'` (0 → AMAN, 1–2 → WASPADA, ≥3 → MERAH).
  - Respons mode target: tiap `q` mendapat `status` dan `streakHari` dari `hitungStreak` (PIC|kunci).

- [ ] **Step 1: Tes gagal**:
  - flow, base 600, nilai sekarang 450, target 100 → `tercapai === 150`, `tuntas === true`, `persen === 150`.
  - balance NOOD naik, base 1000, sekarang 940, target 50 → `tercapai === -60`, `tuntas === false`, `sisa === 110`.
  - base tidak ada untuk PIC|kunci → `q.progres` tidak dibuat.
  - `statusStreak(0) === 'AMAN'`, `(2) === 'WASPADA'`, `(3) === 'MERAH'`.
- [ ] **Step 2: Jalankan** → FAIL.
- [ ] **Step 3: Implementasi** di `_tdsnap.js`; mode target di `insentif.js` menempelkan `status`/`streakHari` per poin.
- [ ] **Step 4: Frontend Target Daily:** angka tercapai negatif tampil dengan tanda minus dan warna merah; label status (Aman/Waspada/Merah) di tiap poin. Cek dengan Playwright 390 px (data contoh dengan satu poin negatif): tanpa `pageerror`, `scrollWidth === 390`.
- [ ] **Step 5: Jalankan** `npm test` → PASS. **Commit** `"Target Daily: realisasi dari perubahan posisi (§7.4) dan status Waspada/Merah"`.

### Task 3: Ringkasan Target Daily untuk head `api/_tdhead.js`

**Files:**
- Create: `api/_tdhead.js`
- Test: `tests/tdhead.test.js`; tambahkan ke `package.json`

**Interfaces:**
- Consumes: keluaran `hitungTargetDaily` **sebelum** `terapkanProgres` menghapus `semuaKandidat` (pemanggil menyalin `q.semuaKandidat` ke `q.belum` dulu), `base` dari `bacaBaseline`, `hasil` dari `bacaHasil`, `cmsItems` dari `cms.compute(...).items` (boleh `[]`), `master` rows, `hariIni`.
- Produces: `susunTargetDailyHead({ td, base, hasil, cmsItems, master, hariIni }) -> TdHead`:

```
{
  adaBaseline: boolean,
  pic: [{ co, role, poin: [{ kunci, judul, target, realisasi, capaianPct, tuntas, status, streakHari }] }],
  total: { target, realisasi, capaianPct },               // jumlah semua poin semua PIC
  kalimat: string[],                                      // 2-4 kalimat
  belum: { kontrak, sipok, urai: { [dim]: [{ nilai, kontrak, sipok, porsiPct }] } },
  teratas: [{ noKontrak, nama, co, sipok, statusKerja, hasil, janji }],   // 20, SIPOK terbesar
  tren: { [co]: [{ tanggal, persen }] }                   // bulan berjalan, dari LOG_TARGET_HASIL rata-rata poin per PIC
}
```

  Dimensi `belum.urai` (kontrak di `q.belum` yang juga ada di baseline pagi PIC|kunci itu, unik per nomor kontrak):
  - `pic`: nama CO.
  - `statusKerja`: dari item CMS nomor itu — tidak ada item → `'TIDAK ADA DATA'`; tag `terbentuk` tanpa `dikerjakan` → `'DKH, BELUM DIKERJAKAN'`; tag `dikerjakan` → `'SUDAH DIKUNJUNGI'`; ada item tanpa `terbentuk` → `'BELUM DKH'`. Tag berbentuk `bal|co|metric`; cek metric saja.
  - `hasil`: action code item (`ac`, token pertama sebelum `|`) — JB/BYR/SBY/STB/TRB → `'BERTEMU: <kode>'`; KPR/KTD/TKK/TTP → `'TIDAK BERTEMU: <kode>'`; kosong → `'BELUM ADA HASIL'`.
  - `janji`: hari JANJI BAYAR (MASTER) vs hari ini — sama → `'JANJI HARI INI'`, lebih besar → `'JANJI MUNDUR'`, lebih kecil → `'JANJI LEWAT (INGKAR)'`, kosong → `'TANPA JANJI'`.
  - `segmen` (SEGMEN PEKERJAAN) dan `jatuhTempo` (W1–W4 dari JATUH TEMPO).
  Kalimat: (1) `"Target daily hari ini: realisasi Rp X jt dari target Rp Y jt (Z%)."` (2) PIC dan poin dengan kekurangan rupiah terbesar. (3) Status kerja dengan porsi SIPOK terbesar di kontrak belum bayar, mis. `"60% nilai kontrak yang belum bayar belum dikunjungi (BELUM DKH)."` (4) PIC berstatus MERAH bila ada.

- [ ] **Step 1: Tes gagal** dengan fixture: 1 PIC FE, 1 poin flow_nood target 100, realisasi 40; baseline berisi 3 kontrak (A 200, B 100, C 50); `q.belum` = A, B; item CMS: A punya tag `b1|X|terbentuk` saja, B tidak ada; MASTER A JANJI BAYAR hari ini, B kosong; hasil harian 3 hari terakhir tidak tuntas.
  - `total.capaianPct === 40`.
  - `belum.kontrak === 2`, `belum.sipok === 300`.
  - `belum.urai.statusKerja` memuat `{ nilai: 'DKH, BELUM DIKERJAKAN', kontrak: 1, sipok: 200 }` dan `{ nilai: 'TIDAK ADA DATA', sipok: 100 }`.
  - `belum.urai.janji` memuat `'JANJI HARI INI'` dan `'TANPA JANJI'`.
  - `pic[0].poin[0].status === 'MERAH'`, `streakHari === 3`.
  - `kalimat[0]` memuat `'(40,00%)'`.
  - tanpa baseline (`base = {}`) → `adaBaseline === false`, `belum.kontrak === 0`, tidak ada `NaN`.
- [ ] **Step 2: Jalankan** → FAIL. **Step 3: Implementasi.** **Step 4:** `npm test` → PASS. **Step 5: Commit** `"Ringkasan Target Daily untuk head"`.

### Task 4: Mode head memuat Target Daily dan tindakan

**Files:**
- Modify: `api/dashboard.js`, `api/insentif.js` (ekspor `hitungTargetDaily`, `tdHariIni`), `api/_diagnosa.js` (fungsi `tindakan`)
- Test: `tests/head.test.js`, `tests/diagnosa.test.js`

**Interfaces:**
- Consumes: Task 2–3, `cms.compute` (`require('./cms').compute`), `bacaBaseline`, `bacaHasil`, `kunciTanggal`, `bayarLPC`.
- Produces:
  - `HeadData.targetDaily: TdHead` dan `HeadData.tindakan: Tindakan[]`.
  - `tindakan(penyebab, tdHead, diagnosa) -> Array<{ judul, temuan, alasan, kontrak: string[], pic, dampakRp }>` maksimal 5, urut `dampakRp` menurun:
    - Per PIC|poin target daily yang belum tuntas: judul `"Kejar target <poin> <PIC>"`, kontrak = 5 nomor teratas dari kontrak belum bayar PIC itu, dampakRp = kekurangan rupiah poin itu.
    - Per penyebab diagnosa: judul `"Tangani <dimensi> <nilai> di <angka>"`, kontrak = 5 kontrak teratas angka itu yang cocok dengan nilai dimensi, dampakRp = pengaruh poin × beban angka / 100.
  - Baris tambahan di respons: `targetDaily.adaBaseline` false bila baseline hari ini belum ada (tidak membekukan dari mode head).
- Mode head membaca tambahan secara paralel: `PRODUCTIVITY` (opsional), `LOG_TARGET_DAILY` (lewat `bacaBaseline`), `LOG_TARGET_HASIL` (lewat `bacaHasil`). Mode head **tidak** membekukan baseline dan tidak menulis hasil harian.

- [ ] **Step 1: Tes gagal**: `tindakan` dengan 1 poin kurang Rp 300 dan 1 penyebab pengaruh 2 poin pada beban Rp 10.000 → 2 tindakan, urutan [poin 300, penyebab 200]; batas 5. `susunHead` dengan `td`/`tdHead` palsu menyertakan `targetDaily` dan `tindakan`.
- [ ] **Step 2: Jalankan** → FAIL. **Step 3: Implementasi** (`susunHead` menerima `tdHead` opsional; `handleHead` menyusunnya). **Step 4:** `npm test` → PASS. **Step 5: Commit** `"Mode head: Target Daily dan tindakan"`.

### Task 5: Diagnosa "Target Daily" di layar head

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `HEAD_DATA.targetDaily`, `garisMingguan_` tidak dipakai (tren harian butuh garis per tanggal) — buat `garisHarian_(el, seri: {label, warna, titik: [{tanggal, persen}]}[])`.
- Produces: chip pertama di Diagnosa `"Target Daily"` (`DIAG_ANGKA = 'td'`), `renderDiagnosaTd_()`.

- [ ] **Step 1:** Isi (spec §4.6): jawaban singkat + Salin; tabel per PIC × poin (target, realisasi, capaian, status dengan warna); grafik tren capaian harian per PIC; tab dimensi kontrak belum bayar (PIC, Status kerja, Hasil kunjungan, Janji, Segmen, Jatuh tempo) dengan kolom Nilai, Kontrak, SIPOK, Porsi; daftar 20 kontrak belum bayar (klik membuka panel kontrak). Bila `adaBaseline` false: tampil "Target hari ini belum dibekukan (cron 09.00 atau tombol Bekukan di menu Target Daily)."
- [ ] **Step 2:** Playwright 390 px dengan `HeadData` contoh (dari `mkhead.js` + `targetDaily` contoh): semua tab tanpa `pageerror`, `scrollWidth === 390`.
- [ ] **Step 3: Commit** `"Diagnosa Target Daily untuk head"`.

### Task 6: Layar "Tindak lanjut"

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `HEAD_DATA.tindakan`, `HEAD_DATA.targetDaily`.
- Produces: menu admin `data-view="tindak"` (judul "Tindak lanjut", slot ketiga nav bawah HP), `renderTindak()`.

- [ ] **Step 1:** Isi (spec §6, versi pertama tanpa setuju/tolak): (1) daftar `tindakan` (judul, temuan, alasan, PIC, dampak Rp jt, nomor kontrak sasaran yang bisa diklik); (2) ringkasan Target Daily per PIC (capaian dan status) + tombol "Buka Target Daily"; (3) tombol "Buka Usulan DKH" dan "Buka NBQ" (menu lama); (4) hasil kemarin: dari `targetDaily.tren` ambil titik kemarin per PIC (persen dan tuntas/tidak).
- [ ] **Step 2:** Playwright 390 px: tanpa `pageerror`, `scrollWidth === 390`.
- [ ] **Step 3: Commit** `"Layar Tindak lanjut untuk head"`.

### Task 7: Teks laporan siap salin

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `teksLaporan_(jenis: 'pagi'|'td'|'angka', data, angka?) -> string`, menu admin `data-view="laporan"` dengan `renderLaporan()`, tombol "Salin laporan" di Hari ini (jenis `pagi`).

- [ ] **Step 1:** Format teks WA (tanpa nama konsumen; spec §10):
  - `pagi`: `*Kondisi <tanggal>*`, enam kartu (judul: persen, perubahan dari kemarin bila ada), `*Penyebab utama*` 3 kalimat, `*Rencana*` maksimal 5 judul tindakan.
  - `td`: `*Target Daily <tanggal>*`, total capaian, per PIC × poin (realisasi/target, status), kalimat diagnosa TD.
  - `angka`: judul angka terpilih + kalimat diagnosa + 3 baris pemberat teratas dimensi terpilih.
- [ ] **Step 2:** Layar Laporan: pilihan jenis, `<textarea>` pratinjau yang bisa diedit, tombol Salin (clipboard, cadangan `execCommand`). Catatan: "Gambar dan kirim ke Telegram menyusul."
- [ ] **Step 3:** Playwright: teks `pagi` memuat judul enam kartu dan tidak memuat nama konsumen dari `HEAD_DATA.diagnosa.*.teratas`; `scrollWidth === 390`.
- [ ] **Step 4: Commit** `"Teks laporan siap salin untuk head"`.

### Task 8: Verifikasi akhir

- [ ] **Step 1:** `npm test` → PASS.
- [ ] **Step 2:** Hitung `susunTargetDailyHead` dengan data ekspor 15 Okt dan baseline buatan (posisi pagi = posisi data) → realisasi 0 untuk semua poin; ubah 3 kontrak jadi NOOD → realisasi Flow NOOD = jumlah SIPOK ketiganya. Catat di PR.
- [ ] **Step 3:** Review akhir seluruh branch oleh reviewer baru; perbaiki temuan penting dengan tes.
- [ ] **Step 4:** Push, buka PR, laporkan ke Head. Merge hanya setelah "merge".
