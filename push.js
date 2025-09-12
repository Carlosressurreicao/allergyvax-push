// Vercel Serverless Function – Push Proxy (GoodBarber) – apenas PWA
export default async function handler(req, res) {
  // ===== CORS =====
  const ALLOWED = [
    "https://SEU-APP.goodbarber.app",     // ✅ troque para o domínio do seu PWA
    "https://app.seu-dominio.com"         // ✅ se você usa domínio customizado
  ];
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED.includes(origin) ? origin : "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, group = null, action = null, scheduleAt = null } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "message required" });
    }
    if (String(message).trim().length > 130) {
      return res.status(400).json({ error: "message too long (max 130 chars)" });
    }

    const gbPayload = {
      message: String(message).trim(),
      platforms: ["pwa"],   // 🔒 fixo em PWA
      group,
      schedule_at: scheduleAt || null,
      action
    };

    const url = `https://classic.goodbarber.dev/publicapi/v1/webzines/${process.env.GB_WEBZINE_ID}/push/broadcasts`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GB_API_TOKEN}`,
        "X-GB-App-Id": process.env.GB_APP_ID
      },
      body: JSON.stringify(gbPayload)
    });

    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
