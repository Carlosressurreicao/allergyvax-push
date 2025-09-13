// /api/push.js
export default async function handler(req, res) {
  // --- CORS básico ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end(); // preflight OK
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, endpoint: "push", status: "ready" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Se vier JSON:
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    // TODO: sua lógica real de envio (ex.: chamar Notifyer/WhatsApp)
    return res.status(200).json({ ok: true, message: "Push enviado!", payload });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}

