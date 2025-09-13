// /api/push.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const DEBUG = process.env.DEBUG_PUSH === "1";
  const dbg = (...a) => { if (DEBUG) console.log("[push]", ...a); };

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
    if (scheduleAt && isNaN(Date.parse(scheduleAt))) {
      return res.status(400).json({ ok: false, error: "Invalid 'scheduleAt' datetime." });
    }

    const appId = process.env.GB_APP_ID;
    const token = process.env.GB_API_TOKEN;

    // candidatos de base
    const baseCandidates = [];
    if (process.env.GB_API_BASE && process.env.GB_API_BASE.trim()) {
      baseCandidates.push(process.env.GB_API_BASE.replace(/\/+$/,""));
    }
    baseCandidates.push("https://allergyvax.goodbarber.app");
    baseCandidates.push("https://www.allergyvax.com");

    const pathCandidates = ["/api/v1/push", "/publicapi/v1/push", "/api/push"];

    dbg({ message, group, action, scheduleAt, baseCandidates, pathCandidates });

    if (!appId || !token) {
      return res.status(500).json({ ok: false, error: "Missing GB_APP_ID or GB_API_TOKEN env" });
    }

    let attempts = [];

    for (const base of baseCandidates) {
      for (const path of pathCandidates) {
        const url = `${base}${path}`;
        dbg("Trying URL:", url);
        try {
          const payload = {
            message: message.trim(),
            platforms: ["pwa"],
            ...(group ? { groups: [group] } : {}),
            action: (action && action.type && action.value) ? 
              (action.type === "external_url"
                ? { type: "external_url", url: action.value }
                : (action.type === "section" ? { type: "section", section_id: action.value } : { type: "open_app" })
              )
              : { type: "open_app" },
            ...(scheduleAt ? { schedule_at: new Date(scheduleAt).toISOString() } : {})
          };

          const r = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-GB-APP-ID": appId,
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          const raw = await r.text();
          let data;
          try { data = JSON.parse(raw); } catch { data = { raw }; }

          dbg("Response:", r.status, data);

          if (r.ok) {
            return res.status(200).json({ ok: true, provider: "GoodBarber", urlUsed: url, result: data });
          } else {
            attempts.push({ url, status: r.status, body: data });
          }
        } catch (e) {
          attempts.push({ url, error: String(e) });
        }
      }
    }

    // se nenhum funcionou
    return res.status(502).json({
      ok: false,
      error: "GoodBarber calls all failed",
      attempts
    });

  } catch (err) {
    console.error("[push][fatal]", err);
    return res.status(500).json({
      ok: false,
      error: "Internal error",
      detail: DEBUG ? String(err) : undefined
    });
  }
}
