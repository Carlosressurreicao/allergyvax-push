# AllergyVax Push Proxy (GoodBarber → PWA)

Backend mínimo em **Vercel Serverless Functions** para enviar notificações push
via **GoodBarber Public API**, fixo para **PWA**.

---

## 🚀 Deploy

1. Crie um novo repositório e suba estes arquivos.
2. Importe o repositório na [Vercel](https://vercel.com).
3. Nas **Project Settings → Environment Variables**, configure:

- `GB_APP_ID`
- `GB_API_TOKEN`
- `GB_WEBZINE_ID`

Esses dados você pega no painel da GoodBarber em **Configurações → Public API**.

4. Faça o deploy. Sua função ficará em:

```
https://SEU-PROJETO.vercel.app/api/push
```

---

## 🧪 Teste rápido

```bash
curl -X POST "https://SEU-PROJETO.vercel.app/api/push"   -H "Content-Type: application/json"   --data '{
    "message": "Olá! Vacinação pendente.",
    "group": null,
    "scheduleAt": null,
    "action": { "type": "external_url", "value": "https://allergyvax.com/avisos" }
  }'
```

---

## 🔗 Uso no front-end (HTML/JS)

```js
const r = await fetch("https://SEU-PROJETO.vercel.app/api/push", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message:"Olá do front!", group:null, action:null, scheduleAt:null })
});
```

⚠️ O backend cuida de esconder suas chaves. O app só envia `message`, `group`, `action`, `scheduleAt`.

---

## ℹ️ Notas

- Apenas plataforma **PWA** é usada (`platforms: ["pwa"]`).
- Mensagens recomendadas ≤130 caracteres.
- Use `group` para segmentar usuários por grupos configurados no GoodBarber.
- Use `action` para abrir link (`external_url`) ou seção (`section`).
