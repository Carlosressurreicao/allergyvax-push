// /api/push.js
export default async function handler(req, res) {
  // --- CORS ---
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

    const { message, group = null, action = null, scheduleAt = null } = body;

    // validações mínimas
    if (!message || typeof message !== "string" || !message.trim())
      return res.status(400).json({ ok: false, error: "Missing 'message'." });
    if (message.length > 130)
      return res.status(400).json({ ok: false, error: "Message exceeds 130 chars." });
    if (scheduleAt && isNaN(Date.parse(scheduleAt)))
      return res.status(400).json({ ok: false, error: "Invalid 'scheduleAt' datetime." });

    // === CONFIG via ENV ===
    const GB_BASE    = process.env.GB_PUSH_BASE_URL;      // ex.: https://classic.goodbarber.dev/publicapi/v1   (confirme na sua doc)
    const GB_APP_ID  = process.env.GB_APP_ID;             // obtido em Settings → Public APIs
    const GB_TOKEN   = process.env.GB_API_TOKEN;          // idem
    const GB_PUSH_EP = process.env.GB_PUSH_ENDPOINT;      // caminho do endpoint de broadcast (copie da doc do seu app)

    if (!GB_BASE || !GB_APP_ID || !GB_TOKEN || !GB_PUSH_EP) {
      return res.status(500).json({ ok: false, error: "GB API env vars missing (GB_PUSH_BASE_URL, GB_APP_ID, GB_API_TOKEN, GB_PUSH_ENDPOINT)." });
    }

    // mapeia ação do seu front para o formato GB (ajuste conforme doc do seu app)
    // action: { type: "none" | "external_url" | "section", value?: string }
    let gbAction = { type: "open_app" }; // default
    if (action && action.type === "external_url" && action.value) {
      gbAction = { type: "external_url", url: action.value };
    } else if (action && action.type === "section" && action.value) {
      gbAction = { type: "section", section_id: action.value };
    }

    // segmentação: plataforma PWA + (opcional) grupo
    const targets = {
      platforms: ["pwa"],                     // PWA
      ...(group ? { groups: [group] } : {})  // grupos opcionais
    };

    // agendamento opcional
    const schedule = scheduleAt ? { send_at: new Date(scheduleAt).toISOString() } : null;

    // payload sugerido (ajuste campos conforme doc exibida no seu painel)
    const payload = {
      app_id: GB_APP_ID,
      message: message.trim(),
      targets,               // { platforms: ["pwa"], groups?: [...] }
      action: gbAction,      // { type: "open_app" | "external_url" | "section", ... }
      ...(schedule ? { schedule } : {})
    };

    // chamada à GoodBarber
    const url = `${GB_BASE}${GB_PUSH_EP}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // A Classic Public API utiliza token de autenticação; em alguns métodos é via header.
        // Se a sua doc pedir outro header/chave (ex.: X-GB-APP-ID), ajuste aqui.
        "X-GB-APP-ID": GB_APP_ID,
        "X-GB-API-TOKEN": GB_TOKEN,
        "Authorization": `Bearer ${GB_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: "Provider error", providerStatus: r.status, providerBody: json });
    }

    return res.status(200).json({ ok: true, provider: "GoodBarber", result: json });
  } catch (err) {
    console.error("Push error:", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}

