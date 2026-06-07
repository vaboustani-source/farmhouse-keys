import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase, type LbBooking, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, formatMoney } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";
import { RefundPanel } from "@/components/lb/RefundPanel";
import { AdjustPanel } from "@/components/lb/AdjustPanel";

export const Route = createFileRoute("/events/$eventId/sections/$sectionId")({
  component: SectionBookingsPage,
});

async function fetchSection(sectionId: string, eventId: string) {
  const [s, b, ev, ac, evBk] = await Promise.all([
    supabase.from("lb_room_sections").select("*").eq("id", sectionId).single(),
    supabase
      .from("lb_bookings")
      .select("*")
      .eq("section_id", sectionId)
      .eq("event_id", eventId)
      .order("booked_at", { ascending: false }),
    supabase
      .from("lb_events")
      .select("check_in_date")
      .eq("id", eventId)
      .single(),
    supabase
      .from("lb_additional_charges")
      .select("booking_id, amount, status")
      .eq("event_id", eventId),
    supabase
      .from("lb_bookings")
      .select("total_amount, payment_status, refund_amount, removed")
      .eq("event_id", eventId),
  ]);
  if (s.error) throw s.error;
  const byBooking = new Map<string, number>();
  for (const r of (ac.data ?? []) as Array<{ booking_id: string; amount: number; status: string }>) {
    if (r.status !== "succeeded") continue;
    byBooking.set(r.booking_id, (byBooking.get(r.booking_id) ?? 0) + Number(r.amount));
  }
  const eventTotals = (evBk.data ?? []).reduce(
    (acc, b: any) => {
      if (b.removed) return acc;
      const { paid, balance } = paymentBreakdown(b.payment_status, Number(b.total_amount || 0), Number(b.refund_amount || 0));
      acc.collected += paid;
      acc.outstanding += balance;
      return acc;
    },
    { collected: 0, outstanding: 0 },
  );
  return {
    section: s.data as LbRoomSection,
    bookings: (b.data ?? []) as LbBooking[],
    checkInDate: (ev.data?.check_in_date ?? null) as string | null,
    additionalByBooking: byBooking,
    eventTotals,
  };
}

function paymentBreakdown(status: string, total: number, refundAmount: number) {
  switch (status) {
    case "paid":
      return { paid: total, balance: 0 };
    case "deposit_paid":
      return { paid: total / 2, balance: total / 2 };
    case "covered":
      return { paid: 0, balance: 0 };
    case "payment_failed":
      return { paid: total / 2, balance: total / 2 };
    case "refunded":
      return { paid: -refundAmount, balance: 0 };
    case "pending":
    default:
      return { paid: 0, balance: total };
  }
}

function PaymentProgress({
  status,
  total,
  refundAmount,
}: {
  status: string;
  total: number;
  refundAmount: number;
}) {
  let pct = 0;
  let barClass = "bg-muted-foreground/30";
  let label = "";
  const deposit = total / 2;
  switch (status) {
    case "paid":
      pct = 100;
      barClass = "bg-[#2C3E2D]";
      label = `${formatMoney(total)} paid in full`;
      break;
    case "covered":
      pct = 100;
      barClass = "bg-[#2C3E2D]";
      label = "Covered";
      break;
    case "deposit_paid":
      pct = 50;
      barClass = "bg-[#C9A84C]";
      label = `${formatMoney(deposit)} of ${formatMoney(total)} paid`;
      break;
    case "payment_failed":
      pct = 50;
      barClass = "bg-red-500";
      label = `${formatMoney(deposit)} of ${formatMoney(total)} — payment failed`;
      break;
    case "refunded":
      pct = 100;
      barClass = "bg-red-300";
      label = `Refunded ${formatMoney(refundAmount)}`;
      break;
    case "pending":
    default:
      pct = 0;
      barClass = "bg-muted-foreground/30";
      label = `${formatMoney(0)} of ${formatMoney(total)}`;
      break;
  }
  return (
    <div className="min-w-[160px]">
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${barClass} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">{label}</div>
    </div>
  );
}

