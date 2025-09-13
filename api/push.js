// /api/push.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { title, message, groups = [], deepLink } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ ok: false, error: "Informe 'title' e 'message'." });
    }

    const base = process.env.GB_API_BASE;
    const key  = process.env.GB_API_KEY;
    if (!base || !key) {
      return res.status(500).json({ ok: false, error: "GB_API_BASE/GB_API_KEY ausentes." });
    }

    // Monte o payload conforme a sua doc do endpoint de push do seu app.
    // Exemplo de "broadcast" segmentando PWA + (opcional) grupos:
    const body = {
      title,
      message,
      platforms: ["pwa"],     // <- SOMENTE PWA
      groups,                 // <- ["clientes", "premium"] (opcional)
      action: deepLink ? { type: "url", value: deepLink } : undefined
    };

    // Ajuste o caminho do endpoint conforme a sua doc:
    const url = `${base}/push/broadcasts`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": key   // ou o cabeçalho/campo que sua doc exigir
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    if (!resp.ok) {
      return res.status(resp.status).json({ ok: false, status: resp.status, gb: { raw: text } });
    }
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return res.status(200).json({ ok: true, provider: "goodbarber", response: json });

  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

