import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, type LbEvent, type LbRoomSection } from "@/integrations/supabase/client";
import { AdminShell, FillBar, StatusBadge, formatDate } from "@/components/lb/AdminShell";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/")({
  component: EventListPage,
});

const GUEST_CAPACITY = 40;

function GuestOccupancy({ confirmed }: { confirmed: number }) {
  const capped = Math.min(confirmed, GUEST_CAPACITY);
  const pct = (capped / GUEST_CAPACITY) * 100;
  const isFull = confirmed >= GUEST_CAPACITY;
  const barColor = isFull
    ? "bg-primary"
    : confirmed >= 20
      ? "bg-accent"
      : "bg-muted-foreground/40";
  return (
    <div className="min-w-[140px] max-w-[180px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-foreground/80">
          {confirmed} / {GUEST_CAPACITY} guests confirmed
        </span>
        {isFull && (
          <span className="inline-flex items-center rounded-full border border-primary bg-primary px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-foreground">
            Full
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type PlanningEvent = {
  id: string;
  title: string;
  partner1_name: string | null;
  partner2_name: string | null;
  wedding_date: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  status: string;
};

type EventWithBlock = PlanningEvent & {
  block: LbEvent | null;
  sections: Array<Pick<LbRoomSection, "id" | "section_name" | "total_rooms" | "is_active">>;
  bookedCounts: Record<string, number>;
  guestsConfirmed: number;
};

async function fetchEvents(): Promise<EventWithBlock[]> {
  // 1. Pull every planning-hub event.
  const { data: planningEvents, error: peErr } = await supabase
    .from("events")
    .select("id, title, partner1_name, partner2_name, wedding_date, arrival_date, departure_date, status")
    .order("wedding_date", { ascending: true, nullsFirst: false });
  if (peErr) throw peErr;
  if (!planningEvents?.length) return [];

  const ids = planningEvents.map((e) => e.id);

  // 2. Pull whatever lodging blocks already exist for these events.
  const [{ data: blocks }, { data: sections }, { data: bookings }] = await Promise.all([
    supabase.from("lb_events").select("*, couple_access_token").in("id", ids),
    supabase
      .from("lb_room_sections")
      .select("id, event_id, section_name, total_rooms, is_active, sort_order")
      .in("event_id", ids)
      .order("sort_order"),
    supabase.from("lb_bookings").select("event_id, section_id, payment_status").in("event_id", ids),
  ]);

  const counts: Record<string, number> = {};
  const guestCounts: Record<string, number> = {};
  (bookings ?? []).forEach((b) => {
    if (b.payment_status === "paid" || b.payment_status === "pending") {
      counts[b.section_id] = (counts[b.section_id] ?? 0) + 1;
    }
    if (b.payment_status === "paid" || b.payment_status === "covered") {
      guestCounts[b.event_id] = (guestCounts[b.event_id] ?? 0) + 1;
    }
  });

  return (planningEvents as PlanningEvent[]).map((e) => ({
    ...e,
    block: ((blocks ?? []) as LbEvent[]).find((b) => b.id === e.id) ?? null,
    sections: (sections ?? []).filter((s) => s.event_id === e.id),
    bookedCounts: counts,
    guestsConfirmed: guestCounts[e.id] ?? 0,
  }));
}

function EventListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { session, isAdmin, loading: authLoading } = useAuth();
  const authReady = !authLoading && !!session && isAdmin;
  const { data, isLoading } = useQuery({
    queryKey: ["planning_events_with_blocks", session?.user?.id ?? null],
    queryFn: fetchEvents,
    enabled: authReady,
  });

  const ensureBlock = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc("lb_ensure_block_for_event", { _event_id: eventId });
      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: ["planning_events_with_blocks"] });
      navigate({ to: "/events/$eventId/edit", params: { eventId } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not open block"),
  });

  return (
    <AdminShell>
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-5xl font-medium leading-tight text-foreground">
            Lodging Blocks
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            One block per wedding on the calendar. Open an event to set rates, share booking links,
            and watch the four houses fill.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Gathering the calendar…
        </div>
      ) : !data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card/60 p-16 text-center">
          <h2 className="font-serif text-2xl text-foreground">The calendar is quiet.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No weddings on the planning hub yet. Once an event is booked, it'll appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-5 py-4 font-medium">Couple</th>
                <th className="px-5 py-4 font-medium">Wedding Date</th>
                <th className="px-5 py-4 font-medium">Section Fill</th>
                <th className="px-5 py-4 font-medium">Guests</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {data.map((e) => {
                const activeSections = e.sections.filter((s) => s.is_active);
                const couple = [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ") || e.title;
                const isPending = ensureBlock.isPending && ensureBlock.variables === e.id;
                return (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-5">
                      <div className="font-serif text-lg text-foreground">{couple}</div>
                      <div className="text-xs text-muted-foreground">{e.title}</div>
                    </td>
                    <td className="px-5 py-5 text-foreground/80">{formatDate(e.wedding_date)}</td>
                    <td className="px-5 py-5">
                      {e.sections.length === 0 ? (
                        <span className="text-xs italic text-muted-foreground">
                          Not yet configured
                        </span>
                      ) : (
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
                      )}
                    </td>
                    <td className="px-5 py-5">
                      <GuestOccupancy confirmed={e.guestsConfirmed} />
                    </td>
                    <td className="px-5 py-5">
                      <StatusBadge
                        status={
                          e.guestsConfirmed >= GUEST_CAPACITY && e.block?.status === "active"
                            ? "full"
                            : (e.block?.status ?? "draft")
                        }
                      />
                    </td>
                    <td className="px-5 py-5 text-right">
                      {e.block ? (
                        <div className="flex items-center justify-end gap-2">
                          {(e.block as LbEvent & { couple_access_token?: string }).couple_access_token && (
                            <button
                              onClick={() => {
                                const token = (e.block as LbEvent & { couple_access_token?: string }).couple_access_token!;
                                navigator.clipboard.writeText(`${window.location.origin}/tracker/${token}`);
                                toast.success("Tracker link copied");
                              }}
                              title="Copy couple tracker link"
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="h-3 w-3" /> Tracker
                            </button>
                          )}
                          <Link
                            to="/events/$eventId"
                            params={{ eventId: e.id }}
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
                          >
                            Open <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ) : (
                        <button
                          onClick={() => ensureBlock.mutate(e.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> Opening…
                            </>
                          ) : (
                            <>Set up block</>
                          )}
                        </button>
                      )}
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
