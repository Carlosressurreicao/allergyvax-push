// api/push.js — CORS amplo + parser robusto + resposta JSON
export default async function handler(req, res) {
  // CORS (permite qualquer origem; seguro pq não expõe segredo pro cliente)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Body parser robusto (req.body pode vir vazio)
  async function parseJSON(req) {
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch (e) { reject(e); }
      });
      req.on("error", reject);
    });
  }

  try {
    const body = await parseJSON(req);
    const { message, group = null, action = null, scheduleAt = null } = body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ ok: false, error: "message required" });
    }
    if (String(message).trim().length > 130) {
      return res.status(400).json({ ok: false, error: "message too long (max 130 chars)" });
    }

    const gbPayload = {
      message: String(message).trim(),
      platforms: ["pwa"],        // PWA fixo
      group,                     // string ou null
      schedule_at: scheduleAt || null,
      action                     // { type: 'external_url'|'section', value: '...' } ou null
    };

    const url = `https://classic.goodbarber.dev/publicapi/v1/webzines/${process.env.GB_WEBZINE_ID}/push/broadcasts`;
    const gbResp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GB_API_TOKEN}`,
        "X-GB-App-Id": process.env.GB_APP_ID
      },
      body: JSON.stringify(gbPayload)
    });

    const raw = await gbResp.text();
    let gb = null; try { gb = JSON.parse(raw); } catch { gb = { raw }; }

    console.log("GB status:", gbResp.status, "payload:", gbPayload, "resp:", raw.slice(0, 400));

    return res.status(gbResp.status).json({ ok: gbResp.ok, status: gbResp.status, gb });
  } catch (e) {
    console.error("Proxy error:", e);
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

