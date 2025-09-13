// /api/push.js  — GoodBarber Classic Public API (v1.3.x)
// ENV obrigatórias na Vercel:
//   GB_API_ROOT=https://classic.goodbarber.dev/publicapi/v1
//   GB_WEBZINE_ID=3785328                 // <— o ID que aparece na doc (webzine_id)
//   GB_API_KEY=SEU_TOKEN_DA_PUBLIC_API    // <— gerado em Settings → Public APIs

export default async function handler(req, res) {
  // CORS p/ chamar do seu PWA/HTML
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { title, message, deepLink, groups } = req.body || {};
    const msg = (title && message) ? `${title} – ${message}` : (message || title);
    if (!msg) return res.status(400).json({ ok:false, error:"Informe 'message' ou 'title'." });

    const root = (process.env.GB_API_ROOT || "").replace(/\/+$/, "");
    const webzineId = (process.env.GB_WEBZINE_ID || "").toString().trim();
    const key = process.env.GB_API_KEY;

    if (!root || !webzineId || !key) {
      return res.status(500).json({ ok:false, error:"GB_API_ROOT/GB_WEBZINE_ID/GB_API_KEY ausentes." });
    }

    // paths oficiais da doc
    const basePath = `${root}/general/push/${encodeURIComponent(webzineId)}/`;
    const pathBroadcast = basePath;                  // todos
    const pathGroups = `${root}/general/push/groups/${encodeURIComponent(webzineId)}/`; // por grupos

    // payload conforme doc (platform + message). Title não existe — já concatenamos acima.
    const payload = { platform: "pwa", message: msg };

    // se quiser deep link, GB não mostra campo na doc; mantenho fora por padrão.
    // (caso sua instância aceite, pode estender aqui.)

    const useGroups = Array.isArray(groups) && groups.length > 0;
    if (useGroups) {
      // a doc exige IDs numéricos de grupos
      const groupIds = groups.map(Number).filter(n => Number.isInteger(n));
      if (!groupIds.length) return res.status(400).json({ ok:false, error:"'groups' deve conter IDs numéricos." });
      payload.groups = groupIds;
    }

    const url = useGroups ? pathGroups : pathBroadcast;

    // A doc diz "token header"; alguns apps aceitam X-Auth-Token, outros Authorization: Token <key>.
    const authHeadersList = [
      { "X-Auth-Token": key },
      { "Authorization": `Token ${key}` },
      { "token": key } // fallback para instâncias que usam literalmente "token"
    ];

    let last = null;
    for (const authHdr of authHeadersList) {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHdr },
        body: JSON.stringify(payload)
      });
      const txt = await resp.text();
      last = { url, authHdr, status: resp.status, body: txt.slice(0, 1000) };

      if (resp.ok) {
        // Resposta de sucesso da doc:
        // { "result": "Notification created (id=6247732)", "generated_in": 0.04 }
        let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
        return res.status(200).json({ ok:true, response: json });
      }

      // 1999/1998 costumam vir com 401/403 e JSON — tentamos próximo header
      if (resp.status === 404) {
        // 404 aqui normalmente é caminho errado; mas como veio da sua doc, mantém registro e tenta próximo header mesmo assim
        continue;
      }
    }

    return res.status(502).json({ ok:false, hint:"Falha ao criar push", last_try: last });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
