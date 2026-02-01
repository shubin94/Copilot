# Data Consistency Audit: Forms, API, and Database

**Scope:** Signup, profile, and case/report (detective application + profile claim) forms vs. database schema and API handlers.  
**Date:** 2025-01-30.  
**No columns or fields were auto-deleted.**

---

## 1. Form Fields Collected

### 1.1 Signup (User)

| Source | Fields |
|--------|--------|
| **Login page** (`/login`, `/signup`) | `email`, `password` only (sign-in form) |
| **API** `POST /api/auth/register` | Expects `name`, `email`, `password` (validated by `insertUserSchema`) |
| **DB** `users` | `id`, `email`, `password`, `name`, `role`, `avatar`, `preferredCountry`, `preferredCurrency`, `mustChangePassword`, `createdAt`, `updatedAt` |

**Note:** `useRegister()` exists in `client/src/lib/hooks.ts` but is **not used by any component**. The only signup route (`/signup`) renders the same Login component (email + password). There is no UI that collects `name` for user registration.

### 1.2 Signup (Detective Application) — “Case/Report” Form

| Source | Fields |
|--------|--------|
| **Form** `detective-application-form.tsx` | `firstName`, `lastName` → sent as `fullName`; `email`, `password`, `confirmPassword` (not sent); `phoneCountryCode`, `phoneNumber`, `businessType`, `companyName`, `businessWebsite`, `logo`, `banner`, `businessDocuments`, `documents`, `country`, `state`, `city`, `fullAddress`, `pincode`, `yearsExperience`, `serviceCategories`, `categoryPricing`, `about`, `licenseNumber`, `isClaimable` (admin only) |
| **API** `POST /api/applications` | Validated by `insertDetectiveApplicationSchema`; payload matches table columns |
| **DB** `detective_applications` | `full_name`, `email`, `password`, `banner`, `phone_country_code`, `phone_number`, `business_type`, `company_name`, `business_website`, `logo`, `business_documents`, `country`, `state`, `city`, `full_address`, `pincode`, `years_experience`, `service_categories`, `category_pricing`, `about`, `license_number`, `documents`, `is_claimable`, `status`, `review_notes`, `reviewed_by`, `reviewed_at`, `created_at` |

All application form fields map to DB columns. `confirmPassword` is UI-only and correctly not persisted.

### 1.3 Profile (Detective Profile Edit)

| Source | Fields |
|--------|--------|
| **Form** `profile-edit.tsx` | Displays: `businessName`, `bio`, `location`, `city`, `state`, `country`, `address`, `pincode`, `languages`, `logo`, `yearsExperience`, `businessType`, `licenseNumber`, `businessWebsite`, `contactEmail`, `phone`, `whatsapp`, `recognitions`. **Sent on save:** `bio`, `contactEmail`, `languages` (array), `recognitions`, `phone`, `whatsapp`, `logo` (when changed). Many fields are disabled and not sent. |
| **API** `PATCH /api/detectives/:id` | Validated by `updateDetectiveSchema`; then passed to `storage.updateDetective()` which applies an **allowedFields** whitelist |
| **DB** `detectives` | All columns; update whitelist in storage limits what can be written |

### 1.4 Profile Claim (Case/Report)

| Source | Fields |
|--------|--------|
| **Form** `claim-profile.tsx` | `detectiveId`, `claimantName`, `claimantEmail`, `claimantPhone`, `details`, `documents` |
| **API** `POST /api/claims` | Validated by `insertProfileClaimSchema`; stored via `storage.createProfileClaim()` |
| **DB** `profile_claims` | `detective_id`, `claimant_name`, `claimant_email`, `claimant_phone`, `details`, `documents`, `status`, `review_notes`, `reviewed_by`, `reviewed_at`, `created_at` |

All claim form fields map to DB columns.

---

## 2. Mismatches and Recommendations

### 2.1 User Signup: `name` Not Collected

