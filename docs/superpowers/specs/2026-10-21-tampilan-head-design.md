# Desain Ulang Tampilan Head — Monitoring System CORE Kendal

Tanggal: 21 Oktober 2026
Status: draf untuk direview Ijal (Collection Head)
Cakupan: hanya tampilan head/admin. Tampilan CO dan admin lain tidak diubah.

## 1. Masalah dan tujuan

**Masalah.** Head punya 13 menu (Dashboard, Beban Awal, Target Daily, Usulan DKH, CMS, NBQ, FE Ever, Tgl Bayar Bulan Lalu, Insentif, Deskcall, Simulasi Rapor, Simulasi Penawaran, Panduan KPI). Menu disusun per sumber data, sementara atasan bertanya "kenapa". Head harus merangkai jawaban sendiri dari banyak menu, dan sebagian besar menu tidak terpakai.

**Tujuan.** Tampilan head menjadi alat untuk menjawab dan melaporkan pertanyaan atasan dengan data, bukan jawaban normatif. Pertanyaan yang berulang:

- Kenapa target daily tidak achieve.
- Kenapa penyelesaian Balance NOOD lemah.
- Kenapa BTC lemah.
- Kenapa angka Kendal anomali.

**Ukuran berhasil.**

- Head bisa menjawab tiap pertanyaan di atas dari satu layar, lengkap dengan angka, penyebab terbesar, dan pengaruhnya dalam poin persen.
- Jawaban bisa dikirim ke atasan lewat WA atau Telegram (teks dan gambar) dalam satu ketuk.
- Menu head berkurang dari 13 menjadi 4 menu utama.

**Keputusan yang sudah diambil.**

- Tanpa bot AI berbayar. Penjelasan dan rekomendasi dibuat oleh mesin aturan yang bisa diaudit. Bot AI bisa ditambah nanti di atas mesin yang sama.
- Mesin diagnosis mengikuti §8 spec aplikasi baru (project 3, `core-kendal-command`).
- Target daily mengikuti §7.4 spec project 3, bukan logic realisasi LPC yang lama.
- Laporan ke atasan berbentuk pesan WA/Telegram dengan gambar.

## 2. Susunan menu head

| Menu baru | Menggantikan |
|---|---|
| Hari ini | Dashboard, Beban Awal |
| Diagnosa | Pemberat, Pola bayar segmen, Tgl Bayar Bulan Lalu, FE Ever, CMS |
| Tindak lanjut | Target Daily, Usulan DKH, NBQ |
| Laporan | baru |

Insentif, Simulasi Rapor, Simulasi Penawaran, Panduan KPI, dan Deskcall dipindah ke menu "Lainnya". Menu lama tetap berjalan sampai menu baru dipakai beberapa hari, lalu Head memutuskan mana yang dibuang.

## 3. Layar 1 — Hari ini

Tujuan: dalam 10 detik Head tahu kondisi hari ini, apa yang memburuk, dan penyebab utamanya.

1. **Kepala.** Tanggal data (H-1), minggu berjalan dan sisa hari, jam terakhir sheet diperbarui.
2. **Enam kartu.** Penyelesaian Balance NOOD (aktual vs target minggu), Flow NOOD, Flow 1-30, Flow 31-60, BTC 1-30, 30+ (Delq). Tiap kartu: nilai, target, warna status (aman, waspada, merah), dan perubahan dari kemarin (setelah snapshot harian tersedia).
3. **Yang berubah sejak kemarin.** Maksimal 3 baris, muncul bila perubahan melewati ambang (§7.3).
4. **Tiga penyebab utama hari ini.** Kalimat dan saran dari mesin diagnosis. Klik membuka Diagnosa untuk angka itu.
5. **Tim.** Satu baris per CO: penyelesaian vs target, % DKH dikerjakan, janji bayar hari ini.
6. **Yang harus dikerjakan hari ini.** Jumlah saja (mis. kontrak jatuh tempo belum DKH, janji bayar jatuh hari ini). Klik membuka Tindak lanjut.
7. **Salin laporan.** Ringkasan layar ini untuk WA/Telegram.

Tidak ada tabel panjang atau sebaran semua bucket di layar ini.

## 4. Layar 2 — Diagnosa

