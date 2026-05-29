import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { supabase, type LbBooking, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, FillBar } from "@/components/lb/AdminShell";
import { EventLayout } from "@/components/lb/EventNav";

export const Route = createFileRoute("/events/$eventId/bookings")({
  component: BookingsIndexPage,
});

async function fetchData(eventId: string) {
  const [sec, bk] = await Promise.all([
    supabase
      .from("lb_room_sections")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order"),
    supabase.from("lb_bookings").select("*").eq("event_id", eventId),
  ]);
  return {
    sections: (sec.data ?? []) as LbRoomSection[],
    bookings: (bk.data ?? []) as LbBooking[],
  };
}

function BookingsIndexPage() {
  const { eventId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["lb_bookings_index", eventId],
    queryFn: () => fetchData(eventId),
  });

  return (
    <AdminShell>
      <EventLayout eventId={eventId} currentTab="bookings">
        <h1 className="mb-2 font-serif text-3xl text-foreground">Bookings</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Choose a section to view its bookings and process refunds.
        </p>
        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.sections.map((s) => {
              const list = data.bookings.filter((b) => b.section_id === s.id && !b.removed);
              const confirmed = list.filter((b) =>
                ["paid", "deposit_paid", "covered"].includes(b.payment_status),
              ).length;
              const failed = list.filter((b) => b.payment_status === "payment_failed").length;
              return (
                <Link
                  key={s.id}
                  to="/events/$eventId/sections/$sectionId"
                  params={{ eventId, sectionId: s.id }}
                  className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-serif text-lg text-foreground">{s.section_name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {confirmed}/{s.total_rooms} confirmed
                        {failed > 0 && (
                          <span className="ml-2 text-red-600">· {failed} failed</span>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <FillBar filled={confirmed} total={s.total_rooms} className="mt-4" />
                </Link>
              );
            })}
          </div>
        )}
      </EventLayout>
    </AdminShell>
  );
}