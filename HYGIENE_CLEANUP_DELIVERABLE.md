# Hygiene Cleanup – Deliverable

**Date:** 2026-01-31  
**Scope:** PII removal from logs, lightweight input validation for risky endpoints, removal/redaction of request-body logging. No refactors, no behavior changes, no caching or schema changes.

---

## 1. Files changed

| File | Changes |
|------|--------|
| **server/routes.ts** | H1: Replaced two login-failure logs that included email/userId with generic "[auth] Login failed: invalid credentials". H2: Added validation for POST /api/admin/payments/sync-detective (body must be object, detectiveId must be non-empty string); added guard for POST/PATCH /api/subscription-plans (body must be non-null object). H3: Removed all request-body and verbose logs from POST /api/applications (body size, has logo/documents, validating/passed, hashing password/password hashed). Redacted sync-detective error log (removed detectiveId from "Detective not found" message); sync start log now generic ("Starting payment sync recovery"). |
| **server/routes/admin-cms.ts** | H3: Redacted error logs that included req.body or parsed body fields. Replaced object logs with a single error-message string for: Create category (system error and null result), Update category, Delete category; Create tag (system error and null result), Update tag, Delete tag; Update page, Delete page. No req.body or body-derived fields are logged. |

---

## 2. Logs removed or altered

### H1 – PII removed from auth failure logs (server/routes.ts)

| Before | After |
|--------|--------|
| `[auth] Login failed: user not found for email=${email}` | `[auth] Login failed: invalid credentials` |
| `[auth] Login failed: password mismatch for userId=${user.id}, email=${email}` | `[auth] Login failed: invalid credentials` |

### H3 – Request-body and verbose logging removed/redacted

**server/routes.ts – POST /api/applications**

- **Removed:** `"=== RECEIVED POST /api/applications ==="`
- **Removed:** `"Request body size:", JSON.stringify(req.body).length`
- **Removed:** `"Request has logo:", !!req.body.logo`
- **Removed:** `"Request has documents:", !!req.body.documents`
- **Removed:** `"Validating request body..."`
- **Removed:** `"Validation passed"`
- **Removed:** `"Hashing password..."`
- **Removed:** `"Password hashed"`

**server/routes.ts – sync-detective**

- **Altered:** `Starting payment sync recovery for detective: ${detectiveId}` → `Starting payment sync recovery`
- **Altered:** `Detective not found: ${detectiveId}` → `Detective not found`

**server/routes/admin-cms.ts – error logs**

- Create category (system error): object with `name`, `slug`, `error`, `stack` → single string `error.message` (or String(error)).
- Create category (null result): object `{ name, slug, status }` → message only: `"Create category error - null result after INSERT"`.
- Update category (system error): object with `categoryId`, `name`, `status`, `error`, `stack` → single string.
- Delete category (system error): object with `categoryId`, `error`, `stack` → single string.
- Create tag (system error): object with `name`, `slug`, `error`, `stack` → single string.
- Create tag (null result): object `{ name, slug, status }` → message only.
- Update tag (system error): object with `tagId`, `name`, `status`, `error`, `stack` → single string.
- Delete tag (system error): object with `tagId`, `error`, `stack` → single string.
- Update page (system error): object with `pageId`, `title`, `slug`, `categoryId`, `status`, `bannerImage`, `error`, `stack` → single string.
- Delete page (system error): object with `pageId`, `error`, `stack` → single string.

---

## 3. Validation added (endpoints only)

| Endpoint | Validation added | On failure |
|----------|------------------|------------|
| **POST /api/admin/payments/sync-detective** | `req.body` must be non-null object; `body.detectiveId` must be a string and non-empty after trim. | 400 with `{ error: "Invalid request" }` or `{ error: "detectiveId is required" }`. |
| **POST /api/subscription-plans** | `req.body` must be non-null and typeof `"object"` before using as payload. | 400 with `{ error: "Invalid request" }`. |
| **PATCH /api/subscription-plans/:id** | Same as above. | 400 with `{ error: "Invalid request" }`. |

No new Zod schemas were added; existing Zod parsing for subscription-plans and the new guards ensure invalid/malformed body does not cause uncaught exceptions. Webhook handlers (Razorpay verify, PayPal capture) already use Zod `.parse(req.body)`; no change.

---

## 4. Behavior unchanged

- **Auth:** Response status and body for login (401 "Invalid email or password") unchanged; only log text changed.
- **Sync-detective:** Success responses and 404/500 behavior unchanged; only validation and log messages adjusted.
- **Subscription-plans:** Success responses unchanged; invalid body now returns 400 "Invalid request" instead of potentially throwing during Zod parse.
- **POST /api/applications:** Validation and success/error responses unchanged; only logging removed.
- **Admin CMS:** Success and error response bodies unchanged; only error log content redacted.

Hygiene cleanup complete. No behavior changes introduced.
