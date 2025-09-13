// /api/gb-check.js
export default async function handler(req, res) {
  try {
    const base = (process.env.GB_API_BASE || "https://allergyvax.goodbarber.app").replace(/\/+$/,"");
    const appId = process.env.GB_APP_ID;
    const token = process.env.GB_API_TOKEN;
    const url = `${base}/publicapi/v1/stats`;

    if (!appId || !token) {
      return res.status(500).json({ ok:false, error:"Missing envs", need:["GB_API_BASE","GB_APP_ID","GB_API_TOKEN"] });
    }

    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-GB-APP-ID": appId,
      "Authorization": `Bearer ${token}`,
      "X-GB-API-TOKEN": token
    };

    // tentativa 1: headers
    const r1 = await fetch(url, { headers, redirect: "manual" });
    const t1 = await r1.text();
    const ct1 = r1.headers.get("content-type") || "";
    const looksHtml1 = /text\/html/i.test(ct1) || /<html|Please enter a password/i.test(t1);

    // tentativa 2: query string
    const urlQS = `${url}?app_id=${encodeURIComponent(appId)}&api_token=${encodeURIComponent(token)}`;
    const r2 = await fetch(urlQS, { headers: { "Accept": "application/json" }, redirect: "manual" });
    const t2 = await r2.text();
    const ct2 = r2.headers.get("content-type") || "";
    const looksHtml2 = /text\/html/i.test(ct2) || /<html|Please enter a password/i.test(t2);

    return res.status(200).json({
      ok: true,
      base,
      appIdLast4: String(appId).slice(-4),
      tryHeaders: { status: r1.status, contentType: ct1, isHTML: looksHtml1, sample: t1.slice(0,200) },
      tryQuery:   { status: r2.status, contentType: ct2, isHTML: looksHtml2, sample: t2.slice(0,200) },
      hint: "Se qualquer isHTML=true, a API ainda está protegida por login ou a chave não tem permissão para Stats."
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
