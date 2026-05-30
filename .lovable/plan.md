# Admin Activity Log

Build a `lb_activity_log` table + UI that records every significant action across bookings, admin changes, and system events, with per-event and global views.

## 1. Database migration

Create `public.lb_activity_log`:

```
id              uuid pk default gen_random_uuid()
event_id        uuid null references lb_events(id) on delete cascade
booking_id      uuid null references lb_bookings(id) on delete set null
actor           text not null              -- 'admin'|'guest'|'system'|'stripe'
actor_name      text null
action          text not null              -- e.g. 'payment.deposit_paid'
label           text not null              -- human-readable
metadata        jsonb null
created_at      timestamptz not null default now()
```

Indexes: `(event_id)`, `(created_at desc)`, `(actor)`, `(event_id, created_at desc)`.

Grants:
- `GRANT SELECT, INSERT ON public.lb_activity_log TO authenticated;`
- `GRANT ALL ON public.lb_activity_log TO service_role;`

RLS:
- Enable RLS.
- SELECT: `public.is_event_member(event_id, auth.uid())` OR `public.is_admin(auth.uid())` OR `event_id is null` (global system events visible to admins only).
- INSERT: authenticated members of the event OR admin.

Enable realtime: `alter publication supabase_realtime add table public.lb_activity_log;` and `alter table public.lb_activity_log replica identity full;`.

## 2. Logging helpers

**Server-side helper** `src/lib/activity-log.server.ts`:

```ts
export async function logActivity(opts: {
  eventId?: string | null;
  bookingId?: string | null;
  actor: 'admin'|'guest'|'system'|'stripe';
  actorName?: string | null;
  action: string;
  label: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void>
```

Uses `supabaseAdmin`, never throws (logs + swallows errors so it doesn't break callers).

**Edge-function helper** `supabase/functions/_shared/activity-log.ts` — same signature, uses service role REST insert.

**Client-side server fn** `src/lib/activity.functions.ts`:
- `logActivityFn` — `requireSupabaseAuth`, infers actor=`admin`, actor_name from users table.
- `listActivity({ eventId?, actor?, category?, from?, to?, limit, cursor })` — paginated; uses admin client filtered server-side.

## 3. Wiring log calls

Add `logActivity(...)` calls at every event source:

**Stripe webhook** (`src/routes/api/public/stripe-webhook.ts`):
- `checkout.session.completed` → `payment.deposit_paid` / `payment.paid_full`
- `payment_intent.payment_failed` → `payment.failed`
- `setup_intent.succeeded` → `payment.method_updated`

**Edge functions**:
- `collect-balance-payments`: `payment.balance_charged`, `payment.balance_failed`
- `process-refund`: `refund.processed` (full/partial in metadata)
- `charge-additional`: `charge.additional_applied` or `refund.partial`
- `send-checkin-reminders`: `email.checkin_reminder_sent` (one row, count in metadata)
- `send-checkout-reminders`: `email.checkout_reminder_sent`
- `create-checkout-session`: `booking.link_generated` + payment_update_token mint logs `payment.update_link_generated`

**Admin UI / server fns**:
- Pricing save (`events.$eventId.pricing.tsx`) → `pricing.updated` with old/new
- Couple contribution save → `pricing.contribution_updated`
- Event create/activate/close (`events.new.tsx`, settings) → `event.created|activated|closed`
- Guest CSV import / manual add / remove / email correction (`events.$eventId.guests.tsx`) → `guest.imported|added|removed|email_corrected`
- Room assignment in `AdjustPanel` and bookings list → `booking.room_assigned|room_changed`
- Cot / addon changes in `AdjustPanel` → `booking.cot_added|addon_added|addon_removed`
- Soft delete → `booking.removed`
- Refund / manual charge actions are covered by edge functions above.
- Nudge from tracker (`tracker.functions.ts` if it exists) → `email.nudge_sent`
- Health check email (`system-health-check`) → `email.health_check_sent`

## 4. UI

**Shared component** `src/components/lb/ActivityFeed.tsx`:
- Props: `eventId?` (omit for global), `showEventTag?`.
- Loads via `listActivity` server fn (React Query).
- Filter pills: All / Bookings / Payments / Admin / System (maps to action prefixes).
- Global view extras: event dropdown, date range, actor dropdown.
- Row: category icon + colored badge, label, metadata line, relative time (with absolute on hover).
- Icons (lucide): `UserCheck` (booking), `CreditCard` (payment), `Undo2` (refund), `Settings` (admin), `Cpu` (system), `Mail` (email), `AlertCircle` (failure).
- Realtime: `supabase.channel('activity:'+eventId).on('postgres_changes',{ event:'INSERT', schema:'public', table:'lb_activity_log', filter:eventId?`event_id=eq.${eventId}`:undefined }, ...)` prepends new rows.
- Pagination: 200 rows/page, "Load more" using `created_at < cursor`.
- "Export CSV" button top-right — fetches all matching rows (cap 5k) and downloads.

**Per-event tab**:
- New route `src/routes/events.$eventId.activity.tsx`.
- Add `Activity` link with `History` icon to `src/components/lb/EventNav.tsx`, positioned between Payments and Pricing.

**Global activity log**:
- New route `src/routes/activity.tsx`.
- Add "Activity Log" item to the "All Events" dropdown in `AdminShell` top nav.

## 5. Action → category mapping

```
booking.*     → Bookings
payment.*     → Payments
refund.*      → Payments (refund icon)
charge.*      → Payments
pricing.*     → Admin
guest.*       → Admin
event.*       → Admin
email.*       → System
system.*      → System
```

Failure variants (`*.failed`) get red alert icon regardless of prefix.

## 6. Out of scope (explicit)

- No changes to `lb_sync_log` (kept as-is).
- No retroactive backfill of historical actions — log starts at deploy.
- No edits to existing email templates or business logic; only added `logActivity` calls.

## Files

**New**
- `supabase/migrations/<ts>_activity_log.sql`
- `src/lib/activity-log.server.ts`
- `src/lib/activity.functions.ts`
- `supabase/functions/_shared/activity-log.ts`
- `src/components/lb/ActivityFeed.tsx`
- `src/routes/events.$eventId.activity.tsx`
- `src/routes/activity.tsx`

**Edited (log calls + nav)**
- `src/components/lb/EventNav.tsx`
- `src/components/lb/AdminShell.tsx`
- `src/routes/api/public/stripe-webhook.ts`
- `supabase/functions/{collect-balance-payments,process-refund,charge-additional,send-checkin-reminders,send-checkout-reminders,create-checkout-session,create-setup-intent,system-health-check}/index.ts`
- `src/routes/events.$eventId.{pricing,guests,settings,sections.$sectionId}.tsx`
- `src/routes/events.new.tsx`
- `src/components/lb/AdjustPanel.tsx`
- `src/lib/tracker.functions.ts` (nudge)
