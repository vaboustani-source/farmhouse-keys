# Admin Adjust Panel

Adds an "Adjust" action next to "Refund" on each booking row in the section detail screen (`/events/$eventId/sections/$sectionId`), plus the supporting edge function, table, email template, and payment summary updates.

## 1. Database

New table `lb_additional_charges`:
- `id`, `booking_id`, `event_id`, `amount` (numeric), `description` (text), `notes` (text, nullable)
- `stripe_payment_intent_id` (text), `status` (text: `succeeded` | `failed`)
- `charged_at` (timestamptz, default now()), `charged_by` (text, nullable)
- RLS: admins manage; couples can SELECT their event's rows
- Grants: `authenticated` (full), `service_role` (full)

No schema change to `lb_bookings`/`lb_section_addons` — addon/cot edits reuse existing columns (`addons_selected`, `cot_requested`, `cot_fee`, `addon_amount`, `total_amount`, `room_assignment`).

## 2. Edge function — `charge-additional`

`supabase/functions/charge-additional/index.ts`, modeled on `collect-balance-payments`. Uses `STRIPE_SECRET_KEY` already in the project.

Request body:
```ts
{ bookingId, amountCents, description, notes?, chargedBy? }
```

Logic:
1. Load booking; require `stripe_payment_intent_id`.
2. Retrieve original PI → reuse `customer` + `payment_method`.
3. Create off-session PI (`confirm: true`, `off_session: true`, `description`).
4. On success: insert `lb_additional_charges` row (`status='succeeded'`), send guest email via Resend (uses `additionalChargeEmail` template inlined into function), send admin notification, return `{ ok: true, chargeId }`.
5. On failure: insert `lb_additional_charges` row with `status='failed'`, log to `lb_sync_log`, return `{ ok: false, error }`. (Spec says "do not log charge" — we log to `lb_sync_log` only for traceability and skip the `lb_additional_charges` insert, matching the spec.)

Auth: anon key + `verify_jwt = false` in `config.toml` (matches existing admin-triggered functions).

## 3. Email template

Add `additionalChargeEmail(props)` to `src/lib/email-templates.ts` per spec (gold "Charge processed" badge, detail table: Amount / Description / Applied to: card on file, body copy, standard GFH footer, no cancellation policy).

## 4. UI — AdjustPanel component

New `src/components/lb/AdjustPanel.tsx` opened inline below booking row (same toggle pattern as `RefundPanel`).

Header: guest name · section name · current payment status badge.

**Section 1 — Add a cot** (only when `cot_requested = false`)
- Toggle showing "$X for the stay" (from `lb_room_sections.cot_2night_rate` / `cot_1night_rate` based on `nights_booked`).
- On toggle on:
  - `pending` → just update `cot_requested`, `cot_fee`, `total_amount`.
  - `deposit_paid` → update those fields (balance recalc happens at collect-balance time, already reads `total_amount`).
  - `paid` → call `charge-additional` for the cot fee (description "Cot added to reservation"); on success also flip `cot_requested`/`cot_fee`/`total_amount`.

**Section 2 — Add-ons**
- Fetch active `lb_section_addons` for the booking's section.
- Render toggle per addon; pre-toggled when present in `addons_selected`.
- On change, recompute `addons_selected` + `addon_amount` + `total_amount`.
  - `pending` / `deposit_paid` → update only.
  - `paid` + added → `charge-additional` for the diff (description = addon name).
  - `paid` + removed → call existing `process-refund` for the addon price (description = "Refund: <addon name>").

**Section 3 — Manual charge**
- Amount (USD), Description (required), Notes (optional).
- "Charge $X" gold button → confirm dialog → `charge-additional`.
- Success toast + inline error on failure.

**Section 4 — Room override**
- Inline text input for `room_assignment`, saves on blur (mirrors existing inline edit).

After any mutation: invalidate the section's query so the row re-renders.

## 5. Section detail screen edits (`events.$eventId.sections.$sectionId.tsx`)

- Add "Adjust" ghost button (gold border) next to "Refund" when `payment_status ∈ {pending, deposit_paid, paid}` and `!removed`.
- Track `openAdjustId` state mirroring `openRefundId`; only one panel open per row.
- Below the main total, show `+ $[sum]` gold badge if booking has rows in `lb_additional_charges`.

## 6. Payment Summary (`events.$eventId.payments.tsx`)

Add "Additional charges" line with expandable list (description · amount · guest name) by joining `lb_additional_charges` for the event. Insert between resort fees and taxes.

## 7. Files

```
supabase/functions/charge-additional/index.ts        (new)
supabase/config.toml                                 (register function, verify_jwt=false)
supabase/migrations/<ts>_lb_additional_charges.sql   (new)
src/lib/email-templates.ts                           (add additionalChargeEmail)
src/components/lb/AdjustPanel.tsx                    (new)
src/routes/events.$eventId.sections.$sectionId.tsx   (Adjust button + panel + badge)
src/routes/events.$eventId.payments.tsx              (additional charges line)
src/integrations/supabase/client.ts                  (LbAdditionalCharge type)
```

## Open questions

1. **Resort fee / tax on additional charges and cot/addon diffs** — should the charged amount include the event's `resort_fee_pct` and `tax_pct`, or be the raw amount the admin enters / the raw addon/cot price? Spec doesn't say. Default in this plan: **raw amount only** (no tax/fee added). Confirm if you want tax+fee layered on.
2. **Admin name for `charged_by`** — there's no admin display name in context today. Default: leave `null`. Confirm if you'd like to pull from `users.email` or add an input.
3. **Refund-on-addon-removal when `payment_status='paid'`** — use existing `process-refund` flow with `refund_reason = 'addon_removed'`? Default: yes.