Tujuan: setiap pertanyaan atasan terjawab di satu layar.

### 4.1 Pilihan angka

Target Daily, Balance NOOD, BTC, Flow 1-30, Flow 31-60, NBQ, Anomali. "Anomali" menampilkan angka yang paling menyimpang hari ini.

### 4.2 Isi untuk tiap angka

1. **Jawaban singkat.** 2–4 kalimat dari mesin aturan, berisi angka, penyebab terbesar, pengaruh dalam poin, dan saran. Contoh (data 15 Okt): "Penyelesaian Balance NOOD tertahan terutama oleh kontrak NBQ status APPEAL: 44% beban, tapi 52% flow, dengan flow rate 58,6% dibanding rata-rata 50,2%. Seandainya APPEAL setara rata-rata, penyelesaian naik 3,7 poin. Mayoritas unit mobil (MOBILKU)."
2. **Grafik weekly** (lihat 4.3).
3. **Penguraian per dimensi** (lihat 4.4).
4. **Irisan dua dimensi.** Kombinasi dengan minimal 3 kontrak, diurutkan dari pengaruh terbesar, mis. "MOBILKU × APPEAL".
5. **Kontrak penyumbang terbesar.** 20 kontrak dengan SIPOK terbesar. Klik membuka panel detail kontrak yang sudah ada.

### 4.3 Grafik penyelesaian weekly

- **Bulan ini vs bulan lalu.** Garis W1–W4. Nilai tiap minggu = % SIPOK beban yang sudah bayar sampai hari terakhir minggu itu (W1 tgl 1–7, W2 8–14, W3 15–21, W4 22–akhir bulan).
  - Bulan lalu: tanggal bayar dari kolom TGL BYR M1 di KA HARIAN.
  - Bulan ini: tanggal bayar aktual.
  - Catatan di grafik: angka berbasis tanggal bayar, bisa beda tipis dari penyelesaian resmi (100 − flow).
- **Per segmen pekerjaan.** Grafik yang sama, satu garis per SEGMEN PEKERJAAN (Wiraswasta, Karyawan, Serabutan), dengan pilihan bulan ini atau bulan lalu.

### 4.4 Penguraian (pemberat)

Berlaku untuk Balance NOOD, Flow NOOD, Flow 1-30, Flow 31-60, BTC, dan NBQ. Dimensi: CO, GROUP PRODUCT, TYPE BARANG, STATUS NBQ (status approval), SEGMEN PEKERJAAN, MOB, tanggal jatuh tempo/DPD, status DKH, janji bayar, kontrak besar (≥ Rp100 jt), fleet. Dimensi lain dari §8 project 3 (kecamatan, dealer, CMO, merk, pola bayar M1–M3) ditambahkan setelah versi pertama dipakai.

Untuk tiap nilai dimensi, dengan "masalah" = SIPOK yang flow/belum bayar:

| Kolom | Rumus |
|---|---|
| Kontrak | jumlah kontrak di grup |
| Porsi beban | beban grup / beban total |
| Rate | masalah grup / beban grup |
| Porsi masalah | masalah grup / masalah total |
| Indeks | porsi masalah / porsi beban (> 1 = menyumbang lebih dari bagiannya) |
| Pengaruh (poin) | (masalah grup − beban grup × rate rata-rata) / beban total × 100 |

Kolom "Pengaruh" dibaca: berapa poin penyelesaian akan naik bila grup itu berperilaku seperti rata-rata cabang. Grup ditandai "pemberat" bila indeks ≥ 1,15 dan pengaruh ≥ 1 poin, atau porsi masalah ≥ 30%.

### 4.5 NBQ belum realisasi

- Komposisi kontrak NBQ yang belum bayar per GROUP PRODUCT, TYPE BARANG, STATUS NBQ (APPEAL, PRE APPROVAL, NORMAL, AUTO APPROVAL), dan MOB.
- Penyelesaian NBQ total, dan pengaruh tiap status approval terhadapnya dalam poin persen (rumus 4.4).
- Kontrak dengan STATUS NBQ kosong atau #N/A dihitung sebagai "NON NBQ".

### 4.6 Target Daily

Menjawab "kenapa target daily tidak achieve". Rumus target dan realisasi mengikuti §5.