function SectionBookingsPage() {
  const { eventId, sectionId } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [openRefundId, setOpenRefundId] = useState<string | null>(null);
  const [openAdjustId, setOpenAdjustId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["lb_section_bookings", sectionId],
    queryFn: () => fetchSection(sectionId, eventId),
  });

  if (isLoading || !data) {
    return <AdminShell><EventLayout eventId={eventId} currentTab="bookings"><div className="text-sm text-muted-foreground">Loading…</div></EventLayout></AdminShell>;
  }
  const { section, bookings, checkInDate, additionalByBooking } = data;
  const filtered = bookings.filter((b) => filter === "all" || b.payment_status === filter);
  const sectionTotals = bookings.reduce(
    (acc, b) => {
      if (b.removed) return acc;
      const { paid, balance } = paymentBreakdown(b.payment_status, Number(b.total_amount || 0), Number(b.refund_amount || 0));
      acc.collected += paid;
      acc.outstanding += balance;
      return acc;
    },
    { collected: 0, outstanding: 0 },
  );
  const REFUNDABLE = new Set(["paid", "deposit_paid", "covered"]);
  const ADJUSTABLE = new Set(["pending", "deposit_paid", "paid"]);

  const updateRoom = async (id: string, val: string) => {
    const { error } = await supabase.from("lb_bookings").update({ room_assignment: val || null }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["lb_section_bookings", sectionId] });
  };

  const exportCsv = () => {
    const headers = ["Guest", "Email", "Phone", "Nights", "Add-ons", "Total", "Status", "Room", "Booked"];
    const rows = bookings.map((b) => [
      b.guest_name, b.guest_email, b.guest_phone ?? "",
      String(b.nights_booked),
      (b.addons_selected ?? []).map((a) => a.name).join("; "),
      String(b.total_amount), b.payment_status,
      b.room_assignment ?? "",
      new Date(b.booked_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${section.section_name.replace(/\s+/g, "_")}_bookings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell>
      <EventLayout eventId={eventId} currentTab="bookings">
      <Link
        to="/events/$eventId"
        params={{ eventId }}
        className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← Back to event
      </Link>
      <div className="mt-2 mb-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-medium text-foreground">{section.section_name}</h1>
          <p className="text-sm text-muted-foreground">
            {bookings.length} reservation{bookings.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 p-16 text-center">
          <h2 className="font-serif text-2xl text-foreground">No reservations yet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">The link is out there.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Nights</th>
                <th className="px-4 py-3 font-medium">Add-ons</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Booked</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <Fragment key={b.id}>
                <tr className={`border-b border-border last:border-0 hover:bg-muted/20 ${b.payment_status === "refunded" ? "opacity-70" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{b.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{b.guest_email}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{b.nights_booked}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {(b.addons_selected ?? []).map((a) => a.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <div>{formatMoney(b.total_amount)}</div>
                    {b.payment_status === "refunded" && b.refund_amount != null && (
                      <div className="text-[11px] text-red-700/80">
                        −{formatMoney(Number(b.refund_amount))} refunded
                      </div>
                    )}
                    {(() => {
                      const extra = additionalByBooking.get(b.id) ?? 0;
                      if (extra === 0) return null;
                      return (
                        <div className="text-[11px] font-medium text-primary">
                          {extra > 0 ? "+" : ""}
                          {formatMoney(extra)}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3"><PaymentBadge status={b.payment_status} /></td>
                  <td className="px-4 py-3">
                    <input
                      defaultValue={b.room_assignment ?? ""}
                      placeholder="Assign…"
                      onBlur={(e) => {
                        if ((e.target.value || "") !== (b.room_assignment ?? "")) {
                          updateRoom(b.id, e.target.value);
                        }
                      }}
                      className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(b.booked_at).toLocaleDateString()}
                    {b.payment_schedule === "deposit_50_balance_50" &&
                      b.payment_update_token && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const url = `${window.location.origin}/update-payment/${b.payment_update_token}`;
                              try {
                                await navigator.clipboard.writeText(url);
                                toast.success("Payment update link copied");
                              } catch {
                                toast.error("Could not copy link");
                              }
                            }}
                            className="text-[11px] uppercase tracking-wider text-primary hover:underline"
                          >
                            Payment update link
                          </button>
                        </div>
                      )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.payment_status === "refunded" ? (
                      <span className="text-[11px] text-muted-foreground">
                        Refunded {b.refunded_at ? new Date(b.refunded_at).toLocaleDateString() : ""}
                      </span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        {ADJUSTABLE.has(b.payment_status) && b.removed !== true && (
                          <button
                            onClick={() => {
                              setOpenRefundId(null);
                              setOpenAdjustId(openAdjustId === b.id ? null : b.id);
                            }}
                            className="rounded border border-primary/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-primary hover:bg-primary/5"
                          >
                            {openAdjustId === b.id ? "Close" : "Adjust"}
                          </button>
                        )}
                        {REFUNDABLE.has(b.payment_status) && b.removed !== true && (
                          <button
                            onClick={() => {
                              setOpenAdjustId(null);
                              setOpenRefundId(openRefundId === b.id ? null : b.id);
                            }}
                            className="rounded border border-red-300 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-red-700 hover:bg-red-50"
                          >
                            {openRefundId === b.id ? "Close" : "Refund"}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {openRefundId === b.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-4 py-4">
                      <RefundPanel
                        booking={b}
                        sectionName={section.section_name}
                        checkInDate={checkInDate}
                        onClose={() => setOpenRefundId(null)}
                        onDone={() => {
                          setOpenRefundId(null);
                          qc.invalidateQueries({ queryKey: ["lb_section_bookings", sectionId] });
                        }}
                      />
                    </td>
                  </tr>
                )}
                {openAdjustId === b.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-4 py-4">
                      <AdjustPanel
                        booking={b}
                        section={section}
                        onClose={() => setOpenAdjustId(null)}
                        onDone={() => {
                          qc.invalidateQueries({ queryKey: ["lb_section_bookings", sectionId] });
                        }}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </EventLayout>
    </AdminShell>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-primary/15 text-primary border-primary/30",
    deposit_paid: "bg-primary/15 text-primary border-primary/30",
    covered: "bg-primary/15 text-primary border-primary/30",
    pending: "bg-accent/20 text-accent-foreground border-accent/40",
    failed: "bg-destructive/15 text-destructive border-destructive/40",
    payment_failed: "bg-destructive/15 text-destructive border-destructive/40",
    refunded: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wider ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}