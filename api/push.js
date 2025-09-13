// /api/push.js — debug + fallback de paths para GoodBarber
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const DEBUG = process.env.DEBUG_PUSH === "1";
  const dbg = (...a) => { if (DEBUG) console.log("[push]", ...a); };

  try {
    // Permite JSON ou text/plain
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};
    const { message, group = null, action = null, scheduleAt = null } = body;

    if (!message || typeof message !== "string" || !message.trim())
      return res.status(400).json({ ok: false, error: "Missing 'message'." });
    if (message.length > 130)
      return res.status(400).json({ ok: false, error: "Message exceeds 130 chars." });
    if (scheduleAt && isNaN(Date.parse(scheduleAt)))
      return res.status(400).json({ ok: false, error: "Invalid 'scheduleAt' datetime." });

    // ==== ENV ====
    const base = (process.env.GB_API_BASE || "").replace(/\/+$/,"");
    const appId = process.env.GB_APP_ID;
    const token = process.env.GB_API_TOKEN;

    // Se souber o path exato da sua doc, defina GB_PUSH_PATH; senão testamos alguns
    const configuredPath = (process.env.GB_PUSH_PATH || "").trim();
    const candidatePaths = configuredPath
      ? [configuredPath]
      : ["/api/v1/push", "/publicapi/v1/push", "/api/push"];

    if (!base || !appId || !token) {
      return res.status(500).json({
        ok: false,
        error: "Missing env vars",
        need: ["GB_API_BASE", "GB_APP_ID", "GB_API_TOKEN"],
        got: { GB_API_BASE: !!base, GB_APP_ID: !!appId, GB_API_TOKEN: !!token }
      });
    }

    // ==== Map ação ====
    let gbAction = { type: "open_app" };
    if (action?.type === "external_url" && action.value) {
      gbAction = { type: "external_url", url: action.value };
    } else if (action?.type === "section" && action.value) {
      gbAction = { type: "section", section_id: action.value };
    }

    // ==== Payload ====
    const payload = {
      message: message.trim(),
      platforms: ["pwa"],
      ...(group ? { groups: [group] } : {}),
      action: gbAction,
      ...(scheduleAt ? { schedule_at: new Date(scheduleAt).toISOString() } : {})
    };
    dbg({ base, appIdLast4: String(appId).slice(-4), candidatePaths, payload });

    // ==== Tenta múltiplos paths ====
    const headers = {
      "Content-Type": "application/json",
      "X-GB-APP-ID": appId,
      "Authorization": `Bearer ${token}`
    };

    const attempts = [];
    for (const path of candidatePaths) {
      const url = `${base}${path}`;
      try {
        dbg("POST", url);
        const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
        const raw = await r.text();
        let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
        dbg("Provider resp", r.status, data);

        if (r.ok) {
          return res.status(200).json({ ok: true, provider: "GoodBarber", path, result: data });
        }
        attempts.push({ path, status: r.status, body: data });
      } catch (e) {
        attempts.push({ path, error: "fetch_failed", detail: String(e) });
      }
    }

    // Nenhum deu certo
    return res.status(502).json({
      ok: false,
      error: "GoodBarber error",
      hint: "Confira módulo Push habilitado na chave, base URL e path correto; veja detalhes em attempts.",
      attempts
    });

  } catch (err) {
    console.error("[push][fatal]", err);
    return res.status(500).json({ ok: false, error: "Internal error", detail: (DEBUG ? String(err) : undefined) });
  }
}
