# WhatsApp Auto-Sending (From Your Number)

This document explains how to implement truly automatic WhatsApp alerts sent from your number (admin: 0706746067) to selected designers after a campaign request is paid.

Client-only web apps (like the current MVP) cannot send WhatsApp messages programmatically from your number. To accomplish this, you need a backend using the WhatsApp Business Cloud API.

## Overview

- Frontend: after successful payment, send payload to your backend.
- Backend: uses WhatsApp Business Cloud API to send messages to each selected designer's WhatsApp number.
- Optional: integrate M-Pesa STK; upon successful callback, trigger the WhatsApp notification.

## Prerequisites

1. Create a Meta developer app and enable WhatsApp Cloud API:
   - https://developers.facebook.com/docs/whatsapp/cloud-api
2. Get a WhatsApp Business phone number (or use the test number for development) and retrieve:
   - PHONE_NUMBER_ID (e.g., 1234567890)
   - WHATSAPP_BUSINESS_ACCOUNT_ID
3. Generate a permanent access token and store securely.

## Environment Variables (.env)

Create a `.env` file for your backend with:

```
PORT=8080
WHATSAPP_TOKEN=EAAG...your_long_token
WHATSAPP_PHONE_NUMBER_ID=123456789012345
ADMIN_PHONE_MSISDN=254706746067
ALLOWED_ORIGINS=http://localhost:5173
```

- WHATSAPP_TOKEN: Permanent access token.
- WHATSAPP_PHONE_NUMBER_ID: From your WhatsApp Cloud setup.
- ADMIN_PHONE_MSISDN: Admin MSISDN in international format without '+'.
- ALLOWED_ORIGINS: CORS allowed frontend URLs.

## Minimal Node/Express Backend

Install deps:

```
npm init -y
npm i express axios cors dotenv
```

Create `server.js`:

```js
require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')

const app = express()
app.use(express.json())
app.use(cors({ origin: (origin, cb) => cb(null, true) }))

const {
  PORT = 8080,
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  ADMIN_PHONE_MSISDN,
} = process.env

if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
  console.error('Missing WhatsApp credentials in env')
  process.exit(1)
}

const WA_API = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`
const HEADERS = {
  Authorization: `Bearer ${WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json',
}

function toMSISDNKE(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/[^0-9]/g, '')
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1)
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('+254') && digits.length === 13) return digits.slice(1)
  return null
}

app.post('/api/notify-designers', async (req, res) => {
  try {
    const { request, designers } = req.body || {}
    if (!request || !Array.isArray(designers)) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const base = `New Paid Campaign Request via CampaignDesign Bridge (Admin: ${ADMIN_PHONE_MSISDN || ''})\n\n` +
      `Candidate: ${request.candidateName}\n` +
      `Office: ${request.office}\n` +
      `Budget: ${request.budget || 'N/A'}\n` +
      `Deadline: ${request.deadline || 'N/A'}\n\n` +
      `Brief:\n${request.requirements}\n\n` +
      `Reply if interested.`

    const targets = designers
      .map(d => ({ name: d.name, msisdn: toMSISDNKE(d.phone) }))
      .filter(x => x.msisdn)

    const results = []
    for (const t of targets) {
      const data = {
        messaging_product: 'whatsapp',
        to: t.msisdn,
        type: 'text',
        text: { body: `Hello ${t.name},\n${base}` },
      }
      try {
        const { data: resp } = await axios.post(WA_API, data, { headers: HEADERS })
        results.push({ to: t.msisdn, success: true, id: resp.messages?.[0]?.id })
      } catch (err) {
        results.push({ to: t.msisdn, success: false, error: err.response?.data || err.message })
      }
    }

    res.json({ sent: results.length, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, () => console.log(`Notify server running on :${PORT}`))
```

Run:

```
node server.js
```

## Test with cURL

```
curl -X POST http://localhost:8080/api/notify-designers \
  -H 'Content-Type: application/json' \
  -d '{
    "request": {
      "candidateName": "Jane Doe",
      "office": "Governor",
      "budget": "KES 12000",
      "deadline": "2026-05-01",
      "requirements": "A1 posters, social banners, brand colors blue/gold"
    },
    "designers": [
      { "name": "Amina K.", "phone": "0712345678" },
      { "name": "John M.", "phone": "+254722123456" }
    ]
  }'
```

Expected: JSON with send results. Check WhatsApp on target devices.

## Frontend Integration (Vite)

Replace the current client-side `window.open(wa.me)` behavior with a backend call:

```ts
// pseudo-code inside publishRequest()
await fetch('http://localhost:8080/api/notify-designers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request: paidRequest,
    designers: pickedDesignersWithPhones,
  }),
})
```

- Ensure designers have `phone` in the profile.
- After success, optionally show a toast: "WhatsApp alerts sent".

## M-Pesa STK Hook (Optional)

1. Integrate Safaricom Daraja STK push in your backend.
2. On STK success callback (payment confirmed), call the same `notify-designers` logic.
3. Store transaction IDs and logs for auditing.

## Security Considerations

- Protect the endpoint with an API key or session auth.
- Rate-limit requests to avoid abuse.
- Validate phone numbers server-side with strict rules.
- Log send attempts and responses for diagnostics.

## Production Notes

- Host on a secure server (HTTPS) or serverless platform.
- Use environment variables for secrets, never commit tokens.
- Register your templates with WhatsApp if you want template-based notifications.
- Monitor Meta rate-limits and error responses.

---

This backend completes the flow so messages are sent automatically from your WhatsApp Business number without relying on client clicks. Integrate the POST /api/notify-designers call into your existing frontend after successful payment publication.