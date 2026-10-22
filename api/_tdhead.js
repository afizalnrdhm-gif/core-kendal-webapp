// Ringkasan Target Daily untuk head: capaian per PIC/poin (§7.4), status Waspada/Merah, dan penguraian kontrak
// daftar pagi yang belum bayar menurut status kerja (CMS), hasil kunjungan, janji bayar, segmen, dan jatuh tempo.
// Fungsi murni. Spec: docs/superpowers/specs/2026-10-21-tampilan-head-design.md §4.6.
const { hitungStreak, statusStreak } = require('./_tdsnap');
const { hariDari } = require('./_diagnosa');

const AC_BERTEMU = ['JB', 'BYR', 'SBY', 'STB', 'TRB'];
const AC_TIDAK = ['KPR', 'KTD', 'TKK', 'TTP'];
const teks = v => String(v == null ? '' : v).trim();
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const fmt2 = v => r2(v).toFixed(2).replace('.', ',');
const juta = v => 'Rp ' + (Math.round((Number(v) || 0) / 1e6) || 0).toLocaleString('id-ID') + ' jt';
const pad2 = n => String(n).padStart(2, '0');

// dkh: Set nomor kontrak ber-DKH bulan ini (DKH_ASSIGN) untuk kontrak yang tidak ada di data CMS (mis. DPD 0 tapi BUCKET UPDATE sudah 1-30).
function statusKerja_(item, no, dkh) {
  const m = item ? new Set((item.t || []).map(t => String(t).split('|').pop())) : new Set();
  if (m.has('dikerjakan')) return 'SUDAH DIKUNJUNGI';
  if (m.has('terbentuk')) return 'DKH, BELUM DIKERJAKAN';
  // Tidak ada tanda kerja dari CMS (baik tanpa item, atau item ada tapi tidak match PIC/awal) → cek DKH_ASSIGN bulan ini.
  // dkh = null berarti DKH_ASSIGN gagal dibaca; jangan menyimpulkan BELUM DKH dari data yang sebenarnya tidak ada.
  if (!dkh) return 'TIDAK ADA DATA';
  return dkh.has(no) ? 'ADA DKH (TANPA DATA KUNJUNGAN)' : 'BELUM DKH';
}
function hasil_(item) {
  const kode = teks(item && item.ac).split('|')[0].trim().toUpperCase();
  if (!kode) return 'BELUM ADA HASIL';
  if (AC_BERTEMU.includes(kode)) return 'BERTEMU: ' + kode;
  if (AC_TIDAK.includes(kode)) return 'TIDAK BERTEMU: ' + kode;
  return 'LAINNYA: ' + kode;
}
function janji_(m, hari) {
  const h = hariDari(m && m['JANJI BAYAR']);
  if (h == null) return 'TANPA JANJI';
  return h === hari ? 'JANJI HARI INI' : h > hari ? 'JANJI MUNDUR' : 'JANJI LEWAT (INGKAR)';
}
const minggu_ = h => h == null ? '-' : h <= 7 ? 'W1' : h <= 14 ? 'W2' : h <= 21 ? 'W3' : 'W4';

