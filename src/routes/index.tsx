import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight } from "lucide-react";
import { supabase, type LbEvent, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, FillBar, StatusBadge, formatDate } from "@/components/lb/AdminShell";

export const Route = createFileRoute("/")({
  component: EventListPage,
});

type EventWithSections = LbEvent & {
  sections: Array<Pick<LbRoomSection, "id" | "section_name" | "total_rooms" | "is_active">>;
  bookedCounts: Record<string, number>;
};

async function fetchEvents(): Promise<EventWithSections[]> {
  const { data: events, error } = await supabase
    .from("lb_events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!events?.length) return [];

  const ids = events.map((e) => e.id);
  const { data: sections } = await supabase
    .from("lb_room_sections")
    .select("id, event_id, section_name, total_rooms, is_active, sort_order")
    .in("event_id", ids)
    .order("sort_order");

  const { data: bookings } = await supabase
    .from("lb_bookings")
    .select("section_id, payment_status")
    .in("event_id", ids);

  const counts: Record<string, number> = {};
  (bookings ?? []).forEach((b) => {
    if (b.payment_status === "paid" || b.payment_status === "pending") {
      counts[b.section_id] = (counts[b.section_id] ?? 0) + 1;
    }
  });

  return events.map((e) => ({
    ...(e as LbEvent),
    sections: (sections ?? []).filter((s) => s.event_id === e.id),
    bookedCounts: counts,
  }));
}

function EventListPage() {
  const { data, isLoading } = useQuery({ queryKey: ["lb_events"], queryFn: fetchEvents });

  return (
    <AdminShell>
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-5xl font-medium leading-tight text-foreground">
            Lodging Blocks
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Each block holds the four houses on the estate. Open one to set rates, share booking
            links, and watch the rooms fill.
          </p>
        </div>
        <Link
          to="/events/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm tracking-wide text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Event
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Gathering the calendar…
        </div>
      ) : !data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 p-16 text-center">
          <h2 className="font-serif text-2xl text-foreground">The calendar is quiet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first lodging block.
          </p>
          <Link
            to="/events/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Event
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-5 py-4 font-medium">Couple</th>
                <th className="px-5 py-4 font-medium">Wedding Date</th>
                <th className="px-5 py-4 font-medium">Section Fill</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {data.map((e) => {
                const activeSections = e.sections.filter((s) => s.is_active);
                return (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-5">
                      <div className="font-serif text-lg text-foreground">{e.couple_names}</div>
                      <div className="text-xs text-muted-foreground">{e.wedding_name}</div>
                    </td>
                    <td className="px-5 py-5 text-foreground/80">{formatDate(e.wedding_date)}</td>
                    <td className="px-5 py-5">
                      <div className="flex max-w-xs flex-col gap-1.5">
                        {(activeSections.length ? activeSections : e.sections).map((s) => {
                          const filled = e.bookedCounts[s.id] ?? 0;
                          return (
                            <div key={s.id} className="flex items-center gap-3">
                              <span className="w-32 truncate text-xs text-muted-foreground">
                                {s.section_name}
                              </span>
                              <FillBar filled={filled} total={s.total_rooms} className="flex-1" />
                              <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
                                {filled}/{s.total_rooms}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-5 text-right">
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: e.id }}
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-primary hover:text-accent"
                      >
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
