// /api/push.js — GoodBarber Push: headers + fallback em query string
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // body: aceita JSON ou text/plain
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};

    const { message, group = null, action = null, scheduleAt = null } = body;
    if (!message || typeof message !== "string" || !message.trim())
      return res.status(400).json({ ok: false, error: "Missing 'message'." });
    if (message.length > 130)
      return res.status(400).json({ ok: false, error: "Message exceeds 130 chars." });

    const base = (process.env.GB_API_BASE || "https://allergyvax.goodbarber.app").replace(/\/+$/,"");
    const appId = process.env.GB_APP_ID;
    const token = process.env.GB_API_TOKEN;
    const path  = "/publicapi/v1/push"; // já confirmado pelo seu retorno

    if (!appId || !token) {
      return res.status(500).json({ ok: false, error: "Missing GB_APP_ID or GB_API_TOKEN" });
    }

    // Map ação (abre app por padrão)
    let gbAction = { type: "open_app" };
    if (action?.type === "external_url" && action.value) gbAction = { type: "external_url", url: action.value };
    if (action?.type === "section"      && action.value) gbAction = { type: "section", section_id: action.value };

    const payload = {
      message: message.trim(),
      platforms: ["pwa"],
      ...(group ? { groups: [group] } : {}),
      action: gbAction,
      ...(scheduleAt ? { schedule_at: new Date(scheduleAt).toISOString() } : {})
    };

    // helper para detectar “login page”
    const looksLikeLoginHtml = (text, ctype) =>
      (ctype && ctype.includes("text/html")) ||
      (typeof text === "string" && /Please enter a password|<html|<form/i.test(text));

    // 1) Tentativa com HEADERS
    const url = `${base}${path}`;
    let r = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-GB-APP-ID": appId,
        "Authorization": `Bearer ${token}`,
        "X-GB-API-TOKEN": token
      },
      body: JSON.stringify(payload),
      redirect: "manual" // evita seguir redirecionamento para página de login
    });

    let raw = await r.text();
    const ctype = r.headers.get("content-type") || "";
    let data; try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (r.ok && !looksLikeLoginHtml(raw, ctype)) {
      return res.status(200).json({ ok: true, provider: "GoodBarber", urlUsed: url, auth: "headers", result: data });
    }

    // 2) Fallback: tenta por QUERY STRING
    const urlQS = `${base}${path}?app_id=${encodeURIComponent(appId)}&api_token=${encodeURIComponent(token)}`;
    r = await fetch(urlQS, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      redirect: "manual"
    });

    raw = await r.text();
    const ctype2 = r.headers.get("content-type") || "";
    let data2; try { data2 = JSON.parse(raw); } catch { data2 = { raw }; }

    if (r.ok && !looksLikeLoginHtml(raw, ctype2)) {
      return res.status(200).json({ ok: true, provider: "GoodBarber", urlUsed: urlQS, auth: "querystring", result: data2 });
    }

    // Se ainda veio HTML/login, reporte detalhe
    return res.status(502).json({
      ok: false,
      error: "Auth/permissions issue at GoodBarber (login HTML received)",
      tried: [
        { url, mode: "headers", status: r.status, contentType: ctype, sample: (typeof data === "object" ? undefined : String(raw).slice(0,200)) },
        { url: urlQS, mode: "querystring", status: r.status, contentType: ctype2, sample: (typeof data2 === "object" ? undefined : String(raw).slice(0,200)) }
      ],
      hint: "Verifique se a sua chave Public API tem o módulo Push/Notifications com Write e se este endpoint permite auth por headers e/ou query na sua instância."
    });

  } catch (err) {
    console.error("[push][fatal]", err);
    return res.status(500).json({ ok: false, error: "Internal error", detail: String(err) });
  }
}