function susunTargetDailyHead({ td, base, hasil, cmsItems, master, hariIni, dkh }) {
  base = base || {}; hasil = hasil || [];
  const tglIni = `${hariIni.tahun}-${pad2(hariIni.bulan)}-${pad2(hariIni.hari)}`;
  const bulanIni = tglIni.slice(0, 7);
  const adaBaseline = Object.keys(base).length > 0;
  const streak = hitungStreak(hasil.filter(x => x.tanggal !== tglIni)).daftar;
  const item = new Map((cmsItems || []).map(it => [teks(it.k), it]));
  const mst = new Map((master || []).map(m => [teks(m['NO KONTRAK']), m]));

  const belumPer = new Map(); // noKontrak -> {no, nama, co, sipok}
  let totPoin = 0, totTuntas = 0;
  const pic = (td.pic || []).map(p => ({
    co: p.namaCO, role: p.role,
    poin: (p.poin || []).map(q => {
      const g = q.progres, b = base[p.namaCO + '|' + q.kunci];
      const pagi = new Set(((b && b.kontrak) || []).map(x => teks(x[0])));
      const belum = (q.belum || []).filter(x => pagi.has(teks(x[0]))).sort((a, c) => (Number(c[1]) || 0) - (Number(a[1]) || 0));
      belum.forEach(x => { const no = teks(x[0]); if (!belumPer.has(no)) belumPer.set(no, { no, nama: teks(x[2]), co: p.namaCO, sipok: Number(x[1]) || 0 }); });
      const st = streak.find(x => x.pic === p.namaCO && x.kunci === q.kunci);
      const streakHari = st ? st.hari : 0;
      const target = g ? Number(g.targetHari) || 0 : 0, realisasi = g ? Number(g.tercapai) || 0 : 0;
      // Tidak dijumlah jadi satu rupiah: poin FE/MR dan poin BCH (cabang) tumpang tindih kontrak yang sama,
      // dan arah balance vs flow berlawanan — menjumlahkannya bisa menghasilkan "realisasi" rupiah yang minus/tidak berarti.
      // Agregat total memakai hitungan poin tuntas saja (lihat total di bawah).
      if (g) { totPoin++; if (g.tuntas) totTuntas++; }
      return {
        kunci: q.kunci, judul: q.judul || q.kunci, target, realisasi,
        capaianPct: g ? r2(target > 0 ? realisasi / target * 100 : 100) : null,
        tuntas: g ? !!g.tuntas : null, kurangRp: g ? Math.max(0, target - realisasi) : 0,
        status: statusStreak(streakHari), streakHari, belumKontrak: belum.slice(0, 5).map(x => teks(x[0]))
      };
    })
  }));

  // Penguraian kontrak belum bayar
  const daftar = [...belumPer.values()];
  const totSipok = daftar.reduce((s, x) => s + x.sipok, 0);
  const DIM = {
    pic: x => x.co,
    statusKerja: x => statusKerja_(item.get(x.no), x.no, dkh),
    hasil: x => hasil_(item.get(x.no)),
    janji: x => janji_(mst.get(x.no), hariIni.hari),
    segmen: x => teks((mst.get(x.no) || {})['SEGMEN PEKERJAAN']).toUpperCase() || 'TIDAK DIKETAHUI',
    jatuhTempo: x => minggu_(hariDari((mst.get(x.no) || {})['JATUH TEMPO']))
  };
  const urai = {};
  Object.keys(DIM).forEach(d => {
    const g = new Map();
    daftar.forEach(x => { const k = DIM[d](x); const v = g.get(k) || { nilai: k, kontrak: 0, sipok: 0 }; v.kontrak += 1; v.sipok += x.sipok; g.set(k, v); });
    urai[d] = [...g.values()].map(v => Object.assign(v, { porsiPct: totSipok > 0 ? r2(v.sipok / totSipok * 100) : 0 })).sort((a, b) => b.sipok - a.sipok);
  });
  const teratas = daftar.sort((a, b) => b.sipok - a.sipok).slice(0, 20).map(x => ({
    noKontrak: x.no, nama: x.nama, co: x.co, sipok: x.sipok,
    statusKerja: DIM.statusKerja(x), hasil: DIM.hasil(x), janji: DIM.janji(x)
  }));

  // Tren capaian harian per PIC (rata-rata persen poin) bulan berjalan
  const tren = {};
  const per = {};
  hasil.filter(x => String(x.tanggal).startsWith(bulanIni)).forEach(x => { const k = x.pic + '|' + x.tanggal; (per[k] = per[k] || { pic: x.pic, tanggal: x.tanggal, n: 0, s: 0 }); per[k].n++; per[k].s += Number(x.persen) || 0; });
  Object.values(per).forEach(v => { (tren[v.pic] = tren[v.pic] || []).push({ tanggal: v.tanggal, persen: r2(v.s / v.n) }); });
  Object.keys(tren).forEach(k => tren[k].sort((a, b) => a.tanggal.localeCompare(b.tanggal)));

  // Kalimat
  const kalimat = [];
  if (!adaBaseline) kalimat.push('Target hari ini belum dibekukan (cron 09.00 atau tombol Bekukan di menu Target Daily), jadi realisasi belum bisa dihitung.');
  else {
    kalimat.push(`Target daily hari ini: ${totTuntas} dari ${totPoin} poin tuntas.`);
    const semua = []; pic.forEach(p => p.poin.forEach(q => semua.push(Object.assign({ co: p.co }, q))));
    const kurang = semua.filter(q => q.kurangRp > 0).sort((a, b) => b.kurangRp - a.kurangRp)[0];
    if (kurang) kalimat.push(`Kekurangan terbesar: ${kurang.judul} ${kurang.co} kurang ${juta(kurang.kurangRp)} (realisasi ${juta(kurang.realisasi)} dari target ${juta(kurang.target)}).`);
    const sk = urai.statusKerja[0];
    if (sk && daftar.length) kalimat.push(`${fmt2(sk.porsiPct)}% nilai kontrak daftar pagi yang belum bayar berstatus ${sk.nilai} (${sk.kontrak} kontrak, ${juta(sk.sipok)}).`);
    const merah = semua.filter(q => q.status === 'MERAH');
    if (merah.length) kalimat.push(`Status merah (meleset 3 hari atau lebih berturut-turut): ${merah.map(q => q.judul + ' ' + q.co + ' (' + q.streakHari + ' hari)').join(', ')}.`);
  }

  return { adaBaseline, pic, total: { poinTuntas: totTuntas, poinTotal: totPoin }, kalimat, belum: { kontrak: daftar.length, sipok: totSipok, urai }, teratas, tren };
}

module.exports = { susunTargetDailyHead };
