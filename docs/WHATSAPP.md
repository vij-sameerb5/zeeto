# WhatsApp: payments and orders over chat

WhatsApp is how most street stalls in India already run their business. Zeeto plugs into it with the official **WhatsApp Cloud API** (Meta), as one extra webhook: `POST /api/whatsapp`.

## What people can do

**Customers** (any WhatsApp number) message the Zeeto business number:

| They send | They get |
|---|---|
| `pay ravi 120` | "Pay ₹120 to Ravi's Fresh Sabzi" with a **Pay ₹120** button. The button opens Zeeto's hosted checkout, they sign in with the same phone number (OTP), and confirm. No gas, no app to install. |
| `orders` | A button to their orders and pickup codes |
| anything in their own words, any language: `chai kahan milegi?`, `ravi bhaiya ko 60 rupaye bhejo` | **Gemini** reads it and picks one of: find (up to 3 live stalls with links), pay (the same Pay button as above), orders, or help |

After paying they get: "Paid ₹120 ✅ Your pickup code is NT-576", then "accepted", "ready 🎉" and refund messages as the stall moves the order.

**Stalls** (the WhatsApp number saved on the stall in Zeeto) get "New order ✅ ₹120 paid by +91 98•••• 4210 · 2 kg tomatoes · Code NT-576" and can reply:

| They send | What happens |
|---|---|
| `orders` | Open orders with codes and status |
| `accept AB-123` · `ready AB-123` · `done AB-123` | Moves the order (same rules as the app: a cancel request blocks accept) and messages the customer |
| `bill 250` | A pay link for ₹250 to forward to a customer or show as a QR |
| `open` / `close` | Opens or closes the stall for new orders |
| **a photo of today's stock** | **Gemini** drafts the listing (name, local name, unit, price, quantity + a note to followers) and replies with it |
| `publish` / `cancel` | Puts the drafted items live on the stall, or drops the draft |
| anything in their own words: `aaj 20 kilo tamatar 40 rupaye`, `250 ka bill bana do`, `NT-576 ready hai` | **Gemini** maps it to one command above (or a stock draft), then the normal checked command runs |

## Gemini inside WhatsApp: what it can and can't do

- It only **chooses** a command; the command then runs with the same checks as if typed (stall must be live, amount ₹1–20,000, pickup code must match an order of *this* stall, a cancel request still blocks accept).
- For customers it can only pick stalls from the live list we send it; any other id is ignored. It can make a pay link, never a payment: the customer still signs on the hosted page.
- New stock never goes live until the stall replies `publish`. Drafts expire after 24 h and are never sent to browsers.
- Each phone gets at most 12 AI answers per 10 minutes; without `GEMINI_API_KEY` everything falls back to the typed commands.
- Tested offline with a fake Meta + Supabase + Gemini: `npm run test:whatsapp` (forged webhook, photo → draft → publish, Hinglish bill, Hinglish pay, invented stall ignored, typed commands, Meta retry).

## Why the payment itself isn't "inside" WhatsApp

WhatsApp can't hold a wallet or sign anything, and Meta's own in-chat payments only support UPI/cards in India. So the **payment starts in WhatsApp** (the message, the amount, the stall) and **finishes in one tap** on Zeeto's hosted page, where the customer's own embedded wallet signs. That keeps the security model intact: Zeeto never holds keys and can never move money on someone's behalf, and a forwarded or spoofed message can't pay anyone except the stall named on the checkout page, for the amount shown.

Next step (post-hackathon): WhatsApp **Flows** to render the confirm screen inside the chat, with the signature still made by the customer's wallet.

## Security

- Every webhook is checked against Meta's `X-Hub-Signature-256` (HMAC with the app secret). Unsigned or wrongly signed calls get 401.
- Each message id is handled once (Meta retries webhooks).
- Pay links expire in 5 minutes, are single-use, and a phone can create at most a few per 10 minutes.
- Stall commands only work from the number saved on that stall.
- No money moves without the customer signing on the checkout page.

## Setup (about 15 minutes)

1. developers.facebook.com → Create app → type **Business** → add **WhatsApp**.
2. WhatsApp → API setup: copy the **temporary access token** and the **Phone number ID**. Add your own number as a test recipient.
3. App settings → Basic: copy the **App secret**.
4. In Vercel (or `apps/web/.env.local`): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (any random string), `SITE_URL` (your deployed URL). Redeploy.
5. WhatsApp → Configuration → Webhook: URL `https://<your-site>/api/whatsapp`, verify token = the same random string → Verify and save. Subscribe to **messages**.
6. In Zeeto, open your stall → Store and set its WhatsApp number (with +91) to get stall alerts and commands.
7. Test: from your phone, send `pay <your stall name> 20` to the test number.

The temporary token expires after 24 h; for the demo create a System User token in Business Settings.

**Test-number rules (important for the demo):** with Meta's free test number, you can only message numbers added as test recipients (up to 5), and Zeeto can only send free-text replies and alerts within 24 h of that person's last message. So before the demo, each judge/merchant phone sends `hi` to the number once. Order alerts outside that window need an approved message template (post-hackathon).
