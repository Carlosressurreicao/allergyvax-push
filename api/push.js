// /api/push.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};

    const { message, group = null, action = null, scheduleAt = null } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, error: "Missing 'message'." });
    }

    // Mapeia ação do front para formato GoodBarber
    let gbAction = { type: "open_app" };
    if (action?.type === "external_url" && action.value) {
      gbAction = { type: "external_url", url: action.value };
    } else if (action?.type === "section" && action.value) {
      gbAction = { type: "section", section_id: action.value };
    }

    const payload = {
      message: message.trim(),
      platforms: ["pwa"],                  // só PWA
      ...(group ? { groups: [group] } : {}),
      action: gbAction,
      ...(scheduleAt ? { schedule_at: new Date(scheduleAt).toISOString() } : {})
    };

    const r = await fetch(`${process.env.GB_API_BASE}/api/v1/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GB-APP-ID": process.env.GB_APP_ID,
        "Authorization": `Bearer ${process.env.GB_API_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const txt = await r.text();
    let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: "GoodBarber error", providerStatus: r.status, providerBody: json });
    }

    return res.status(200).json({ ok: true, provider: "GoodBarber", result: json });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
