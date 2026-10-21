# Tampilan Head — Rencana 1: Snapshot Harian, Mesin Diagnosis, Layar Hari ini dan Diagnosa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Head membuka menu "Hari ini" dan "Diagnosa" yang menjawab pertanyaan atasan (Balance/Flow NOOD, Flow 1-30, Flow 31-60, BTC, NBQ) dengan angka, penguraian per dimensi, pengaruh dalam poin, dan grafik weekly bulan ini vs bulan lalu.

**Architecture:** Hitungan KPI cabang dipindah ke modul murni `api/_kpi.js` (dipakai `api/dashboard.js` dan cron). Mesin diagnosis berupa fungsi murni di `api/_diagnosa.js`. `api/dashboard.js` mendapat mode `?mode=head` yang merangkai data untuk kedua layar (bukan function baru karena batas 12 function Vercel). Cron `api/log-snapshot.js` menulis snapshot harian ke tab `LOG_HARIAN`. Frontend tetap satu file `index.html`.

**Tech Stack:** Node (Vercel serverless, CommonJS), Google Sheets API v4, `node:test`, HTML/CSS/JS tanpa framework, Playwright (python) untuk uji tampilan.

**Spec:** `docs/superpowers/specs/2026-10-21-tampilan-head-design.md`

**Di luar rencana ini (Rencana 2):** Diagnosa Target Daily dengan realisasi §7.4 (spec §4.6, §5), layar Tindak lanjut (§6), layar Laporan (§8), pemindahan menu lama ke "Lainnya" dan pembuangannya (§2, §12 langkah 7), kolom "% DKH dikerjakan" di baris Tim.

## Global Constraints

