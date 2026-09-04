import { publicUrl } from "@/lib/public-url";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState, type ReactNode } from "react";
import { Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase, type LbBooking, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, formatMoney } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";
import { RefundPanel } from "@/components/lb/RefundPanel";
import { AdjustPanel } from "@/components/lb/AdjustPanel";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/events/$eventId/sections/$sectionId")({
  component: SectionBookingsPage,
});

async function fetchSection(sectionId: string, eventId: string) {
  const [s, b, ev, ac, evBk, rr] = await Promise.all([
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
    supabase
      .from("lb_refund_requests")
      .select("booking_id, requested_by_email, requested_by_name, amount_cents, created_at")
      .eq("event_id", eventId)
      .eq("status", "pending"),
  ]);
  if (s.error) throw s.error;
  const pendingRefunds = new Map<string, { requested_by_email: string; requested_by_name: string | null; amount_cents: number; created_at: string }>();
  for (const r of (rr.data ?? []) as any[]) pendingRefunds.set(r.booking_id, r);
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
    pendingRefunds,
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
    <div className="min-w-[120px]">
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

type SortKey = "guest_name" | "nights_booked" | "addons_count" | "total_amount" | "paid" | "balance" | "payment_status" | "room_assignment" | "booked_at";

function SectionBookingsPage() {
  const { eventId, sectionId } = Route.useParams();
  const { hasFullAccessForEvent } = useAuth();
  const canManagePayments = hasFullAccessForEvent(eventId);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [openRefundId, setOpenRefundId] = useState<string | null>(null);
  const [openAdjustId, setOpenAdjustId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["lb_section_bookings", sectionId],
    queryFn: () => fetchSection(sectionId, eventId),
  });

  if (isLoading || !data) {
    return <AdminShell><EventLayout eventId={eventId} currentTab="bookings"><div className="text-sm text-muted-foreground">Loading…</div></EventLayout></AdminShell>;
  }
  const { section, bookings, checkInDate, additionalByBooking, pendingRefunds } = data;
  const filtered = bookings.filter((b) => filter === "all" || b.payment_status === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (!sort) return 0;
    const dir = sort.dir === "asc" ? 1 : -1;
    let valA: string | number = "";
    let valB: string | number = "";
    switch (sort.key) {
      case "guest_name":
        valA = a.guest_name.toLowerCase();
        valB = b.guest_name.toLowerCase();
        break;
      case "nights_booked":
        valA = a.nights_booked;
        valB = b.nights_booked;
        break;
      case "addons_count":
        valA = (a.addons_selected ?? []).length;
        valB = (b.addons_selected ?? []).length;
        break;
      case "total_amount":
        valA = Number(a.total_amount || 0);
        valB = Number(b.total_amount || 0);
        break;
      case "paid": {
        const pa = paymentBreakdown(a.payment_status, Number(a.total_amount || 0), Number(a.refund_amount || 0)).paid;
        const pb = paymentBreakdown(b.payment_status, Number(b.total_amount || 0), Number(b.refund_amount || 0)).paid;
        valA = pa;
        valB = pb;
        break;
      }
      case "balance": {
        const ba = paymentBreakdown(a.payment_status, Number(a.total_amount || 0), Number(a.refund_amount || 0)).balance;
        const bb = paymentBreakdown(b.payment_status, Number(b.total_amount || 0), Number(b.refund_amount || 0)).balance;
        valA = ba;
        valB = bb;
        break;
      }
      case "payment_status":
        valA = a.payment_status;
        valB = b.payment_status;
        break;
      case "room_assignment":
        valA = (a.room_assignment ?? "").toLowerCase();
        valB = (b.room_assignment ?? "").toLowerCase();
        break;
      case "booked_at":
        valA = new Date(a.booked_at).getTime();
        valB = new Date(b.booked_at).getTime();
        break;
    }
    if (typeof valA === "number" && typeof valB === "number") {
      return (valA - valB) * dir;
    }
    return String(valA).localeCompare(String(valB)) * dir;
  });

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

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => {
    const active = sort?.key === sortKey;
    return (
      <th className="px-3 py-3 font-medium">
        <button
          type="button"
          onClick={() =>
            setSort((prev) =>
              prev?.key === sortKey
                ? { key: sortKey, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { key: sortKey, dir: "asc" }
            )
          }
          className="inline-flex items-center gap-1 uppercase tracking-[0.16em] hover:text-foreground transition-colors"
        >
          {label}
          <ArrowUpDown className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`} />
        </button>
      </th>
    );
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
      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl sm:text-4xl font-medium text-foreground break-words">{section.section_name}</h1>
          <p className="text-sm text-muted-foreground">
            {bookings.length} reservation{bookings.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-md border border-border bg-card px-3 py-2 min-h-[44px] text-sm"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 min-h-[44px] text-sm hover:bg-muted"
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <SortHeader label="Guest" sortKey="guest_name" />
                <SortHeader label="Nights" sortKey="nights_booked" />
                <SortHeader label="Add-ons" sortKey="addons_count" />
                <SortHeader label="Total" sortKey="total_amount" />
                <SortHeader label="Paid" sortKey="paid" />
                <SortHeader label="Balance" sortKey="balance" />
                <th className="px-3 py-3 font-medium">Payment</th>
                <SortHeader label="Status" sortKey="payment_status" />
                <SortHeader label="Room" sortKey="room_assignment" />
                <SortHeader label="Booked" sortKey="booked_at" />
                <th className="px-3 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <Fragment key={b.id}>
                <tr className={`border-b border-border last:border-0 hover:bg-muted/20 ${b.payment_status === "refunded" ? "opacity-70" : ""}`}>
                  <td className="px-3 py-3">
                    <div className="text-foreground">{b.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{b.guest_email}</div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{b.nights_booked}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {(b.addons_selected ?? []).map((a) => a.name).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <div>{formatMoney(b.total_amount)}</div>
                    {b.payment_status === "refunded" && b.refund_amount != null && (
                      <div className="text-[11px] text-red-700/80">
                        −{formatMoney(Number(b.refund_amount))} refunded
                      </div>
                    )}
                    {pendingRefunds.has(b.id) && (
                      <div
                        className="mt-1 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-800"
                        title={`${formatMoney((pendingRefunds.get(b.id)?.amount_cents ?? 0) / 100)} requested by ${pendingRefunds.get(b.id)?.requested_by_name || pendingRefunds.get(b.id)?.requested_by_email}`}
                      >
                        Refund awaiting approval
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
                  {(() => {
                    const total = Number(b.total_amount || 0);
                    const refundAmount = Number(b.refund_amount || 0);
                    let paidCell: ReactNode = formatMoney(0);
                    let balanceCell: ReactNode = formatMoney(total);
                    let balanceClass = "";
                    switch (b.payment_status) {
                      case "paid":
                        paidCell = formatMoney(total);
                        balanceCell = formatMoney(0);
                        break;
                      case "deposit_paid":
                        paidCell = formatMoney(total / 2);
                        balanceCell = formatMoney(total / 2);
                        break;
                      case "covered":
                        paidCell = <span className="text-muted-foreground">Covered</span>;
                        balanceCell = formatMoney(0);
                        break;
                      case "payment_failed":
                        paidCell = formatMoney(total / 2);
                        balanceCell = formatMoney(total / 2);
                        balanceClass = "text-red-700";
                        break;
                      case "refunded":
                        paidCell = <span className="text-red-700">({formatMoney(refundAmount)})</span>;
                        balanceCell = formatMoney(0);
                        break;
                      case "pending":
                      default:
                        paidCell = formatMoney(0);
                        balanceCell = formatMoney(total);
                    }
                    return (
                      <>
                        <td className="px-3 py-3 tabular-nums">{paidCell}</td>
                        <td className={`px-3 py-3 tabular-nums ${balanceClass}`}>{balanceCell}</td>
                        <td className="px-3 py-3">
                          <PaymentProgress
                            status={b.payment_status}
                            total={total}
                            refundAmount={refundAmount}
                          />
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-3 py-3"><PaymentBadge status={b.payment_status} /></td>
                  <td className="px-3 py-3">
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
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {new Date(b.booked_at).toLocaleDateString()}
                    {b.payment_schedule === "deposit_50_balance_50" &&
                      b.payment_update_token && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              const url = publicUrl(`/update-payment/${b.payment_update_token}`);
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
                  <td className="px-3 py-3 text-right">
                    {b.payment_status === "refunded" ? (
                      <span className="text-[11px] text-muted-foreground">
                        Refunded {b.refunded_at ? new Date(b.refunded_at).toLocaleDateString() : ""}
                      </span>
                    ) : (
                     <div className="flex justify-end gap-2">
                       {canManagePayments && (<>
                        {ADJUSTABLE.has(b.payment_status) && b.removed !== true && (
                          <button
                            onClick={() => {
                              setOpenRefundId(null);
                              setOpenAdjustId(openAdjustId === b.id ? null : b.id);
                            }}
                        className="rounded border border-primary/40 px-3 py-1.5 min-h-[36px] text-[11px] font-medium uppercase tracking-wider text-primary hover:bg-primary/5"
                          >
                            {openAdjustId === b.id ? "Close" : "Adjust"}
                          </button>
                        )}
                        {REFUNDABLE.has(b.payment_status) && b.removed !== true && (
                          <button
                            onClick={() => {
                              setOpenRefundId(null);
                              setOpenRefundId(openRefundId === b.id ? null : b.id);
                            }}
                        className="rounded border border-red-300 px-3 py-1.5 min-h-[36px] text-[11px] font-medium uppercase tracking-wider text-red-700 hover:bg-red-50"
                          >
                            {openRefundId === b.id ? "Close" : pendingRefunds.has(b.id) ? "Refund request" : "Request refund"}
                          </button>
                        )}
                       </>)}
                      </div>
                    )}
                  </td>
                </tr>
                {canManagePayments && openRefundId === b.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={11} className="px-3 py-4">
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
                {canManagePayments && openAdjustId === b.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={11} className="px-3 py-4">
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
            <tfoot>
              <tr className="border-t border-border bg-muted/30 text-sm">
                <td colSpan={4} className="px-3 py-3 font-medium text-foreground">
                  {section.section_name} totals
                </td>
                <td className="px-3 py-3 tabular-nums text-foreground">
                  Collected: {formatMoney(sectionTotals.collected)}
                </td>
                <td colSpan={6} className="px-3 py-3 tabular-nums text-muted-foreground">
                  Outstanding: {formatMoney(sectionTotals.outstanding)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-border bg-card p-6 text-center">
        <div className="font-serif text-3xl text-[#2C3E2D]" style={{ fontFamily: '"Cormorant Garamond", Cormorant, serif' }}>
          Total collected across all sections: {formatMoney(data.eventTotals.collected)}
        </div>
        <div className="mt-2 text-sm text-muted-foreground" style={{ fontFamily: 'Jost, sans-serif' }}>
          Total outstanding: {formatMoney(data.eventTotals.outstanding)}
        </div>
      </div>
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