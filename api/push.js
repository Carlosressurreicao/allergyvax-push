// /api/push.js — GoodBarber Push com headers completos
export default async function handler(req, res) {
  // === CORS ===
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== "object") body = {};

    const { message, group = null, action = null, scheduleAt = null } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Missing 'message'." });
    }
    if (message.length > 130) {
      return res.status(400).json({ ok: false, error: "Message exceeds 130 chars." });
    }

    const base = (process.env.GB_API_BASE || "https://allergyvax.goodbarber.app").replace(/\/+$/,"");
    const appId = process.env.GB_APP_ID;
    const token = process.env.GB_API_TOKEN;

    if (!appId || !token) {
      return res.status(500).json({ ok: false, error: "Missing GB_APP_ID or GB_API_TOKEN" });
    }

    // === Ação ===
    let gbAction = { type: "open_app" };
    if (action?.type === "external_url" && action.value) {
      gbAction = { type: "external_url", url: action.value };
    } else if (action?.type === "section" && action.value) {
      gbAction = { type: "section", section_id: action.value };
    }

    const payload = {
      message: message.trim(),
      platforms: ["pwa"],
      ...(group ? { groups: [group] } : {}),
      action: gbAction,
      ...(scheduleAt ? { schedule_at: new Date(scheduleAt).toISOString() } : {})
    };

    const url = `${base}/publicapi/v1/push`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GB-APP-ID": appId,
        "Authorization": `Bearer ${token}`,
        "X-GB-API-TOKEN": token  // <- incluímos também
      },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "GoodBarber error",
        providerStatus: r.status,
        providerBody: data
      });
    }

    return res.status(200).json({ ok: true, provider: "GoodBarber", urlUsed: url, result: data });

  } catch (err) {
    console.error("[push][fatal]", err);
    return res.status(500).json({ ok: false, error: "Internal error", detail: String(err) });
  }
}
