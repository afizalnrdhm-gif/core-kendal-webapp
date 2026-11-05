# Menu "Jualan Booking Mandiri" (Top Up Pinjaman) — Design

## Tujuan
Menu privat (khusus akun Ijal, afizalnuradhim628@gmail.com — tidak untuk 2 admin lain
yang perannya atasan/pengawas) untuk merekomendasikan konsumen aktif yang layak
ditawari top up pinjaman multiguna (jaminan BPKB), lalu memfasilitasi penawaran via
WhatsApp dan mencatat status tindak lanjutnya. Perhitungan plafon/cicilan aktual tetap
di luar sistem ini (dibantu marketing) — sistem ini hanya menyaring kandidat dan
memfasilitasi kontak awal.

## Kriteria rekomendasi (scope & sinyal)
Scope: `BUCKET AWAL` ∈ {`NOOD`, `P001_030`} saja (konsumen yang masih lancar/ringan).

Kontrak masuk daftar rekomendasi kalau memenuhi **salah satu** (OR) dari:
1. **Mau Lunas** — sisa angsuran (`TENOR` − `ANGS KE`) = 1
2. **Angsuran Tinggal Sedikit** — sisa angsuran (`TENOR` − `ANGS KE`) < 10
3. **SIPOK Kecil** — ` SIPOK` < Rp10.000.000

Skor prioritas = jumlah tag yang kepenuhi (1–3), dipakai buat urutan default
(descending skor, lalu SIPOK ascending).

Kolom `TYPE UNIT` dan `TYPE BARANG` tetap ditampilkan di tabel supaya Ijal bisa
eyeball manual kasus "motor mahal tapi SIPOK kecil" (potensi sinyal ke-4) — ini
sengaja TIDAK diotomasi di v1 karena MASTER tidak punya kolom tahun kendaraan dan
`TYPE UNIT` adalah teks bebas yang sulit di-match akurat ke `OTR_PRICELIST`/
`TYPE_ID_MAPPING`. Jadi sinyal ke-4 ditunda ke fase berikutnya kalau pola ini
terbukti berguna.

## Kontrol akses
- Env var baru `TOPUP_OWNER_EMAILS` (daftar email dipisah koma, format sama seperti
  `ADMIN_EMAILS`) — hanya email yang ada di sini yang dapat data status top up dan
  menu-nya tampil.
- `api/data.js`: untuk request admin, cek apakah `email` ada di `TOPUP_OWNER_EMAILS`.
  Kalau ya → fetch tab `TOPUP_STATUS`, merge `_TOPUP_STATUS` ke tiap record, dan kirim
  flag `canTopup: true` di response. Kalau tidak (termasuk 2 admin lain) →
  `canTopup: false`, tidak ada field status top up yang dikirim.
- Frontend: nav menu "Jualan Top Up" hanya tampil kalau `canTopup === true` (bukan
  cuma `IS_ADMIN`).
- `api/topup-status.js` (endpoint POST baru, dipakai buat update status): verifikasi
  ulang `email` request ada di `TOPUP_OWNER_EMAILS` sebelum menulis ke sheet — jangan
  cuma mengandalkan UI yang disembunyikan.

## Penyimpanan status tindak lanjut
Tab baru di spreadsheet yang sama: **`TOPUP_STATUS`**
Kolom: `NO KONTRAK`, `STATUS`, `UPDATED_AT`, `UPDATED_BY`.
Status yang valid: `BELUM DIHUBUNGI` (default/tersirat kalau row belum ada),
`SUDAH DITAWARI`, `TERTARIK`, `TIDAK TERTARIK`.

`api/topup-status.js` (POST, body `{ noKontrak, status }`):
1. Verifikasi token login & email ada di `TOPUP_OWNER_EMAILS`.
2. Validasi `status` salah satu dari daftar di atas.
3. Baca tab `TOPUP_STATUS`, cari baris dengan `NO KONTRAK` yang sama.
   - Kalau ketemu → update kolom `STATUS`/`UPDATED_AT` di baris itu.
   - Kalau belum ada → append baris baru.
4. Balikin `{ ok: true }`.

Kalau tab `TOPUP_STATUS` belum ada di spreadsheet, endpoint ini akan gagal dengan
pesan jelas (bukan silent fail) — tab perlu dibuat manual dulu (atau oleh Claude lewat
Google Sheets API saat implementasi, dengan konfirmasi ke user).

## Frontend
Menu baru `topup` — mengikuti pola persis menu Freshflow yang sudah ada
(`buildTopupLayout()` / `renderTopupTable()`, filter per CO, search, sort, reset,
refresh, pagination via `pageRows()`).

Kolom tabel: CO, No Kontrak, Nama Konsumen (+ ikon WA via `rowWa()` existing), Bucket,
Type Barang/Unit, SIPOK, Sisa Angsuran, Tag (badge Mau Lunas/Angsuran Tinggal
Sedikit/SIPOK Kecil), Status (dropdown, memicu `POST /api/topup-status`), Jatuh Tempo.

Tombol "Kirim WA" pakai helper baru `waLinkText(raw, text)` (extend dari `waLink()`
yang sudah ada, tambah parameter teks terenkode) dengan template pembuka generik:

> "Halo Bapak/Ibu {nama}, perkenalkan dari WOM Finance Kendal. Konsumen kami yang
> pembayarannya lancar berkesempatan untuk mengajukan tambahan pinjaman (top up).
> Apakah Bapak/Ibu berkenan untuk kami bantu informasikan lebih lanjut?"

## Testing
- Playwright smoke test (pola sama seperti test Freshflow): render menu, cek 3 tag
  filter data dummy dengan benar, cek tombol WA menghasilkan link `wa.me` dengan teks
  terenkode, cek update status memanggil endpoint dengan payload benar (mock fetch).
- `npm test` tetap harus 0 regresi di 46 test yang sudah ada.
- Menu HANYA muncul untuk email di `TOPUP_OWNER_EMAILS` — test eksplisit bahwa akun
  admin lain (`canTopup: false`) tidak melihat nav item maupun data status.
