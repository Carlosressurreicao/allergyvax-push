// /api/push.js
import { Buffer } from "node:buffer";

// Carrega Firebase Admin dinamicamente (só quando usar FCM)
let admin = null;
async function getFirebase() {
  if (!admin) {
    admin = await import("firebase-admin");
    if (!admin.apps.length) {
      const b64 = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT ausente");
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
      admin.initializeApp({ credential: admin.credential.cert(json) });
    }
  }
  return admin;
}

export default async function handler(req, res) {
  // Apenas POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { provider, payload } = req.body || {};
    if (!provider || !payload) {
      return res.status(400).json({ ok: false, error: "provider e payload são obrigatórios" });
    }

    if (provider === "fcm") {
      // payload esperado:
      // { title, body, tokens?: string[], topic?: string, data?: Record<string,string> }
      const admin = await getFirebase();
      const message = {
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      };

      let response;
      if (payload.topic) {
        response = await admin.messaging().send({ ...message, topic: payload.topic });
      } else if (Array.isArray(payload.tokens) && payload.tokens.length) {
        response = await admin.messaging().sendEachForMulticast({ ...message, tokens: payload.tokens });
      } else {
        return res.status(400).json({ ok: false, error: "Informe 'topic' ou 'tokens[]' para FCM" });
      }
      return res.status(200).json({ ok: true, provider: "fcm", response });
    }

    if (provider === "goodbarber") {
      // payload esperado (exemplo):
      // { title, message, groups?: string[], platforms?: ("ios"|"android"|"pwa")[] , deepLink?: string }
      // ATENÇÃO: Preencha a URL/rota certa segundo a doc do seu app GoodBarber (App API / Push).
      // As páginas oficiais indicam que é possível enviar push por API. :contentReference[oaicite:3]{index=3}
      const base = process.env.GB_API_BASE; // ex.: "https://<SEU_SUBDOMINIO_API>/publicapi/v1"
      const key  = process.env.GB_API_KEY;  // token da API

      if (!base || !key) {
        return res.status(500).json({ ok: false, error: "GB_API_BASE/GB_API_KEY ausentes" });
      }

      // Monte o corpo conforme o esquema do seu endpoint de push do GoodBarber
      // Abaixo um *modelo* típico — ajuste nomes/estrutura de campos conforme a doc do seu app:
      const body = {
        title: payload.title,
        message: payload.message,
        groups: payload.groups || [],             // opcional: grupos de usuários
        platforms: payload.platforms || [],       // opcional: "ios" | "android" | "pwa"
        action: payload.deepLink ? { type: "url", value: payload.deepLink } : undefined
      };

      const resp = await fetch(`${base}/push/broadcasts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": key, // ou o header/campo que sua doc exigir
        },
        body: JSON.stringify(body),
      });

      const gb = await resp.text();
      if (!resp.ok) {
        return res.status(resp.status).json({
          ok: false,
          status: resp.status,
          gb: { raw: gb }
        });
      }
      return res.status(200).json({ ok: true, provider: "goodbarber", gb: tryParse(gb) });
    }

    return res.status(400).json({ ok: false, error: "provider inválido (use 'fcm' ou 'goodbarber')" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

function tryParse(t) {
  try { return JSON.parse(t); } catch { return t; }
}

