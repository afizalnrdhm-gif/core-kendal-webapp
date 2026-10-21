// KPI cabang (balance per bucket dari KA HARIAN, kumulatif, flow & BTC dari MASTER). Fungsi murni.
// Dipakai /api/dashboard dan cron snapshot harian. File berawalan "_" tidak dihitung Vercel sebagai function.
const BUCKET_ORDER = ['NOOD','P001_030','P031_060','P061_090','P091_120','P121_150','P151_180','P181_210'];
const BUCKET_LABEL = {
  NOOD:'NOOD', P001_030:'Bucket 01-30', P031_060:'Bucket 31-60', P061_090:'Bucket 61-90',
  P091_120:'Bucket 91-120', P121_150:'Bucket 121-150', P151_180:'Bucket 151-180', P181_210:'Bucket 181-210'
};
function bucketIndex(b) { return BUCKET_ORDER.indexOf(String(b == null ? '' : b).trim()); }
function sipokOf(m) { return typeof m['SIPOK'] === 'number' && isFinite(m['SIPOK']) ? m['SIPOK'] : 0; }
function sisaOf(k) { return typeof k['SISA PIUTANG'] === 'number' && isFinite(k['SISA PIUTANG']) ? k['SISA PIUTANG'] : 0; }

function hitungKpi(masterRows, kaRows, includeFleet) {
  const passFleet = (row) => includeFleet || row['FLEET/NON FLEET'] !== 'FLEET';
  const bucketAmounts = {}; const bucketCounts = {};
  BUCKET_ORDER.forEach(b => { bucketAmounts[b] = 0; bucketCounts[b] = 0; });
  (kaRows || []).forEach(ka => {
    if (!passFleet(ka)) return;
    const b = ka['BUCKET UPDATE'];
    if (BUCKET_ORDER.indexOf(b) > -1) { bucketAmounts[b] += sisaOf(ka); bucketCounts[b] += 1; }
  });
  const enr = BUCKET_ORDER.reduce((s, b) => s + bucketAmounts[b], 0);
  const enrCount = BUCKET_ORDER.reduce((s, b) => s + bucketCounts[b], 0);
  const perBucket = BUCKET_ORDER.map(b => ({
    kunci: b, label: BUCKET_LABEL[b], amount: bucketAmounts[b], count: bucketCounts[b],
    pct: enr > 0 ? (bucketAmounts[b] / enr) * 100 : 0
  }));
  const dari = (i) => ({
    amount: BUCKET_ORDER.slice(i).reduce((s, b) => s + bucketAmounts[b], 0),
    count: BUCKET_ORDER.slice(i).reduce((s, b) => s + bucketCounts[b], 0)
  });
  const cumulative = [
    { label: '0+ (TOD)', ...dari(1) }, { label: '30+ (Delq)', ...dari(2) }, { label: '60+', ...dari(3) },
    { label: '90+ (NPL)', ...dari(4) }, { label: '180+', ...dari(7) }
  ].map(r => ({ ...r, pct: enr > 0 ? (r.amount / enr) * 100 : 0 }));
  function flowStat(asal, target) {
    let totalAsal = 0, amt = 0, countAmt = 0;
    (masterRows || []).forEach(m => {
      if (!passFleet(m) || m['BUCKET AWAL'] !== asal) return;
      const sipok = sipokOf(m);
      totalAsal += sipok;
      if (m['BUCKET UPDATE'] === target) { amt += sipok; countAmt += 1; }
    });
    return { amount: amt, count: countAmt, pct: totalAsal > 0 ? (amt / totalAsal) * 100 : 0 };
  }
  const flowBtc = [
    { label: 'Flow NOOD', ...flowStat('NOOD', 'P001_030') },
    { label: 'Flow 1-30', ...flowStat('P001_030', 'P031_060') },
    { label: 'Flow 31-60', ...flowStat('P031_060', 'P061_090') },
    { label: 'Btc 01-30', ...flowStat('P001_030', 'NOOD') },
    { label: 'Btc 31-60', ...flowStat('P031_060', 'NOOD') }
  ];
  return { enr, enrCount, perBucket, cumulative, flowBtc };
}

// Flow "lebar": kontrak bucket awal `awal` yang BUCKET UPDATE-nya lebih buruk (bucket mana pun). Dasar penyelesaian = 100 - pct.
function flowLebar(masterRows, awal, includeFleet) {
  return rasio_(masterRows, awal, includeFleet, m => bucketIndex(m['BUCKET UPDATE']) > bucketIndex(awal));
}
// BTC: kontrak bucket awal `awal` yang sudah kembali ke NOOD.
function btcKe(masterRows, awal, includeFleet) {
  return rasio_(masterRows, awal, includeFleet, m => String(m['BUCKET UPDATE'] || '').trim() === 'NOOD');
}
function rasio_(masterRows, awal, includeFleet, kena) {
  let beban = 0, amount = 0, count = 0;
  (masterRows || []).forEach(m => {
    if (!includeFleet && m['FLEET/NON FLEET'] === 'FLEET') return;
    if (String(m['BUCKET AWAL'] || '').trim() !== awal) return;
    const s = sipokOf(m); beban += s;
    if (kena(m)) { amount += s; count += 1; }
  });
  return { amount, count, pct: beban > 0 ? amount / beban * 100 : 0, beban };
}

module.exports = { BUCKET_ORDER, BUCKET_LABEL, bucketIndex, sipokOf, sisaOf, hitungKpi, flowLebar, btcKe };
