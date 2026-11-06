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

## What it looks like

Every reply uses WhatsApp's own **reply buttons** and **lists**, so most of the time nobody types:

- New order → stall gets "🔔 New order #NT-576 · ₹120 · 1.43 USDT received" with **✅ Accept NT-576** / **📋 Open orders**. Accept → **📦 Ready NT-576** → **🤝 Done NT-576**. The customer is messaged at each step.
- `today` → today's orders, sales, USDT received, open orders, best sellers, running low, with **📋 Open orders** / **✨ AI tips**.
- `tips` (or any business question, "what should I restock?") → Gemini answers from that stall's own numbers only.
- Photo → **✨ AI draft** with **✅ Publish** / **✕ Cancel**.
- `refund` → a secure link: refunds move money, so the stall's wallet confirms them in Zeeto.
- Customer `hi` → **📍 Stalls on Zeeto** / **🧾 My orders**; stalls come as a tap list; picking one shows its menu and an **Order on Zeeto** button.

Merchants see all of this, with a live phone preview and the command list, at **/sell/whatsapp** (web) and from **My stall → Run your stall from WhatsApp** (phone app). Stall pages get a **WhatsApp** button once `WHATSAPP_DISPLAY_NUMBER` is set.

Tested offline with fake Meta/Supabase/Gemini: `npm run test:whatsapp` (12 checks).

## Setup: getting the keys (about 20 minutes)

1. **Meta app.** developers.facebook.com → My Apps → **Create app** → use case **Other** → type **Business** → name it "Zeeto" → Create.
2. **Add WhatsApp.** In the app dashboard → **Add product** → WhatsApp → **Set up**. Pick or create a Meta Business portfolio when asked.
3. **API setup page** (WhatsApp → API Setup):
   - Copy the **Phone number ID** (under the test "From" number) → `WHATSAPP_PHONE_NUMBER_ID`.
   - Copy the test number itself, e.g. `+1 555 123 4567` → `WHATSAPP_DISPLAY_NUMBER`.
   - Under "To", **add each demo phone** (yours, the merchant's, a judge's) and confirm the code WhatsApp sends. Test numbers can only message up to 5 such numbers.
4. **Token.** For a quick test, copy the **temporary access token** on that page (lasts 24 h). For the demo, make a permanent one: business.facebook.com → Settings → **System users** → Add (Admin) → **Add assets** → your app (full control) → **Generate token** → pick the app, tick `whatsapp_business_messaging` and `whatsapp_business_management` → copy → `WHATSAPP_TOKEN`.
5. **App secret.** App settings → **Basic** → App secret → Show → `WHATSAPP_APP_SECRET`.
6. **Verify token.** Make up any random word, e.g. `zeeto-verify-7391` → `WHATSAPP_VERIFY_TOKEN`.
7. **Vercel.** Project → Settings → Environment Variables → add the 5 above (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_DISPLAY_NUMBER`) as Secret, Production + Preview. Also `GEMINI_API_KEY` for the AI parts. **Redeploy.**
8. **Check.** `https://zeeto.vercel.app/api/health` → `whatsapp: true`, `waNumber` = your test number.
9. **Webhook.** Meta app → WhatsApp → **Configuration** → Webhook → Edit: Callback URL `https://zeeto.vercel.app/api/whatsapp`, Verify token = the word from step 6 → **Verify and save**. Then **Manage** webhook fields → subscribe **messages**.
10. **Your stall's number.** zeeto.vercel.app/sell/store → WhatsApp number (the phone you'll text from) → Save.
11. **Say hi.** From that phone, send `hi` to the test number. You get the stall menu with buttons. From another phone (a customer), send `hi` → customer menu.
12. **Try it.** Stall: send a photo → Publish. Customer: `pay <your stall> 20` → tap Pay → sign in with that phone → paid → both phones get messages.

If nothing comes back: check Vercel → Logs for `/api/whatsapp` (a `401` means the app secret is wrong; no request at all means the webhook isn't subscribed to **messages**).
