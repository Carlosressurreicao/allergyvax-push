// /api/push.js
export default async function handler(req, res) {
  // CORS p/ chamar do seu PWA
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { title, message, deepLink } = req.body || {};
    if (!title || !message) return res.status(400).json({ ok:false, error:"Informe 'title' e 'message'." });

    const base = process.env.GB_API_BASE;  // ex.: https://classic.goodbarber.dev/publicapi/v1/apps/3785328
    const key  = process.env.GB_API_KEY;   // token da Public API (Settings > Public APIs)
    if (!base || !key) return res.status(500).json({ ok:false, error:"GB_API_BASE/GB_API_KEY ausentes." });

    const url = `${base.replace(/\/+$/, "")}/push/broadcasts`; // garante sem barra dupla

    const payload = {
      title,
      message,
      platforms: ["pwa"],         // SOMENTE PWA
      groups: [],                 // TODOS
      action: deepLink ? { type: "url", value: deepLink } : undefined
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": key      // <- header mais aceito na Public API Classic
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ ok:false, status: resp.status, gb: { url, raw: text.slice(0, 2000) } });
    }

    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return res.status(200).json({ ok:true, provider:"goodbarber", response: json });

  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
