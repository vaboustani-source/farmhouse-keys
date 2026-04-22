import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Pencil, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase, type LbBooking, type LbEvent, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, FillBar, StatusBadge, formatDate, formatMoney } from "@/components/lb/AdminShell";

export const Route = createFileRoute("/events/$eventId/")({
  component: EventDetailPage,
});

async function fetchDetail(id: string) {
  const [evt, sec, bk] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", id).single(),
    supabase.from("lb_room_sections").select("*").eq("event_id", id).order("sort_order"),
    supabase.from("lb_bookings").select("*").eq("event_id", id),
  ]);
  if (evt.error) throw evt.error;
  return {
    event: evt.data as LbEvent,
    sections: (sec.data ?? []) as LbRoomSection[],
    bookings: (bk.data ?? []) as LbBooking[],
  };
}

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["lb_event_detail", eventId],
    queryFn: () => fetchDetail(eventId),
  });

  if (isLoading || !data) {
    return (
      <AdminShell>
        <div className="text-sm text-muted-foreground">Loading…</div>
      </AdminShell>
    );
  }

  const { event, sections, bookings } = data;
  const paidBookings = bookings.filter((b) => b.payment_status === "paid");
  const totalRevenue = paidBookings.reduce((s, b) => s + Number(b.total_amount), 0);
  const totalRoomsBooked = bookings.filter((b) => b.payment_status !== "failed").length;
  const totalRoomsCapacity = sections.filter((s) => s.is_active).reduce((s, x) => s + x.total_rooms, 0);

  const copyLink = (slug: string | null) => {
    if (!slug) return;
    const url = `${window.location.origin}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied — ready to send");
  };

  return (
    <AdminShell>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <Link to="/" className="text-xs uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
            ← All blocks
          </Link>
          <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">{event.couple_names}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatDate(event.wedding_date)}</span>
            <span>·</span>
            <StatusBadge status={event.status} />
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to="/events/$eventId/payments"
            params={{ eventId }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            <Receipt className="h-4 w-4" /> Payments
          </Link>
          <Link
            to="/events/$eventId/edit"
            params={{ eventId }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Pencil className="h-4 w-4" /> Edit block
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Rooms booked" value={`${totalRoomsBooked} / ${totalRoomsCapacity || "—"}`} />
        <Stat label="Revenue collected" value={formatMoney(totalRevenue)} />
        <Stat label="Reservations" value={`${bookings.length}`} />
      </div>

      <h2 className="mb-4 font-serif text-2xl text-foreground">Sections</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const filled = bookings.filter((b) => b.section_id === s.id && b.payment_status !== "failed").length;
          const url = s.booking_link_slug ? `${window.location.origin}/book/${s.booking_link_slug}` : null;
          return (
            <div key={s.id} className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-serif text-xl text-foreground">{s.section_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatMoney(s.price_per_night)}/night · {s.is_active ? "Active" : "Inactive"}
                  </div>
                </div>
                <span className="font-serif text-2xl tabular-nums text-foreground">
                  {filled}<span className="text-muted-foreground">/{s.total_rooms}</span>
                </span>
              </div>
              <FillBar filled={filled} total={s.total_rooms} className="mt-4" />
              {s.is_active && url && (
                <div className="mt-4 flex items-center gap-2 rounded border border-border bg-background/60 px-2.5 py-1.5">
                  <code className="flex-1 truncate text-[11px] text-muted-foreground">{url}</code>
                  <button onClick={() => copyLink(s.booking_link_slug)} className="inline-flex items-center gap-1 text-xs text-primary hover:text-accent">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Link
                  to="/events/$eventId/sections/$sectionId"
                  params={{ eventId, sectionId: s.id }}
                  className="text-xs uppercase tracking-wider text-primary hover:text-accent"
                >
                  View bookings →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-3xl text-foreground">{value}</div>
    </div>
  );
}