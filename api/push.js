// /api/push.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { title, message, deepLink } = req.body || {};
    if (!title || !message) return res.status(400).json({ ok:false, error:"Informe 'title' e 'message'." });

    const base = process.env.GB_API_BASE;
    const key  = process.env.GB_API_KEY;
    if (!base || !key) return res.status(500).json({ ok:false, error:"GB_API_BASE/GB_API_KEY ausentes." });

    const payload = {
      title, message,
      platforms: ["pwa"], groups: [],
      action: deepLink ? { type: "url", value: deepLink } : undefined
    };

    const urls = [
      `${base}/push/broadcasts`,
      `${base}/notifications/broadcasts`
    ];
    const auths = [
      { "X-Auth-Token": key },
      { "Authorization": `Token ${key}` }
    ];

    let last = null;
    for (const url of urls) {
      for (const hdr of auths) {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type":"application/json", ...hdr },
          body: JSON.stringify(payload)
        });
        const txt = await resp.text();
        last = { url, hdr, status: resp.status, body: txt.slice(0, 1000) };
        if (resp.ok) {
          let json; try{ json = JSON.parse(txt) } catch { json = { raw: txt } }
          return res.status(200).json({ ok:true, provider:"goodbarber", response: json });
        }
        if (resp.status === 401 || resp.status === 403) break;
      }
    }
    return res.status(502).json({ ok:false, hint:"Falha ao criar broadcast", last_try: last });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}

