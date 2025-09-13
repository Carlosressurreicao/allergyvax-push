/// /api/push.js — GoodBarber Classic API (GENERAL) com suporte a grupo por ID ou nome
export default async function handler(req, res) {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // Aceita JSON ou text/plain
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};

    const {
      message,
      group = null,             // pode ser null, "123" (ID), ou "nome/slug"
      platform = "pwa"          // default p/ seu caso (PWA)
    } = body;

    if (!message || typeof message !== "string" || !message.trim())
      return res.status(400).json({ ok:false, error:"Missing 'message'." });
    if (message.length > 130)
      return res.status(400).json({ ok:false, error:"Message exceeds 130 chars (max ~130)." });

    // ENV
    const base = (process.env.GB_API_BASE || "https://allergyvax.goodbarber.app").replace(/\/+$/,"");
    const appId = process.env.GB_APP_ID;           // ex.: 3785328
    const token = process.env.GB_API_TOKEN;        // JWT da Public API com módulo Notifications/Push (Write)
    if (!appId || !token) return res.status(500).json({ ok:false, error:"Missing GB_APP_ID or GB_API_TOKEN" });

    // Headers aceitos pela Classic API (variam por instância; enviamos todos)
    const gbHeaders = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-GB-APP-ID": String(appId),
      "Authorization": `Bearer ${token}`,
      "X-GB-API-TOKEN": token
    };

    // Função helper: detectar HTML de login
    const looksLikeLoginHtml = (text, ctype) =>
      (ctype && ctype.includes("text/html")) ||
      (typeof text === "string" && /<html|Please enter a password/i.test(text));

    // Se não houver group => broadcast
    if (!group) {
      const url = `${base}/publicapi/v1/general/push/${appId}/`;
      const r = await fetch(url, {
        method: "POST",
        headers: gbHeaders,
        body: JSON.stringify({ platform, message: message.trim() }),
        redirect: "manual"
      });
      const raw = await r.text();
      const ct  = r.headers.get("content-type") || "";
      let data; try { data = JSON.parse(raw); } catch { data = { raw }; }

      if (!r.ok || looksLikeLoginHtml(raw, ct)) {
        return res.status( (looksLikeLoginHtml(raw, ct) && r.ok) ? 403 : r.status ).json({
          ok: false,
          error: looksLikeLoginHtml(raw, ct) ? "GoodBarber login page — habilite Notifications/Push (Write) e libere a Public API" : "GoodBarber error",
          providerStatus: r.status,
          contentType: ct,
          providerBody: data
        });
      }
      return res.status(200).json({ ok:true, provider:"GoodBarber", mode:"broadcast", result:data });
    }

    // Há group: preparar envio por grupos
    // Se for número, usa direto. Se for texto, tentamos mapear via /community/groups
    const groupIds = [];

    if (/^\d+$/.test(String(group))) {
      groupIds.push(parseInt(group, 10));
    } else {
      // Buscar lista de grupos e tentar casar por name/slug insensível a maiúsculas
      const listURL = `${base}/publicapi/v1/general/community/${appId}/groups/`;
      const lr = await fetch(listURL, { headers: gbHeaders, redirect: "manual" });
      const lraw = await lr.text();
      const lct  = lr.headers.get("content-type") || "";
      let ljson; try { ljson = JSON.parse(lraw); } catch { ljson = { raw: lraw }; }

      if (!lr.ok || looksLikeLoginHtml(lraw, lct)) {
        return res.status( (looksLikeLoginHtml(lraw, lct) && lr.ok) ? 403 : lr.status ).json({
          ok:false,
          error: "Failed to list groups (auth/perm). Habilite Notifications/Push (Write) e libere a Public API.",
          providerStatus: lr.status,
          contentType: lct,
          providerBody: ljson
        });
      }

      // tentar casar por 'name' ou 'slug' aproximado
      const wanted = String(group).trim().toLowerCase();
      const groupsArr = Array.isArray(ljson.groups) ? ljson.groups : [];
      const found = groupsArr.find(g => {
        const n = (g.name || "").toString().toLowerCase();
        const s = (g.slug || "").toString().toLowerCase();
        return n === wanted || s === wanted;
      });

      if (!found || !found.id) {
        return res.status(404).json({
          ok:false,
          error:`Group not found by name/slug: "${group}". Use ID inteiro (ex.: 10123) ou crie um nome/slug que corresponda exatamente.`
        });
      }
      groupIds.push(parseInt(found.id, 10));
    }

    // Envio por grupos
    const url = `${base}/publicapi/v1/general/push/groups/${appId}/`;
    const payload = { platform, message: message.trim(), groups: groupIds };
    const r = await fetch(url, { method:"POST", headers: gbHeaders, body: JSON.stringify(payload), redirect:"manual" });
    const raw = await r.text();
    const ct  = r.headers.get("content-type") || "";
    let data; try { data = JSON.parse(raw); } catch { data = { raw }; }

    if (!r.ok || looksLikeLoginHtml(raw, ct)) {
      return res.status( (looksLikeLoginHtml(raw, ct) && r.ok) ? 403 : r.status ).json({
        ok:false,
        error: looksLikeLoginHtml(raw, ct) ? "GoodBarber login page — habilite Notifications/Push (Write) e libere a Public API." : "GoodBarber error",
        providerStatus: r.status,
        contentType: ct,
        providerBody: data
      });
    }

    return res.status(200).json({ ok:true, provider:"GoodBarber", mode:"groups", groups: groupIds, result:data });

  } catch (err) {
    console.error("[push][fatal]", err);
    return res.status(500).json({ ok:false, error:"Internal error", detail:String(err) });
  }
}
