// /api/push.js — GoodBarber Classic API (broadcast PWA)
export default async function handler(req, res) {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // aceita JSON ou text/plain
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    if (!body || typeof body !== "object") body = {};

    const message  = (body.message || "").trim();
    const platform = (body.platform || "pwa").toLowerCase(); // default PWA
    if (!message) return res.status(400).json({ ok:false, error:"Missing 'message'." });
    if (!["all","pwa","ios","android"].includes(platform))
      return res.status(400).json({ ok:false, error:"Invalid 'platform'. Use: all | pwa | ios | android." });
    if (message.length > 130)
      return res.status(400).json({ ok:false, error:"Message exceeds ~130 chars." });

    const base  = (process.env.GB_API_BASE || "https://allergyvax.goodbarber.app").replace(/\/+$/,"");
    const appId = process.env.GB_APP_ID;      // ex.: 3785328
    const token = process.env.GB_API_TOKEN;   // token do Key Set com Notifications/Push (Write)
    if (!appId || !token) return res.status(500).json({ ok:false, error:"Missing GB_APP_ID or GB_API_TOKEN" });

    const url = `${base}/publicapi/v1/general/push/${appId}/`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-GB-APP-ID": String(appId),
        "Authorization": `Bearer ${token}`,
        "X-GB-API-TOKEN": token
      },
      body: JSON.stringify({ platform, message }),
      redirect: "manual"
    });

    const raw = await r.text();
    const ct  = r.headers.get("content-type") || "";
    let data; try { data = JSON.parse(raw); } catch { data = { raw }; }

    const isLoginHTML = /text\/html/i.test(ct) || /<html|Please enter a password/i.test(raw);
    if (!r.ok || isLoginHTML) {
      return res.status( (isLoginHTML && r.ok) ? 403 : r.status ).json({
        ok:false,
        error: isLoginHTML
          ? "GoodBarber login page — habilite Notifications/Push (Write) no Key Set e libere a Public API (sem password/IP)."
          : "GoodBarber error",
        providerStatus: r.status,
        contentType: ct,
        providerBody: data
      });
    }

    return res.status(200).json({ ok:true, provider:"GoodBarber", mode:"broadcast", result:data });
  } catch (e) {
    console.error("[push][fatal]", e);
    return res.status(500).json({ ok:false, error:"Internal error", detail:String(e) });
  }
}