1. Jawaban singkat: realisasi vs target per CO dan poin, kekurangan terbesar.
2. Tren capaian harian bulan ini per CO, dari hasil harian yang dibekukan.
3. Penguraian kontrak potensial yang belum bayar: per CO dan poin, status kerja (belum DKH, DKH belum dikerjakan, sudah dikunjungi), hasil kunjungan (action code bertemu/tidak bertemu), janji bayar (hari ini, mundur, tanpa janji), segmen, dan tanggal jatuh tempo.
4. Kontrak potensial belum bayar dengan SIPOK terbesar.

## 5. Target Daily (mengikuti §7.4 project 3)

Rumus target sudah dipakai sejak PR #51. Yang berubah adalah realisasi.

```
posisi_awal(D) = nilai parameter saat dibekukan pagi hari D
target(D)      = max(0, selisih_terhadap_batas(posisi_awal(D))) / sisa_hari(D)
realisasi(D)   = posisi_sekarang(D) − posisi_awal(D), positif bila bergerak ke arah yang diinginkan
                 (Balance NOOD naik; Balance 1-30/31-60/30+ dan Flow "belum bayar" turun)
capaian(D)     = realisasi(D) / target(D)
```

Alur data di sheet:

| Waktu | Kejadian di sheet | Arti |
|---|---|---|
| Pagi | KA HARIAN diperbarui, rumus REALISASI dimatikan | posisi awal; cron 09.00 WIB membekukannya |
| Siang/sore | LPC diperbarui, rumus REALISASI dinyalakan | posisi bergerak; realisasi terbaca |
| Pagi berikutnya | data baru masuk | hasil kemarin dibekukan ke LOG_TARGET_HASIL |

- Sudah dikonfirmasi Head (21 Okt): setelah rumus REALISASI dinyalakan, BUCKET UPDATE kontrak yang realisasi ikut berubah. Jadi posisi sekarang dibaca dari BUCKET UPDATE.
- Sebelum LPC diperbarui, realisasi tampil 0.
- Peringatan: meleset 1–2 hari berturut-turut = Waspada, 3 hari = Merah.
- Tombol admin "Bekukan ulang" tetap ada untuk hari ketika update pagi lewat jam 9.
- Daftar kontrak potensial tetap disusun seperti sekarang (§7.4 project 3, poin terakhir).

## 6. Layar 3 — Tindak lanjut

1. **Tindakan hari ini.** Maksimal 5, dari mesin diagnosis: temuan, alasan, kontrak sasaran, PIC, dampak rupiah.
2. **Target Daily per CO.** Target, realisasi, capaian, status Waspada/Merah, daftar kontrak potensial.
3. **Usulan DKH besok.** Usulan dari CO, setujui, salin ke WA (format yang ada).
4. **NBQ.** Kontrak yang perlu perhatian head.
5. **Hasil tindakan kemarin.** Apakah kontrak sasaran sudah bayar atau membaik.

Versi pertama: poin 1 dan 5 tanpa alur setuju/tolak.

## 7. Mesin diagnosis

### 7.1 Prinsip

- Semua angka dihitung dengan rumus di spec ini. Tidak ada model AI.
- Tiap kalimat berasal dari pola kalimat dengan angka yang bisa ditelusuri ke tabel penguraian.
- Rekomendasi berasal dari aturan "jika penyebab utama X, saran Y". Resep aturan diisi bersama Head, satu pertanyaan demi satu.

### 7.2 Langkah (ringkas dari §8 project 3)

1. Hitung selisih tiap KPI terhadap batas, dalam rupiah dan poin.
2. Uraikan per dimensi (4.4).
3. Cari irisan dua dimensi dengan minimal 3 kontrak.
4. Urutkan menurut pengaruh poin.
5. Bedakan penyebab struktural (beban berat, konsentrasi nominal, kualitas asal) dan perilaku (belum disentuh, janji terlewat, DKH tidak jalan).
6. Hasilkan maksimal 5 tindakan.

### 7.3 Ambang "yang berubah sejak kemarin"

Muncul bila perubahan harian sebuah KPI ≥ 2 poin, atau KPI berpindah warna status. Ambang disimpan sebagai konstanta yang bisa diubah.

