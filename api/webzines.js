// api/webzines.js — lista webzines disponíveis (debug)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const url = "https://classic.goodbarber.dev/publicapi/v1/webzines";
    const r = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${process.env.GB_API_TOKEN}`,
        "X-GB-App-Id": process.env.GB_APP_ID
      }
    });
    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
    return res.status(r.status).json({ ok: r.ok, status: r.status, data });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
