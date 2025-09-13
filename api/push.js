// File: api/push.js
export default async function handler(req, res) {
  // Permite CORS (ajuste o domínio em produção)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // 1) Preferir variáveis de ambiente da Vercel
    const APP_ID_ENV  = process.env.GB_APP_ID;
    const API_KEY_ENV = process.env.GB_API_KEY;

    // 2) Body do cliente (HTML) pode enviar appId/apiKey se você preferir sobrescrever
    const { appId: appIdFromBody, apiKey: apiKeyFromBody, payload } = req.body || {};

    const appId = (appIdFromBody || APP_ID_ENV || "").trim();
    const apiKey = (apiKeyFromBody || API_KEY_ENV || "").trim();

    if (!appId || !apiKey) {
      return res.status(400).json({
        ok: false,
        error: "Missing credentials",
        hint: "Defina GB_APP_ID e GB_API_KEY no painel da Vercel ou envie appId/apiKey no body."
      });
    }
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        ok: false,
        error: "Missing payload",
        example: {
          title: "Alerta",
          text: "Texto da notificação",
          target: { platform: ["ios","android","pwa"], groups: ["SCIT"] },
          deeplink: { type: "url", value: "https://seuapp..." }
        }
      });
    }

    const url = `https://api.goodbarber.com/1/${encodeURIComponent(appId)}/push`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GoodBarber-ApiKey": apiKey
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(upstream.status).json({
      ok: upstream.ok,
      status: upstream.status,
      data
    });
  } catch (err) {
    return res.status(500).json({ ok:false, error: String(err) });
  }
}