## 8. Layar 4 — Laporan

1. Pilih jenis: Harian pagi (Hari ini + 3 penyebab + rencana), Target Daily sore (capaian per CO + penyebab + kontrak belum bayar), Jawab pertanyaan (satu angka dari Diagnosa).
2. Pratinjau teks (bisa diedit) dan gambar.
3. Salin teks, unduh gambar, atau kirim ke grup Telegram lewat bot yang sudah ada.

Gambar dibuat dengan satori + sharp seperti Achievement Harian.

## 9. Data

### 9.1 Sumber yang sudah ada

- MASTER: BUCKET AWAL, BUCKET UPDATE, SIPOK, GROUP PRODUCT, TYPE BARANG, NBQ (MOB), STATUS NBQ, SEGMEN PEKERJAAN, JANJI BAYAR, CO ALL, FLEET/NON FLEET.
- KA HARIAN (header baris 16): TGL BYR M1–M3, REALISASI, BUCKET UPDATE, DPD, NAMA MERK, NAMA DEALER, NAMA CMO, KATEGORI PEKERJAAN, SEGMEN USAHA.
- LPC: TGL BYR, TOTAL BYR.
- PRODUCTIVITY, DKH_ASSIGN, USULAN_DKH: status kerja dan hasil kunjungan.
- LOG_TARGET_DAILY, LOG_TARGET_HASIL: baseline dan hasil harian target daily.

### 9.2 Baru: snapshot harian cabang

Tab baru `LOG_HARIAN`, ditulis oleh cron 09.00 WIB yang sudah ada. Satu baris per tanggal per KPI per lingkup (cabang dan tiap CO): TANGGAL, LINGKUP, KPI, NILAI_AMT, NILAI_PCT. KPI: Balance per bucket, Flow NOOD/1-30/31-60, BTC 1-30/31-60, 30+, 60+, 90+, 180+, ENR.

Dipakai untuk perubahan dari kemarin (Layar 1) dan perbandingan tanggal sama bulan lalu. Selama riwayat belum ada, bagian yang membutuhkannya menampilkan "riwayat belum cukup".

### 9.3 Endpoint

- `GET /api/head` — semua angka Layar 1 dan Diagnosa untuk satu permintaan, dengan cache baca sheet 45 detik seperti `api/insentif.js`. Hanya untuk admin (`ADMIN_EMAILS`).
- Mesin diagnosis ditulis sebagai modul terpisah (`api/_diagnosa.js`) berisi fungsi murni yang menerima baris data dan mengembalikan tabel penguraian, irisan, dan kalimat. Mudah diuji tanpa sheet.

## 10. Privasi

Tidak ada data dikirim ke layanan luar. Laporan ke atasan berisi angka agregat dan nomor kontrak; nama konsumen hanya tampil di layar head.

## 11. Pengujian

- Uji unit `api/_diagnosa.js` dengan data contoh: rumus porsi, indeks, pengaruh poin, irisan, dan ambang pemberat.
- Validasi angka terhadap Excel Head untuk satu tanggal: Balance/Flow cabang dan per CO, serta tabel penguraian STATUS NBQ dan GROUP PRODUCT.
- Uji tampilan di lebar HP 390 px tanpa geser horizontal.

## 12. Urutan pembangunan

1. Snapshot harian (`LOG_HARIAN`) dan kerangka menu head baru (menu lama tetap ada).
2. Layar Hari ini.
3. Diagnosa: Balance NOOD, Flow, NBQ, grafik weekly, penguraian dan irisan.
4. Diagnosa Target Daily dengan realisasi §7.4.
5. Tindak lanjut.
6. Laporan.
7. Menu lama dibuang setelah disetujui Head.

## 13. Hal yang masih terbuka

- Resep rekomendasi ("jika penyebab X, saran Y") diisi bersama Head per pertanyaan.
- Definisi "Anomali Kendal": dibanding apa (bulan lalu, target, atau cabang lain). Data cabang lain belum tersedia.
- Ambang pemberat (indeks 1,15, pengaruh 1 poin, porsi 30%) dan ambang perubahan harian (2 poin) dicek ulang setelah dipakai dengan data nyata.
