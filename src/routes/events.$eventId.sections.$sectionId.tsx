import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase, type LbBooking, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, formatMoney } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";
import { RefundPanel } from "@/components/lb/RefundPanel";

export const Route = createFileRoute("/events/$eventId/sections/$sectionId")({
  component: SectionBookingsPage,
});

async function fetchSection(sectionId: string, eventId: string) {
  const [s, b, ev] = await Promise.all([
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
  ]);
  if (s.error) throw s.error;
  return {
    section: s.data as LbRoomSection,
    bookings: (b.data ?? []) as LbBooking[],
    checkInDate: (ev.data?.check_in_date ?? null) as string | null,
  };
}

function SectionBookingsPage() {
  const { eventId, sectionId } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [openRefundId, setOpenRefundId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["lb_section_bookings", sectionId],
    queryFn: () => fetchSection(sectionId, eventId),
  });

  if (isLoading || !data) {
    return <AdminShell><EventLayout eventId={eventId} currentTab="bookings"><div className="text-sm text-muted-foreground">Loading…</div></EventLayout></AdminShell>;
  }
  const { section, bookings, checkInDate } = data;
  const filtered = bookings.filter((b) => filter === "all" || b.payment_status === filter);
  const REFUNDABLE = new Set(["paid", "deposit_paid", "covered"]);

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
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.payment_status === "refunded" ? (
                      <span className="text-[11px] text-muted-foreground">
                        Refunded {b.refunded_at ? new Date(b.refunded_at).toLocaleDateString() : ""}
                      </span>
                    ) : REFUNDABLE.has(b.payment_status) && b.removed !== true ? (
                      <button
                        onClick={() => setOpenRefundId(openRefundId === b.id ? null : b.id)}
                        className="rounded border border-red-300 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-red-700 hover:bg-red-50"
                      >
                        {openRefundId === b.id ? "Close" : "Refund"}
                      </button>
                    ) : null}
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