| Item | Finding | Recommendation |
|------|---------|----------------|
| **Field in form but missing in DB** | N/A | — |
| **Field in DB/API but not in form** | API and DB require `name`; no UI uses `useRegister()` or collects `name`. `/signup` shows the same Login (email + password) only. | **Option A:** Add a proper signup form that collects `name` and calls `api.auth.register(email, password, name)`. **Option B:** Mark as **intentionally not stored at signup** (e.g. document that user registration is only created via detective-application approval or other flows; if a signup form is added later, add `name`). Do not change DB or API yet. |

### 2.2 Detective Profile Update: `defaultServiceBanner` in Schema but Not in Storage Whitelist

| Item | Finding | Recommendation |
|------|---------|----------------|
| **API vs storage** | `updateDetectiveSchema` in `shared/schema.ts` includes `defaultServiceBanner`. `storage.updateDetective()` in `server/storage.ts` uses an `allowedFields` array that **does not** include `defaultServiceBanner`. So if the client sends `defaultServiceBanner`, Zod accepts it but the value is dropped and never written. | **Add missing allowed field:** Add `defaultServiceBanner` to the `allowedFields` array in `server/storage.ts` inside `updateDetective()`. This keeps API and storage aligned and allows future UI to edit default service banner if desired. Do not remove from schema. |

### 2.3 Detective Profile: Fields Displayed but Not Editable (Intentional)

| Item | Finding | Recommendation |
|------|---------|----------------|
| **Form vs send** | Profile edit shows `businessName`, `city`, `state`, `country`, `address`, `pincode`, `yearsExperience`, `businessType`, `licenseNumber`, `businessWebsite` as disabled; they are not sent in the PATCH payload. | **Mark as intentionally not stored via profile edit:** These are set at application approval and intentionally read-only in profile edit. No change needed. |

### 2.4 Application Form: `firstName` / `lastName` vs `fullName`

| Item | Finding | Recommendation |
|------|---------|----------------|
| **Form vs DB** | Form collects `firstName` and `lastName` and sends `fullName: firstName + " " + lastName`. DB has `full_name` only. | **Intentionally not stored as separate columns:** No DB change; current mapping is correct. |

---

## 3. Database Columns Not Written by Forms (Summary)

- **users:** `avatar`, `preferredCountry`, `preferredCurrency` — not in `insertUserSchema` payload; defaults/other flows only. **Action:** None; optional columns.
- **detectives:** `state`, `city` — not in `updateDetectiveSchema`; set only at application approval. **Action:** None; intentional.
- **detectives:** `defaultServiceBanner` — in `updateDetectiveSchema` but not in storage `allowedFields`; see recommendation above.

No columns were identified as “never read”; detective and user responses return full row data where applicable.

---

## 4. Recommended Actions (No Auto-Delete)

| # | Action | Type |
|---|--------|------|
| 1 | **User signup:** Either add a signup form that collects `name` and uses `api.auth.register(email, password, name)`, or document that `name` is intentionally not collected at signup (e.g. user accounts created only via detective approval or other flows). | Product / docs or frontend |
| 2 | **Detective profile update:** Add `defaultServiceBanner` to the `allowedFields` array in `server/storage.ts` in `updateDetective()` so that values accepted by `updateDetectiveSchema` are actually persisted. | Backend (storage whitelist) |

No migrations, column deletions, or frontend field removals are recommended by this audit. **Applied:** `defaultServiceBanner` was added to the `allowedFields` array in `server/storage.ts` inside `updateDetective()` so API and storage are aligned.

---

## 5. Correctness and Data Integrity

- **Detective application:** Form → API (Zod) → DB are aligned; all submitted fields have matching columns.
- **Profile claim:** Form → API (Zod) → DB are aligned.
- **Detective profile edit:** Schema allows more fields than storage persists; aligning storage with schema (for `defaultServiceBanner`) improves consistency and avoids silent drops.
- **User signup:** Name is required by API/DB but not collected in any current form; clarifying intent (add field vs. document as not collected) avoids future confusion.