- Hanya tampilan head/admin yang berubah. Akun non-admin tidak melihat menu baru dan respons API untuk mereka tidak berubah.
- Admin = email di env `ADMIN_EMAILS` (dipisah koma, dibandingkan lowercase).
- Jumlah function di `api/` (file tanpa awalan `_`) tidak boleh bertambah; saat ini 11 dari batas 12.
- Header KA HARIAN ada di baris ke-16 (index 15). Nilai sel dibersihkan dengan `cleanCell` dari `api/_sheet.js` (#N/A jadi kosong, bucket dinormalkan).
- Urutan bucket: `NOOD, P001_030, P031_060, P061_090, P091_120, P121_150, P151_180, P181_210`.
- Flow = SIPOK kontrak yang `BUCKET UPDATE` lebih buruk dari `BUCKET AWAL`. Penyelesaian = 100 − flow%.
- Minggu: W1 tgl 1–7, W2 8–14, W3 15–21, W4 22–akhir bulan.
- Ambang pemberat: (indeks ≥ 1,15 dan pengaruh ≥ 1 poin) atau porsi masalah ≥ 30%. Irisan minimal 3 kontrak. Ambang "berubah sejak kemarin": ≥ 2 poin.
- Kontrak besar: SIPOK ≥ Rp100.000.000.
- STATUS NBQ kosong atau #N/A dihitung "NON NBQ".
- Tidak ada data dikirim ke layanan luar.
- Tampilan lolos di lebar 390 px tanpa geser horizontal halaman.
- Commit diakhiri baris `Co-Authored-By` dan `Claude-Session` sesuai pengingat sesi; kerja di branch, PR, merge hanya bila Head menulis "merge".

## Review Focus

- Kolom angka di Sheet berisi teks (mis. `"1,500,000"`) atau kosong: SIPOK dianggap 0, kontrak tetap dihitung jumlahnya; tidak ada `NaN` di respons.
- Grup dengan beban 0 (mis. semua SIPOK kosong): rate, indeks, dan porsi bernilai 0, bukan `NaN`/`Infinity`.
- Tab `LOG_HARIAN` belum ada atau kosong: cron membuatnya, dan mode head tetap jalan dengan `berubah: []` dan `riwayatCukup: false`.
- TGL BYR M1 atau TGL BYR LPC dalam format serial Excel, `dd/mm/yyyy`, atau `yyyy-mm-dd`: tanggal terbaca sama; nilai tak terbaca dilewati, tidak membuat error.
- Cron dijalankan dua kali di hari yang sama: baris LOG_HARIAN hari itu ditimpa, tidak dobel.

---

### Task 1: Modul KPI cabang `api/_kpi.js`

**Files:**
- Create: `api/_kpi.js`
- Modify: `api/dashboard.js` (fungsi `computeVariant` memakai `hitungKpi`, kecuali `bigCust` yang tetap di sana)
- Test: `tests/kpi.test.js`; tambahkan ke script `test` di `package.json`

**Interfaces:**
- Produces: `hitungKpi(masterRows: object[], kaRows: object[], includeFleet: boolean) -> { enr, enrCount, perBucket: {kunci,label,amount,count,pct}[], cumulative: {label,amount,count,pct}[], flowBtc: {label,amount,count,pct}[] }` — `perBucket[i].kunci` adalah kode bucket (`'NOOD'` dst.), selebihnya identik dengan keluaran `computeVariant` sekarang. Juga mengekspor `BUCKET_ORDER`, `bucketIndex(b) -> number`, `sipokOf(row) -> number` (bukan angka → 0).

- [ ] **Step 1: Tulis tes gagal** `tests/kpi.test.js`:
  - fixture KA: 3 baris non-fleet `BUCKET UPDATE` NOOD/P001_030/P031_060 dengan `SISA PIUTANG` 600/300/100, plus 1 baris FLEET NOOD 1000.
  - `hitungKpi([], ka, false).enr === 1000`; `perBucket[0].pct === 60`; `cumulative.find(c => c.label === '30+ (Delq)').amount === 100`.
  - `hitungKpi([], ka, true).enr === 2000`.
  - fixture MASTER: 4 baris `BUCKET AWAL` NOOD SIPOK 100 masing-masing, `BUCKET UPDATE` NOOD, NOOD, P001_030, P031_060; plus 1 baris `SIPOK: '1,5'` (teks) bucket awal NOOD update NOOD.
  - `flowBtc.find(f => f.label === 'Flow NOOD')`: `amount === 100`, `pct === 25` (hanya update tepat P001_030 yang dihitung, sama dengan kode lama; baris teks SIPOK berkontribusi 0).
- [ ] **Step 2: Jalankan** `node --test tests/kpi.test.js` → FAIL (`Cannot find module '../api/_kpi'`).
- [ ] **Step 3: Implementasi** — pindahkan logika `computeVariant` (tanpa `bigCust`) dari `api/dashboard.js` ke `hitungKpi`, lalu `computeVariant` memanggil `hitungKpi` dan menambah `bigCust`. Konstanta `BUCKET_LABEL` ikut pindah.
- [ ] **Step 4: Jalankan** `npm test` → semua PASS (tes lama tetap lolos).
- [ ] **Step 5: Commit** `git commit -m "KPI cabang dipindah ke api/_kpi.js"`

### Task 2: Snapshot harian `LOG_HARIAN`

**Files:**
- Create: `api/_logharian.js`
- Modify: `api/log-snapshot.js` (panggil setelah LOG_MINGGUAN ditulis; kegagalan dicatat di respons `logHarian: {ok, error?}` dan tidak menggagalkan cron)
- Test: `tests/logharian.test.js`; tambahkan ke `package.json`

**Interfaces:**
- Consumes: `hitungKpi` (Task 1).
- Produces:
  - `barisLogHarian(tanggal: 'YYYY-MM-DD', masterRows, kaRows) -> Array<[TANGGAL, LINGKUP, KPI, NILAI_AMT, NILAI_PCT]>` — LINGKUP `'CABANG'` (non-fleet) dan tiap nama di `CO ALL` (MASTER) / `NAMA COLLECTOR` (KA). KPI: `ENR`, `BAL NOOD`…`BAL 181-210` (label tanpa kata "Bucket"), `0+`, `30+`, `60+`, `90+`, `180+`, `FLOW NOOD`, `FLOW 1-30`, `FLOW 31-60`, `BTC 1-30`, `BTC 31-60`. PCT dibulatkan 2 desimal.
  - `async tulisLogHarian(token, sheetId, baris) -> { ditulis: number }` — buat tab bila belum ada (header `TANGGAL, LINGKUP, KPI, NILAI_AMT, NILAI_PCT`), hapus baris lama bertanggal sama, lalu tulis ulang.
  - `async bacaLogHarian(token, sheetId) -> { [tanggal]: { [lingkup]: { [kpi]: {amt, pct} } } }` — tab tidak ada → `{}`.
  - `HEADER_LOG_HARIAN` (array di atas).

- [ ] **Step 1: Tulis tes gagal**:
  - `barisLogHarian('2026-10-21', master, ka)` dengan fixture Task 1 (CO ALL `FE A` di semua baris MASTER, NAMA COLLECTOR `FE A` di KA) berisi baris `['2026-10-21','CABANG','BAL NOOD',600,60]` dan `['2026-10-21','FE A','FLOW NOOD',100,25]`.
  - `tulisLogHarian` dengan `global.fetch` palsu: tab berisi header + 2 baris tanggal `2026-10-21` + 1 baris `2026-10-20`; setelah tulis 3 baris baru, isi akhir yang dikirim ke API = header + baris `2026-10-20` + 3 baris baru (tidak dobel).
  - `bacaLogHarian` ketika fetch membalas 400 (tab tidak ada) → `{}`.
- [ ] **Step 2: Jalankan** `node --test tests/logharian.test.js` → FAIL.
- [ ] **Step 3: Implementasi** di `api/_logharian.js`. Penulisan: baca tab, susun ulang semua baris tanpa tanggal yang sama, `values:clear` lalu `values:update` mulai `A1`. Tab dibuat dengan `batchUpdate` `addSheet` bila baca pertama gagal karena range tidak ada.
- [ ] **Step 4: Sambungkan ke** `api/log-snapshot.js`: tanggal = tanggal WIB saat cron jalan (`Asia/Jakarta`), data MASTER/KA yang sudah dibaca dipakai ulang (tambahkan bacaan KA HARIAN bila belum ada).
- [ ] **Step 5: Jalankan** `npm test` → PASS.
- [ ] **Step 6: Commit** `git commit -m "Cron menulis snapshot harian ke LOG_HARIAN"`

### Task 3: Mesin diagnosis `api/_diagnosa.js` — penguraian, irisan, kontrak teratas

**Files:**
- Create: `api/_diagnosa.js`
- Test: `tests/diagnosa.test.js`; tambahkan ke `package.json`

**Interfaces:**
- Consumes: `bucketIndex`, `sipokOf` (Task 1).
- Produces:
  - `ANGKA` = `{ nood: {judul:'Balance/Flow NOOD', awal:'NOOD'}, f130: {judul:'Flow 1-30', awal:'P001_030'}, f3160: {judul:'Flow 31-60', awal:'P031_060'}, btc130: {judul:'BTC 1-30', awal:'P001_030'}, btc3160: {judul:'BTC 31-60', awal:'P031_060'}, nbq: {judul:'NBQ', awal:null} }`.
  - `populasi(rows, angka: keyof ANGKA, opsi: {fleet: boolean}) -> { rows: object[], masalah: (row) => boolean }` — nood/f130/f3160: `BUCKET AWAL === awal`, masalah = flow. btc*: `BUCKET AWAL === awal`, masalah = `BUCKET UPDATE !== 'NOOD'`. nbq: STATUS NBQ terisi (bukan NON NBQ), semua bucket awal, masalah = flow. `fleet:false` membuang `FLEET/NON FLEET === 'FLEET'`.
  - `DIMENSI` = objek `{ kunci: {judul, nilai: (row, konteks) => string} }` untuk: `co` (CO ALL), `groupProduct`, `typeBarang`, `statusNbq` (kosong → `'NON NBQ'`), `segmen` (SEGMEN PEKERJAAN, kosong → `'TIDAK DIKETAHUI'`), `mob` (dari kolom NBQ `'4 MOB'` → `'1-3'|'4-6'|'7-12'|'13+'`, kosong → `'-'`), `jatuhTempo` (hari dari JATUH TEMPO → `'W1'..'W4'`), `janjiBayar` (`'ADA JANJI'|'TANPA JANJI'`), `statusDkh` (`konteks.dkh.has(noKontrak)` → `'ADA DKH'|'BELUM DKH'`), `kontrakBesar` (`'≥100 JT'|'<100 JT'`), `fleet`.
  - `urai(rows, masalah, nilaiFn) -> Array<{nilai, kontrak, beban, masalah, rate, porsiBeban, porsiMasalah, indeks, pengaruh, pemberat}>` diurutkan `pengaruh` menurun. Rumus spec §4.4 (rate/porsi dalam persen 0–100, pengaruh dalam poin).
  - `irisan(rows, masalah, nilaiA, nilaiB, minKontrak = 3) -> Array<{nilai: 'A × B', ...kolom urai}>`, maksimal 10, diurutkan `pengaruh` menurun.
  - `kontrakTeratas(rows, masalah, n = 20) -> Array<{noKontrak, nama, co, sipok, bucketAwal, bucketUpdate, statusNbq, groupProduct}>`.
  - `ringkas(rows, masalah) -> { kontrak, beban, masalah, ratePct, penyelesaianPct }`.

- [ ] **Step 1: Tulis tes gagal** dengan fixture 6 kontrak bucket awal NOOD, SIPOK 100 masing-masing; STATUS NBQ `APPEAL` ×3 (2 flow), `NORMAL` ×2 (0 flow), kosong ×1 (1 flow):
  - `ringkas(...)`: `masalah === 300`, `ratePct === 50`, `penyelesaianPct === 50`.
  - `urai(..., DIMENSI.statusNbq.nilai)[0]`: `nilai === 'APPEAL'`, `kontrak === 3`, `rate ≈ 66.67`, `porsiMasalah ≈ 66.67`, `indeks ≈ 1.333`, `pengaruh ≈ 8.33` (= (200 − 300×0,5)/600×100), `pemberat === true`.
  - baris `NORMAL`: `pengaruh ≈ -16.67`, `pemberat === false`.
  - grup dengan beban 0 (tambah kontrak SIPOK `''`, STATUS NBQ `AUTO APPROVAL`): `rate === 0`, `indeks === 0`, tidak ada `NaN` (`Number.isFinite` di semua kolom).
  - `irisan` dengan `minKontrak = 3` hanya memuat kombinasi yang punya ≥ 3 kontrak.
  - `DIMENSI.mob.nilai({NBQ:'4 MOB'}) === '4-6'`, `({NBQ:'13 MOB'}) === '13+'`, `({NBQ:''}) === '-'`.
- [ ] **Step 2: Jalankan** `node --test tests/diagnosa.test.js` → FAIL.
- [ ] **Step 3: Implementasi** di `api/_diagnosa.js`. Pembagian dengan penyebut 0 menghasilkan 0.
- [ ] **Step 4: Jalankan** → PASS.
- [ ] **Step 5: Commit** `git commit -m "Mesin diagnosis: penguraian, irisan, kontrak teratas"`

### Task 4: Mesin diagnosis — penyelesaian mingguan dan kalimat

**Files:**
- Modify: `api/_diagnosa.js`
- Modify: `api/_sheet.js` (ekspor `tanggalBayarLPC`)
- Test: `tests/diagnosa.test.js`

**Interfaces:**
- Consumes: `tglParts` dari `api/_sheet.js`.
- Produces:
  - `tanggalBayarLPC(values, bulan, tahun) -> Map<noKontrak, hari>` (di `_sheet.js`) — hari pembayaran paling awal bulan itu, baris dengan PEMBIAYAAN ANGSURAN > 0 atau PELUNASAN > 0; urutan hari/bulan tertukar diterima seperti `bayarLPC`.
  - `hariDari(v) -> number|null` (di `_diagnosa.js`) — serial Excel, `dd/mm/yyyy`, `yyyy-mm-dd`; selain itu `null`.
  - `mingguan(rows, hariBayarFn: (row) => number|null) -> number[4]` — persen SIPOK populasi yang hari bayarnya ≤ 7, ≤ 14, ≤ 21, ≤ 31 (kumulatif, 2 desimal).
  - `mingguanPerSegmen(rows, hariBayarFn) -> { KARYAWAN: number[4], WIRASWASTA: number[4], SERABUTAN: number[4] }`.
  - `kalimat(judul, ringkasan, uraiPerDimensi: {[dim]: uraiResult}) -> string[]` (2–4 kalimat). Pola:
    1. `"${judul}: penyelesaian ${p}% (${masalah} dari beban ${beban})."` — rupiah dalam juta, format `id-ID`.
    2. Untuk pemberat dengan pengaruh terbesar di semua dimensi: `"Pemberat terbesar: ${dimJudul} ${nilai} — ${porsiBeban}% beban tapi ${porsiMasalah}% masalah (rate ${rate}% vs rata-rata ${ratePct}%). Seandainya setara rata-rata, penyelesaian naik ${pengaruh} poin."`
    3. Pemberat kedua (dimensi lain) dengan pola yang sama, bila ada.
    4. Bila tidak ada pemberat: `"Tidak ada kelompok yang menyimpang jauh dari rata-rata."`

- [ ] **Step 1: Tulis tes gagal**:
  - `hariDari(46316)` → hari yang sama dengan `new Date((46316-25569)*864e5).getUTCDate()`; `hariDari('19/09/2026') === 19`; `hariDari('2026-09-19') === 19`; `hariDari('abc') === null`.
  - `mingguan` dengan 4 kontrak SIPOK 100, hari bayar 3, 10, 25, null → `[25, 50, 50, 75]`.
  - `tanggalBayarLPC` dengan 2 baris kontrak sama (tgl 12/10 dan 05/10, angsuran > 0) dan 1 baris denda saja → kontrak itu bernilai 5, baris denda diabaikan.
  - `kalimat('Balance/Flow NOOD', ringkasFixtureTask3, {statusNbq: uraiFixtureTask3})[1]` memuat `'APPEAL'` dan `'naik 8,33 poin'`.
- [ ] **Step 2: Jalankan** → FAIL.
- [ ] **Step 3: Implementasi.** Angka di kalimat memakai koma desimal (`toFixed(2).replace('.', ',')`).
- [ ] **Step 4: Jalankan** `npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Mesin diagnosis: penyelesaian mingguan dan kalimat"`

### Task 5: Mode head di `api/dashboard.js`

**Files:**
- Modify: `api/dashboard.js`
- Modify: `api/insentif.js` (ekspor `getMingguSekarang` dan `TD_PARAMETER` lewat `module.exports`)
- Create: `api/_cachesheet.js` (pindahan cache 45 detik dari `api/insentif.js`; `insentif.js` memakainya)
- Test: `tests/head.test.js`; tambahkan ke `package.json`

**Interfaces:**
- Consumes: Task 1–4, `bacaLogHarian` (Task 2), `getMingguSekarang`.
- Produces:
  - `bacaSheet(sheetId, range, token, tanpaCache = false) -> Promise<values[][]>` di `api/_cachesheet.js`.
  - `susunHead({ master, ka, lpc, dkhAssign, logHarian, hariIni: {tahun, bulan, hari}, minggu }) -> HeadData` — fungsi murni, diekspor lewat `module.exports.__test`.
  - `GET /api/dashboard?mode=head` (admin saja, 403 untuk lainnya) → `HeadData`:

```
{
  tanggal: 'YYYY-MM-DD', minggu: { ke: 1-4, sisaHari: number },
  riwayatCukup: boolean,                       // LOG_HARIAN punya data kemarin
  kartu: [{ kunci, judul, pct, amt, batasTeks, kemarin: number|null, arah: 'membaik'|'memburuk'|'tetap'|null }],
  berubah: [{ kunci, judul, dari, ke, selisih }],   // maks 3, |selisih| ≥ 2 poin
  penyebab: [{ angka, kalimat }],                   // maks 3, pemberat dengan pengaruh terbesar lintas angka
  tim: [{ co, role, penyelesaianPct, targetPct, janjiHariIni }],
  kerja: { jatuhTempoBelumDkh: number, janjiHariIni: number },
  diagnosa: { [angka]: {
    judul, ringkas, kalimat: string[],
    mingguan: { ini: number[4], lalu: number[4] },
    segmen: { ini: {[seg]: number[4]}, lalu: {[seg]: number[4]} },
    urai: { [dim]: uraiResult }, irisan: irisanResult, teratas: kontrakTeratasResult
  } }
}
```

  Keputusan isi:
  - `kartu` (enam, spec §3): `balNood` = perBucket NOOD pct non-fleet, `delq` = `30+ (Delq)` dari `hitungKpi`. `flowNood`/`flow130`/`flow3160`/`btc130` = `ringkas(populasi(...)).ratePct` non-fleet, supaya kartu dan Diagnosa memakai aturan flow yang sama (BUCKET UPDATE lebih buruk dari BUCKET AWAL). Catatan untuk PR: `flowBtc` lama hanya menghitung pindah tepat satu bucket, jadi angka kartu bisa sedikit lebih tinggi dari Dashboard lama. `batasTeks` dari `TD_PARAMETER` (cabang) bila ada, mis. `'batas akhir bulan ≥88%'`; BTC tanpa batas. Warna di frontend memakai `arah` (perbandingan dengan LOG_HARIAN kemarin lingkup CABANG), bukan batas akhir bulan.
  - `mingguan.lalu` dari `TGL BYR M1` KA HARIAN; `mingguan.ini` dari `tanggalBayarLPC` bulan berjalan. Populasi = `populasi(...)` angka itu, non-fleet.
  - `tim`: tiap CO di CONFIG_ROLE dengan role FE/MR/BCH; `penyelesaianPct` = 100 − flow% pada bucket penyelesaian role-nya (kolom `BUCKET_PENYELESAIAN`); `targetPct` = tier 1 minggu berjalan (FE 40/60/75/95, MR 30/50/65/75, BCH 32/52/68/83).
  - `kerja.jatuhTempoBelumDkh`: kontrak non-fleet bucket awal NOOD/P001_030/P031_060, STATUS BAYAR bukan SUDAH BAYAR/LUNAS, hari JATUH TEMPO ≤ hari ini, tidak ada di DKH_ASSIGN bulan ini dengan STATUS ASSIGN/DIBUAT. `janjiHariIni`: JANJI BAYAR = hari ini.
  - `konteks.dkh` untuk dimensi `statusDkh` = himpunan kontrak itu juga.

- [ ] **Step 1: Tulis tes gagal** `tests/head.test.js` memanggil `susunHead` dengan fixture kecil (6 kontrak Task 3 + KA dengan `TGL BYR M1` + LPC 2 baris + DKH_ASSIGN 1 baris + `logHarian` berisi kemarin `CABANG FLOW NOOD pct 46`):
  - `diagnosa.nood.urai.statusNbq[0].nilai === 'APPEAL'`.
  - `kartu.find(k => k.kunci === 'flowNood').arah === 'memburuk'` dan `berubah` memuat `flowNood` dengan `selisih === 4` (50 − 46).
  - `logHarian` kosong → `riwayatCukup === false`, `berubah` kosong, `kartu[*].arah === null`.
  - `kerja.jatuhTempoBelumDkh` menghitung kontrak yang tidak ada di DKH_ASSIGN.
- [ ] **Step 2: Jalankan** → FAIL.
- [ ] **Step 3: Implementasi** `susunHead` dan cabang `mode=head` di handler: baca MASTER, KA HARIAN, LPC, DKH_ASSIGN, CONFIG_ROLE lewat `bacaSheet` paralel, plus `bacaLogHarian`. Mode lama (`all`/`nonfleet`) tidak berubah.
- [ ] **Step 4: Jalankan** `npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Mode head di /api/dashboard"`

### Task 6: Layar "Hari ini" dan kerangka menu head

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `GET /api/dashboard?mode=head` (Task 5).
- Produces (fungsi global di `index.html`): `HEAD_DATA` (cache sesi), `loadHead(lalu)` (fetch lalu memanggil `lalu`), `renderHariIni()`, `garisMingguan_(el, seri: {label, warna, nilai: number[4]}[], opsi)` (grafik SVG garis W1–W4, pola sama dengan `tglBayarChartRender`; dipakai Task 7).

- [ ] **Step 1: Menu.** Tambah `VIEW_TITLES.hariini = 'Hari ini'` dan `VIEW_TITLES.diagnosa = 'Diagnosa'`; dua tombol `nav-item` (`data-view="hariini"`, `data-view="diagnosa"`) yang hanya tampil untuk admin, di posisi paling atas sidebar dan dua slot pertama nav bawah HP. Admin membuka aplikasi langsung ke `hariini`. Menu lama tetap ada.
- [ ] **Step 2: `renderHariIni()`** sesuai spec §3 urutan 1–6 (tombol "Salin laporan" ditunda ke Rencana 2): kepala (tanggal, W ke- dan sisa hari), 6 kartu (2 kolom di HP; warna dari `arah`: membaik hijau, memburuk merah, null/tetap netral; `batasTeks` kecil di bawah angka), daftar `berubah` (sembunyikan bila kosong; bila `riwayatCukup` false tampil "Perbandingan dengan kemarin muncul setelah snapshot harian tercatat"), daftar `penyebab` (klik → `diagnosa` dengan angka itu terpilih), tabel kecil `tim`, dua angka `kerja`.
- [ ] **Step 3: Uji tampilan** dengan skrip Playwright di scratchpad (pola `ui2.py`: route `/api/**` palsu mengembalikan `HeadData` contoh, viewport 390×900): `document.documentElement.scrollWidth === 390`, tidak ada `pageerror`, screenshot dicek mata.
- [ ] **Step 4: Commit** `git commit -m "Layar Hari ini untuk head"`

### Task 7: Layar "Diagnosa"

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `HEAD_DATA.diagnosa`, `garisMingguan_` (Task 6), `openPanel`/panel detail kontrak yang sudah ada untuk klik nomor kontrak.
- Produces: `DIAG_ANGKA` (angka terpilih, default `'nood'`), `DIAG_DIM` (dimensi terpilih, default `'statusNbq'`), `renderDiagnosa()`.

- [ ] **Step 1: `renderDiagnosa()`** sesuai spec §4.1–4.5:
  1. Tombol pilihan angka (urutan: Balance/Flow NOOD, Flow 1-30, Flow 31-60, BTC 1-30, BTC 31-60, NBQ).
  2. Kotak jawaban singkat dari `kalimat` + tombol "Salin" (clipboard, teks polos).
  3. Grafik `garisMingguan_` bulan ini vs bulan lalu, dan grafik per segmen dengan toggle bulan ini/bulan lalu. Catatan di bawah grafik: "Berbasis tanggal bayar (bulan lalu: TGL BYR M1, bulan ini: LPC); bisa beda tipis dari penyelesaian resmi."
  4. Tab dimensi + tabel `urai` dengan kolom spec §4.4 (Nilai, Kontrak, Porsi beban, Rate, Porsi masalah, Indeks, Pengaruh poin); baris `pemberat` ditandai; di HP nominal dalam Rp juta (pola `dashJt_`).
  5. Tabel `irisan`.
  6. Daftar `teratas`; klik nomor membuka panel detail kontrak yang sudah ada.
- [ ] **Step 2: Uji tampilan** Playwright 390 px: tiap angka dan tiap tab dimensi bisa dipilih tanpa `pageerror`, `scrollWidth === 390` (tabel lebar boleh geser di dalam wadahnya sendiri).
- [ ] **Step 3: Commit** `git commit -m "Layar Diagnosa untuk head"`

### Task 8: Verifikasi akhir

**Files:** tidak ada perubahan kode kecuali perbaikan temuan.

- [ ] **Step 1:** `npm test` → semua PASS.
- [ ] **Step 2:** Bandingkan `HeadData` dengan data nyata terhadap angka Excel Head untuk satu tanggal (spec §11): Balance/Flow cabang, penyelesaian per CO, dan tabel penguraian STATUS NBQ serta GROUP PRODUCT untuk Flow NOOD. Catat selisih dan penyebabnya di PR.
- [ ] **Step 3:** Push branch, buka PR, laporkan ke Head. Merge hanya setelah Head menulis "merge". Setelah deploy, Head menjalankan cron sekali (atau menunggu jam 09.00) agar `LOG_HARIAN` mulai terisi.
