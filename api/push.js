// /api/push.js
// Handler compatível com seu HTML: { message, group, action, scheduleAt }
// - GET: status
// - OPTIONS: preflight CORS
// - POST: valida e (TODO) envia para seu provedor real
// Dica: proteja com uma chave (X-API-Key) se precisar.

export default async function handler(req, res) {
  // --- CORS básico ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Permite application/json OU text/plain (evita preflight em alguns webviews)
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== "object") body = {};

    const { message, group = null, action = null, scheduleAt = null } = body;

    // --- Validações mínimas ---
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Missing 'message'." });
    }
    if (message.length > 130) {
      return res.status(400).json({ ok: false, error: "Message exceeds 130 chars." });
    }
    if (action && (!action.type || !["none","external_url","section"].includes(action.type))) {
      return res.status(400).json({ ok: false, error: "Invalid 'action.type'." });
    }
    if (scheduleAt && isNaN(Date.parse(scheduleAt))) {
      return res.status(400).json({ ok: false, error: "Invalid 'scheduleAt' datetime." });
    }

    // --- (Opcional) Autorização por chave ---
    // const API_KEY = process.env.PUSH_API_KEY;
    // if (!req.headers["x-api-key"] || req.headers["x-api-key"] !== API_KEY) {
    //   return res.status(401).json({ ok: false, error: "Unauthorized" });
    // }

    // --- TODO: Integração real de envio ---
    // Aqui você conecta no seu provedor (GoodBarber Push, OneSignal, Firebase, Notifyer, etc.)
    // Exemplo de esqueleto de chamada externa:
    //
    // const resp = await fetch("https://SEU-PROVEDOR/push", {
    //   method: "POST",
    //   headers: { "Authorization": `Bearer ${process.env.PROVIDER_TOKEN}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ platform: "PWA", message, group, action, scheduleAt })
    // });
    // if (!resp.ok) {
    //   const txt = await resp.text().catch(() => "");
    //   return res.status(502).json({ ok:false, error:"Provider error", providerStatus: resp.status, providerBody: txt });
    // }
    // const providerJson = await resp.json().catch(() => ({}));

    // Como ainda é mock, devolvemos eco do payload:
    const result = {
      deliveredBy: "mock",
      platform: "PWA",
      group: group || "ALL",
      action: action || { type: "none" },
      scheduleAt: scheduleAt || null,
      message
    };

    return res.status(200).json({ ok: true, message: "Push enviado!", result });
  } catch (err) {
    console.error("Push error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
