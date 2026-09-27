// ============================================================
// DEBUG SEMENTARA — cek status webhook bot Telegram
// Buka aja di browser: https://<domain-vercel-kamu>/api/debug-webhook
// Nggak nge-expose token, cuma manggil getWebhookInfo dari Telegram.
// Hapus file ini kalau udah nggak dibutuhin lagi.
// ============================================================
module.exports = async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN tidak ditemukan di environment variables.' });
      return;
    }
    const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
