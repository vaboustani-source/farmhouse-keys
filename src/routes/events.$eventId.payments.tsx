import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  supabase,
  type LbAdditionalCharge,
  type LbBooking,
  type LbEvent,
  type LbRoomSection,
} from "@/integrations/supabase/client";
import { AdminShell, formatMoney } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";

export const Route = createFileRoute("/events/$eventId/payments")({
  component: PaymentSummaryPage,
});

async function fetchAll(id: string) {
  const [evt, sec, bk, ac] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", id).single(),
    supabase.from("lb_room_sections").select("*").eq("event_id", id).order("sort_order"),
    supabase.from("lb_bookings").select("*").eq("event_id", id).order("booked_at", { ascending: false }),
    supabase
      .from("lb_additional_charges")
      .select("*")
      .eq("event_id", id)
      .eq("status", "succeeded")
      .order("charged_at", { ascending: false }),
  ]);
  if (evt.error) throw evt.error;
  return {
    event: evt.data as LbEvent,
    sections: (sec.data ?? []) as LbRoomSection[],
    bookings: (bk.data ?? []) as LbBooking[],
    additional: (ac.data ?? []) as LbAdditionalCharge[],
  };
}

function PaymentSummaryPage() {
  const { eventId } = Route.useParams();
  const [showExtras, setShowExtras] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["lb_payments", eventId],
    queryFn: () => fetchAll(eventId),
  });

  if (isLoading || !data) {
    return <AdminShell><EventLayout eventId={eventId} currentTab="payments"><div className="text-sm text-muted-foreground">Loading…</div></EventLayout></AdminShell>;
  }

  const { event, sections, bookings, additional } = data;
  const paid = bookings.filter((b) => b.payment_status === "paid");
  const sum = (xs: LbBooking[], k: keyof LbBooking) =>
    xs.reduce((s, b) => s + Number(b[k] ?? 0), 0);

  const totals = {
    base: sum(paid, "base_amount"),
    addons: sum(paid, "addon_amount"),
    resort: sum(paid, "resort_fee"),
    tax: sum(paid, "tax_amount"),
    total: sum(paid, "total_amount"),
  };
  const additionalTotal = additional.reduce((s, c) => s + Number(c.amount), 0);
  const guestName = (id: string) =>
    bookings.find((b) => b.id === id)?.guest_name ?? "—";

  return (
    <AdminShell>
      <EventLayout eventId={eventId} currentTab="payments">
      <Link
        to="/events/$eventId"
        params={{ eventId }}
        className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← Back to event
      </Link>
      <h1 className="mt-2 mb-2 font-serif text-4xl font-medium text-foreground">Payment summary</h1>
      <p className="mb-8 text-sm text-muted-foreground">{event.couple_names} · {paid.length} paid reservation{paid.length === 1 ? "" : "s"}</p>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Base lodging" value={formatMoney(totals.base)} />
        <Stat label="Add-ons" value={formatMoney(totals.addons)} />
        <Stat label="Resort fees" value={formatMoney(totals.resort)} />
        <Stat label="NY tax" value={formatMoney(totals.tax)} />
        <Stat label="Total collected" value={formatMoney(totals.total + additionalTotal)} accent />
      </div>

      <div className="mb-10 overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Additional charges
            </div>
            <div className="font-serif text-lg text-primary">
              {additional.length === 0
                ? "None"
                : `${formatMoney(additionalTotal)} · ${additional.length} ${additional.length === 1 ? "charge" : "charges"}`}
            </div>
          </div>
          {additional.length > 0 && (
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {showExtras ? "Hide" : "Show"}
            </span>
          )}
        </button>
        {showExtras && additional.length > 0 && (
          <table className="w-full border-t border-border text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {additional.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.charged_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{guestName(c.booking_id)}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.description}
                    {c.notes && (
                      <div className="text-[11px] text-muted-foreground">{c.notes}</div>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${Number(c.amount) < 0 ? "text-red-700" : "text-primary"}`}
                  >
                    {Number(c.amount) < 0 ? "−" : "+"}
                    {formatMoney(Math.abs(Number(c.amount)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mb-3 font-serif text-2xl text-foreground">By section</h2>
      <div className="mb-10 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Base</th>
              <th className="px-4 py-3 font-medium">Add-ons</th>
              <th className="px-4 py-3 font-medium">Resort</th>
              <th className="px-4 py-3 font-medium">Tax</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => {
              const rows = paid.filter((b) => b.section_id === s.id);
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-serif">{s.section_name}</td>
                  <td className="px-4 py-3 tabular-nums">{rows.length}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(sum(rows, "base_amount"))}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(sum(rows, "addon_amount"))}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(sum(rows, "resort_fee"))}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(sum(rows, "tax_amount"))}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(sum(rows, "total_amount"))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 font-serif text-2xl text-foreground">Transaction log</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Stripe ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No transactions yet.</td></tr>
            )}
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(b.booked_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span>{b.guest_name}</span>
                  {b.cot_requested && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                      🛏️ Cot
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{b.stripe_payment_id ?? "—"}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wider">{b.payment_status}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <div>{formatMoney(b.total_amount)}</div>
                  {b.payment_status === "refunded" && b.refund_amount != null && (
                    <div className="text-[11px] text-red-700/80">
                      −{formatMoney(Number(b.refund_amount))} refunded
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </EventLayout>
    </AdminShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-serif text-2xl ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}