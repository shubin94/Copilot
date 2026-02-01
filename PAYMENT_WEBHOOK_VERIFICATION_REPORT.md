# Payment Webhook Verification Report (Payments Item #4)

## 1. Webhook endpoints located

| Provider | Webhook endpoint | Status |
|----------|------------------|--------|
| **Razorpay** | None | No webhook route exists. |
| **PayPal** | None | No webhook route exists. |

**Where we looked**

- `server/routes.ts`: all payment routes are `requireRole("detective")` or admin; no public POST for provider callbacks.
- Grep for `webhook`, `X-Razorpay-Signature`, `paypal.*event`, `payment.*callback`, `notify`: no matches for webhook handling.
- `server/app.ts`: `express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })` is present (raw body kept), but no route uses it for signature verification.

**Existing payment routes (all client-initiated, not webhooks)**

- `POST /api/payments/create-order` – Razorpay order creation (detective only).
- `POST /api/payments/verify` – Razorpay **payment verification** after checkout (detective only).
- `POST /api/payments/verify-blue-tick` – Razorpay Blue Tick verification (detective only).
- `POST /api/payments/paypal/create-order` – PayPal order creation (detective only).
- `POST /api/payments/paypal/capture` – PayPal **capture** after client approval (detective only).

These are used when the **browser** returns from checkout and the **client** sends order/payment IDs and (for Razorpay) signature. They are not server-to-server webhook endpoints.

---

## 2. Verification in current code (client flow only)

### Razorpay (payment verification, not webhooks)

- **Used in:** `POST /api/payments/verify` and `POST /api/payments/verify-blue-tick`.
- **What it does:** Validates the **payment** signature after checkout using the **API secret** (`key_secret`).
- **How:**  
  `HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)` compared to `razorpay_signature`.
- **Secret used:** `gateway.config.keySecret` or `config.razorpay.keySecret` (API key secret).
- **Verdict:** Correct for **payment verification**. Razorpay docs specify this exact method and secret for post-checkout verification.

**Note:** Razorpay **webhooks** use a **different** secret (webhook secret) and sign the **raw request body** with header `X-Razorpay-Signature`. There are no webhook routes, so no webhook secret is used anywhere.

### PayPal (capture, not webhooks)

- **Used in:** `POST /api/payments/paypal/capture`.
- **What it does:** Client sends `paypalOrderId`; server calls PayPal SDK `capturePayPalOrder(orderId)` and then `verifyPayPalCapture(captureResponse)` (checks `status === "COMPLETED"` and capture structure).
- **Verdict:** Server performs capture via SDK and only marks payment complete after SDK confirms. No reliance on client-provided capture result. Correct for the **client flow**. There is no PayPal webhook endpoint, so no webhook verification exists.

---

## 3. Missing or incomplete verification

- **Webhooks:** There are **no** webhook endpoints for Razorpay or PayPal. So there is no “incomplete webhook verification”—there is simply no webhook handling.
- **Client-flow verification:** Razorpay signature (with API secret) and PayPal server-side capture are implemented and appropriate for the current design.

---

## 4. Fixes applied (verification gaps only)

**None.** No code was changed.

- The only “gap” is the **absence** of webhook endpoints. Adding them would be a **new feature** (new routes, event handling, idempotency, etc.), which is out of scope (“Fix ONLY verification gaps (no new features)”).
- Existing verification (Razorpay HMAC with key_secret; PayPal SDK capture + response check) is correct for the current client-initiated flow and was left as-is.

---

## 5. Files touched

**None.** Only this report was added.

---

## 6. If you add webhooks later (out of scope here)

- **Razorpay:** Add a **public** POST route (no session). Verify using **webhook secret**: `HMAC-SHA256(req.rawBody, webhook_secret)` and compare to `X-Razorpay-Signature`. Use raw body (already stored in `req.rawBody` in `app.ts`). Do not use `key_secret` for webhook verification.
- **PayPal:** Add a **public** POST route. Verify using [PayPal’s Webhook Signature Verification](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature) (algorithm, cert_url, transmission_id, transmission_sig, transmission_time, webhook_id, webhook_event). Use the Webhooks API or SDK verification helper; do not trust the body without verification.

---

**Summary:** No webhook endpoints exist. Current payment verification is for the client flow only and is implemented correctly. No verification gaps were fixed in code because the only gap is the absence of webhooks (a new feature). No files were modified except this report.
